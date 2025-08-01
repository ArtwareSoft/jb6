import { dsls, coreUtils } from '@jb6/core'
import '@jb6/common'
import '@jb6/llm-guide/autogen-dsl-docs.js'

const { ptsOfType, globalsOfType, asJbComp } = coreUtils
const { 
    tgp: { TgpType, any: {typeAdapter}, var: {Var} },
    common: {
      data: { pipeline, squeezeText, pipe, first}
    }
} = dsls
  
// Define core types  
const Tool = TgpType('tool', 'mcp')
  
export async function startMcpServer() {
  const { Server } = await import("@modelcontextprotocol/sdk/server/index.js")
  const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js")
  const { z } = await import('zod')
  const { ListToolsRequestSchema, CallToolRequestSchema } = await import("@modelcontextprotocol/sdk/types.js")
    
  // Get all tools from jb repository
    const exclude = ['text','doclet']
    const allTools = [...ptsOfType(Tool),...globalsOfType(Tool)].filter(id => !exclude.includes(id))
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
      console.error('Received tool call request:', JSON.stringify(request, null, 2))
      debugger
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
      console.error('Received generic tool call request:', JSON.stringify(request, null, 2))
      debugger      
      try {
        const { name, arguments: args } = request.params
        const result = await dsls.mcp.tool[name].$run(args)
        return result
      } catch (error) {
        console.error(`Error executing tool ${name}:`, error)
        throw error
      }
    })
      
    const transport = new StdioServerTransport()
    await mcpServer.connect(transport)
}

Tool('mcpTool', {
  description: 'wrap text as mcp result',
  params: [
    {id: 'text', dynamic: true},
    {id: 'repoRoot', as: 'string', mandatory: true, description: 'Absolute path to repository root'},
    {id: 'maxLength', as: 'number', defaultValue: 20000}
  ],
  impl: typeAdapter('data<common>', pipe(
    Var('dummy', ({},{},{repoRoot}) => {
      jb.coreRegistry.repoRoot = repoRoot
    }),
    '%$text()%',
    squeezeText('%%', '%$maxLength%'),
    ({data}) => ({ content: [{ type: 'text', text: data }], isError: data.indexOf('Error') == 0 }),
    first()
  ))
})

