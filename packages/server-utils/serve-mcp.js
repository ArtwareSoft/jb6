import { coreUtils, jb, dsls } from '@jb6/core'

jb.serverUtils = jb.serverUtils || {}
Object.assign(jb.serverUtils, { serveMcp })

export async function serveMcp(app, { express }) {
  const { StreamableHTTPServerTransport } = await import('@modelcontextprotocol/sdk/server/streamableHttp.js')
  const { startMcpServer } = await import("@jb6/mcp/mcp-utils.js")
  await import('@jb6/mcp/mcp-jb-tools.js')
  await import('@jb6/mcp/mcp-fs-tools.js')

  app.post("/mcp", express.json({ type: "application/json" }), async (req, res) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    })

    try {
      const exclude = ['text','doclet']
      const allTools = coreUtils.globalsOfTypeIds(dsls.mcp.tool,'all').filter(id => !exclude.includes(id))
      .map(id=>({id, toolComp: dsls.mcp.tool[id][coreUtils.asJbComp] }))

      await startMcpServer(transport,allTools)
      await transport.handleRequest(req, res, req.body)

      res.on("close", () => transport.close())
    } catch (error) {
      console.error(error?.stack || error)
      if (!res.headersSent) res.status(500).end()
      transport.close()
    }
  })
}
