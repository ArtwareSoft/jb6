import { component } from './jb-core.js'
import { log, logError } from './logger.js'
import { resolveFinishedPromise, asArray, RT_types } from './core-utils.js'

export function val(ref) {
   if (ref == null || typeof ref != 'object') return ref
   const handler = refHandler(ref)
   return handler ? handler.val(ref) : ref
}

export const passiveSym = Symbol.for('passive')
export const resources = {}
export const consts = {}
export const watchableHandlers = []
export const isWatchableFunc = [] // assigned by watchable module, if loaded

export const simpleValueByRefHandler = {
    val(v) {
        if (v && v.$jb_val) return v.$jb_val()
        return v && v.$jb_parent ? v.$jb_parent[v.$jb_property] : v
    },
    writeValue(to,value,srcCtx) {
        log('writeValue jbParent',{value,to,srcCtx})
        if (!to) return
        if (to.$jb_val)
            to.$jb_val(this.val(value))
        else if (to.$jb_parent)
            to.$jb_parent[to.$jb_property] = this.val(value)
        return to
    },
    push(ref,toAdd) {
        const arr = asArray(val(ref))
        RT_types.array(toAdd).forEach(item => arr.push(item))
    },
    splice(ref,args) {
        const arr = asArray(val(ref))
        arr.splice(...(args[0]))
    },
    asRef(value) {
        return value
    },
    isRef(value) {
        return value && (value.$jb_parent || value.$jb_val || value.$jb_obj)
    },
    objectProperty(obj,prop) {
        if (this.isRef(obj[prop]))
            return obj[prop];
        else
            return { $jb_parent: obj, $jb_property: prop };
    },
    pathOfRef: () => [],
    doOp() {},
}

export function resource(id,val) { 
    if (typeof val !== 'undefined')
        resources[id] = val
    useResourcesHandler(h => h.makeWatchable(id))
    return resources[id]
}
export const removeDataResourcePrefix = id => id.indexOf('dataResource.') == 0 ? id.slice('dataResource.'.length) : id;
export const addDataResourcePrefix = id => id.indexOf('dataResource.') == 0 ? id : 'dataResource.' + id;

export const useResourcesHandler = f => watchableHandlers.filter(x=>x.resources.id == 'resources').map(h=>f(h))[0]
export const passive = (id,val) => typeof val == 'undefined' ? consts[id] : (consts[id] = markAsPassive(val || {}))
export function markAsPassive(obj) {
    if (obj && typeof obj == 'object') {
        obj[passiveSym] = true
        Object.values(obj).forEach(v=>markAsPassive(v))
    }
    return obj
}
export const addWatchableHandler = h => h && watchableHandlers.push(h)
export const removeWatchableHandler = h => watchableHandlers = watchableHandlers.filter(x=>x!=h)

export function safeRefCall(ref,f) {
    const handler = refHandler(ref)
    if (!handler || !handler.isRef(ref))
        return logError('invalid ref', {ref})
    return f(handler)
}
   
export function refHandler(ref) {
    if (ref && ref.handler) 
        return ref.handler
    if (simpleValueByRefHandler.isRef(ref)) 
        return simpleValueByRefHandler
    return watchableHandlers.find(handler => handler.isRef(ref))
}
   
export const objHandler = obj => 
    obj && refHandler(obj) || watchableHandlers.find(handler=> handler.watchable(obj)) || simpleValueByRefHandler

export const asRef = obj => {
    const watchableHanlder = watchableHandlers.find(handler => handler.watchable(obj) || handler.isRef(obj))
    if (watchableHanlder)
        return watchableHanlder.asRef(obj)
    return simpleValueByRefHandler.asRef(obj)
}

export const writeValue = (ref,value,srcCtx,noNotifications) => canChangeDB(srcCtx) && safeRefCall(ref, h => {
    noNotifications && h.startTransaction && h.startTransaction()
    h.writeValue(ref,value,srcCtx)
    noNotifications && h.endTransaction && h.endTransaction(true)
})

export const objectProperty = (obj,prop,srcCtx) => objHandler(obj).objectProperty(obj,prop,srcCtx)
export const splice = (ref,args,srcCtx) => canChangeDB(srcCtx) && safeRefCall(ref, h=>h.splice(ref,args,srcCtx))
export const move = (ref,toRef,srcCtx) => canChangeDB(srcCtx) && safeRefCall(ref, h=>h.move(ref,toRef,srcCtx))
export const push = (ref,toAdd,srcCtx) => canChangeDB(srcCtx) && safeRefCall(ref, h=>h.push(ref,toAdd,srcCtx))
export const doOp = (ref,op,srcCtx) => canChangeDB(srcCtx) && safeRefCall(ref, h=>h.doOp(ref,op,srcCtx))
export const isRef = ref => refHandler(ref)
export const isWatchable = ref => isWatchableFunc[0] && isWatchableFunc[0](ref)
export const isValid = ref => safeRefCall(ref, h=>h.isValid(ref))
export const pathOfRef = ref => safeRefCall(ref, h=>h.pathOfRef(ref))
export const refOfPath = path => watchableHandlers.reduce((res,h) => res || h.refOfPath(path),null)
export const canChangeDB = ctx => !ctx.probe || ctx.vars.testID

export function calcVar(varname, ctx, {isRef}) {
  const { tgpCtx: { args }} = ctx
  let res
  if (args !== undefined)
    res = args[varname]
  else if (ctx.vars[varname] !== undefined)
    res = ctx.vars[varname]
  else if (resources && resources[varname] !== undefined) {
    useResourcesHandler(h => h.makeWatchable(varname))
    res = isRef ? useResourcesHandler(h=>h.refOfPath([varname])) : resource(varname)
  } else if (consts && consts[varname] !== undefined)
    res = isRef ? simpleValueByRefHandler.objectProperty(consts,varname) : res = consts[varname]

  return resolveFinishedPromise(res)
}

