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

  app.get("/mcp-ui", async (req, res) => {
    try {
      const compId = req.query.compId
      const reactComp = dsls.react?.['react-comp']?.[compId]
      const jbComp = reactComp?.[coreUtils.asJbComp]
      const _sourceFile = jbComp?.$location?.path
      const mapped = coreUtils.absPathToImportUrl?.(_sourceFile, importMap.imports, staticMappings)
      const sourceFile = mapped && !mapped.startsWith('undefined') ? mapped
        : _sourceFile?.startsWith(repoRoot) ? `/genie${_sourceFile.slice(repoRoot.length)}` : null
      const urlsToLoad = sourceFile ? [sourceFile] : []
      const { renderReactCompToHtml } = await import('@jb6/mcp/mcp-utils.js')
      res.type('html').send(renderReactCompToHtml(compId, importMap, urlsToLoad))
    } catch(e) { res.status(500).send(e.message) }
  })

  app.post("/mcp", express.json({ type: "application/json" }), async (req, res) => {
    const origin = `${req.get('x-forwarded-proto') || req.protocol}://${req.get('x-forwarded-host') || req.get('host')}`
    const wantsSSE = (req.headers.accept || '').includes('text/event-stream')
    const sendJson = (data) => {
      if (wantsSSE) {
        res.setHeader('Content-Type', 'text/event-stream')
        res.write(`event: message\ndata: ${JSON.stringify(data)}\n\n`)
        res.end()
      } else {
        res.json(data)
      }
    }
    try {
      const { method, params, id } = req.body

      // Handle initialize - required for MCP handshake
      if (method === 'initialize') {
        return sendJson({
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2025-06-18',
            capabilities: {
              tools: {},
              resources: {},
              extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: ['text/html;profile=mcp-app'] } }
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
        return sendJson({ jsonrpc: '2.0', id, result: {} })
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
              ...(isAlsoReactComp && { _meta: { ui: { resourceUri: `ui://react-comp/${id}`, csp: { resourceDomains: [origin], connectDomains: [origin], baseUriDomains: [origin] } } } })
            }
          })
        return sendJson({ jsonrpc: '2.0', id, result: { tools } })
      }

      // Handle tools/call - run the tool via CLI for dynamic code reloading
      if (method === 'tools/call') {
        const { name: toolId, arguments: args } = params
        const isAlsoReactComp = dsls.react?.['react-comp']?.[toolId] != null
        if (isAlsoReactComp)
          return sendJson({ jsonrpc: '2.0', id, result: {  content: [{ type: 'text', text: JSON.stringify(args) }],  isError: false} })

        const toolComp = dsls.mcp?.tool?.[toolId]?.[coreUtils.asJbComp]
        if (!toolComp) {
          return sendJson({ jsonrpc: '2.0', id, error: { code: -32601, message: `Tool not found: ${toolId}` } })
        }
        const _toolPath = toolComp.$location?.path
        const mapped = coreUtils.absPathToImportUrl?.(_toolPath, importMap.imports, staticMappings)
        const toolPath = mapped && !mapped.startsWith('undefined') ? mapped : ('file://' + _toolPath)

        const argsJson = JSON.stringify(args || {})

        const script = `
import { jb, dsls, coreUtils } from '@jb6/core'
jb.coreRegistry.repoRoot = '${repoRoot}'
jb.coreRegistry.jb6Root = '${jb.coreRegistry.jb6Root}'
await import('@jb6/mcp/mcp-jb-tools.js')
await import('${toolPath}')
const result = await dsls.mcp?.tool?.['${toolId}']?.$run(${argsJson})
await coreUtils.writeServiceResult(result)
`
        const cliResult = await coreUtils.runCliInContext(script, {projectDir, importMapsInCli: importMap?.importMapsInCli})
        console.log('mcp result', cliResult)
        const mcpResult = cliResult?.result || { content: [{ type: 'text', text: cliResult?.error?.message || 'CLI error' }], isError: true }
        return sendJson({ jsonrpc: '2.0', id, result: mcpResult })
      }

      // Handle resources/list
      if (method === 'resources/list') {
        return sendJson({ jsonrpc: '2.0', id, result: { resources: [] } })
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
          const mapped = coreUtils.absPathToImportUrl?.(_sourceFile, importMap.imports, staticMappings)
          const sourceFile = mapped && !mapped.startsWith('undefined') ? mapped
            : _sourceFile?.startsWith(repoRoot) ? `/genie${_sourceFile.slice(repoRoot.length)}` : null
          const urlsToLoad = sourceFile ? [sourceFile] : []

          const { renderReactCompToHtml } = await import('@jb6/mcp/mcp-utils.js')
          const html = renderReactCompToHtml(compId, importMap, urlsToLoad, { origin })
          const csp = { resourceDomains: [origin], connectDomains: [origin], baseUriDomains: [origin] }
          return sendJson({ jsonrpc: '2.0', id, result: { contents: [{ uri, mimeType: 'text/html;profile=mcp-app', text: html, _meta: { ui: { csp } } }] } })
        }
        return sendJson({ jsonrpc: '2.0', id, error: { code: -32002, message: `Resource not found: ${uri}` } })
      }

      // Handle ping (optional but good to have)
      if (method === 'ping') {
        return sendJson({ jsonrpc: '2.0', id, result: {} })
      }

      // Unknown method
      sendJson({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not supported: ${method}` } })
    } catch (error) {
      console.error(error?.stack || error)
      if (!res.headersSent) sendJson({ jsonrpc: '2.0', id: req.body?.id, error: { code: -32603, message: error.stack } })
    }
  })
}