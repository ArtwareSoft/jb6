import { coreUtils } from '@jb6/core'
import '@jb6/core/misc/import-map-services.js'
import { startMcpServer } from './mcp-utils.js'
import './mcp-jb-tools.js'
import './mcp-fs-tools.js'
//import './todo-prog-tools.js'

//console.error('Starting jb6 MCP server script...')
if (coreUtils.isNode) {
    const path = await import('path')

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
        const repoRoot = args[1]
        if (repoRoot && repoRoot.startsWith('--repoRoot='))
            jb.coreRegistry.repoRoot = path.resolve(repoRoot.split('--repoRoot=').pop())
        else 
            jb.coreRegistry.repoRoot = await coreUtils.calcRepoRoot()
        jb.coreRegistry.jb6Root = await coreUtils.calcJb6RepoRoot()
        const extraMcp = `${jb.coreRegistry.repoRoot}/.jb6/mcp.js`

        if (await exists(extraMcp))
            await import(extraMcp)

        try {                  
            await startMcpServer()
        } catch(error) {
            console.error("jb6 Server error:", error)
            process.exit(1)
        }
    }
}

async function exists(path) {
  const { access } = await import('fs/promises')
  return access(path).then(() => true, () => false)
}
