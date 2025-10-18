import { parse } from '../lib/acorn-loose.mjs'
import { dsls, coreUtils } from '@jb6/core'
import '@jb6/core/misc/import-map-services.js'

const { jb, astNode, asJbComp, logError, resolveWithImportMap, fetchByEnv, unique, logVsCode, calcImportData, calcRepoRoot } = coreUtils
const { 
  tgp: { TgpType, TgpTypeModifier },
  common: { Data },
} = dsls

Object.assign(coreUtils, {astToTgpObj, calcTgpModelData})

// calculating tgpModel data from the files system, by parsing the import files starting from the entry point of file path.
// it is used by language services and wrapped by the class tgpModelForLangService

export async function calcTgpModelData(dependencies) {
  const { fetchByEnvHttpServer } = dependencies
  if (dependencies.forDsls == 'test' && !dependencies.entryPointsPaths)
    dependencies.forRepo = await calcRepoRoot()
  const {importMap, staticMappings, entryFiles, testFiles, projectDir, repoRoot, llmGuideFiles } = await calcImportData(dependencies)
  const rootFilePaths = unique([...entryFiles, ...testFiles, ...llmGuideFiles])
  // crawl
  const codeMap = {} , visited = {}
  await rootFilePaths.reduce((acc, filePath) => acc.then(() => crawl(filePath)), Promise.resolve())

  const tgpModel = {dsls: {}, ns: {}, nsRepo: {}, files: Object.keys(codeMap), importMap, entryFiles, testFiles, projectDir, staticMappings}
  logVsCode('calcTgpModelData before', dependencies, tgpModel)

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
    const error = `calcTgpModelData: error for dependencies ${JSON.stringify({dependencies, importMap, staticMappings, entryFiles, testFiles, projectDir, repoRoot})}`
    logError(error)
    return { tgpModel, error }
  }
  // compDefs may need revisiting, it is global rather than file based
  const compDefs = Object.fromEntries(Object.values(dsls).flatMap(dsl=>Object.values(dsl)).map(x=>[x.capitalLetterId,x]).filter(x=>x[0]))
  Object.assign(dsls.tgp.comp, compDefs)
  dsls.tgp.var.Var = jb.dsls.tgp.var.Var[asJbComp]
  dsls.tgp.comp.tgpComp = jb.dsls.tgp.tgpComp[asJbComp]

  // 3) Phase 2a: non-exported in the entry files only
  rootFilePaths.forEach(filePath=> {
    const src = codeMap[filePath]
    const ast = parse(src, { ecmaVersion: 'latest', sourceType: 'module' })
    ast.body.filter(n => n.type === 'VariableDeclaration').flatMap(n => n.declarations)
        .forEach(decl => parseCompDec({exportName: decl.id.name, decl: decl.init, url: filePath, src}))
  })

  // 4) Phase 2b: exported components + direct compDef
  Object.entries(codeMap).forEach(([url, src]) => {
    const ast = parse(src, { ecmaVersion: 'latest', sourceType: 'module' })

    const exportDefs = ast.body.filter(n => n.type === 'ExportNamedDeclaration').flatMap(n => n.declaration?.declarations)
    const constDefs =  ast.body.filter(n => n.type === 'VariableDeclaration').flatMap(n => n.declarations)
    const allDefs = [...exportDefs, ...constDefs].filter(decl=>decl?.init)

    allDefs.forEach(decl => parseCompDec({exportName: decl.id.name , decl: decl.init, url, src}))
    const directDefs = ast.body.map(n => n?.expression).filter(Boolean)
    directDefs.forEach(decl => parseCompDec({decl, url, src}))
  })

  logVsCode('calcTgpModelData result', dependencies, tgpModel)

  return tgpModel

  function parseCompDec({exportName, decl, url, src}) {
    if (!decl) return
    if ( decl.type !== 'CallExpression' || decl.callee.type !== 'Identifier' || !compDefs[decl.callee.name]) return
	  const tgpType = decl.callee.name

    let shortId, comp
    if (decl.arguments[0].type === 'Literal') {
      shortId = decl.arguments[0].value
      if (exportName && shortId !== exportName)
        logError(`calcTgpModelData id mismatch ${shortId} ${exportName}`,{ url, ...offsetToLineCol(src, decl) })
      comp = astToObj(decl.arguments[1])
    } else {
      shortId = exportName
      comp = astToObj(decl.arguments[0])
    }
    if (!shortId)
      logError(`calcTgpModelData no id mismatch`,{ url, ...offsetToLineCol(src, decl) })

    const $location = { path: url, ...offsetToLineCol(src, decl.start), to: offsetToLineCol(src, decl.end) }
    const _comp = compDefs[tgpType](shortId, {...comp, $location})
    const jbComp = _comp[asJbComp] // remove the proxy
    delete jbComp.$
    dsls[jbComp.dsl][jbComp.type][shortId] = jbComp 
  }

  async function crawl(url) {
    if (visited[url]) return
    visited[url] = true
    let rUrl = ''
    try {
      rUrl = resolveWithImportMap(url, importMap, staticMappings) || url
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
      logVsCode('crawl', url, imports)

      await Promise.all(imports.map(url => crawl(url)))
    } catch (e) {
      console.error(`Error crawling ${url}:`, e)
    }
  }
}

function astToTgpObj(node, code) {
	if (!node) return undefined
  return toObj(node)

  function toObj(node) {
    switch (node.type) {
      case 'TemplateLiteral': return node.quasis.map(q=>q.value.raw).join('')
      case 'Literal': return node.value
      case 'ObjectExpression': return attachNode(
        Object.fromEntries(node.properties.map(p=>[p.key.type === 'Identifier' ? p.key.name : p.key.value, toObj(p.value)])))
      case 'ArrayExpression': return attachNode(node.elements.map(el => toObj(el)))
      case 'UnaryExpression': return attachNode(node.operator === '-' ? -toObj(node.argument) : toObj(node.argument))
      case 'ExpressionStatement': return attachNode(toObj(node.expression))
      case 'CallExpression': {
        const $unresolvedArgs = node.arguments.map(x=> toObj(x))
        const callee = node.callee
        return attachNode({$: callee.name || [callee.object?.name,callee.property?.name].join('.'), $unresolvedArgs})
      }
      case 'ArrowFunctionExpression': {
        if (!code) return undefined
        let func 
        try {
          func = eval(code.slice(node.start, node.end))
        } catch (e) {
          logError('astToTgpObj ArrowFunctionExpression eval exception', {message: e.message, e, code, node})
          func = undefined
        }
        return attachNode(func)
      }

      default: return undefined
    }

    function attachNode(res) {
      if (res)
        res[astNode] = node
      return res
    }
  }
}

function astToObj(node) {
  if (!node) return undefined
  switch (node.type) {
    case 'Literal':
      return node.value
    case 'ObjectExpression': {
      const obj = {}
      for (const prop of node.properties) {
        const key = prop.key.type === 'Identifier' 
          ? prop.key.name 
          : prop.key.value
        obj[key] = astToObj(prop.value)
      }
      return obj
    }
    case 'ArrayExpression':
      return node.elements.map(el => astToObj(el))
    case 'UnaryExpression':
      return node.operator === '-' 
        ? -astToObj(node.argument) 
        : astToObj(node.argument)
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
