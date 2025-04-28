import { asJbComp, resolveProfileArgs, resolveProfileTop, splitSystemArgs } from '../../core/jb-macro.js'
import { TgpType} from '../../core/tgp.js'
import { Data, jb, utils } from '../../common/common-utils.js'
import { offsetToLineCol } from '../text-editor/tgp-text-editor.js'
import { parse } from '/libs/acorn.mjs'

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
	]

	await Promise.all(imports.map(url=>crawl(url)))
  })(filePath)

  const tgpTypes = {} 
  const comps  = {}

  // phase 0 - meta urls
  {
    const src = await fetch('/plugins/core/tgp.js').then(x=>x.text())
    const ast = parse(src, { ecmaVersion: 'latest', sourceType: 'module' })
    ast.body.filter(n => n.type === 'ExportNamedDeclaration' && n.declaration?.type === 'VariableDeclaration')
      .flatMap(n => n.declaration.declarations)
      .filter(decl=> decl.init?.callee?.name == 'Component' || decl.init?.callee?.name == 'CompDef')
      .forEach(decl => {
        const comp = astToObj(decl.init.arguments[0])
        comps[comp.id] = comp
      })
  }

  // 2) Phase 1: find all `export const X = TgpType(...)`
  Object.entries(codeMap).forEach(([url, src]) => {
    const ast = parse(src, { ecmaVersion: 'latest', sourceType: 'module' })

    ast.body.filter(n => n.type === 'ExportNamedDeclaration' && n.declaration?.type === 'VariableDeclaration')
      .flatMap(n => n.declaration.declarations)
      .filter(d => d.init?.type === 'CallExpression' && d.init.callee.type === 'Identifier' && d.init.callee.name === 'TgpType' 
    		  && d.init.arguments[0]?.type === 'Literal')
      .forEach(d => tgpTypes[d.id.name] = TgpType(...d.init.arguments.map(astToObj)))
  })

  let typeRules   = []
  //const typeFactories = Object.fromEntries(Object.entries(tgpTypes).map(([compDefName,typeDef]) => [compDefName, TgpType(...typeDef)]))
  //debugger
  // Object.entries(tgpTypes).forEach(([compDefName,typeDef]) => {
  //   comps[`tgpType<>${compDefName}`] = new jbComp({
  //     ...resolveProfileArgs(proxy('tgpType')(...typeDef), {expectedType: 'tgpType<>', tgpModel: {comps}}),
  //     params: comps['tgpType<>tgpType'].params
  //   })
  //   comps[`tgpCompDef<>${compDefName}`] = new jbComp({ 
  //     ...resolveProfileArgs(proxy('tgpCompDef')(...typeDef), {expectedType: 'tgpCompDef<>', tgpModel: {comps}}),
  //     params: comps['tgpCompDef<>tgpCompDef'].params
  //   })
  // })
  //comps[`tgpCompDef<>Componenet`] = comps[`tgpCompDef<>tgpCompDef`]

  // 3) Phase 2a: non-exported in the entry file only
  {
    const src = codeMap[filePath]
    const ast = parse(src, { ecmaVersion: 'latest', sourceType: 'module' })
    ast.body.filter(n => n.type === 'VariableDeclaration').flatMap(n => n.declarations)
		.forEach(decl => parseCompDec(decl, filePath, src))
  }

  // 4) Phase 2b: exported components + typeRules in all files
  Object.entries(codeMap).filter(e=>!e[0].match(/tgp-meta.js$/)).forEach(([url, src]) => {
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

  return { comps, typeRules, files: Object.keys(visited) }

  function parseCompDec(decl, url, src) {
    const init = decl.init
    if ( init?.type !== 'CallExpression' || init.callee.type !== 'Identifier' || !tgpTypes[init.callee.name]) return

	  const tgpType = init.callee.name
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

    const $location = { path: url, ...offsetToLineCol(src, init.start) }
    const jbComp = tgpTypes[tgpType](shortId,{$location, ...comp })[asJbComp]
    comps[jbComp.id] = jbComp

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
      const args = node.arguments.map(x=> astToTgpObj(x))
      return attachNode(proxy(node.callee.name)(...args))
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

export function proxy(id) {
  return new Proxy(() => 0, {
      get: (o, p) => {  
        return p === isMacro? true : getInnerMacro(id, p)
      },
      apply: function (target, thisArg, allArgs) {
        return calcArgs(id, allArgs)
      }
  })
}

function calcArgs(id, allArgs) {
  const actualId = id[0] == '_' ? id.slice(1) : id
  const { args, system } = splitSystemArgs(allArgs)
  return { $: actualId, $unresolvedArgs: args, ...system, ...(id[0] == '_' ? {$disabled:true} : {} ) }
}