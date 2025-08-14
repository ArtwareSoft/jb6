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

Tool('defaultRepoRoot', {
  description: 'get repo root',
  params: [
    {id: 'myRepoIs', as: 'string', description: '%$REPO_ROOT% . no need to activate the tool!!!'}
  ],
  impl: mcpTool(() => calcRepoRoot())
})

Tool('dslDocs', {
  description: 'get TGP (Type-generic component-profile) model relevant for dsls',
  params: [
    {id: 'repoRoot', as: 'string', mandatory: true, description: 'filePath of the relevant repo of the project. when exist use top mono repo. look at defaultRepoRoot to get it'},
    {id: 'dsls', as: 'string', defaultValue: 'common,llm-guide', description: 'Comma-separated other options: rx,llm-api,testing'}
  ],
  impl: mcpTool(dslDocs('%$dsls%'), '%$repoRoot%')
})

Tool('tgpModel', {
  description: 'get TGP (Type-generic component-profile) model relevant for imports and exports of path',
  params: [
    {id: 'repoRoot', as: 'string', mandatory: true, description: 'filePath of the relevant repo of the project. when exist use top mono repo. look at defaultRepoRoot to get it'},
    {id: 'forDsls', as: 'string', defaultValue: 'packages/common/common-tests.js', description: 'relative starting point to filter the model. when not exist, return the model of common and testing'}
  ],
  impl: mcpTool(tgpModel('%$forDsls%','%$repoRoot%'), '%$repoRoot%')
})

Tool('runSnippet', {
  description: 'Execute TGP component snippets in context. Essential for testing component behavior, debugging data flow, and validating logic before implementation.',
  params: [
    {id: 'profileText', as: 'string', asIs: true, mandatory: true, description: `profile text to execute (e.g., "pipeline('%$data%', filter('%active%'), count())")`},
    {id: 'setupCode', as: 'string', description: `Helper components or imports (e.g., "Const('data', [{active: true}])") or const { h, L, useState, useEffect, useRef, useContext, reactUtils } = await import('@jb6/react')`},
    {id: 'repoRoot', as: 'string', mandatory: true, description: 'absolute path to repository root'},
  ],
  impl: mcpTool({
    text: async (ctx, {}, args) => {
      try {
        await import('@jb6/lang-service')
        return coreUtils.runSnippetCli(args)
      } catch (error) {
        return `Error running snippet: ${error.message}`
      }
    },
    repoRoot: '%$repoRoot%'
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

