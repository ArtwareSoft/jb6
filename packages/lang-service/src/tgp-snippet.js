import { coreUtils, dsls } from '@jb6/core'
import { langServiceUtils } from './lang-service-parsing-utils.js'
import '@jb6/core/misc/import-map-services.js'
const { calcProfileActionMap } = langServiceUtils
import { parse } from '../lib/acorn-loose.mjs'

const { unique, calcTgpModelData, runCliInContext, toCapitalType, calcRepoRoot, discoverDslEntryPoints } = coreUtils
Object.assign(coreUtils, { runSnippetCli, macroToJson })

function macroToJson(macroText, tgpModel) {
  const cleanText = macroText.replace(/^[^<]+<[^>]+>:?/, '')
  const allComps = Object.values(tgpModel.dsls).flatMap(type => Object.values(type)).filter(x => typeof x == 'object').flatMap(x => Object.values(x))
  const firstCallee = parse(cleanText, { ecmaVersion: 'latest', sourceType: 'module' }).body[0]?.expression?.callee
  const firstName = firstCallee?.name || [firstCallee?.object?.name, firstCallee?.property?.name].join('.')
  const { type } = allComps.find(c => c.id === firstName) || { type: 'data' }
  const compText = `${toCapitalType(type)}('noName',{impl: ${cleanText}})`
  const { comp, error } = calcProfileActionMap(compText, { tgpModel })
  if (error) return { error }
  return toJson(comp.impl)
}

function toJson(v) {
  if (v == null || typeof v !== 'object') return v
  if (Array.isArray(v)) return v.map(toJson)
  return Object.fromEntries(Object.keys(v).filter(k => k[0] !== '$' || k === '$').map(k =>
    [k, k === '$' ? (v.$$ || v.$) : toJson(v[k])]))
}

async function runSnippetCli(args) {
  const repoRoot = args.repoRoot || await calcRepoRoot()
  const toJson = p => p == null ? p : typeof p === 'string' ? p : JSON.stringify(coreUtils.tgpProfileToJson(p))
  const res = await calcJsonProfileScript({...args, profileText: toJson(args.profile ?? args.profileText), ctxEnricher: toJson(args.ctxEnricher), repoRoot})
  const { ecmScript, projectDir, importMapsInCli, topLevelImports, error } = res
  if (error) return res
  try {
    const result = await runCliInContext(
      `${ecmScript}\n await coreUtils.writeServiceResult(await calc())`,
      {projectDir, importMapsInCli, ctx: args.ctx, bindLoggers: args.bindLoggers, stream: 'both'}
    )
    return { ...result.result, topLevelImports }
  } catch (error) {
    return { error, ecmScript, projectDir, importMapsInCli }
  }
}

// Auto-discover Node-side imports needed to resolve `$:'type<dsl>id'` refs in the given profile(s)/JSON-text.
// Accepts a TGP profile, an array of profiles, or a JSON string. Returns importsStr ready to inline,
// plus projectDir + importMapsInCli for runCliInContext.
async function calcImportsForProfile(input, {repoRoot, fetchByEnvHttpServer} = {}) {
  repoRoot = repoRoot || await calcRepoRoot()
  const text = typeof input === 'string' ? input
    : Array.isArray(input) ? input.map(p => JSON.stringify(coreUtils.tgpProfileToJson(p))).join('\n')
    : JSON.stringify(coreUtils.tgpProfileToJson(input))
  const allFullIds = unique([...text.matchAll(/["']\$["']\s*:\s*["']([^"']+)["']|\$\s*:\s*'([^']+)'/g)].map(m => m[1] || m[2]))
  const parsed = allFullIds.map(id => { const m = id.match(/^([^<]+)<([^>]+)>(.+)$/); return m && { type: m[1], dsl: m[2], shortId: m[3], fullId: id } }).filter(Boolean)
  if (!parsed.length) return { error: `no valid {$: 'type<dsl>id'} found in profile`, topLevelImports: [], importsStr: '' }
  const allDsls = unique(parsed.map(p => p.dsl))
  const tgpModel = await calcTgpModelData({forRepo: repoRoot, forDsls: allDsls.join(','), fetchByEnvHttpServer })
  if (tgpModel.error) return { error: tgpModel.error }
  const projectDir = tgpModel.projectDir || repoRoot
  const comps = parsed.map(p => tgpModel.dsls[p.dsl]?.[p.type]?.[p.shortId]).filter(Boolean)
  if (!comps.length) return { error: `can not find ${allFullIds.join(', ')}` }
  const allComps = collectTransitiveComps(comps, tgpModel)
  const allCompDsls = unique([...allDsls, ...allComps.map(c => c.dsl)])
  const dslsEntryPoints = await discoverDslEntryPoints({ forDsls: allCompDsls, repoRoot })
  const entryFiles = unique(allComps.map(c => c.$location?.path).filter(Boolean))
  const topLevelImports = calcMinimalImports([...dslsEntryPoints, ...entryFiles], tgpModel.importGraph)
  const importsStr = topLevelImports.map(f => `await import('${f}')`).join('\n')
  return { topLevelImports, importsStr, projectDir, importMapsInCli: tgpModel.importMap.importMapsInCli, tgpModel }
}
Object.assign(coreUtils, { calcImportsForProfile })

async function calcJsonProfileScript({profileText, repoRoot, fetchByEnvHttpServer, bindLoggers, ctxEnricher}) {
  const imp = await calcImportsForProfile(profileText + (ctxEnricher || ''), {repoRoot, fetchByEnvHttpServer})
  if (imp.error) return imp
  const { importsStr, projectDir, importMapsInCli } = imp
  const loggerNames = (bindLoggers || '').split(',').map(s => s.trim()).filter(Boolean)
  const wrapStmt = loggerNames.length ? `coreUtils.wrapLoggersToStderr(${JSON.stringify(loggerNames)})\n    ` : ''
  const enrichStmt = ctxEnricher ? `.run(${ctxEnricher})` : ''
  const loggerSetup = `
    ${wrapStmt}const result = await (await coreUtils.ensureLoggers(${JSON.stringify(loggerNames)})${enrichStmt}).run(${profileText})`
  const ecmScript = `
  // dir: ${projectDir}
import { coreUtils } from '@jb6/core'
export async function calc() {
  ${importsStr}
  try {${loggerSetup}
    return {result: coreUtils.stripData(result)}
  } catch (e) {
    return coreUtils.stripData(e)
  }
}
`
  return { ecmScript, projectDir, importMapsInCli, topLevelImports: imp.topLevelImports }
}

function collectTransitiveComps(initialComps, tgpModel) {
  const visited = new Set()
  const result = []
  initialComps.forEach(comp => walkComp(comp))
  return result

  function walkComp(comp) {
    if (!comp || visited.has(comp)) return
    visited.add(comp)
    result.push(comp)
    if (typeof comp.impl == 'object') walkImpl(comp.impl)
  }
  function walkImpl(node) {
    if (!node || typeof node != 'object' || visited.has(node)) return
    visited.add(node)
    if (typeof node.$ == 'string') {
      const m = node.$.match(/^([^<]+)<([^>]+)>(.+)$/)
      if (m) walkComp(tgpModel.dsls[m[2]]?.[m[1]]?.[m[3]])
    }
    Object.values(node).forEach(v => walkImpl(v))
  }
}

function calcMinimalImports(allFiles, importGraph) {
  const imported = new Set()
  allFiles.forEach(f => collectImported(f, importGraph, imported, new Set([f])))
  return allFiles.filter(f => !imported.has(f))
}

function collectImported(file, importGraph, imported, visited) {
  for (const dep of importGraph[file] || []) {
    if (visited.has(dep)) continue
    visited.add(dep)
    imported.add(dep)
    collectImported(dep, importGraph, imported, visited)
  }
}
