import { dsls, coreUtils } from '@jb6/core'
import '@jb6/common'
import '@jb6/core/misc/calc-import-map.js'
import '@jb6/lang-service'
const { pathJoin } = coreUtils
  
const {
    common: { Data,
       data: { runNodeScript, pipeline, split, join, first }
    },
    tgp: { any: { typeAdapter }},
    mcp: { Tool }
} = dsls

Tool('tgpModel', {
    description: 'get TGP (Type-generic component-profile) model relevant for imports and exports of path',
    params: [
      { id: 'repoRoot', as: 'string', mandatory: true, description: 'filePath of the relevant repo of the project. when exist use top mono repo' },
      { id: 'filePath', as: 'string', description: 'relative starting point to filter the model. when not exist, return the model of the repo' },
    ],
    impl: async (ctx, { repoRoot, filePath }) => {
      try {
        const fullPath = pathJoin(repoRoot, filePath)
        const res = await coreUtils.calcTgpModelData({ filePath: fullPath })
        return {
          content: [{ type: 'text', text: JSON.stringify(res) }],
          isError: false
        }
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error calculating TGP model: ${error.message}` }],
          isError: true
        }
      }
    }
})
  
Tool('runSnippet', {
    description: 'Execute TGP component snippets in context. Essential for testing component behavior, debugging data flow, and validating logic before implementation.',
    params: [
      { id: 'compText', as: 'string', dynamic: true, mandatory: true, description: 'Component text to execute (e.g., "pipeline(\'%$data%\', filter(\'%active%\'), count())")' },
      { id: 'setupCode', as: 'string', description: 'Helper components or JavaScript code to set up context (e.g., "Const(\'data\', [{active: true}])")' },
      { id: 'filePath', as: 'string', mandatory: true, description: 'Relative file path for import context (e.g., "packages/common/test.js")' },
      { id: 'repoRoot', as: 'string', mandatory: true, description: 'Absolute path to repository root' },
      { id: 'probe', as: 'string', description: 'Set to "true" to enable probe mode. Use __ in compText to see data flow at that point. Example: "pipeline(data, filter(condition), __)"' }
    ],
    impl: async (ctx, args) => {
      try {
        jb.coreRegistry.repoRoot = args.repoRoot
        const snippetArgs = { 
          ...args, 
          compText: args.compText.profile, 
          filePath: pathJoin(args.repoRoot, args.filePath) 
        }
        const res = await coreUtils.runSnippetCli(snippetArgs)
        return {
          content: [{ type: 'text', text: JSON.stringify({...res, tokens: coreUtils.estimateTokens(snippetArgs.compText)}) }],
          isError: false
        }
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error running snippet: ${error.message}` }],
          isError: true
        }
      }
    }
})
  
Tool('runSnippets', {
    description: 'run multiple comp snippets in parallel. Useful for running a batch of Test or Data snippets.',
    params: [
      { id: 'compTexts', type: 'data<common>[]', dynamic: true, mandatory: true, description: 'Array of compText strings, each a snippet to run' },
      { id: 'setupCode', as: 'string', description: 'Helper comps or any js code before the comp' },
      { id: 'filePath', as: 'string', mandatory: true, description: 'relative filePath of javascript file in the repo' },
      { id: 'repoRoot', as: 'string', mandatory: true, description: 'filePath of the relevant repo of the project' }
    ],
    impl: async (ctx, { compTexts, setupCode, filePath, repoRoot }) => {
      try {
        jb.coreRegistry.repoRoot = args.repoRoot
        const snippetArgsBase = { setupCode, filePath: pathJoin(repoRoot, filePath) }
        const compTextsProfiles = typeof compTexts.profile == 'string' ? JSON.parse(compTexts.profile) : compTexts.profile
        
        const results = await Promise.all(
          compTextsProfiles.map(async (compText, index) => {
            try {
              const snippetArgs = { ...snippetArgsBase, compText }
              const result = await coreUtils.runSnippetCli(snippetArgs)
              return `Snippet ${compText} ===\n${JSON.stringify({...result, tokens: coreUtils.estimateTokens(snippetArgs.compText)})}`
            } catch (error) {
              return `Snippet ${compText} ===\nerror: ${error.message}`
            }
          })
        )
        
        return {
          content: [{ type: 'text', text: results.join('\n\n') }],
          isError: false
        }
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error running snippets: ${error.message}` }],
          isError: true
        }
      }
    }
})
  
Tool('evalJs', {
  description: 'Execute JavaScript code and return the result. Useful for quick calculations, file operations, and testing code snippets.',
  params: [
    { id: 'code', newLinesInCode: true, dynamic: true, as: 'string', mandatory: true, description: 'JavaScript code to execute. Use process.stdout.write(result) to return output' }
  ],
  impl: typeAdapter('data<common>', runNodeScript({ script: ({},{},{code}) => code.profile }))
})


// Tool('dslDocs', {
//   description: 'Get comprehensive DSL documentation including TGP model, LLM guides, and component definitions',
//   params: [
//     { id: 'dsl', as: 'string', mandatory: true, description: 'DSL name (e.g., "common", "ui", "testing")' },
//     { id: 'repoRoot', as: 'string', mandatory: true, description: 'filePath of the relevant repo of the project' }
//   ],
//   impl: async (ctx, args) => {
//     try {
//       const res = await coreUtils.dslDocs(args)
//       return {
//         content: [{ type: 'text', text: JSON.stringify(res) }],
//         isError: false
//       }
//     } catch (error) {
//       return {
//         content: [{ type: 'text', text: `Error getting DSL docs: ${error.message}` }],
//         isError: true
//       }
//     }
//   }
// })

Data('scrambleText', {
  description: 'Scramble/unscramble text for hiding answers in learning materials.',
  params: [
    {id: 'text', as: 'string', mandatory: true},
    {id: 'unscramble', as: 'boolean'}
  ],
  impl: (ctx, { text, unscramble }) => unscramble ? atob(text.split('').reverse().join('')) : btoa(text).split('').reverse().join('')
})
const { scrambleText } = dsls.common.data

Tool('scrambleTextTool', {
  description: 'Scramble/unscramble texts for hiding answers in learning materials',
  params: [
    {id: 'texts', as: 'string', mandatory: true, description: 'separated by ##'},
    {id: 'unscramble', as: 'boolean'}
  ],
  impl: typeAdapter('data<common>', pipeline(
    '%$texts%',
    split('##'),
    scrambleText('%%', '%$unscramble%'),
    join('##\n'),
    ({data}) => ({ 
      content: [{ type: 'text', text: data }], 
      isError: false 
    }),
    first()
  ))
})

