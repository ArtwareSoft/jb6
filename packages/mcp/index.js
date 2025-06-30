import { startMcpServer } from './mcp-utils.js'
import './mcp-tools.js'
import './mcp-prompts.js'

startMcpServer().catch((error) => {
    console.error("Server error:", error)
    process.exit(1)
})