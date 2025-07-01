import { dsls } from '@jb6/core'

const { 
  common: { Data },
  tgp: { TgpType }
} = dsls

// ============================================================================= 
// DOCLET DSL - 
// Guidance LLM doclets codify expert task-solving patterns into structured, reusable templates 
// that teach LLMs how to perform complex tasks consistently and effectively.
// =============================================================================

// Define the DSL types
const Doclet = TgpType('doclet', 'doclet')           // Main documentation container
const Do = TgpType('do', 'doclet')                   // LLM instruction components
const Explanation = TgpType('explanation', 'doclet') // Individual explanation components (including evidence)
const Condition = TgpType('condition', 'doclet')     // Conditions for detection
const Pattern = TgpType('pattern', 'doclet')

// =============================================================================
// TYPE: doclet - Main documentation container
// =============================================================================

Pattern('pattern', {
  description: 'Reusable problem-solving template for recurring LLM tasks',
  params: [
    {id: 'problem', as: 'text', mandatory: true, description: 'What problem this pattern solves'},
    {id: 'solution', type: 'do[]', mandatory: true, byName: true, description: 'Structured approach'},
    {id: 'context', type: 'condition', mandatory: true, description: 'How to detect when this applies'},
    {id: 'examples', type: 'example[]', mandatory: true},
    {id: 'related patterns', as: 'text', description: 'Pattern adaptations for different scenarios'}
  ]
})

Doclet('concept', {
  description: 'Foundational knowledge definition that LLMs need to understand before performing tasks',
  params: [
    {id: 'definition', as: 'text', mandatory: true, description: 'Clear definition of the concept'},
    {id: 'detect', type: 'detector', description: 'How to recognize this concept in practice'},
    {id: 'characteristics', type: 'explanation[]', description: 'Key properties and attributes'},
    {id: 'relationships', as: 'text', description: 'How this concept relates to other concepts'},
    {id: 'commonMisunderstandings', type: 'explanation[]', description: 'Frequent misconceptions'}
  ]
})

Doclet('principle', {
  description: 'Fundamental principle for effective LLM documentation',
  params: [
    {id: 'importance', as: 'text', mandatory: true, description: 'e.g. 5 of 5'},
    {id: 'rule', as: 'text', mandatory: true, description: 'The principle statement'},
    {id: 'rationale', as: 'text', mandatory: true, description: 'Why this principle matters'},
    {id: 'dslCompIds', type: 'data[]', description: `Full component IDs to use. E.g., 'do<doclet>doNot'`},
    {id: 'evidence', type: 'explanation<doclet>', description: 'Supporting evidence and examples'}
  ]
})

// =============================================================================
// TYPE: condition - Conditions for detection
// =============================================================================

Condition('not', {
  params: [
    {id: 'not', type: 'condition', composite: true, mandatory: true },
  ]
})

Condition('conditions', {
  params: [
    {id: 'If', type: 'condition[]', composite: true}
  ]
})

Condition('condition', {
  params: [
    {id: 'indicator', as: 'text', mandatory: true, description: 'What to look for'},
  ]
})

Condition('codeSignals', {
  description: 'Detects specific code patterns and structures',
  params: [
    {id: 'patterns', as: 'text', mandatory: true, description: 'Code patterns to look for'},
    {id: 'description', as: 'text', mandatory: true, description: 'What coding patterns this detects'},
  ]
})

Condition('dataStructure', {
  description: 'Detects data format and structure characteristics',
  params: [
    {id: 'condition', as: 'text', mandatory: true, description: 'What data structure this detects'},
  ]
})

Condition('signal', {
  description: 'A condition or signal to detect in the input',
  params: [
    {id: 'indicator', as: 'text', mandatory: true, description: 'What to look for'},
    {id: 'context', as: 'text', description: 'Additional context about this signal'}
  ]
})

// =============================================================================
// TYPE: do - LLM instruction components
// =============================================================================
// Do('instructions', {
//   params: [
//     {id: 'Do', type: 'do[]', composite: true }
//   ]
// })

Do('desc', {
  params: [
    {id: 'code', type: 'data<common>',  mandatory: true},
    {id: 'expl', type: 'explanation[]', as: 'array', composite: true, secondParamAsArray: true}
  ]
})

Do('doNot', {
  params: [
    {id: 'badCode', as: 'text', mandatory: true},
    {id: 'reason', as: 'text', mandatory: true, byName: true}
  ]
})

Do('doBetter', {
  description: 'Instruction for improved approach over suboptimal method',
  params: [
    { id: 'suboptimalCode', as: 'text', mandatory: true },
    { id: 'better', as: 'text', mandatory: true, byName: true },
    { id: 'reason', as: 'text', mandatory: true, byName: true }
  ]
})

Do('doNever', {
  description: 'Instruction about approaches that are completely invalid and should never be attempted',
  params: [
    { id: 'badCode', as: 'text', mandatory: true },
    { id: 'reason', as: 'text', mandatory: true, byName: true }
  ]
})

Do('doUnderstand', {
  description: 'Instruction to understand underlying mechanisms through code examples',
  params: [
    {id: 'snippet', newLinesInCode: true, as: 'text', mandatory: true},
    {id: 'points', type: 'explanation[]', as: 'array', composite: true, secondParamAsArray: true}
  ]
})

Do('case', {
  description: 'Conditional instruction - do this when specific conditions apply',
  params: [
    {id: 'when', as: 'text', mandatory: true, description: 'Condition or context when this applies'},
    {id: 'instruction', type: 'do', mandatory: true, description: 'What to do in this case'},
    {id: 'evidence', type: 'explanation[]', description: 'Supporting data for this approach'},
    {id: 'tradeoffs', type: 'explanation[]', description: 'Benefits and costs of this approach'}
  ]
})

// =============================================================================
// TYPE: explanation - Individual explanation components (including evidence)
// =============================================================================

Explanation('research', {
  description: 'Research findings and evidence base',
  params: [
    { id: 'findings', as: 'text', mandatory: true, description: 'Key research conclusions' },
    { id: 'methodology', as: 'text', description: 'How the research was conducted' },
    { id: 'impact', as: 'text', description: 'Measured impact or improvement' }
  ]
})

Explanation('measurement', {
  description: 'Quantified performance or effectiveness data',
  params: [
    { id: 'metric', as: 'text', mandatory: true, description: 'What was measured' },
    { id: 'value', as: 'text', mandatory: true, description: 'The measured value' },
    { id: 'conditions', as: 'text', description: 'Under what conditions this was measured' }
  ]
})

Explanation('benchmark', {
  description: 'Comparative performance data against alternatives',
  params: [
    { id: 'baseline', as: 'text', mandatory: true, description: 'What was compared against' },
    { id: 'improvement', as: 'text', mandatory: true, description: 'How much better/worse' },
    { id: 'context', as: 'text', description: 'Testing context and conditions' }
  ]
})

Explanation('general', {
  params: [
    {id: 'explain', as: 'text', mandatory: true}
  ]
})

Explanation('syntax', {
  params: [
    {id: 'expression', as: 'text', mandatory: true},
    {id: 'explain', as: 'text', mandatory: true}
  ]
})

Explanation('whenToUse', {
  params: [
    { id: 'context', as: 'text', mandatory: true }
  ]
})

Explanation('performance', {
  params: [
    { id: 'characteristic', as: 'text', mandatory: true },
    { id: 'details', as: 'text', byName: true }
  ]
})

Explanation('comparison', {
  params: [
    { id: 'comparedTo', as: 'text', mandatory: true },
    { id: 'advantage', as: 'text', mandatory: true, byName: true }
  ]
})

Explanation('tradeoff', {
  params: [
    { id: 'benefit', as: 'text', mandatory: true },
    { id: 'cost', as: 'text', mandatory: true, byName: true }
  ]
})

Explanation('impact', {
  params: [
    { id: 'impact', as: 'text', mandatory: true }
  ]
})

Explanation('methodology', {
  params: [
    {id: 'steps', as: 'text', mandatory: true},
    {id: 'tools', as: 'text'}
  ]
})

// --
const { 
  doclet: { 
    pattern: { pattern },
    do: { solution, doNot, bestPractice, mechanismUnderTheHood, illegalSyntax }, 
    explanation: { whenToUse, performance, comparison, syntax, generalExpl },
    condition: {conditions, condition}
  } 
} = dsls


Pattern('pipeline', {
  impl: pattern('data calculation with aggregation is needed', {
    solution: 'build pipeline with source and operators',
    context: conditions(
      condition('data calculation with aggregation is needed'),
      condition('performance is not key issue')
    ),
    examples: TBD()
  })
})

Doclet('countUnder30', {
  impl: pattern('count people under 30',
    solution(
      pipeline('%$people%', filter('%age% < 30'), count()),
      general('count() uses %% parameter by default'),
      syntax('%$people%', 'get the content of the variable "people" use it as source'),
      syntax(`filter('%age% < 30')`, 'use filter with expression, filter can also have boolean components "filter(between(1,10))"'),
      whenToUse('in pipelines when chaining operations'),
      performance('good for small datasets, slower on 10k+ items')
    ),
    solution(
      count(pipeline('%$people%', filter('%age% < 30'))),
      general('explicit parameter to count()'),
      syntax({
        expression: 'count(data_exp)',
        explain: 'count first param is "items". it counts them. when inside a pipe the items defaultValue is "%%", means the array passed in the pipe'
      }),
      whenToUse('when you need more control over data flow'),
      comparison('pipeline approach', { advantage: 'clearer data flow' })
    ),
    solution(
      (ctx) => ctx.data.filter(p => p.age < 30).length,
      general('JavaScript function approach'),
      whenToUse('large datasets (1k+ items)'),
      performance('fastest - native JavaScript execution. avoid the pipeline interpreter iteration')
    ),
    doNot('%$people[age<30]%', { reason: 'XPath syntax not supported' }),
    doNot('SELECT COUNT(*) FROM people WHERE age < 30', { reason: 'SQL queries not supported' }),
    doNot('$.people[?(@.age<30)].length', { reason: 'JSONPath not supported' }),
    mechanismUnderTheHood(`Aggregator('count', {\n  description: 'length, size of array',\n  params: [\n    {id: 'items', as: 'array', defaultValue: '%%'}\n  ],\n  impl: ({},{items}) => items.length\n})`)
  )
})
