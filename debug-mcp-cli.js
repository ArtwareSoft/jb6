#!/usr/bin/env node

/**
 * Debug CLI for JB6 MCP Server
 * Usage: echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | node debug-mcp-cli.js
 * Usage: echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"tgpModel","arguments":{"repoRoot":"/home/shaiby/projects/jb6"}}}' | node debug-mcp-cli.js
 */

import { readFileSync } from 'fs'
import { coreUtils } from '@jb6/core'
import { startMcpServer } from './packages/mcp/mcp-utils.js'
import './packages/mcp/mcp-tools.js'
import './packages/mcp/mcp-fs-tools.js'

// Enable debug mode
process.env.DEBUG = 'true'

// Enhanced logging
const originalConsoleError = console.error
console.error = (...args) => {
  originalConsoleError('[DEBUG]', new Date().toISOString(), ...args)
}

console.error('Starting JB6 MCP Debug CLI...')

// Process command line arguments
const args = process.argv.slice(2)