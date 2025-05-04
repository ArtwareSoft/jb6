import { asJbComp, resolveProfileArgs, resolveProfileTop } from '../../core/jb-args.js'
import { TgpType} from '../../core/tgp.js'
import { Data, jb, utils } from '../../common/common-utils.js'
import { offsetToLineCol } from '../text-editor/tgp-text-editor.js'
import { parse } from '/libs/acorn.mjs'

// calculating tgpModel data from the files system, by parsing the import files starting from the entry point of file path.
// it is used by language services and wrapped by the class tgpModelForLangService

export async function calcTgpModelData({ filePath }) {
  if (!filePath) return {}

  const codeMap = {}
  const visited = {}  // urls seen

  // 1) Crawl + collect all modules via import/dynamic import
  await (async function crawl(url) {
    if (visited[url]) return
    visited[url] = true
    const res = await fetch(url)
    if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`)
    const src = await res.text()
    codeMap[url] = src

    const ast = parse(src, { ecmaVersion: 'latest', sourceType: 'module' })

    const imports = [
	  ...ast.body.filter(n => n.type === 'ImportDeclaration').map(n => n.source.value)
      	.filter(spec => spec.startsWith('.') || spec.startsWith('/')).map(rel => resolvePath(url, rel)),
	  ...ast.body.filter(n => n.type === 'ExpressionStatement').map(n => n.expression)
      	.filter(ex => ex.type === 'CallExpression' && ex.callee.type === 'Import')
      	.map(ex => ex.arguments[0]?.value).filter(Boolean).map(rel => resolvePath(url, rel))
	  ].filter(x=>!x.match(/^\/libs\//))

	await Promise.all(imports.map(url=>crawl(url)))
  })(filePath)

  const compDefs = {} 
  const comps  = {}
  const dsls = {}

  // phase 0 - core urls
  {
    const core_files = ['/plugins/core/tgp.js', '/plugins/core/jb-core.js']
    const core_src = await Promise.all(core_files.map(url=> fetch(url).then(url=>url.text())))
    core_files.forEach((_,i) => {
      const src = core_src[i]
      const ast = parse(src, { ecmaVersion: 'latest', sourceType: 'module' })
      ast.body.filter(n => n.type === 'ExportNamedDeclaration' && n.declaration?.type === 'VariableDeclaration')
        .flatMap(n => n.declaration.declarations)
        .filter(decl=> decl.init?.callee?.name == 'CompDef')
        .forEach(decl => {
          const comp = astToObj(decl.init.arguments[0])
          comps[comp.id] = resolveProfileTop(comp)
        })
    })
  }

  // 2) Phase 1: find all `export const X = TgpType(...)`
  Object.entries(codeMap).forEach(([url, src]) => {
    const ast = parse(src, { ecmaVersion: 'latest', sourceType: 'module' })

    ast.body.filter(n => n.type === 'ExportNamedDeclaration' && n.declaration?.type === 'VariableDeclaration')
      .flatMap(n => n.declaration.declarations)
      .filter(d => d.init?.type === 'CallExpression' && d.init.callee.type === 'Identifier' && d.init.callee.name === 'TgpType' 
    		  && d.init.arguments[0]?.type === 'Literal')
      .forEach(d => {
        const id = d.id.name
        const comp = compDefs[id] = TgpType(...d.init.arguments.map(astToObj))
        const { type, dsl = '' } = comp
        dsls[dsl] = dsls[dsl] || {}
        dsls[dsl][type] = {}
        comps[`comp<tgp>${id}`] = resolveProfileTop({ $: `comp<tgp>tgpType`, id, type, dsl, params: comps['comp<tgp>tgpType'].instanceParams })
      })
  })

  let typeRules   = []

  // 3) Phase 2a: non-exported in the entry file only
  {
    const src = codeMap[filePath]
    const ast = parse(src, { ecmaVersion: 'latest', sourceType: 'module' })
    ast.body.filter(n => n.type === 'VariableDeclaration').flatMap(n => n.declarations)
		  .forEach(decl => parseCompDec({exportName: decl.id.name, decl: decl.init, url: filePath, src}))
  }

  // 4) Phase 2b: exported components + direct compDef + typeRules in all files
  Object.entries(codeMap).filter(e=>!e[0].match(/tgp-meta.js$/)).forEach(([url, src]) => {
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

  return { dsls, comps, typeRules, files: Object.keys(visited) }

  function parseCompDec({exportName, decl, url, src}) {
    if ( decl.type !== 'CallExpression' || decl.callee.type !== 'Identifier' || !compDefs[decl.callee.name]) return
	  const tgpType = decl.callee.name

    let shortId, comp
    if (decl.arguments[0].type === 'Literal') {
      shortId = decl.arguments[0].value
      if (exportName && shortId !== exportName)
        utils.logError(`calcTgpModelData id mismatch ${shortId} ${exportName}`,{ url, ...offsetToLineCol(src, decl) })
      comp = astToObj(decl.arguments[1])
    } else {
      shortId = exportName
      comp = astToObj(decl.arguments[0])
    }
    if (!shortId)
      utils.logError(`calcTgpModelData no id mismatch`,{ url, ...offsetToLineCol(src, decl) })

    const $location = { path: url, ...offsetToLineCol(src, decl.start) }
    const {type, typeWithDsl, dsl} = compDefs[tgpType]
    const id = shortId ? `${typeWithDsl}${shortId}` : ''
    dsls[dsl][type][shortId] = comps[id] = resolveProfileTop({...comp, id, dsl, type, $location}, {id})
    
    // const resolvedComp = resolveProfileTop({location, type, $dsl: dsl, ...comp })
    // comps[resolvedComp.id] = resolvedComp
    // utils.asArray(comp.moreTypes).forEach(t=>comps[`${t}${shortId}`] = resolvedComp)
  }
}


export const astNode = Symbol.for('astNode')

export function astToTgpObj(node) {
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
	if (r[0] === '/') return r
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
  

Data('tgpModelData.byFilePath', {
  params: [
	{id: 'filePath', as: 'string'}
  ],
  impl: ({},{filePath}) => calcTgpModelData({filePath})
})
