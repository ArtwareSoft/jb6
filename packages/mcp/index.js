import { coreUtils } from '@jb6/core'
import { startMcpServer } from './mcp-utils.js'
import './mcp-jb-tools.js'
import './mcp-fs-tools.js'
//import './todo-prog-tools.js'

//console.error('Starting jb6 MCP server script...')
if (coreUtils.isNode) {
    process.on('SIGINT', () => {
        console.error('Received SIGINT, shutting down...')
        process.exit(0)
    })
      
    process.on('SIGTERM', () => {
        console.error('Received SIGTERM, shutting down...')
        process.exit(0)
    })
    
    process.on('uncaughtException', (error) => {
        console.error('Uncaught exception:', error)
    })
    const args = process.argv.slice(2)
    if (args[0] == '--start') {
        const cwd = args[1]
        if (cwd && cwd.startsWith('--cwd='))
            jb.coreRegistry.repoRoot = cwd.split('--cwd=').pop()
        //console.error('Starting jb6 MCP server...')
        ;(async function f() {
            try {
                await import('@jb6/llm-api/llm-api-mcp-tools.js')
            } catch(e) {
                debugger
            }
            try {
                  
                await startMcpServer()
            } catch(error) {
                console.error("jb6 Server error:", error)
                process.exit(1)
            }
        })()
    }
}
