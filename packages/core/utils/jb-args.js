import { jb, coreUtils } from './core-utils.js'
const { logError } = coreUtils

const isMacro = Symbol.for('isMacro')
const asJbComp = Symbol.for('asJbComp')
const OrigArgs = Symbol.for('OrigArgs')
const astNode = Symbol.for('astNode')

const sysProps = ['data', '$debug', '$disabled', '$log', 'ctx', '//', 'vars' ]
const systemParams = [ {id: 'data', $dslType: 'data<common>'}, {id: 'vars', $dslType: 'var<tgp>'}] 

const titleToId = id => id.split('.')[0].replace(/-([a-zA-Z])/g, (_, letter) => letter.toUpperCase())

function asComp(pt) {
    const jbComp = pt[asJbComp] || pt
    if (!jbComp?.$resolvedInner)
        resolveCompArgs(jbComp)
    return jbComp
}

function jbCompProxy(jbComp) {
  return new Proxy(() => 0, {
      get: (o, p) => {
        if (p == '$run')
            return (...args) => jbComp.runProfile(resolveProfileArgs(calcArgs(jbComp, args)))
        if (p == '$resolve')
          return (...args) => resolveProfileArgs(calcArgs(jbComp, args))
        if (p == '$impl')
          return jbComp.impl
    
        return p === asJbComp && jbComp
      },
      apply: function (target, thisArg, $unresolvedArgs) {
        return calcArgs(jbComp,$unresolvedArgs)
      }
  })
}

function calcArgs(jbComp,$unresolvedArgs) {
  if (jbComp.id == 'asIs') // any<tgp>asIs
    return () => $unresolvedArgs[0]
  return { $: jbComp, $unresolvedArgs }
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

function splitSystemArgs(allArgs) {
  const args = [], system = {}
  allArgs.forEach(arg => {
      const comp = arg.$
      if (comp?.id == 'Var') { // Var in pipeline var<tgp>Var
        system.vars = system.vars || []
        system.vars.push(arg)
      } else {
         args.push(arg)
      }
  })
  return { args, system }
}

function argsToProfile(prof, comp) {
    const { args, system } = splitSystemArgs(prof.$unresolvedArgs)
    if (args.length == 0) return {}

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
            return { ...system, [param0.id]: params.length > 1 && args.length == 1 ? args[0] : args }
        if (secondParamAsArray)
            return { ...system, [param0.id]: args[0], [param1.id] : args.slice(1) }

        if (comp.macroByValue || params.length < 3)
            return { ...system, ...Object.fromEntries(args.filter((_, i) => params[i]).map((arg, i) => [params[i].id, arg])) }
    }

    const varArgs = []
    while (argsByValue[0] && argsByValue[0].$ == 'Var')
        varArgs.push(argsByValue.shift())
    const propsByValue = onlyByName ? []
        : firstParamAsArray ? { [param0.id] : argsByValue }
        : secondParamAsArray ? { [param0.id] : argsByValue[0], [param1.id] : argsByValue.slice(1) } 
        : Object.fromEntries(argsByValue.map((v,i) => [params[i].id, v]))
    return { ...system,
        ...(varArgs.length ? {vars: varArgs} : {}),
        ...propsByValue, ...propsByName
    }
}

function resolveProfileTop(comp) {
    const dsl = comp.dsl || ''
    comp.$dslType = comp.type.indexOf('>') == -1 ? `${comp.type}<${dsl}>` : comp.type
    ;(comp.params || []).filter(p=> !p.dynamicTypeFromParent).forEach(p=> {
      if (p.type == 'boolean') p.type = 'boolean<common>'
      if (p.type == 'data' || !p.type) p.type = 'data<common>'
      if (p.type == 'action') p.type = 'action<common>'

      if (p.as == 'boolean' && ['ref'].indexOf(p.type) == -1) 
        p.type = 'boolean<common>'
      const t1 = (p.type || '').replace(/\[\]/g,'') || 'data<common>'
      p.$dslType = t1.indexOf('<') == -1 ? `${t1}<${comp.dsl || 'common'}>` : t1
      // if (p.$dslType.match(/<>/)) debugger
    })
    ;(comp.params || []).forEach(p=> {
      if (sysProps.includes(p.id))
        return logError(`resolveProfileTop - can not use system prop ${p.id} as param name in ${comp.id||''}`,{comp})
    })
    return comp     
}

function resolveCompArgs(topComp) {
    if (!topComp || topComp.$resolvedInner) 
        return topComp
    ;(topComp.params || []).forEach(p=> resolveProfileArgs(p.defaultValue))
    ;(topComp.params || []).forEach(p=> resolveProfileArgs(p.templateValue))
    resolveProfileArgs(topComp.impl)
    topComp.$resolvedInner = true
    return topComp
}

function resolveProfileArgs(prof) {
  if (!prof || !prof.constructor || ['Object','Array'].indexOf(prof.constructor.name) == -1) return prof
  const comp = prof.$
  // if (!(comp instanceof jbComp))
  //   return // logError('resolveProfileArgs - expecting jbComp at $', {prof})
  if (prof.$unresolvedArgs && comp) {
      Object.assign(prof, argsToProfile(prof, comp))
      prof[OrigArgs] = prof.$unresolvedArgs
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

Object.assign(coreUtils, { astNode, resolveProfileTop, resolveCompArgs, resolveProfileArgs, isMacro, asJbComp, OrigArgs, sysProps, systemParams, titleToId, asComp, jbCompProxy})
