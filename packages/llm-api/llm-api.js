import { dsls, coreUtils } from '@jb6/core'

const { 
  common: { Data, ReactiveSource },
  tgp: { TgpType },
} = dsls

const { calcHash, log, delay, logError, logException } = coreUtils

const Provider = TgpType('provider', 'llm-api')
const Model = TgpType('model', 'llm-api')
const Prompt = TgpType('prompt', 'llm-api')
const gpt_35_turbo_0125 = Model.forward('gpt_35_turbo_0125')

ReactiveSource('llm.Completions', {
  params: [
    {id: 'prompt', type: 'prompt', dynamic: true},
    {id: 'llmModel', type: 'model', defaultValue: gpt_35_turbo_0125()},
    {id: 'maxTokens', as: 'number', defaultValue: 3500},
    {id: 'includeSystemMessages', as: 'boolean'},
    {id: 'useLocalStorageCache', as: 'boolean'},
    {id: 'notifyUsage', type: 'action<common>', dynamic: true}
  ],
  impl: (ctx,{ prompt, model, maxTokens: max_tokens,includeSystemMessages, useLocalStorageCache, notifyUsage}) => (start,sink) => {
      if (start !== 0) return
      let controller = null, connection, connectionAborted, DONE, fullContent = ''
      sink(0, (t,d) => {
        if (t == 2) {
          const aborted = controller && controller.signal.aborted
          log('llm source connection abort request', {aborted, ctx})
          delay(1).then(()=> controller?.signal.aborted && controller.abort())
          connectionAborted = true
        }
      })
      ;(async ()=>{
        const messages = prompt()
        const key = 'llm' + calcHash(model.name + JSON.stringify(messages))
        
        if (useLocalStorageCache && globalThis.localStorage && localStorage.getItem(key)) {
            sink(1,ctx.dataObj(fullContent, {...ctx.vars, fullContent: localStorage.getItem(key) }))
            sink(2)
            return
        }
        const start_time = new Date().getTime()
        let {controller, connection} = await jb.llmUtils.apiCall(model, {messages, max_tokens, ctx})
        const reader = connection.body.getReader()
        let chunkLeft = ''
        return reader.read().then(async function processResp({ done, value }) {
          if (done) {
            log('llm source done from reader', {ctx})
            if (!DONE) {
              DONE = true
              onEnd()
              sink(2)
            }
            return
          }
          const fullStr = chunkLeft + String.fromCharCode(...value)
          chunkLeftForLog = chunkLeft
          chunkLeft = ''
          fullStr.split('\n').map(x=>x.trim()).filter(x=>x).forEach(line => {
            if (DONE) return
            try {
              const val = line == 'data: [DONE]' ? 'done' : (line.startsWith('data: ') && line.endsWith('}') ? JSON.parse(line.slice(6)) : line)
              //log('llm processing val', {val, ctx})
              if (val == 'done') {
                log('llm source done from content', {ctx})
                if (DONE) logError('source.llmCompletions already DONE error', {val, ctx})
                DONE = true
                onEnd()
                sink(2)
                return
              }
              if (typeof val == 'string') {
                chunkLeft = val
                log('llm chunkLeft', {chunkLeft, ctx})
              }
              if (typeof val == 'object') {
                if (val.usage) {
                  Object.assign(val,{messages, fullContent, model: val.model || model.name})
                  Object.assign(val, jb.llmUtils.notifyApiUsage(val,ctx))
                  notifyUsage(ctx.setData(val))
                }
                const content = calcPath(val,'choices.0.delta.content') || calcPath(val,'delta.text')
                if (content == null) return
                if (typeof content != 'string') logError('source.llmCompletions non string content', {content, val, ctx})
                fullContent += content
                const toSend = includeSystemMessages ? val : content
                toSend && sink(1,ctx.dataObj(toSend, {...ctx.vars, fullContent}))
              }
            } catch (e) {
              logError('llm can not parse line',{chunkLeftForLog, line, sourceStr: String.fromCharCode(...value), ctx})
            }
          })
          return !connectionAborted && reader.read().then(processResp)

          function onEnd() {
            const res = {
              fullContent, messages, includeSystemMessages,              
              duration: new Date().getTime() - start_time,
              model: model.name
            }
            log('llm finished', {res, ctx})
            useLocalStorageCache && globalThis.localStorage && localStorage.setItem(key,res.fullContent)
          }
      })      
    })()
  }
})

Prompt('prompt', {
  type: 'prompt',
  params: [
    {id: 'elems', type: 'prompt[]', composite: true}
  ],
  impl: (ctx,elems) => elems
})

Prompt('system', {
  type: 'prompt',
  params: [
    {id: 'content', as: 'string', newLinesInCode: true}
  ],
  impl: (ctx,content) => ({role: 'system', content})
})

Prompt('assistant', {
    type: 'prompt',
    params: [
        {id: 'content', as: 'string', newLinesInCode: true}
    ],
    impl: (ctx,content) => ({role: 'assistant', content})
})

Prompt('user', {
  type: 'prompt',
  params: [
    {id: 'content', as: 'string', newLinesInCode: true}
  ],
  impl: (ctx,content) => ({role: 'user', content})
})

ReactiveOperator('llm.textToJsonItems', {
  params: [],
  impl: ctx => source => (start, sink) => {
  if (start !== 0) return

  let buffer = '', braceCount = 0, inString = false, escapeNext = false, currentIndex = 0, talkback, inItem

  sink(0, (t,d) => talkback && talkback(t,d))
  source(0, (t,d) => { 
    if (t === 0) talkback = d
    if (t === 1) {
      buffer += d.data
      if (!inItem && buffer.indexOf('{') == -1) return
      while (currentIndex < buffer.length) {
        const char = buffer[currentIndex]
        if (escapeNext)
          escapeNext = false
        else if (char === '\\')
          escapeNext = true
        else if (char === '"')
          inString = !inString
        else if (!inString) {
          if (char === '{') {
            braceCount++
            inItem = true
          }
          if (char === '}') braceCount--
          if (inItem && braceCount === 0) {
            const potentialJson = buffer.slice(0, currentIndex + 1).replace(/^[^{]*{/, '{')
              .replace(/:(\s*)(\d+)(\s*)([,}])/g, ':$1"$2"$3$4').replace(/,\s*([}\]])/g, '$1')
            try {
              const jsonItem = JSON.parse(potentialJson)
              sink(1, ctx.dataObj(jsonItem, d.vars || {}, d.data))
            } catch (error) {
              console.error(`Error parsing JSON: ${potentialJson}`, error.message)
            }
            buffer = buffer.slice(currentIndex + 1)
            //if (buffer.indexOf('{') == -1) inItem = false
            inItem = false
            currentIndex = 0
          }
        }
        currentIndex++
      }
    }
    if (t === 2) sink(2, d)
  })
  }
})

ReactiveOperator('llm.accumulateText', {
  impl: ctx => source => (start, sink) => {
    if (start !== 0) return
    let buffer = '', talkback

    sink(0, (t,d) => talkback && talkback(t,d))
    source(0, (t,d) => { 
      if (t === 0) talkback = d
      if (t === 1) {
        buffer += d.data
        sink(1, ctx.dataObj(buffer, d.vars || {}, d.data))
      }
      if (t === 2) sink(2, d)
    })
  }
})

Provider('provider', {
  params: [
    {id: 'name', as: 'string'},
    {id: 'keyName', as: 'string'},
    {id: 'url', as: 'string'},
    {id: 'headers', dynamic: true},
    {id: 'useProxy', as: 'boolean'}
  ]
})

Model('model', {
  params: [
    {id: 'name', as: 'string'},
    {id: 'price', as: 'array', byName: true, description: 'input/output $/M tokens'},
    {id: 'provider', type: 'provider' },
    {id: 'maxRequestTokens', as: 'array', description: 'input/output K'},
    {id: 'maxContextLength', as: 'number', defaultValue: 4096},
    {id: 'reasoning', as: 'boolean'}
  ]
})

jb.llmRepository = {
  callHistory: [],
  totalCost: 0
}

jb.llmUtils = {
   async apiCall(model, {messages, max_tokens,stream, ctx}) {
    stream = stream || true
    const apiKey = await jb.llmUtils.apiKey(model)
    const headers = {... model.provider.headers(ctx.setVars({apiKey})), 'Content-Type': 'application/json' }
    const controller = new AbortController()
    const maxTokensOpenAI = model.reasoning ? {max_completion_tokens: max_tokens} : {max_tokens : Math.min(max_tokens, model.maxContextLength)}
    const maxTokens = model.provider.name == 'openAI' ? maxTokensOpenAI : {max_tokens}
    const openAIProps = model.provider.name == 'openAI' 
      ? { stream_options: { include_usage: true}, top_p: 1, frequency_penalty: 0, presence_penalty: 0 } : {}

    const reqObj = {
      url: model.provider.url, method: 'POST', headers,
      body: JSON.stringify({ ...maxTokens, ...openAIProps, model: model.name,  stream, messages: jb.asArray(messages)  })
    }
    if (model.provider.useProxy) {
      reqObj.body = JSON.stringify({originalBody: reqObj.body, targetUrl: reqObj.url, headers})
      reqObj.url = '/?op=fetch'
    }

    const connection = await fetch(reqObj.url, {...reqObj, signal: controller.signal}).catch(e => {
        if (e instanceof DOMException && e.name == "AbortError") {
          log('llm source done from app logic', {ctx})
        } else {
          logException(e, 'llm connection', {ctx})
        }
    })
    return { connection, controller}
  },
  async apiKey(model) {
    const keyName = model.provider.keyName
    let key = globalThis.localStorage && localStorage.getItem(keyName) || jbHost.isNode && globalThis.process.env[keyName]
    if (!key) {
      const env = jbHost.isNode ? '' : await fetch(`/?env`).then(res=>res.text())
      key = env.split('\n').filter(l=>l.startsWith(keyName)).map(l=>l.split('=').pop())[0]
      globalThis.localStorage && globalThis.localStorage.setItem(keyName,key)
    }
    return key
  },
  notifyApiUsage(rec, ctx) {
    jb.llmRepository.callHistory.push(rec)
    const model = globalsOfType(Model).map(prof=>prof.$run()).find(m=>m.name == rec.model) 
    if (!model)
      return logError(`notifyApiUsage can not find model ${rec.model}`, {rec, ctx})
    const usage = rec.usage
    const [input,output] = model.price
    rec.model = model
    const cost = rec.cost = (input * (usage.prompt_tokens || 0) + output * (usage.completion_tokens || usage.output_tokens || 0) ) / 1000000
    jb.llmRepository.totalCost += cost
    return { totalCost: jb.llmRepository.totalCost, cost}
  }
}