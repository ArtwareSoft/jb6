import { component, Ctx, jb } from '../core/jb-core'
import { log } from '../core/logger'
import { spy } from '../logger/spy'

export function Test(id, comp, {plugin} = {}) {
    return Component(id,{...comp, type: 'test'}, {plugin, dsl:''})
}

export function countersErrors(expectedCounters,allowError) {
    if (!spy.isEnabled()) return ''
    const exception = spy.logs.find(r=>r.logNames.indexOf('exception') != -1)
    const error = spy.logs.find(r=>r.logNames.indexOf('error') != -1)
    if (exception) return exception.err
    if (!allowError() && error) return error.err

    return Object.keys(expectedCounters || {}).map(
        exp => expectedCounters[exp] != spy.count(exp)
            ? `${exp}: ${spy.count(exp)} instead of ${expectedCounters[exp]}` : '')
        .filter(x=>x)
        .join(', ')
}

let cleaners = []
onInjectExtension('tests', ext => {
    if (ext.cleaners)
        cleaners = [...cleaners, ...ext.cleaners]
})

async function cleanBeforeRun() {
    cleaners.forEach(c=>c())
    if (!spy.isEnabled() && !spy.spyParamInUrl())
        spy.initSpy({spyParam: 'test'})
    spy.clear()
}

export async function runTest(testID,{fullTestId, singleTest} = {}) {
    const profile = jb.comps[fullTestId]
    const tstCtx = new Ctx().setVars({ testID, fullTestId,singleTest })
    const start = Date().now()
    await !singleTest && cleanBeforeRun()
    log('start test',{testID})
    let res = null
    try {
        res = await tstCtx.run({$:fullTestId})
    } catch (e) {
        res = { success: false, reason: e}
    }
    res.duration = Date().now() - start
    log('end test',{testID,res})
    if (!singleTest && !profile.doNotTerminateWorkers)
        await jb.jbm?.terminateAllChildren(tstCtx)		
    return res
}