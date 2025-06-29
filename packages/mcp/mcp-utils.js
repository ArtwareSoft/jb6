import { dsls, coreUtils } from '@jb6/core'
import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { spawn } from 'child_process'

import { 
  ListToolsRequestSchema, 
  CallToolRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema 
} from "@modelcontextprotocol/sdk/types.js"
  
const { ptsOfType, asJbComp } = coreUtils
const { 
    common: { Data, Action },
    tgp: { TgpType, typeAdapter },
} = dsls
  
// Define core types  
const Tool = TgpType('tool', 'mcp')
const Prompt = TgpType('prompt', 'mcp')

// Export for use in other files
export { Tool, Prompt, typeAdapter }
    
export const runNodeScript = Data('runNodeScript', {
    params: [
      { id: 'script', as: 'string', mandatory: true, description: 'JavaScript code to execute' },
      { id: 'repoRoot', as: 'string', description: 'Working directory for execution' }
    ],
    impl: (ctx, { script, repoRoot }) => {
      
      return new Promise((resolve) => {
        const scriptToRun = `console.log = () => {};\n${script}`
        const proc = spawn(process.execPath, ['--input-type=module', '-e', scriptToRun], { 
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
            
            const text = parsed?.result != null ? String(parsed.result) : out.trim()
            resolve({ 
              content: [{ type: 'text', text }], 
              isError: false 
            })
          } else {
            const msg = err.trim() || `Process exited with code ${exit}`
            resolve({ 
              content: [{ type: 'text', text: msg }], 
              isError: true 
            })
          }
        })
      })
    }
})
  
export function startMcpServer() {
    // Get all tools from the repository
    debugger
    const allTools = ptsOfType(Tool)
    const toolConfigs = allTools.map(toolId => {
      const toolComp = dsls.mcp.tool[toolId][asJbComp]
      return {
        name: toolId,
        description: toolComp.description || `Tool: ${toolId}`,
        inputSchema: {
          type: "object",
          properties: toolComp.params.reduce((props, param) => {
            props[param.id] = {
              type: param.as === 'number' ? 'number' : 'string',
              description: param.description || ''
            }
            return props
          }, {}),
          required: toolComp.params.filter(p => p.mandatory).map(p => p.id)
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
      const { name, arguments: args } = request.params      
      const result = await dsls.mcp.tool[name].$run(args)
      return result
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
    mcpServer.connect(transport).then(() => {
      console.error(`JB6 MCP Server running on stdio`)
    })
}