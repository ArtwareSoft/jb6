import { coreUtils } from '@jb6/core'
import { startMcpServer } from './mcp-utils.js'
import './mcp-tools.js'
import './mcp-fs-tools.js'
//import './todo-prog-tools.js'

//console.error('Starting jb6 MCP server script...')
if (coreUtils.isNode) {
    const args = process.argv.slice(2)
    if (args == '--start') {
        //console.error('Starting jb6 MCP server...')
        startMcpServer().catch((error) => {
            console.error("jb6 Server error:", error)
            process.exit(1)
        })
    }
}
