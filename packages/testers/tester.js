import { coreUtils, dsls } from '@jb6/core'
import {} from '@jb6/common'
import { spy } from './spy.js'

const { Ctx, jb, log, logException, asJbComp, delay, waitForInnerElements } = coreUtils

const { 
  tgp: {TgpType}
} = dsls

const Test = TgpType('test', 'test')

export const testUtils = jb.testUtils = { countersErrors, runTest}

function countersErrors(expectedCounters,allowError) {
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
// onInjectExtension('tests', ext => {
//     if (ext.cleaners)
//         cleaners = [...cleaners, ...ext.cleaners]
// })

async function cleanBeforeRun() {
    cleaners.forEach(c=>c())
    if (!spy.isEnabled())
        spy.initSpy({spyParam: 'test'})
    spy.clear()
}

async function runTest(testID, {fullTestId, singleTest} = {}) {
    !singleTest && await cleanBeforeRun()
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

Test('dataTest', {
  params: [
    {id: 'calculate', type:'data', dynamic: true},
    {id: 'expectedResult', type: 'boolean', dynamic: true},
    {id: 'runBefore', type: 'action', dynamic: true},
    {id: 'timeout', as: 'number', defaultValue: 200},
    {id: 'allowError', as: 'boolean', dynamic: true, type: 'boolean'},
    {id: 'cleanUp', type: 'action', dynamic: true},
    {id: 'expectedCounters', as: 'single'},
    {id: 'spy', as: 'string'},
    {id: 'includeTestRes', as: 'boolean', type: 'boolean'},
    {id: 'covers', as: 'array'},
  ],
  impl: async function(ctx,{ calculate,expectedResult,runBefore,timeout,allowError,cleanUp,expectedCounters,spy: _spy,includeTestRes }) {
		const ctxToUse = ctx.vars.testID ? ctx : ctx.setVars({testID:'unknown'})
		const {testID,singleTest,uiTest}  = ctxToUse.vars
		const remoteTimeout = testID.match(/([rR]emote)|([wW]orker)|(jbm)/) ? 5000 : null
		const _timeout = singleTest ? Math.max(1000,timeout) : (remoteTimeout || timeout)
		_spy && spy.setLogs(_spy+',error')
		let result = null
		try {
			const testRes = await Promise.race([ 
				(async() => {
					await delay(_timeout)
					return {testFailure: `timeout ${_timeout}mSec`}
				})(),
				(async() => {
					await runBefore(ctxToUse)
					let res
					try {
						res = await calculate(ctxToUse)
					} catch (e) {
						res = [{testFailure: e}]	
					}
					const _res = await waitForInnerElements(res)
					return _res
				})()
			])
			let testFailure = testRes?.[0]?.testFailure || testRes?.testFailure
			const countersErr = testUtils.countersErrors(expectedCounters,allowError)
			const expectedResultCtx = ctxToUse.setData(testRes)
			const expectedResultRes = !testFailure && await expectedResult(expectedResultCtx)
			testFailure = expectedResultRes?.testFailure
			const success = !! (expectedResultRes && !countersErr && !testFailure)
			log('check test result',{testRes, success,expectedResultRes, testFailure, countersErr, expectedResultCtx})
			result = { id: testID, success, reason: countersErr || testFailure, ...(includeTestRes ? testRes : {})}
		} catch (e) {
			logException(e,'error in test',{ctx})
			result = { testID, success: false, reason: 'Exception ' + e}
		} finally {
			_spy && spy.setLogs('error')
			const doNotClean = ctx.probe || singleTest
			if (!doNotClean) await (!singleTest && cleanUp())
		} 
		return result
	}
})