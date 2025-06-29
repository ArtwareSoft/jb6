#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js"
import { spawn } from 'child_process'
import { join } from 'path'

const server = new Server(
  {
    name: "js-eval-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
)

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "eval_js",
        description: `Execute JavaScript code and return the result. use process.stdout.write() for output`,
        inputSchema: {
          type: "object",
          properties: {
            code: {
              type: "string",
              description: "JavaScript code to execute",
            },
          },
          required: ["code"],
        },
      },
      {
        name: "tgpModel",
        description: `get TGP (Type-generic component-profile) model relevant for imports and exports of path`,
        inputSchema: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "relative filePath of javascript file in the repo",
            },
            repoRoot: {
              type: "string",
              description: "filePath of the relevant repo of the project. when exist use top mono repo",
            },
          },
          required: ["filePath","repoRoot"],
        },
      },
      {
        name: "runSnippet",
        description: `run comp snippest. usefull for Test and Data, in dataTest use includeTestRes to see the calculated result`,
        inputSchema: {
          type: "object",
          properties: {
            compText: {
              type: "string",
              description: `E.g. Test('piplineTest.filter', {
  impl: dataTest(pipeline('%$people%', filter('%age%==42'), '%name%'), equals('Homer Simpson'), {
    includeTestRes: true
  })
    or Data('x', {impl: pipeline(list(1,2,3), join()) })
})`,
            },
            setupCode: {
              type: "string",
              description: `use only dynamic imports here. do not add dsls expression, it is auto injected. add helper comps or any js code before the comp. E.g, Const('people', [
    {name: 'Homer Simpson', age: 42, male: true},
    {name: 'Marge Simpson', age: 38, male: false},
    {name: 'Bart Simpson', age: 12, male: true}
])
`,
            },
            filePath: {
              type: "string",
              description: "relative filePath of javascript file in the repo. the filePath is used to calculte the relevant packages to import",
            },
            repoRoot: {
              type: "string",
              description: "filePath of the relevant repo of the project. use top mono repo in jb6 project",
            },
          },
          required: ["compText","filePath","repoRoot"],
        },
      },
      {
        name: "runSnippets",
        description: `run multiple comp snippets in parallel. Useful for running a batch of Test or Data snippets.`,
        inputSchema: {
          type: "object",
          properties: {
            compTexts: {
              type: "array",
              items: { type: "string" },
              description: "Array of compText strings, each a snippet to run."
            },
            setupCode: {
              type: "string",
              description: "Helper comps or any js code before the comp. E.g, Const('people', ...)"
            },
            filePath: {
              type: "string",
              description: "relative filePath of javascript file in the repo."
            },
            repoRoot: {
              type: "string",
              description: "filePath of the relevant repo of the project."
            }
          },
          required: ["compTexts", "filePath", "repoRoot"]
        }
      },
      {
        name: "getFileContent",
        description: `Get the content of a file in the repository`,
        inputSchema: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "relative filePath of the file in the repo"
            },
            repoRoot: {
              type: "string",
              description: "filePath of the relevant repo of the project"
            }
          },
          required: ["filePath", "repoRoot"]
        }
      },
      {
        name: "replaceComponent",
        description: `Replace a component in a file with new component text`,
        inputSchema: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "relative filePath of the file in the repo"
            },
            repoRoot: {
              type: "string",
              description: "filePath of the relevant repo of the project"
            },
            newCompText: {
              type: "string",
              description: "new component text to replace with"
            },
            oldCompText: {
              type: "string",
              description: "old component text to find and replace"
            }
          },
          required: ["filePath", "repoRoot", "newCompText", "oldCompText"]
        }
      },
      {
        name: "addComponent",
        description: `Add a new component to a file`,
        inputSchema: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "relative filePath of the file in the repo"
            },
            repoRoot: {
              type: "string",
              description: "filePath of the relevant repo of the project"
            },
            newCompText: {
              type: "string",
              description: "new component text to add to the file"
            }
          },
          required: ["filePath", "repoRoot", "newCompText"]
        }
      },
    ],
  }
})


server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  if (name === "eval_js") {
    return evalCode(args.code)    
  } else if (name === "tgpModel") {
    return evalCode(`
import { coreUtils } from '@jb6/core'
import '@jb6/core/misc/calc-import-map.js'
import '@jb6/lang-service'

import { execSync } from 'child_process'
import { join } from 'path'

const res = await coreUtils.calcTgpModelData({ filePath: join('${args.repoRoot}','${args.filePath}') })
process.stdout.write(JSON.stringify(res))
      `,args.repoRoot)
  } else if (name === "runSnippet") {
    const snippetArgs = { ...args, filePath: join(args.repoRoot, args.filePath) }

      return evalCode(`
  import { coreUtils } from '@jb6/core'
  import '@jb6/core/misc/calc-import-map.js'
  import '@jb6/lang-service'
  
  import { execSync } from 'child_process'
  import { join } from 'path'
  
  const res = await coreUtils.runSnippetCli(${JSON.stringify(snippetArgs)})
  process.stdout.write(JSON.stringify(res))
        `,args.repoRoot)
  } else if (name === "runSnippets") {
    const { compTexts, setupCode, filePath, repoRoot } = args
    const snippetArgsBase = { setupCode, filePath: join(repoRoot, filePath) }
    
    const results = await Promise.all(
      compTexts.map(async (compText) => {
        try {
          const snippetArgs = { ...snippetArgsBase, compText }
          return await evalCode(`
  import { coreUtils } from '@jb6/core'
  import '@jb6/core/misc/calc-import-map.js'
  import '@jb6/lang-service'
  
  import { execSync } from 'child_process'
  import { join } from 'path'
  
  const res = await coreUtils.runSnippetCli(${JSON.stringify(snippetArgs)})
  process.stdout.write(JSON.stringify(res))
          `, repoRoot)
        } catch (error) {
          return { error: error.message, isError: true }
        }
      })
    )
    
    // Flatten the results: extract content from each evalCode result
    const allContent = []
    let hasError = false
    
    results.forEach((result, index) => {
      if (result.isError) {
        hasError = true
        allContent.push({
          type: 'text',
          text: `Snippet ${index + 1} error: ${result.content?.[0]?.text || 'Unknown error'}`
        })
      } else {
        // Add snippet separator for clarity
        allContent.push({
          type: 'text', 
          text: `=== Snippet ${index + 1} ===\n${result.content?.[0]?.text || 'No output'}`
        })
      }
    })
    
    // Return in the same format as other tools: { content: [...], isError: ... }
    return {
      content: allContent,
      isError: hasError
    }
  } else if (name === "getFileContent") {
    return evalCode(`
import { readFileSync } from 'fs'
import { join } from 'path'

try {
  const content = readFileSync(join('${args.repoRoot}', '${args.filePath}'), 'utf8')
  process.stdout.write(JSON.stringify({ result: content }))
} catch (error) {
  process.stdout.write(JSON.stringify({ error: error.message }))
}
    `, args.repoRoot)
  } else if (name === "replaceComponent") {
    return evalCode(`
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

try {
  const filePath = join('${args.repoRoot}', '${args.filePath}')
  const content = readFileSync(filePath, 'utf8')
  const oldCompText = ${JSON.stringify(args.oldCompText)}
  const newCompText = ${JSON.stringify(args.newCompText)}
  
  if (!content.includes(oldCompText)) {
    process.stdout.write(JSON.stringify({ error: 'Old component text not found in file' }))
  } else {
    const newContent = content.replace(oldCompText, newCompText)
    writeFileSync(filePath, newContent, 'utf8')
    process.stdout.write(JSON.stringify({ result: 'Component replaced successfully' }))
  }
} catch (error) {
  process.stdout.write(JSON.stringify({ error: error.message }))
}
    `, args.repoRoot)
  } else if (name === "addComponent") {
    return evalCode(`
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

try {
  const filePath = join('${args.repoRoot}', '${args.filePath}')
  const content = readFileSync(filePath, 'utf8')
  const newCompText = ${JSON.stringify(args.newCompText)}
  
  // Add the new component at the end of the file (you might want to customize this logic)
  const newContent = content + '\\n' + newCompText
  writeFileSync(filePath, newContent, 'utf8')
  process.stdout.write(JSON.stringify({ result: 'Component added successfully' }))
} catch (error) {
  process.stdout.write(JSON.stringify({ error: error.message }))
}
    `, args.repoRoot)
  } else {
    throw new Error(`Unknown tool: ${name}`)
  }
})

function evalCode(script, repoRoot) {
  const cmd = `node --inspect-brk --input-type=module -e "${script.replace(/"/g, '\\"')}"`

  process.stderr.write(cmd)
  return new Promise((resolve) => {            
    const proc = spawn(process.execPath, ['--input-type=module','-e', script], { 
      cwd: repoRoot || process.cwd(), 
      stdio: ['ignore', 'pipe', 'pipe'] 
    })
    
    let out = '', err = ''
    proc.stdout.on('data', c => out += c)
    proc.stderr.on('data', c => err += c)
    
    proc.on('close', (exit) => {
      if (exit === 0) {
        let parsed
        try { 
          parsed = JSON.parse(out) 
        } catch { 
          parsed = null 
        }
        
        const text = parsed?.result != null ? String(parsed.result) : out.trim()
        resolve({ 
          content: [{ type: 'text', text }], 
          isError: false 
        })
      } else {
        const msg = err.trim() || `Process exited with code ${exit}`
        resolve({ 
          content: [{ type: 'text', text: msg }], 
          isError: true 
        })
      }
    })
  })
}

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error("JS Eval MCP server running on stdio")
}

main().catch((error) => {
  console.error("Server error:", error)
  process.exit(1)
})