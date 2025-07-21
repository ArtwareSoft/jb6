import { dsls, coreUtils } from '@jb6/core'
import '@jb6/llm-api/skills.js'
import '@jb6/mcp'
const { 
   tgp: { TgpType, any: { typeAdapter } },
  'llm-api' : { Prompt,
    prompt: { user, system, prompt, includeBooklet } 
  },
  'llm-guide' : { Booklet, 
    booklet: { booklet }
  },
  mcp: { Tool,
    tool: { mcpTool }
  }
} = dsls

const promptContent = Tool('promptContent', {
  description: 'the content of calculated prompt result. the prompt components is defined in tgp dsl',
  params: [
    {id: 'prompt', type: 'prompt<llm-api>'},
    {id: 'repoRoot', as: 'string', mandatory: true, description: 'Absolute path to repository root'},
    {id: 'maxLength', as: 'number', defaultValue: 20000}
  ],
  impl: mcpTool('%$prompt%', '%$repoRoot%', { maxLength: '%$maxLength%' })
})

Tool('bookletsContent', {
  description: 'the content of a booklet, which is the content of a list of doclets',
  params: [
    {id: 'booklets', as: 'text', description: 'comma delimited names'},
    {id: 'repoRoot', as: 'string', mandatory: true, description: 'Absolute path to repository root'},
    {id: 'maxLength', as: 'number', defaultValue: 20000}
  ],
  impl: promptContent(includeBooklet('%$booklets%'), '%$repoRoot%', { maxLength: '%$maxLength%' })
})

// Tool('askExternalLLmWithBooklet', {
//   params: [
//     {id: 'bookletAndModel', type: 'bookletAndModel<llm-guide>', madatory: true},
//     {id: 'prompt', as: 'text', madatory: true}
//   ],
//   impl: mcpTool('%$bookletAndModel.booklet% ##\n%$prompt%')
// })