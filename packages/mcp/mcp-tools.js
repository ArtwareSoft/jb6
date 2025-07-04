import { dsls } from '@jb6/core'
import { join } from 'path'
  
const {
    common: { 
       data: { runNodeScript }
    },
    tgp: { any: { typeAdapter }},
    mcp: { Tool }
} = dsls

Tool('evalJs', {
    description: 'Execute JavaScript code and return the result',
    params: [
      { id: 'code', newLinesInCode: true, dynamic: true, as: 'string', mandatory: true, description: 'JavaScript code to execute. please use process.stdout.write(result)' }
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
  import { join } from 'path'

  const filePath = '${join(repoRoot,filePath)}'
  const res = await coreUtils.calcTgpModelData({ filePath })
  process.stdout.write(JSON.stringify(res))
      `,
      repoRoot: '%$repoRoot%'
    }))
})
  
Tool('runSnippet', {
    description: 'run comp snippest. usefull for Test and Data, in dataTest use includeTestRes to see the calculated result',
    params: [
      { id: 'compText', as: 'string', dynamic: true, mandatory: true, description: 'Component text to execute' },
      { id: 'setupCode', as: 'string', description: 'Helper comps or any js code before the comp' },
      { id: 'filePath', as: 'string', mandatory: true, description: 'relative filePath of javascript file in the repo' },
      { id: 'repoRoot', as: 'string', mandatory: true, description: 'filePath of the relevant repo of the project' },
      { id: 'probe', as: 'boolean', type: 'boolean', description: `set the result to be the input and output at specific point. 
        the point is set by __ in compText.  The __ acts as a cursor position that shows the data flow at that exact point in the code. do not add extra commas 
        E.g.: compText: pipeline('%$people/name%', __ join() ), compText: '%$people/__%'` }
    ],
    impl: typeAdapter('data<common>', runNodeScript({
      script: ({},{},args) => `
  import { coreUtils } from '@jb6/core'
  import '@jb6/core/misc/calc-import-map.js'
  import '@jb6/lang-service'
  
  const snippetArgs = ${JSON.stringify({ ...args, compText: args.compText.profile, filePath: join(args.repoRoot, args.filePath) })}
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
      const snippetArgsBase = { setupCode, filePath: join(repoRoot, filePath) }
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
            return `Snippet ${compText} ===\n${result.content?.[0]?.text || 'No output'}`
          } catch (error) {
            return `Snippet ${compText} ===\nerror: ${error.message}`
          }
        })
      )
      
      return results.then(allResults => ({
        content: [{ type: 'text', text: allResults.join('\n\n') }],
        isError: false
      }))
    }
})
  
Tool('getFilesContent', {
    description: 'Get the content of a file in the repository',
    params: [
      { id: 'filesPaths', as: 'string', mandatory: true, description: 'comma separated, relative filePath of the file in the repo' },
      { id: 'repoRoot', as: 'string', mandatory: true, description: 'filePath of the relevant repo of the project' }
    ],
    impl: typeAdapter('data<common>', runNodeScript({
      script: ({},{},args) =>`
  import { readFileSync } from 'fs'
  import { join } from 'path'
  import { coreUtils } from '@jb6/core'
  
  try {
    const {repoRoot,filesPaths} = ${JSON.stringify(args)}
    const content = filesPaths.split(',').map(filePath => {
        const content = readFileSync(join(repoRoot, filePath), 'utf8')
        return {filePath, content, tokens: coreUtils.estimateTokens(content)}
      })
    process.stdout.write(JSON.stringify({ result: content }))
  } catch (error) {
    process.stdout.write(JSON.stringify({ error: error.message }))
  }
      `,
      repoRoot: '%$repoRoot%'
    }))
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

Tool('addComponent', {
    description: 'Add a new component to a file',
    params: [
      { id: 'filePath', as: 'string', mandatory: true, description: 'relative filePath of the file in the repo' },
      { id: 'repoRoot', as: 'string', mandatory: true, description: 'filePath of the relevant repo of the project' },
      { id: 'newCompText', as: 'string', dynamic: true, mandatory: true, description: 'new component text to add to the file' }
    ],
    impl: typeAdapter('data<common>', runNodeScript({
      script: ({},{},args) => `
  import { readFileSync, writeFileSync } from 'fs'
  import { join } from 'path'
  
  try {
    const {repoRoot, filePath, newCompText} = ${JSON.stringify(JSON.stringify({...args, newCompText: args.newCompText.profile}))}
    const fullPath = join(repoRoot, filePath)
    const content = readFileSync(fullPath, 'utf8')
    
    const newContent = content + '\\n' + newCompText
    writeFileSync(fullPath, newContent, 'utf8')
    process.stdout.write(JSON.stringify({ result: 'Component added successfully' }))
  } catch (error) {
    process.stdout.write(JSON.stringify({ error: error.message }))
  }
      `,
      repoRoot: '%$repoRoot%'
    }))
})

// Add this to mcp-tools.js

Tool('overrideFileContent', {
    description: 'Override entire file content with new content',
    params: [
      { id: 'filePath', as: 'string', mandatory: true, description: 'relative filePath of the file in the repo' },
      { id: 'repoRoot', as: 'string', mandatory: true, description: 'filePath of the relevant repo of the project' },
      { id: 'newContent', as: 'string', dynamic: true, mandatory: true, description: 'new content to replace entire file' }
    ],
    impl: typeAdapter('data<common>', runNodeScript({
      script: ({},{},args) => `
  import { writeFileSync } from 'fs'
  import { join } from 'path'
  
  try {
    const {repoRoot, filePath, newContent} = ${JSON.stringify({...args, newContent: args.newContent.profile})}
    const fullPath = join(repoRoot, filePath)
    
    writeFileSync(fullPath, newContent, 'utf8')
    process.stdout.write(JSON.stringify({ result: 'File content overridden successfully' }))
  } catch (error) {
    process.stdout.write(JSON.stringify({ error: error.message }))
  }
      `,
      repoRoot: '%$repoRoot%'
    }))
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