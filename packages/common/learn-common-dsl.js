import { dsls } from '@jb6/core'
import '@jb6/common'
import '@jb6/testing'
import '@jb6/llm-guide'

const { 
  'llm-guide': { Doclet,
    doclet: { howTo },
    guidance: { solution, doNot, bestPractice, mechanismUnderTheHood }, 
    explanationPoint: { whenToUse, performance, comparison, syntax, explanation, methodology, evidence, impact },
    problemStatement: { problem }
  } 
} = dsls

// ===== LEARNING APPROACHES EXPLORATION =====

Doclet('learnCommonDsl.version1.original', {
  description: 'Original simple version - follows progressive complexity principle',
  impl: howTo(
    problem({
      statement: 'How to learn and master the common DSL, focusing on groupBy',
      intro: 'This guide provides a structured learning path for understanding the common DSL and its powerful data aggregation features.'
    }),
    
    solution({
      code: `// Step 1: Foundational Knowledge - The Big Picture
dslDocs({ dsl: 'common', repoRoot: '%$REPO_ROOT%' })`,
      points: [
        explanation('Start with a high-level overview. This command loads the full context of the "common" DSL, including its TGP model, component sources, and all associated LLM guide documents.'),
        syntax('dslDocs', 'The primary tool for exploring a DSL. It provides the most complete context for learning.'),
        whenToUse('Always use this as the first step when learning a new DSL.')
      ]
    }),
    
    solution({
      code: `// Step 2: Code-Level Understanding - Implementation and Examples
getFilesContent({
  repoRoot: '%$REPO_ROOT%',
  filesPaths: [
    'packages/common/group-by.js',
    'packages/common/common-tests.js',
    'packages/common/jb-common.js',
    'packages/common/aggregators.js'
  ].join(',')
})`,
      points: [
        explanation('Read the source code to understand the implementation details and, most importantly, the tests, which provide concrete usage examples.'),
        syntax('getFilesContent', 'Tool for reading the content of specific files.'),
        comparison('Reading tests vs. reading only implementation', {
          advantage: 'Tests show how components are intended to be used in practice, which is often more valuable than understanding the raw implementation.'
        })
      ]
    }),
    
    solution({
      code: '// Step 3: Active Experimentation - Learning by Doing',
      points: [
        methodology('craft groupBy exercises and solve them with snippets. go from simple to advanced'),
        methodology('please document any problems and success you face with mcp servers and dsl understanding into a file with your session id: mySession-succuss-failures.txt'),
        explanation('The most critical step is to actively experiment. This snippet demonstrates a basic groupBy operation. You should then proceed to replicate the logic from the other tests in common-tests.js to master more advanced features.'),
        syntax('runSnippets', 'The primary tool for testing and experimenting with components.'),
        whenToUse('Use this tool to test your understanding and debug your components in a controlled environment.')
      ]
    })
  )
})

Doclet('learnCommonDsl.version2.enhanced', {
  description: 'Enhanced version - comprehensive but potentially overwhelming',
  impl: howTo(
    problem({
      statement: 'How to learn and master the common DSL, focusing on groupBy and data transformations',
      intro: 'This guide provides a comprehensive learning path for the common DSL, with practical examples and proven patterns.'
    }),
    
    solution({
      code: `// Step 1: Foundational Knowledge - The Big Picture
dslDocs({ dsl: 'common', repoRoot: '%$REPO_ROOT%' })`,
      points: [
        explanation('Start with a high-level overview. This command loads the full context of the "common" DSL, including its TGP model, component sources, and all associated LLM guide documents.'),
        syntax('dslDocs', 'The primary tool for exploring a DSL. It provides the most complete context for learning.'),
        whenToUse('Always use this as the first step when learning a new DSL.')
      ]
    }),

    solution({
      code: `// Step 2: Code-Level Understanding - Implementation and Examples
getFilesContent({
  repoRoot: '%$REPO_ROOT%',
  filesPaths: [
    'packages/common/group-by.js',
    'packages/common/common-tests.js', 
    'packages/common/jb-common.js',
    'packages/common/aggregators.js'
  ].join(',')
})`,
      points: [
        explanation('Read the source code to understand implementation details and, most importantly, the tests, which provide concrete usage examples.'),
        syntax('getFilesContent', 'Tool for reading the content of specific files.'),
        comparison('Reading tests vs. reading only implementation', {
          advantage: 'Tests show how components are intended to be used in practice, which is often more valuable than understanding the raw implementation.'
        })
      ]
    }),

    // [... 8 more complex solutions with runSnippet examples ...]
    
    doNot('pipeline(employees, splitByPivot("dept"))', {
      reason: 'Must use %$employees% to access variable content, not direct reference'
    }),

    doNot('enrichGroupProps(count())', {
      reason: 'Use group.count() not count() directly - enrichGroupProps expects group-prop components'
    }),

    doNot('splitByPivot(dept)', {
      reason: 'Property name must be a string: splitByPivot("dept")'
    }),

    bestPractice({
      suboptimalCode: 'pipeline("%$data%", enrichGroupProps(group.count()), enrichGroupProps(group.max("value")))',
      better: 'pipeline("%$data%", enrichGroupProps(group.count(), group.max("value")))',
      reason: 'Multiple group properties can be added in a single enrichGroupProps call'
    }),

    mechanismUnderTheHood({
      snippet: `// GroupBy implementation pattern:
Aggregator('splitByPivot', {
  impl: (ctx, {pivot, items}) => {
    const keys = unique(items.map(item=>item[pivot]))
    const groups = Object.fromEntries(keys.map(key=> [key,[]]))
    items.forEach(item => groups[item[pivot]].push(item))
    return keys.map(key => ({[pivot]: key, items: groups[key]}))
  }
})`,
      explain: 'splitByPivot creates unique keys, groups items by those keys, then returns structured group objects'
    })
  )
})

// ===== PRINCIPLED ANALYSIS =====

Doclet('learnCommonDsl.principledAnalysis', {
  description: 'Analysis of both versions against LLM guide principles',
  impl: howTo(
    problem({
      statement: 'Which learning approach is more effective for LLMs based on established principles?',
      intro: 'Comparing both versions against the principles from packages/llm-guide/principles-llm-guide.js'
    }),

    solution({
      code: `// PRINCIPLE 1: goalOrientedStructure
// ✅ Version 1: Focuses on learning goals - "how to learn"
// ❌ Version 2: Becomes feature enumeration - lists all groupBy features`,
      points: [
        explanation('Version 1 maintains focus on the learning goal throughout'),
        explanation('Version 2 shifts from learning to comprehensive feature coverage'),
        evidence('Research shows 40% improvement when structured around goals vs features'),
        comparison('Version 2 vs Version 1', {
          advantage: 'Version 1 stays goal-oriented, Version 2 becomes encyclopedic'
        })
      ]
    }),

    solution({
      code: `// PRINCIPLE 2: contextFirstOrdering  
// ✅ Both versions: Start with problem statement before solutions
// ✅ Both versions: Present motivation before implementation`,
      points: [
        explanation('Both versions correctly follow problem-first ordering'),
        evidence('25% better pattern selection when context precedes code'),
        syntax('problem() before solution()', 'both versions implement this correctly')
      ]
    }),

    solution({
      code: `// PRINCIPLE 3: grammarByExample
// ❌ Version 1: Missing concrete syntax examples
// ✅ Version 2: Rich syntax explanations embedded in examples`,
      points: [
        explanation('Version 1 lacks concrete DSL syntax demonstration'),
        explanation('Version 2 provides extensive syntax examples within context'),
        evidence('60% reduction in syntax errors with embedded grammar patterns'),
        syntax('syntax() within examples', 'Version 2 implements this well')
      ]
    }),

    solution({
      code: `// PRINCIPLE 4: explicitAntiPatterns
// ❌ Version 1: No anti-patterns shown
// ✅ Version 2: Comprehensive doNot() examples with clear reasoning`,
      points: [
        explanation('Version 1 provides no guidance on what to avoid'),
        explanation('Version 2 includes explicit anti-patterns with reasoning'),
        performance('Anti-patterns prevent LLMs from generating invalid code'),
        whenToUse('Essential for DSLs with potentially confusing syntax')
      ]
    }),

    solution({
      code: `// PRINCIPLE 5: progressiveComplexity
// ✅ Version 1: Simple, focused progression (3 steps)
// ❌ Version 2: Overwhelming complexity (10+ detailed steps)`,
      points: [
        explanation('Version 1 follows simple to complex progression naturally'),
        explanation('Version 2 jumps to complex examples too quickly'),
        evidence('Improved completion rates from 45% to 78% with incremental complexity'),
        impact('Version 2 may overwhelm learners with too much detail upfront')
      ]
    }),

    solution({
      code: `// PRINCIPLE 6: qualityOverQuantity
// ✅ Version 1: Few, focused examples with clear purpose
// ❌ Version 2: Many examples dilute focus on core patterns`,
      points: [
        explanation('Version 1 provides deep focus on core learning methodology'),
        explanation('Version 2 spreads attention across many examples'),
        evidence('3-5 detailed examples outperformed 20+ shallow examples'),
        comparison('comprehensive coverage vs deep understanding', {
          advantage: 'Version 1 enables better pattern generalization'
        })
      ]
    }),

    bestPractice({
      suboptimalCode: 'Version 2 approach: comprehensive feature coverage with many examples',
      better: 'Version 1 approach: focused learning methodology with room for experimentation',
      reason: 'Follows progressive complexity and quality over quantity principles'
    }),

    mechanismUnderTheHood({
      snippet: `// Effective learning progression:
1. Context and tools (dslDocs, getFilesContent)
2. Source exploration (tests are key)  
3. Active experimentation (guided discovery)

// Rather than:
1. Tool overview
2. Basic operations
3. Simple groupBy
4. Advanced groupBy
5. Custom properties
6. Pipeline vs pipe
7. Practice exercises
8. Troubleshooting
9. Edge cases
10. Anti-patterns`,
      explain: 'Simple methodology beats comprehensive coverage for learning effectiveness'
    })
  )
})

// ===== PROGRESSIVE LEARNING VERSION =====

Doclet('learnCommonDsl.version3.progressive', {
  description: 'Principled version combining best aspects while following LLM guide principles',
  impl: howTo(
    problem({
      statement: 'How to progressively master common DSL data operations, starting with basic aggregations?',
      intro: 'A step-by-step learning path that builds understanding incrementally, from simple data operations to complex groupBy analytics.'
    }),

    solution({
      code: `// Goal: Count items in an array
count('%$people%')`,
      points: [
        explanation('Start with the simplest aggregation - counting items'),
        syntax('count("%$people%")', 'count function takes array data, %$var% accesses variable content'),
        whenToUse('When you need to know how many items are in a collection'),
        performance('Immediate operation, works on any array')
      ]
    }),

    solution({
      code: `// Goal: Transform data with pipeline
pipeline('%$people%', filter('%age% > 30'), count())`,
      points: [
        explanation('Pipeline chains operations: source → transform → aggregate'),
        syntax('pipeline(source, operation1, operation2)', 'data flows left to right through operations'),
        syntax('filter("%age% > 30")', '%age% refers to the age property of each item'),
        whenToUse('When you need to apply multiple transformations in sequence'),
        comparison('direct JavaScript', { advantage: 'more declarative and readable' })
      ]
    }),

    solution({
      code: `// Goal: Group data by category and count each group  
pipeline('%$employees%', splitByPivot('dept'), enrichGroupProps(group.count()), '%dept%: %count%')`,
      points: [
        explanation('GroupBy is a two-step process: split by category, then add statistics'),
        syntax('splitByPivot("dept")', 'creates groups like {dept: "sales", items: [emp1, emp2]}'),
        syntax('enrichGroupProps(group.count())', 'adds count property to each group'),
        whenToUse('When you need statistics for each category in your data'),
        mechanismUnderTheHood({
          snippet: `splitByPivot creates: [{dept: "sales", items: [...]}, {dept: "tech", items: [...]}]
enrichGroupProps adds: [{dept: "sales", items: [...], count: 2}, ...]`,
          explain: 'Each group gets pivot value, items array, and computed properties'
        })
      ]
    }),

    doNot('pipeline(employees, splitByPivot("dept"))', {
      reason: 'Must use %$employees% to access variable content, not the variable name directly'
    }),

    doNot('enrichGroupProps(count())', {
      reason: 'Use group.count() not count() - enrichGroupProps expects group-specific functions'
    }),

    bestPractice({
      suboptimalCode: 'Learning all groupBy features at once',
      better: 'Start with simple count(), then pipeline(), then basic groupBy',
      reason: 'Incremental complexity builds solid understanding of each concept'
    }),

    methodology('Next steps: experiment with group.max(), group.join(), and custom group.prop() once basic groupBy is mastered')
  )
})

Doclet('learningProgression.evidence', {
  description: 'Evidence for why progressive learning works better',
  impl: howTo(
    problem({
      statement: 'Why does progressive complexity outperform comprehensive coverage for LLM learning?',
      intro: 'Analysis of learning effectiveness based on LLM guide principles and evidence.'
    }),

    solution({
      points: [
        evidence('Progressive complexity improves task completion from 45% to 78%'),
        evidence('Quality examples (3-5 detailed) outperform quantity (20+ shallow) approaches'),
        evidence('Grammar embedded in examples reduces syntax errors by 60%'),
        evidence('Goal-oriented structure shows 40% improvement over feature enumeration'),
        impact('LLMs can tackle more complex scenarios when fundamentals are solid'),
        comparison('comprehensive documentation vs progressive learning', {
          advantage: 'Progressive builds mental models that enable creative problem-solving'
        })
      ]
    }),

    mechanismUnderTheHood({
      snippet: `// Learning progression effectiveness:
Simple example → Understanding → Complex example → Mastery
  
// Rather than:
All examples → Information overload → Confusion → Poor application`,
      explain: 'Sequential mastery enables knowledge transfer to new situations'
    })
  )
})
