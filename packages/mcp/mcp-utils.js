import { dsls, coreUtils } from '@jb6/core'

const { ptsOfType, globalsOfType, asJbComp } = coreUtils
const { 
    common: { Data, Action },
    tgp: { TgpType, typeAdapter },
} = dsls
  
// Define core types  
const Tool = TgpType('tool', 'mcp')
const Prompt = TgpType('prompt', 'mcp')

// Export for use in other files
export { Tool, Prompt, typeAdapter }

function injectConsoleSuppressionAfterImports(script) {
  const lines = script.split('\n')
  const lastImportIndex = lines.findLastIndex(line => line.trim().startsWith('import '))
  const insertIndex = lastImportIndex >= 0 ? lastImportIndex + 1 : 0
  return lastImportIndex >= 0 ? [...lines.slice(0, insertIndex), 'console.log = () => {};', ...lines.slice(insertIndex)].join('\n') 
    : `console.log = () => {};\n${script}`
}

export const runNodeScript = Data('runNodeScript', {
    params: [
      { id: 'script', as: 'string', dynamic: true, mandatory: true, description: 'JavaScript code to execute' },
      { id: 'repoRoot', as: 'string', description: 'Working directory for execution' }
    ],
    impl: async (ctx, { script, repoRoot }) => {
      const { spawn } = await import('child_process')
      
      return new Promise((resolve) => {
        const _script = typeof script.profile == 'string' ? script.profile : script()
        const scriptToRun = injectConsoleSuppressionAfterImports(_script)
        debugger
        const cmd = `node --inspect-brk --input-type=module -e "${scriptToRun.replace(/"/g, '\\"')}"`
        const proc = spawn('/bin/node', ['--input-type=module', '-e', scriptToRun], { 
          cwd: repoRoot || process.cwd(), 
          stdio: ['ignore', 'pipe', 'pipe'] 
        })
        
        let out = '', err = ''
        proc.stdout.on('data', c => out += c)
        proc.stderr.on('data', c => err += c)
        
        proc.on('close', (exit) => {
          if (exit === 0) {
            let parsed
            try { 
              parsed = JSON.parse(out) 
            } catch { 
              parsed = null 
            }
            
            const text = parsed?.result != null ? JSON.stringify(parsed.result) : out.trim()
            resolve({ 
              content: [{ type: 'text', text }, {type: 'text', text: scriptToRun}], 
              isError: false 
            })
          } else {
            const msg = err.trim() || `Process exited with code ${exit}`
            resolve({ 
              content: [{ type: 'text', text: msg  + '\nSCRIPT\n\n' + scriptToRun}], 
              isError: true 
            })
          }
        })
      })
    }
})
  
export async function startMcpServer() {
  const { Server } = await import("@modelcontextprotocol/sdk/server/index.js");
  const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");
  const { z } = await import('zod');

  const { 
    ListToolsRequestSchema, 
    CallToolRequestSchema,
    ListPromptsRequestSchema,
    GetPromptRequestSchema 
  } = await import("@modelcontextprotocol/sdk/types.js");

  const GenericToolCallSchema = z.object({
    jsonrpc: z.literal("2.0"),
    id: z.union([z.string(), z.number(), z.null()]),
    method: z.literal("callTool"),
    params: z.object({
      name: z.enum([
        "runSnippet",
        "runSnippets", 
        "getFileContent",
        "replaceComponent",
        "addComponent",
        "overrideFileContent",
        "tgpModel",
        "evalJs"
      ]),
      arguments: z.record(z.unknown())
    })
  })


    // Get all tools from the repository
    const allTools = [...ptsOfType(Tool),...globalsOfType(Tool)]
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
  
    const mcpServer = new Server({
      name: 'JB6 MCP Server',
      version: '1.0.0'
    }, {
      capabilities: { 
        tools: {},
        prompts: {}
      }
    })
  
    mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: toolConfigs
    }))
  
    mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
      console.error('Received tool call request:', JSON.stringify(request, null, 2))
      debugger
      const { name, arguments: args } = request.params 
      const result = await dsls.mcp.tool[name].$run(args)
      return result
    })

    mcpServer.setRequestHandler(GenericToolCallSchema, async (request) => {
      console.error('Received generic tool call request:', JSON.stringify(request, null, 2))
      debugger
      
      const { name, arguments: args } = request.params
      
      try {
        // Execute the tool using the DSL system
        const result = await dsls.mcp.tool[name].$run(args)
        return result
      } catch (error) {
        console.error(`Error executing tool ${name}:`, error)
        throw error
      }
    })
    

    mcpServer.setRequestHandler(ListPromptsRequestSchema, async () => ({
      prompts: promptConfigs
    }))

    mcpServer.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args } = request.params
      // Execute the prompt implementation
      const result = await dsls.mcp.prompt[name].$run(args)
      
      return {
        messages: [{
          role: "user",
          content: result.content[0]
        }]
      }
    })
  
    // Start stdio transport
    const transport = new StdioServerTransport()
    await mcpServer.connect(transport)
    console.error(`JB6 MCP Server running on stdio`)
}