import { dsls, coreUtils } from '@jb6/core'
import '@jb6/common'
import '@jb6/llm-guide/autogen-dsl-docs.js'
import '@jb6/core/misc/import-map-services.js'

const { pathJoin, calcRepoRoot } = coreUtils
  
const {
    common: { Data,
       data: { pipeline, split, join, first, list, dslDocs, tgpModel }
    },
    tgp: { any: { typeAdapter }},
    mcp: { Tool, 
      tool: { mcpTool }
     }
} = dsls

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

Tool('tgpModelForAllDsls', {
  description: 'get TGP (Type-generic component-profile) for all dsls in repo',
  impl: mcpTool(tgpModel('allButTests'), { maxLength: 100000 })
})

Tool('tgpModel', {
  description: 'get TGP (Type-generic component-profile) model relevant for dsls',
  params: [
    {id: 'forDsls', as: 'string', defaultValue: 'common', description: 'comma separated e.g. test,llm-guide,common' },
    {id: 'includeLocation', as: 'boolean', byName: true}
  ],
  impl: mcpTool(tgpModel('%$forDsls%', { includeLocation: '%$includeLocation%' }))
})

Tool('runSnippet', {
  description: 'Execute TGP component snippets in context. Essential for testing component behavior, debugging data flow, and validating logic before implementation.',
  params: [
    {id: 'profileText', as: 'string', asIs: true, mandatory: true, description: `profile text to execute (e.g., "pipeline('%$data%', filter('%active%'), count())")`},
    {id: 'setupCode', as: 'string', description: `Helper components or imports (e.g., "Const('data', [{active: true}])") or const { h, L, useState, useEffect, useRef, useContext, reactUtils } = await import('@jb6/react')`},
  ],
  impl: mcpTool({
    text: async (ctx, {}, args) => {
      try {
        await import('@jb6/lang-service')
        return coreUtils.runSnippetCli(args)
      } catch (error) {
        return `Error running snippet: ${error.message}`
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

