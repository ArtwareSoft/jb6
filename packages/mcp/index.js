import { coreUtils } from '@jb6/core'
import { startMcpServer } from './mcp-utils.js'
import './mcp-jb-tools.js'
import './mcp-fs-tools.js'
//import './todo-prog-tools.js'

//console.error('Starting jb6 MCP server script...')
if (coreUtils.isNode) {
    const args = process.argv.slice(2)
    if (args[0] == '--start') {
        //console.error('Starting jb6 MCP server...')
        ;(async function f() {
            try {
                await import('@jb6/llm-api/llm-api-mcp-tools.js')
            } catch(e) {
                debugger
            }
            startMcpServer().catch((error) => {
                console.error("jb6 Server error:", error)
                process.exit(1)
            })
        })()
    }
}
