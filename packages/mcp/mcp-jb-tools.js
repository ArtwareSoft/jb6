import { dsls, coreUtils } from '@jb6/core'
import '@jb6/common'
import '@jb6/llm-guide/guide-generator.js'
import '@jb6/core/misc/import-map-services.js'
import '@jb6/react'
import '@jb6/mcp'

const {
  tgp: { Component, 'ctx-enricher': { Var } },
  common: {
    data: { asIs, bookletsContent, dslDocs, filter, join, keys, pipe, pipeline, split, tgpModel }
  },
  mcp: { Tool,
    tool: { mcpTool }
  },
  react: { ReactComp,
    'react-comp': { comp }
  }
} = dsls

Tool('setupInfo', {
  description: 'setUpInfo of the mcp server',
  impl: mcpTool(() => `repoRoot: ${jb.coreRegistry.repoRoot}, jb6Root: ${jb.coreRegistry.jb6Root}`)
})

Tool('repoRoot', {
  description: 'get repo root',
  impl: mcpTool(() => jb.coreRegistry.repoRoot)
})

Tool('scanDsl', {
  description: 'map a dsl (or comma-separated dsls) from the registered model: its TgpType defs and, grouped by the file that defines them, its comps and tests. details: files|comps|all-comps-with-params|full',
  params: [
    {id: 'dsl', as: 'string', asIs: true, defaultValue: 'common', description: 'comma separated e.g. test,llm-guide,common' },
    {id: 'details', as: 'string', asIs: true, defaultValue: 'comps', description: 'files=TgpTypes+file names, comps=+comps grouped by TgpType (first 3 per type, +N more) with #params & impl length, all-comps-with-params=all comps grouped by TgpType with their params, full=+full source of each file' },
  ],
  impl: mcpTool(async (ctx, {}, {dsl, details}) => {
    await import('@jb6/lang-service')
    return coreUtils.scanDsl({dsl, details, ctx})
  })
})

Tool('sourceCodeOfComp', {
  description: 'F12 get source code and fileName:line for a tgp comp',
  params: [
    {id: 'cmpFullId', as: 'string', asIs: true },
  ],
  impl: mcpTool(async (ctx, {}, {cmpFullId}) => {
    await import('@jb6/lang-service')
    const repoRoot = await coreUtils.calcRepoRoot()
    const { staticMappings } = await coreUtils.calcImportData({forRepo: repoRoot})
    const tgpModel = await coreUtils.calcTgpModelData({forRepo: repoRoot})
    const loc = coreUtils.compByFullId(cmpFullId, tgpModel)?.$location
    if (!loc) return `comp not found: ${cmpFullId}`
    const src = await coreUtils.fetchByEnv(loc.path, staticMappings)
    return `${loc.path}:${loc.line}\n${src.split('\n').slice(loc.line, loc.to.line).join('\n')}`
  })
})

Tool('macroToJson', {
  description: 'Convert TGP macro syntax to JSON profile. e.g. pipeline([1,2,3], join("-")) → {$: "data<common>pipeline", ...}. Use tgpModel tool to discover available components.',
  params: [
    {id: 'macroText', as: 'string', asIs: true, mandatory: true, description: `macro expression, e.g. pipeline([1,2,3], join('-')). Prefix with type<dsl>: for non-common dsls`},
  ],
  impl: mcpTool({
    text: async (ctx, {}, {macroText}) => {
      try {
        await import('@jb6/lang-service')
        const forDsls = macroText.match(/^[^<]+<([^>]+)>/)?.[1] || 'common'
        const tgpModel = await coreUtils.calcTgpModelData({forRepo: await coreUtils.calcRepoRoot(), forDsls })
        if (tgpModel.error) return `Error: ${tgpModel.error}`
        const result = coreUtils.macroToJson(macroText, tgpModel)
        return result.error ? `Error: ${result.error}` : JSON.stringify(result, null, 2)
      } catch (error) {
        return `Error: ${error.stack}`
      }
    }
  })
})

Tool('runTgpSnippet', {
  description: `Execute a TGP profile. TGP: TgpType (abstract type), Component (concrete impl), Profile (JSON instance to run).
TgpType('color', 'css')
Component('rgb', { type: 'color<css>', params: [{id: 'r', as: 'number'}, {id: 'g', as: 'number'}, {id: 'b', as: 'number'}] })
Component('hsl', { type: 'color<css>', ... })
TgpType('gradient', 'css')
Component('linearGradient', { type: 'gradient<css>', params: [{id: 'direction', as: 'string'}, {id: 'stops', type: 'color<css>[]'}] })
Profile: {$: 'gradient<css>linearGradient', direction: 'to right', stops: [{$: 'color<css>rgb', r: 255, g: 99, b: 71}, {$: 'color<css>hsl', h: 45, s: 100, l: 50}]}
Use tgpModel tool to discover available components and their params.`,
  params: [
    {id: 'profileText', as: 'string', asIs: true, mandatory: true, description: `JSON profile to execute, e.g. {$: 'data<common>pipeline', items: [...]}`},
    {id: 'logger', as: 'string', asIs: true, description: `comma-separated loggers, e.g. snippetLogger,langServiceLogger,dbLogger`},
    {id: 'repoRoot', as: 'string', asIs: true, description: `cross-repo: target repo root, e.g. /home/shaiby/projects/Genie`},
    {id: 'fetchByEnvHttpServer', as: 'string', description: `cross-repo: http server serving that repo, e.g. http://localhost:3000`},
  ],
  impl: mcpTool({
    text: async (ctx, {}, args) => {
      try {
        await import('@jb6/lang-service')
        const res = await coreUtils.runSnippetCli(args)
        return JSON.stringify(res, null, 2)
      } catch (error) {
        return `Error running snippet: ${error.stack}`
      }
    }
  })
})

Tool('runProbe', {
  description: `Probe a TGP circuit: run it and capture intermediate {in,out} at a probePath.
A probePath addresses a location inside a runnable circuit, e.g.
'test<test>coreTest.HelloWorld~impl~calculate~operators~0' or 'data<common>cmpA~impl'.
Returns the recorded {in,out} at that path plus visits, circuitRes, logs and errors.`,
  params: [
    {id: 'probePath', as: 'string', asIs: true, mandatory: true, description: `probe path, e.g. test<test>myTest~impl~expectedResult~items~0`},
    {id: 'resolution', as: 'string', options: 'default,input,output,all', defaultValue: 'default', description: `result detail: 'default' = {in,out} at path + visits + circuitRes + errors; 'input'/'output' = only that side of the captured records; 'all' adds logs, cmd, imports`},
    {id: 'circuit', as: 'string', description: `force circuit comp id (overrides auto-detect), e.g. test<test>circuitForAA`},
    {id: 'logger', as: 'string', description: `comma-separated loggers, e.g. snippetLogger,langServiceLogger,dbLogger`},
    {id: 'repoRoot', as: 'string', description: `cross-repo: target repo root, e.g. /home/shaiby/projects/Genie`},
    {id: 'fetchByEnvHttpServer', as: 'string', description: `cross-repo: http server serving that repo, e.g. http://localhost:3000`},
  ],
  impl: mcpTool({
    text: async (ctx, {}, {probePath, resolution, circuit, logger, repoRoot, fetchByEnvHttpServer}) => {
      try {
        await import('@jb6/lang-service')
        const res = await coreUtils.runProbeCli(probePath, {circuitCmpId: circuit, logger, forRepo: repoRoot, fetchByEnvHttpServer, resolution})
        return JSON.stringify(res, null, 2)
      } catch (error) {
        return `Error running probe: ${error.stack}`
      }
    }
  })
})

Tool('runTest', {
  description: 'Run a jb6 test by its test ID. Wraps the test as a snippet and executes it.',
  params: [
    {id: 'testId', as: 'string', asIs: true, mandatory: true, description: 'The test ID to run (e.g., "jqTest.tryCatch")'},
    {id: 'logger', as: 'string', asIs: true, description: `comma-separated loggers, e.g. snippetLogger,langServiceLogger,dbLogger`},
  ],
  impl: mcpTool({
    text: async (ctx, {}, {testId, logger}) => {
      try {
        await import('@jb6/lang-service')
        return coreUtils.runSnippetCli({profileText: `{$: 'test<test>${testId}'}`, logger})
      } catch (error) {
        return `Error running test: ${error.stack || error}`
      }
    }
  })
})

Tool('scrambleText', {
  description: 'Hide/reveal learning content for predict-then-verify methodology. Encodes text to prevent accidental answer viewing during quiz preparation.',
  params: [
    {id: 'texts', as: 'string', asIs: true, mandatory: true, description: 'content to hide/reveal, separate multiple parts with ##'},
    {id: 'unscramble', as: 'string', description: '"true" to reveal hidden content, omit to hide content'}
  ],
  impl: mcpTool(pipeline('%$texts%', split('##'),
    ({data}, {}, { unscramble }) => unscramble.toLowerCase() == 'true' ? atob(data.split('').reverse().join('')) : btoa(data).split('').reverse().join(''),
    join('##\n')
  ))
})

Tool('playwrightHarvest', {
  description: `Load a react-comp-view.html url in headless Chromium, run a ui-action<test> profile against the mounted comp and harvest its jb6 loggers + browser errors.
url carries query params: logger, cmpId, urlsToLoad.
Returns { done, errors, logs, html?, timeline }.`,
  params: [
    {id: 'url', as: 'string', asIs: true, mandatory: true, description: 'full react-comp-view.html url incl. logger/cmpId/urlsToLoad query params'},
    {id: 'uiActionJsonStr', as: 'string', asIs: true, description: 'ui-action<test> profile to run against the mounted comp. MUST be the JSON escaped as a string (inner quotes escaped), NOT an object - an object becomes "[object Object]" and fails. e.g. "{\\"$\\":\\"ui-action<test>selectInCodeMirror\\",\\"from\\":2,\\"to\\":8}"'},
    {id: 'timeout', as: 'number', defaultValue: 5000, description: 'ms to wait for the page to mount and its uiAction to finish'},
    {id: 'domSelector', as: 'string', description: 'optional css selector; when set returns that element outerHTML'},
    {id: 'seedLocalStorage', as: 'string', asIs: true, description: 'id of a data<common> comp whose result object seeds localStorage before boot (e.g. an auth token to render as a logged-in user)'},
  ],
  impl: mcpTool(async (ctx, {}, {url, uiActionJsonStr, timeout, domSelector, seedLocalStorage}) => {
    let seed = null
    await coreUtils.ensureImportMapsInCli() // needed for external repos with import maps
    if (seedLocalStorage) {
      await import('@jb6/lang-service')
      const { result, error } = await coreUtils.runSnippetCli({ profileText: `{$: 'data<common>${seedLocalStorage}'}` })
      if (error) return JSON.stringify({ error: `seedLocalStorage '${seedLocalStorage}' failed: ${error}` }, null, 2)
      seed = result
    }
    let redirect = null
    const res = await fetch(url, { redirect: 'manual' })
    if (res.status >= 300 && res.status < 400) {
      const location = new URL(res.headers.get('location'), url).href
      redirect = { from: url, status: res.status, to: location }
      url = location
    }
    const script = `
import { coreUtils } from '@jb6/core'
import '@jb6/core/misc/import-map-services.js'
const t0 = Date.now(), timeline = [], mark = phase => timeline.push({ phase, atMs: Date.now() - t0 })
const { chromium } = await import(coreUtils.pathJoin(await coreUtils.calcRepoRoot(), 'node_modules/playwright/index.mjs'))
const browser = await chromium.launch(); mark('launched')
const page = await browser.newPage()
const errors = []
page.on('console', m => /error|warning/i.test(m.type()) && errors.push(m.text()))
page.on('pageerror', e => errors.push(String(e?.stack || e)))
const seed = ${JSON.stringify(seed)}
if (seed) await page.addInitScript(s => Object.entries(s).forEach(([k, v]) => localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v))), seed)
await page.addInitScript(() => {
  window.__jbOnMounted = async (ctx, reactUtils) => {
    await import('@jb6/react/tests/react-testers.js')
    window.jbRunAndHarvest = (uiActionJsonStr, limit) => reactUtils.runAndHarvest(ctx, window, uiActionJsonStr, limit)
    ctx.vars.uiLogger?.info?.({ t: 'jbOnMounted.installed', msg: 'test harness injected externally into prod page; driver ready' }, {}, { ctx })
  }
})
await page.goto(${JSON.stringify(url)}, { waitUntil: 'domcontentloaded', timeout: ${timeout} }); mark('loaded')
await page.waitForFunction(() => window.jbMounted, null, { timeout: ${timeout} }); mark('mounted')
const uiActionJsonStr = ${JSON.stringify(uiActionJsonStr || '')}
const { done, logs } = await page.evaluate(([s, limit]) => window.jbRunAndHarvest(s, limit), [uiActionJsonStr, ${timeout}]); mark('done')
const html = ${JSON.stringify(domSelector || '')} ? await page.evaluate(s => document.querySelector(s)?.outerHTML, ${JSON.stringify(domSelector || '')}) : undefined
await browser.close(); mark('closed')
const redirect = ${JSON.stringify(redirect)}
await coreUtils.writeServiceResult({ done, errors, logs, html, timeline, redirect })`
    const { result, error } = await coreUtils.runCliInContext(script)
    return JSON.stringify(error ? { error } : result, null, 2)
  })
})

Component('helloMcp', {
  type: 'react-comp<react>',
  moreTypes: 'tool<mcp>',
  params: [
    {id: 'textToShowAfter', defaultValue: 'after text'}
  ],
  impl: comp({
    hFunc: ({}, {text1, v1, react: {h}}, {textToShowAfter}) => ({}) => h('div', {}, text1, v1, textToShowAfter),
    enrichCtx: Var('text1', '%%/text%')
  })
})
