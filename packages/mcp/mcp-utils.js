import { dsls, coreUtils } from '@jb6/core'
import '@jb6/common'

const {
    tgp: { TgpType, Component },
    common: { Data,
      data: { pipeline, pipe, first}
    }
} = dsls

// Define core types
TgpType('tool', 'mcp', {
  resultExample: `{ content: {type:"text", text:string}[], isError: boolean, _meta?: {ui: {resourceUri: string}} }`
})

export function renderReactCompToHtml(compId, importMap = {}, urlsToLoad = []) {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script type="importmap">${JSON.stringify(importMap, null, 2)}</script>
<style>
  html, body { height: 100%; margin: 0; padding: 0; }
</style>
</head>
<body>
  <div id="show" style="height: 100vh;">waiting for tool result...</div>
  <script type="module">
    import { App } from '@jb6/mcp/mcp-iframe-app.js'
    import { dsls, coreUtils } from '@jb6/core'
    import '@jb6/react/lib/tailwindcss.js'
    import { reactUtils } from '@jb6/react'

    const urlsToLoad = ${JSON.stringify(urlsToLoad)}
    for (const file of urlsToLoad.filter(Boolean))
      await import(file)

    const cmpId = '${compId}'
    const root = reactUtils.createRoot(document.getElementById('show'))

    const app = new App({ name: cmpId, version: '1.0.0' })
    app.connect()

    async function render(compArgs) {
      const { reactCmp, props, ctx } = await reactUtils.wrapReactCompWithSampleData(cmpId, null, compArgs)
      root.render(reactUtils.hh(ctx, reactCmp, props))
    }

    // Handle initial tool result from host
    app.ontoolresult = (result) => {
      const textContent = result.content?.find(c => c.type === 'text')?.text
      let toolResultData = null
      if (textContent) {
        try {
          toolResultData = JSON.parse(textContent)
        } catch (e) {
          // If not JSON, use as raw data
          toolResultData = { data: textContent }
        }
      }
      render(toolResultData)
    }
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
