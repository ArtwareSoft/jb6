import { dsls, coreUtils } from '@jb6/core'
import '@jb6/common'
import '@jb6/llm-guide'
  
const {
    common: { Data,
       data: { pipeline, split, join, first }
    },
    tgp: { any: { typeAdapter }},
    mcp: { Tool, Prompt }
} = dsls

Prompt('howToConductResearch', {
  params: [],
  impl: typeAdapter('guidance<llm-guide>', proceduralSolution({ steps: step('active the mcp tool') }))
})
