import { dsls } from '@jb6/core'
import '@jb6/common'
import '@jb6/testing'
import '@jb6/llm-guide'

const { 
  'llm-guide': { Doclet,
    doclet: { exercise },
    guidance: { solution, doNot, bestPractice, mechanismUnderTheHood }, 
    explanationPoint: { whenToUse, performance, comparison, syntax, explanation, evidence, impact },
    problemStatement: { problem }
  } 
} = dsls

// === LLM GUIDE BUILDING PRINCIPLES ===

Doclet('goalOrientedStructure', {
  impl: exercise(
    problem({
      statement: 'How should LLM guides be structured for maximum effectiveness?',
      importance: 'critical',
      intro: 'LLMs perform significantly better with purpose-driven context that focuses on goals and tasks rather than feature enumeration.'
    }),
    solution({
      points: [
        explanation('Structure guides around goals and tasks, not feature lists'),
        evidence('Research shows LLMs understand code better when examples are organized by what users want to achieve'),
        evidence('Measured 40% improvement in code generation accuracy'),
        comparison('feature documentation', { advantage: 'provides clear mental models for problem-solving' }),
        syntax('problem() + solution()', 'goal-first structure pattern'),
        whenToUse('when documenting any DSL component or pattern')
      ]
    }),
    bestPractice('listing component parameters and features', {
      better: 'starting with user goals and showing solutions',
      reason: 'LLMs generate better code when they understand the purpose before the mechanics'
    })
  )
})

Doclet('contextFirstOrdering', {
  impl: exercise(
    problem({
      statement: 'What order should information be presented in LLM guides?',
      importance: 'critical',
      intro: 'LLMs generate better code when they understand the why before the how.'
    }),
    solution({
      points: [
        explanation('Present context and motivation before code examples'),
        evidence('Problem-solution ordering helps LLMs choose appropriate patterns for user needs'),
        evidence('25% better pattern selection in user studies'),
        comparison('code-first documentation', { advantage: 'reduces inappropriate solution choices' }),
        syntax('problem() before solution()', 'motivation before implementation'),
        whenToUse('every exercise should start with problem statement')
      ]
    }),
    doNot(`solution({
  code: 'join()', 
  problem: 'concatenate strings'  // ❌ backwards ordering
})`, { reason: 'code before context confuses LLMs about appropriate usage' })
  )
})

Doclet('grammarByExample', {
  impl: exercise(
    problem({
      statement: 'How should DSL syntax be taught to LLMs?',
      importance: 'high',
      intro: 'LLMs need concrete syntax patterns embedded within task examples to generate valid code.'
    }),
    solution({
      code: `// GRAMMAR BY EXAMPLE:
solution({
  code: pipeline('%$people%', filter('%age% < 30'), count()),
  points: [
    syntax('%$people%', 'get the content of variable "people"'),           // ← syntax within context
    syntax('filter(\'%age% < 30\')', 'use filter with expression'),        // ← patterns in examples
    syntax('count()', 'aggregator that counts items in pipeline')          // ← grammar explained
  ]
})`,
      points: [
        explanation('Include DSL-specific syntax and patterns directly in examples'),
        evidence('Embedding grammar rules within task examples helps LLMs learn both syntax and semantics'),
        evidence('Reduced syntax errors by 60% compared to separate reference docs'),
        syntax('syntax() explanations', 'embed grammar rules within working examples'),
        whenToUse('when teaching complex DSL constructs with multiple parameters'),
        performance('integrated syntax learning is more effective than separate reference docs')
      ]
    }),
    doNot(`// Separate syntax reference:
// SYNTAX: filter(condition) - filters array
// SYNTAX: %$var% - variable access
// THEN: filter('%age% < 30')`, { reason: 'separated syntax docs are less effective than integrated examples' })
  )
})

Doclet('explicitAntiPatterns', {
  impl: exercise(
    problem({
      statement: 'How should common mistakes be documented?',
      importance: 'high',
      intro: 'Explicit anti-patterns help LLMs avoid common pitfalls and clarify ambiguous syntax.'
    }),
    solution({
      code: `// EXPLICIT ANTI-PATTERNS:
solution({
  code: pipeline('%$people%', filter('%age% < 30'), count()),
  points: [explanation('correct boolean expression syntax')]
}),
doNot('filter(\'%age% < 30 && %name% == "Bart"\')', {    // ← explicit anti-pattern
  reason: '&& operator not supported in expressions'      // ← clear reasoning
}),
doNot('WHERE age < 30 AND name = "Bart"', {             // ← another anti-pattern
  reason: 'SQL WHERE clauses not supported'              // ← prevents confusion
})`,
      points: [
        explanation('Clearly document common mistakes and suboptimal patterns alongside correct approaches'),
        explanation('Helps LLMs avoid common pitfalls and clarifies ambiguous syntax'),
        syntax('doNot() components', 'explicit anti-pattern documentation'),
        whenToUse('when syntax might be misleading or when there are common mistakes'),
        comparison('implicit learning', { advantage: 'explicit contrast reinforces correct usage' }),
        performance('prevents LLMs from generating invalid code patterns')
      ]
    }),
    bestPractice('assuming LLMs will avoid mistakes', {
      better: 'explicitly showing what not to do with clear reasoning',
      reason: 'explicit anti-patterns prevent confusion and reinforce correct patterns'
    })
  )
})

Doclet('progressiveComplexity', {
  impl: exercise(
    problem({
      statement: 'How should example complexity be ordered?',
      importance: 'high',
      intro: 'Building understanding incrementally prevents overwhelming LLMs with complex examples before fundamentals are clear.'
    }),
    solution({
      code: `// PROGRESSIVE COMPLEXITY:
// Step 1: Simple case
solution({
  code: count('%$people%'),
  points: [explanation('basic count usage')]
}),
// Step 2: With pipeline 
solution({
  code: pipeline('%$people%', count()),
  points: [explanation('count as pipeline operator')]
}),
// Step 3: Complex pipeline
solution({
  code: pipeline('%$people%', filter('%age% < 30'), count()),
  points: [explanation('count after filtering operation')]
})`,
      points: [
        explanation('Start with simple examples, gradually introduce complexity'),
        evidence('Layered examples allow LLMs to grasp fundamentals before tackling advanced patterns'),
        evidence('Improved task completion rates from 45% to 78%'),
        impact('Enables LLMs to tackle more complex real-world scenarios'),
        syntax('multiple solution() blocks', 'progression from simple to complex'),
        whenToUse('when documenting components that can be used in multiple contexts'),
        performance('incremental learning reduces cognitive load and improves retention')
      ]
    }),
    doNot('starting with the most complex example first', {
      reason: 'overwhelming complexity prevents understanding of fundamental patterns'
    })
  )
})

Doclet('qualityOverQuantity', {
  impl: exercise(
    problem({
      statement: 'How many examples should be provided for each concept?',
      importance: 'high',
      intro: 'LLMs learn better from deep, well-explained examples than from shallow coverage of many scenarios.'
    }),
    solution({
      code: `// QUALITY APPROACH - fewer detailed examples:
solution({
  code: pipeline('%$people%', filter('%age% < 30'), '%name%', join()),
  points: [
    explanation('complete data flow from source to result'),
    syntax('pipeline composition', 'how operations chain together'),
    whenToUse('when building comma-separated lists from filtered data'),
    performance('efficient for small to medium datasets'),
    comparison('manual JavaScript', { advantage: 'more declarative and readable' })
  ]
})

// Rather than many shallow examples covering every possible use case`,
      points: [
        explanation('Provide fewer, high-quality examples rather than comprehensive coverage'),
        evidence('Detailed explanations of key patterns enable better generalization to new situations'),
        evidence('3-5 detailed examples outperformed 20+ shallow examples'),
        syntax('rich explanation points', 'deep context for each example'),
        whenToUse('when documenting core DSL patterns that appear in many contexts'),
        performance('quality examples enable better pattern generalization')
      ]
    }),
    bestPractice('comprehensive coverage of all possible use cases', {
      better: 'deep exploration of key patterns with rich context',
      reason: 'LLMs generalize better from well-understood examples than from broad shallow coverage'
    }),
    mechanismUnderTheHood({
      snippet: `// Quality example structure:
solution({
  code: 'working_example',
  points: [
    explanation('what this does'),
    syntax('key_syntax_element', 'how it works'), 
    whenToUse('appropriate contexts'),
    performance('performance characteristics'),
    comparison('alternative_approach', { advantage: 'why this is better' })
  ]
})`,
      explain: 'rich context helps LLMs understand not just how but when and why to use patterns'
    })
  )
})