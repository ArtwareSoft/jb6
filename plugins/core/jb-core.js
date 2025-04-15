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

export function comp(id, comp, {plugin,dsl} = {}) {
    comp.$dsl = dsl || ''
    if (comp.type == 'any') jb.genericCompIds[id] = true
  
    const resolved = resolveProfileTop(id, comp)
    jb.comps[resolved.$$] = new TgpComp(resolved)
    return registerProxy(id)
}

export function component(id, _comp, {plugin,dsl} = {}) {
    return comp(id, _comp, {plugin,dsl})
}

export function DataFunc(id, _comp, {plugin} = {}) {
    return comp(id,{..._comp, type: 'data'}, {plugin, dsl:''})
}

export function Action(id, _comp, {plugin} = {}) {
    return comp(id,{..._comp, type: 'action'}, {plugin, dsl:''})
}

export function run(profile, ctx = { vars: {}}, args, tgpCtx = new TgpCtx(), settings) {
    const {openExpression, openArray, openObj, openComp} = settings || {openExpression: true, openArray: true, openObj: false, openComp: true}
    if (typeof profile == 'string' && openExpression)
        return toRTType(calc(profile, ctx, args, tgpCtx))
    if (Array.isArray(profile) && openArray)
        return profile.map((p,i) => run(p,ctx,args,tgpCtx.innerDataPath(i), settings))
    if (profile && profile.$$ && openComp) {
        const comp = asComp(profile.$$)
        const ret = comp.runProfile(profile, ctx, args, tgpCtx, settings)
        return toRTType(ret)
    }
    if (typeof profile == 'function') {
        return profile(ctx,ctx.vars, args)
    }
    if (profile && typeof profile == 'object' && openObj) {
        return Object.fromEntries(Object.entries(profile).map(([id,p]) =>[id,run(p,ctx,args,tgpCtx.innerDataPath(id), settings)]))
    }
    return profile

    function toRTType(value) {
        const convert = RT_types[tgpCtx.parentParam?.as]
        return convert && convert(value) || value
    }
}

function mergeCtx(callerCtx, creatorCtx) {
    if (callerCtx == null) return creatorCtx
    const noOfVars = Object.keys(callerCtx.vars || []).length
    if (noOfVars == 0 && callerCtx.data == null)
        return creatorCtx
    return (noOfVars == 0) ? { data: callerCtx.data, vars: creatorCtx.vars }
     : {data: callerCtx.data == null ? creatorCtx.data: callerCtx.data, vars: {...creatorCtx.vars, ...callerCtx.vars}}
}

class TgpCtx {
    constructor(tgpCtx = {}) {
        Object.assign(this,tgpCtx)
        this.stack = this.stack || []
    }
    innerDataPath(path) {
        return new TgpCtx({...this, path: `${this.path}~${path}`, parentParam: {$type: 'data<>'} })
    }
    innerParam(parentParam) {
        return new TgpCtx({...this, path: `${this.path}~${parentParam.id}`, parentParam})
    }
    newComp(comp, compArgs) {
        return new TgpCtx({...this, 
            path: `${comp.$$}.impl`, 
            stack: [...this.stack, this.path],
            callerCtx: this,
            argsCtx: Object.fromEntries(Object.entries(compArgs).map(([id,val]) => [id,typeof val == 'function' && val.tgpCtx])
                .filter(([id,val]) =>val))
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
    runProfile(profile, ctx, args, tgpCtx, settings) {
        const compArgs = Object.fromEntries(this.calcParams().map(p =>[p.id, p.resolve(profile, ctx, args, tgpCtx, settings)]))
        if (this.impl == null) return compArgs
        return run(this.impl, ctx, compArgs, tgpCtx.newComp(this,compArgs), settings)
    }
}

class param {
    constructor(_param) {
        Object.assign(this,_param)
    }
    resolve(profile, creatorCtx, creatorArgs, tgpCtx, settings) {
        if (this.dynamic == true) {
            function res(callerCtx) {
               return run(profile[this.id], mergeCtx(callerCtx, creatorCtx), creatorArgs, tgpCtx.innerParam(this), settings)
            }
            res.tgpCtx = tgpCtx
            res.profile = profile
            return res
        }
        return run(profile[this.id], creatorCtx, creatorArgs, tgpCtx.innerParam(this), settings )
    }
}    

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
