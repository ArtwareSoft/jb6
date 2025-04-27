import { Ctx, jb, onInjectExtension, TgpType } from '../core/tgp.js'
import { log } from '../core/logger.js'
import { spy } from '../logger/spy.js'
import { asJbComp } from '../core/jb-macro.js'

export const Test = TgpType('test')
export const Usage = TgpType('test', {doNotRunInTests: true})

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
    if (!spy.isEnabled())
        spy.initSpy({spyParam: 'test'})
    spy.clear()
}

export async function runTest(testID,{fullTestId, singleTest} = {}) {
    await !singleTest && cleanBeforeRun()
    const jbComp = Test[testID][asJbComp]
    log('start test',{testID})
    let res = null
    const start = Date.now()
    try {
        const ctx = new Ctx().setVars({ testID, fullTestId,singleTest })
        res = await jbComp.runProfile({}, ctx)
    } catch (e) {
        res = { success: false, reason: e}
    }
    res.duration = Date.now() - start
    log('end test',{testID,res})
    if (!singleTest && !jbComp.doNotTerminateWorkers)
        await jb.jbm?.terminateAllChildren(tstCtx)		
    return res
}