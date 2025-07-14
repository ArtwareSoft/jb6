import { dsls, coreUtils } from '@jb6/core'
import '@jb6/llm-guide'

const { 
  common: { Data,
    data: {asIs}
  },
  tgp: { TgpType },
  mcp: { 
    Tool,
    tool: { doclet, createDirectoryStructure }
  },
  'llm-guide': { 
    doclet: { howTo },
    guidance: { solution, doNot, bestPractice, mechanismUnderTheHood }, 
    explanationPoint: { whenToUse, performance, comparison, syntax, explanation, methodology, evidence, impact },
    problemStatement: { problem }
  }
} = dsls

Tool('howToWriteLLmGuide', {
  impl: doclet(howTo(
    problem('How to write effective LLM guides using the llm-guide DSL'),
    solution({
      code: `// Required reading:
packages/llm-guide/principles-llm-guide.js     // Core principles
packages/core/llm-guide/tgp-primer.js         // Foundation examples  
packages/llm-guide/how-to-write-llm-guides.js // Structure patterns
packages/llm-guide/llm-guide-dsl.js           // Available components`,
      points: [
        explanation('Start with problem() - LLMs need goals before implementation'),
        explanation('Use progressive solution() blocks - simple to complex examples'),
        explanation('Include doNot() anti-patterns with clear reasoning'),
        explanation('Embed syntax() within working examples, not separate reference'),
        explanation('Quality over quantity - 3-5 detailed examples beat 20 shallow ones'),
        syntax('howTo(problem(), solution(), doNot(), validation())', 'core structure pattern')
      ]
    }),
    doNot('Use verbose, flowery language with unnecessary adjectives and filler words', {
      reason: 'LLMs tend to use too many words - essential wording only'
    }),
    doNot('Accept first draft as final - MANDATORY second round required', {
      reason: 'MANDATORY to try cutting 75% word count while keeping all essential information - this is very common and achievable'
    })
  ))
})

Tool('howToConductResearch', {
  impl: doclet(howTo(
    problem('How to conduct systematic research for LLM guides'),
    solution({
      code: `// Research workflow:
1. Define: domain, context, goal, audience
2. Create: research/{{researchId}}/ structure  
3. Gather: theory/, examples/, tests/ materials
4. Document: research-guide.js with methodology
5. Organize: examples-x.js, theory-x.js, tests-x.js
6. Log: successes and problems for framework improvement`,
      points: [
        explanation('Research ID: camelCase ~20 chars (e.g. cursorContentAwareFiles)'),
        explanation('Save originals with .txt/.md extensions in refs/ directories'),
        explanation('Log all interesting successes and problems - used to improve docs and framework'),
        syntax('createResearchDir mcp', 'creates organized directory structure'),
        syntax('llm-guide DSL', 'document all findings and methodology'),
        syntax('appendToFile /.llm-logs/${researchId}.txt with TIMESTAMP', 'log discoveries and issues in the environment and meta research (not the research)')
      ]
    }),
    doNot('Start research without clear domain/goal definition', {
      reason: 'unclear scope leads to unfocused material gathering'
    }),
    doNot('Skip logging successes and problems during research', {
      reason: 'logs are critical for improving documentation and framework - meta-learning opportunity'
    }),
    bestPractice({
      suboptimalCode: 'Find error, fix it, move on without documentation',
      better: 'After understanding errors: check if llm-guide files misled you, suggest fixes to user for approval',
      reason: 'Improve guides to prevent future errors - load packages/llm-guide/principles-llm-guide.js before suggesting fixes'
    })
  ))
})


Tool('howToWriteTests', {
  impl: doclet(howTo(
    problem('How to write effective tests for TGP components'),
    solution({
      code: `// Required reading:
packages/testing/llm-guide/how-to-write-tests.js  // Testing principles`,
      points: [
        explanation('Test behavior, not implementation'),
        explanation('One behavior per test'),
        explanation('Use minimal data'),
        explanation('Extract key values with %template% patterns'),
        syntax('dataTest({calculate: pipeline(), expectedResult: equals()})', 'standard pattern')
      ]
    }),
    doNot('Test internal structures', {
      reason: 'breaks during refactoring'
    }),
    doNot('Giant multi-behavior tests', {
      reason: 'difficult failure diagnosis'
    }),
    doNot('Accept first test draft as final - MANDATORY second round required', {
      reason: 'MANDATORY to try cutting 75% test size while keeping all essential verification - this is very common and achievable'
    })
  ))
})

Tool('createResearchDir', {
  params: [
    {id: 'repoRoot', as: 'string', mandatory: true, description: 'Absolute path to repository root'},
    {id: 'researchId', as: 'string', mandatory: true}
  ],
  impl: createDirectoryStructure('%$repoRoot%', 'research/%$researchId%', {
    structure: asIs({theory: { }, examples: {}, tests: {}})
  })
})