import { dsls, coreUtils } from '@jb6/core'
import '@jb6/common'
import '@jb6/llm-guide/autogen-dsl-docs.js'

const { pathJoin } = coreUtils
  
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
  impl: mcpTool('%$REPO_ROOT%')
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
    {id: 'compText', as: 'string', asIs: true, mandatory: true, description: `Component text to execute (e.g., "pipeline('%$data%', filter('%active%'), count())")`},
    {id: 'setupCode', as: 'string', description: `Helper components or JavaScript code to set up context (e.g., "Const('data', [{active: true}])")`},
    {id: 'entryPointJsFile', as: 'string', mandatory: true, description: 'Relative file path for import context (e.g., "packages/common/test.js")'},
    {id: 'repoRoot', as: 'string', mandatory: true, description: 'Absolute path to repository root'},
  ],
  impl: mcpTool({
    text: async (ctx, {}, args) => {
      try {
        await import('@jb6/lang-service')
        const snippetArgs = { ...args, filePath: pathJoin(args.repoRoot, args.entryPointJsFile) }
        return coreUtils.runSnippetCli(snippetArgs)
      } catch (error) {
        return `Error running snippet: ${error.message}`
      }
    },
    repoRoot: '%$repoRoot%'
  })
})
  
Tool('runSnippets', {
  description: 'run multiple comp snippets in parallel. Useful for running a batch of Test or Data snippets.',
  params: [
    {id: 'compTexts', type: 'data<common>[]', dynamic: true, mandatory: true, description: `JSON array of component text strings to execute. Example: ["'%$data%'", "pipeline('%$data%', count())", "filter('%active%')"]`},
    {id: 'entryPointJsFile', as: 'string', mandatory: true, description: 'Relative file path for import context (e.g., "packages/common/test.js"). it may contain all the setup code you need'},
    {id: 'setupCode', as: 'string', description: `Shared setup code executed before all snippets. Use for Const() definitions, imports, or helper functions. Example: "Const('data', [{active: true, id: 1}])"`},
    {id: 'repoRoot', as: 'string', mandatory: true, description: 'Absolute path to repository root'}
  ],
  impl: mcpTool({
    text: async (ctx,{}, { compTexts, setupCode, entryPointJsFile: filePath, repoRoot }) => {
      try {
        await import('@jb6/lang-service')
        const snippetArgsBase = { setupCode, filePath: pathJoin(repoRoot, filePath) }
        
        // Enhanced parameter validation and error handling
        let compTextsProfiles
        if (!compTexts || !compTexts.profile) throw new Error('compTexts parameter is required and must contain a profile')
        
        compTextsProfiles = typeof compTexts.profile === 'string' ? JSON.parse(compTexts.profile) : compTexts.profile
          
        if (!Array.isArray(compTextsProfiles)) throw new Error(`compTexts must be an array. Received: ${typeof compTextsProfiles}. Expected format: ["snippet1", "snippet2", ...]`)              
        if (compTextsProfiles.length === 0) throw new Error('compTexts array cannot be empty. Provide at least one snippet to execute.')
        
        compTextsProfiles.forEach((snippet, index) => {
          if (typeof snippet !== 'string') throw new Error(`Snippet at index ${index} must be a string. Received: ${typeof snippet} - "${snippet}"`)
          if (snippet.trim() === '') throw new Error(`Snippet at index ${index} cannot be empty`)        
        })
        // Enhanced execution with better error context
        const results = await Promise.all(
          compTextsProfiles.map(async (compText, index) => {
            try {
              const snippetArgs = { ...snippetArgsBase, compText }
              const result = await coreUtils.runSnippetCli(snippetArgs)
              return `Snippet ${index + 1}: ${compText} ===\n${JSON.stringify(result, null, 2)}`
            } catch (error) {
              return `Snippet ${index + 1}: ${compText} ===\nERROR: ${error.message}\n\nDebugging tips:\n- Check syntax: ${compText}\n- Verify variables exist in setupCode\n- Ensure component is properly imported`
            }
          })
        )
        
        const successCount = results.filter(r => !r.includes('ERROR:')).length
        const errorCount = compTextsProfiles.length - successCount
        return `Batch Execution Summary: ${successCount} succeeded, ${errorCount} failed\n\n${results.join('\n\n')}` 
      } catch (error) {
        return `Error runSnippets: ${error.message}\n\nCommon causes:\n- Invalid compTexts format (must be JSON array)\n- Missing or invalid filePath/repoRoot\n- Setup code syntax errors\n\nExample usage:\nrunSnippets({\n  compTexts: ["'%$data%'", "count('%$data%')"],\n  setupCode: "Const('data', [1,2,3])",\n  filePath: "packages/common/test.js",\n  repoRoot: "/path/to/repo"\n})`
      }
    },
    repoRoot: '%$repoRoot%',
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

