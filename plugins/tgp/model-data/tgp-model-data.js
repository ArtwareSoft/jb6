import { proxy, resolveProfile } from '../../core/jb-macro.js'
import { TgpComp } from '../../core/jb-core.js'
import { } from '../../core/tgp-meta.js'
import { Data, jb, utils } from '../../common/common-utils.js'
import { offsetToLineCol } from '../text-editor/tgp-text-editor.js'
import { parse } from '/libs/acorn.mjs'

export async function calcTgpModelData({ filePath }) {
  if (!filePath) return {}

  const codeMap = new Map()   // url → source text
  const visited = new Set()   // urls seen

  // 1) Crawl + collect all modules via import/dynamic import
  await (async function crawl(url) {
    if (visited.has(url)) return
    visited.add(url)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`)
    const src = await res.text()
    codeMap.set(url, src)

    const ast = parse(src, { ecmaVersion: 'latest', sourceType: 'module' })

    const imports = [
	  ...ast.body.filter(n => n.type === 'ImportDeclaration').map(n => n.source.value)
      	.filter(spec => spec.startsWith('.') || spec.startsWith('/')).map(rel => resolvePath(url, rel)),
	  ...ast.body.filter(n => n.type === 'ExpressionStatement').map(n => n.expression)
      	.filter(ex => ex.type === 'CallExpression' && ex.callee.type === 'Import')
      	.map(ex => ex.arguments[0]?.value).filter(Boolean).map(rel => resolvePath(url, rel))
	]

	await Promise.all(imports.map(url=>crawl(url)))
  })(filePath)

  // 2) Phase 1: find all `export const X = TgpType(...)`
  const tgpTypes = {} 
  Array.from(codeMap.entries()).forEach(([url, src]) => {
    const ast = parse(src, { ecmaVersion: 'latest', sourceType: 'module' })

    ast.body.filter(n => n.type === 'ExportNamedDeclaration' && n.declaration?.type === 'VariableDeclaration')
      .flatMap(n => n.declaration.declarations)
      .filter(d => d.init?.type === 'CallExpression' && d.init.callee.type === 'Identifier' && d.init.callee.name === 'TgpType' 
		&& d.init.arguments[0]?.type === 'Literal')
      .forEach(d => tgpTypes[d.id.name] = d.init.arguments.map(astToObj))
  })

  const comps     = {}
  let typeRules   = []

  function parseCompDec(decl, url, src) {
    const init = decl.init
    if ( init?.type !== 'CallExpression' || init.callee.type !== 'Identifier' || !tgpTypes[init.callee.name]) return

    const [type, optNode] = tgpTypes[init.callee.name]
    const extra    = astToObj(optNode)
    const dsl      = extra?.dsl || ''
    const exportName = decl.id.name

    let shortId, comp
    if (init.arguments[0].type === 'Literal') {
      shortId = init.arguments[0].value
      if (shortId !== exportName)
        utils.logError(`calcTgpModelData id mismatch ${shortId} ${exportName}`,{ url, ...offsetToLineCol(src, init.arguments[0].start) })
      comp = astToObj(init.arguments[1])
    } else {
      shortId = exportName
      comp = astToObj(init.arguments[0])
    }

    comp.$location = { path: url, ...offsetToLineCol(src, init.start) }
    comps[`${type}<${dsl}>${shortId}`] = comp
	utils.asArray(comp.moreTypes).forEach(t=>comps[`${t}${shortId}`] = comp)
  }

  // 3) Phase 2a: non-exported in the entry file only
  {
    const src = codeMap.get(filePath)
    const ast = parse(src, { ecmaVersion: 'latest', sourceType: 'module' })
    ast.body.filter(n => n.type === 'VariableDeclaration').flatMap(n => n.declarations)
		.forEach(decl => parseCompDec(decl, filePath, src))
  }

  // 4) Phase 2b: exported components + typeRules in all files
  Array.from(codeMap.entries()).forEach(([url, src]) => {
    const ast = parse(src, { ecmaVersion: 'latest', sourceType: 'module' })

    ast.body.filter(n => n.type === 'ExportNamedDeclaration' && n.declaration?.type === 'VariableDeclaration')
      .flatMap(n => n.declaration.declarations)
      .forEach(decl => {
        if (decl.id.name === 'typeRules') {
          typeRules.push(...astToObj(decl.init))
        } else {
          parseCompDec(decl, url, src)
        }
      })
  })

  const compDefParams = jb.comps['tgpComp<>component'].params
  Object.entries(tgpTypes).forEach(([compDefName,typeDef]) => {
	comps[`tgpType<>${compDefName}`] = new TgpComp(resolveProfile(proxy('tgpType')(...typeDef), {expectedType: 'tgpType<>'}))
	comps[`tgpCompDef<>${compDefName}`] = new TgpComp({ 
		...resolveProfile(proxy('tgpCompDef')(...typeDef), {expectedType: 'tgpCompDef<>'}),
		params: compDefParams
	})
  })

  return { tgpTypes, comps, typeRules }
}


export const astNode = Symbol.for('astNode')

export function astToTgpObj(node) {
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
		  obj[key] = astToTgpObj(prop.value)
		}
		return attachNode(obj)
	  }
	  case 'ArrayExpression': return attachNode(node.elements.map(el => astToTgpObj(el)))
	  case 'UnaryExpression': return attachNode(node.operator === '-' ? -astToTgpObj(node.argument) : astToTgpObj(node.argument))
	  case 'ExpressionStatement': return astToTgpObj(node.expression)
	  case 'CallExpression': return attachNode(proxy(node.callee.name)(...node.arguments.map(astToTgpObj)))

	  default:
		return undefined
	}

	function attachNode(res) {
		res[astNode] = node
		return res
	}
}
// const x = astToTgpObj(parse(`dataTest(property('name', obj(prop('name', 'homer')), { useRef: true }), equals('homer'))`).body[0])
// console.log(x)

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
