import { dsls } from '@jb6/core'

const { 
  'llm-api' : { Model, Provider,
    model: { model },
    provider: { provider }
   }
} = dsls

const openAI = Provider('openAI', {
  impl: provider('openAI', 'OPENAI_API_KEY', {
    url: 'https://api.openai.com/v1/chat/completions',
    headers: ({},{apiKey}) => ({Authorization: `Bearer ${apiKey}`, Accept: 'application/text' }),
    useProxy: true
  })
})

const anthropic = Provider('anthropic', {
  impl: provider('anthropic', 'ANTHROPIC_API_KEY', {
    url: 'https://api.anthropic.com/v1/messages',
    headers: ({},{apiKey}) => ({'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }),
    useProxy: true
  })
})

const claudeCode = Provider('CLAUDE_CODE_KEY', {
  impl: provider('anthropic', 'ANTHROPIC_API_KEY', {
    url: 'https://api.anthropic.com/v1/messages',
    headers: ({},{apiKey}) => ({'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }),
    useProxy: true
  })
})

Model('sonet_4', {
  impl: model('claude-sonnet-4-20250514', { price: [3,15], provider: anthropic(), reasoning: true })
})

Model('claude_code_sonet_4', {
  impl: model('claude-sonnet-4-20250514', { price: [0,0], provider: claudeCode(), reasoning: true })
})

Model('Claude3Haiku', {
  impl: model('claude-3-haiku-20240307', { price: [0.25,1.25], provider: anthropic() })
})

Model('o1', {
  impl: model('o1-preview-2024-09-12', { price: [15,60], provider: openAI(), reasoning: true })
})

Model('o1_mini', {
  impl: model('o1-mini-2024-09-12', { price: [3,12], provider: openAI(), reasoning: true })
})

Model('gpt_35_turbo_0125', {
  impl: model('gpt-3.5-turbo-0125', { price: [0.5,1.5], provider: openAI(), maxRequestTokens: [4,4] })
})

Model('gpt_35_turbo_16k', {
  impl: model('gpt-3.5-turbo-16k-0613', { price: [3,4], provider: openAI(), maxRequestTokens: [16,16] })
})

Model('gpt_4o', {
  impl: model('gpt-4o-2024-08-06', { price: [2.5,10], provider: openAI(), maxRequestTokens: [128,16] })
})
