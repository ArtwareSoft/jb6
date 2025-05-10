import { Data, Ctx } from '../../core/tgp.js'
import { coreUtils } from '../../core/core-utils.js'
import { callbag } from '../../rx/jb-callbag.js'
import { prettyPrint } from '../../formatter/pretty-print.js'

const { log, logError, calcPath, isCallbag, resolveProfile } = coreUtils
const allwaysPassVars = ['widgetId','disableLog','uiTest']
const MAX_ARRAY_LENGTH = 10000, MAX_OBJ_DEPTH = 100

function stripFunction(f, {require} = {}) {
    const {profile,runCtx,path,param,srcPath} = f
    if (!profile || !runCtx) return stripJS(f)
    const profText = [prettyPrint(profile, {noMacros: true}),require].filter(x=>x).join(';')
    const profNoJS = stripJSFromProfile(profile)
    if (require) profNoJS.require = require.split(',').map(x=>x[0] == '#' ? `jb.${x.slice(1)}()` : {$: x})
    const vars = Object.fromEntries(Object.entries(runCtx.vars).filter(e => shouldPassVar(e[0],profText))
        .map(e=>[e[0],stripData(e[1])]))
    const params = Object.fromEntries(Object.entries(runCtx.cmpCtx?.params).filter(e => profText.match(new RegExp(`\\b${e[0]}\\b`)))
        .map(e=>[e[0],stripData(e[1])]))
    let probe = null
    if (runCtx.probe && runCtx.probe.active && runCtx.probe.probePath.indexOf(srcPath) == 0) {
        const { probePath, maxTime, id } = runCtx.probe
        probe = { probePath, startTime: 0, maxTime, id, records: {}, visits: {}, active: true }
    }
    const usingData = usingData(profText)
    return Object.assign({$: 'runCtx', id: runCtx.id, path: [srcPath,path].filter(x=>x).join('~'), param, probe, profile: profNoJS, data: usingData ? stripData(runCtx.data) : null, vars}, 
        Object.keys(params).length ? {cmpCtx: {params} } : {})

}

function stripCtx(ctx) {
    if (!ctx) return null
    const isJS = typeof ctx.profile == 'function'
    const profText = prettyPrint(ctx.profile)
    const vars = Object.fromEntries(Object.entries(ctx.vars)
        .filter(e => shouldPassVar(e[0],profText))
        .map(e=>[e[0],stripData(e[1])]))
    const data = usingData(profText) && stripData(ctx.data)
    const params = Object.fromEntries(Object.entries(isJS ? ctx.params: Object.entries(ctx.cmpCtx?.params))
        .filter(e => profText.match(new RegExp(`\\b${e[0]}\\b`)))
        .map(e=>[e[0],stripData(e[1])]))
    const res = Object.assign({id: ctx.id, path: ctx.path, profile: ctx.profile, data, vars }, 
        isJS ? {params,vars} : Object.keys(params).length ? {cmpCtx: {params} } : {} )
    return res
}

function stripData(data, { top, depth, path} = {}) {
    if (data == null || (path||'').match(/parentNode$/)) return
    const innerDepthAndPath = key => ({depth: (depth || 0) +1, top: top || data, path: [path,key].filter(x=>x).join('~') })

    if (['string','boolean','number'].indexOf(typeof data) != -1) return data
    if (typeof data == 'function')
        return stripFunction(data)
    if (data instanceof Ctx)
        return stripCtx(data)
    if (depth > MAX_OBJ_DEPTH) {
        logError('stripData too deep object, maybe recursive',{top, path, depth, data})
        return
    }

    if (Array.isArray(data) && data.length > MAX_ARRAY_LENGTH)
        logError('stripData slicing large array',{data})
    if (Array.isArray(data))
        return data.slice(0,MAX_ARRAY_LENGTH).map((x,i)=>stripData(x, innerDepthAndPath(i)))
    if (typeof data == 'object' && ['DOMRect'].indexOf(data.constructor.name) != -1)
        return Object.fromEntries(Object.keys(data.__proto__).map(k=>[k,data[k]]))
    if (typeof data == 'object' && (calcPath(data.constructor,'name') || '').match(/Error$/))
        return {$$: 'Error', message: data.toString() }
    if (typeof data == 'object' && ['VNode','Object','Array'].indexOf(data.constructor.name) == -1)
        return { $$: data.constructor.name }
    if (typeof data == 'object')
        return Object.fromEntries(Object.entries(data)
            .filter(e=> data.$ || typeof e[1] != 'function') // if not a profile, block functions
            .map(e=>[e[0],stripData(e[1], innerDepthAndPath(e[0]) )]))
}

export function deStrip(data, _asIs) {
    if (typeof data == 'string' && data.match(/^@js@/))
        return eval(data.slice(4))
    const asIs = _asIs || (data && typeof data == 'object' && data.$$asIs)
    const stripedObj = data && typeof data == 'object' && Object.fromEntries(Object.entries(data).map(e=>[e[0],deStrip(e[1],asIs)]))
    if (stripedObj && data.$ == 'runCtx' && !asIs)
        return (ctx2,data2) => {
            const ctx = new Ctx(resolveProfile(stripedObj, {topComp: stripedObj}),{}).extendVars(ctx2,data2)
            const res = ctx.runItself()
            if (ctx.probe) {
                if (isCallbag(res))
                    return callbag.pipe(res, callbag.mapPromise(r=>waitAndWrapProbeResult(r,ctx.probe,ctx)))
                if (callbag.isCallbagOperator(res))
                    return source => callbag.pipe(res(source), callbag.mapPromise(r=>waitAndWrapProbeResult(r,ctx.probe,ctx)))

                return waitAndWrapProbeResult(res,ctx.probe,ctx)
            }
            return res
        }
    if (Array.isArray(data))
        return data.map(x=>deStrip(x,asIs))
    return stripedObj || data
}

async function waitAndWrapProbeResult(_res,probe,ctx) {
    const res = await _res
    await Object.values(probe.records).reduce((pr,valAr) => pr.then(
        () => valAr.reduce( async (pr,item,i) => { await pr; valAr[i].out = await valAr[i].out }, Promise.resolve())
    ), Promise.resolve())
    const filteredProbe = { ...probe, records: Object.fromEntries(Object.entries(probe.records).map(([k,v])=>[k,v.filter(x=>!x.sent)])) }
    Object.values(probe.records).forEach(arr=>arr.forEach(r => r.sent = true))
    const originalRecords = Object.fromEntries(Object.entries(probe.records).map(([k,v]) => [k,[...v]]))
    log('remote context wrapping probe result',{probe, originalRecords, filteredProbe, res, ctx})
    return { $: 'withProbeResult', res, probe: filteredProbe }
}

export function stripCBVars(cbData) {
    const res = stripData(cbData)
    if (res && res.vars)
        res.vars = Object.fromEntries(Object.entries(res.vars).filter(e=>e[0].indexOf('$')!=0))
    return res
}

function stripJSFromProfile(profile) {
    if (typeof profile == 'function')
        return `@js@${profile.toString()}`
    else if (Array.isArray(profile))
        return profile.map(val => stripJS(val))
    else if (typeof profile == 'object')
        return Object.fromEntries(Object.entries(profile).map(([id,val]) => [id, stripJS(val)]))
    return profile
}

function stripJS(val) {
    return typeof val == 'function' ? `@js@${val.toString()}` : stripData(val)
}

const shouldPassVar = (varName, profText) => allwaysPassVars.indexOf(varName) != -1 || profText.match(new RegExp(`\\b${varName.split(':')[0]}\\b`))
const usingData = profText => profText.match(/({data})|(ctx.data)|(%[^$])/)

function mergeProbeResult(ctx,res,from) {
    if (res?.$ == 'withProbeResult') {
        if (ctx.probe && res.probe) {
            Object.keys(res.probe.records||{}).forEach(k=>ctx.probe.records[k] = res.probe.records[k].map(x =>({...x, from})) )
            Object.keys(res.probe.visits||{}).forEach(k=>ctx.probe.visits[k] = res.probe.visits[k] )
        }
        log('merged probe result', {from, remoteProbeRes: res, records: res.probe.records})
        return res.res
    }
    return res
}

export function markProbeRecords(probe,prop) {
    probe && Object.values(probe.records||{}).forEach(x => x[prop] = true)
}

const mergeProbeResult = Data({
    promote: 0,
    params: [
        {id: 'remoteResult', byName: true },
        {id: 'from', as: 'string'}
    ],
    impl: (ctx,{remoteResult,from}) => {
        if (remoteResult?.$ == 'withProbeResult') {
            const { records, visits } = remoteResult.probe
            if (ctx.probe) {
              Object.keys(records||{}).forEach(k=>ctx.probe.records[k] = records[k].map(x =>({...x, from})) )
              Object.keys(visits||{}).forEach(k=>ctx.probe.visits[k] = visits[k] )
            }
            log('merged probe result', {from, remoteResult, records })
            return remoteResult.res
        }
        return remoteResult
    }
})

const varsUsed = Data({
  promote: 0,
  params: [
    {id: 'profile' }
  ],
  impl: (ctx, {profile}) => {
    const profText = prettyPrint(profile||'', {noMacros: true})
    return (profText.match(/%\$[a-zA-Z0-9_]+/g) || []).map(x=>x.slice(2))
  }
})

export const remoteCtx = { varsUsed, mergeProbeResult }
