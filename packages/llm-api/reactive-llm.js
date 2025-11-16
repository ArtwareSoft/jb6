import { dsls, coreUtils, ns } from '@jb6/core'

import '@jb6/core/misc/jb-cli.js'
import '@jb6/core/misc/import-map-services.js'

const { 
  rx: { ReactiveSource, ReactiveOperator },
  common: { Data },
  tgp: { TgpType },
} = dsls
const { calcHash, log, delay, logError, logException, isNode, asArray, calcPath, globalsOfType, runBashScript, waitForInnerElements, calcRepoRoot } = coreUtils

const Provider = TgpType('provider', 'llm-api', {typescript: `{ buildRequestBody(ctx,vars), extractContent(ctx,vars) }`})

const Model = TgpType('model', 'llm-api', {typescript: `{name, provider}`} )

Provider('providerByApi', {
  params: [
    {id: 'name', as: 'string'},
    {id: 'keyName', as: 'string', description: 'key name from .env'},
    {id: 'url', as: 'string'},
    {id: 'headers', dynamic: true},
    {id: 'useProxy', as: 'boolean'},
    {id: 'buildRequestBody', dynamic: true },
    {id: 'extractContentFromResponse', dynamic: true, defualtValue: ({data}) => data?.choices?.[0]?.delta?.content },
  ]
})

Provider('providerByCli', {
  params: [
    {id: 'name', as: 'string'},
    {id: 'cli', as: 'text', dynamic: true, description: 'use $model and $prompt'},
    {id: 'processResult', dynamic: true, defaultValue: '%%'}
  ]
})

Model('model', {
  params: [
    {id: 'name', as: 'string'},
    {id: 'price', as: 'array', byName: true, description: 'input/output $/M tokens'},
    {id: 'provider', type: 'provider'},
    {id: 'maxRequestTokens', as: 'array', description: 'input/output K'},
    {id: 'maxContextLength', as: 'number', defaultValue: 4096},
    {id: 'bestFor', as: 'string'},
    {id: 'doNotUseFor', as: 'string'},
    {id: 'reasoning', as: 'boolean'},
    {id: 'codingScore', as: 'number', description: 'Programming ability benchmark score (SWE-bench/HumanEval)'},
    {id: 'mathScore', as: 'number', description: 'Mathematical reasoning benchmark score (AIME/MATH)'},
    {id: 'contextWindow', as: 'number', description: 'Maximum context length in tokens'},
    {id: 'responseSpeed', as: 'number', description: 'Average tokens per second'},
    {id: 'latency', as: 'number', description: 'Time to first token in seconds'},
    {id: 'factualAccuracy', as: 'number', description: 'Knowledge correctness benchmark score (MMLU)'}
  ]
})

Provider('providerByApi', {
  params: [
    {id: 'name', as: 'string'},
    {id: 'keyName', as: 'string'},
    {id: 'url', as: 'string'},
    {id: 'headers', dynamic: true},
    {id: 'useProxy', as: 'boolean'}
  ]
})

Provider('providerByCli', {
  params: [
    {id: 'name', as: 'string'},
    {id: 'cli', as: 'text', dynamic: true, description: 'use $model and $prompt'},
    {id: 'processResult', dynamic: true, defaultValue: '%%'}
  ]
})

Model('model', {
  params: [
    {id: 'name', as: 'string'},
    {id: 'price', as: 'array', byName: true, description: 'input/output $/M tokens'},
    {id: 'provider', type: 'provider'},
    {id: 'maxRequestTokens', as: 'array', description: 'input/output K'},
    {id: 'maxContextLength', as: 'number', defaultValue: 4096},
    {id: 'bestFor', as: 'string'},
    {id: 'doNotUseFor', as: 'string'},
    {id: 'reasoning', as: 'boolean'},
    {id: 'codingScore', as: 'number', description: 'Programming ability benchmark score (SWE-bench/HumanEval)'},
    {id: 'mathScore', as: 'number', description: 'Mathematical reasoning benchmark score (AIME/MATH)'},
    {id: 'contextWindow', as: 'number', description: 'Maximum context length in tokens'},
    {id: 'responseSpeed', as: 'number', description: 'Average tokens per second'},
    {id: 'latency', as: 'number', description: 'Time to first token in seconds'},
    {id: 'factualAccuracy', as: 'number', description: 'Knowledge correctness benchmark score (MMLU)'}
  ]
})

Provider('openAI', {
  impl: providerByApi('openAI', 'OPENAI_API_KEY', {
    url: 'https://api.openai.com/v1/chat/completions',
    headers: ({},{apiKey}) => ({Authorization: `Bearer ${apiKey}`, Accept: 'application/text' }),
    useProxy: true
  })
})

Provider('anthropic', {
  impl: providerByApi('anthropic', 'ANTHROPIC_API_KEY', {
    url: 'https://api.anthropic.com/v1/messages',
    headers: ({},{apiKey}) => ({'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }),
    useProxy: true
  })
})

Provider('gemini', {
  impl: providerByApi('gemini', 'GEMINI_API_KEY', {
    url: 'https://generativelanguage.googleapis.com/v1beta/models/%$model%:generateContent',
    headers: ({},{apiKey}) => ({'Content-Type': 'application/json', 'x-goog-api-key': apiKey }),
    useProxy: true
  })
})

Provider('groq', {
  impl: providerByApi('groq', 'GROK_API_KEY', {
    url: 'https://api.groq.com/openai/v1/chat/completions',
    headers: ({},{apiKey}) => ({'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }),
    useProxy: true
  })
})

Provider('claudeCode', {
  impl: providerByCli({
    name: 'anthropic',
    cli: `mkdir -p /tmp/clean && cd /tmp/clean && echo '%$prompt%' | claude -p --model %$model% --output-format stream-json --verbose`,
    processResult: ({data}) => data.split('\n').filter(Boolean).map(x=>JSON.parse(x)).map(x=>x.message).filter(Boolean).filter(x=>x.type == 'message').flatMap(x=>x.content).map(x=>x.text).filter(Boolean).join('##\n')
      //JSON.stringify(data.split('\n').filter(Boolean).map(x=>JSON.parse(x)).filter(x=>x.type == 'result' || x.type == 'message'))
  })
})

Provider('geminiCli', {
  impl: providerByCli('gemini-cli', `mkdir -p /tmp/clean && cd /tmp/clean && echo '%$prompt%' | gemini -p --model %$model%`)
})


function decode(value) {
  if (!value) return ''
  if (typeof Buffer !== 'undefined') return Buffer.from(value).toString('utf-8')
  if (globalThis.TextDecoder) return new TextDecoder('utf-8').decode(value)
  if (globalThis.builtIn?.util) return new globalThis.builtIn.util.TextDecoder('utf-8').decode(value)
  throw new Error('No text decoder available')
}


const buildRequestBody = (model, messages, maxTokens, temperature, instructions, context, provider) => {
if (provider === 'anthropic') {
  return {
    model,
    stream: true,
    max_tokens: maxTokens,
    temperature,
    messages,
    system: [
      ...(instructions ? [{type: 'text', text: instructions, cache_control: {type: 'ephemeral'}}] : []),
      ...(context ? [{type: 'text', text: `accumulatedContext: ${context}`}] : []),
      {type: 'text', text: `reply based on the instructions and the context you received, to best answer the users message. use minimal amount of tokens and you have a max of ${maxTokens} tokens.`}
    ]
  }
}
return { model, stream: true, max_tokens: maxTokens, temperature, messages }
}

const extractContent = (data, provider) => provider === 'anthropic' ? data?.delta?.text : data.choices?.[0]?.delta?.content

const countTokens = async ({messages, instructions = '', context = ''}) => {
try {
  const systemContent = [instructions, context].filter(Boolean).join('\n\n')
  const allMessages = systemContent ? [{role: 'system', content: systemContent}, ...messages] : messages
  const totalChars = allMessages.reduce((sum, m) => sum + (m.content?.length || 0), 0)
  return Math.ceil(totalChars / 4)
} catch (error) {
  console.error('error counting tokens', error.message)
  return null
}
}

export async function fetchItemsFromLLMReactive({messages, goal, prompt, instructions, context, progressiveHandler = {}, 
    onDone, onChunk, model, maxTokens = 1200, temperature = 0.0, userId, roomId, passedContext = {}, contentType, ctx}) {
  const {provider, url} = getProviderConfig(model)
  const logger = ctx?.vars.workflowLogger || baseUtilsLogger
  logger.status(goal)
  messages = messages || [{role: "user", content: prompt}]
  if (provider === 'groq') {
    const systemContent = [instructions, context && `accumulatedContext: ${context}`, `reply based on the instructions and the context you received, to best answer the users message. use minimal amount of tokens and you have a max of ${maxTokens} tokens.`].filter(Boolean).join('\n\n')
    messages = systemContent ? [{role: "system", content: systemContent}, ...messages] : messages
  }
  const llmStart = Date.now()
  const reqBody = buildRequestBody(model, messages, maxTokens, temperature, instructions, context, provider)
  const tokenCount = await countTokens({messages, model, instructions, context})
  if (tokenCount !== null)
    logger.info({t:`${goal}: countInputTokens`, tokenCount, instructionsLength: instructions?.length || 0, contextLength: context?.length || 0}, reqBody, {ctx})

  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(reqBody)
  }
  const {response,controller}  = await fetchProxyWithCache(url, options ,ctx)
  
  if (response.status == 429) {
    debugger
    logger.error({t:`${goal}: tooManyRequestsToLLM`, reqBody, responseStatus: response.status, model}, reqBody, {response, ctx})
    return '{}'
  }
  if (response.status == 400) {
    debugger
    response.statusText && logger.status(response.statusText)
    const {curlCmd} = response
    const reader = response.body.getReader()
    const { done, value } = await reader.read()
    const reply = '' + decode(value||'')
    logger.error({t:`${goal}: BadRequest`, curlCmd, reqBody, reply, responseStatus: response.status, model}, reqBody, {response, ctx})
    return '{}'
  }

  if (!response.ok) {
    debugger
    response.statusText && logger.status(response.statusText)
    const {curlCmd} = response
    logger.error({t:`${goal} apiRequestFailedToLLM`, statusText: response.statusText, responseStatus: response.status, model}
      , {curlCmd, ...reqBody}, { response, ctx})
    return '{}'
  }
  logger.info({t:`${goal}: llmStreamingStarted`, ...reqBody }, {} , {ctx})

  // Process the stream
  const reader = response.body.getReader()
  let fullContent = ''
  let detectorOffset = 0
  let detector = progressiveHandler.handler && progressiveHandler
  let currentSeqDetectorIndex = 0
  let currentSeqDetector = (progressiveHandler?.$segementDetectorSequenece || [])[0]
  let chunkLeft = ''
  try {
    while (true) {
      const { done, value } = await reader.read()          
      const fullStr = chunkLeft + decode(value)
      chunkLeft = ''
      fullStr.split('\n').map(x=>x.trim()).filter(x=>x).forEach(line => {
          try {
            const val = line == 'data: [DONE]' ? 'done' : (line.startsWith('data: ') && line.endsWith('}') ? JSON.parse(line.slice(6)) : line)
            if (typeof val == 'string')
              chunkLeft = val
            if (typeof val == 'object') { // full line
              if (val.usage?.output_tokens) {
                logger.info({t:`${goal} - llmOutputTokens`, outputTokens: val.usage.output_tokens},{fullStr},{ctx})
              }
              const content = extractContent(val, provider)
              if (content == null) return
              if (typeof content != 'string') return
              fullContent += content
              onChunk && onChunk(content)
            }
          } catch (e) {
            // jb.logError('llm can not parse line',{chunkLeftForLog, line, sourceStr: String.fromCharCode(...value)})
          }
      })
      if (detector) { // single repeating detector
        const contentToSearch = fullContent.slice(detectorOffset)
        const result = detector.detector(contentToSearch)
        if (result) {
          detectorOffset += result.swallow
          detector.handler(result.text, {fullContent, addDynamicSegments, userId, roomId, passedContext, contentType})
        }
      }
      if (currentSeqDetector) {
        const contentToSearch = fullContent.slice(detectorOffset)
        const result = currentSeqDetector.detector(contentToSearch)
        if (result) {
          detectorOffset += result.swallow
          currentSeqDetector.handler(result.text, {fullContent, addDynamicSegments, userId, roomId, passedContext,contentType})
          currentSeqDetector = progressiveHandler?.$segementDetectorSequenece[++currentSeqDetectorIndex]
        }
      }
      if (done) break
    }
  } finally {
    logger.info({t:`${goal}: llm call finished`, goal, model, duration: Date.now() - llmStart}, {...reqBody, fullContent}, {ctx})
    logger.status('')
    onDone && onDone(fullContent)
    reader.releaseLock()
  }

  return {
    response,
    destroy() { controller.abort() }
  }

  function addDynamicSegments(...segments) {
    progressiveHandler?.$segementDetectorSequenece.push(...segments)
  }
}

export async function fetchItemsFromLLMReactiveP(args) {
return new Promise(resolve => fetchItemsFromLLMReactive({...args, onDone: responseText => resolve({responseText, ...args})}))
}

export const segmentDetectorByRegex = (beginRegex, endRegex) => content => {
  const beginMatch = content.match(beginRegex)
  if (beginMatch) {
    const segmentContent = content.substring(beginMatch.index + beginMatch[0].length)
    const endMatch = segmentContent.match(endRegex)
    if (endMatch) {
      return { text: segmentContent.substring(0, endMatch.index).trim(), swallow: beginMatch[0].length + endMatch.index + endMatch[0].length}
    }
  }
}

export const segmentDetectorJSONItem = tabsPrefix => segmentDetectorByRegex(new RegExp(`^${tabsPrefix}{`,'m'),new RegExp(`^${tabsPrefix}}`,'m'))

export const trimContext = (roomData, settings = null) => {
const now = Date.now()

// Generate 4-char letter-only IDs for users
const userIds = new Set()
roomData.content?.forEach(msg => {
  if (msg.sender) userIds.add(msg.sender)
})
if (settings?.content?.participants) {
  Object.keys(settings.content.participants).forEach(id => userIds.add(id))
}

const userIdMap = {}
const letters = 'abcdefghijklmnopqrstuvwxyz'
let counter = 0
userIds.forEach(userId => {
  // Generate 4-letter ID
  let shortId = ''
  let num = counter
  for (let i = 0; i < 4; i++) {
    shortId = letters[num % 26] + shortId
    num = Math.floor(num / 26)
  }
  userIdMap[userId] = shortId
  counter++
})

// Helper to convert timestamp to relative format
const timeToRelative = (timestamp) => {
  const diff = now - timestamp
  const days = Math.floor(diff / (24 * 60 * 60 * 1000))
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000))
  
  let result = ''
  if (days > 0) result += `d${days}`
  if (hours > 0) result += `h${hours}`
  if (minutes > 0) result += `m${minutes}`
  return result || 'm0'
}

// Trim messages
const trimmedContent = roomData.content?.map(msg => ({
  sender: userIdMap[msg.sender] || msg.sender,
  type: msg.type,
  content: msg.content,
  time: timeToRelative(msg.time)
})) || []

// Trim settings if provided
let trimmedSettings = null
if (settings?.content?.participants) {
  trimmedSettings = {
    participants: {}
  }
  Object.entries(settings.content.participants).forEach(([id, participant]) => {
    trimmedSettings.participants[userIdMap[id] || id] = {
      name: participant.name
    }
  })
}

return {
  content: trimmedContent,
  ...(trimmedSettings && { settings: trimmedSettings })
}
}