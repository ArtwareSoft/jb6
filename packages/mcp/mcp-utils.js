import { dsls, coreUtils } from '@jb6/core'
import '@jb6/common'

const { ptsOfType, globalsOfType, asJbComp } = coreUtils
const { 
    tgp: { TgpType },
} = dsls
  
// Define core types  
const Tool = TgpType('tool', 'mcp')
const Prompt = TgpType('prompt', 'mcp')
  
export async function startMcpServer() {
  const { Server } = await import("@modelcontextprotocol/sdk/server/index.js")
  const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js")
  const { z } = await import('zod')
  const { ListToolsRequestSchema, CallToolRequestSchema, ListPromptsRequestSchema, GetPromptRequestSchema } = await import("@modelcontextprotocol/sdk/types.js")
    
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

    // Get all prompts from the repository
    const allPrompts = ptsOfType(Prompt)
    const promptConfigs = allPrompts.map(promptId => {
      const promptComp = dsls.mcp.prompt[promptId][asJbComp]
      return {
        name: promptId,
        description: promptComp.description || `Prompt: ${promptId}`,
        arguments: promptComp.params.map(param => ({
          name: param.id,
          description: param.description || '',
          required: param.mandatory || false
        }))
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
    
    mcpServer.setRequestHandler(ListPromptsRequestSchema, async () => ({ prompts: promptConfigs }))

    mcpServer.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args } = request.params
      const result = await dsls.mcp.prompt[name].$run(args)
      return { messages: [{ role: "user", content: result.content[0] }] }
    })
  
    const transport = new StdioServerTransport()
    await mcpServer.connect(transport)
}

const mcpTool = Tool('mcpTool', {
  description: 'wrap text as mcp result',
  params: [
    {id: 'text' },
    {id: 'maxLength', as: 'number', defaultValue: 20000}
  ],
  impl: async (ctx, {text: _text, maxLength}) => {
    const text = await Promise.resolve(_text).then(x=>x||'').then(x=>typeof x == 'object' ? JSON.stringify(x) : x)
    const squized = (text.length > maxLength) ? [text.slice(0,1000),
      `===text was originally ${text.length}. sorry, we had to squeeze it to ${maxLength} chars. ${text.length - maxLength} missing chars here====`,
      text.slice(text.length-maxLength+1000)
    ].join('') : text

    return { content: [{ type: 'text', text: squized }], isError: squized.indexOf('Error') == 0 }
  }
})

