import { testUtils } from './tester.js'
import { dsls, utils, coreUtils } from '../common/jb-common.js'
import { spy } from '../logger/spy.js'
import {} from './ui-dsl-for-tests.js'

export { dsls, utils, coreUtils }
const { test: { Test }} = dsls

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
					await utils.delay(_timeout)
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
					const _res = await utils.waitForInnerElements(res)
					return _res
				})()
			])
			let testFailure = testRes?.[0]?.testFailure || testRes?.testFailure
			const countersErr = testUtils.countersErrors(expectedCounters,allowError)
			const expectedResultCtx = ctxToUse.setData(testRes)
			const expectedResultRes = !testFailure && await expectedResult(expectedResultCtx)
			testFailure = expectedResultRes?.testFailure
			const success = !! (expectedResultRes && !countersErr && !testFailure)
			utils.log('check test result',{testRes, success,expectedResultRes, testFailure, countersErr, expectedResultCtx})
			result = { id: testID, success, reason: countersErr || testFailure, ...(includeTestRes ? testRes : {})}
		} catch (e) {
			utils.logException(e,'error in test',{ctx})
			result = { testID, success: false, reason: 'Exception ' + e}
		} finally {
			_spy && spy.setLogs('error')
			const doNotClean = ctx.probe || singleTest
			if (!doNotClean) await (!singleTest && cleanUp())
		} 
		return result
	}
})


