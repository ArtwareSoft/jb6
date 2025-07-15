import { dsls, coreUtils } from '@jb6/core'
import '@jb6/common'
import '@jb6/llm-guide'
  
const {
    common: { Data,
       data: { pipeline, split, join, first }
    },
    tgp: { any: { typeAdapter }},
    mcp: { Tool, Prompt },
    'llm-guide': { 
      doclet: { howTo },
      guidance: { solution, doNot }, 
      explanationPoint: { explanation, syntax },
      problemStatement: { problem }
    }
} = dsls

Prompt('howToConductResearch', {
  params: [],
  impl: typeAdapter('guidance<llm-guide>', 
    howTo(
      problem({
        statement: 'How to conduct systematic research for LLM guides',
        intro: 'Must ask user for definition before any action'
      }),
      solution({
        code: `// STEP 1 - ASK USER IMMEDIATELY:
"Before research: What's the domain, context, goal, and audience?"

// AFTER USER RESPONDS:
2. Create research/{{researchId}}/
3. Gather materials  
4. Document methodology
5. Log findings`,
        points: [
          explanation('Step 1 is interactive - ask four questions first'),
          syntax('MANDATORY FIRST STEP', 'never proceed without user definition')
        ]
      }),
      doNot('assuming parameters from user request', { 
        reason: 'framework requires explicit user input on domain/context/goal/audience' 
      })
    )
  )
})
