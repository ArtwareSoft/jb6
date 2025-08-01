import { dsls, coreUtils } from '@jb6/core'
import '@jb6/llm-api/skills.js'
import '@jb6/mcp'
const { 
  tgp: { TgpType, any: { typeAdapter } },
  common: {
    data: { bookletsContent}
  },
  'llm-guide' : { Booklet, 
    booklet: { booklet }
  },
  mcp: { Tool,
    tool: { mcpTool }
  }
} = dsls

Tool('bookletsContentTool', {
  description: 'the content of a booklet, which is the content of a list of doclets',
  params: [
    {id: 'booklets', as: 'text', description: 'comma delimited names'},
    {id: 'repoRoot', as: 'string', mandatory: true, description: 'Absolute path to repository root'},
    {id: 'maxLength', as: 'number', defaultValue: 20000}
  ],
  impl: mcpTool(bookletsContent('%$booklets%'), '%$repoRoot%', { maxLength: '%$maxLength%' })
})

// Tool('askExternalLLmWithBooklet', {
//   params: [
//     {id: 'bookletAndModel', type: 'bookletAndModel<llm-guide>', madatory: true},
//     {id: 'prompt', as: 'text', madatory: true}
//   ],
//   impl: mcpTool('%$bookletAndModel.booklet% ##\n%$prompt%')
// })