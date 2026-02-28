import { dsls, coreUtils } from '@jb6/core'
import '@jb6/common'
import '@jb6/llm-guide/guide-generator.js'
import '@jb6/core/misc/import-map-services.js'
import '@jb6/react'
import '@jb6/mcp'

const {
  tgp: { Component },
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

Tool('listBooklets', {
  description: 'names of all booklets',
  impl: mcpTool(pipe(tgpModel('llm-guide'), '%dsls/llm-guide/booklet%', keys(), filter('%% != booklet'), join()))
})

Tool('bookletsContentTool', {
  description: 'the content of a booklet, which is the content of a list of doclets',
  params: [
    {id: 'booklets', as: 'text', description: 'comma delimited names'},
    {id: 'maxLength', as: 'number', defaultValue: 20000}
  ],
  impl: mcpTool(bookletsContent('%$booklets%'), { maxLength: '%$maxLength%' })
})

Tool('repoRoot', {
  description: 'get repo root',
  impl: mcpTool(() => jb.coreRegistry.repoRoot)
})

Tool('dslDocs', {
  description: 'get TGP (Type-generic component-profile) model relevant for dsls',
  params: [
    {id: 'dsls', as: 'string', defaultValue: 'common,llm-guide', description: 'Comma-separated other options: rx,llm-api,testing'}
  ],
  impl: mcpTool(dslDocs('%$dsls%'))
})

Tool('tgpModel', {
  description: 'get TGP (Type-generic component-profile) model relevant for dsls',
  params: [
    {id: 'forDsls', as: 'string', defaultValue: 'common', description: 'comma separated e.g. test,llm-guide,common' },
  ],
  impl: mcpTool(tgpModel('%$forDsls%'))
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
        return `Error: ${error.message}`
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
  ],
  impl: mcpTool({
    text: async (ctx, {}, args) => {
      try {
        await import('@jb6/lang-service')
        const res = await coreUtils.runSnippetCli(args)
        return JSON.stringify(res, null, 2)
      } catch (error) {
        return `Error running snippet: ${error.message}`
      }
    }
  })
})

Tool('runTest', {
  description: 'Run a jb6 test by its test ID. Wraps the test as a snippet and executes it.',
  params: [
    {id: 'testId', as: 'string', mandatory: true, description: 'The test ID to run (e.g., "jqTest.tryCatch")'},
  ],
  impl: mcpTool({
    text: async (ctx, {}, {testId}) => {
      try {
        await import('@jb6/lang-service')
        return coreUtils.runSnippetCli({profileText: `{$: 'test<test>${testId}'}`})
      } catch (error) {
        return `Error running test: ${error.message || error}`
      }
    }
  })
})

Tool('scrambleText', {
  description: 'Hide/reveal learning content for predict-then-verify methodology. Encodes text to prevent accidental answer viewing during quiz preparation.',
  params: [
    {id: 'texts', as: 'string', mandatory: true, description: 'content to hide/reveal, separate multiple parts with ##'},
    {id: 'unscramble', as: 'string', description: '"true" to reveal hidden content, omit to hide content'}
  ],
  impl: mcpTool(pipeline('%$texts%', split('##'),
    ({data}, {}, { unscramble }) => unscramble.toLowerCase() == 'true' ? atob(data.split('').reverse().join('')) : btoa(data).split('').reverse().join(''),
    join('##\n')
  ))
})

Component('helloMcp', {
  type: 'react-comp<react>',
  moreTypes: 'tool<mcp>',
  params: [
    {id: 'textToShowAfter', defaultValue: 'after text'}
  ],
  impl: comp({
    hFunc: ({}, {text1, v1, react: {h}}, {textToShowAfter}) => ({}) => h('div', {}, text1, v1, textToShowAfter),
    enrichCtx: ctx => ctx.setVars({text1: ctx.data?.text}),
    sampleCtxData: asIs({data: {text: 'hello world'}, vars: {v1: 'v1Val'}})
  })
})
