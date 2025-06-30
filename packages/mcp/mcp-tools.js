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
      { id: 'code', newLinesInCode: true, as: 'string', mandatory: true, description: 'JavaScript code to execute' }
    ],
    impl: typeAdapter('data<common>', runNodeScript({ script: '%$code%' }))
})
  
Tool('tgpModel', {
    description: 'get TGP (Type-generic component-profile) model relevant for imports and exports of path',
    params: [
      { id: 'filePath', as: 'string', mandatory: true, description: 'relative filePath of javascript file in the repo' },
      { id: 'repoRoot', as: 'string', mandatory: true, description: 'filePath of the relevant repo of the project. when exist use top mono repo' }
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
      { id: 'compText', as: 'string', mandatory: true, description: 'Component text to execute' },
      { id: 'setupCode', as: 'string', description: 'Helper comps or any js code before the comp' },
      { id: 'filePath', as: 'string', mandatory: true, description: 'relative filePath of javascript file in the repo' },
      { id: 'repoRoot', as: 'string', mandatory: true, description: 'filePath of the relevant repo of the project' }
    ],
    impl: typeAdapter('data<common>', runNodeScript({
      script: ({},{},args) => `
  import { coreUtils } from '@jb6/core'
  import '@jb6/core/misc/calc-import-map.js'
  import '@jb6/lang-service'
  
  const snippetArgs = ${JSON.stringify({ ...args, filePath: join(args.repoRoot, args.filePath) })}
  const res = await coreUtils.runSnippetCli(snippetArgs)
  process.stdout.write(JSON.stringify(res))
      `,
      repoRoot: '%$repoRoot%'
    }))
})
  
Tool('runSnippets', {
    description: 'run multiple comp snippets in parallel. Useful for running a batch of Test or Data snippets.',
    params: [
      { id: 'compTexts', type: 'data<common>[]', mandatory: true, description: 'Array of compText strings, each a snippet to run' },
      { id: 'setupCode', as: 'string', description: 'Helper comps or any js code before the comp' },
      { id: 'filePath', as: 'string', mandatory: true, description: 'relative filePath of javascript file in the repo' },
      { id: 'repoRoot', as: 'string', mandatory: true, description: 'filePath of the relevant repo of the project' }
    ],
    impl: (ctx, { compTexts, setupCode, filePath, repoRoot }) => {
      const snippetArgsBase = { setupCode, filePath: join(repoRoot, filePath) }
      const results = Promise.all(
        compTexts.map(async (compText, index) => {
          try {
            const result = await runNodeScript({
              script: `
  import { coreUtils } from '@jb6/core'
  import '@jb6/core/misc/calc-import-map.js'
  import '@jb6/lang-service'
  
  const snippetArgs = ${JSON.stringify({ ...snippetArgsBase, compText })}
  const res = await coreUtils.runSnippetCli(snippetArgs)
  process.stdout.write(JSON.stringify(res))
              `,
              repoRoot
            })
            return `=== Snippet ${index + 1} ===\n${result.content?.[0]?.text || 'No output'}`
          } catch (error) {
            return `Snippet ${index + 1} error: ${error.message}`
          }
        })
      )
      
      return results.then(allResults => ({
        content: [{ type: 'text', text: allResults.join('\n\n') }],
        isError: false
      }))
    }
})
  
Tool('getFileContent', {
    description: 'Get the content of a file in the repository',
    params: [
      { id: 'filePath', as: 'string', mandatory: true, description: 'relative filePath of the file in the repo' },
      { id: 'repoRoot', as: 'string', mandatory: true, description: 'filePath of the relevant repo of the project' }
    ],
    impl: typeAdapter('data<common>', runNodeScript({
      script: ({},{},args) =>`
  import { readFileSync } from 'fs'
  import { join } from 'path'
  
  try {
    const {repoRoot,filePath} = ${JSON.stringify(args)}
    const content = readFileSync(join(repoRoot, filePath), 'utf8')
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
      { id: 'newCompText', as: 'string', mandatory: true, description: 'new component text to replace with' },
      { id: 'oldCompText', as: 'string', mandatory: true, description: 'old component text to find and replace' }
    ],
    impl: typeAdapter('data<common>', runNodeScript({
      script: ({},{},args) => `
  import { readFileSync, writeFileSync } from 'fs'
  import { join } from 'path'
  
  try {
    const {repoRoot, filePath, oldCompText, newCompText} = ${JSON.stringify(args)}
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
      { id: 'newCompText', as: 'string', mandatory: true, description: 'new component text to add to the file' }
    ],
    impl: typeAdapter('data<common>', runNodeScript({
      script: ({},{},args) => `
  import { readFileSync, writeFileSync } from 'fs'
  import { join } from 'path'
  
  try {
    const {repoRoot, filePath, newCompText} = ${JSON.stringify(args)}
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
      { id: 'newContent', as: 'string', mandatory: true, description: 'new content to replace entire file' }
    ],
    impl: typeAdapter('data<common>', runNodeScript({
      script: ({},{},args) => `
  import { writeFileSync } from 'fs'
  import { join } from 'path'
  
  try {
    const {repoRoot, filePath, newContent} = ${JSON.stringify(args)}
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