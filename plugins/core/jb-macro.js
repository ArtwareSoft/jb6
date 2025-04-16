import {jb, run} from './jb-core.js'
import { isPrimitiveValue, asArray, path, unique } from './core-utils.js'
import { logError } from './spy.js'

const isMacro = Symbol.for('isMacro')
const OrigValues = Symbol.for('OrigValues')

export function registerProxy(id) {
    const proxyId = id.split('.')[0].replace(/-([a-zA-Z])/g, (_, letter) => letter.toUpperCase())
    return jb.proxies[proxyId] = jb.proxies[proxyId] || proxy(proxyId)
}
export const typeRules = [{ isOf: ['data<>','boolean<>'] }]

function proxy(id) {
  return new Proxy(() => 0, {
      get: (o, p) => {
        if (p == 'run')
            return (...args) => run(resolveProfile({$: id,...calcArgs(id, args) }, {expectedType: 'action<>'}))
        if (p == 'calc')
            return (...args) => run(resolveProfile({$: id,...calcArgs(id, args) }, {expectedType: 'data<>'}))
  
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
    return { $: actualId, $unresolved: args, ...system, ...(id[0] == '_' ? {$disabled:true} : {} ) }
}

function getInnerMacro(ns, innerId) {
  return (...allArgs) => {
      const { args, system } = splitSystemArgs(allArgs)
      return { $: `${ns}.${innerId}`, 
          ...(args.length == 0 ? {} : { $unresolved: args }),
          ...system
      }
  }
}

function splitSystemArgs(allArgs) {
  const args = [], system = {}
  allArgs.forEach(arg => {
      if (arg && typeof arg === 'object' && (jb.comps[arg.$] || {}).isSystem)
          jb.comps[arg.$].macro(system, arg)
      else if (arg && typeof arg === 'object' && (jb.comps[arg.$] || {}).isMacro)
          args.push(jb.comps[arg.$].macro(arg))
      else
          args.push(arg)
  })
  if (args.length == 1 && typeof args[0] === 'object') {
      asArray(args[0].vars).forEach(arg => jb.comps[arg.$].macro(system, arg))
      delete args[0].vars
  }
  return { args, system }
}

function argsToProfile(cmpId, comp, args, topComp) {
    if (args.length == 0)
        return { $: cmpId }        
    if (!comp)
        return { $: cmpId, $unresolved: args }
    if (cmpId == 'asIs') return { $: 'asIs', $asIs: args[0] }
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
            return { $: cmpId, [param0.id]: params.length > 1 && args.length == 1 ? args[0] : args }
        if (secondParamAsArray)
            return { $: cmpId, [param0.id]: args[0], [param1.id] : args.slice(1) }

        if (comp.macroByValue || params.length < 3)
            return { $: cmpId, ...Object.fromEntries(args.filter((_, i) => params[i]).map((arg, i) => [params[i].id, arg])) }
    }

    const varArgs = []
    while (argsByValue[0] && argsByValue[0].$ == 'Var')
        varArgs.push(argsByValue.shift())
    const propsByValue = onlyByName ? []
        : firstParamAsArray ? { [param0.id] : argsByValue }
        : secondParamAsArray ? { [param0.id] : argsByValue[0], [param1.id] : argsByValue.slice(1) } 
        : Object.fromEntries(argsByValue.map((v,i) => [params[i].id, v]))
    return { $: cmpId,
        ...(varArgs.length ? {$vars: varArgs} : {}),
        ...propsByValue, ...propsByName
    }
}

const systemProps = ['data', '$debug', '$disabled', '$log', 'ctx', '//' ]
const richSystemProps = [ {id: 'data', $type: 'data<>'}] 

export function resolveProfileTop(id, comp, {tgpModel} = {}) {  
    const comps = tgpModel && tgpModel.comps || jb.comps
    ;(comp.params || []).forEach(p=> {
      if (systemProps.includes(p.id))
        return logError(`resolveProfileTop - can not use system prop ${p.id} as param name in ${id}`,{comp})
      // fix as boolean params to have type: 'boolean'
      if (p.as == 'boolean' && ['boolean','ref'].indexOf(p.type) == -1) p.type = 'boolean<>'
      const t1 = (p.type || '').replace(/\[\]/g,'') || 'data<>'
      p.$type = t1.indexOf('<') == -1 ? `${t1}<${comp.$dsl}>` : t1
    })

    const type = comp.type || 'data<>'
    if (type) {
      comp.$type = type.indexOf('<') == -1 ? `${type}<${comp.$dsl}>` : type
      const fullId = comp.$$ = `${comp.$type}${id}`
      const existingComp = comps[fullId]
      if (existingComp && existingComp != comp) {
        logError(`comp ${fullId} at ${ JSON.stringify(comp.$location)} already defined at ${JSON.stringify(existingComp.$location)}`,
          {existingComp, oldLocation: existingComp.$location, newLocation: comp.$location})
      }
    }
    return comp     
}

export function resolveComp(topComp, {tgpModel} = {}) {
    if (!topComp) return
    ;(topComp.params || []).forEach(p=> resolveProfile(p.defaultValue, {expectedType: p.$type, topComp, tgpModel}))
    ;(topComp.params || []).forEach(p=> resolveProfile(p.templateValue, {expectedType: p.$type, topComp, tgpModel}))
    resolveProfile(topComp.impl, {expectedType: topComp.$type, tgpModel, topComp, parent: topComp})
    topComp.$resolvedInner = true
}

function resolveProfile(prof, { expectedType, parent, parentProp, tgpModel, topComp, parentType, remoteCode} = {}) {
    if (!prof || !prof.constructor || ['Object','Array'].indexOf(prof.constructor.name) == -1) return prof
    const typeFromParent = expectedType == '$asParent<>' ? parentType || dslType(path(parent,'$$')) : expectedType
    const typeFromAdapter = parent && parent.$ == 'typeAdapter' && parent.fromType
    const fromFullId = prof.$$ && dslType(prof.$$)
    const dslType = typeFromAdapter || typeFromParent || fromFullId
    if (dslType && dslType.indexOf('<') == -1) debugger
    const comp = resolveCompWithId(prof.$$ || prof.$, { dslType, parent, parentProp, tgpModel, topComp, parentType, remoteCode })
    if (comp)
      prof.$$ = comp.$$
    remoteCode = remoteCode || (prof.$$ || '').match(/>remote/) || (prof.$$ || '').match(/remote$/)

    if (prof.$unresolved && comp) {
        Object.assign(prof, argsToProfile(prof.$, comp, prof.$unresolved, topComp))
        if (OrigValues) prof[OrigValues] = prof.$unresolved
        delete prof.$unresolved
    }
    if (Array.isArray(prof)) {
      prof.forEach(v=>resolveProfile(v, { expectedType: dslType, parent, parentProp, topComp, tgpModel, parentType, remoteCode}))
    } else if (comp && prof.$ != 'asIs') {
      ;[...(comp.params || []), ...richSystemProps].forEach(p=> 
          resolveProfile(prof[p.id], { expectedType: p.$type, parentType: dslType, parent: prof, parentProp: p, topComp, tgpModel, remoteCode}))
      resolveProfile(prof.$vars, {tgpModel, topComp, expectedType: 'var<>', remoteCode})
      if (prof.$ == 'object')
        Object.values(prof).forEach(v=>resolveProfile(v, {tgpModel, topComp, expectedType: 'data<>', remoteCode}))
    } else if (!comp && prof.$) {
        logError(`resolveProfile - can not resolve ${prof.$} at ${topComp && topComp.$$} expected type ${dslType || 'unknown'}`, 
            {compId: prof.$, prof, expectedType, dslType, topComp, parentType})
    }
    return prof
}

function resolveCompWithId(id, {dslType, silent, tgpModel, parentProp, parent, topComp, parentType, remoteCode, dsl} = {}) {
    if (!id) return
    const comps = tgpModel && tgpModel.comps || jb.comps
    //if (id == 'css' && parent && parent.$ == 'text') debugger
    if (jb.genericCompIds[id])
      return comps['any<>'+id]
    if (comps[id]) return comps[id]
    if (comps[(dslType||'')+id]) return comps[(dslType||'')+id]

    //const moreTypesFromProp = path(parentProp,'moreTypes') || ''
    const typeFromParent = parentProp && parentProp.typeAsParent === true && parentType
    const dynamicTypeFromParent = parentProp && typeof parentProp.typeAsParent == 'function' 
      && parentProp.typeAsParent(parentType)
    const byTypeRules = [dynamicTypeFromParent,typeFromParent,dslType].filter(x=>x).join(',').split(',').filter(x=>x)
      .flatMap(t=>moreTypesByTypeRules(t)).join(',')

    // moreTypesFromProp, ,'test<>','data<>','action<>'
    const allTypes = unique([byTypeRules,dynamicTypeFromParent,typeFromParent,dslType].filter(x=>x).join(',').split(',').filter(x=>x))
    const byFullId = allTypes.map(t=>comps[t+id]).find(x=>x)
    if (byFullId)
      return byFullId
    const shortId = id.split('>').pop()
    const plugin = path(topComp,'plugin')
    const cmps = Object.values(comps).filter(x=>x.$$)
    const bySamePlugin = plugin && cmps.find(c=> path(c,'plugin') == plugin && c.$$.split('>').pop() == shortId )
    if (bySamePlugin)
      return bySamePlugin
    const byNoDsl = cmps.find(c=> c.$$.indexOf('<>') != -1 && c.$$.split('>').pop() == shortId )
    if (byNoDsl) {
       if (!silent) logError('resolveCompWithId',{byNoDsl,id, topComp, parent, parentType, allTypes, dslType})
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
      const _typeRules = tgpModel && tgpModel.typeRules || typeRules

      return _typeRules.flatMap(rule=> asArray(
          rule.isOf && type == rule.isOf[0] ? rule.isOf[1]
          : rule.same && type == rule.same[0] ? rule.same[1]
          : rule.same && type == rule.same[1] ? rule.same[0]
          : rule.isOfWhenEndsWith && type.endsWith(rule.isOfWhenEndsWith[0]) && rule.isOfWhenEndsWith[0] != type ? rule.isOfWhenEndsWith[1]
          : []))          
    }
}
