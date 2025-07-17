import OpenAI from 'openai'
import readline from 'readline'
import { MCPClient, ClientState, createMCPClient } from './mcp-client.js'

class LLMWithMCP {
    constructor(openaiApiKey, mcpServerCommand, mcpServerArgs = []) {
        this.openai = new OpenAI({ apiKey: openaiApiKey })
        this.mcpClient = null
        this.mcpServerCommand = mcpServerCommand
        this.mcpServerArgs = mcpServerArgs
        this.availableTools = []
        this.conversationHistory = []
    }

    async initialize() {
        console.log('🔗 Connecting to MCP server...')
        try {
            this.mcpClient = await createMCPClient(this.mcpServerCommand, this.mcpServerArgs)
            await this.refreshAvailableTools()
            console.log(`✅ Connected! Found ${this.availableTools.length} available tools`)
            this.printAvailableTools()
        } catch (error) {
            console.error('❌ Failed to connect to MCP server:', error.message)
            throw error
        }
    }

    async refreshAvailableTools() {
        try {
            const toolsResponse = await this.mcpClient.transport.send({
                method: 'tools/list',
                id: this.generateId()
            })
            
            if (toolsResponse.result && toolsResponse.result.tools) {
                this.availableTools = toolsResponse.result.tools
            }
        } catch (error) {
            console.error('Failed to fetch tools:', error)
            this.availableTools = []
        }
    }

    printAvailableTools() {
        if (this.availableTools.length === 0) {
            console.log('📭 No tools available')
            return
        }
        
        console.log('\n🛠️  Available Tools:')
        this.availableTools.forEach(tool => {
            console.log(`  • ${tool.name}: ${tool.description}`)
        })
        console.log('')
    }

    convertMCPToolsToOpenAIFormat() {
        return this.availableTools.map(tool => ({
            type: 'function',
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.inputSchema || {
                    type: 'object',
                    properties: {},
                    required: []
                }
            }
        }))
    }

    async chat(userMessage) {
        this.conversationHistory.push({
            role: 'user',
            content: userMessage
        })

        try {
            let response = await this.openai.chat.completions.create({
                model: 'gpt-4',
                messages: [
                    {
                        role: 'system',
                        content: `You are a helpful assistant with access to tools via MCP (Model Context Protocol). 
                        Use the available tools when appropriate to help the user. 
                        Always explain what tools you're using and why.`
                    },
                    ...this.conversationHistory
                ],
                tools: this.convertMCPToolsToOpenAIFormat(),
                tool_choice: 'auto'
            })

            let assistantMessage = response.choices[0].message
            let finalContent = assistantMessage.content || ''

            if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
                console.log('🔧 Executing tools...')
                
                this.conversationHistory.push({
                    role: 'assistant',
                    content: assistantMessage.content,
                    tool_calls: assistantMessage.tool_calls
                })

                const toolResults = []
                
                for (const toolCall of assistantMessage.tool_calls) {
                    console.log(`  ⚡ Calling ${toolCall.function.name}...`)
                    
                    try {
                        const args = JSON.parse(toolCall.function.arguments)
                        const result = await this.mcpClient.callTool(toolCall.function.name, args)
                        
                        let toolResultContent = ''
                        if (result.error) {
                            toolResultContent = `Error: ${result.error}`
                        } else if (result.content) {
                            if (Array.isArray(result.content)) {
                                toolResultContent = result.content.map(c => c.text || c.data || JSON.stringify(c)).join('\n')
                            } else {
                                toolResultContent = result.content.text || result.content.data || JSON.stringify(result.content)
                            }
                        } else {
                            toolResultContent = JSON.stringify(result)
                        }

                        toolResults.push({
                            role: 'tool',
                            content: toolResultContent,
                            tool_call_id: toolCall.id
                        })

                        console.log(`  ✅ ${toolCall.function.name}: ${toolResultContent.substring(0, 100)}${toolResultContent.length > 100 ? '...' : ''}`)
                        
                    } catch (error) {
                        const errorContent = `Tool execution failed: ${error.message}`
                        toolResults.push({
                            role: 'tool',
                            content: errorContent,
                            tool_call_id: toolCall.id
                        })
                        console.log(`  ❌ ${toolCall.function.name}: ${errorContent}`)
                    }
                }

                this.conversationHistory.push(...toolResults)

                const finalResponse = await this.openai.chat.completions.create({
                    model: 'gpt-4',
                    messages: [
                        {
                            role: 'system',
                            content: `You are a helpful assistant. Summarize the tool results and provide a helpful response to the user.`
                        },
                        ...this.conversationHistory
                    ]
                })

                finalContent = finalResponse.choices[0].message.content
            }

            this.conversationHistory.push({
                role: 'assistant',
                content: finalContent
            })

            return finalContent

        } catch (error) {
            console.error('❌ Error in chat:', error.message)
            return `Sorry, I encountered an error: ${error.message}`
        }
    }

    async shutdown() {
        if (this.mcpClient) {
            await this.mcpClient.shutdown()
        }
    }

    generateId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
}

class CLI {
    constructor(llmApp) {
        this.llmApp = llmApp
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: '💬 You: '
        })
    }

    async start() {
        console.log('🤖 LLM + MCP CLI Chat')
        console.log('Type "exit" to quit, "tools" to list available tools, "clear" to clear history\n')
        
        await this.llmApp.initialize()
        
        this.rl.prompt()
        
        this.rl.on('line', async (input) => {
            const command = input.trim()
            
            if (command === 'exit') {
                await this.shutdown()
                return
            }
            
            if (command === 'tools') {
                this.llmApp.printAvailableTools()
                this.rl.prompt()
                return
            }
            
            if (command === 'clear') {
                this.llmApp.conversationHistory = []
                console.log('🗑️  Conversation history cleared\n')
                this.rl.prompt()
                return
            }
            
            if (!command) {
                this.rl.prompt()
                return
            }

            console.log('\n🤖 Assistant: Thinking...')
            
            try {
                const response = await this.llmApp.chat(command)
                console.log(`🤖 Assistant: ${response}\n`)
            } catch (error) {
                console.log(`❌ Error: ${error.message}\n`)
            }
            
            this.rl.prompt()
        })

        this.rl.on('close', async () => {
            await this.shutdown()
        })
    }

    async shutdown() {
        console.log('\n👋 Goodbye!')
        await this.llmApp.shutdown()
        process.exit(0)
    }
}

async function main() {
    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
        console.error('❌ Please set OPENAI_API_KEY environment variable')
        process.exit(1)
    }

    const mcpServerCommand = process.argv[2]
    const mcpServerArgs = process.argv.slice(3)
    
    if (!mcpServerCommand) {
        console.error('❌ Usage: node llm-cli.js <mcp-server-command> [args...]')
        console.error('Example: node llm-cli.js go run ./mcp-server.go')
        console.error('Example: node llm-cli.js python mcp-server.py')
        process.exit(1)
    }

    try {
        const llmApp = new LLMWithMCP(openaiApiKey, mcpServerCommand, mcpServerArgs)
        const cli = new CLI(llmApp)
        await cli.start()
    } catch (error) {
        console.error('❌ Failed to start application:', error.message)
        process.exit(1)
    }
}

process.on('SIGINT', async () => {
    console.log('\n🛑 Interrupted')
    process.exit(0)
})

process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught exception:', error)
    process.exit(1)
})

if (import.meta.url === `file://${process.argv[1]}`) {
    main()
}

export { LLMWithMCP, CLI }