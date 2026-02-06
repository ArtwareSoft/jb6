import { coreUtils, jb, dsls } from '@jb6/core'

jb.serverUtils = jb.serverUtils || {}
Object.assign(jb.serverUtils, { serveMcp, serveMcpViaCli })

async function serveMcp(app, { express }) {
  const { StreamableHTTPServerTransport } = await import('@modelcontextprotocol/sdk/server/streamableHttp.js')
  const { startMcpServer } = await import("@jb6/mcp/mcp-utils.js")
  await import('@jb6/mcp/mcp-jb-tools.js')
  await import('@jb6/mcp/mcp-fs-tools.js')

  // Pre-calculate import map once at startup
  await import('@jb6/core/misc/import-map-services.js')
  const { importMap } = await coreUtils.calcImportData()

  app.post("/mcp", express.json({ type: "application/json" }), async (req, res) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    })

    try {
      const exclude = ['text','doclet']
      const allTools = coreUtils.globalsOfTypeIds(dsls.mcp.tool,'all').filter(id => !exclude.includes(id))
      .map(id=>({id, toolComp: dsls.mcp.tool[id][coreUtils.asJbComp] }))

      await startMcpServer(transport, {allTools, importMap})
      await transport.handleRequest(req, res, req.body)

      res.on("close", () => transport.close())
    } catch (error) {
      console.error(error?.stack || error)
      if (!res.headersSent) res.status(500).end()
      transport.close()
    }
  })
}

async function serveMcpViaCli(app, { express }) {
  await import('@jb6/core/misc/import-map-services.js')
  await coreUtils.calcJb6RepoRootAndImportMapsInCli()
  const repoRoot = await coreUtils.calcRepoRoot()
  const { projectDir, importMap, staticMappings } = await coreUtils.calcImportData({forRepo: repoRoot})
  await import('@jb6/mcp/mcp-jb-tools.js')
  await import('@jb6/mcp/mcp-fs-tools.js')

  app.post("/mcp", express.json({ type: "application/json" }), async (req, res) => {
    try {
      const { method, params, id } = req.body

      // Handle initialize - required for MCP handshake
      if (method === 'initialize') {
        return res.json({
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
              resources: {}
            },
            serverInfo: {
              name: 'jb6_mcp',
              version: '1.0.0'
            }
          }
        })
      }

      // Handle initialized notification
      if (method === 'initialized') {
        return res.json({ jsonrpc: '2.0', id, result: {} })
      }

      // Handle tools/list
      if (method === 'tools/list') {
        const exclude = ['text', 'doclet']
        const tools = coreUtils.globalsOfTypeIds(dsls.mcp.tool, 'all')
          .filter(id => !exclude.includes(id))
          .map(id => {
            const toolComp = dsls.mcp.tool[id][coreUtils.asJbComp]
            const isAlsoReactComp = dsls.react?.['react-comp']?.[id] != null
            return {
              name: id,
              description: toolComp.description || `Tool: ${id}`,
              inputSchema: {
                type: 'object',
                properties: (toolComp.params || []).reduce((props, param) => {
                  props[param.id] = { type: param.as === 'number' ? 'number' : 'string', description: param.description || '' }
                  return props
                }, {}),
                required: (toolComp.params || []).filter(p => p.mandatory).map(p => p.id)
              },
              ...(isAlsoReactComp && { _meta: { ui: { resourceUri: `ui://react-comp/${id}` } } })
            }
          })
        return res.json({ jsonrpc: '2.0', id, result: { tools } })
      }

      // Handle tools/call - run the tool via CLI for dynamic code reloading
      if (method === 'tools/call') {
        const { name: toolId, arguments: args } = params
        const isAlsoReactComp = dsls.react?.['react-comp']?.[toolId] != null
        if (isAlsoReactComp)
          return res.json({ jsonrpc: '2.0', id, result: {  content: [{ type: 'text', text: JSON.stringify(args) }],  isError: false} })

        const toolComp = dsls.mcp?.tool?.[toolId]?.[coreUtils.asJbComp]
        if (!toolComp) {
          return res.json({ jsonrpc: '2.0', id, error: { code: -32601, message: `Tool not found: ${toolId}` } })
        }
        const _toolPath = toolComp.$location?.path
        const toolPath = coreUtils.absPathToImportUrl?.(_toolPath, importMap.imports, staticMappings)

        const argsJson = JSON.stringify(args || {})

        const script = `
import { dsls, coreUtils } from '@jb6/core'
await import('${toolPath}')
const result = await dsls.mcp?.tool?.['${toolId}']?.$run(${argsJson})
await coreUtils.writeServiceResult(result)
`
        const cliResult = await coreUtils.runCliInContext(script, {projectDir, importMapsInCli: importMap?.importMapsInCli})
        console.log('mcp result', cliResult)
        const mcpResult = cliResult?.result || { content: [{ type: 'text', text: cliResult?.error?.message || 'CLI error' }], isError: true }
        return res.json({ jsonrpc: '2.0', id, result: mcpResult })
      }

      // Handle resources/list
      if (method === 'resources/list') {
        return res.json({ jsonrpc: '2.0', id, result: { resources: [] } })
      }

      // Handle resources/read - for UI resources
      if (method === 'resources/read') {
        const uri = params.uri

        const match = uri.match(/^ui:\/\/react-comp\/(.+)$/)
        if (match) {
          const compId = match[1]

          // Get source file from component location and calculate import map from it
          const reactComp = dsls.react?.['react-comp']?.[compId]
          const jbComp = reactComp?.[coreUtils.asJbComp]
          const _sourceFile = jbComp?.$location?.path
          const sourceFile = coreUtils.absPathToImportUrl?.(_sourceFile, importMap.imports, staticMappings)
          const urlsToLoad = sourceFile ? [sourceFile] : []

          const { renderReactCompToHtml } = await import('@jb6/mcp/mcp-utils.js')
          const html = renderReactCompToHtml(compId, importMap, urlsToLoad)
          return res.json({ jsonrpc: '2.0', id, result: { contents: [{ uri, mimeType: 'text/html;profile=mcp-app', text: html }] } })
        }
        return res.json({ jsonrpc: '2.0', id, error: { code: -32002, message: `Resource not found: ${uri}` } })
      }

      // Handle ping (optional but good to have)
      if (method === 'ping') {
        return res.json({ jsonrpc: '2.0', id, result: {} })
      }

      // Unknown method
      res.json({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not supported: ${method}` } })
    } catch (error) {
      console.error(error?.stack || error)
      if (!res.headersSent) res.status(500).json({ jsonrpc: '2.0', id: req.body?.id, error: { code: -32603, message: error.stack } })
    }
  })
}