/*
profile can be:
    string - potentialy a template with %$var1% %$param1%
    json - { $$: 'fullCompId', ...params}
    (ctx,vars, args) => 
    [] of profiles

comp
    {id, type, params, impl: profile}

running a profile means
1. resolving its params *in the runtime context* into args
2. calling the profile with the args, the default behavior of profile run is just to return the args

ctx is { data, vars } that can be used in extend during RT
tgpCtx { path, stack, compCtx, argsCtxs}

TGP stands for Types, Generic Classes, and profiles.
Generic classes and global profiles are implemented by comp. any comps and profile should have a type.
Types are implemented as prefixes and specialized comp functions that set the types.
DataFunc and Action are core types in the '' dsl
types are organized in DSLs.
so a full comp id is in the format: type<dsl>id

dynamic function 'hold' and keeps the args until called by client with ctx. it has the creator tgpCtx, the creator ctx and the caller ctx to merge.
}
*/
import { registerProxy, resolveProfileTop, resolveComp } from './jb-macro.js'
import { RT_types } from './core-utils.js'
import { calc } from './jb-expression.js'

export const jb = {
    comps: {},
    proxies: {},
    genericCompIds: {}
}

function asComp($$) {
    if (typeof $$ == 'string') {
        if (!jb.comps[$$]?.$resolvedInner)
            resolveComp(jb.comps[$$])
        return jb.comps[$$]
    }
}

export function component(id, comp, {plugin,dsl} = {}) {
    comp.$dsl = dsl || ''
    if (comp.type == 'any') jb.genericCompIds[id] = true
  
    const resolved = resolveProfileTop(id, comp)
    jb.comps[resolved.$$] = new TgpComp(resolved)
    return registerProxy(id)
}


export function run(profile, ctx, settings) {
    ctx = ctx || { tgpCtx : new TgpCtx() }
    const { data, vars, tgpCtx } = ctx
    const {openExpression, openArray, openObj, openComp} = settings || {openExpression: true, openArray: true, openObj: false, openComp: true}
    if (typeof profile == 'string' && openExpression)
        return toRTType(calc(profile, ctx))
    if (Array.isArray(profile) && openArray)
        return profile.map((p,i) => run(p, { data, vars, tgpCtx: tgpCtx.innerDataPath(i)}, settings))
    if (profile && profile.$$ && openComp) {
        const comp = asComp(profile.$$)
        const ret = comp.runTopProfile(profile, ctx, settings)
        return toRTType(ret)
    }
    if (typeof profile == 'function') {
        return profile(ctx,ctx.vars, tgpCtx.args)
    }
    if (profile && typeof profile == 'object' && openObj) {
        return Object.fromEntries(Object.entries(profile).map(([id,p]) =>[id,run(p, { data, vars, tgpCtx: tgpCtx.innerDataPath(i)}, settings)]))
    }
    return profile

    function toRTType(value) {
        const convert = RT_types[tgpCtx.parentParam?.as]
        return convert && convert(value) || value
    }
}

class TgpCtx {
    constructor(tgpCtx = {}) {
        Object.assign(this,tgpCtx)
    }
    innerDataPath(path) {
        return new TgpCtx({...this, path: `${this.path}~${path}`, parentParam: {$type: 'data<>'}, profile: 'data path' })
    }
    innerParam(parentParam, profile) {
        return new TgpCtx({...this, path: `${this.path}~${parentParam.id}`, parentParam, profile})
    }
    callCtx(callerCtx) {
        return new TgpCtx({...this, path: `${this.path}~${parentParam.id}`, callerStack: [...(this.callerStack||[]), callerCtx]})
    }
    newComp(comp, args) {
        return new TgpCtx({...this, 
            path: `${comp.$$}.impl`, 
            creatorStack: [...(this.creatorStack || []), this.path],
            args
        })
    }
}

class TgpComp {
    constructor(compData) {
        Object.assign(this, compData)
    }
    calcParams() {
        this._params = this._params || (this.params || []).map(p=>new param(p))
        return this._params
    }
    runTopProfile(profile, ctx, settings) {
        const compArgs = Object.fromEntries(this.calcParams().map(p =>[p.id, p.resolve(profile, ctx, settings)]))
        if (this.impl == null) return compArgs
        const { data, vars, tgpCtx } = ctx

        return run(this.impl, { data, vars, tgpCtx: tgpCtx.newComp(this,compArgs)}, settings)
    }
}

class param {
    constructor(_param) {
        Object.assign(this,_param)
    }
    resolve(profile, creatorCtx, settings) {
        if (this.dynamic == true) {
            function res(callerCtx) {
               const ctx = { ...mergeDataCtx(callerCtx, creatorCtx), tgpCtx: creatorCtx.tgpCtx.callerCtx(callerCtx).innerParam(this,profile) }
               return run(profile[this.id], ctx , settings)
            }
            res.creatorCtx = creatorCtx
            res.profile = profile
            return res
        }
        const { data, vars, tgpCtx } = creatorCtx

        return run(profile[this.id], { data, vars, tgpCtx: tgpCtx.innerParam(this, profile)}, settings )

        function mergeDataCtx(caller, {data, vars}) {
            if (caller == null) return {data, vars}
            const noOfVars = Object.keys(caller.vars || []).length
            if (noOfVars == 0 && caller.data == null)
                return {data, vars}
            return (noOfVars == 0) ? { data: caller.data, vars }
             : {data: caller.data == null ? data : caller.data, vars: {...vars, ...caller.vars}}
        }
    }
}

// core types: Data and action

export function Data(id, comp, {plugin} = {}) {
    return component(id,{...comp, type: 'data'}, {plugin, dsl:''})
}

export function Action(id, comp, {plugin} = {}) {
    return component(id,{...comp, type: 'action'}, {plugin, dsl:''})
}

// core comps are still here beacuse of initializtion order

component('isRef', {
  type: 'boolean',
  params: [
    {id: 'obj', mandatory: true}
  ],
  impl: ({},obj) => isRef(obj)
})

component('asRef', {
  params: [
    {id: 'obj', mandatory: true}
  ],
  impl: ({},obj) => asRef(obj)
})
