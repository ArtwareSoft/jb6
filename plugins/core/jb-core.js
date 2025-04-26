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
import { registerProxy, resolveProfileTop, resolveComp, tgpCompProxy, resolveProfile } from './jb-macro.js'
import { RT_types, utils } from './core-utils.js'
import { calc } from './jb-expression.js'

export const jb = globalThis._jb = {
    comps: {},
    proxies: {},
    genericCompIds: {},
    ext: {}
}

function asComp($$) {
    if (typeof $$ == 'string') {
        if (!jb.comps[$$]?.$resolvedInner)
            resolveComp(jb.comps[$$])
        return jb.comps[$$]
    } else {
        if (!$$?.$resolvedInner)
            resolveComp($$)
        return $$
    }
}

export function Component(...args) {
    if (typeof args[0] != 'string') {
        const comp = args[0]
        comp.$dsl = comp.dsl || ''
        return tgpCompProxy(resolveComp(new TgpComp(resolveProfileTop('anonymous', comp))))
    }

    const [id, comp] = args
    comp.$dsl = comp.dsl || ''
    if (comp.type == 'any') jb.genericCompIds[id] = true
    comp.$location = calcSourceLocation(new Error().stack.split(/\r|\n/)) || {}
  
    registerProxy(id)
    const resolved = resolveProfileTop(id, comp)
    return tgpCompProxy(jb.comps[resolved.$$] = new TgpComp(resolved))
}

export function run(profile, ctx = new Ctx(), settings = {openExpression: true, openArray: false, openObj: false, openComp: true}) {
    // changing context with data and vars
    if (profile.vars && !settings.resolvedCtx)
        ctx = ctx.extendWithVarsScript(profile.vars)
    if (utils.isPromise(ctx)) // handling a-synch vars
        return ctx.then(resolvedCtx => run(profile,resolvedCtx,{...settings, resolvedCtx: true}))
    delete settings.resolvedCtx
    if (profile.data != null)
        ctx = ctx.setData(profile.data)

    const { tgpCtx } = ctx

    const {openExpression, openArray, openObj, openComp} = settings
    if (typeof profile == 'string' && openExpression)
        return toRTType(tgpCtx.parentParam, calc(profile, ctx))
    if (Array.isArray(profile) && openArray)
        return profile.map((p,i) => run(p, ctx.setTgpCtx(tgpCtx.innerDataPath(i)), settings))
    const arrayType = (tgpCtx.parentParam?.type || '').indexOf('[]') != -1
    if (arrayType && Array.isArray(profile)) // array param
        return profile.flatMap(p => run(p, ctx, settings))
    if (profile && profile.$$ && openComp) {
        const comp = asComp(profile.$$)
        const ret = comp.runProfile(profile, ctx, settings)
        return toRTType(tgpCtx.parentParam, ret)
    }
    if (typeof profile == 'function' && profile.compFunc)
        return profile(ctx, tgpCtx.args)
    if (typeof profile == 'function')
        return profile(ctx, ctx.vars, tgpCtx.args)
    
    if (profile && typeof profile == 'object' && openObj) {
        return Object.fromEntries(Object.entries(profile).map(([id,p]) =>[id,run(p, ctx.setTgpCtx(tgpCtx.innerDataPath(i)), settings)]))
    }
    return profile
}

function toRTType(parentParam, value) {
    const convert = RT_types[parentParam?.as]
    if (convert) return convert(value)
    return value
}

class TgpCtx {
    constructor(tgpCtx = {}) {
        Object.assign(this,tgpCtx)
    }
    innerDataPath(path) {
        return new TgpCtx({...this, path: `${this.path}~${path}`, parentParam: {$type: 'data<>'}, profile: 'data path' })
    }
    innerParam(parentParam, profile) {
        return new TgpCtx({...this, path: `${this.path}~${parentParam.id}`, parentParam, profile: profile[parentParam.id]})
    }
    paramDefaultValue(path, parentParam) {
        return new TgpCtx({...this, creatorStack: [...(this.creatorStack || []), this.path, path], path, parentParam, profile: parentParam.defaultValue})
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

export class Ctx {
    constructor({data,vars = {}, tgpCtx = new TgpCtx()} = {}) {
        this.data = data
        this.vars = vars
        this.tgpCtx = tgpCtx
    }
    setData(data) {
        return new Ctx({data,vars: this.vars, tgpCtx: this.tgpCtx})
    }
    setVars(vars) {
        return new Ctx({data: this.data, vars: {...this.vars, ...vars}, tgpCtx: this.tgpCtx})
    }
    setTgpCtx(tgpCtx) {
        return new Ctx({data: this.data, vars: this.vars, tgpCtx})
    }
    run(profile) {
        return run(resolveProfile(profile),this)
    }
    exp(exp,jstype) { 
        return calc(exp, this.setTgpCtx(new TgpCtx({...this.tgpCtx, parentParam: {as: jstype}}))) 
    }
    runInner(profile, parentParam, innerPath) {
        return run(profile, this.setTgpCtx(new TgpCtx({...this.tgpCtx, path: `${this.path}~${innerPath}`, parentParam, profile})))
    }
    extendWithVarsScript(vars) {
        const runInnerPathForVar = (profile = ({data}) => data, index, ctx) =>
            run(profile, ctx.setTgpCtx(new TgpCtx({...ctx.TgpCtx, path: `${this.path}~vars~${index}~val`, parentParam: {$type: 'data<>'} })))

        vars = utils.asArray(vars)
        if (vars.find(x=>x.async))
            return vars.reduce( async (ctx,{name,val},i) => {
              const _ctx = await ctx
              return _ctx.setVars({[name]: await runInnerPathForVar(val, i, _ctx)})
            } , this)
        return vars.reduce((ctx,{name,val},i) => ctx.setVars({[name]: runInnerPathForVar(val, i, ctx)}), this )        
    }
}

export class TgpComp {
    constructor(compData) {
        Object.assign(this, compData)
    }
    calcParams() {
        this._params = this._params || (this.params || []).map(p=>new param(p, this.$$))
        return this._params
    }
    runProfile(profile, ctx = new Ctx(), settings) {
        const compArgs = Object.fromEntries(this.calcParams().map(p =>[p.id, p.resolve(profile, ctx, settings)]))
        if (this.impl == null) return compArgs
        if (typeof this.impl == 'function')
            this.impl.compFunc = true
        return run(this.impl, ctx.setTgpCtx(ctx.tgpCtx.newComp(this,compArgs)), settings)
    }
}

class param {
    constructor(_param,compFullPath) {
        Object.assign(this,_param)
        this.path = `${compFullPath}~params~${_param.id}`
    }
    resolve(profile, creatorCtx, settings) {
        const doResolve = ctxToUse => {
            const value = profile[this.id] == null && this.defaultValue == null ? null 
                : profile[this.id] == null && this.defaultValue != null ? run(this.defaultValue, 
                    ctxToUse.setTgpCtx(ctxToUse.tgpCtx.paramDefaultValue(`${this.path}~defaultValue`, this)), settings )
                : run(profile[this.id], ctxToUse.setTgpCtx(ctxToUse.tgpCtx.innerParam(this, profile)), settings )
            return toRTType(this, value)
        }

        if (this.dynamic == true) {
            const res = callerCtx => doResolve(mergeDataCtx(creatorCtx, callerCtx))
            res.creatorCtx = creatorCtx
            res.profile = profile
            return res
        }                
        return doResolve(creatorCtx)

        function mergeDataCtx(creatorCtx, callerCtx) {
            if (callerCtx == null) return creatorCtx
            const noOfVars = Object.keys(callerCtx.vars || []).length
            if (noOfVars == 0 && callerCtx.data == null)
                return creatorCtx
            if (noOfVars == 0 && callerCtx.data != null)
                return creatorCtx.setData(callerCtx.data)
            if (noOfVars > 0 && callerCtx.data != null)
                return creatorCtx.setVars(callerCtx.vars).setData(callerCtx.data)
            if (noOfVars > 0 && callerCtx.data == null)
                return creatorCtx.setVars(callerCtx.vars)
        }
    }
}

const extHandlers = {}
const notifications = []
export function onInjectExtension(ext, handler) {
    setTimeout(() => {
        extHandlers[ext] = extHandlers[ext] || []
        extHandlers[ext].push(handler)
        // notify older notifications
        notifications.filter(n=>n.ext == ext).forEach(({extObj, level})=>handler(extObj, level))
    },0)
}

export function notifyInjectExtension(ext, extObj, level=1) {
    (extHandlers[ext] || []).forEach(h=>h(extObj, level))
    notifications.push({ext, extObj, level})
}

export function globalsOfType(type) {
    return Object.keys(jb.comps).filter(k=>k.startsWith(type)).filter(k=>!(jb.comps[k].params || []).length).map(k=>k.split('>').pop())
}

export const TgpType = (type, extraCompProps) => {
    const ret = (id, comp) => Component(id,{...comp, type, ...extraCompProps})
    ret.type = type
    return ret
}

// core types: Data and action
export const Any = TgpType('any')
export const Data = TgpType('data')
export const Boolean = TgpType('boolean')
export const Action = TgpType('action')

export function DefComponents(items,def) { items.forEach(item=>def(item)) }

function calcSourceLocation(errStack) {
    try {
        const takeOutHostNameAndPort = /\/\/[^\/:]+(:\d+)?\//
        const line = errStack.map(x=>x.trim().replace(takeOutHostNameAndPort,'/'))
            .filter(x=>x && !x.match(/^Error/) && !x.match(/jb-core.js/)).shift()
        const location = line ? (line.split('at ').pop().split('eval (').pop().split(' (').pop().match(/\\?([^:]+):([^:]+):[^:]+$/) || ['','','','']).slice(1,3) : ['','']
        location[0] = location[0].split('?')[0]
        if (location[0].match(/jb-loader.js/)) debugger
        const path = location[0]
        return { path, line: location[1] }
    } catch(e) {
      console.log(e)
    }      
}