import {jb, jbComp} from './jb-core.js'
import { utils } from './core-utils.js'
import { logError } from './logger.js'

export { jb }
export const isMacro = Symbol.for('isMacro')
export const asJbComp = Symbol.for('asJbComp')
export const OrigArgs = Symbol.for('OrigArgs')

export const titleToId = id => id.split('.')[0].replace(/-([a-zA-Z])/g, (_, letter) => letter.toUpperCase())

export function asComp(pt) {
    const jbComp = pt[asJbComp] || pt
    if (!jbComp?.$resolvedInner)
        resolveCompArgs(jbComp)
    return jbComp
}

export const typeRules = [{ isOf: ['data<>','boolean<>'] }]

export function jbCompProxy(jbComp) {
  return new Proxy(() => 0, {
      get: (o, p) => {
        if (p == '$run')
            return (...args) => jbComp.runProfile(resolveProfileArgs(calcArgs(jbComp, args)))
      
        return p === asJbComp && jbComp
      },
      apply: function (target, thisArg, allArgs) {
        return calcArgs(jbComp, allArgs)
      }
  })
}

function calcArgs(jbComp, allArgs) {
    const { args, system } = splitSystemArgs(allArgs)
    return { $: jbComp, $unresolvedArgs: args, ...system }
}

// function getInnerMacro(ns, innerId) {
//   return (...allArgs) => {
//       const { args, system } = splitSystemArgs(allArgs)
//       return { $: `${ns}.${innerId}`, 
//           ...(args.length == 0 ? {} : { $unresolvedArgs: args }),
//           ...system
//       }
//   }
// }

export function splitSystemArgs(allArgs) {
  const args = [], system = {}
  allArgs.forEach(arg => {
      const comp = arg.$
      if (arg && typeof arg === 'object' && comp?.isSystem)
          comp?.macro(system, arg)
      else if (arg && typeof arg === 'object' && comp?.isMacro)
          args.push(comp.macro(arg))
      else
          args.push(arg)
  })
  if (args.length == 1 && typeof args[0] === 'object') {
      utils.asArray(args[0].vars).forEach(arg => {
        system.vars = system.vars || []
        system.vars.push(arg)
      })
      delete args[0].vars
  }
  return { args, system }
}

export function argsToProfile(prof, comp) {
    const cmpId = prof.$
    const args = prof.$unresolvedArgs
    if (args.length == 0)
        return { $: cmpId }        
    if (!comp)
        return { $: cmpId, $unresolvedArgs: args }
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
        ...(varArgs.length ? {vars: varArgs} : {}),
        ...propsByValue, ...propsByName
    }
}

export const sysProps = ['data', '$debug', '$disabled', '$log', 'ctx', '//', 'vars' ]
export const systemParams = [ {id: 'data', $type: 'data<>'}, {id: 'vars', $type: 'var<>'}] 

export function resolveProfileTop(comp, {id} = {}) {  
//    const comps = tgpModel?.comps
    ;(comp.params || []).forEach(p=> {
      if (sysProps.includes(p.id))
        return logError(`resolveProfileTop - can not use system prop ${p.id} as param name in ${id || comp.id}`,{comp})
      jb.ext.tgp?.resloveParam(p, comp)
    })

    // const type = comp.type || 'data<>'
    // if (type) {
    //   comp.$type = type.indexOf('<') == -1 ? `${type}<${comp.$dsl}>` : type
    //   if (id != 'anonymous') {
    //     const fullId = comp.$fullId = `${comp.$type}${id}`
    //     const existingComp = comps[fullId]
    //     if (existingComp && existingComp != comp) {
    //         logError(`comp ${fullId} at ${ JSON.stringify(comp.$location)} already defined at ${JSON.stringify(existingComp.$location)}`,
    //         {existingComp, oldLocation: existingComp.$location, newLocation: comp.$location})
    //     }
    //   }
    // }
    return comp     
}

export function resolveCompArgs(topComp) {
    if (!topComp || topComp.$resolvedInner) 
        return topComp
    ;(topComp.params || []).forEach(p=> resolveProfileArgs(p.defaultValue))
    ;(topComp.params || []).forEach(p=> resolveProfileArgs(p.templateValue))
    resolveProfileArgs(topComp.impl)
    topComp.$resolvedInner = true
    return topComp
}

export function resolveProfileArgs(prof) {
  if (!prof || !prof.constructor || ['Object','Array'].indexOf(prof.constructor.name) == -1) return prof
  const comp = prof.$
  // if (!(comp instanceof jbComp))
  //   return // logError('resolveProfileArgs - expecting jbComp at $', {prof})
  if (prof.$unresolvedArgs && comp) {
      Object.assign(prof, { ... argsToProfile(prof, comp)})
      if (OrigArgs) prof[OrigArgs] = prof.$unresolvedArgs
      delete prof.$unresolvedArgs
  }
  if (Array.isArray(prof)) {
    prof.forEach(v=>resolveProfileArgs(v))
  } else if (comp) {
    ;[...(comp.params || []), ...systemParams].forEach(p=> resolveProfileArgs(prof[p.id]))
    if (prof.$ == 'object')
      Object.values(prof).forEach(v=>resolveProfileArgs(v))
  }
  return prof
}
