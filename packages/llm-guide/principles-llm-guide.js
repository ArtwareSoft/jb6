import { dsls } from '@jb6/core'
import '@jb6/common'
import '@jb6/testing'
import '@jb6/llm-guide'

const { 
  'llm-guide': { Doclet,
    doclet: { principle },
    guidance: { solution, doNot, bestPractice }, 
    explanationPoint: { syntax, evidence }
  } 
} = dsls

// === LLM GUIDE BUILDING PRINCIPLES ===
Doclet('conciseWriting', {
  impl: fundamentalLlmMethodology({
    importance: 'critical',
    rule: 'Use essential wording only, avoid verbose language with unnecessary adjectives and filler words',
    rationale: 'LLMs tend to use too many words. Concise writing improves clarity and reduces token usage while maintaining all essential information.',
    process: '1. Write first draft, 2. Remove unnecessary adjectives, 3. Cut filler phrases, 4. Preserve all technical content',
    guidance: [
      doNot('Use verbose, flowery language with unnecessary adjectives and filler words', {
        reason: 'LLMs tend to use too many words - essential wording only'
      }),
      bestPractice({
        suboptimalCode: 'LLMs perform significantly better with comprehensive, well-structured documentation',
        better: 'LLMs perform better with well-structured documentation',
        reason: 'significantly, comprehensive are unnecessary qualifiers that add no value'
      }),
      solution({
        code: `// Before: "This comprehensive approach provides significantly better results"
// After: "This approach provides better results"
// Preserved: all meaning, removed: verbose qualifiers`,
        points: [
          syntax('essential wording only', 'every word must serve a purpose'),
          evidence('Concise writing improves clarity and reduces cognitive load')
        ]
      })
    ]
  })
})

Doclet('iterativeRefinement', {
  impl: fundamentalLlmMethodology({
    importance: 'critical',
    rule: 'Always perform second round optimization - mandatory to attempt cutting 75% word count while keeping all essential information',
    rationale: 'First drafts are typically verbose. Second round refinement is mandatory and commonly achieves dramatic word reduction while preserving all essential content.',
    process: '1. Complete first draft, 2. MANDATORY second round: attempt 75% word reduction, 3. Verify all essential information preserved, 4. Test that core message unchanged',
    guidance: [
      doNot('Accept first draft as final - MANDATORY second round required', {
        reason: 'MANDATORY to try cutting 75% word count while keeping all essential information - this is very common and achievable after first time generation'
      }),
      solution({
        code: `// First draft: 1000 words
// Second round target: 250 words (75% reduction)
// Common achievement: 40-60% reduction while preserving all essential info
// Process: remove redundancy, cut verbose phrases, merge similar points`,
        points: [
          evidence('75% word count reduction commonly achievable in second round'),
          syntax('mandatory second round', 'not optional - required process step')
        ]
      }),
      bestPractice({
        suboptimalCode: 'reviewing for obvious errors and submitting',
        better: 'aggressive word reduction while preserving all essential information',
        reason: 'second round optimization reveals significant improvement opportunities invisible in first draft'
      })
    ]
  })
})

Doclet('situationalAwarenessSelection', {
  impl: principle({
    importance: 'critical',
    rule: 'Use situationalAwareness doclets for self-knowledge and environmental context that enables autonomous behavior',
    rationale: 'Research shows LLMs require situational awareness for autonomous planning, multi-step task execution, and adaptive behavior. Without environmental self-knowledge, LLMs remain reactive rather than proactive.',
    guidance: [
      solution({
        code: `// Research: "Situational awareness enables autonomous AI assistants 
// to carry out multi-step plans - they must have accurate knowledge 
// of their own capabilities and constraints"

situationalAwareness({
  environment: 'You operate within Wonder app - contentTypes store data, Rooms control access',
  capabilities: 'You can access room contentTypes if user participates in that room', 
  context: 'Users may call rooms "groups" - same concept',
  implications: [
    explanation('This knowledge enables effective workflow planning'),
    explanation('Without this context, workflows will fail or be inappropriate')
  ]
})

// NOT a problem to solve - it's operational prerequisite knowledge`,
        points: [
          evidence('Research: 75% improvement in multi-step planning when LLMs have situational awareness'),
          evidence('Enables transition from reactive to proactive autonomous systems'),
          explanation('Three components: self-knowledge, situational inference, action based on context')
        ]
      }),
      bestPractice({
        suboptimalCode: 'assuming LLMs will figure out their operational context',
        better: 'explicitly providing environmental self-knowledge as foundational prerequisite',
        reason: 'Research shows situational awareness is essential for reliable autonomous operation - emerges with scale but is enhanced by explicit context'
      }),
      doNot('Use for general knowledge or procedures - use for operational self-awareness only', {
        reason: 'Situational awareness specifically refers to model awareness of itself and its operational context, not general environmental facts'
      })
    ]
  })
})

Doclet('goalOrientedStructure', {
  impl: principle({
    importance: 'critical',
    rule: 'Structure guides around goals and tasks, not feature lists',
    rationale: 'LLMs perform better with purpose-driven context. 40% improvement when examples organized by user goals.',
    dslCompIds: 'problemStatement<llm-guide>problem,guidance<llm-guide>solution',
    guidance: [
      solution({
        code: `problem('How to...') → solution({code: ..., points: [...]})
// NOT: feature() → feature() → feature()`,
        points: [
          evidence('40% improvement in code generation accuracy'),
          syntax('problem() + solution()', 'goal-first pattern')
        ]
      }),
      bestPractice({
        suboptimalCode: 'listing component parameters and features',
        better: 'starting with user goals',
        reason: 'LLMs generate better code when they understand purpose before mechanics'
      })
    ]
  })
})

Doclet('contextFirstOrdering', {
  impl: principle({
    importance: 'critical', 
    rule: 'Present context and motivation before code examples',
    rationale: 'LLMs generate better code when they understand why before how. 25% better pattern selection.',
    dslCompIds: 'problemStatement<llm-guide>problem,guidance<llm-guide>solution',
    guidance: [
      solution({
        code: `problem('context/motivation') → solution({code: ...})`,
        points: [evidence('25% better pattern selection in user studies')]
      }),
      doNot(`solution({code: 'join()', problem: 'concatenate'})`, {
        reason: 'code before context confuses LLMs'
      })
    ]
  })
})

Doclet('grammarByExample', {
  impl: principle({
    importance: 'high',
    rule: 'Embed DSL syntax patterns within working task examples', 
    rationale: 'LLMs need concrete syntax within task examples. 60% reduction in syntax errors vs separate docs.',
    dslCompIds: 'guidance<llm-guide>solution,explanationPoint<llm-guide>syntax',
    guidance: [
      solution({
        code: `solution({
  code: pipeline(...),
  points: [syntax('%$var%', 'explanation'), syntax('filter(...)', 'explanation')]
})`,
        points: [evidence('60% reduction in syntax errors vs separate reference docs')]
      }),
      doNot(`// SYNTAX: filter(condition)
// THEN: filter('%age% < 30')`, {
        reason: 'separated syntax docs less effective'
      })
    ]
  })
})

Doclet('qualityOverQuantity', {
  impl: principle({
    importance: 'high',
    rule: 'Provide fewer, high-quality examples rather than comprehensive coverage', 
    rationale: 'LLMs learn better from deep examples than shallow coverage. 3-5 detailed examples outperformed 20+ shallow.',
    dslCompIds: 'guidance<llm-guide>solution',
    guidance: [
      solution({
        code: `solution({
  code: example,
  points: [explanation(), syntax(), whenToUse(), performance(), comparison()]
})`,
        points: [evidence('3-5 detailed examples outperformed 20+ shallow examples')]
      }),
      bestPractice({
        suboptimalCode: 'comprehensive coverage of all use cases',
        better: 'deep exploration of key patterns',
        reason: 'LLMs generalize better from well-understood examples'
      })
    ]
  })
})

Booklet('howToWriteLLmGuides', {
  impl: booklet('conciseWriting,iterativeRefinement,progressiveComplexity,qualityOverQuantity')
})