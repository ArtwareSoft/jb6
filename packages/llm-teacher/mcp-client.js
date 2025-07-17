import { spawn } from 'child_process'
import { EventEmitter } from 'events'
import { createReadStream, createWriteStream } from 'fs'

class StdioTransport extends EventEmitter {
    constructor(command, args = []) {
        super()
        this.command = command
        this.args = args
        this.process = null
        this.connected = false
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.process = spawn(this.command, this.args, {
                stdio: ['pipe', 'pipe', 'inherit']
            })

            this.process.on('spawn', () => {
                this.connected = true
                this.setupIOHandlers()
                resolve()
            })

            this.process.on('error', reject)
            this.process.on('exit', () => {
                this.connected = false
                this.emit('disconnect')
            })
        })
    }

    setupIOHandlers() {
        let buffer = ''
        
        this.process.stdout.on('data', (data) => {
            buffer += data.toString()
            
            let lines = buffer.split('\n')
            buffer = lines.pop()
            
            lines.forEach(line => {
                if (line.trim()) {
                    try {
                        const message = JSON.parse(line)
                        this.emit('message', message)
                    } catch (error) {
                        console.error('Failed to parse message:', line, error)
                    }
                }
            })
        })
    }

    async send(message) {
        if (!this.connected || !this.process) {
            throw new Error('Transport not connected')
        }
        
        const json = JSON.stringify(message) + '\n'
        return new Promise((resolve, reject) => {
            this.process.stdin.write(json, (error) => {
                if (error) reject(error)
                else resolve()
            })
        })
    }

    async reconnect() {
        await this.close()
        await this.connect()
    }

    async close() {
        if (this.process) {
            this.process.kill()
            this.process = null
        }
        this.connected = false
    }

    isConnected() {
        return this.connected
    }
}

class MCPClient {
    constructor(transport, options = {}) {
        this.transport = transport
        this.capabilities = null
        this.currentState = ClientState.DISCONNECTED
        this.hooks = options.hooks || {}
        
        this.toolResultCache = {}
        this.toolResultTTL = {}
        this.sessionMemory = {}
        this.connectionMemory = {}
        this.resourceCache = {}
        
        this.incomingRequests = []
        this.transportResponses = []
        this.jobQueue = []
        this.jobWorkers = []
        
        this.heartbeatInterval = null
        this.reconnectAttempts = 0
        this.maxReconnectAttempts = 5
        this.reconnectInterval = 1000
        
        this.maxCacheEntrySize = options.maxCacheEntrySize || 1024 * 1024
        this.cacheCleanupInterval = options.cacheCleanupInterval || 60000
        this.toolTimeout = options.toolTimeout || 30000
        
        this.isRunning = false
        this.cleanupSignal = false
    }

    async mainLoop() {
        this.isRunning = true
        
        while (this.isRunning && !this.cleanupSignal) {
            try {
                if (this.incomingRequests.length > 0) {
                    const request = this.incomingRequests.shift()
                    await this.handleRequest(request)
                }
                
                if (this.transportResponses.length > 0) {
                    const response = this.transportResponses.shift()
                    await this.processResponse(response)
                }
                
                if (this.jobQueue.length > 0) {
                    const job = this.jobQueue.shift()
                    await this.executeJob(job)
                }
                
                await this.checkHeartbeat()
                
                await new Promise(resolve => setTimeout(resolve, 10))
                
            } catch (error) {
                if (this.hooks.onError) {
                    this.hooks.onError(error, 'main_loop')
                }
                console.error('Main loop error:', error)
            }
        }
        
        await this.shutdown()
    }

    async handleRequest(request) {
        try {
            if (!this.validateRequest(request)) {
                throw new Error('Invalid request format')
            }
            
            const cacheKey = this.generateCacheKey(request)
            const cachedResult = this.checkCache(cacheKey)
            
            if (cachedResult) {
                if (this.hooks.onCacheHit) {
                    this.hooks.onCacheHit(cacheKey)
                }
                return this.sendResponse(request.id, cachedResult)
            }
            
            if (this.hooks.onCacheMiss) {
                this.hooks.onCacheMiss(cacheKey)
            }
            
            const job = this.createJob(request)
            this.jobQueue.push(job)
            
        } catch (error) {
            if (this.hooks.onError) {
                this.hooks.onError(error, 'handle_request')
            }
        }
    }

    async executeJob(job) {
        switch (job.type) {
            case 'TOOL_CALL':
                await this.executeToolJob(job)
                break
            case 'RESOURCE_FETCH':
                await this.executeResourceJob(job)
                break
            case 'MAINTENANCE':
                await this.executeMaintenanceJob(job)
                break
            default:
                console.error('Unknown job type:', job.type)
        }
    }

    async executeToolJob(job) {
        try {
            if (!this.isToolAvailable(job.toolName)) {
                job.callback({ error: 'Tool not available' })
                return
            }
            
            const result = await Promise.race([
                this.callTool(job.toolName, job.arguments),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Tool call timeout')), job.timeout || this.toolTimeout)
                )
            ])
            
            if (!result.error) {
                this.cacheToolResult(job.toolName, job.arguments, result)
            }
            
            job.callback(result)
            
        } catch (error) {
            job.callback({ error: error.message })
        }
    }

    async callTool(toolName, args) {
        if (this.hooks.beforeToolCall) {
            const shouldProceed = this.hooks.beforeToolCall(toolName, args)
            if (!shouldProceed) {
                return { error: 'Tool call blocked by hook' }
            }
        }
        
        const result = await this.doToolCall(toolName, args)
        
        if (this.hooks.afterToolCall) {
            this.hooks.afterToolCall(toolName, result)
        }
        
        return result
    }

    async doToolCall(toolName, args) {
        try {
            const request = {
                method: 'tools/call',
                params: {
                    name: toolName,
                    arguments: args
                }
            }
            
            const response = await this.transport.send(request)
            
            return {
                content: response.content,
                isError: response.isError || false
            }
            
        } catch (error) {
            return { error: error.message }
        }
    }

    transitionState(newState) {
        const oldState = this.currentState
        this.currentState = newState
        
        switch (newState) {
            case ClientState.READY:
                this.startHeartbeat()
                this.enableJobProcessing()
                break
                
            case ClientState.RECONNECTING:
                this.pauseJobProcessing()
                this.clearPendingRequests()
                break
                
            case ClientState.SHUTTING_DOWN:
                this.stopHeartbeat()
                this.flushPendingJobs()
                this.closeConnections()
                break
        }
        
        if (this.hooks.onStateChange) {
            this.hooks.onStateChange(oldState, newState)
        }
    }

    async executeWithRetry(operation, maxRetries = 3) {
        let lastError = null
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            if (attempt > 0) {
                const delay = Math.pow(attempt, 2) * 1000
                await new Promise(resolve => setTimeout(resolve, delay))
                
                if (this.hooks.onRetry) {
                    this.hooks.onRetry('tool_call', attempt)
                }
            }
            
            try {
                const result = await operation()
                return result
            } catch (error) {
                lastError = error
                
                if (!this.isRetryableError(error)) {
                    break
                }
            }
        }
        
        throw lastError
    }

    async handleConnectionLoss() {
        this.transitionState(ClientState.RECONNECTING)
        
        this.saveConnectionState()
        
        this.reconnectionLoop()
    }

    async reconnectionLoop() {
        for (let attempt = 1; attempt <= this.maxReconnectAttempts; attempt++) {
            try {
                if (await this.attemptReconnection()) {
                    this.restoreConnectionState()
                    this.transitionState(ClientState.READY)
                    return
                }
            } catch (error) {
                console.error(`Reconnection attempt ${attempt} failed:`, error)
            }
            
            await new Promise(resolve => 
                setTimeout(resolve, attempt * this.reconnectInterval)
            )
        }
        
        this.transitionState(ClientState.DISCONNECTED)
    }

    cacheToolResult(toolName, args, result) {
        if (!this.shouldCache(toolName, args, result)) {
            return
        }
        
        const cacheKey = this.generateToolCacheKey(toolName, args)
        const cachedResult = {
            data: result,
            timestamp: Date.now(),
            hitCount: 0
        }
        
        this.toolResultCache[cacheKey] = cachedResult
        this.toolResultTTL[cacheKey] = Date.now() + (5 * 60 * 1000)
    }

    shouldCache(toolName, args, result) {
        if (result.error) {
            return false
        }
        
        if (this.toolHasSideEffects(toolName)) {
            return false
        }
        
        if (this.getResultSize(result) > this.maxCacheEntrySize) {
            return false
        }
        
        const policy = this.getToolCachePolicy(toolName)
        return policy ? policy.shouldCache(args, result) : true
    }

    async batchToolCalls(calls) {
        if (calls.length === 1) {
            const call = calls[0]
            return [await this.callTool(call.name, call.args)]
        }
        
        const batches = this.groupCallsByServer(calls)
        const results = new Array(calls.length)
        
        const promises = Object.entries(batches).map(([serverID, batch]) => 
            this.executeBatch(serverID, batch, results)
        )
        
        await Promise.all(promises)
        return results
    }

    validateRequest(request) {
        return request && 
               typeof request.method === 'string' && 
               request.params !== undefined
    }

    generateCacheKey(request) {
        return `${request.method}:${JSON.stringify(request.params)}`
    }

    generateToolCacheKey(toolName, args) {
        return `tool:${toolName}:${JSON.stringify(args)}`
    }

    checkCache(cacheKey) {
        const cached = this.toolResultCache[cacheKey]
        const ttl = this.toolResultTTL[cacheKey]
        
        if (cached && ttl && Date.now() < ttl) {
            cached.hitCount++
            return cached.data
        }
        
        if (cached) {
            delete this.toolResultCache[cacheKey]
            delete this.toolResultTTL[cacheKey]
        }
        
        return null
    }

    isToolAvailable(toolName) {
        return this.capabilities && 
               this.capabilities.tools && 
               this.capabilities.tools.some(tool => tool.name === toolName)
    }

    isRetryableError(error) {
        const retryableErrors = [
            'ECONNRESET',
            'ETIMEDOUT',
            'ENOTFOUND',
            'Tool call timeout'
        ]
        
        return retryableErrors.some(retryable => 
            error.message.includes(retryable)
        )
    }

    toolHasSideEffects(toolName) {
        const sideEffectTools = ['create', 'update', 'delete', 'send', 'execute']
        return sideEffectTools.some(prefix => toolName.toLowerCase().includes(prefix))
    }

    getResultSize(result) {
        return JSON.stringify(result).length
    }

    getToolCachePolicy(toolName) {
        const policies = {
            'search': { shouldCache: () => true, ttl: 300000 },
            'fetch': { shouldCache: () => true, ttl: 60000 },
            'calculate': { shouldCache: () => true, ttl: 3600000 }
        }
        
        return policies[toolName]
    }

    async start() {
        this.transitionState(ClientState.CONNECTING)
        await this.mainLoop()
    }

    async shutdown() {
        this.cleanupSignal = true
        this.isRunning = false
        this.transitionState(ClientState.SHUTTING_DOWN)
        
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval)
        }
        
        if (this.transport && this.transport.close) {
            await this.transport.close()
        }
    }

    async processResponse(response) {
        if (response.id && this.pendingRequests[response.id]) {
            this.pendingRequests[response.id](response)
            delete this.pendingRequests[response.id]
            return
        }
        
        if (response.method) {
            this.handleNotification(response)
        }
    }

    async executeResourceJob(job) {
        try {
            const request = {
                method: 'resources/read',
                params: { uri: job.uri },
                id: this.generateRequestId()
            }
            
            const response = await this.sendRequest(request)
            
            if (response.error) {
                job.callback({ error: response.error.message })
            } else {
                this.resourceCache[job.uri] = {
                    contents: response.result.contents,
                    timestamp: Date.now()
                }
                job.callback(response.result)
            }
        } catch (error) {
            job.callback({ error: error.message })
        }
    }

    async executeMaintenanceJob(job) {
        switch (job.maintenanceType) {
            case 'CACHE_CLEANUP':
                this.cleanExpiredCache()
                break
            case 'PERSIST_STATE':
                this.persistState()
                break
            case 'HEARTBEAT':
                await this.sendHeartbeat()
                break
        }
    }

    createJob(request) {
        const jobId = this.generateRequestId()
        
        if (request.method === 'tools/call') {
            return {
                id: jobId,
                type: 'TOOL_CALL',
                toolName: request.params.name,
                arguments: request.params.arguments,
                callback: this.pendingRequests[request.id],
                timeout: this.toolTimeout,
                createdAt: Date.now()
            }
        }
        
        if (request.method === 'resources/read') {
            return {
                id: jobId,
                type: 'RESOURCE_FETCH',
                uri: request.params.uri,
                callback: this.pendingRequests[request.id],
                createdAt: Date.now()
            }
        }
        
        return {
            id: jobId,
            type: 'GENERIC',
            request: request,
            callback: this.pendingRequests[request.id],
            createdAt: Date.now()
        }
    }

    sendResponse(id, result) {
        if (this.pendingRequests[id]) {
            this.pendingRequests[id](result)
            delete this.pendingRequests[id]
        }
    }

    startHeartbeat() {
        if (this.heartbeatInterval) return
        
        this.heartbeatInterval = setInterval(() => {
            this.jobQueue.push({
                type: 'MAINTENANCE',
                maintenanceType: 'HEARTBEAT',
                createdAt: Date.now()
            })
        }, 30000)
    }

    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval)
            this.heartbeatInterval = null
        }
    }

    checkHeartbeat() {
        if (this.lastHeartbeat && Date.now() - this.lastHeartbeat > 60000) {
            this.handleConnectionLoss()
        }
    }

    enableJobProcessing() {
        this.jobProcessingEnabled = true
    }

    pauseJobProcessing() {
        this.jobProcessingEnabled = false
    }

    clearPendingRequests() {
        Object.values(this.pendingRequests).forEach(callback => {
            callback({ error: 'Connection lost' })
        })
        this.pendingRequests = {}
    }

    flushPendingJobs() {
        while (this.jobQueue.length > 0) {
            const job = this.jobQueue.shift()
            if (job.callback) {
                job.callback({ error: 'Client shutting down' })
            }
        }
    }

    closeConnections() {
        if (this.transport && this.transport.close) {
            this.transport.close()
        }
    }

    saveConnectionState() {
        this.savedState = {
            toolResultCache: JSON.parse(JSON.stringify(this.toolResultCache)),
            sessionMemory: JSON.parse(JSON.stringify(this.sessionMemory)),
            resourceCache: JSON.parse(JSON.stringify(this.resourceCache)),
            pendingRequestsCount: Object.keys(this.pendingRequests).length,
            lastHeartbeat: this.lastHeartbeat,
            capabilities: this.capabilities
        }
    }

    restoreConnectionState() {
        if (this.savedState) {
            this.toolResultCache = this.savedState.toolResultCache || {}
            this.sessionMemory = this.savedState.sessionMemory || {}
            this.resourceCache = this.savedState.resourceCache || {}
            this.lastHeartbeat = this.savedState.lastHeartbeat
            this.capabilities = this.savedState.capabilities
        }
    }

    async attemptReconnection() {
        try {
            if (this.transport && this.transport.reconnect) {
                await this.transport.reconnect()
            } else {
                this.transport = new StdioTransport(this.transport.command, this.transport.args)
                await this.transport.connect()
            }
            
            await this.initialize()
            this.lastHeartbeat = Date.now()
            return true
        } catch (error) {
            console.error('Reconnection failed:', error)
            return false
        }
    }

    groupCallsByServer(calls) {
        return { 'default': calls }
    }

    async executeBatch(serverID, batch, results) {
        for (let i = 0; i < batch.length; i++) {
            const call = batch[i]
            try {
                results[call.originalIndex || i] = await this.callTool(call.name, call.args)
            } catch (error) {
                results[call.originalIndex || i] = { error: error.message }
            }
        }
    }

    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }

    async sendRequest(request) {
        return new Promise((resolve, reject) => {
            this.pendingRequests[request.id] = resolve
            
            setTimeout(() => {
                if (this.pendingRequests[request.id]) {
                    delete this.pendingRequests[request.id]
                    reject(new Error('Request timeout'))
                }
            }, this.toolTimeout)
            
            this.transport.send(request).catch(reject)
        })
    }

    async sendHeartbeat() {
        try {
            const request = {
                method: 'ping',
                id: this.generateRequestId()
            }
            await this.sendRequest(request)
            this.lastHeartbeat = Date.now()
        } catch (error) {
            console.error('Heartbeat failed:', error)
            this.handleConnectionLoss()
        }
    }

    handleNotification(notification) {
        switch (notification.method) {
            case 'notifications/message':
                if (this.hooks.onMessage) {
                    this.hooks.onMessage(notification.params)
                }
                break
            case 'notifications/progress':
                if (this.hooks.onProgress) {
                    this.hooks.onProgress(notification.params)
                }
                break
            case 'notifications/resources/updated':
                this.invalidateResourceCache(notification.params.uri)
                break
            case 'notifications/tools/list_changed':
                this.refreshToolsList()
                break
        }
    }

    cleanExpiredCache() {
        const now = Date.now()
        
        Object.keys(this.toolResultTTL).forEach(key => {
            if (now > this.toolResultTTL[key]) {
                delete this.toolResultCache[key]
                delete this.toolResultTTL[key]
            }
        })
        
        Object.keys(this.resourceCache).forEach(key => {
            const cached = this.resourceCache[key]
            if (cached.timestamp && now - cached.timestamp > 300000) {
                delete this.resourceCache[key]
            }
        })
    }

    persistState() {
        this.saveConnectionState()
    }

    invalidateResourceCache(uri) {
        if (uri) {
            delete this.resourceCache[uri]
        } else {
            this.resourceCache = {}
        }
    }

    async refreshToolsList() {
        try {
            const request = {
                method: 'tools/list',
                id: this.generateRequestId()
            }
            const response = await this.sendRequest(request)
            if (response.result && response.result.tools) {
                this.capabilities.tools = response.result.tools
            }
        } catch (error) {
            console.error('Failed to refresh tools list:', error)
        }
    }

    async initialize() {
        const request = {
            method: 'initialize',
            params: {
                protocolVersion: '2024-11-05',
                capabilities: {
                    experimental: {},
                    sampling: {}
                },
                clientInfo: {
                    name: 'mcp-client-js',
                    version: '1.0.0'
                }
            },
            id: this.generateRequestId()
        }
        
        const response = await this.sendRequest(request)
        
        if (response.error) {
            throw new Error(`Initialization failed: ${response.error.message}`)
        }
        
        this.capabilities = response.result.capabilities
        
        const initializedNotification = {
            method: 'notifications/initialized'
        }
        await this.transport.send(initializedNotification)
        
        return response.result
    }
}

const ClientState = {
    DISCONNECTED: 0,
    CONNECTING: 1,
    INITIALIZING: 2,
    READY: 3,
    RECONNECTING: 4,
    SHUTTING_DOWN: 5
}

async function createMCPClient() {
    const transport = new StdioTransport('./mcp_server')
    
    const client = new MCPClient(transport, {
        hooks: {
            onConnect: (serverInfo) => console.log('Connected:', serverInfo),
            onDisconnect: (reason) => console.log('Disconnected:', reason),
            beforeToolCall: (toolName, args) => {
                console.log(`Calling tool: ${toolName}`, args)
                return true
            },
            afterToolCall: (toolName, result) => {
                console.log(`Tool ${toolName} result:`, result)
            },
            onError: (error, context) => {
                console.error(`Error in ${context}:`, error)
            },
            onCacheHit: (key) => console.log('Cache hit:', key),
            onCacheMiss: (key) => console.log('Cache miss:', key)
        },
        toolTimeout: 30000,
        maxCacheEntrySize: 1024 * 1024
    })
    
    await client.start()
    return client
}

export { MCPClient, ClientState, createMCPClient }