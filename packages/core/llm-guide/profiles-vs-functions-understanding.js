import { dsls } from '@jb6/core'
import '@jb6/common'
import '@jb6/testing'
import '@jb6/llm-guide'

const { 
  tgp: { Const, var: { Var } }, 
  common: { data: { pipeline, filter, count, join, toUpperCase, mapValues }, Boolean: { and } },
  ui: { control: { button, text, group } },
  'llm-guide': { Doclet,
    doclet: { howTo, principle },
    guidance: { solution, doNot, bestPractice, mechanismUnderTheHood, illegalSyntax }, 
    explanationPoint: { whenToUse, performance, comparison, syntax, explanation, evidence, impact, methodology },
    problemStatement: { problem },
    validation: { multipleChoiceQuiz, predictResultQuiz, explainConceptQuiz }
  } 
} = dsls

// =============================================================================
// CRITICAL UNDERSTANDING: TGP PROFILES vs FUNCTIONS
// =============================================================================

Doclet('profilesVsFunctionsUnderstanding', {
  description: 'Critical foundational understanding that prevents catastrophic confusion about TGP nature',
  impl: howTo(
    problem({
      statement: 'Why calling TGP profiles "functions" creates catastrophic conceptual confusion for both humans and LLMs',
      intro: 'This distinction is absolutely fundamental. Getting this wrong makes everything else impossible to understand. TGP profiles are data structures with lexical scoping, NOT executable functions.'
    }),
    principle({
      importance: 'critical',
      rule: 'NEVER call TGP profiles "functions" - they are data structures with lexical scoping capabilities',
      rationale: 'Calling profiles "functions" destroys mental models, breaks debugging approaches, and prevents understanding of TGP\'s core value proposition',
      guidance: [
        solution({
          code: `// THIS IS A PROFILE (data structure with lexical scoping):
{
  "$$": "data<common>pipeline",
  "source": "%$people%",
  "operators": [
    {
      "$$": "data<common>filter", 
      "filter": "%age% < %$minAge%"    // ← Accesses minAge from outer scope
    },
    {
      "$$": "data<common>count"
    }
  ]
}

// THIS IS A FUNCTION (executable code):
function pipeline(source, ...operators) {
  return operators.reduce((data, op) => op(ctx.setData(data)), source())
}`,
          points: [
            explanation('Profiles are JSON-like data structures that describe what to execute'),
            explanation('Functions are executable code that actually performs operations'),
            syntax('"$$": "type<dsl>componentName"', 'profiles have TGP type identifiers, functions have executable statements'),
            comparison('immediate execution', { advantage: 'profiles enable deferred execution, inspection, and modification' }),
            evidence('Profile can be serialized to JSON, sent over network, stored in database - functions cannot')
          ]
        }),
        solution({
          code: `// $run() SEMANTICS VARY BY TGP TYPE:

// UI TGP Types: $run() → DOM instantiation (not execution)
const buttonElement = button('Save', saveAction()).$run(ctx)
// Result: DOM button element created and attached

// Action TGP Types: $run() → side effect execution  
const actionResult = log('message').$run(ctx)
// Result: message logged, side effect performed

// Data TGP Types: $run() → value calculation
const dataResult = pipeline('%$people%', count()).$run(ctx)
// Result: number 3 (actual computed result)

// Data TGP Types with dynamic: true → deferred function
Data('flexibleCount', {
  params: [{id: 'condition', dynamic: true}],
  impl: pipeline('%$people%', filter('%$condition()%'), count())
})
const deferredFunc = flexibleCount('%age% > 30').$run()  // Returns function
const actualResult = deferredFunc(ctx)                   // NOW it calculates`,
          points: [
            explanation('$run() semantics depend on TGP type - not all $run() calls execute'),
            explanation('Most TGP types use $run() for instantiation, only data TGP types actually calculate'),
            syntax('dynamic: true', 'makes data generic comps return deferred functions instead of immediate results'),
            evidence('UI generic comps create DOM elements, actions perform side effects, data calculates values'),
            comparison('traditional function calls', { advantage: 'different TGP types can have different execution semantics' })
          ]
        }),
        solution({
          code: `// REAL DYNAMIC PARAMETER EXAMPLES FROM COMMON DSL:

// join() with dynamic itemText parameter
join({
  separator: ' | ',
  itemText: toUpperCase('%name%')  // ← Becomes function when dynamic: true
})

// Implementation shows how dynamic params work:
Aggregator('join', {
  params: [
    {id: 'itemText', as: 'string', dynamic: true, defaultValue: '%%'}
  ],
  impl: (ctx, {}, {itemText}) => {
    const itemToText = ctx.jbCtx.args.itemText ? 
      item => itemText(ctx.setData(item)) :    // ← Function call with context!
      item => toString(item)
    return items.map(itemToText).join(separator)
  }
})

// filter() with dynamic condition
filter('%age% > 30')  // Becomes: item => filter(ctx.setData(item))

// mapValues() with dynamic mapper  
mapValues(toUpperCase('%%'))  // Becomes: value => map(ctx.setData(value))`,
          points: [
            explanation('Real common DSL examples show how dynamic parameters become functions'),
            explanation('Dynamic parameters are called with ctx.setData(item) to provide context'),
            syntax('dynamic: true', 'parameter becomes function that gets called at execution time'),
            syntax('itemText(ctx.setData(item))', 'standard pattern for calling dynamic parameters'),
            evidence('join, filter, mapValues all use this pattern in the actual common DSL code'),
            comparison('static parameters', { advantage: 'dynamic params enable context-dependent behavior' })
          ]
        }),
        mechanismUnderTheHood({
          snippet: `// How dynamic parameters enable deferred execution:

// Without dynamic: true - immediate resolution
Data('immediate', {
  params: [{id: 'value', type: 'data'}],  // dynamic: false (default)
  impl: (ctx, {}, {value}) => {
    console.log('Value:', value)  // e.g., 25 (resolved at instantiation)
  }
})

// With dynamic: true - deferred resolution  
Data('deferred', {
  params: [{id: 'value', type: 'data', dynamic: true}],  // dynamic: true
  impl: (ctx, {}, {value}) => {
    const actualValue = value(ctx)  // Call to get the value
    console.log('Value:', actualValue)  // e.g., 25 (resolved at execution)
  }
})

// Context timing matters:
const template = deferred('%$threshold%')  // Template with variable reference
const calculator = template.$run()         // Returns function (deferred)
const result1 = calculator({threshold: 10})  // threshold resolves to 10
const result2 = calculator({threshold: 50})  // threshold resolves to 50`,
          explain: 'dynamic parameters enable context-dependent behavior where same template adapts to different execution contexts'
        }),
        doNot('thinking profiles execute immediately like function calls', {
          reason: 'profiles are templates - $run() semantics vary by TGP type'
        }),
        doNot('expecting stack traces and breakpoints for profile debugging', {
          reason: 'profiles require data structure inspection and template analysis, not function debugging'
        }),
        doNot('assuming all $run() calls execute code', {
          reason: 'most $run() calls instantiate objects, only data TGP types actually calculates results'
        })
      ]
    }),
    solution({
      code: `// LEXICAL SCOPING IN TGP PROFILES:
// TGP profiles DO have lexical scoping through parameter binding

Data('userProcessor', {
  params: [
    {id: 'department', type: 'data'},
    {id: 'operation', type: 'data', dynamic: true}
  ],
  impl: pipeline(
    Var('targetDept', '%$department%'),         // Creates variable in scope
    '%$users%',
    filter('%department% == %$targetDept%'),    // Accesses scoped variable
    '%$operation()%'                            // Dynamic param has access to filtered users
  )
})

// Usage with scoped access:
userProcessor(
  '%$currentUser/department%',                  // Static parameter
  pipeline(                                     // Dynamic operation with scope access
    Var('userName', '%name%'),                  // Creates variable from current user
    log('Processing user: %$userName%'),        // Accesses variable from scope
    '%email%'                                   // Accesses property from pipeline data
  )
)`,
      points: [
        explanation('TGP profiles DO have lexical scoping through variable binding and parameter access'),
        explanation('Var() generic comp creates variables that inner generic comps can access'),
        syntax('Var() creates scope', 'variables flow down to nested generic comps'),
        syntax('%$variable%', 'resolves from local → parent → context → global scope'),
        syntax('%$param()%', 'calls dynamic parameter with current execution context'),
        performance('scope resolution happens at execution time with full context'),
        comparison('traditional function scoping', { advantage: 'profile scoping can be serialized and transmitted' })
      ]
    }),
    solution({
      code: `// WHY PROFILE vs FUNCTION DISTINCTION MATTERS:

// 1. SERIALIZATION CAPABILITY
const profileTemplate = button('Save', log('clicked'))
const json = JSON.stringify(profileTemplate)    // ✅ Works - profiles are data
// fetch('/api/execute', { body: json })         // ✅ Can send over network

// 2. INSPECTION CAPABILITY  
const pipelineTemplate = pipeline('%$data%', filter('%active%'), count())
console.log(pipelineTemplate.operators.length)          // ✅ Can inspect structure
console.log(pipelineTemplate.operators[0].filter)       // ✅ Can examine parameters

// 3. MODIFICATION CAPABILITY
const modifiedPipeline = { 
  ...pipelineTemplate, 
  caching: true,                                 // ✅ Can add metadata
  operators: [...pipelineTemplate.operators, log()]     // ✅ Can modify operations
}

// 4. DEFERRED EXECUTION with CONTEXT
const result1 = pipelineTemplate.$run({data: data1})   // ✅ Execute with context1  
const result2 = pipelineTemplate.$run({data: data2})   // ✅ Same template, different data`,
      points: [
        explanation('Profiles enable capabilities impossible with traditional functions'),
        evidence('Serialization enables distributed execution, storage, and transmission'),
        evidence('Inspection enables debugging, optimization, and analysis'),
        evidence('Modification enables template customization and dynamic behavior'),
        evidence('Context-based execution enables reusable templates with different data'),
        impact('These capabilities are the core value proposition of TGP')
      ]
    }),
    bestPractice({
      suboptimalCode: 'calling profiles "function calls" or "function composition"',
      better: 'calling them "profile assembly", "generic comp instantiation", or "template construction"',
      reason: 'correct terminology prevents mental model confusion and enables proper understanding'
    }),
    illegalSyntax('const result = pipeline(...); // expecting immediate result', {
      reason: 'profiles do not execute immediately - must call .$run() explicitly for data TGP types'
    }),
    validation: [
      multipleChoiceQuiz({
        question: 'What happens when you call $run() on different TGP types?',
        options: [
          'All TGP types execute code and return results',
          'UI creates DOM elements, actions perform side effects, data calculates values', 
          'All TGP types return functions for deferred execution',
          'Only data TGP types can use $run()'
        ],
        scrambledAnswer: '==gdhVGblxGIhx2bv9Gct92YgQXaklGbkBiI15WZ0NHIsAXYt92bM5WZ0FGdiAiZs9GbvxWbvNGI0VWZ5h2YgQHbhJXZQBSYkF2Z'
      }),
      predictResultQuiz({
        scenario: 'Data("test", {params: [{id: "val", dynamic: true}], impl: (ctx, {}, {val}) => val(ctx)}); const template = test(42); const result = template.$run();',
        context: 'What type of result do you get?',
        scrambledAnswer: '=c2dvNUTTRFIu9Wa0NWYgwyc0lmZl5WZiBSZhVGbgIXZ152YnBnbgUWZhFGUgQHdhRmYhx2bv9Gcz9WYgQ3YlJnc'
      }),
      explainConceptQuiz({
        prompt: 'Explain how dynamic: true parameters enable deferred context resolution',
        scrambledKeyPoints: '=c2dvlGdgQnb192YkByclhGdhJXYgUGd19mYgwibhVGbvJGIzVGb1JGIhlGblBSZlhGIkJ3byNHIuVXYgACIy92cxByKgMnbvlGdhJXZgU2YuVGZgIXZ152YnBnb',
        scrambledScoringCriteria: '=c2dvlGdgQnb192YkByclhGdhJXYgUGd19mYgwibhVGbvJGIzVGb1JGIhlGblBSe05WZu9Gct92YgI3bvlGdhJXZgQnb192YkByclhGdhJXZgIXZ152YnBnbgI3bwRGI5ZWayVmdgIXY5BnbgM3byJGI'
      })
    ]
  )
})

Doclet('dynamicParameterPatterns', {
  description: 'Understanding how dynamic: true parameters work with real examples from common DSL',
  impl: howTo(
    problem({
      statement: 'How dynamic parameters enable context-dependent behavior in TGP generic comps',
      intro: 'Dynamic parameters are a key TGP feature that enables deferred execution and context-dependent behavior. Understanding how they work is essential for advanced TGP usage.'
    }),
    solution({
      code: `// STATIC vs DYNAMIC PARAMETER COMPARISON:

// Static parameter - resolved at generic comp instantiation time
Data('staticExample', {
  params: [{id: 'threshold', type: 'data'}],  // dynamic: false (default)
  impl: (ctx, {}, {threshold}) => 
    ctx.data.filter(item => item.value > threshold)  // threshold is fixed value
})

// Dynamic parameter - resolved at execution time
Data('dynamicExample', {
  params: [{id: 'threshold', type: 'data', dynamic: true}],  // dynamic: true
  impl: (ctx, {}, {threshold}) => 
    ctx.data.filter(item => item.value > threshold(ctx))  // threshold is function
})

// Usage shows the difference:
const staticComp = staticExample(25)        // threshold = 25 (fixed)
const dynamicComp = dynamicExample('%$limit%')  // threshold = function that resolves %$limit%

// Execution with different contexts:
const result1 = staticComp.$run({data: items, limit: 50})   // uses 25 (ignores limit)
const result2 = dynamicComp.$run({data: items, limit: 50})  // uses 50 (from context)`,
      points: [
        explanation('Static parameters are resolved once at generic comp instantiation'),
        explanation('Dynamic parameters become functions that resolve at execution time'),
        syntax('dynamic: true', 'converts parameter into a function that accepts execution context'),
        syntax('threshold(ctx)', 'calling dynamic parameter with execution context'),
        comparison('static parameters', { advantage: 'dynamic params adapt to different execution contexts' }),
        performance('same dynamic generic comp template can be reused with different runtime contexts')
      ]
    }),
    solution({
      code: `// REAL COMMON DSL PATTERNS:

// Pattern 1: Dynamic transformation in join()
join({
  separator: ' | ',
  itemText: pipeline('%name%', toUpperCase())  // Dynamic: transforms each item
})

// Pattern 2: Dynamic condition in filter()  
filter(and('%active%', '%department% == "Engineering"'))  // Dynamic: evaluates per item

// Pattern 3: Dynamic mapper in mapValues()
mapValues(pipeline('%$baseValue%', plus(10)))  // Dynamic: transforms each value

// Pattern 4: Dynamic aggregation in Switch()
Switch([
  Case(equals('%status%', 'draft'), '%title%'),      // Dynamic condition & value
  Case(equals('%status%', 'published'), '%slug%')    // Dynamic condition & value  
], defaultValue('%id%'))  // Dynamic default

// All these work because the dynamic parameters get called with appropriate context`,
      points: [
        explanation('Common DSL uses dynamic parameters extensively for flexible behavior'),
        evidence('join, filter, mapValues, Switch all demonstrate dynamic parameter patterns'),
        syntax('dynamic conditions', 'boolean expressions evaluated per data item'),
        syntax('dynamic transformations', 'data operations applied per item with context'),
        methodology('dynamic parameters enable generic comps that adapt to specific use cases'),
        performance('single generic comp definition supports multiple behavioral variations')
      ]
    }),
    mechanismUnderTheHood({
      snippet: `// How dynamic parameters work internally:

// 1. PARAMETER DEFINITION
{id: 'transform', dynamic: true}

// 2. ARGUMENT RESOLUTION  
// Static: transform = resolvedValue
// Dynamic: transform = function(ctx) => resolvedValue

// 3. GENERIC COMP INSTANTIATION
const comp = myComponent('%$data%', someTransform())
// Static param: someTransform() executed now, result stored
// Dynamic param: someTransform profile stored as function

// 4. EXECUTION TIME
comp.$run(executionContext)
// Static param: use stored result  
// Dynamic param: call function with executionContext

// 5. CONTEXT RESOLUTION
transform(ctx.setData(currentItem))
// Dynamic param called with specific data context`,
      explain: 'dynamic parameters enable late binding where parameter resolution is deferred until execution with specific context'
    }),
    bestPractice({
      suboptimalCode: 'using static parameters when behavior should vary by context',
      better: 'using dynamic parameters for context-dependent behavior',
      reason: 'dynamic parameters enable reusable generic comps that adapt to different execution scenarios'
    })
  )
})

Doclet('profileReadingLiteracy', {
  description: 'Essential skill for understanding TGP: reading and interpreting profile structures',
  impl: howTo(
    problem({
      statement: 'How to read TGP profiles to understand what they actually do',
      intro: 'Profile reading is the foundational skill for TGP literacy. You must understand profile structure before learning to create better generic comps.'
    }),
    solution({
      code: `// READING A BASIC PROFILE:
{
  "$$": "data<common>pipeline",           // ← TGP type identifier: type<dsl>genericCompName
  "source": "%$people%",                  // ← Parameter: data source (runtime variable)
  "operators": [                          // ← Parameter: array of operations
    {
      "$$": "data<common>filter",         // ← Nested generic comp
      "filter": "%age% < 30"              // ← Nested parameter (runtime expression)
    },
    {
      "$$": "data<common>count"           // ← Nested generic comp (no parameters)
    }
  ]
}

// READING CHECKLIST:
// 1. What TGP type? data<common>pipeline
// 2. What are the parameters? source + operators  
// 3. What do nested generic comps do? filter then count
// 4. What variables are used? %$people%, %age%
// 5. What's the data flow? people → filter by age → count`,
      points: [
        explanation('Every profile has $$ property identifying the TGP type and DSL'),
        syntax('"$$": "type<dsl>genericCompName"', 'unique TGP type identifier format'),
        syntax('parameters as object properties', 'each parameter becomes a property in the profile'),
        syntax('nested profiles in arrays or properties', 'generic comps can contain other generic comps'),
        methodology('systematic reading: TGP type → parameters → nested generic comps → data flow'),
        whenToUse('debugging TGP generic comps, understanding existing code, learning patterns')
      ]
    }),
    bestPractice({
      suboptimalCode: 'trying to debug TGP by setting breakpoints in generic comp implementations',
      better: 'inspecting profile structures and tracing data flow through parameters',
      reason: 'TGP debugging requires understanding the template structure, not the execution code'
    })
  )
})