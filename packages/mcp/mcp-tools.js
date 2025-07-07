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

Tool('evalJs', {
    description: 'Execute JavaScript code and return the result. Useful for quick calculations, file operations, and testing code snippets.',
    params: [
      { id: 'code', newLinesInCode: true, dynamic: true, as: 'string', mandatory: true, description: 'JavaScript code to execute. Use process.stdout.write(result) to return output' }
    ],
    impl: typeAdapter('data<common>', runNodeScript({ script: ({},{},{code}) => code.profile }))
})
  
Tool('tgpModel', {
    description: 'get TGP (Type-generic component-profile) model relevant for imports and exports of path',
    params: [
      { id: 'repoRoot', as: 'string', mandatory: true, description: 'filePath of the relevant repo of the project. when exist use top mono repo' },
      { id: 'filePath', as: 'string', description: 'relative starting point to filter the model. when not exist, return the model of the repo' },
    ],
    impl: typeAdapter('data<common>', runNodeScript({ 
      script: ({},{},{repoRoot,filePath}) => `
  import { coreUtils } from '@jb6/core'
  import '@jb6/core/misc/calc-import-map.js'
  import '@jb6/lang-service'

  const filePath = '${pathJoin(repoRoot,filePath)}'
  const res = await coreUtils.calcTgpModelData({ filePath })
  process.stdout.write(JSON.stringify(res))
      `,
      repoRoot: '%$repoRoot%'
    }))
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
    impl: typeAdapter('data<common>', runNodeScript({
      script: ({},{},args) => `
  import { coreUtils } from '@jb6/core'
  import '@jb6/core/misc/calc-import-map.js'
  import '@jb6/lang-service'
  
  const snippetArgs = ${JSON.stringify({ ...args, compText: args.compText.profile, filePath: pathJoin(args.repoRoot, args.filePath) })}
  const res = await coreUtils.runSnippetCli(snippetArgs)
  process.stdout.write(JSON.stringify({...res, tokens: coreUtils.estimateTokens(snippetArgs.compText)}))
      `,
      repoRoot: '%$repoRoot%'
    }))
})
  
Tool('runSnippets', {
    description: 'run multiple comp snippets in parallel. Useful for running a batch of Test or Data snippets.',
    params: [
      { id: 'compTexts', type: 'data<common>[]', dynamic: true, mandatory: true, description: 'Array of compText strings, each a snippet to run' },
      { id: 'setupCode', as: 'string', description: 'Helper comps or any js code before the comp' },
      { id: 'filePath', as: 'string', mandatory: true, description: 'relative filePath of javascript file in the repo' },
      { id: 'repoRoot', as: 'string', mandatory: true, description: 'filePath of the relevant repo of the project' }
    ],
    impl: (ctx, { compTexts, setupCode, filePath, repoRoot }) => {
      const snippetArgsBase = { setupCode, filePath: pathJoin(repoRoot, filePath) }
      const compTextsProfiles = typeof compTexts.profile == 'string' ? JSON.parse(compTexts.profile) : compTexts.profile
      const results = Promise.all(
        compTextsProfiles.map(async (compText, index) => {
          try {
            const result = await runNodeScript.$run({
              script: `
  import { coreUtils } from '@jb6/core'
  import '@jb6/core/misc/calc-import-map.js'
  import '@jb6/lang-service'
  
  const snippetArgs = ${JSON.stringify({ ...snippetArgsBase, compText })}
  const res = await coreUtils.runSnippetCli(snippetArgs)
  process.stdout.write(JSON.stringify({...res, tokens: coreUtils.estimateTokens(snippetArgs.compText)})) 
              `,
              repoRoot
            })
            return `Snippet ${compText} ===\\n${result.content?.[0]?.text || 'No output'}`
          } catch (error) {
            return `Snippet ${compText} ===\\nerror: ${error.message}`
          }
        })
      )
      
      return results.then(allResults => ({
        content: [{ type: 'text', text: allResults.join('\\n\\n') }],
        isError: false
      }))
    }
})
  
Tool('getFilesContent', {
    description: 'Read the content of one or more files from the repository. Essential for understanding existing code before making changes.',
    params: [
      { id: 'filesPaths', as: 'string', mandatory: true, description: 'Comma-separated relative file paths (e.g., "packages/common/jb-common.js,packages/ui/ui-core.js")' },
      { id: 'repoRoot', as: 'string', mandatory: true, description: 'Absolute path to repository root' }
    ],
    impl: async (ctx, { filesPaths, repoRoot }) => {
      try {
        const { readFileSync } = await import('fs')
        const { pathJoin, estimateTokens } = coreUtils
        
        const files = filesPaths.split(',').map(filePath => {
          const fullPath = pathJoin(repoRoot, filePath.trim())
          const fileContent = readFileSync(fullPath, 'utf8')
          return {
            filePath: filePath.trim(),
            content: fileContent,
            tokens: estimateTokens(fileContent)
          }
        })
        
        // Format for MCP server - readable content with file separators
        const formattedContent = files.map(file => 
          `=== File: ${file.filePath} (${file.tokens} tokens) ===\n${file.content}`
        ).join('\n\n')
        
        return {
          content: [{ type: 'text', text: formattedContent }],
          isError: false
        }
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error reading files: ${error.message}` }],
          isError: true
        }
      }
    }
})
  
Tool('replaceComponent', {
    description: 'Replace a component in a file with new component text',
    params: [
      { id: 'filePath', as: 'string', mandatory: true, description: 'relative filePath of the file in the repo' },
      { id: 'repoRoot', as: 'string', mandatory: true, description: 'filePath of the relevant repo of the project' },
      { id: 'newCompText', as: 'string', dynamic: true, mandatory: true, description: 'new component text to replace with' },
      { id: 'oldCompText', as: 'string', dynamic: true, mandatory: true, description: 'old component text to find and replace' }
    ],
    impl: typeAdapter('data<common>', runNodeScript({
      script: ({},{},args) => `
  import { readFileSync, writeFileSync } from 'fs'
  import { join } from 'path'
  
  try {
    const {repoRoot, filePath, oldCompText, newCompText} = ${JSON.stringify({...args, newCompText: args.newCompText.profile, oldCompText: args.oldCompText.profile})}
    const fullPath = join(repoRoot, filePath)
    const content = readFileSync(fullPath, 'utf8')
    
    if (!content.includes(oldCompText)) {
      process.stdout.write(JSON.stringify({ error: 'Old component text not found in file' }))
    } else {
      const newContent = content.replace(oldCompText, newCompText)
      writeFileSync(fullPath, newContent, 'utf8')
      process.stdout.write(JSON.stringify({ result: 'Component replaced successfully' }))
    }
  } catch (error) {
    process.stdout.write(JSON.stringify({ error: error.message }))
  }
      `,
      repoRoot: '%$repoRoot%'
    }))
})

Tool('appendToFile', {
  description: 'Add a timestamp to a file, useful for logging or tracking changes.',
  params: [
    {id: 'filePath', as: 'string', mandatory: true, description: 'Relative file path where timestamp will be added'},
    {id: 'repoRoot', as: 'string', mandatory: true, description: 'Absolute path to repository root'},
    {id: 'content', as: 'string', dynamic: true, mandatory: true, description: 'Content to add to the file'},
    {id: 'override', as: 'boolean', description: 'overrides existing content'},
    {id: 'timeStamp', as: 'boolean', description: 'If true, prepend a timestamp to the content'}
  ],
  impl: typeAdapter('data<common>', runNodeScript({
    script: (ctx,{},args) => `
  import { readFileSync, writeFileSync } from 'fs'
  import { join } from 'path'

  try {
    const {repoRoot, filePath, content, timeStamp, override} = ${JSON.stringify({...args, content: args.content.profile })}
    const fullPath = join(repoRoot, filePath)
    
    let existingContent = ''
    try {
      if (!override)
        existingContent = readFileSync(fullPath, 'utf8')
    } catch (error) {
      // File doesn't exist, will create new file
    }
    
    const dateTime = new Date().toISOString()
    const contentToAdd = timeStamp ? '[' + dateTime + '] ' + content : content
    const newContent = existingContent + (existingContent ? '\\n' : '') + contentToAdd
    writeFileSync(fullPath, newContent, 'utf8')
    process.stdout.write(JSON.stringify({ result: 'Content added successfully' }))
  } catch (error) {
    process.stdout.write(JSON.stringify({ error: error.message }))
  }
      `,
    repoRoot: '%$repoRoot%'
  }))
})

Tool('saveToFile', {
  description: 'save text into a new file. if file exists, it appends to it',
  params: [
    {id: 'filePath', as: 'string', mandatory: true, description: 'Relative file path where timestamp will be added'},
    {id: 'repoRoot', as: 'string', mandatory: true, description: 'Absolute path to repository root'},
    {id: 'content', as: 'string', dynamic: true, mandatory: true, description: 'Content to add to the file'}
  ],
  impl: appendToFile('%$filePath%', '%$repoRoot%', { content: '%$content%', override: true })
})

Tool('dslDocs', {
  description: 'Get comprehensive DSL documentation including TGP model, LLM guides, and component definitions',
  params: [
    { id: 'dsl', as: 'string', mandatory: true, description: 'DSL name (e.g., "common", "ui", "testing")' },
    { id: 'repoRoot', as: 'string', mandatory: true, description: 'filePath of the relevant repo of the project' }
  ],
  impl: typeAdapter('data<common>', runNodeScript({
    script: ({},{},args) => `
  import { coreUtils } from '@jb6/core'
  import '@jb6/core/misc/calc-import-map.js'
  import '@jb6/lang-service'
  
  const res = await coreUtils.dslDocs(${JSON.stringify(args)})
  process.stdout.write(JSON.stringify(res))
      `,
    repoRoot: '%$repoRoot%'
  }))
})

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
    }), first()
  ))
})

