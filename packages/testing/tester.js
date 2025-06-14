import { coreUtils, dsls } from '@jb6/core'
import '@jb6/common'
import { spy } from './spy.js'

const { Ctx, jb, log, logException, asJbComp, delay, waitForInnerElements, globalsOfType, unique, isNode } = coreUtils

const { 
  tgp: {TgpType}
} = dsls

const Test = TgpType('test', 'test')

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
			const countersErr = countersErrors(expectedCounters,allowError)
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

// run tests

globalThis.spy = spy
globalThis.jb = jb

export async function runTest(testID, {fullTestId, singleTest} = {}) {
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

async function cleanBeforeRun() {
    cleaners.forEach(c=>c())
    if (!spy.isEnabled())
        spy.initSpy({spyParam: 'test'})
    spy.clear()
}


spy.registerEnrichers([
    r => r.logNames == 'check test result' && ({ props: {success: r.success, data: r.expectedResultCtx.data, id: r.expectedResultCtx.vars.testId }}),
])

let success_counter= 0, fail_counter = 0
const startTime = Date.now()
const usedJSHeapSize = () => (globalThis.performance?.memory?.usedJSHeapSize || Math.round(process.memoryUsage().heapUsed)) / 1000000

function spyParamForTest(testID) {
    return testID.match(/uiTest|[Ww]idget/) ? 'test,uiTest,headless' : 'test'
}

let   lastLineLength = 0     // to wipe residual chars when we overwrite

const printLive = line => {
  const pad = ' '.repeat(Math.max(lastLineLength - line.length, 0))
  if (isNode)
    console.log('\r' + line + pad)
  else
    console.log(line)
  lastLineLength = line.length
}

const printFail = line => {
  const redLine = `\x1b[31m${line}\x1b[0m`; // Add red color
  if (isNode)
    console.log('\r' + redLine + '\n')   // newline keeps the failure
  else
    console.log(redLine)
  lastLineLength = 0
}

export async function runTests({specificTest,show,pattern,notPattern,take,remoteTests,repo,onlyTest,top,coveredTestsOf,showOnly}={}) {
    specificTest = specificTest && decodeURIComponent(specificTest).split('>').pop()

    let tests = globalsOfType(Test)
        .filter(id =>!specificTest || id == specificTest)
        .filter(id => !Test[id][asJbComp]?.doNotRunInTests)
        .filter(id => isNode || !Test[id][asJbComp]?.nodeOnly)
        .filter(id =>!pattern || id.match(pattern))
        .filter(id =>!notPattern || !id.match(notPattern))
        .map(id => ({testID:id}) ) // put in object to assign to groups

    tests.forEach(e => e.group = e.testID.split('.')[0].split('Test')[0]) // assign group by test name
    const priority = 'net,data,ui,rx,suggestionsTest,remote,studio'.split(',').reverse().join(',')
    const groups = unique(tests.map(e=>e.group)).sort((x,y) => priority.indexOf(x) - priority.indexOf(y))
    tests.sort((y,x) => groups.indexOf(x.group) - groups.indexOf(y.group))
    if (take)
        tests = tests.slice(0,take)
    const singleTest = tests.length == 1

    if (globalThis.document) document.body.innerHTML = showOnly ? ''
        : `<div style="font-size: 20px">
            <div id="progress"></div>
            <span id="fail-counter" onclick="hide_success_lines()"></span>
            <span id="success-counter"></span><span>, total ${tests.length}</span>
            <span id="time"></span>
            <span id="memory-usage"></span>
        </div>`
    let counter = 0
    await tests.reduce(async (pr,{testID}) => {
        await pr;
        counter++
        if (counter % 100 == 0)
            await delay(5) // gc
        const fullTestId = `test<test>${testID}`
        const runningMsg = `${testID}>${counter}: started`

        let res
        if (!showOnly) {
            !isNode && (document.getElementById('progress').innerHTML = runningMsg)
            printLive(runningMsg)
            res = await runTest(testID, { fullTestId, singleTest })
            res = { ...res, fullTestId, testID}
            res.success ? success_counter++ : fail_counter++

            // const summary = `total: ${tests.length}, \x1b[32msuccess: ${success_counter}, \x1b[31mfailures: ${fail_counter}, \x1b[33mmemory: ${usedJSHeapSize()}M, time: ${Date.now() - startTime} ms`
            // const finishedMsg = `${summary} ${testID}>${counter}: finished`
            // const finishedMsgColor = res.success ? '\x1b[32m' : '\x1b[31m'; // Green for success, Red for failure
            // //isNode ? printLive(finishedMsgColor + finishedMsg + '\x1b[0m') : document.getElementById('progress').innerHTML = `${testID}>${counter}: finished`

            if (!isNode) {
                updateTestHeader(document)
                addHTML(document.body, testResultHtml(res, repo), {beforeResult: singleTest && res.renderDOM})
                //console.log('res',res)
            }
            if (!res.success)
                 printFail(`${testID} ${res.reason || JSON.stringify(res,2,null) || 'unknown error'}`)
        }
        if (globalThis.document && (showOnly || (!res.renderDOM && show))) {
            const testElem = document.createElement('div')
            testElem.className = 'show elemToTest'
            document.body.appendChild(testElem)
            // todo - show here
        }
    }, Promise.resolve())
    const summary = `total: ${tests.length}, \x1b[32msuccess: ${success_counter}, \x1b[31mfailures: ${fail_counter}, \x1b[33mmemory: ${usedJSHeapSize()}M, time: ${Date.now() - startTime} ms`
    if (isNode) {
        printLive(summary+'\n')
        process.exit(0)
    }
}

function testResultHtml(res, repo) {
    const baseUrl = globalThis.location.href.split('/tests.html')[0]
    const { success, duration, reason, testID} = res
    const testComp = Test[testID][asJbComp]
    //    const location = testComp.$location || {}
    // const sourceCode = JSON.stringify(run(typeAdapter('source-code<jbm>', test({
    //     filePath: () => location.path, repo: () => location.repo
    // }))))
    //const studioUrl = `http://localhost:8082/project/studio/${fullTestId}/${fullTestId}?sourceCode=${encodeURIComponent(sourceCode)}`
    const studioUrl = ''
    const _repo = repo ? `&repo=${repo}` : ''
    const coveredTests = testComp.impl.covers ? `<a href="${baseUrl}/tests.html?coveredTestsOf=${testID}${_repo}">${testComp.impl.covers.length} dependent tests</a>` : ''
    return `<div class="${success ? 'success' : 'failure'}">
        <a href="${baseUrl}/tests.html?test=${testID}${_repo}&show&spy=${spyParamForTest(testID)}" style="color:${success ? 'green' : 'red'}">${testID}</a>
        <span> ${duration}mSec</span> 
        ${coveredTests}
        <a class="test-button" href="javascript:goto_editor('${testID}','${repo||''}')">src</a>
        <a class="test-button" href="${studioUrl}">studio</a>
        <a class="test-button" href="javascript:profileSingleTest('${testID}')">profile</a>
        <span>${reason||''}</span>
        </div>`
}

function updateTestHeader(topElem) {
    topElem.querySelector('#success-counter').innerHTML = ', success ' + success_counter;
    topElem.querySelector('#fail-counter').innerHTML = 'failures ' + fail_counter;
    topElem.querySelector('#fail-counter').style.color = fail_counter ? 'red' : 'green';
    topElem.querySelector('#fail-counter').style.cursor = 'pointer';
    topElem.querySelector('#memory-usage').innerHTML = ', ' + usedJSHeapSize() + 'M memory used';
    topElem.querySelector('#time').innerHTML = ', ' + (new Date().getTime() - startTime) +' mSec';
}

globalThis.goto_editor = (fullTestId,repo) => {
    const loc = Test[fullTestId][asJbComp].$location
    const filePos = `.${loc?.path}:${loc?.line}`
    fetch(`/gotoSource?filePos=${filePos}`)
}
globalThis.hide_success_lines = () => globalThis.document.querySelectorAll('.success').forEach(e=>e.style.display = 'none')
globalThis.profileSingleTest = testID => {
    const ctx = new Ctx().setVars({ testID })
    Test[testID][asJbComp]?.runProfile({}, ctx)
}

function addHTML(el,html,{beforeResult} = {}) {
    const elem = document.createElement('div')
    elem.innerHTML = html
    const toAdd = elem.firstChild
    if (beforeResult && document.querySelector('#jb-testResult'))
        el.insertBefore(toAdd, document.querySelector('#jb-testResult'))
    else
        el.appendChild(toAdd)
}