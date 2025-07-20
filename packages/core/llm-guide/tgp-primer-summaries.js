import { dsls } from '@jb6/core'
import '@jb6/common'
import '@jb6/testing'
import '@jb6/llm-guide'

const { 
  tgp: { Const, var: { Var } }, 
  common: { data: { pipeline, filter, count, join, toUpperCase }, Boolean: { and } },
  ui: { control: { button, text, group } },
  'llm-guide': { Doclet,
    doclet: { howTo },
    guidance: { solution, doNot, bestPractice, mechanismUnderTheHood }, 
    explanationPoint: { whenToUse, performance, comparison, syntax, explanation },
    problemStatement: {problem}
  } 
} = dsls

// =============================================================================
// TGP PRIMER SUMMARIES - Progressive token reduction (÷2, ÷4, ÷8, ÷16, ÷32)
// Each summary is self-contained and coherent at its token level
// =============================================================================

Doclet('primerSummaryA1', {
  description: 'TGP Primer Summary - ~2100 tokens (÷2) - Complete mastery guide',
  impl: howTo(
    problem('Mastering TGP: Complete system for building production component-based applications'),
    
    solution({
      code: `// === CORE PRINCIPLE ===
// TGP profiles are data structures with lexical scoping, NOT executable functions.
// Component calls create profiles (templates) that can be serialized, inspected, modified.

button('Save', runActions([log('saving'), saveDoc('%$doc/id%')]))
// Creates: {"$$": "control<ui>button", "title": "Save", "action": {"$$": "action<common>runActions", ...}}

// === DSL ORGANIZATION ===
// Domain-specific names eliminate namespace collisions and organize by purpose:
dsls.common.data.*        // pipeline(), filter(), count(), toUpperCase()
dsls.common.boolean.*     // and(), or(), not(), startsWith()  
dsls.action.common.*      // log(), runActions(), save(), showMessage()
dsls.ui.control.*         // button(), text(), group(), html()

// === $run() SEMANTICS VARY BY TGP TYPE ===
// UI creates DOM elements:    button(...).$run(ctx) → DOM button
// Actions perform side effects: log(...).$run(ctx) → message logged  
// Data calculates values:     pipeline(...).$run(ctx) → computed result`,
      points: [
        explanation('Profiles enable serialization, inspection, and modification - impossible with functions'),
        explanation('DSL names define domain boundaries and clearly indicate purpose'),
        explanation('$run() semantics vary by TGP type - not all execute code')
      ]
    }),

    solution({
      code: `// === COMPONENT INSTANTIATION & TYPE SAFETY ===
// Function-like syntax creates profiles with type<dsl> identifiers:
pipeline('%$people%', filter('%age% < 30'), count())
button('Save', runActions([log('click'), save('%$doc%')]))

// Type system prevents invalid combinations:
button('Save', runActions([...]))     // ✅ action<common> → action param
button('Save', pipeline(...))         // ❌ data<common> → action param

// === VARIABLES vs ARGUMENTS ===
'%$people%'        // Runtime variable - data flows at execution
'Save'             // Instantiation arg - structure built at compile time
filter('%age% < 30')  // Nested profile with runtime expression

// === COMPONENT DEFINITIONS ===
const Data = TgpType('data', 'common')
Data('activeUsers', {
  params: [{id: 'department', type: 'data'}],
  impl: pipeline('%$users%', filter('%department% == %$department%'), count())
})

// === DYNAMIC PARAMETERS ===
// Dynamic parameters enable deferred execution where same template adapts to different contexts
Data('flexibleFilter', {
  params: [{id: 'condition', dynamic: true}],  // Becomes function
  impl: pipeline('%$data%', filter('%$condition()%'))  // Called at execution
})

const template = flexibleFilter('%active%')     // Template with variable
const result1 = template.$run({data: users, active: true})   // Uses true
const result2 = template.$run({data: items, active: false})  // Uses false`,
      points: [
        explanation('Type system prevents runtime errors by catching invalid combinations at design time'),
        explanation('Variables provide dynamic runtime behavior, arguments provide static structure'),
        explanation('Dynamic parameters enable context-dependent behavior where same template adapts to different execution contexts'),
        explanation('CompDef creates reusable component factories from TgpTypes')
      ]
    }),

    solution({
      code: `// === ADVANCED COMPOSITION & REAL PATTERNS ===

// Cross-DSL nesting creates sophisticated behavior:
group([
  text('Document: %$doc/title% (%$doc/status%)'),
  button('Save', runActions([
    log('Saving %$doc/id%'),
    saveDoc('%$doc/id%'),
    showMessage('Saved!')
  ])),
  pipeline('%$docs%', 
    filter(and('%status% == "published"', '%department% == %$user/dept%')),
    count()
  )
])

// === TEMPLATING & INSTANTIATION ===
// Templates separate structure from execution:
const docEditor = group([text('%$doc/title%'), button('Save', save('%$doc/id%'))])

// Multiple instantiation patterns:
docEditor.$run({doc: {id: 'doc1', title: 'My Doc'}})           // Direct
new Ctx().setVars({doc: myDoc}).run(docEditor)                 // With context

// === FORWARD REFERENCES ===
const myFeature = ActivityDetection.forward('myFeature')
{id: 'activityDetection', defaultValue: myFeature()}           // Use before definition

// === FROM CONCRETE TO ABSTRACT PRINCIPLES ===
// What concrete examples reveal about TGP:
// 1. Components are OF TYPE a specific type<dsl>
toUpperCase()  // is OF TYPE data<common>
button()       // is OF TYPE control<ui>

// 2. Type compatibility enables safe composition across domains
button(toUpperCase('save'), runActions([...]))  // data→ui, action→ui ✅

// 3. Profile paradigm enables serialization, inspection, modification
const template = pipeline('%$data%', count())
JSON.stringify(template)                        // ✅ Serializable
template.operators.push(log())                  // ✅ Modifiable
template.$run(ctx1), template.$run(ctx2)        // ✅ Reusable

// This is why you can build complex applications from simple, reusable components!`,
      points: [
        explanation('Real applications combine UI structure, data processing, and user workflows'),
        explanation('Templates can be instantiated multiple times with different contexts'),
        explanation('Forward references solve component ordering in default values'),
        explanation('TGP enables: domain organization, type safety, serializable components, cross-domain composition'),
        explanation('Profile paradigm provides foundation for building complex systems from simple parts')
      ]
    }),

    mechanismUnderTheHood({
      snippet: `// TGP SYSTEM ARCHITECTURE:
// 1. TgpType('type', 'dsl') → creates type factory
// 2. TypeFactory('componentName', {params, impl}) → creates component factory (CompDef)  
// 3. componentName(...args) → creates component instance (profile)
// 4. profile.$run(context) → instantiation varies by TGP type

// KEY DISTINCTIONS:
// - Profiles vs Functions: data structures with lexical scoping vs executable code
// - Template vs Execution: profile creation vs runtime instantiation  
// - Static vs Dynamic params: compile-time values vs deferred execution functions
// - Cross-DSL composition: type<dsl> enables safe composition across domains

// This enables: serialization, inspection, modification, context-aware reuse`,
      explain: 'TGP architecture separates concerns enabling powerful, flexible component composition'
    })
  )
})

Doclet('primerSummaryA2', {
  description: 'TGP Primer Summary - ~1050 tokens (÷4) - Comprehensive practical guide',
  impl: howTo(
    problem('Complete TGP system for building production applications'),
    
    solution({
      code: `// Core principle: TGP profiles are data structures with lexical scoping, NOT functions
// Component calls create serializable profiles that can be inspected, modified, reused

const buttonProfile = button('Save', log('clicked'))
// Creates: {"$$": "control<ui>button", "title": "Save", "action": {"$$": "action<common>log"}}

// DSL organization prevents naming conflicts, enables domain optimization:
dsls.common.data.*     // pipeline(), filter(), count(), toUpperCase()
dsls.common.boolean.*  // and(), or(), not(), startsWith()
dsls.action.common.*   // log(), runActions(), save(), showMessage()
dsls.ui.control.*      // button(), text(), group(), html()

// $run() semantics vary by TGP type (not all execute code):
button(...).$run(ctx)     // UI: creates DOM element
log(...).$run(ctx)        // Action: performs side effect
pipeline(...).$run(ctx)   // Data: calculates value

// Example data processing:
pipeline('%$people%', filter('%age% < 30'), '%name%', toUpperCase(), join(', '))

// Example UI composition with cross-DSL integration:
group([
  text('Active Users'),
  button('Refresh', runActions([loadUsers(), showMessage('Updated!')])),
  button('Export', saveToFile('%$userList%'))
])`,
      points: [
        explanation('Profiles enable serialization, inspection, modification - impossible with functions'),
        explanation('DSL organization prevents conflicts while enabling domain-specific optimization'),
        explanation('$run() semantics vary by type: UI creates DOM, actions perform side effects, data calculates'),
        explanation('Cross-DSL composition allows rich applications spanning multiple domains')
      ]
    }),

    solution({
      code: `// Type safety prevents invalid combinations, enables safe composition:
button('Save', runActions([log('save'), save('%$doc%')]))     // ✅ action→action
pipeline('%$data%', filter('%active%'), count())             // ✅ boolean→filter
button('Save', pipeline('%$data%', count()))                 // ❌ data→action (prevented)

// Variables vs arguments - runtime data flow vs compile-time structure:
'%$people%'           // Runtime variable - resolves at execution
'%$doc/title%'        // Property access at runtime
'Save Document'       // Instantiation arg - fills parameter at creation
count()              // Component instance - fills operator parameter

// CompDef creates reusable component factories:
const Data = TgpType('data', 'common')                       // Type factory
Data('activeUsers', {                                        // Component factory
  impl: pipeline('%$users%', filter('%active%'), count())
})
activeUsers()  // Component instance

// Dynamic parameters enable context-dependent behavior:
Data('flexibleFilter', {
  params: [{id: 'condition', dynamic: true}],                // Becomes function
  impl: pipeline('%$data%', filter('%$condition()%'))        // Called at execution
})

const template = flexibleFilter('%active%')                  // Template with variable
template.$run({data: users, active: true})                   // Context 1
template.$run({data: items, active: false})                  // Context 2`,
      points: [
        explanation('Type system prevents runtime errors by catching invalid combinations at design time'),
        explanation('Variables provide dynamic behavior, arguments provide static structure'),
        explanation('CompDef progression: TgpType → Component factory → Instance profile'),
        explanation('Dynamic parameters enable same template to adapt to different execution contexts')
      ]
    }),

    solution({
      code: `// Advanced composition patterns:
group([
  text('Document: %$doc/title% (%$doc/status%)'),
  button('Save', runActions([
    validate('%$document%'),
    saveDoc('%$document/id%'),
    log('Saved by %$user/name%')
  ])),
  pipeline('%$documents%', 
    filter(and('%status% == "published"', '%dept% == %$user/dept%')),
    count()
  )
])

// Templating patterns - profiles separate structure from execution:
const docEditor = group([text('%$doc/title%'), button('Save', save('%$doc/id%'))])

// Multiple instantiation methods:
docEditor.$run({doc: {id: 'doc1', title: 'My Doc'}})        // Direct
new Ctx().setVars({doc: myDoc}).run(docEditor)               // With context

// Forward references solve component ordering:
const myFeature = ActivityDetection.forward('myFeature')    // Use before definition
{id: 'detection', defaultValue: myFeature()}

// Profile capabilities enable powerful patterns:
JSON.stringify(docEditor)                                   // ✅ Serializable
docEditor.controls.push(button('Delete', deleteDoc()))      // ✅ Modifiable
docEditor.$run(ctx1), docEditor.$run(ctx2)                  // ✅ Reusable with different contexts`,
      points: [
        explanation('Advanced nesting enables sophisticated logic while maintaining readability'),
        explanation('Templates can be instantiated multiple times with different runtime contexts'),
        explanation('Forward references solve component ordering in complex applications'),
        explanation('Profile capabilities (serialization, inspection, modification) enable powerful architectural patterns')
      ]
    })
  )
})

Doclet('primerSummaryA3', {
  description: 'TGP Primer Summary - ~525 tokens (÷8) - Practical usage patterns',
  impl: howTo(
    problem('How to effectively use TGP for building applications'),
    solution({
      code: `// Profiles are data structures with lexical scoping, NOT functions
pipeline('%$people%', count()) → {"$$": "data<common>pipeline", "source": "%$people%", ...}

// DSL organization:
dsls.common.data.*     // pipeline(), filter(), count(), toUpperCase()
dsls.ui.control.*      // button(), text(), group()
dsls.action.common.*   // log(), runActions(), save()

// $run() semantics vary:
button(...).$run(ctx)     // UI: creates DOM element
log(...).$run(ctx)        // Action: performs side effect  
pipeline(...).$run(ctx)   // Data: calculates result

// Type-safe cross-DSL composition:
button(toUpperCase('save'), runActions([log('click'), save('%$doc%')]))

// Component nesting:
group([
  text('Users: %$userCount%'),                    
  button('Refresh', runActions([loadUsers(), setVar('userCount', '%$users/length%')])),
  pipeline('%$users%', filter('%active%'), count())
])

// CompDef creates reusable components:
const Data = TgpType('data', 'common')           // Type factory
Data('activeUsers', {impl: pipeline('%$users%', filter('%active%'), count())})
activeUsers()  // Component instance`,
      points: [
        explanation('Profiles are data structures with lexical scoping, NOT executable functions'),
        explanation('$run() varies: UI creates DOM, actions perform effects, data calculates'),
        explanation('Type system enables safe composition across domains'),
        explanation('CompDef progression: TgpType → Component factory → Instance')
      ]
    }),
    solution({
      code: `// Dynamic parameters enable context-dependent behavior:
Data('flexibleFilter', {
  params: [{id: 'condition', dynamic: true}],     // Becomes function
  impl: pipeline('%$data%', filter('%$condition()%'))
})

flex('%active%').$run({data: users, active: true})    // Context 1
flex('%active%').$run({data: items, active: false})   // Context 2

// Profile capabilities:
const docEditor = group([text('%$doc/title%'), button('Save', save('%$doc/id%'))])
JSON.stringify(docEditor)                        // ✅ Serializable
docEditor.controls.push(button('Delete', deleteDoc('%$doc/id%')))  // ✅ Modifiable
docEditor.$run({doc: doc1}), docEditor.$run({doc: doc2})          // ✅ Reusable`,
      points: [
        explanation('Dynamic parameters enable templates that adapt to different execution contexts'),
        explanation('Profiles enable serialization, inspection, modification - impossible with functions'),
        explanation('Templates can be instantiated multiple times with different contexts')
      ]
    })
  )
})

Doclet('primerSummaryA4', {
  description: 'TGP Primer Summary - ~262 tokens (÷16) - Core concepts with examples',
  impl: howTo(
    problem('Understanding TGP component system fundamentals'),
    solution({
      code: `// DSL domains organize components:
dsls.common.data.*     // pipeline(), filter(), count(), toUpperCase()
dsls.ui.control.*      // button(), text(), group()  
dsls.action.common.*   // log(), runActions(), save()

// Component calls create profiles with type<dsl> identifiers:
button('Save', log('clicked')) → {"$": "control<ui>button", "title": "Save", "action": {...}}

// $run() semantics vary by TGP type:
button(...).$run(ctx)    // → DOM element
log(...).$run(ctx)       // → side effect
pipeline(...).$run(ctx)  // → calculated value

// Type safety:
button('Save', runActions([...]))  // ✅ action<common> → action param
'%$people%'        // Runtime variable
'Save'             // Instantiation arg

// Dynamic parameters enable context-dependent behavior:
Data('flex', {params: [{id: 'condition', dynamic: true}]})
flex('%active%').$run({active: true})  // Variable resolves at execution`,
      points: [
        p('DSLs organize by domain, type<dsl> enables safe composition'),
        p('$run() varies: UI creates DOM, actions perform effects, data calculates'),
        p('Variables provide runtime data, args provide structure'),
        p('Dynamic parameters enable templates that adapt to different contexts')
      ]
    }),
    solution({
      code: `// Actual pipeline CompDef from the source code:
Data('pipeline', {
  description: 'flat map data arrays one after the other, does not wait for promises and rx',
  params: [
    {id: 'source', type: 'data', dynamic: true, mandatory: true, composite: true },
    {id: 'operators', type: 'data[]', dynamic: true, mandatory: true, secondParamAsArray: true}
  ],
  impl: (ctx, { operators, source } ) => asArray(operators.profile).reduce( (dataArray, profile ,index) => runAsAggregator(ctx, operators, index,dataArray,profile), source())
})

// Usage:
pipeline('%$people%', filter('%age% < 30'), count())  // source + operators`,
      points: [
        p('CompDef shows actual parameter structure: type, dynamic, mandatory, composite'),
        p('secondParamAsArray: all args after first become operators array')
      ]
    })
  )
})

Doclet('primerSummaryA5', {
    description: 'TGP Primer Summary - ~131 tokens (÷32) - Complete minimal introduction',
    impl: howTo(
      problem('What is TGP and how do I use it?'),
      solution({
        code: `// Component instantiation creates profiles, NOT immediate execution
  button('Save', log('saved'))    // → {"$": "control<ui>button", "title": "Save", "action": {...}}
  pipeline('%$people%', count())  // → {"$": "data<common>pipeline", "source": "%$people%", ...}`,
        points: [
          p('Component instantiation creates profiles, NOT immediate execution'),
          p('Execute profiles with: profile.$run(context)'),
          p('DSLs organize by domain: ui (control/feature), common (data/action/boolean)'),
          p('Type safety: compatible tgp-types compose, incompatible ones error'),
          p('DSL interoperability: ui components can contain common actions/data')
        ]
      }),
      solution({
        code: ` // extend the DSL - define a generic component
  Data('pipeline', {
    params: [
      {id: 'source', type: 'data', dynamic: true, mandatory: true },
      {id: 'operators', type: 'data[]', dynamic: true, mandatory: true, secondParamAsArray: true}
    ],
    impl: (ctx, {source, operators}) => { /* js code */ }
  })`,
        points: p('secondParamAsArray: all args after first become operators array')
      }),
      solution({
        code: `
  Control('button', {
    params: [
      {id: 'title', as: 'string' },
      {id: 'action', type: 'action<common>' },
    ]
  })`,
        points: p('action is a Cross-DSL param')
      })
    )
})
