import { jb, jbComp} from '../../core/jb-core.js'
import { argsToProfile, OrigArgs, systemParams } from '../../core/jb-macro.js'

export function resolveCompTypes(topComp, {tgpModel} = {}) {
  if (!topComp || topComp.$resolvedInner) 
      return topComp
  ;(topComp.params || []).forEach(p=> resolveProfileTypes(p.defaultValue, {expectedType: p.$type, topComp, tgpModel}))
  ;(topComp.params || []).forEach(p=> resolveProfileTypes(p.templateValue, {expectedType: p.$type, topComp, tgpModel}))
  resolveProfileTypes(topComp.impl, {expectedType: topComp.$type, tgpModel, topComp, parent: topComp})
  topComp.$resolvedInner = true
  return topComp
}

function calcDslType(fullId) {
    if (typeof fullId != 'string') return
    if (fullId.indexOf('<') == -1)
      logError(`util dslType not fullId ${fullId}`,{})
    return (fullId || '').split('>')[0] + '>'
}

export function resolveProfileTypes(prof, { expectedType, parent, parentProp, tgpModel, topComp, parentType, remoteCode} = {}) {
    if (!prof || !prof.constructor || ['Object','Array'].indexOf(prof.constructor.name) == -1) return prof
    const typeSysType = tgpModel?.comps[`tgpType<>${parent?.$}`]
    const implType = expectedType == '$implType<>' && `${typeSysType.type}<${typeSysType.dsl||''}>`
    const typeFromParent = expectedType == '$asParent<>' ? (parentType || calcDslType(parent?.$$)) : expectedType
    const typeFromAdapter = parent?.$ == 'typeAdapter' && parent.fromType
    const fromFullId = calcDslType(prof.$$)
    const dslType = implType || typeFromAdapter || typeFromParent || fromFullId
    if (dslType?.indexOf('<') == -1) debugger
    const comp = prof.$ instanceof jbComp ? prof.$
        : resolveCompTypeWithId(prof.$$ || prof.$, { dslType, parent, parentProp, tgpModel, topComp, parentType, remoteCode })
    if (comp)
      prof.$$ = prof.$ instanceof jbComp ? prof.$ : comp.$$
    if (prof.$unresolvedArgs && comp) {
      Object.assign(prof, { ... argsToProfile(prof, comp)})
      if (OrigArgs) prof[OrigArgs] = prof.$unresolvedArgs
      delete prof.$unresolvedArgs
    }

    if (Array.isArray(prof)) {
      prof.forEach(v=>resolveProfileTypes(v, { expectedType: dslType, parent, parentProp, topComp, tgpModel, parentType, remoteCode}))
    } else if (comp && prof.$ != 'asIs') {
      ;[...(comp.params || []), ...systemParams].forEach(p=> 
          resolveProfileTypes(prof[p.id], { expectedType: p.$type, parentType: dslType, parent: prof, parentProp: p, topComp, tgpModel, remoteCode}))
      if (prof.$ == 'object')
        Object.values(prof).forEach(v=>resolveProfileTypes(v, {tgpModel, topComp, expectedType: 'data<>', remoteCode}))
    } else if (!comp && prof.$) {
        logError(`resolveProfile - can not resolve ${prof.$} at ${topComp && topComp.$$} expected type ${dslType || 'unknown'}`, 
            {compId: prof.$, prof, expectedType, dslType, topComp, parentType})
    }
    return prof
}

function resolveCompTypeWithId(id, {dslType, silent, tgpModel, parentProp, parent, topComp, parentType, remoteCode, dsl} = {}) {
    if (!id) return
    const comps = tgpModel?.comps
    //if (id == 'css' && parent && parent.$ == 'text') debugger

    if (jb.tgp[''].any[id])
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
