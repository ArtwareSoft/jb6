import { runTest, Test } from './tester.js'
import { utils } from '../common/common-utils.js'
import { Ctx, jb, run, globalsOfType } from '../core/tgp.js'
import { spy } from '../logger/spy.js'
import { asJbComp } from '../core/jb-macro.js'
globalThis.spy = spy
globalThis.jb = jb

spy.registerEnrichers([
    r => r.logNames == 'check test result' && ({ props: {success: r.success, data: r.expectedResultCtx.data, id: r.expectedResultCtx.vars.testId }}),
])

let success_counter= 0, fail_counter = 0
const startTime = Date.now()
const usedJSHeapSize = () => (globalThis.performance?.memory.usedJSHeapSize || 0) / 1000000

globalThis.goto_editor = (fullTestId,repo) => {
    const loc = Test[fullTestId]?.$location
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

export function spyParamForTest(testID) {
    return testID.match(/uiTest|[Ww]idget/) ? 'test,uiTest,headless' : 'test'
}


export async function runTests({specificTest,show,pattern,notPattern,take,remoteTests,repo,onlyTest,top,coveredTestsOf,showOnly}) {
    let index = 1
    specificTest = specificTest && decodeURIComponent(specificTest).split('>').pop()

    let tests = globalsOfType(Test)
        .filter(id =>!specificTest || id == specificTest)
        .filter(id => !Test[id][asJbComp]?.doNotRunInTests)
        .filter(id =>!pattern || id.match(pattern))
        .filter(id =>!notPattern || !id.match(notPattern))
        .map(id => ({testID:id}) ) // put in object to assign to groups

    tests.forEach(e => e.group = e.testID.split('.')[0].split('Test')[0]) // assign group by test name
    const priority = 'net,data,ui,rx,suggestionsTest,remote,studio'.split(',').reverse().join(',')
    const groups = utils.unique(tests.map(e=>e.group)).sort((x,y) => priority.indexOf(x) - priority.indexOf(y))
    tests.sort((y,x) => groups.indexOf(x.group) - groups.indexOf(y.group))
    if (take)
        tests = tests.slice(0,take)
    const singleTest = tests.length == 1

    document.body.innerHTML = showOnly ? ''
        : `<div style="font-size: 20px">
            <div id="progress"></div>
            <span id="fail-counter" onclick="hide_success_lines()"></span>
            <span id="success-counter"></span><span>, total ${tests.length}</span>
            <span id="time"></span>
            <span id="memory-usage"></span>
        </div>`
    let counter = 0
    tests.reduce(async (pr,{testID}) => {
        await pr;
        counter++
        if (counter % 100 == 0)
            await utils.delay(5) // gc
        const fullTestId = `test<>${testID}`
        let res
        if (!showOnly) {
            document.getElementById('progress').innerHTML = `<div id=${testID}>${index++}: ${testID} started</div>`
            console.log('starting ' + testID )
            res = await runTest(testID,{fullTestId, singleTest })
            console.log('end      ' + testID, res)
            document.getElementById('progress').innerHTML = `<div id=${testID}>${testID} finished</div>`
            res = { ...res, fullTestId, testID}
            res.success ? success_counter++ : fail_counter++
            updateTestHeader(document)
            addHTML(document.body, testResultHtml(res, repo), {beforeResult: singleTest && res.renderDOM})
        }
        if (showOnly || (!res.renderDOM && show)) {
            const testElem = document.createElement('div')
            testElem.className = 'show elemToTest'
            document.body.appendChild(testElem)
            // todo - show here
        }
    }, Promise.resolve())
}

function testResultHtml(res, repo) {
    const baseUrl = globalThis.location.href.split('/tests.html')[0]
    const { success, duration, reason, testID} = res
    const testComp = Test[testID][asJbComp]
    //    const location = testComp.$location || {}
    // const sourceCode = JSON.stringify(run(typeAdapter('source-code<loader>', test({
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
