import { dsls } from '@jb6/core'

const { 
  'llm-api' : { Model, Provider,
    model: { model },
    provider: { provider }
   }
} = dsls

Provider('openAI', {
  impl: provider('openAI', 'OPENAI_API_KEY', {
    url: 'https://api.openai.com/v1/chat/completions',
    headers: obj(prop('Authorization', 'Bearer %$apiKey%'), prop('Accept', 'application/text')),
    useProxy: true
  })
})

Provider('anthropic', {
  impl: provider('anthropic', 'ANTHROPIC_API_KEY', {
    url: 'https://api.anthropic.com/v1/messages',
    headers: obj(prop('x-api-key', '%$apiKey%'), prop('anthropic-version', '2023-06-01')),
    useProxy: true
  })
})

Model('sonet_37', {
  impl: model('claude-3-7-sonnet-20250219', {
    price: [3,15],
    provider: anthropic(),
    reasoning: true
  })
})

Model('Claude3Haiku', {
  impl: model('claude-3-haiku-20240307', { price: [0.25,1.25], provider: anthropic() })
})

Model('o1', {
  impl: model('o1-preview-2024-09-12', {
    price: [15,60],
    speed: linear({ icon: [16,0.5], card: [15,3] }),
    reasoning: true
  })
})

Model('o1_mini', {
  impl: model('o1-mini-2024-09-12', {
    price: [3,12],
    speed: linear({ icon: [2,0.5], card: [5,3] }),
    reasoning: true
  })
})

Model('gpt_35_turbo_0125', {
  impl: model('gpt-3.5-turbo-0125', {
    price: [0.5,1.5],
    maxRequestTokens: [4,4],
    speed: linear({ icon: [3,0.3], card: [3,1] })
  })
})

Model('gpt_35_turbo_16k', {
  impl: model('gpt-3.5-turbo-16k-0613', {
    price: [3,4],
    maxRequestTokens: [16,16],
    speed: linear({ icon: [5,0.5], card: [5,1] })
  })
})

Model('gpt_4o', {
  impl: model('gpt-4o-2024-08-06', {
    price: [2.5,10],
    maxRequestTokens: [128,16],
    speed: linear({ icon: [5,0.3], card: [3,2] })
  })
})
