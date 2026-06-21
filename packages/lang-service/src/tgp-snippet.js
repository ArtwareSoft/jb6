import { coreUtils, dsls } from '@jb6/core'
import { langServiceUtils } from './lang-service-parsing-utils.js'
import '@jb6/core/misc/import-map-services.js'
import './tgp-model-data.js' // provides coreUtils.calcImportsForProfile
const { calcProfileActionMap } = langServiceUtils
import { parse } from '../lib/acorn-loose.mjs'

const { runCliInContext, toCapitalType, calcRepoRoot } = coreUtils
Object.assign(coreUtils, { runSnippetCli, macroToJson })

const { test: { Logger, logger: { domainLogger } } } = dsls
Logger('snippetLogger', { impl: domainLogger('snippet') })

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
  const loggerNames = (args.logger || '').split(',').map(s => s.trim()).filter(Boolean)
  // logger is the single source of truth - it implies bindLoggers so child-process logs are
  // wrapped to stderr (calcJsonProfileScript) and routed back to the parent (makeChildOutputRouter).
  const bindLoggers = args.bindLoggers || loggerNames.join(',')
  const ctx = args.ctx || (loggerNames.length ? coreUtils.ensureLoggers(loggerNames) : undefined)
  const toJson = p => p == null ? p : typeof p === 'string' ? p : JSON.stringify(coreUtils.tgpProfileToJson(p))
  const res = await calcJsonProfileScript({...args, ctx, bindLoggers, profileText: toJson(args.profile ?? args.profileText), ctxEnricher: toJson(args.ctxEnricher), repoRoot})
  // harvest AFTER execution - the child wraps loggers to stderr and runCliInContext's router fills ctx.vars[n].
  const harvest = () => ctx ? coreUtils.harvestLogs(ctx, loggerNames) : {}
  const { ecmScript, projectDir, importMapsInCli, topLevelImports, error } = res
  if (error) return { ...res, ...harvest() }
  try {
    const result = await runCliInContext(
      `${ecmScript}\n await coreUtils.writeServiceResult(await calc())`,
      {projectDir, importMapsInCli, ctx, bindLoggers, stream: 'both'}
    )
    return { ...result.result, topLevelImports, ...harvest() }
  } catch (error) {
    return { error, ecmScript, projectDir, importMapsInCli, ...harvest() }
  }
}

async function calcJsonProfileScript({profileText, repoRoot, fetchByEnvHttpServer, bindLoggers, ctxEnricher, ctx}) {
  const imp = await coreUtils.calcImportsForProfile(profileText + (ctxEnricher || ''), {repoRoot, fetchByEnvHttpServer, ctx})
  if (imp.error) return imp
  const { importsStr, projectDir, importMapsInCli } = imp
  const enrichStmt = ctxEnricher ? `.run(${ctxEnricher})` : ''
  // ensureLoggers is the single child-side logger init: instantiate the requested loggers and (wrapToStderr)
  // tee them to stderr so the parent router (makeChildOutputRouter) harvests them back. no-op when bindLoggers empty.
  const loggerSetup = `
    const loggerCtx = coreUtils.ensureLoggers(${JSON.stringify(bindLoggers || '')}, {wrapToStderr: ${!!bindLoggers}})${enrichStmt}
    const result = await loggerCtx.run(${profileText})`
  const ecmScript = `
  // dir: ${projectDir}
import { coreUtils } from '@jb6/core'
export async function calc() {
  ${importsStr}
  try {${loggerSetup}
    return {result: coreUtils.stripData(result)}
  } catch (e) {
    return {error: e.stack || String(e)}
  }
}
`
  return { ecmScript, projectDir, importMapsInCli, topLevelImports: imp.topLevelImports }
}
