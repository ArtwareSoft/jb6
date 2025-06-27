#!/usr/bin/env node

import { spawn } from 'child_process'
import { stdin, stdout } from 'process'
import { createInterface } from 'readline'

const tool = {
  name: 'eval-snippet',
  title: 'Evaluate JS snippet', 
  description: 'Apply in-memory imports and execute a JavaScript snippet',
  inputSchema: {
    type: 'object',
    properties: {
      imports: { type: 'object', additionalProperties: { type: 'string' } },
      snippet: { type: 'string' }
    },
    required: ['snippet']
  }
}

let initialized = false

// Use readline to handle line-by-line JSON parsing
const rl = createInterface({ input: stdin })

rl.on('line', (line) => {
  if (!line.trim()) return
  handleRequest(line.trim())
})

function sendResponse(obj) {
  stdout.write(JSON.stringify(obj) + '\n')
}

function sendError(id, code, message) {
  sendResponse({ jsonrpc: '2.0', id, error: { code, message } })
}

async function handleRequest(jsonStr) {
  let req
  try {
    req = JSON.parse(jsonStr)
  } catch (e) {
    sendError(null, -32700, 'Parse error')
    return
  }

  const { id, method, params } = req

  if (method === 'initialize') {
    initialized = true
    sendResponse({
      jsonrpc: '2.0', id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'eval-snippet-server', version: '1.0.0' }
      }
    })
    return
  }

  if (method === 'initialized' || method === 'notifications/initialized') {
    // No response needed for notifications
    return
  }

  if (method === 'tools/list') {
    sendResponse({ jsonrpc: '2.0', id, result: { tools: [tool] } })
    return
  }

  if (method === 'tools/call') {
    const { imports = {}, snippet } = params.arguments || {}
    
    if (!snippet) {
      sendError(id, -32602, 'Missing snippet parameter')
      return
    }

    const importLines = Object.entries(imports)
      .map(([alias, path]) => `const ${alias} = require('${path}')`)
      .join('\n')
    
    const code = `${importLines}\n;(async()=>{try{const _=await(async()=>{${snippet}})();console.log(JSON.stringify({result:_}))}catch(e){console.error(JSON.stringify({error:e.message}));process.exit(1)}})()`
    
    const proc = spawn(process.execPath, ['-e', code], { 
      cwd: process.cwd(), 
      stdio: ['ignore', 'pipe', 'pipe'] 
    })
    
    let out = '', err = ''
    proc.stdout.on('data', c => out += c)
    proc.stderr.on('data', c => err += c)
    
    const exit = await new Promise(resolve => proc.on('close', resolve))
    
    if (exit === 0) {
      let parsed
      try { parsed = JSON.parse(out) } catch { parsed = null }
      const text = parsed?.result != null ? String(parsed.result) : out.trim()
      sendResponse({ 
        jsonrpc: '2.0', id, 
        result: { content: [{ type: 'text', text }], isError: false } 
      })
    } else {
      const msg = err.trim() || `Process exited with code ${exit}`
      sendResponse({ 
        jsonrpc: '2.0', id, 
        result: { content: [{ type: 'text', text: msg }], isError: true } 
      })
    }
    return
  }

  sendError(id, -32601, `Method not found: ${method}`)
}