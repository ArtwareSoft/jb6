import { dsls } from '@jb6/core'
import '@jb6/common'
import '@jb6/llm-guide'

const { 
  tgp: { Const }, 
  common: { data: { pipeline, filter, count, join }, Boolean: { and } },
  doclet: { Doclet,
    doclet: { exercise },
    guidance: { solution, doNot, bestPractice, mechanismUnderTheHood }, 
    explanationPoint: { whenToUse, performance, comparison, syntax, explanation },
    problemStatement: { problem }
  } 
} = dsls

// Sample data for examples
Const('people', [{name: 'Homer', age: 42}, {name: 'Bart', age: 12}, {name: 'Lisa', age: 10}])

Doclet('templating', {
  impl: exercise(
    problem('Understanding templating - creating profiles with parameters instead of function calls'),
    solution({
      code: `// Templating: Component call creates profile template
pipeline('%$people%', filter('%age% < 30'), count())

// Creates profile template with parameters:
{
  "$$": "data<common>pipeline",
  "source": "%$people%",
  "operators": [
    {"$$": "data<common>filter", "filter": "%age% < 30"},
    {"$$": "data<common>count"}
  ]
}`,
      points: [
        explanation('Templating creates profile structures with parameter slots'),
        syntax('component calls', 'function-like syntax generates templates, not executes functions'),
        whenToUse('when building component structures for later execution'),
        performance('templates are data structures that can be stored, modified, and executed')
      ]
    }),
    solution({
      code: `// Template with parameters vs execution
const template = pipeline('%$people%', count())  // Creates template
const result = template.$run()                   // Executes template

// NOT function execution:
// pipeline() does NOT immediately run - it creates a template!`,
      points: [
        explanation('Component calls create templates, $run() executes them'),
        syntax('template vs execution', 'clear separation between template creation and execution'),
        whenToUse('when you need to create reusable templates'),
        comparison('traditional functions', { advantage: 'templates can be inspected, modified, and reused' })
      ]
    }),
    solution({
      code: `// Parameter templating with placeholders
filter('%age% < 30')  // Template with parameter placeholder

// Becomes:
{
  "$$": "data<common>filter", 
  "filter": "%age% < 30"      // Parameter slot for runtime resolution
}`,
      points: [
        explanation('Parameters become template slots filled at execution time'),
        syntax('parameter placeholders', '%age% becomes slot in template structure'),
        whenToUse('when creating templates that work with different data contexts'),
        performance('parameter resolution happens at execution, not template creation')
      ]
    }),
    mechanismUnderTheHood({
      snippet: `// Templating vs Function Call paradigm:

// Traditional Function Call:
function pipeline(source, ...operators) {
  // Immediate execution
  return operators.reduce((data, op) => op(data), source)
}

// TGP Templating:
function pipeline(source, ...operators) {
  // Template creation
  return {
    $$: "data<common>pipeline",
    source: source,
    operators: operators
  }
}

// Execution happens separately:
template.$run(ctx) // → actual execution with context`,
      explain: 'templating separates template creation from execution, enabling inspection and modification'
    })
  )
})

Doclet('tgpBasics', {
  impl: exercise(
    problem('Understanding Type-Generic Profiles (TGP) - the component system in jb6'),
    solution({
      code: `// TGP components are profiles (JSON-like structures) not function calls
{
  "$$": "data<common>pipeline",
  "source": "%$people%",
  "operators": [
    {"$$": "data<common>filter", "filter": "%age% < 30"},
    {"$$": "data<common>count"}
  ]
}`,
      points: [
        explanation('TGP components are profiles (data structures) with $$ indicating component type'),
        syntax('$$', 'component identifier in format "type<dsl>componentName"'),
        whenToUse('when building reusable data processing components'),
        performance('profiles are serializable and can be stored/transmitted')
      ]
    }),
    solution({
      code: `// Shorthand syntax using function-like calls
pipeline('%$people%', filter('%age% < 30'), count())`,
      points: [
        explanation('Function-like syntax is syntactic sugar that creates profiles'),
        syntax('function call syntax', 'transpiled to profile structure with $$ property'),
        whenToUse('when writing components inline for readability'),
        comparison('profile syntax', { advantage: 'more readable and familiar to developers' })
      ]
    }),
    mechanismUnderTheHood({
      snippet: `// Function call transpilation:
pipeline('%$people%', filter('%age% < 30'), count())

// Becomes this profile:
{
  "$$": "data<common>pipeline",
  "source": "%$people%",
  "operators": [
    {"$$": "data<common>filter", "filter": "%age% < 30"},
    {"$$": "data<common>count"}
  ]
}`,
      explain: 'TGP function syntax is compiled to profile structures for execution'
    })
  )
})

Doclet('globalProfiles', {
  impl: exercise(
    problem('Understanding global profiles - reusable component definitions stored in the system'),
    solution({
      code: `// Global profile definition using DSL functions
Data('peopleUnder30', {
  impl: pipeline('%$people%', filter('%age% < 30'), count())
})

// Usage in other components via variable reference
'%$peopleUnder30%'  // resolves to the stored component result`,
      points: [
        explanation('Global profiles are reusable components stored in the global registry'),
        syntax('Data(), Test()', 'DSL functions that register global profiles'),
        whenToUse('when creating reusable components that can be referenced by name'),
        performance('global profiles enable component reuse and modular architecture')
      ]
    }),
    mechanismUnderTheHood({
      snippet: `// Global profile registration:
Data('peopleUnder30', {
  impl: pipeline('%$people%', filter('%age% < 30'), count())
})

// Creates jbCompProxy in global registry:
dsls.common.data.peopleUnder30 = jbCompProxy(jbComp)

// Proxy behavior:
// - Function call: peopleUnder30(...args) -> calcArgs(jbComp, args) 
// - $run method: peopleUnder30.$run() -> jbComp.runProfile(...)
// - asJbComp access: peopleUnder30[asJbComp] -> returns the actual jbComp JSON

// Variable reference execution:
'%$peopleUnder30%' // calls proxy.$run() -> executes component -> returns result`,
      explain: 'global profiles create jbCompProxy objects that handle function calls and provide $run execution'
    })
  )
})

Doclet('innerProfiles', {
  impl: exercise(
    problem('Understanding inner profiles - nested component structures within other components'),
    solution({
      code: `// Inner profiles as direct component nesting
pipeline(
  '%$people%',
  filter('%age% < 30'),    // Inner profile
  count()                  // Inner profile
)`,
      points: [
        explanation('Inner profiles are nested components within other components'),
        syntax('direct nesting', 'components can contain other components as parameters'),
        whenToUse('when building complex operations from simpler components'),
        performance('inner profiles are compiled inline, no global lookup needed')
      ]
    }),
    mechanismUnderTheHood({
      snippet: `// Inner profile compilation:
filter(and('%age% < 30', '%name% == "Bart"'))

// Becomes nested profile structure:
{
  "$$": "data<common>filter",
  "filter": {
    "$$": "boolean<common>and", 
    "items": ["%age% < 30", "%name% == \\"Bart\\""]
  }
}`,
      explain: 'inner profiles create nested component hierarchies in the profile structure'
    })
  )
})

Doclet('argsPosition', {
  impl: exercise(
    problem('Understanding positional arguments - how component parameters are mapped by position'),
    solution({
      code: `// Positional arguments in order
pipeline('%$people%', filter('%age% < 30'), count())
//       ^source      ^operator1          ^operator2`,
      points: [
        explanation('Arguments map to component parameters by position'),
        syntax('positional mapping', 'first arg to first param, second to second, etc.'),
        whenToUse('when component has clear parameter order'),
        performance('most efficient argument mapping method')
      ]
    }),
    doNot('pipeline(filter("%age% < 30"), "%$people%", count())', {
      reason: 'wrong parameter order - source must be first, operators follow'
    }),
    mechanismUnderTheHood({
      snippet: `// Parameter mapping by position:
pipeline('%$people%', filter('%age% < 30'), count())

// Maps to parameter definitions:
{
  "$$": "data<common>pipeline",
  "source": "%$people%",           // position 0 -> 'source' param
  "operators": [                   // position 1+ -> 'operators' param array
    {"$$": "data<common>filter", "filter": "%age% < 30"},
    {"$$": "data<common>count"}
  ]
}`,
      explain: 'positional arguments are mapped to named parameters according to component definition'
    })
  )
})

Doclet('argsByValue', {
  impl: exercise(
    problem('Understanding named arguments - explicit parameter specification using object syntax'),
    solution({
      code: `// Named arguments using object notation
pipeline({
  source: '%$people%',
  operators: [
    filter('%age% < 30'),
    count()
  ]
})`,
      points: [
        explanation('Named arguments use object syntax with explicit parameter names'),
        syntax('object notation', 'parameter names as object keys'),
        whenToUse('when parameter order is unclear or for complex components'),
        comparison('positional args', { advantage: 'self-documenting and order-independent' })
      ]
    }),
    mechanismUnderTheHood({
      snippet: `// Named argument compilation:
pipeline({
  source: '%$people%',
  operators: [filter('%age% < 30'), count()]
})

// Creates same profile as positional version:
{
  "$$": "data<common>pipeline", 
  "source": "%$people%",
  "operators": [
    {"$$": "data<common>filter", "filter": "%age% < 30"},
    {"$$": "data<common>count"}
  ]
}`,
      explain: 'named arguments provide alternative syntax but create identical profile structures'
    })
  )
})
