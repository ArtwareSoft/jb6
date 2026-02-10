import { dsls, coreUtils } from '@jb6/core'
import '@jb6/common'

const {
  tgp: { TgpType, Component },
  common: { Data,
    data: { first, pipe }
  }
} = dsls

// Define core types
TgpType('tool', 'mcp', {
  resultExample: `{ content: {type:"text", text:string}[], isError: boolean, _meta?: {ui: {resourceUri: string}} }`
})

export function renderReactCompToHtml(compId, importMap = {}, urlsToLoad = [], { origin = '' } = {}) {
  const fix = v => origin && v.startsWith('/') ? origin + v.replace(/^\/jb6_packages/, '/genie/public/3rd-party/@jb6') : v
  const imports = importMap.imports ? Object.fromEntries(Object.entries(importMap.imports).map(([k, v]) => [k, fix(v)])) : {}
  const importMapJson = JSON.stringify({ imports })
  const urlsJson = JSON.stringify(urlsToLoad.map(fix))
  return `<!DOCTYPE html>
<html>
<head><meta name="viewport" content="width=device-width, initial-scale=1.0">
${origin ? `<base href="${origin}/">` : ''}
<script type="importmap">${importMapJson}</script>
<style>html, body { height: 100%; margin: 0; padding: 0; }</style>
</head>
<body>
  <div id="show"></div>
  <script type="module">
    ${origin ? `const _fetch = globalThis.fetch; globalThis.fetch = (url, ...args) => _fetch(typeof url === 'string' && url.startsWith('/') ? '${origin}' + url : url, ...args)` : ''}
    const PROTOCOL_VERSION = '2026-01-26'
    let requestId = 0
    class App {
      constructor(appInfo, capabilities = {}) {
        this.appInfo = appInfo; this.capabilities = capabilities; this.pendingRequests = new Map()
        this.target = window.parent; this.ontoolresult = null; this.ontoolinput = null
        window.addEventListener('message', e => e.data?.jsonrpc === '2.0' && this._handleMessage(e.data))
      }
      connect() {
        return this._sendRequest('ui/initialize', {
          protocolVersion: PROTOCOL_VERSION, appInfo: this.appInfo, appCapabilities: this.capabilities
        }).then(r => { this._sendNotification('ui/notifications/initialized', {}); return r })
      }
      _handleMessage(data) {
        if (data.id != null && (data.result !== undefined || data.error !== undefined)) {
          const p = this.pendingRequests.get(data.id)
          if (p) { this.pendingRequests.delete(data.id); data.error ? p.reject(new Error(data.error.message)) : p.resolve(data.result) }
          return
        }
        if (data.method === 'ui/notifications/tool-result') this.ontoolresult?.(data.params)
        else if (data.method === 'ui/notifications/tool-input') this.ontoolinput?.(data.params)
      }
      _sendRequest(method, params) {
        const id = ++requestId
        return new Promise((resolve, reject) => { this.pendingRequests.set(id, { resolve, reject }); this.target.postMessage({ jsonrpc: '2.0', id, method, params }, '*') })
      }
      _sendNotification(method, params) { this.target.postMessage({ jsonrpc: '2.0', method, params }, '*') }
      callServerTool(req) { return this._sendRequest('tools/call', req) }
      requestSize(size) { this._sendNotification('ui/notifications/size-changed', size) }
    }

    const app = globalThis.mcpApp = new App({ name: '${compId}', version: '1.0.0' })

    import { dsls, coreUtils } from '@jb6/core'
    import { reactUtils } from '@jb6/react'
    import '@jb6/react/lib/tailwindcss.js'
    import '@jb6/react/codemirror-utils.js'
    reactUtils.loadLucid05()
    const { h, hh } = reactUtils

    for (const file of ${urlsJson}) await import(file)

    const ctx = new coreUtils.Ctx().setVars({react: reactUtils, isLocalHost: true})
    const root = reactUtils.createRoot(document.getElementById('show'))
    const render = async (args) => {
      const { reactCmp, props, ctx: rCtx } = await reactUtils.wrapReactCompWithSampleData('${compId}', ctx, args)
      root.render(h('div', {}, hh(rCtx, reactCmp, props)))
    }

    await app.connect()
    const parse = (params) => { try { return JSON.parse(params?.content?.find(c => c.type === 'text')?.text) } catch(e) {} }
    app.ontoolresult = (params) => { const args = parse(params); if (args) render(args) }
    app.ontoolinput = (params) => { const args = parse(params); if (args) render(args) }
    render()
    new ResizeObserver(() => app.requestSize({ height: document.body.scrollHeight })).observe(document.body)
  </script>
</body>
</html>`
}

export async function startMcpServer(transport, { allTools, importMap } = {}) {
  const { Server } = await import("@modelcontextprotocol/sdk/server/index.js")
  const { z } = await import('zod')
  const { ListToolsRequestSchema, CallToolRequestSchema, ReadResourceRequestSchema } = await import("@modelcontextprotocol/sdk/types.js")

  const toolConfigs = allTools.map(({id, toolComp}) => {
    const isAlsoReactComp = dsls.react?.['react-comp']?.[id] != null

    return {
      name: id,
      description: toolComp.description || `Tool: ${id}`,
      inputSchema: {
        type: "object",
        properties: (toolComp.params || []).reduce((props, param) => {
          props[param.id] = {
            type: param.as === 'number' ? 'number' : 'string',
            description: param.description || ''
          }
          return props
        }, {}),
        required: (toolComp.params || []).filter(p => p.mandatory).map(p => p.id)
      },
      ...(isAlsoReactComp && { _meta: { ui: { resourceUri: `ui://react-comp/${id}` } } })
    }
  })

  const mcpServer = new Server(
    { name: 'JB6 MCP Server', version: '1.0.0' },
    { capabilities: { tools: {}, prompts: {}, resources: {} } }
  )
  mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: toolConfigs }))

  mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params
    const toolComp = allTools.find(({id}) => id == name)?.toolComp
    const result = await new coreUtils.Ctx().run({$: toolComp, ...args})
    return result
  })

  // Handle UI resource reads for react-comp tools
  mcpServer.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri
    const match = uri.match(/^ui:\/\/react-comp\/(.+)$/)
    if (match) {
      const compId = match[1]
      const reactComp = dsls.react?.['react-comp']?.[compId]
      const jbComp = reactComp?.[coreUtils.asJbComp]
      const sourceFile = jbComp?.$location?.path
      const { imports, staticMappings } = importMap || {}
      const fileUrl = sourceFile && imports && coreUtils.absPathToImportUrl?.(sourceFile, imports, staticMappings)
      const urlsToLoad = fileUrl ? [fileUrl] : []
      const browserImportMap = imports ? { imports } : {}
      const html = renderReactCompToHtml(compId, browserImportMap, urlsToLoad)
      return { contents: [{ uri, mimeType: 'text/html;profile=mcp-app', text: html }] }
    }
    throw { code: -32002, message: `Resource not found: ${uri}` }
  })


    const GenericToolCallSchema = z.object({
      jsonrpc: z.literal("2.0"),
      id: z.union([z.string(), z.number(), z.null()]),
      method: z.literal("callTool"),
      params: z.object({ name: z.string(), arguments: z.record(z.unknown()) })
    })

    mcpServer.setRequestHandler(GenericToolCallSchema, async (request) => {
      const { name, arguments: args } = request.params
      const toolComp = allTools.find(({id}) => id == name)?.toolComp
      const result = await new coreUtils.Ctx().run({$: toolComp, ...args})
      return result
    })
      
    await mcpServer.connect(transport)
}

const squeezeText = Data('squeezeText', {
  description: 'squeeze text by deleting parts in the middle',
  params: [
    {id: 'text', defaultValue: '%%'},
    {id: 'maxLength', as: 'number', defaultValue: 20000},
    {id: 'keepPrefixSize', as: 'number', defaultValue: 1000}
  ],
  impl: async (ctx, {}, {text: _text, maxLength, keepPrefixSize}) => {
    const text = await Promise.resolve(_text).then(x=>x||'').then(x=>typeof x == 'object' ? JSON.stringify(x) : x)
    return (text.length > maxLength) ? [text.slice(0,keepPrefixSize),
      `===text was originally ${text.length}. sorry, we had to squeeze it to ${maxLength} chars. ${text.length - maxLength} missing chars here====`,
      text.slice(text.length-maxLength+keepPrefixSize)
    ].join('') : text
  }
})

Component('mcpTool', {
  moreTypes: 'tool<mcp>',
  description: 'wrap text as mcp result',
  params: [
    {id: 'text', dynamic: true},
    {id: 'maxLength', as: 'number', defaultValue: 200000, byName: true}
  ],
  impl: pipe(
    '%$text()%',
    squeezeText('%%', '%$maxLength%'),
    ({data}) => ({ content: [{ type: 'text', text: data }], isError: data.indexOf('Error') == 0 }),
    first()
  )
})
