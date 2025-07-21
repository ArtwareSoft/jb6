import { dsls, coreUtils } from '@jb6/core'
import '@jb6/common'
import '@jb6/llm-guide'

const { pathJoin, deepMapValues, omitProps } = coreUtils
  
const {
    common: { Data,
       data: { runNodeScript, pipeline, split, join, first }
    },
    tgp: { any: { typeAdapter }},
    mcp: { Tool, 
      tool: { mcpTool, doclet }
     }
} = dsls

Tool('defaultRepoRoot', {
  description: 'get repo root',
  params: [
    {id: 'myRepoIs', as: 'string', description: '/home/shaiby/projects/jb6 . no need to activate the tool!!!'}
  ],
  impl: mcpTool('/home/shaiby/projects/jb6')
})

Tool('tgpModel', {
    description: 'get TGP (Type-generic component-profile) model relevant for imports and exports of path',
    params: [
      { id: 'repoRoot', as: 'string', mandatory: true, description: 'filePath of the relevant repo of the project. when exist use top mono repo. look at defaultRepoRoot to get it' },
      { id: 'filePath', as: 'string', defaultValue: 'packages/common/common-tests.js', description: 'relative starting point to filter the model. when not exist, return the model of common and testing' },
    ],
    impl: mcpTool( async (ctx, {}, { repoRoot, filePath }) => {
      try {
        await import('@jb6/lang-service')
        jb.coreRegistry.repoRoot = repoRoot
        const res = await coreUtils.calcTgpModelData(pathJoin(repoRoot, filePath))
        const {dsls, ns} = deepMapValues(res,minifyComp,filter)
        return {dsls,ns}
      } catch (error) {
        return `Error calculating TGP model: ${error.message}`
      }

      function filter(obj, key, parent,path) {
        return (key == 'ns' && !path || key[0] == key[0]?.toUpperCase() && path.split('~').length == 3 || obj.$location) 
      }

      function minifyComp(obj, key,parent,path) {
        if (key == 'ns' && !path)
          return Object.keys(obj).join(',')
        if (key[0] == key[0]?.toUpperCase() && path.split('~').length == 3)
          return 'compDef'

        const {description,params} = obj
        const res = {}
        if (description) res.description = description
        if (params?.length > 0)
          res.params = params.map(p=>{
            const resP = omitProps(p,['$location','dsl','$dslType'])
            if (resP.type == 'data<common>') delete resP.type
            return resP
        })
        return res
      }
    })
})
  
Tool('runSnippet', {
  description: 'Execute TGP component snippets in context. Essential for testing component behavior, debugging data flow, and validating logic before implementation.',
  params: [
    {id: 'compText', as: 'string', dynamic: true, mandatory: true, description: `Component text to execute (e.g., "pipeline('%$data%', filter('%active%'), count())")`},
    {id: 'setupCode', as: 'string', description: `Helper components or JavaScript code to set up context (e.g., "Const('data', [{active: true}])")`},
    {id: 'filePath', as: 'string', mandatory: true, description: 'Relative file path for import context (e.g., "packages/common/test.js")'},
    {id: 'repoRoot', as: 'string', mandatory: true, description: 'Absolute path to repository root'},
    {id: 'probe', as: 'string', description: 'Set to "true" to enable probe mode. Use __ in compText to see data flow at that point. Example: "pipeline(data, filter(condition), __)"'}
  ],
  impl: mcpTool({
    text: async (ctx, {}, args) => {
      try {
        await import('@jb6/lang-service')
        const snippetArgs = { ...args, compText: args.compText.profile, filePath: pathJoin(args.repoRoot, args.filePath) }
        const res = await coreUtils.runSnippetCli(snippetArgs)
        return {...res, tokens: coreUtils.estimateTokens(snippetArgs.compText)}
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
    {id: 'filePath', as: 'string', mandatory: true, description: 'Relative file path for import context (e.g., "packages/common/test.js"). it may contain all the setup code you need'},
    {id: 'setupCode', as: 'string', description: `Shared setup code executed before all snippets. Use for Const() definitions, imports, or helper functions. Example: "Const('data', [{active: true, id: 1}])"`},
    {id: 'repoRoot', as: 'string', mandatory: true, description: 'Absolute path to repository root'}
  ],
  impl: mcpTool({
    text: async (ctx,{}, { compTexts, setupCode, filePath, repoRoot }) => {
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
              return `Snippet ${index + 1}: ${compText} ===\n${JSON.stringify({...result, tokens: coreUtils.estimateTokens(compText)}, null, 2)}`
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
  description: 'Scramble/unscramble texts for hiding answers in learning materials',
  params: [
    {id: 'texts', as: 'string', mandatory: true, description: 'separated by ##'},
    {id: 'unscramble', as: 'boolean'}
  ],
  impl: mcpTool(pipeline('%$texts%', split('##'),
    (ctx, {}, { text, unscramble }) => unscramble ? atob(text.split('').reverse().join('')) : btoa(text).split('').reverse().join(''),
    join('##\n')
  ))
})

