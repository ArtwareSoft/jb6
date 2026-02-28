import { coreUtils, dsls } from '@jb6/core'
import '@jb6/common'
import { spy } from './spy.js'

const { Ctx, jb, log, logException, asJbComp, delay, waitForInnerElements, globalsOfTypeIds, unique, isNode } = coreUtils
jb.testingUtils = {runTest, runTests, runTestCli, runTestVm, runTestInVm}
jb.testingRepository = {}

const { 
  tgp: {TgpType, Component}
} = dsls

const Test = TgpType('test', 'test')

Component('dataTest', {
  type: 'test<test>',
  params: [
    {id: 'calculate', type: 'data', dynamic: true},
    {id: 'expectedResult', type: 'boolean', dynamic: true},
    {id: 'runBefore', type: 'action', dynamic: true},
    {id: 'timeout', as: 'number', defaultValue: 200},
    {id: 'allowError', as: 'boolean', dynamic: true, type: 'boolean'},
    {id: 'cleanUp', type: 'action', dynamic: true},
    {id: 'expectedCounters', as: 'single'},
    {id: 'spy', as: 'string'},
    {id: 'logger', as: 'string', description: 'e.g dbLogger'}
  ],
  impl: async (ctx,{}, { calculate,expectedResult,runBefore,timeout,allowError,cleanUp,expectedCounters,spy: _spy, logger }) => {
        const loggerObj = logger && dsls.test.logger[logger] && { [logger] : dsls.test.logger[logger].$runWithCtx(ctx) } || {}
        const testID = ctx.vars.testID || (ctx.jbCtx.lexicalStack.slice(-1)[0]||'').split('~')[0]
		const ctxToUse = ctx.setVars({testID, isTest: true, testSessionId: `test-${Date.now()}`, ...loggerObj})
		const {singleTest}  = ctxToUse.vars
		const remoteTimeout = testID.match(/([rR]emote)|([wW]orker)|(jbm)/) ? 5000 : null
		const _timeout = singleTest ? Math.max(1000,timeout) : (remoteTimeout || timeout)
		_spy && spy.setLogs(_spy+',error')
		let result = null, testRes
		try {
			testRes = await Promise.race([ 
				!singleTest && (async() => {
					await delay(_timeout)
					return {testFailure: `timeout ${_timeout}mSec`}
				})(),
				(async() => {
					await runBefore(ctxToUse)
					let res
					try {
						res = await calculate(ctxToUse)
					} catch (error) {
						res = [{testFailure: error.stack}]	
					}
					const _res = await waitForInnerElements(res)
					return _res
				})()
			].filter(Boolean))
			let testFailure = testRes?.[0]?.testFailure || testRes?.testFailure
			const countersErr = countersErrors(expectedCounters,allowError)
            const counters = Object.fromEntries(Object.keys(expectedCounters || {}).map(exp => [exp, spy.count(exp)]))
			const expectedResultCtx = ctxToUse.setData(testRes)
			const expectedResultRes = !testFailure && await expectedResult(expectedResultCtx)
			testFailure = expectedResultRes?.testFailure
			const success = !! (expectedResultRes && !countersErr && !testFailure)
			log('check test result',{testRes, success,expectedResultRes, testFailure, countersErr, expectedResultCtx})
			result = { id: testID, success, reason: countersErr || testFailure, testRes, counters}
		} catch (e) {
			logException(e,'error in test',{ctx})
			result = { testID, success: false, reason: 'Exception ' + e, testRes}
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

async function runTestCli(testID, params, resources) {
    const {entryFiles, testFiles, projectDir, importMap } = await coreUtils.calcImportData(resources)
    const imports = unique([...entryFiles, ...testFiles])
    const script = `
      import { jb, dsls, coreUtils } from '@jb6/core'
      import '@jb6/testing'
      const imports = ${JSON.stringify(imports)}
      try {
        await Promise.all(imports.map(f => import(f))) //.catch(e => console.error(f, e.message) )))
        const result = await jb.testingUtils.runTest('${testID}', {singleTest: true, params: ${JSON.stringify(params || {})}})
        await coreUtils.writeServiceResult(result)
      } catch (e) {
        await coreUtils.writeServiceResult({error: e.message})
        console.error(e)
      }
    `
    try {
      const { result, error, cmd } = await coreUtils.runCliInContext(script, {projectDir, importMapsInCli: importMap.importMapsInCli})
      return { result, error, cmd, projectDir }
    } catch (error) {
      debugger
      return { error, projectDir}
    }
}

async function runTestVm(args) {
    const {testID, params, resources, builtIn, vmId, importMap, staticMappings} = args
    if (!isNode) {
        const script = `import { jb, coreUtils } from '@jb6/core'
    import '@jb6/testing/tester.js'
    ;(async()=>{
    try {
      const result = await jb.testingUtils.runTestVm(${JSON.stringify(args)})
      await coreUtils.writeServiceResult(result || '')
    } catch (e) { console.error(e) }
    })()`
          const res = await coreUtils.runNodeCliViaJbWebServer(script)
          return res.result
      }
      await import ('@jb6/core/misc/jb-vm.js')
//      const v8 = await import ('v8')
//      const heapSummary = () => Object.fromEntries(v8.getHeapSpaceStatistics().filter(s => s.space_used_size || s.space_size || s.physical_space_size).map(s => [s.space_name, [s.space_used_size, s.space_size, s.physical_space_size].map(v => +(v/1024/1024).toFixed(2))]))
//      const mem_before = heapSummary().code_space
      const testVm = await coreUtils.getOrCreateVm({vmId, resources, builtIn, importMap, staticMappings})
      try {
        const resPromise = testVm.evalScript(`jb.testingUtils.runTestInVm('${testID}', ${JSON.stringify(params || {})})`)
        const result = await resPromise
//        testVm.destroy()
//        result.mem_after = heapSummary().code_space
//        result.mem_before = mem_before
        return result
      } catch (e) {
        console.error(e)
      }
}

async function runTestInVm(testID, params, httpReqId) {
    const jbComp = Test[testID][asJbComp]
    let res = {}
    const start = Date.now()
    try {
        const ctx = new Ctx().setVars({ testID, singleTest: true, httpReqId })
        debugger
        res = await jbComp.runProfile(params, ctx)
        console.log('test res', res)
    } catch (e) {
        res = { success: false, reason: e}
    }
    res.duration = Date.now() - start
    return res
}

export async function runTest(testID, {fullTestId, singleTest, action, httpReqId, params} = {}) {
    !singleTest && await cleanBeforeRun()
    const jbComp = Test[testID][asJbComp]
    log('start test',{testID})
    let res = null
    const start = Date.now()
    try {
        const ctx = new Ctx().setVars({ testID, fullTestId,singleTest, httpReqId, win1: globalThis })
        res = await jbComp.runProfile({...params}, ctx)
        if (action) {
            const actionId = action.split(':')[0]
            const actionParam = action.slice(actionId.length+1)
            const actionProxy = dsls.test['ui-action'][actionId]
            if (actionProxy) {
                await actionProxy.$run(actionParam).exec(ctx)
            } else {
                logError(`can not find ui-action ${actionId}`)
            }
        }
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

export async function runTests({specificTest,show,pattern,notPattern,take,repo,showOnly,includeHeavy,action}={}) {
    showOnly = showOnly || action
    specificTest = specificTest && decodeURIComponent(specificTest).split('>').pop()

    let tests = globalsOfTypeIds(Test)
        .filter(id =>!specificTest || id == specificTest)
        .filter(id => specificTest || includeHeavy || !Test[id][asJbComp]?.HeavyTest)
        .filter(id => specificTest || !Test[id][asJbComp]?.doNotRunInTests)
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
        if (counter % 50 == 0)
            await delay(1) // gc
        const fullTestId = `test<test>${testID}`
        const runningMsg = `${counter}: ${testID} started`

        let res
        if (showOnly) {
            res = await runTest(testID, { fullTestId, singleTest })
        } else if (!showOnly) {
            !isNode && (document.getElementById('progress').innerHTML = runningMsg)
            printLive(runningMsg)
            res = await runTest(testID, { fullTestId, singleTest })
            printLive(`${counter}: ${testID} ended`)
            res = { ...res, fullTestId, testID}
            res.success ? success_counter++ : fail_counter++

            if (!isNode) {
                updateTestHeader(document)
                addHTML(document.body, testResultHtml(res, repo), {beforeResult: singleTest && res.renderDOM})
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
    const studioUrl = ''
    const _repo = repo ? `&repo=${repo}` : ''
    return `<div class="${success ? 'success' : 'failure'}">
        <a href="${baseUrl}/tests.html?test=${testID}${_repo}&show&spy=${spyParamForTest(testID)}" style="color:${success ? 'green' : 'red'}">${testID}</a>
        <span> ${duration}mSec</span> 
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