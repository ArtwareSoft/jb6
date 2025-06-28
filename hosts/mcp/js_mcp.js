#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js"
import { spawn } from 'child_process'

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