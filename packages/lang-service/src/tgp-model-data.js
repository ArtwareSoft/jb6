import { parse } from '../lib/acorn-loose.mjs'
import { dsls, coreUtils } from '@jb6/core'
import '@jb6/core/misc/import-map-services.js'
import { langServiceUtils } from './lang-service-parsing-utils.js'

const { jb, astToTgpObj, asJbComp, logError, resolveWithImportMap, fetchByEnv, unique, logVsCode, calcImportData, calcRepoRoot, toCapitalType, absPathToImportUrl } = coreUtils
const { calcProfileActionMap, lineColToOffset } = langServiceUtils
const { 
  tgp: { TgpType, TgpTypeModifier },
  common: { Data },
} = dsls

Object.assign(coreUtils, { calcTgpModelData, calcExpectedDslsSection})

// calculating tgpModel data from the files system, by parsing the import files starting from the entry point of file path.
// it is used by language services and wrapped by the class tgpModelForLangService

export async function calcTgpModelData(resources) {
  const { fetchByEnvHttpServer } = resources
  if (resources.forDsls == 'test' && !resources.entryPointPaths)
    resources.forRepo = await calcRepoRoot()
  const {importMap, staticMappings, entryFiles, testFiles, projectDir, repoRoot, llmGuideFiles, jb6_llmGuideFiles, jb6_testFiles } = await calcImportData(resources)
  const allLlmGuideFiles = unique([...llmGuideFiles || [], ...jb6_llmGuideFiles || []])
  const allTestFiles = unique([...testFiles || [], ...jb6_testFiles || []])
  const rootFilePaths = unique([...entryFiles, ...allTestFiles, ...allLlmGuideFiles])
  // crawl
  const codeMap = {} , visited = {}, importGraph = {}
  await rootFilePaths.reduce((acc, filePath) => acc.then(() => crawl(filePath)), Promise.resolve())

  const tgpModel = {dsls: {}, ns: {}, nsRepo: {}, compDefsByFilePaths: {}, files: Object.keys(codeMap), importGraph, importMap, entryFiles, testFiles, projectDir, staticMappings}
  globalThis.detailedjbVSCodeLog && logVsCode('calcTgpModelData before', resources, tgpModel)

  const {dsls} = tgpModel

  // Phase 1: find all `... = TgpType(...)`
  Object.entries(codeMap).forEach(([url, src]) => {
    const ast = parse(src, { ecmaVersion: 'latest', sourceType: 'module' })

    const directDefs = ast.body.flatMap(n => n?.expression)
    const exportDefs = ast.body.filter(n => n.type === 'ExportNamedDeclaration').flatMap(n => n.declaration?.declarations).map(d=>d?.init)
    const constDefs =  ast.body.filter(n => n.type === 'VariableDeclaration').flatMap(n => n.declarations).map(d=>d?.init)
    const allDefs = [...directDefs, ...exportDefs, ...constDefs]

    allDefs.filter(d => d?.callee?.name === 'TgpType').forEach(decl=> {
      const args = decl.arguments.map(ast =>astToObj(ast))
      args.push(...Array(3 - args.length).fill(null), tgpModel)
      TgpType(...args)
    })
    allDefs.filter(d => d?.callee?.name === 'TgpTypeModifier').forEach(decl=> {
      const args = decl.arguments.map(ast =>astToObj(ast))
      args.push(...Array(2 - args.length).fill(null), tgpModel)
      TgpTypeModifier(...args)
    })
  })

  if (!dsls.tgp) {
    const error = `calcTgpModelData: error for resources ${JSON.stringify({resources, importMap, staticMappings, entryFiles, testFiles, projectDir, repoRoot})}`
    logError(error)
    return { tgpModel, error }
  }
  dsls.tgp.var.Var = jb.dsls.tgp.var.Var[asJbComp]
  dsls.tgp.comp.tgpComp = jb.dsls.tgp.tgpComp[asJbComp]

  // 3) Phase 2a: non-exported in the entry files only
  rootFilePaths.forEach(filePath=> {
    const src = codeMap[filePath]
    const ast = parse(src, { ecmaVersion: 'latest', sourceType: 'module' })
    const compDefs = extractCompDefs({dsls, ast, tgpModel, filePath})
    ast.body.filter(n => n.type === 'VariableDeclaration').flatMap(n => n.declarations)
        .forEach(decl => parseCompDec({exportName: decl.id.name, decl: decl.init, filePath, src, compDefs}))
  })

  // 4) Phase 2b: exported components + direct compDef
  Object.entries(codeMap).forEach(([filePath, src]) => {
    const ast = parse(src, { ecmaVersion: 'latest', sourceType: 'module' })
    const compDefs = extractCompDefs({dsls, ast, tgpModel, filePath})

    const exportDefs = ast.body.filter(n => n.type === 'ExportNamedDeclaration').flatMap(n => n.declaration?.declarations)
    const constDefs =  ast.body.filter(n => n.type === 'VariableDeclaration').flatMap(n => n.declarations)
    const allDefs = [...exportDefs, ...constDefs].filter(decl=>decl?.init)

    allDefs.forEach(decl => parseCompDec({exportName: decl.id.name , decl: decl.init, filePath, src, compDefs}))
    const directDefs = ast.body.map(n => n?.expression).filter(Boolean)
    directDefs.forEach(decl => parseCompDec({decl, filePath, src, compDefs}))
  })

  globalThis.detailedjbVSCodeLog && logVsCode('calcTgpModelData result', resources, tgpModel)

  return tgpModel

  function parseCompDec({exportName, decl, filePath, src, compDefs, vars = {}}) {
    if (!decl) return
    if (decl.type !== 'CallExpression' || decl.callee.type !== 'Identifier') return
    let compDefId = decl.callee.name
    if (compDefId === 'DefComponents' && decl.arguments[0]?.type === 'Literal' && decl.arguments[1]?.type === 'ArrowFunctionExpression') {
      const items = decl.arguments[0].value.split(',')
      const paramName = decl.arguments[1].params[0]?.name
      const body = decl.arguments[1].body
      const innerCall = body.type === 'CallExpression' ? body : body.body?.[0]?.expression
      if (innerCall && paramName)
        items.forEach(item => parseCompDec({decl: innerCall, filePath, src, compDefs, vars: {[paramName]: item}}))
      return
    }
    if (decl.callee.name == 'Component') {
      const dslType = astToTgpObj(decl).$unresolvedArgs[1]?.type || 'data<common>'
      const [_type, _dsl] = coreUtils.splitDslType(dslType)
      compDefId = coreUtils.toCapitalType(_type)
      compDefs[compDefId] = dsls[_dsl][compDefId]
    }
    if (!compDefs[compDefId]) return

    let shortId, comp
    const firstArgVal = astToObj(decl.arguments[0], vars)
    if (typeof firstArgVal === 'string' && decl.arguments.length > 1) {
      shortId = firstArgVal
      if (exportName && shortId !== exportName)
        logError(`calcTgpModelData id mismatch ${shortId} ${exportName}`,{ filePath, ...offsetToLineCol(src, decl) })
      comp = astToObj(decl.arguments[1], vars)
    } else {
      shortId = exportName
      comp = astToObj(decl.arguments[0], vars)
    }
    if (!shortId)
      logError(`calcTgpModelData no id mismatch`,{ filePath, ...offsetToLineCol(src, decl) })

    const $location = { path: filePath, ...offsetToLineCol(src, decl.start), to: offsetToLineCol(src, decl.end) }
    const _comp = compDefs[compDefId](shortId, {...comp, $location})
    const jbComp = _comp[asJbComp] // remove the proxy
    delete jbComp.$
    dsls[jbComp.dsl][jbComp.type][shortId] = jbComp 
  }

  async function crawl(url) {
    if (visited[url]) return
    visited[url] = true
    try {
      const rUrl = resolveWithImportMap(url, importMap, staticMappings) || url
      const src = await fetchByEnv(rUrl, staticMappings, fetchByEnvHttpServer)
      codeMap[url] = src

      const ast = parse(src, { ecmaVersion: 'latest', sourceType: 'module' })

      const imports = [
      ...ast.body.filter(n => n.type === 'ImportDeclaration').map(n => n.source.value)
          .filter(spec => ['/','.','@','#'].some(p=>spec.startsWith(p))).map(rel => resolvePath(rUrl, rel)),
      ...ast.body.filter(n => n.type === 'ExpressionStatement').map(n => n.expression)
          .filter(ex => ex.type === 'CallExpression' && ex.callee.type === 'Import')
          .map(ex => ex.arguments[0]?.value).filter(Boolean).map(rel => resolvePath(rUrl, rel))
      ].filter(x=>!x.match(/^\/libs\//))
      importGraph[url] = imports
      globalThis.detailedjbVSCodeLog && logVsCode('crawl', url, imports)

      await Promise.all(imports.map(url => crawl(url)))
    } catch (e) {
      console.error(`Error crawling ${url}:`, e)
    }
  }
}

function astToObj(node, vars = {}) {
  if (!node) return undefined
  switch (node.type) {
    case 'Identifier':
      return vars[node.name]
    case 'Literal':
      return node.value
    case 'TemplateLiteral': {
      const strs = node.quasis.map(q => q.value.cooked)
      const exprs = node.expressions.map(e => astToObj(e, vars))
      return strs.reduce((acc, s, i) => acc + s + (exprs[i] ?? ''), '')
    }
    case 'ObjectExpression': {
      const obj = {}
      for (const prop of node.properties) {
        const key = prop.key.type === 'Identifier' ? prop.key.name : prop.key.value
        obj[key] = astToObj(prop.value, vars)
      }
      return obj
    }
    case 'ArrayExpression':
      return node.elements.map(el => astToObj(el, vars))
    case 'UnaryExpression':
      return node.operator === '-' ? -astToObj(node.argument, vars) : astToObj(node.argument, vars)
    default:
      return undefined
  }
}

function resolvePath(b, r) {
	if (['/','@','#'].some(p=>r.startsWith(p))) return r
	const segs = b.split('/')
	segs.pop()
	const parts = segs.concat(r.split('/'))
	const out = []
	for (const p of parts) {
	  if (p === '..') out.pop()
	  else if (p !== '.' && p !== '') out.push(p)
	}
	return (b[0] === '/' ? '/' : '') + out.join('/')
}

function offsetToLineCol(text, offset) {
  const cut = text.slice(0, offset)
  return {
      line: (cut.match(/\n/g) || []).length || 0,
      col: offset - (cut.indexOf('\n') == -1 ? 0 : (cut.lastIndexOf('\n') + 1))
  }
}

function extractCompDefs({dsls, ast, tgpModel, filePath}) {
  const { compDefsByFilePaths } = tgpModel
  if (compDefsByFilePaths[filePath]) return compDefsByFilePaths[filePath]
  const compDefs = {}

  ast.body.forEach(n => n.type === 'VariableDeclaration' && n.declarations.forEach(d => {
      if (!d.init) return

      // const Aggregator = TgpTypeModifier('Aggregator', { aggregator: true, dsl: 'common', type: 'data'})
      if (d.id.type === 'Identifier' && d.init.type === 'CallExpression' && d.init.callee.name === 'TgpTypeModifier') {
        const { dsl } = astToObj(d.init.arguments[1])
        compDefs[d.id.name] = dsls[dsl]?.[d.id.name]
      }
      // const Control = TgpType('control','ui')
      if (d.id.type === 'Identifier' && d.init.type === 'CallExpression' && d.init.callee.name === 'TgpType') {
        const dsl = d.init.arguments[1]?.value
        if (dsl) compDefs[d.id.name] = dsls[dsl]?.[d.id.name]
      }

      // const { common: { Data }, test: { Test } } = dsls
      if ( d.id.type === 'ObjectPattern' && d.init.type === 'Identifier' && d.init.name === 'dsls') {
        d.id.properties.forEach(p => p.value?.type === 'ObjectPattern' &&
          p.value.properties.forEach(i => {
            const id = i.value?.name || i.key?.name || i.key?.value
            compDefs[id] = dsls[p.key.name || p.key.value]?.[id]
          })
        )
      }
    })
  )

  return compDefsByFilePaths[filePath] = compDefs
}

async function calcExpectedDslsSection(tgpModel, filePath) {
  const src = await fetchByEnv(filePath, tgpModel.staticMappings)
  if (!src) return null

  const allComps = Object.values(tgpModel.dsls).flatMap(types =>
    Object.values(types).filter(x => typeof x == 'object').flatMap(type => Object.values(type))
  ).filter(comp => comp.id)
  const filePathAliases = new Set([filePath])
  const sm = tgpModel.staticMappings || []
  sm.filter(x => x.diskPath != x.urlPath && filePath.indexOf(x.diskPath) == 0)
    .forEach(x => filePathAliases.add(filePath.replace(x.diskPath, x.urlPath)))
  const imports = tgpModel.importMap?.imports
  if (imports) {
    const importUrl = absPathToImportUrl(filePath, imports, sm)
    if (importUrl) filePathAliases.add(importUrl)
  }
  const compsInFile = allComps.filter(comp => filePathAliases.has(comp.$location?.path))
  globalThis.detailedjbVSCodeLog && logVsCode('calcExpectedDslsSection', { filePath, compsInFile: compsInFile.length, filePathAliases: [...filePathAliases] })
  if (compsInFile.length == 0) return null

  // Sort by file position and compile params so comps can reference each other
  compsInFile.sort((a, b) => lineColToOffset(src, a.$location) - lineColToOffset(src, b.$location))

  const _items = []
  const compDefsUsed = new Set()

  // Detect tgp dsl compDefs (Component, Const, TgpType, TgpTypeModifier) used in the file
  const tgpCompDefIds = new Set(['Component', 'Const', 'TgpType', 'TgpTypeModifier'])
  const ast = parse(src, { ecmaVersion: 'latest', sourceType: 'module' })
  ast.body.forEach(n => {
    const callee = n?.expression?.callee?.name || n?.declarations?.[0]?.init?.callee?.name
    if (callee && tgpCompDefIds.has(callee))
      compDefsUsed.add(JSON.stringify({ dsl: 'tgp', id: callee }))
  })

  // Collect compDef IDs that are defined in this file via TgpType/TgpTypeModifier
  const compDefsDefinedInFile = new Set()
  ast.body.forEach(n => n?.type === 'VariableDeclaration' && n.declarations.forEach(d => {
    if (d.id?.type === 'Identifier' && d.init?.type === 'CallExpression'
        && (d.init.callee.name === 'TgpType' || d.init.callee.name === 'TgpTypeModifier')) {
      const dsl = d.init.callee.name === 'TgpType' ? d.init.arguments[1]?.value : astToObj(d.init.arguments[1])?.dsl
      if (dsl) compDefsDefinedInFile.add(JSON.stringify({ dsl, id: d.id.name }))
    }
  }))

  for (const comp of compsInFile) {
    const compDefId = toCapitalType(comp.type)
    const compDefKey = JSON.stringify({ dsl: comp.dsl, id: compDefId })
    if (!compDefsDefinedInFile.has(compDefKey))
      compDefsUsed.add(compDefKey)

    const loc = comp.$location
    const startOffset = lineColToOffset(src, loc)
    const endOffset = lineColToOffset(src, loc.to)
    const compText = src.slice(startOffset, endOffset)

    try {
      const { comp: resolvedComp } = calcProfileActionMap(compText, { tgpModel, filePath })
      if (resolvedComp) calcItems(resolvedComp)
    } catch (e) {}
  }

  function calcItems(node) {
    if (typeof node?.$$ == 'string') {
      const match = node.$$.match(/([^<]+)<([^>]+)>(.+)/)
      if (match) _items.push(match.slice(1)) // [type, dsl, id]
    }
    if (node && typeof node == 'object')
      Object.values(node).filter(x => x).forEach(x => calcItems(x))
  }

  const compIdsInFile = new Set(compsInFile.map(c => `${c.type},${c.dsl},${c.id}`))
  const items = unique(_items.filter(x => !compIdsInFile.has(`${x[0]},${x[1]},${x[2]}`)), x => x.join(','))
  const compDefs = [...compDefsUsed].map(x => JSON.parse(x))
  const allDsls = unique([...items.map(x => x[1]), ...compDefs.map(c => c.dsl)]).sort((a, b) => a === 'tgp' ? -1 : b === 'tgp' ? 1 : a.localeCompare(b))

  const dslsStr = allDsls.map(dsl => {
    const types = unique(items.filter(x => x[1] == dsl).map(x => x[0])).sort().map(type => {
      const comps = unique(items.filter(x => x[1] == dsl && x[0] == type).map(x => x[2]))
        .filter(x => x.indexOf('.') == -1).sort().join(', ')
      const typeStr = type.indexOf('-') == -1 ? type : `'${type}'`
      return comps && `${typeStr}: { ${comps} }`
    }).filter(Boolean).join(',\n    ')

    const compDefsIds = unique(compDefs.filter(c => c.dsl == dsl).map(c => c.id))
    const compDefsStr = compDefsIds.length ? compDefsIds.join(', ') + (types ? ',' : '') : ''
    const dslStr = dsl.indexOf('-') == -1 ? dsl : `'${dsl}'`
    if (!types) return `  ${dslStr}: { ${compDefsStr} }`
    return `  ${dslStr}: { ${compDefsStr}\n    ${types}\n  }`
  }).join(',\n')

  const ns = unique(items.filter(item => item[2].indexOf('.') != -1).map(item => item[2].split('.')[0]))
  const nsStr = ns.length ? `\nconst { ${ns.join(', ')} } = ns` : ''

  return `const {\n${dslsStr}\n} = dsls${nsStr}`
}