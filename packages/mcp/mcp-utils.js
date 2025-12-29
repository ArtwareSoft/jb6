import { dsls, coreUtils } from '@jb6/core'
import '@jb6/common'

const { globalsOfTypeIds, asJbComp } = coreUtils
const { 
    tgp: { TgpType, any: {typeAdapter}, var: {Var} },
    common: { Data,
      data: { pipeline, pipe, first}
    }
} = dsls
  
// Define core types  
const Tool = TgpType('tool', 'mcp')

export async function startMcpServer(transport, allTools) {
  const { Server } = await import("@modelcontextprotocol/sdk/server/index.js")
  const { z } = await import('zod')
  const { ListToolsRequestSchema, CallToolRequestSchema } = await import("@modelcontextprotocol/sdk/types.js")
    
  const toolConfigs = allTools.map(toolId => {
      const toolComp = dsls.mcp.tool[toolId][asJbComp]
      return {
        name: toolId,
        description: toolComp.description || `Tool: ${toolId}`,
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
        }
      }
    })
  
    const mcpServer = new Server({ name: 'JB6 MCP Server', version: '1.0.0' }, { capabilities: { tools: {}, prompts: {} } })
    mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: toolConfigs }))

    mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params 
      const result = await dsls.mcp.tool[name].$run(args)
      return result
    })


    // used for one of the mcp servers - maybe claude desktop
    const GenericToolCallSchema = z.object({
      jsonrpc: z.literal("2.0"),
      id: z.union([z.string(), z.number(), z.null()]),
      method: z.literal("callTool"),
      params: z.object({ name: z.string(), arguments: z.record(z.unknown()) })
    })

    mcpServer.setRequestHandler(GenericToolCallSchema, async (request) => {
      const { name, arguments: args } = request.params
      const result = await dsls.mcp.tool[name].$run(args)
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

Tool('mcpTool', {
  description: 'wrap text as mcp result',
  params: [
    {id: 'text', dynamic: true},
    {id: 'maxLength', as: 'number', defaultValue: 20000, byName: true}
  ],
  impl: typeAdapter('data<common>', pipe(
    '%$text()%',
    squeezeText('%%', '%$maxLength%'),
    ({data}) => ({ content: [{ type: 'text', text: data }], isError: data.indexOf('Error') == 0 }),
    first()
  ))
})

