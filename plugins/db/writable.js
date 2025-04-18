import { Boolean, Data, jb } from '../core/jb-core.js'
import { log, logError } from '../core/logger.js'
import { resolveFinishedPromise, asArray, toArray, consts } from '../core/core-utils.js'

export function Writable(id, val) {
    resource(id,val)
}

export const addWatchableHandler = h => h && watchableHandlers.push(h)
export const removeWatchableHandler = h => watchableHandlers = watchableHandlers.filter(x=>x!=h)
const watchableHandlers = []
const isWatchableFunc = [] // assigned by watchable module, if loaded

const simpleValueByRefHandler = {
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
        toArray(toAdd).forEach(item => arr.push(item))
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

const resources = {}
function resource(id,val) { 
    if (typeof val !== 'undefined')
        resources[id] = val
    useResourcesHandler(h => h.makeWatchable(id))
    return resources[id]
}

const useResourcesHandler = f => watchableHandlers.filter(x=>x.resources.id == 'resources').map(h=>f(h))[0]

function safeRefCall(ref,f) {
    const handler = refHandler(ref)
    if (!handler || !handler.isRef(ref))
        return logError('invalid ref', {ref})
    return f(handler)
}
   
const canChangeDB = ctx => !ctx.probe || ctx.vars.testID
const objHandler = obj => obj && refHandler(obj) || watchableHandlers.find(handler=> handler.watchable(obj)) || simpleValueByRefHandler

function refHandler(ref) {
    if (ref && ref.handler) 
        return ref.handler
    if (simpleValueByRefHandler.isRef(ref)) 
        return simpleValueByRefHandler
    return watchableHandlers.find(handler => handler.isRef(ref))
}

const db = jb.ext.db = {
    objHandler,
    val(ref) {
        if (ref == null || typeof ref != 'object') return ref
        const handler = db.refHandler(ref)
        return handler ? handler.val(ref) : ref
    },
    asRef: obj => {
        const watchableHanlder = watchableHandlers.find(handler => handler.watchable(obj) || handler.isRef(obj))
        if (watchableHanlder)
            return watchableHanlder.asRef(obj)
        return simpleValueByRefHandler.asRef(obj)
    },
    
    writeValue: (ref,value,srcCtx,noNotifications) => canChangeDB(srcCtx) && safeRefCall(ref, h => {
        noNotifications && h.startTransaction && h.startTransaction()
        h.writeValue(ref,value,srcCtx)
        noNotifications && h.endTransaction && h.endTransaction(true)
    }),
    
    objectProperty: (obj,prop,srcCtx) => objHandler(obj).objectProperty(obj,prop,srcCtx),
    splice: (ref,args,srcCtx) => canChangeDB(srcCtx) && safeRefCall(ref, h=>h.splice(ref,args,srcCtx)),
    move: (ref,toRef,srcCtx) => canChangeDB(srcCtx) && safeRefCall(ref, h=>h.move(ref,toRef,srcCtx)),
    push: (ref,toAdd,srcCtx) => canChangeDB(srcCtx) && safeRefCall(ref, h=>h.push(ref,toAdd,srcCtx)),
    doOp: (ref,op,srcCtx) => canChangeDB(srcCtx) && safeRefCall(ref, h=>h.doOp(ref,op,srcCtx)),
    isRef: ref => refHandler(ref),
    isWatchable: ref => isWatchableFunc[0] && isWatchableFunc[0](ref),
    isValid: ref => safeRefCall(ref, h=>h.isValid(ref)),
    pathOfRef: ref => safeRefCall(ref, h=>h.pathOfRef(ref)),
    refOfPath: path => watchableHandlers.reduce((res,h) => res || h.refOfPath(path),null),

    calcVar(varname, ctx, {isRef}) {
        const { tgpCtx: { args }} = ctx  
        return resolveFinishedPromise(doCalc())
        
        function doCalc() {
            if (args && args[varname] != undefined) return args[varname]
            if (ctx.vars[varname] != undefined) return ctx.vars[varname] 
            if (consts[varname] != undefined) return consts[varname]
            if (resources[varname] !== undefined) {
                useResourcesHandler(h => h.makeWatchable(varname))
                return isRef ? useResourcesHandler(h=>h.refOfPath([varname])) : resource(varname)
            }
        }
    }
}

export const isRef = Boolean('isRef', {
  params: [
    {id: 'obj', mandatory: true}
  ],
  impl: ({},{obj}) => db.isRef(obj)
})

export const asRef = Data('asRef', {
  params: [
    {id: 'obj', mandatory: true}
  ],
  impl: ({},{obj}) => db.asRef(obj)
})

export const writeValue = Action('writeValue', {
  category: 'mutable:100',
  params: [
    {id: 'to', as: 'ref', mandatory: true},
    {id: 'value', mandatory: true},
    {id: 'noNotifications', as: 'boolean', type: 'boolean'}
  ],
  impl: (ctx,{to,value,noNotifications}) => {
    if (!db.isRef(to)) {
      debugger
      ctx.run(ctx.tgpCtx.profile.to,{as: 'ref'}) // for debug
      return jb.logError(`can not write to: ${ctx.tgpCtx.profile.to}`, {ctx})
    }
    const val = jb.val(value)
    if (jb.utils.isPromise(val))
      return Promise.resolve(val).then(_val=>db.writeValue(to,_val,ctx,noNotifications))
    else
      db.writeValue(to,val,ctx,noNotifications)
  }
})

export const addToArray = Action('addToArray', {
  params: [
    {id: 'array', as: 'ref', mandatory: true},
    {id: 'toAdd', as: 'array', defaultValue: '%%'},
    {id: 'clone', as: 'boolean', type: 'boolean<>'},
    {id: 'addAtTop', as: 'boolean', type: 'boolean<>'}
  ],
  impl: (ctx,{array,toAdd,clone,addAtTop}) => {
    const items = clone ? JSON.parse(JSON.stringify(toAdd)) : toAdd;
    const index = addAtTop ? 0 : jb.val(array).length;
    db.splice(array, [[index, 0, ...jb.asArray(items)]],ctx);
  }
})

export const move = Action('move', {
  description: 'move item in tree, activated from D&D',
  params: [
    {id: 'from', as: 'ref', mandatory: true},
    {id: 'to', as: 'ref', mandatory: true}
  ],
  impl: (ctx,{from,to: _to}) => db.move(from,_to,ctx)
})

export const splice = Action('splice', {
  params: [
    {id: 'array', as: 'ref', mandatory: true},
    {id: 'fromIndex', as: 'number', mandatory: true},
    {id: 'noOfItemsToRemove', as: 'number', defaultValue: 0},
    {id: 'itemsToAdd', as: 'array', defaultValue: []}
  ],
  impl: (ctx,{array,fromIndex,noOfItemsToRemove,itemsToAdd}) =>
		db.splice(array,[[fromIndex,noOfItemsToRemove,...itemsToAdd]],ctx)
})

export const removeFromArray = Action('removeFromArray', {
  params: [
    {id: 'array', as: 'ref', mandatory: true},
    {id: 'itemToRemove', as: 'single', description: 'choose item or index'},
    {id: 'index', as: 'number', description: 'choose item or index'}
  ],
  impl: (ctx,{array,itemToRemove,index: _index}) => {
		const index = itemToRemove ? jb.toarray(array).indexOf(itemToRemove) : _index;
		if (index != -1)
			db.splice(array,[[index,1]],ctx)
	}
})

export const toggleBooleanValue = Action('toggleBooleanValue', {
    params: [
      {id: 'of', as: 'ref'}
    ],
    impl: (ctx,{of: _of}) => db.writeValue(_of,jb.val(_of) ? false : true,ctx)
})

export const getOrCreate = Data('getOrCreate', {
  description: 'memoize, cache, calculate value if empty and assign for next time',
  category: 'mutable:80',
  params: [
    {id: 'writeTo', as: 'ref', mandatory: true},
    {id: 'calcValue', dynamic: true}
  ],
  impl: async (ctx, {writeTo, calcValue}) => {
    let val = utils.val(writeTo)
    if (val == null) {
      val = await calcValue()
      db.writeValue(writeTo,val,ctx)
    }
    return val
  }
})
