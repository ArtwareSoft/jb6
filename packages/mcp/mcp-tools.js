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
  import { join } from 'path'

  const filePath = '${join(repoRoot,filePath)}'
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

Tool('appendToFile', {
    description: 'Append content to the end of an existing file. Useful for adding new components or content without overwriting existing code.',
    params: [
      { id: 'filePath', as: 'string', mandatory: true, description: 'Relative file path where content will be appended' },
      { id: 'repoRoot', as: 'string', mandatory: true, description: 'Absolute path to repository root' },
      { id: 'content', as: 'string', dynamic: true, mandatory: true, description: 'Content to append to the file (will add newline before content automatically)' }
    ],
    impl: typeAdapter('data<common>', runNodeScript({
      script: ({},{},args) => `
  import { readFileSync, writeFileSync } from 'fs'
  import { join } from 'path'
  
  try {
    const {repoRoot, filePath, content} = ${JSON.stringify({...args, content: args.content.profile})}
    const fullPath = join(repoRoot, filePath)
    
    let existingContent = ''
    try {
      existingContent = readFileSync(fullPath, 'utf8')
    } catch (error) {
      // File doesn't exist, will create new file
    }
    
    const newContent = existingContent + (existingContent ? '\\n' : '') + content
    writeFileSync(fullPath, newContent, 'utf8')
    process.stdout.write(JSON.stringify({ result: 'Content appended successfully' }))
  } catch (error) {
    process.stdout.write(JSON.stringify({ error: error.message }))
  }
      `,
      repoRoot: '%$repoRoot%'
    }))
})

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
