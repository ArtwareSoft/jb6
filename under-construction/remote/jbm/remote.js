import {} from '../../rx/rx.js'
import { callbag } from '../../rx/jb-callbag.js'
import { remoteUtils } from './jbm-utils.js'
import { jb, dsls, ns } from '../../core/tgp.js'
const {
  tgp: {  },
  rx: { RXOperator, RXSource },
  common: { 
    data: { waitFor },
  }
} = dsls
const { rx, source, sink, jbm } = ns

const { mergeProbeResult, prettyPrint, logError } = remoteUtils

RXSource('remote.source', {
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
        return pipe(rjbm.createCallbagSource(stripFunction(rx,{require})), 
          map(res => mergeProbeResult(ctx,res,rjbm.uri)) )
      })
    )
  })
})

RXOperator('remote.operator', {
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
        const stripedRx = stripFunction(rx,{require})
        const profText = prettyPrint(rx.profile)
        let counter = 0
        const varsMap = {}
        const cleanDataObjVars = map(dataObj => {
            if (typeof dataObj != 'object' || !dataObj.vars) return dataObj
            const vars = { ...Object.fromEntries(Object.entries(dataObj.vars).filter(e => shouldPassVar(e[0],profText))), messageId: ++counter } 
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
              map(res => mergeProbeResult(ctx,res,rjbm.uri)), 
              restoreDataObjVars
            )))
    }
})

Data('remote.waitForJbm',{
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
            return logError('remote waitForJbm - can not resolve jbm', {in: jb.uri, jbm, rjbm, jbmProfile: ctx.profile.jbm, ctx})
    }
})

Action('remote.action', {
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
            return logError('remote_action - can not find jbm', {in: jb.uri, jbm: ctx.profile.jbm, jb, ctx})
        if (jbm == jb) return action()
        const rjbm = await (await jbm).rjbm()
        if (!rjbm || !rjbm.remoteExec)
            return jb.logError('remote_action - can not resolve jbm', {in: jb.uri, jbm, rjbm, jbmProfile: ctx.profile.jbm, jb, ctx})
        const res = await rjbm.remoteExec(stripFunction(action,{require}),{timeout,oneway,isAction: true,action,ctx})
        return mergeProbeResult(ctx,res,rjbm.uri)
    }
})

Data('remote.data', {
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
            return logError('remote.data - can not find jbm', {in: jb.uri, jbm: ctx.profile.jbm, jb, ctx})
        const rjbm = await (await jbm).rjbm()
        if (!rjbm || !rjbm.remoteExec)
            return logError('remote.data - can not resolve jbm', {in: jb.uri, jbm, rjbm, jbmProfile: ctx.profile.jbm, jb, ctx})
                
        const res = await rjbm.remoteExec(stripFunction(data,{require}),{timeout,data,ctx})
        return mergeProbeResult(ctx,res,rjbm.uri)
    }
})

Action('remote.initShadowData', {
  description: 'shadow watchable data on remote jbm',
  params: [
    {id: 'src', as: 'ref'},
    {id: 'jbm', type: 'jbm<jbm>'}
  ],
  impl: rx.pipe(
    source.watchableData('%$src%', { includeChildren: 'yes' }),
    rx.map(obj(prop('op', '%op%'), prop('path', ({data}) => jb.dbUtils?.pathOfRef(data.ref)))),
    sink.action(remote_action(updateShadowData('%%'), '%$jbm%'))
  )
})

Action('remote.copyPassiveData', {
  description: 'shadow watchable data on remote jbm',
  params: [
    {id: 'resourceId', as: 'string'},
    {id: 'jbm', type: 'jbm<jbm>'}
  ],
  impl: runActions(
    Var('resourceCopy', '%${%$resourceId%}%'),
    remote.action({
      action: addComponent('%$resourceId%', '%$resourceCopy%', { type: 'passiveData' }),
      jbm: '%$jbm%'
    })
  )
})

Action('remote.shadowResource', {
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
      rx.map(obj(prop('op', '%op%'), prop('path', ({data}) => jb.dbUtils?.pathOfRef(data.ref)))),
      sink.action(remote_action(updateShadowData('%%'), '%$jbm%'))
    )
  )
})


Action('remote.updateShadowData', {
  description: 'internal - update shadow on remote jbm',
  params: [
    {id: 'entry'}
  ],
  impl: (ctx,{path,op}) => {
        jb.log('shadowData update',{op, ctx})
        const ref = jb.dbUtils?.refOfPath(path)
        if (!ref)
            logError('shadowData path not found at destination',{path, ctx})
        else
            jb.dbUtils?.doOp(ref, op, ctx)
    }
})

/*** net comps */
Data('remote.listSubJbms', {
  impl: pipe(
    () => Object.values(childJbms || {}),
    remote.data(listSubJbms(), '%%'),
    aggregate(list(() => uri, '%%'))
  )
})

Data('remote.getRootextentionUri', {
  impl: () => uri.split('•')[0]
})

Data('remote.listAll', {
  impl: remote_data({
    calc: pipe(
      Var('subJbms', listSubJbms(), { async: true }),
      () => Object.values(networkPeers || {}),
      remote.data(listSubJbms(), '%%'),
      aggregate(list('%$subJbms%','%%'))
    ),
    jbm: byUri(getRootextentionUri())
  })
})

// component('dataResource.yellowPages', { watchableData: {}})

// component('remote.useYellowPages', {
//     type: 'action<common>',
//     impl: runActions(
//         Var('yp','%$yellowPages%'),
//         remote_action(({},{yp}) => component('dataResource.yellowPages', { watchableData: yp }), '%$jbm%'),
//         remote.initShadowData('%$yellowPages%', '%$jbm%'),
//     )
// })
