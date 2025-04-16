export function log(logName, record, options) { enabled && doLog(logName, record, options) }

export function logError(err,logObj) {
  const { ctx } = logObj || {}
  const { tgpCtx: { callerStack, creatorStack }} = ctx || {}
  globalThis.window && globalThis.console.error('%c Error: ','color: red', err, logObj, callerStack, creatorStack)
  const errObj = { err , ...logObj, callerStack, creatorStack}
  globalThis.jbHost?.process && globalThis.jbHost.process.stderr.write(err)
  log('error', errObj)
}

export function logException(e,err,logObj) {
  globalThis.window && globalThis.console.log('%c Exception: ','color: red', err, e, logObj)
  const errObj = { e, err, stack: e.stack||'', ...logObj}
  globalThis.jbHost?.process && globalThis.jbHost.process.stderr.write(`${err}\n${e}`)
  log('exception error', errObj)
}

let enabled = false, spyParam, _obs
const logs = []
let counters = {}, locations = {}
let includeLogs = {error: true}
const settings = { 
    stackFilter: /spy|jb_spy|Object.log|rx-comps|jb-core|node_modules/i,
    MAX_LOG_SIZE: 10000
}

globalThis.spy = { logs, clear, log } // for console use

export function initSpy({spyParam: _spyParam}) {
    if (!spyParam) return
    spyParam = _spyParam
    enabled = true
    _obs = _obs || jb.callbag?.subject()
    calcIncludeLogsFromSpyParam()
    return spy
}

export function initSpyByUrl() {
    initSpy({spyParam : spyParamInUrl() })
}

function spyParamInUrl() {
    const getUrl = () => { try { return globalHost.location?.href } catch(e) {} }
    const getParentUrl = () => { try { return globalHost.parent?.location?.href } catch(e) {} }
    const getSpyParam = url => (url.match('[?&]spy=([^&]+)') || ['', ''])[1]
    return globalHost.jbUri == 'studio' && (getUrl().match('[?&]sspy=([^&]+)') || ['', ''])[1] || 
        getSpyParam(getParentUrl() || '') || getSpyParam(getUrl() || '')
}

const memoryUsage = () => globalThis.performance?.memory?.usedJSHeapSize
    
function calcIncludeLogsFromSpyParam() {
    const includeLogsFromParam = (spyParam || '').split(',').filter(x => x[0] !== '-').filter(x => x)
    const excludeLogsFromParam = (spyParam || '').split(',').filter(x => x[0] === '-').map(x => x.slice(1))
    includeLogs = includeLogsFromParam.filter(log => excludeLogsFromParam.indexOf(log) === -1).reduce((acc, log) => {
        acc[log] = true
        return acc
    }, {})
    includeLogs.error = true
}

function shouldLog(logNames, record) {
    const ctx = record && (record.ctx || record.srcCtx || record.cmp && record.cmp.ctx)
    if (ctx && ctx.vars.$disableLog || record.m?.$disableLog || record.m?.remoteRun.vars.$disableLog) return false
    if ((record.m?.routingPath||[]).find(y=>y.match(/vDebugger/))
        || (record.m?.result?.uri || '').match(/vDebugger/)) return false
    if (!logNames) debugger
    return spyParam === 'all' || typeof record == 'object' && 
        logNames.split(' ').reduce( (acc,logName)=>acc || includeLogs[logName],false)
}

function doLog(logNames, _record, {takeFrom} = {}) {
    updateCounters(logNames)
    updateLocations(logNames,takeFrom)
    if (!shouldLog(logNames, _record)) return
    const now = Date.now()
    const index = logs.length
    const { tgpCtx: { callerStack, creatorStack }} = _record?.ctx || {}
    const record = {
        logNames,
        ..._record,
        index,
        source: source(takeFrom),
        _time: `${now.getSeconds()}:${now.getMilliseconds()}`,
        mem: memoryUsage() / 1000000,
        callerStack, creatorStack,
        activeElem: globalThis.document?.activeElement,
        $attsOrder: _record && Object.keys(_record),
        time: now
    }
    if (logs.length > 0 && globalThis.document?.activeElement != logs[index-1].activeElem) {
        logs[index-1].logNames += ' focus'
        logs[index-1].activeElemAfter = record.activeElem
        logs[index-1].focusChanged = true
    }

    logs.push(record)
    if (logs.length > settings.MAX_LOG_SIZE *1.1)
        logs = logs.slice(-1* settings.MAX_LOG_SIZE)
    _obs?.next(record)
}

function source(takeFrom) {
    if (globalThis.Error)
        globalThis.Error.stackTraceLimit = 50
    const frames = [globalThis]
    let stackTrace = frames.reverse().filter(f=>frameAccessible(f)).map(frame => new frame.Error().stack).join('\n').split(/\r|\n/).map(x => x.trim()).slice(4).
        filter(line => line !== 'Error').
        filter(line => !settings.stackFilter.test(line))
    if (takeFrom) {
        const firstIndex = stackTrace.findIndex(line => line.indexOf(takeFrom) !== -1)
        stackTrace = stackTrace.slice(firstIndex + 1)
    }
    const line = stackTrace[0] || ''
    const res = [
        line.split(/at |as /).pop().split(/ |]/)[0],
        line.split('/').pop().slice(0, -1).trim(),
        ...stackTrace
    ]
    res.location = line.split(' ').slice(-1)[0].split('(').pop().split(')')[0]
    return res

    function frameAccessible(frame) { try { return Boolean(frame.document || frame.contentDocument || frame.global) } catch(e) { return false } }
}

function updateCounters(logNames) {
    counters[logNames] = counters[logNames] || 0
    counters[logNames]++
}

function updateLocations(logNames) {
    locations[logNames] = locations[logNames] || source().location
}
	
function clear() {
    logs.splice(0, logs.length)
	counters = {}
}


