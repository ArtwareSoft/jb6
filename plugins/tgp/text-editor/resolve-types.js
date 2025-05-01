import { jb, jbComp} from '../../core/jb-core.js'
import { OrigArgs, systemParams } from '../../core/jb-macro.js'
import { astNode } from '../model-data/tgp-model-data.js'
import { utils } from '../../common/common-utils.js'

// export function resolveCompTypes(topComp, {tgpModel} = {}) {
//   if (!topComp || topComp.$resolvedInner) 
//       return topComp
//   ;(topComp.params || []).forEach(p=> resolveProfileTypes(p.defaultValue, {expectedType: p.$type, topComp, tgpModel}))
//   ;(topComp.params || []).forEach(p=> resolveProfileTypes(p.templateValue, {expectedType: p.$type, topComp, tgpModel}))
//   resolveProfileTypes(topComp.impl, {expectedType: topComp.$type, tgpModel, topComp, parent: topComp})
//   topComp.$resolvedInner = true
//   return topComp
// }

function calcDslType(fullId) {
    if (typeof fullId != 'string') return
    if (fullId.indexOf('<') == -1)
      logError(`util dslType not fullId ${fullId}`,{})
    return (fullId || '').split('>')[0] + '>'
}

export const primitivesAst = Symbol.for('primitivesAst')

export function resolveProfileTypes(prof, { astFromParent, expectedType, parent, parentProp, tgpModel, topComp, parentType, remoteCode} = {}) {
    if (!prof || !prof.constructor || ['Object','Array'].indexOf(prof.constructor.name) == -1) return prof
    const typeSysType = tgpModel?.comps[`comp<tgp>${parent?.$}`]
    const implType = expectedType == '$implType<>' && `${typeSysType.type}<${typeSysType.dsl||''}>`
    const typeFromParent = expectedType == '$asParent<>' ? (parentType || calcDslType(parent?.$$)) : expectedType
    const typeFromAdapter = parent?.$ == 'typeAdapter' && parent.fromType
    const fromFullId = calcDslType(prof.$$)
    const dslType = implType || typeFromAdapter || typeFromParent || fromFullId
    if (dslType?.indexOf('<') == -1) debugger
    const ast = prof[astNode] || astFromParent

    const comp = prof.$ instanceof jbComp ? prof.$
        : resolveCompTypeWithId(prof.$$ || prof.$, { dslType, parent, parentProp, tgpModel, topComp, parentType, remoteCode })
    if (comp)
      prof.$$ = prof.$ instanceof jbComp ? prof.$ : comp.id
    if (prof.$unresolvedArgs && comp) {
      Object.assign(prof, argsToProfile(prof, comp), {[astNode]: prof[astNode]})
      prof[OrigArgs] = prof.$unresolvedArgs
      delete prof.$unresolvedArgs
    }

    if (Array.isArray(prof)) {
      prof[primitivesAst] = Object.fromEntries(prof.map( (val,i) => utils.isPrimitiveValue(val) && [i,ast.elements[i]]).filter(Boolean))
      prof.forEach((v,i) =>resolveProfileTypes(v, { astFromParent: prof[primitivesAst][i], expectedType: dslType, parent, parentProp, topComp, tgpModel, parentType, remoteCode}))
    } else if (comp && prof.$ != 'asIs') {
      ;[...(comp.params || []), ...systemParams].forEach(p=> 
          resolveProfileTypes(prof[p.id], { astFromParent: prof[primitivesAst][p.id], expectedType: p.$type, parentType: dslType, parent: prof, parentProp: p, topComp, tgpModel, remoteCode}))
    } else if (!comp && prof.$) {
        logError(`resolveProfile - can not resolve ${prof.$} at ${topComp && topComp.$$} expected type ${dslType || 'unknown'}`, 
            {compId: prof.$, prof, expectedType, dslType, topComp, parentType})
    }
    return prof
}

function argsToProfile(prof, comp) {
  const ast = prof[astNode]
  const { args, system, argsAst } = splitSystemArgs(prof.$unresolvedArgs, ast)
  if (args.length == 0) return {...system, [primitivesAst]: {}, [astNode]: ast }

  const lastArg = args[args.length-1]
  const lastArgIsByName = lastArg && typeof lastArg == 'object' && !Array.isArray(lastArg) && !lastArg.$
  const argsByValue = lastArgIsByName ? args.slice(0,-1) : args
  const propsByName = lastArgIsByName ? lastArg : {}
  const onlyByName = lastArgIsByName && args.length == 1
  const params = comp.params || []
  const param0 = params[0] || {}, param1 = params[1] || {}
  const firstParamAsArray = (param0.type||'').indexOf('[]') != -1 && !param0.byName
  const secondParamAsArray = param1.secondParamAsArray
  if (!lastArgIsByName) {
      if (firstParamAsArray)
          return extendWithSystem({[param0.id]: params.length > 1 && args.length == 1 ? args[0] : args })
      if (secondParamAsArray)
          return extendWithSystem({[param0.id]: args[0], [param1.id] : args.slice(1) })

      if (comp.macroByValue || params.length < 3)
          return extendWithSystem(Object.fromEntries(args.filter((_, i) => params[i]).map((arg, i) => [params[i].id, arg])))
  }

  const varArgs = []
  while (argsByValue[0] && argsByValue[0].$ == 'Var')
      varArgs.push(argsByValue.shift())
  const propsByValue = onlyByName ? []
      : firstParamAsArray ? { [param0.id] : argsByValue }
      : secondParamAsArray ? { [param0.id] : argsByValue[0], [param1.id] : argsByValue.slice(1) } 
      : Object.fromEntries(argsByValue.map((v,i) => [params[i].id, v]))
  return extendWithSystem({ ...(varArgs.length ? {vars: varArgs} : {}), ...propsByValue, ...propsByName })

  function extendWithSystem(ret) {
    return {...system, [primitivesAst]: Object.fromEntries(calcPrimitivesByValue()), [astNode]: ast, ...ret}
  }

  function calcPrimitivesByValue() {
    if (!lastArgIsByName) {
        if (firstParamAsArray) 
            return params.length > 1 && args.length == 1 ? [[param0.id, argsAst[0]]]
                : addVirtualArrayAst(param0.id, args.map((v,i) => [`${param0.id}~${i}`, argsAst[i]]))
        if (secondParamAsArray)  return [
            [param0.id, argsAst[0]],
            ...addVirtualArrayAst(param1.id, args.slice(1).map((v,i) => [`${param1.id}~${i}`, argsAst[i+1]]))
            ]
  
        if (comp.macroByValue || params.length < 3)
            return args.filter((_, i) => params[i]).map((arg, i) => [params[i].id, argsAst[i]])
    }
  
    const propsByValue = onlyByName ? []
        : firstParamAsArray ? argsByValue.map((v,i) => [`${param0.id}~${i}`, argsAst[i], v])
        : secondParamAsArray ? [ 
            [param0.id, argsAst[0] ,argsByValue[0]],
            ...argsByValue.slice(1).map((v,i) => [`${param1.id}~${i}`, argsAst[i+1], v])
        ]
        : argsByValue.map((v,i) => [params[i].id, argsAst[i],v])
  
    const paramsByNameAst = argsAst.filter(n=>n.type=='ObjectExpression')[0]
    const propsPrimitivesByName =  Object.entries(propsByName).filter(e=>utils.isPrimitiveValue(e[1]))
        .map(([k,v])=> [k,paramsByNameAst.properties.find(p=>p.key.name == k).value, v])
    return [...propsByValue, ...propsPrimitivesByName].filter(v=>utils.isPrimitiveValue(v[2])).map(x=>x.slice(0,2))
  }

  function addVirtualArrayAst(path, children) {
    if (children.length == 0) return []
    const elements = children.map(x=>x[1])
    const start = Math.min(...elements.map(x=>x.start)) -1
    const end = Math.max(...elements.map(x=>x.end)) + 1
    const node = { elements, start, end, virtualAst: true }
    return [[path, node], ...children]
  }

  function splitSystemArgs(allArgs, ast) {
    const args = [], system = {}
    allArgs.forEach(arg => {
        if (arg.$ == 'Var') { // Var in pipeline
          system.vars = system.vars || []
          system.vars.push(arg)
        } else {
           args.push(arg)
        }
    })
    let argsAst = ast.arguments || ast.expression.arguments
    if (system.vars) {
      const elements = system.vars.map(v=>v[astNode])
      const start = Math.min(...elements.map(x=>x.start))
      const end = Math.max(...elements.map(x=>x.end))
      system.vars[astNode] = { elements, start, end, virtualAst: true }

      argsAst = argsAst.filter(n=>!elements.includes(n))
    }

    return { args, system, argsAst }
  }
}

function resolveCompTypeWithId(id, {dslType, silent, tgpModel, parentProp, parent, topComp, parentType, remoteCode, dsl} = {}) {
  if (dslType == 'comp<tgp>')
    return tgpModel.comps['comp<tgp>tgpComp']
  if (!id) return
  const comps = tgpModel?.comps
  //if (id == 'css' && parent && parent.$ == 'text') debugger

  if (comps['any<>'+id])
    return comps['any<>'+id]
  if (comps[id]) return comps[id]
  if (comps[(dslType||'')+id]) return comps[(dslType||'')+id]

  const typeFromParent = parentProp && parentProp.typeAsParent === true && parentType
  const dynamicTypeFromParent = parentProp && typeof parentProp.typeAsParent == 'function' 
    && parentProp.typeAsParent(parentType)
  const byTypeRules = [dynamicTypeFromParent,typeFromParent,dslType].filter(x=>x).join(',').split(',').filter(x=>x)
    .flatMap(t=>moreTypesByTypeRules(t)).join(',')

  // moreTypesFromProp, ,'test<>','data<>','action<>'
  const allTypes = utils.unique([byTypeRules,dynamicTypeFromParent,typeFromParent,dslType].filter(x=>x).join(',').split(',').filter(x=>x))
  const byFullId = allTypes.map(t=>comps[t+id]).find(x=>x)
  if (byFullId)
    return byFullId
  const shortId = id.split('>').pop()
  const plugin = topComp?.plugin
  const cmps = Object.values(comps).filter(x=>x.$$)
  const bySamePlugin = plugin && cmps.find(c=> c?.plugin == plugin && c.$$.split('>').pop() == shortId )
  if (bySamePlugin)
    return bySamePlugin
  const byNoDsl = cmps.find(c=> c.$$.indexOf('<>') != -1 && c.$$.split('>').pop() == shortId )
  if (byNoDsl) {
     if (!silent) logError('resolveCompTypeWithId',{byNoDsl,id, topComp, parent, parentType, allTypes, dslType})
     return byNoDsl
  }

  if (id && !silent && !remoteCode) {
    debugger
    logError(`utils getComp - can not find comp for id ${id}`,{id, topComp, parent, parentType, allTypes, dslType})
  }

  function moreTypesByTypeRules(type) {
    // isOf: ['boolean<>','data<>'] data -> boolean
    // same: ['data<>', 'data<llm>']
    // isOfWhenEndsWith: ['-feature<>','feature<>']
    // isOfWhenEndsWith: ['-style<>',[ 'feature<>', 'style<>' ]]
    const _typeRules = tgpModel?.typeRules || []

    return _typeRules.flatMap(rule=> utils.asArray(
        rule.isOf && type == rule.isOf[0] ? rule.isOf[1]
        : rule.same && type == rule.same[0] ? rule.same[1]
        : rule.same && type == rule.same[1] ? rule.same[0]
        : rule.isOfWhenEndsWith && type.endsWith(rule.isOfWhenEndsWith[0]) && rule.isOfWhenEndsWith[0] != type ? rule.isOfWhenEndsWith[1]
        : []))          
  }
}