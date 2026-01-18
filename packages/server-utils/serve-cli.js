import { coreUtils, jb, dsls } from '@jb6/core'
import '@jb6/core/misc/jb-cli.js'

const { runNodeCli, runBashScript, buildNodeCliCmd } = coreUtils

jb.serverUtils = jb.serverUtils || {}
Object.assign(jb.serverUtils, {serveCli, serveCliStream, serveMcp})

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

function serveCli(app) {
  app.post('/run-cli', async (req, res) => {
    if (!req.body) {
      res.status(200).json({ error: 'no body in req' })
      return
    }
    const { script, ...options } = req.body
    const result = await runNodeCli(script, options)
    res.status(200).json({ result })
  })

  app.post('/run-bash', async (req, res) => {
    const { script } = req.body
    const result = await runBashScript(script)
    res.status(200).json({ result })
  })
}

function serveCliStream(app) {
  const runs = {}
  let seq = 1
  const newRunId = () => 'run_' + (seq++)

  const sseHeaders = res => {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders && res.flushHeaders()
  }
  const sseSend = (res, msg) => res.write(`data: ${JSON.stringify(msg)}\n\n`)

  app.post('/run-cli-stream', (req, res) => {
    if (!req.body) return res.json({ error: 'no body in req' })
    const { script, ...options } = req.body
    const { cmd } = buildNodeCliCmd(script, options)
    const runId = newRunId()

    let resolve
    const promise = new Promise(r => resolve = r)
    runs[runId] = { listeners: {}, promise, resolve }

    const broadcastStatus = text =>
      Object.values(runs[runId]?.listeners || {}).forEach(fn => fn({ type: 'status', text }))

    const broadcastDone = () =>
      Object.values(runs[runId]?.listeners || {}).forEach(fn => fn({ type: 'done' }))

    ;(async () => {
      try {
        const final = await runNodeCli(script, options, broadcastStatus)
        runs[runId]?.resolve(final)
        broadcastDone()
      } catch (error) {
        runs[runId]?.resolve({ error: error.stack || error })
        broadcastDone()
      }
      setTimeout(() => delete runs[runId], 60_000)
    })()

    res.json({
      cmd,
      runId,
      statusUrl: `/run-cli-stream/${runId}/status`,
      contentUrl: `/run-cli-stream/${runId}/content`
    })
  })

  app.get('/run-cli-stream/:runId/status', (req, res) => {
    const run = runs[req.params.runId]
    if (!run) return res.status(404).end('no such run')
    sseHeaders(res)
    const id = Math.random().toString(36).slice(2)
    run.listeners[id] = msg => sseSend(res, msg)
    req.on('close', () => delete run.listeners[id])
  })

  app.get('/run-cli-stream/:runId/content', async (req, res) => {
    const run = runs[req.params.runId]
    if (!run) return res.status(404).json({ error: 'no such run' })
    res.json(await run.promise)
  })
}


