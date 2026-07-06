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


/*
Tool('dslDocs', {
  description: 'get TGP (Type-generic component-profile) model relevant for dsls',
  params: [
    {id: 'dsls', as: 'string', asIs: true, defaultValue: 'common,llm-guide', description: 'Comma-separated other options: rx,llm-api,testing'}
  ],
  impl: mcpTool(dslDocs('%$dsls%'))
})

Tool('tgpModel', {
  description: 'get TGP (Type-generic component-profile) model relevant for dsls',
  params: [
    {id: 'forDsls', as: 'string', asIs: true, defaultValue: 'common', description: 'comma separated e.g. test,llm-guide,common' },
  ],
  impl: mcpTool(tgpModel('%$forDsls%'))
})

Tool('listBooklets', {
  description: 'names of all booklets',
  impl: mcpTool(pipe(tgpModel('llm-guide'), '%dsls/llm-guide/booklet%', keys(), filter('%% != booklet'), join()))
})

Tool('bookletsContentTool', {
  description: 'the content of a booklet, which is the content of a list of doclets',
  params: [
    {id: 'booklets', as: 'text', asIs: true, description: 'comma delimited names'},
    {id: 'maxLength', as: 'number', defaultValue: 20000}
  ],
  impl: mcpTool(bookletsContent('%$booklets%'), { maxLength: '%$maxLength%' })
})
*/

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
  description: `Load a live react-comp url in headless Chromium (Playwright) and harvest its jb6 loggers + browser errors - no screenshots.
Use it to verify a ReactComp actually mounts and behaves in a REAL browser with REAL modules (no jsdom/test stubs), when a reactTest under node is not enough.
Typically point url at react-comp-view.html, which sets window.jbLoggers=ctx.vars, mounts a comp and runs a uiAction on it (see the url param for the query params it accepts).
Returns { hasLoggers, consoleErrors, pageErrors, logs }: consoleErrors = console error/warning, pageErrors = uncaught exceptions + failed requests, logs = harvestLogs from window.jbLoggers. Assert on logs.<logger>.<logName>, e.g. logs.uiLogger.uiLog contains 'selected: lect-a'.`,
  params: [
    {id: 'url', as: 'string', asIs: true, mandatory: true, description: `full comp url. use react-comp-view.html with these query params:
  logger=<name>   loggers to enable, e.g. uiLogger - REQUIRED or logs come back empty
  cmpId=<id>      ReactComp to mount, e.g. codeMirrorTest
  urlsToLoad=<m>  module(s) defining the comp, e.g. @jb6/react/tests/react-tests.js
  uiAction=<json> a ui-action<test> profile to run on the mounted comp, e.g. {"$":"ui-action<test>selectInCodeMirror","from":2,"to":8}
full example: http://localhost:8083/packages/react/react-comp-view.html?logger=uiLogger&cmpId=codeMirrorTest&urlsToLoad=@jb6/react/tests/react-tests.js&uiAction={"$":"ui-action<test>selectInCodeMirror","from":2,"to":8}`},
    {id: 'settleMs', as: 'number', defaultValue: 5000, description: 'ms to wait after networkidle for async imports/effects (spinner -> real modules) to settle before harvesting. lower (~1000) is usually fine once the dev server is warm'},
  ],
  impl: mcpTool(async (ctx, {}, {url: rawUrl, settleMs}) => {
    const url = rawUrl.replace(/\s+/g, '')   // llms often paste a pretty-printed uiAction=... json with spaces; raw whitespace is never valid in a url, so strip it
    const script = `
import { coreUtils } from '@jb6/core'
import '@jb6/core/misc/import-map-services.js'
const { chromium } = await import(coreUtils.pathJoin(await coreUtils.calcRepoRoot(), 'node_modules/playwright/index.mjs'))
const browser = await chromium.launch()
const page = await browser.newPage()
const consoleErrors = [], pageErrors = []
const noise = /cdn\\.tailwindcss\\.com should not be used in production|favicon\\.ico/  // dev-page noise, not real failures
page.on('console', m => { const t = m.text(); if (/error|warning/i.test(m.type()) && !noise.test(t)) consoleErrors.push(\`[\${m.type()}] \${t}\`) })
page.on('pageerror', e => pageErrors.push(String(e?.stack || e)))
page.on('requestfailed', r => { if (!noise.test(r.url())) pageErrors.push(\`requestfailed \${r.url()} - \${r.failure()?.errorText}\`) })
await page.goto(${JSON.stringify(url)}, { waitUntil: 'networkidle', timeout: 20000 })
const hasLoggers = await page.waitForFunction(() => window.jbLoggers, { timeout: 15000 }).then(() => true).catch(() => false)
await page.waitForTimeout(${Number(settleMs) || 5000})
const logs = hasLoggers ? await page.evaluate(() => jb.coreUtils.harvestLogs({ vars: window.jbLoggers })) : null
await browser.close()
await coreUtils.writeServiceResult({ hasLoggers, consoleErrors, pageErrors, logs })`
    try {
      await coreUtils.calcJb6RepoRootAndImportMapsInCli()
      const { result, error } = await coreUtils.runCliInContext(script, { importMapsInCli: jb.coreRegistry.importMapsInCli })
      return JSON.stringify(error ? { error } : result, null, 2)
    } catch (error) {
      return `Error running playwrightHarvest: ${error.stack || error}`
    }
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
