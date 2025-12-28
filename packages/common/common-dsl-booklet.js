import { dsls } from '@jb6/core'
import '@jb6/common'
import '@jb6/testing'
import '@jb6/llm-guide'

const { 
  'llm-guide': { Doclet,
    doclet: { howTo, principle },
    guidance: { solution, doNot, bestPractice, mechanismUnderTheHood }, 
    explanationPoint: { whenToUse, performance, comparison, syntax, explanation, methodology, evidence, impact },
    problemStatement: { problem }
  } 
} = dsls

// ===== COMMON DSL BOOKLET DOCLETS =====

Doclet('commonDslFoundations', {
  impl: principle('critical', 'Common DSL provides the foundation for all data processing in TGP', {
    rationale: 'The common DSL contains essential components for data transformation, boolean logic, and actions. These form the building blocks that other DSLs depend on.',
    guidance: [
      solution({
        code: `// Common DSL Organization - Three Primary Types:

// 1. DATA PROCESSING (data<common>)
pipeline('%$users%', filter('%active%'), count())        // Core data flow
toUpperCase('hello world')                                // String transformations
splitByPivot('department')                               // Grouping operations
obj(prop('name', '%$user/name%'))                        // Object construction

// 2. BOOLEAN LOGIC (boolean<common>)  
and('%age% > 18', '%verified% == true')                 // Logical operations
contains(['admin', 'manager'], '%$user/role%')          // Membership testing
between(18, 65, '%age%')                                 // Range validation

// 3. ACTIONS (action<common>)
runActions([log('Processing'), setVar('status', 'done')])  // Action sequencing
runActionOnItems('%$items%', log('Item: %%'))            // Iteration actions`,
        points: [
          explanation('Three component types handle different aspects of data processing'),
          syntax('data<common>', 'transforms and processes data collections'),
          syntax('boolean<common>', 'evaluates conditions and logic'),
          syntax('action<common>', 'performs side effects and state changes'),
          whenToUse('data for transformations, boolean for conditions, action for effects'),
          performance('Common DSL components are optimized and battle-tested across many projects')
        ]
      }),
      solution({
        code: `// Component Naming Pattern - Type<DSL>ComponentName
"data<common>pipeline"     // Data processing pipeline
"boolean<common>and"       // Boolean AND operation
"action<common>log"        // Logging action

// Profile Structure Shows Component Identity
{
  "$$": "data<common>filter",
  "filter": "%active% == true"
}`,
        points: [
          explanation('Every component has a unique type<dsl>name identifier'),
          syntax('"$$": "type<dsl>name"', 'profile structure reveals component identity'),
          methodology('Use tgpModel to explore all available components'),
          comparison('global function namespace', {
            advantage: 'DSL organization prevents naming conflicts and enables type safety'
          })
        ]
      })
    ]
  })
})

