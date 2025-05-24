import { parse } from '../lib/acorn.mjs'
import { dsls, coreUtils } from '@jb6/core'
const { jb, astNode, asJbComp, logError } = coreUtils
const { 
  tgp: { TgpType, TgpTypeModifier },
  common: { Data },
} = dsls

Object.assign(coreUtils, {astToTgpObj, calcTgpModelData})

// calculating tgpModel data from the files system, by parsing the import files starting from the entry point of file path.
// it is used by language services and wrapped by the class tgpModelForLangService

async function importMap() {
  if (globalThis.window) {
    return fetch('/import-map.json').then(r=>r.json())
  } else { // node
    const { calcImportMap } = await import('@jb6/server-utils')
    return calcImportMap()
  }
}

function resolveWithImportMap(specifier, { imports, dirEntriesToServe }) {
  let winner = ''               // longest matching key
  for (const key in imports) {
    if (
      (specifier === key || specifier.startsWith(key)) &&
      key.length > winner.length
    ) {
      winner = key
    }
  }
  if (!winner) return specifier   // no mapping → leave untouched

  const target = imports[winner]
  const rest   = specifier.slice(winner.length) // part after the prefix
  const urlToBeServed = target.endsWith('/') ? target + rest : target
  const dirEntry = (dirEntriesToServe || []).find(({dir}) => urlToBeServed.startsWith(`/packages/${dir}`))
  if (dirEntry) {
    const restPath = urlToBeServed.slice(`/packages/${dirEntry.dir}`.length)
    return pathJoin(dirEntry.pkgDir, restPath)
  }
  return urlToBeServed

  function pathJoin(a, b) {
    return `${a.replace(/\/+$/, '')}/${b.replace(/^\/+/, '')}`;
  }
}

async function doFetch(url) {
  if (globalThis.window) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`)
    return await res.text()
  }
  const { readFile } = await import('fs/promises')
  return await readFile(url, 'utf8')
}

export async function calcTgpModelData({ filePath }) {
  if (!filePath) return {}
  const _importMap = await importMap()
  const codeMap = {}
  const visited = {}  // urls seen

  // 1) Crawl + collect all modules via import/dynamic import
  await (async function crawl(url) {
    if (visited[url]) return
    visited[url] = true
    try {
      const rUrl = resolveWithImportMap(url, _importMap)
      const src = await doFetch(rUrl)
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
      console.error(`Error crawling ${url}:`, e)
    }
  })(filePath)
  
  const tgpModel = {dsls: {}, ns: {}, typeRules: [], files: Object.keys(visited)}
  const {dsls, typeRules} = tgpModel

  // 2) Phase 1: find all `... = TgpType(...)`
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

function astToTgpObj(node) {
	if (!node) return undefined
	switch (node.type) {
	  case 'Literal': return node.value
	  case 'ObjectExpression': return attachNode(
			Object.fromEntries(node.properties.map(p=>[p.key.type === 'Identifier' ? p.key.name : p.key.value, astToTgpObj(p.value)])))
	  case 'ArrayExpression': return attachNode(node.elements.map(el => astToTgpObj(el)))
	  case 'UnaryExpression': return attachNode(node.operator === '-' ? -astToTgpObj(node.argument) : astToTgpObj(node.argument))
	  case 'ExpressionStatement': return attachNode(astToTgpObj(node.expression))
	  case 'CallExpression': {
      const $unresolvedArgs = node.arguments.map(x=> astToTgpObj(x))
      return attachNode({$: node.callee.name, $unresolvedArgs})
    }

	  default: return undefined
	}

	function attachNode(res) {
		res[astNode] = node
		return res
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

