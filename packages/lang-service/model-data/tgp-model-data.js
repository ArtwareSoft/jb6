import { parse } from '../lib/acorn-loose.mjs'
import { dsls, coreUtils } from '@jb6/core'
const { jb, astNode, asJbComp, logError, studioAndProjectImportMaps, resolveWithImportMap, fetchByEnv, logByEnv } = coreUtils
const { 
  tgp: { TgpType, TgpTypeModifier },
  common: { Data },
} = dsls

Object.assign(coreUtils, {astToTgpObj, calcTgpModelData})

// calculating tgpModel data from the files system, by parsing the import files starting from the entry point of file path.
// it is used by language services and wrapped by the class tgpModelForLangService

export async function calcTgpModelData({ filePath }) {
  logByEnv('calcTgpModelData', filePath)
  if (!filePath) return {}
  const { projectImportMap } = await studioAndProjectImportMaps(filePath)
  const codeMap = {}
  const visited = {}  // urls seen

  // 1) Crawl + collect all modules via import/dynamic import
  await (async function crawl(url) {
    if (visited[url]) return
    visited[url] = true
    let rUrl = ''
    try {
      rUrl = resolveWithImportMap(url, projectImportMap) || url
      const src = await fetchByEnv(rUrl, projectImportMap.serveEntries)
      codeMap[url] = src

      const ast = parse(src, { ecmaVersion: 'latest', sourceType: 'module' })

      const imports = [
      ...ast.body.filter(n => n.type === 'ImportDeclaration').map(n => n.source.value)
          .filter(spec => ['/','.','@','#'].some(p=>spec.startsWith(p))).map(rel => resolvePath(rUrl, rel)),
      ...ast.body.filter(n => n.type === 'ExpressionStatement').map(n => n.expression)
          .filter(ex => ex.type === 'CallExpression' && ex.callee.type === 'Import')
          .map(ex => ex.arguments[0]?.value).filter(Boolean).map(rel => resolvePath(rUrl, rel))
      ].filter(x=>!x.match(/^\/libs\//))

      await Promise.all(imports.map(url => crawl(url)))
    } catch (e) {
      logByEnv('imports error', rUrl, url, e)
      console.error(`Error crawling ${url}:`, e)
    }
  })(filePath)
  
  const tgpModel = {dsls: {}, ns: {}, typeRules: [], files: Object.keys(visited), projectImportMap}
  const {dsls, typeRules} = tgpModel

//  logByEnv('codeMap', Object.keys(codeMap))
  // 2) Phase 1: find all `... = TgpType(...)`
  logByEnv('codeMap', Object.entries(codeMap).map(([url, src]) => ({url, src: src.slice(0, 100)})))
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
    logError('calcTgpModelData no tgp', { url: filePath })
    return tgpModel
  }
  // compDefs may need revisiting, it is global rather than file based
  const compDefs = Object.fromEntries(Object.values(dsls).flatMap(dsl=>Object.values(dsl)).map(x=>[x.capitalLetterId,x]).filter(x=>x[0]))
  Object.assign(dsls.tgp.comp, compDefs)
  dsls.tgp.var.Var = jb.dsls.tgp.var.Var[asJbComp]
  dsls.tgp.comp.tgpComp = jb.dsls.tgp.tgpComp[asJbComp]

  // 3) Phase 2a: non-exported in the entry file only
  {
    const src = codeMap[filePath]
    const ast = parse(src, { ecmaVersion: 'latest', sourceType: 'module' })
    ast.body.filter(n => n.type === 'VariableDeclaration').flatMap(n => n.declarations)
		  .forEach(decl => parseCompDec({exportName: decl.id.name, decl: decl.init, url: filePath, src}))
  }

  // 4) Phase 2b: exported components + direct compDef + typeRules in all files
  Object.entries(codeMap).forEach(([url, src]) => {
    const ast = parse(src, { ecmaVersion: 'latest', sourceType: 'module' })

    // if (url.match(/ui.js/)) debugger
    const declarations = ast.body.filter(n => n.type === 'ExportNamedDeclaration' && n.declaration?.type === 'VariableDeclaration')
      .flatMap(n => n.declaration.declarations)
    declarations.forEach(decl => parseCompDec({exportName: decl.id.name , decl: decl.init, url, src}))

    // directCompDef
    ast.body.flatMap(n => n.type === 'ExpressionStatement' ? [n.expression] : [])
      .forEach(decl => parseCompDec({decl, url, src}))

    typeRules.push(... declarations.filter(decl=>decl.id.name == 'typeRules').flatMap(decl=>astToObj(decl.init)))
  })

  logByEnv('tgp model data', tgpModel)

  return tgpModel

  function parseCompDec({exportName, decl, url, src}) {
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

    const $location = { path: url, ...offsetToLineCol(src, decl.start) }
    const _comp = compDefs[tgpType](shortId, {...comp, $location})
    const jbComp = _comp[asJbComp] // remove the proxy
    dsls[jbComp.dsl][jbComp.type][shortId] = jbComp 
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
        return attachNode({$: node.callee.name, $unresolvedArgs})
      }
      case 'ArrowFunctionExpression': {
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

