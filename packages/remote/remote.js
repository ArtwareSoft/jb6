import { dsls, coreUtils, ns } from '@jb6/core'

const { 
    tgp: { TgpType },
    common: { Data } 
} = dsls
const { compIdOfProfile} = coreUtils

const Jbm = TgpType('jbm','remote')

Jbm('jbm.self', {
    impl: () => 'jbm.self'
})
const { jbm } = ns

Date('remote.data', {
    description: 'calc a script on a remote node and returns a promise',
    params: [
      {id: 'calc', dynamic: true},
      {id: 'jbm', type: 'jbm<remote>', defaultValue: jbm.self()},
      {id: 'timeout', as: 'number', defaultValue: 10000},
      {id: 'require', as: 'string'}
    ],
    impl: async (ctx,{calc,jbm,timeout}) => {
          if (jbm == 'jbm.self')
              return calc()
          if (!jbm)
              return logError('remote.data - can not find jbm', {in: jb.uri, jbm, jb, ctx})
          const rjbm = await (await jbm).rjbm()
          if (!rjbm || !rjbm.remoteExec)
              return logError('remote.data - can not resolve jbm', {in: jb.uri, jbm, rjbm, jbmProfile: ctx.jbCtx.profile.jbm, jb, ctx})
                  
          const res = await rjbm.remoteExec(calc.profile, {timeout,calc,ctx})
          return res
      }
})
  
Jbm('jbm.rpc', {
    params: [
        {id: 'port', as: 'number'},
        {id: 'host', as: 'string', defaultValue: 'localhost'}
    ],
    impl: (ctx, {port,host}) => ({
        rjbm: {
            remoteExec: async ({profile} ,{oneway} = {}) => {
                const payload = JSON.stringify({ 
                    jsonrpc: '2.0', 
                    ...(oneway ? {} : { id: Math.random().toString(36).slice(2) } ),
                    method: compIdOfProfile(profile), params: {...profile, $: undefined, $$: undefined} }, null, 2)
                try {
                  const res = await fetch(`http://${host}:${port}/rpc`, { method: 'POST', body: payload, headers: { 'Content-Type': 'application/json' } })
                  if (res.status === 204) {
                    return {}; // Return an empty object for 204 No Content
                  }
                  return oneway ? {} : res.json()
                }
                catch (err) {
                  return logError('remote.data cannot reach jbm.rpcAutoStart', { err, host, port })
                }
            }
        }
    })  
})

// Jbm('jbm.rpcAutoStart', {
//     params: [
//         {id: 'port', as: 'number'},
//         {id: 'host', as: 'string'},
//         {id: 'entryPoints', as: 'string'},
//         {id: 'serverName', as: 'string', defaultValue: 'JB6 RPC Server'},
//     ],
//     impl: async ({ port, host, entryPoints, serverName }) => {
//         const rpcUrl = `http://${host}:${port}/rpc`
//         let serverStarted = false
      
//         function isServerDownError(err) {
//           return err instanceof TypeError
//         }
      
//         async function remoteExec({ profile }, { oneway } = {}) {
//           const payload = JSON.stringify({ jsonrpc: '2.0', method: compIdOfProfile(profile), params: profile  })
//           try {
//             const res = await fetch(rpcUrl, { method: 'POST', body: payload })
//             return oneway ? res : res.json()
//           }
//           catch (err) {
//             if (isServerDownError(err) && !serverStarted) {
//               jb.log('RPC server not responding — launching it now', { host, port, entryPoints, serverName })
//               await startDedicatedRpcServer({ port, entryPoints, serverName })
//               serverStarted = true
      
//               const retry = await fetch(rpcUrl, { method: 'POST', body: payload })
//               return oneway ? retry : retry.json()
//             }
//             return logError('remote.data – cannot reach jbm.rpcAutoStart', { err, host, port, serverName })
//           }
//         }
      
//         return { rjbm: { remoteExec } }
//       }
// })
