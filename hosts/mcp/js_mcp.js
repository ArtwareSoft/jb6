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
    const { code } = args
    
    return new Promise((resolve) => {
      
      //const fullCode = `(async()=>{try{const _=await(async()=>{${code}})();console.log(JSON.stringify({result:_}))}catch(e){console.error(JSON.stringify({error:e.message}));process.exit(1)}})()`
      
      const proc = spawn(process.execPath, ['-e', code], { 
        cwd: process.cwd(), 
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
  } else {
    throw new Error(`Unknown tool: ${name}`)
  }
})

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error("JS Eval MCP server running on stdio")
}

main().catch((error) => {
  console.error("Server error:", error)
  process.exit(1)
})