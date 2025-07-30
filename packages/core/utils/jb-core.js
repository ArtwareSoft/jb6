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
jbCtx { path, stack, compCtx, argsCtxs}

TGP stands for Types, Generic Classes, and profiles.
Generic classes and global profiles are implemented by comp. any comps and profile should have a type.
Types are implemented as prefixes and specialized comp functions that set the types.
DataFunc and Action are core types in the '' dsl
types are organized in DSLs.
so a full comp id is in the format: type<dsl>id

dynamic function 'hold' and keeps the args until called by client with ctx. it has the creator jbCtx, the creator ctx and the caller ctx to merge.
}
*/
import { jb } from '@jb6/repo'
import './core-utils.js'

const { RT_types, resolveCompArgs, resolveProfileArgs, asComp, calcExpression, isPromise, asArray, waitForInnerElements } = jb.coreUtils

function run(profile, ctx = new Ctx(), settings = {openExpression: true, openArray: false, openObj: false, openComp: true}) {
    // changing context with data and vars
    if (profile.vars && !settings.resolvedCtx)
        ctx = ctx.extendWithVarsScript(profile.vars)
    if (isPromise(ctx)) // handling a-synch vars
        return ctx.then(resolvedCtx => run(profile,resolvedCtx,{...settings, resolvedCtx: true}))
    delete settings.resolvedCtx
    const { jbCtx } = ctx
    if (profile.data != null)
        ctx = ctx.setData(run(profile.data, ctx.setJbCtx(jbCtx.innerParam({id: 'data'}, profile)), settings))

    const {openExpression, openArray, openObj, openComp} = settings
    resolveDelayed(profile)
    let res = profile

    if (typeof profile == 'string' && openExpression)
        res = toRTType(jbCtx.parentParam, calcExpression(profile, ctx))
    else if (Array.isArray(profile) && openArray)
        res = profile.map((p,i) => run(p, ctx.setJbCtx(jbCtx.innerDataPath(i)), settings))
    else if ((jbCtx.parentParam?.type || '').indexOf('[]') != -1 && Array.isArray(profile)) // array param
        res = profile.flatMap((p,i) => run(p, ctx.setJbCtx(jbCtx.innerArrayPath(i)), settings))
    else if (profile && profile.$ && openComp) {
        const comp = asComp(profile.$) // also lazy resolve
        const compArgs = Object.fromEntries(comp.calcParams().map(p =>[p.id, p.resolve(profile, ctx.setJbCtx(ctx.jbCtx.innerParam(p, profile)), settings)]))
        if (comp.impl == null) return compArgs
        if (typeof comp.impl == 'function')
            comp.impl.compFunc = true
        res = run(comp.impl, ctx.setJbCtx(ctx.jbCtx.newComp(comp,compArgs)), settings)
    } else if (typeof profile == 'function' && profile.compFunc)
        res = profile(ctx, jbCtx.args)
    else if (typeof profile == 'function')
        res = profile(ctx, ctx.vars, jbCtx.args)
    else if (profile && typeof profile == 'object' && openObj)
        res = Object.fromEntries(Object.entries(profile).map(([id,p]) =>[id,run(p, ctx.setJbCtx(jbCtx.innerDataPath(i)), settings)]))
    
    if (jbCtx.probe)
        jbCtx.probe.record(ctx, res, ctx.data, ctx.vars)
    return res
}

function toRTType(parentParam, value) {
    const convert = RT_types[parentParam?.as]
    const val = waitForInnerElements(value,{passRx: true})
    if (convert) {
        if (isPromise(val))
            return val.then(res=>convert(res))
        return convert(value)
    }
    return value
}

function resolveDelayed(profile) {
    if (profile?.$delayed) {
        Object.assign(profile, profile.$delayed())
        delete profile.$delayed
        resolveProfileArgs(profile)
    }
}

class JBCtx {
    constructor(jbCtx = {}) {
        Object.assign(this,jbCtx)
    }
    innerDataPath(path) {
        return new JBCtx({...this, path: `${this.path}~${path}`, parentParam: {$type: 'data<common>'}, profile: 'data path' })
    }
    innerArrayPath(index) {
        return new JBCtx({...this, path: `${this.path}~${index}`, profile: this.profile[index] })
    }
    innerParam(parentParam, profile) {
        return new JBCtx({...this, path: `${this.path}~${parentParam.id}`, parentParam, profile: profile[parentParam.id]})
    }
    paramDefaultValue(path, parentParam) {
        return new JBCtx({...this, creatorStack: [...(this.creatorStack || []), this.path, path], path, parentParam, profile: parentParam.defaultValue})
    }
    callCtx(callerCtx) {
        return new JBCtx({...this, callerStack: [...(this.callerStack||[]), callerCtx]})
    }
    newComp(comp, args) {
        return new JBCtx({...this, 
            path: `${comp.$dslType}${comp.id}~impl`, 
            creatorStack: [...(this.creatorStack || []), this.path],
            args
        })
    }
}

class Ctx {
    constructor({data,vars = {}, jbCtx = new JBCtx()} = {}) {
        this.data = data
        this.vars = vars
        this.jbCtx = jbCtx
    }
    setData(data) {
        return new Ctx({data,vars: this.vars, jbCtx: this.jbCtx})
    }
    setVars(vars) {
        return new Ctx({data: this.data, vars: {...this.vars, ...vars}, jbCtx: this.jbCtx})
    }
    setJbCtx(jbCtx) {
        return new Ctx({data: this.data, vars: this.vars, jbCtx})
    }
    run(profile) {
        resolveDelayed(profile)
        return run(resolveProfileArgs(profile),this)
    }
    exp(exp,jstype) { 
        return calcExpression(exp, this.setJbCtx(new JBCtx({...this.jbCtx, parentParam: {as: jstype}}))) 
    }
    runInnerArg(arg, arrayIndex) {
        return arg(this, arrayIndex)
    }
    extendWithVarsScript(vars) {
        const runInnerPathForVar = (profile = ({data}) => data, index, ctx) =>
            run(profile, ctx.setJbCtx(new JBCtx({...ctx.jbCtx, path: `${this.jbCtx.path}~vars~${index}~val`, parentParam: {$type: 'data<common>'} })))

        vars = asArray(vars)
        if (vars.find(x=>x.async))
            return vars.reduce( async (ctx,{name,val},i) => {
              const _ctx = await ctx
              return _ctx.setVars({[name]: await runInnerPathForVar(val, i, _ctx)})
            } , this)
        return vars.reduce((ctx,{name,val},i) => ctx.setVars({[name]: runInnerPathForVar(val, i, ctx)}), this )        
    }
    dataObj(out,vars,input) { 
        //    this.probe && jb.probe.record(this,out,input||out,vars)
        return {data: out, vars: vars || this.vars} 
    }
}

class jbComp {
    constructor(compData) {
        Object.assign(this, compData)
    }
    calcParams() {
        this._params = this._params || (this.params || []).map(p=>new paramRunner(p, this.id))
        return this._params
    }
    runProfile(profile, ctx = new Ctx(), settings) {
        const compArgs = Object.fromEntries(this.calcParams().map(p =>[p.id, p.resolve(profile, ctx.setJbCtx(ctx.jbCtx.innerParam(p, profile)), settings)]))
        if (this.impl == null) return compArgs
        if (typeof this.impl == 'function')
            this.impl.compFunc = true
        if (!this?.$resolvedInner)
            resolveCompArgs(this)
        return run(this.impl, ctx.setJbCtx(ctx.jbCtx.newComp(this,compArgs)), settings)
    }
}

class paramRunner {
    constructor(_param,compFullPath) {
        Object.assign(this,_param)
        this.path = `${compFullPath}~params~${_param.id}`
    }
    resolve(profile, creatorCtx, settings) {
        const doResolve = ctxToUse => {
            const innerProfile = ctxToUse.jbCtx.profile
            const value = innerProfile == null && this.defaultValue == null ? null 
                : innerProfile == null && this.defaultValue != null ? run(this.defaultValue, 
                    ctxToUse.setJbCtx(ctxToUse.jbCtx.paramDefaultValue(`${this.path}~defaultValue`, this)), settings )
                : run(innerProfile, ctxToUse, settings )
            return toRTType(this, value)
        }
        const creatorProfile = creatorCtx.jbCtx.profile
        const funcName = typeof creatorProfile == 'string' && creatorProfile.slice(0,30) 
            || creatorProfile?.$?.id || typeof creatorProfile == 'function' && 'js' || ''
        Object.defineProperty(doResolve, 'name', { value: `${funcName} ${creatorCtx.jbCtx.path}` })

        if (this.dynamic == true) {
            const res = (callerCtx, arrayIndex) => {
                const _creatorCtx = arrayIndex != null ? creatorCtx.setJbCtx(creatorCtx.jbCtx.innerArrayPath(arrayIndex)) : creatorCtx
                return doResolve(mergeDataCtx(_creatorCtx, callerCtx))
            }
            res.profile = profile[this.id] // use by pipeline
            res.creatorCtx = creatorCtx
            return res
        }                
        return doResolve(creatorCtx)

        function mergeDataCtx(_creatorCtx, callerCtx) {
            const creatorCtx = callerCtx ? _creatorCtx.setJbCtx(_creatorCtx.jbCtx.callCtx(callerCtx)) : _creatorCtx
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

Object.assign(jb.coreUtils, {run, Ctx, jbComp, resolveDelayed})
