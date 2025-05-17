/* jbm - a virtual jBart machine - can be implemented in same frame/sub frames/workers over the network
interface jbm : {
     uri : string // devtools•logPanel, studio•preview•debugView, •debugView
     parent : jbm // null means root
     remoteExec(profile: any ,{timeout,oneway}) : Promise | void
     createCallbagSource(stripped ctx of cb_source) : cb
     createCallbagOperator(stripped ctx of cb_operator, {profText}) : (source => cb)
}
jbm interface can be implemented on the actual jb object or a jbm proxy via port

// port is used to send messages between two jbms
interface port {
     from: uri
     to: uri
     postMessage(m)
     onMessage({addListener(handler(m))})
     onDisconnect({addListener(handler)})
}
implementatios over frame(window,worker), websocket, connection 

Routing is implemented by remoteRoutingPort, first calclating the routing path, and sending to the message hop by hop to the destination.
The routing path is reversed to create response message
*/
import { dsls, coreUtils } from '../../core/all.js'
import { utils } from '../../common/jb-common.js'
import { remoteUtils } from './remote-context.js'

const { asArray, delay, log, logError, calcPath } = coreUtils
const { varsUsed, mergeProbeResult, deStrip, stripCBVars, stripData, markProbeRecords, stripJS, stripFunction } = remoteUtils
const {
    common: { 
        data: { waitFor },
    }
} = dsls

jb.remoteRegistry = { 
    cbCounter: 0, 
    cbMap: {},
    ports: {},
    childJbms: {}, 
    networkPeers: {}, 
    notifyChildReady: {}
}

Object.assign(jb.remoteUtils, { remoteExec, terminateAllChildren, portFromFrame, extendPortToJbmProxy })

const registry = jb.remoteRegistry
const cbHandlers = jb.remoteRegistry.cbMap
const ports = jb.remoteRegistry.ports

function newCBId() {
    return jb.uri + ':' + (jb.cbHandlerRegistry.cbCounter++)
}

async function getAsPromise(id,t) { 
    if (cbHandlers[id] && cbHandlers[id].terminated)
        return
    try {
        const cb = waitFor.$run({check: ()=> cbHandlers[id], interval: 5, times: 10})
        if (t == 2) removeEntry(id)
        return cb
    } catch(err) {
        if (!jb.terminated)
            logError('cbLookUp - can not find cb',{id, in: jb.uri})
    }
}

function addToLookup(cb) { 
    const id = newCBId()
    cbHandlers[id] = cb
    return id 
}

async function removeEntry(ids, m, _delay=10) {
    log(`remote remove cb handlers at ${jb.uri}`,{ids,m})
    await delay(_delay) // TODO: BUGGY delay - keep alive as sink talkback may want to send 1. think how to know when sink got 2.
    asArray(ids).filter(x=>x).forEach(id => cbHandlers[id].terminated = true)
}

function terminate() {
    Object.keys(cbHandlers).forEach(k=>delete cbHandlers[k])
}

// net
function reverseRoutingProps(routingMsg) {
    if (!routingMsg) return
    const rPath = routingMsg.routingPath && {
        routingPath: routingMsg.routingPath.slice(0).reverse(),
        from: routingMsg.to,
        to: routingMsg.from,
        $disableLog: calcPath(routingMsg,'remoteRun.vars.$disableLog')
    }
    const diableLog = calcPath(routingMsg,'remoteRun.vars.$disableLog') && {$disableLog: true}
    return { ...rPath, ...diableLog}
}

function handleOrRouteMsg(from,to,handler,m, {blockContentScriptLoop} = {}) {
    if (jb.terminated) {
        log(`remote messsage arrived to terminated ${from}`,{from,to, m})
        return
    }
//            log(`remote handle or route at ${from}`,{m})
    if (blockContentScriptLoop && m.routingPath && m.routingPath.join(',').indexOf([from,to].join(',')) != -1) return
    const arrivedToDest = m.routingPath && m.routingPath.slice(-1)[0] === jb.uri || (m.to == from && m.from == to)
    if (arrivedToDest) {
        log(`transmit remote received at ${from} from ${m.from} to ${m.to}`,{m})
        handler && handler(m)
    } else if (m.routingPath) {
        const path = m.routingPath
        const indexOfNextPort = path.indexOf(jb.uri)+1
        let nextPort = indexOfNextPort && ports[path[indexOfNextPort]]
        if (!nextPort && jb.remoteRegistry.gateway) {
            path.splice(path.indexOf(jb.uri),0,jb.remoteRegistry.gateway.uri)
            nextPort = jb.remoteRegistry.gateway
            log(`remote gateway injected to routingPath at ${from} from ${m.from} to ${m.to} forward to ${nextPort.to}`,{nextPort, m })
        }
        if (!nextPort)
            return logError(`remote - no destination found and no gateway at ${from} from ${m.from} to ${m.to}`,{ m })
        log(`remote forward at ${from} from ${m.from} to ${m.to} forward to ${nextPort.to}`,{nextPort, m })
        nextPort.postMessage(m)
    }            
}

async function remoteExec(sctx) {
    // used by child jbm
    //await jb.treeShake.codeServerJbm && jb.treeShake.bringMissingCode(sctx)
    return utils.waitForInnerElements(deStrip(sctx)())
}

function portFromFrame(frame, to,options) {
    if (ports[to]) return ports[to]
    const from = jb.uri
    const port = {
            frame, from, to, handlers: [],
            postMessage: _m => {
                const m = {from, to,..._m}
                log(`transmit remote sent from ${from} to ${to}`,{m})
                frame.postMessage(m) 
            },
            onMessage: { addListener: handler => { 
                function h(m) { handleOrRouteMsg(from,to,handler,m.data,options) }
                port.handlers.push(h); 
                return frame.addEventListener('message', h) 
            }},
            onDisconnect: { addListener: handler => { port.disconnectHandler = handler} },
            terminate() {
                port.handlers.forEach(h=>frame.removeEventListener('message',h))
            }
        }
        ports[to] = port
        return port
}

function extendPortToJbmProxy(port,{doNotinitCommandListener} = {}) {
    if (port && !port.createCalllbagSource) {
        Object.assign(port, {
            uri: port.to,
            rjbm() { return this },
            createCallbagSource(remoteRun) {
                const cbId = newCBId()
                port.postMessage({$:'CB.createSource', remoteRun, cbId })
                return (t,d) => outboundMsg({cbId,t,d})
            },
            createCallbagOperator(remoteRun) {
                return source => {
                    const sourceId = addToLookup(Object.assign(source,{remoteRun}))
                    const cbId = newCBId()
                    port.postMessage({$:'CB.createOperator', remoteRun, sourceId, cbId })
                    return (t,d) => {
                        log('remote callbag operator send',{t,d, remoteRun, cbId})
                        if (t == 2) console.log('send 2',cbId,sourceId)
                        outboundMsg({cbId,t,d})
                    }
                }
            },
            remoteExec(remoteRun, {oneway, timeout = 5000, isAction, ctx} = {}) {
                if (oneway)
                    return port.postMessage({$:'CB.execOneWay', remoteRun, timeout })
                return new Promise((resolve,reject) => {
                    const handlers = cbHandlers
                    const cbId = newCBId()
                    const timer = setTimeout(() => {
                        if (!handlers[cbId] || handlers[cbId].terminated) return
                        const err = { type: 'error', desc: 'remote exec timeout', remoteRun, timeout }
                        logError('remote exec timeout',{timeout, uri: jb.uri, h: handlers[cbId]})
                        handlers[cbId] && reject(err)
                    }, timeout)
                    handlers[cbId] = {resolve,reject,remoteRun, timer}
                    log('remote exec request',{remoteRun,port,oneway,cbId})
                    port.postMessage({$:'CB.exec', remoteRun, cbId, isAction, timeout })
                })
            }
        })
        if (!doNotinitCommandListener)
            initCommandListener()
    }
    return port

    function initCommandListener() {
        port.onMessage.addListener(m => {
            if (jb.terminated) return // TODO: removeEventListener
            log(`remote command from ${m.from} ${m.$}`,{m})
            if ((m.$ || '').indexOf('CB.') == 0)
                handleCBCommand(m)
            else if (m.$ == 'CB')
                inboundMsg(m)
            else if (m.$ == 'execResult')
                inboundExecResult(m)
        })
    }

    function outboundMsg({cbId,t,d}) {
        port.postMessage({$:'CB', cbId,t, d: t == 0 ? addToLookup(d) : d })
    }
    async function inboundMsg(m) {    
        const {cbId,t,d} = m
        log('remote callbag source/operator',{t,d, cbId})
        if (t == 2) removeEntry(cbId,m)
        const cb = await getAsPromise(cbId,t)
        if (!jb.terminated && cb)
            cb(t, t == 0 ? remoteCB(d,cbId,m) : d)
    }
    async function inboundExecResult(m) { 
        const h = await getAsPromise(m.cbId)
        if (jb.terminated) return
        if (!h) 
            return logError('remote exec result arrived with no handler',{cbId:m.cbId, m})
        clearTimeout(h.timer)
        if (m.type == 'error') {
            logError('remote remoteExec', {m, h})
            h.reject(m)
        } else {
            h.resolve(m.result)
        }
        removeEntry(m.cbId,m)
    }

    function remoteCB(cbId, localCbId, routingMsg) { 
        let talkback
        return (t,d) => {
            if (t==2) removeEntry([localCbId,talkback],routingMsg)
            //if (t == 1 && !d) return
            port.postMessage({$:'CB', cbId,t, d: t == 0 ? (talkback = addToLookup(d)) : stripCBVars(d), ...reverseRoutingProps(routingMsg) }) 
        }
    }

    async function handleCBCommand(cmd) {
        const {$,sourceId,cbId,isAction} = cmd
        try {
            if (jb.treeShake.codeServerJbm) {
                if (Object.keys(jb.treeShake.loadingCode || {}).length) {
                    log('remote waiting for loadingCode',{cmd, loading: Object.keys(jb.treeShake.loadingCode)})
                    await waitFor.$run({timeout: 100, check: () => !Object.keys(jb.treeShake.loadingCode).length })
                }
                await jb.treeShake.bringMissingCode(cmd.remoteRun)
            }
            log('remote handleCBCommand',{cmd})
            const deStrip = deStrip(cmd.remoteRun)
            const deStripResult = await (typeof deStrip == 'function' ? deStrip() : deStrip)
            const {result, actualResult, probe} = await waitForResult(deStripResult)
            if ($ == 'CB.createSource' && typeof actualResult == 'function') {
                markProbeRecords(probe, 'initSource')
                cbHandlers[cbId] = actualResult
            } else if ($ == 'CB.createOperator' && typeof actualResult == 'function') {
                markProbeRecords(probe, 'initOperator')
                cbHandlers[cbId] = actualResult(remoteCB(sourceId, cbId,cmd) ) // bind to source
            } else if ($ == 'CB.exec') {
                const resultToReturn = isAction ? (probe ? {$: 'withProbeResult', probe} : {}) : stripData(result)
                port.postMessage({$:'execResult', cbId, result: resultToReturn , ...reverseRoutingProps(cmd) })
            }
        } catch(err) { 
            logException(err,'remote handleCBCommand',{cmd})
            $ == 'CB.exec' && port.postMessage({$:'execResult', cbId, result: { type: 'error', err}, ...reverseRoutingProps(cmd) })
        }
        async function waitForResult(result) {
            const res = result?.$ ? result.res : result
            const actualResult = $ == 'CB.exec' ? await utils.waitForInnerElements(res) : res
            const probe = result?.$ ? result.probe : null
            return {result: probe ? {...result, res: actualResult } : actualResult, actualResult, probe}
        }
    }
}
    
async function terminateChild(id,ctx,childsOrNet= registry.childJbms) {
        if (!childsOrNet[id]) return
        const childJbm = await childsOrNet[id]
        if (!childJbm) return
        const rjbm = await childJbm.rjbm()
        rjbm.terminated = childJbm.terminated = true
        log('remote terminate child', {id})
        Object.keys(ports).filter(x=>x.indexOf(childJbm.uri) == 0).forEach(uri=>{
                if (ports[uri].terminate)
                    ports[uri].terminate()
                delete ports[uri]
            })
        delete childsOrNet[id]
        rjbm.remoteExec(stripJS(() => {terminate(); terminated = true; if (typeof close1 == 'function') close() } ), {oneway: true, ctx} )
        return rjbm.remoteExec(stripJS(async () => {
            terminate()
            jb.terminated = true
            if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope)
                jb.delay(100).then(() => close()) // close worker
            return 'terminated' 
        }), { oneway: true, ctx} )
}

function terminateAllChildren(ctx) {
    return Promise.all([
        ...Object.keys(registry.childJbms||{}).map(id=>terminateChild(id,ctx, registry.childJbms)),
        ...Object.keys(registry.networkPeers||{}).map(id=>terminateChild(id,ctx, registry.networkPeers)),
    ])
}

