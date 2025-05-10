import { RXSource, RXOperator, rx, source, sink } from '../../rx/rx.js'
import { callbag } from '../../rx/jb-callbag.js'
import { jbm, childJbms, uri, networkPeers } from './jbm.js'

const remote_source = RXSource({
  params: [
    {id: 'rx', type: 'rx<>', dynamic: true},
    {id: 'jbm', type: 'jbm<jbm>', defaultValue: jbm.self()},
    {id: 'require', as: 'string'}
  ],
  impl: If({
    condition: jbm.isSelf('%$jbm%'),
    then: '%$rx()%',
    Else: rx.pipe(
      source.promise('%$jbm%'),
      rx.mapPromise('%rjbm()%'),
      rx.concatMap((ctx,{},{rx,require}) => {
        const rjbm = ctx.data
        const { pipe, map } = callbag
        return pipe(rjbm.createCallbagSource(jb.remoteCtx.stripFunction(rx,{require})), 
          map(res => jb.remoteCtx.mergeProbeResult(ctx,res,rjbm.uri)) )
      })
    )
  })
})

const remote_operator = RXOperator({
  type: 'rx<>',
  params: [
    {id: 'rx', type: 'rx<>', dynamic: true},
    {id: 'jbm', type: 'jbm<jbm>', defaultValue: jbm.self()},
    {id: 'require', as: 'string'}
  ],
  impl: (ctx,{rx,jbm,require}) => {
        const { map, mapPromise, pipe, fromPromise, concatMap, replay} = callbag
        if (!jbm)
            return jb.logError('remote.operator - can not find jbm', {in: jb.uri, jbm: ctx.profile.jbm, jb, ctx})
        if (jbm == jb) return rx()
        const stripedRx = jb.remoteCtx.stripFunction(rx,{require})
        const profText = jb.utils.prettyPrint(rx.profile)
        let counter = 0
        const varsMap = {}
        const cleanDataObjVars = map(dataObj => {
            if (typeof dataObj != 'object' || !dataObj.vars) return dataObj
            const vars = { ...jb.objFromEntries(jb.entries(dataObj.vars).filter(e => jb.remoteCtx.shouldPassVar(e[0],profText))), messageId: ++counter } 
            varsMap[counter] = dataObj.vars
            return { data: dataObj.data, vars}
        })
        const restoreDataObjVars = map(dataObj => {
            const origVars = varsMap[dataObj.vars.messageId] 
            varsMap[dataObj.messageId] = null
            return origVars ? {data: dataObj.data, vars: Object.assign(origVars,dataObj.vars) } : dataObj
        })
        return source => pipe( fromPromise(jbm), mapPromise(_jbm=>_jbm.rjbm()),
            concatMap(rjbm => pipe(
              source, replay(5), cleanDataObjVars, rjbm.createCallbagOperator(stripedRx), 
              map(res => jb.remoteCtx.mergeProbeResult(ctx,res,rjbm.uri)), 
              restoreDataObjVars
            )))
    }
})

const remote_waitForJbm = Data({
  description: 'wait for jbm to be available',
  params: [
    {id: 'jbm', type: 'jbm<jbm>', defaultValue: jbm.self()},
  ],
  impl: async (ctx,{jbm}) => {
        if (!jbm)
            return jb.logError('remote waitForJbm - can not find jbm', {in: jb.uri, jbm: ctx.profile.jbm, ctx})
        if (jbm == jb) return
        const rjbm = await (await jbm).rjbm()
        if (!rjbm || !rjbm.remoteExec)
            return jb.logError('remote waitForJbm - can not resolve jbm', {in: jb.uri, jbm, rjbm, jbmProfile: ctx.profile.jbm, ctx})
    }
})

const remote_action = Action({
  description: 'exec a script on a remote node and returns a promise if not oneWay',
  params: [
    {id: 'action', type: 'action<common>', dynamic: true, composite: true},
    {id: 'jbm', type: 'jbm<jbm>', defaultValue: jbm.self()},
    {id: 'oneway', as: 'boolean', description: 'do not wait for the respone', type: 'boolean'},
    {id: 'timeout', as: 'number', defaultValue: 10000},
    {id: 'require', as: 'string'}
  ],
  impl: async (ctx,{action,jbm,oneway,timeout,require}) => {
        if (!jbm)
            return jb.logError('remote_action - can not find jbm', {in: jb.uri, jbm: ctx.profile.jbm, jb, ctx})
        if (jbm == jb) return action()
        const rjbm = await (await jbm).rjbm()
        if (!rjbm || !rjbm.remoteExec)
            return jb.logError('remote_action - can not resolve jbm', {in: jb.uri, jbm, rjbm, jbmProfile: ctx.profile.jbm, jb, ctx})
        const res = await rjbm.remoteExec(jb.remoteCtx.stripFunction(action,{require}),{timeout,oneway,isAction: true,action,ctx})
        return jb.remoteCtx.mergeProbeResult(ctx,res,rjbm.uri)
    }
})

const remote_data = Data({
  description: 'calc a script on a remote node and returns a promise',
  params: [
    {id: 'calc', dynamic: true},
    {id: 'jbm', type: 'jbm<jbm>', defaultValue: jbm.self()},
    {id: 'timeout', as: 'number', defaultValue: 10000},
    {id: 'require', as: 'string'}
  ],
  impl: async (ctx,{data,jbm,timeout,require}) => {
        if (jbm == jb)
            return data()
        if (!jbm)
            return jb.logError('remote.data - can not find jbm', {in: jb.uri, jbm: ctx.profile.jbm, jb, ctx})
        const rjbm = await (await jbm).rjbm()
        if (!rjbm || !rjbm.remoteExec)
            return jb.logError('remote.data - can not resolve jbm', {in: jb.uri, jbm, rjbm, jbmProfile: ctx.profile.jbm, jb, ctx})
                
        const res = await rjbm.remoteExec(jb.remoteCtx.stripFunction(data,{require}),{timeout,data,ctx})
        return jb.remoteCtx.mergeProbeResult(ctx,res,rjbm.uri)
    }
})

const initShadowData = Action({
  description: 'shadow watchable data on remote jbm',
  params: [
    {id: 'src', as: 'ref'},
    {id: 'jbm', type: 'jbm<jbm>'}
  ],
  impl: rx.pipe(
    source.watchableData('%$src%', { includeChildren: 'yes' }),
    rx.map(obj(prop('op', '%op%'), prop('path', ({data}) => jb.db.pathOfRef(data.ref)))),
    sink.action(remote_action(updateShadowData('%%'), '%$jbm%'))
  )
})

const copyPassiveData = Action({
  description: 'shadow watchable data on remote jbm',
  params: [
    {id: 'resourceId', as: 'string'},
    {id: 'jbm', type: 'jbm<jbm>'}
  ],
  impl: runActions(
    Var('resourceCopy', '%${%$resourceId%}%'),
    remote_action({
      action: addComponent('%$resourceId%', '%$resourceCopy%', { type: 'passiveData' }),
      jbm: '%$jbm%'
    })
  )
})

const shadowResource = Action({
  description: 'shadow watchable data on remote jbm',
  params: [
    {id: 'resourceId', as: 'string'},
    {id: 'jbm', type: 'jbm<jbm>'}
  ],
  impl: runActions(
    Var('resourceCopy', '%${%$resourceId%}%'),
    remote_action({
      action: runActions(
        () => 'for loader - jb.watchable.initResourcesRef()',
        addComponent('%$resourceId%', '%$resourceCopy%', { type: 'watchableData' })
      ),
      jbm: '%$jbm%'
    }),
    rx.pipe(
      source.watchableData('%${%$resourceId%}%', { includeChildren: 'yes' }),
      rx.map(obj(prop('op', '%op%'), prop('path', ({data}) => jb.db.pathOfRef(data.ref)))),
      sink.action(remote_action(updateShadowData('%%'), '%$jbm%'))
    )
  )
})


const updateShadowData = Action({
  description: 'internal - update shadow on remote jbm',
  params: [
    {id: 'entry'}
  ],
  impl: (ctx,{path,op}) => {
        jb.log('shadowData update',{op, ctx})
        const ref = jb.db.refOfPath(path)
        if (!ref)
            jb.logError('shadowData path not found at destination',{path, ctx})
        else
            jb.db.doOp(ref, op, ctx)
    }
})

/*** net comps */
const listSubJbms = Data({
  impl: pipe(
    () => Object.values(childJbms || {}),
    remote_data(listSubJbms(), '%%'),
    aggregate(list(() => uri, '%%'))
  )
})

const getRootextentionUri = Data({
  impl: () => uri.split('•')[0]
})

const listAll = Data({
  impl: remote_data({
    calc: pipe(
      Var('subJbms', listSubJbms(), { async: true }),
      () => Object.values(networkPeers || {}),
      remote_data(listSubJbms(), '%%'),
      aggregate(list('%$subJbms%','%%'))
    ),
    jbm: byUri(getRootextentionUri())
  })
})

export const remote = { source: remote_source, data: remote_data, action: remote_action, operator: remote_operator, listAll, shadowResource }
// component('dataResource.yellowPages', { watchableData: {}})

// component('remote.useYellowPages', {
//     type: 'action<common>',
//     impl: runActions(
//         Var('yp','%$yellowPages%'),
//         remote_action(({},{yp}) => component('dataResource.yellowPages', { watchableData: yp }), '%$jbm%'),
//         remote.initShadowData('%$yellowPages%', '%$jbm%'),
//     )
// })
