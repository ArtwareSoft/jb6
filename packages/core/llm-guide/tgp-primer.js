import { dsls } from '@jb6/core'
import '@jb6/common'
import '@jb6/testing'
import '../../llm-guide/llm-guide-dsl.js'

const { 
  tgp: { Const, var: { Var } }, 
  common: { data: { pipeline, filter, count, join, toUpperCase }, Boolean: { and } },
  ui: { control: { button, text, group } },
  doclet: { Doclet,
    doclet: { exercise },
    guidance: { solution, doNot, bestPractice, mechanismUnderTheHood, illegalSyntax }, 
    explanationPoint: { whenToUse, performance, comparison, syntax, explanation },
    problemStatement: {problem}
  } 
} = dsls

// Sample data for examples
Const('people', [{name: 'Homer', age: 42}, {name: 'Bart', age: 12}, {name: 'Lisa', age: 10}])

Doclet('workingWithCommonDSL', {
  impl: exercise(
    problem('Working with the common DSL - data processing components you can run right now'),
    solution({
      code: `// Common DSL provides data processing components
// Let's see some real working examples:

// 1. Simple data transformation:
toUpperCase('hello world')                    // → 'HELLO WORLD'

// 2. Pipeline with multiple operations:
pipeline('%$people%', '%name%', toUpperCase()) // → ['HOMER', 'BART', 'LISA']

// 3. Filtering with conditions:
pipeline('%$people%', filter('%age% < 30'), '%name%') // → ['Bart', 'Lisa']`,
      points: [
        explanation('Common DSL contains ready-to-use components for data processing'),
        syntax('toUpperCase()', 'component that transforms strings'),
        syntax('pipeline()', 'component that chains operations'),
        syntax('filter()', 'component that selects items based on conditions'),
        whenToUse('when you need to process, transform, or filter data')
      ]
    }),
    solution({
      code: `// These components live in the common DSL namespace:
dsls.common.data.toUpperCase     // String transformation component
dsls.common.data.pipeline        // Data flow orchestration component
dsls.common.data.filter          // Array filtering component  
dsls.common.data.count           // Array counting component
dsls.common.boolean.and          // Logical operations component`,
      points: [
        explanation('Components are organized by type within the common DSL'),
        syntax('dsls.common.data.*', 'data processing and transformation components'),
        syntax('dsls.common.boolean.*', 'boolean/condition components'),
        whenToUse('understanding how components are organized in DSL namespaces'),
        performance('components are globally registered and reusable across projects')
      ]
    })
  )
})

Doclet('workingWithUIDSL', {
  impl: exercise(
    problem('Working with the ui DSL - user interface components you can compose'),
    solution({
      code: `// UI DSL provides user interface components
// Let's see real UI building blocks:

// 1. Simple button:
button('Click me', log('button clicked'))

// 2. Text display:
text('Hello World')

// 3. Group of controls:
group([
  text('Name: Homer Simpson'),
  button('Edit', log('edit clicked')),
  button('Delete', log('delete clicked'))
])`,
      points: [
        explanation('UI DSL contains ready-to-use components for building interfaces'),
        syntax('button(title, action)', 'interactive button component'),
        syntax('text(content)', 'text display component'),
        syntax('group([controls...])', 'container component for organizing other controls'),
        whenToUse('when building user interfaces and interactive applications')
      ]
    }),
    solution({
      code: `// UI components live in the ui DSL namespace:
dsls.ui.control.button           // Interactive button component
dsls.ui.control.text             // Text display component
dsls.ui.control.group            // Container component
dsls.ui.control.html             // HTML content component
dsls.ui.feature.id               // Component features`,
      points: [
        explanation('UI components are organized by type within the ui DSL'),
        syntax('dsls.ui.control.*', 'visual control components'),
        syntax('dsls.ui.feature.*', 'component enhancement features'),
        whenToUse('understanding how UI components are organized in DSL namespaces'),
        comparison('common DSL', { advantage: 'specialized for UI vs general data processing' })
      ]
    })
  )
})

Doclet('understandingDSLs', {
  impl: exercise(
    problem('What are DSLs? Domain-Specific Languages that organize components by purpose'),
    solution({
      code: `// DSLs are namespaces that group related component types by domain

// COMMON DSL - General data processing
common DSL:
├── data<common>     → toUpperCase(), pipeline(), filter(), count() 
├── boolean<common>  → and(), or(), not(), startsWith()
└── action<common>   → log(), runActions()

// UI DSL - User interface building  
ui DSL:
├── control<ui>      → button(), text(), group(), html()
├── feature<ui>      → id(), method()
└── layout<ui>       → (layout components)`,
      points: [
        explanation('DSLs organize components by domain - common for data, ui for interfaces'),
        syntax('type<dsl>', 'components have a type within a specific DSL'),
        whenToUse('when you need to understand what components are available for different tasks'),
        comparison('single global namespace', { advantage: 'prevents naming conflicts and enables domain-specific features' })
      ]
    }),
    solution({
      code: `// Real component identifiers show the DSL structure:
{
  "$$": "data<common>toUpperCase",     // data type in common DSL
  "text": "hello"
}

{  
  "$$": "control<ui>button",           // control type in ui DSL
  "title": "Click me",
  "action": {"$$": "action<common>log", "logName": "clicked"}
}`,
      points: [
        explanation('Every component instance shows its type<dsl> in the $$ property'),
        syntax('"$$": "type<dsl>componentName"', 'component identifier format'),
        whenToUse('understanding the internal structure of component instances'),
        performance('type<dsl> format enables the system to route components correctly')
      ]
    })
  )
})

Doclet('componentInstantiation', {
  impl: exercise(
    problem('How component instantiation works - using concrete examples'),
    solution({
      code: `// Instantiating components creates profile structures
// Starting with familiar examples:

// Simple component instantiation:
toUpperCase('hello')
// Creates: {"$$": "data<common>toUpperCase", "text": "hello"}

// Complex component instantiation:
button('Save', log('saved'))  
// Creates: {
//   "$$": "control<ui>button",
//   "title": "Save", 
//   "action": {"$$": "action<common>log", "logName": "saved"}
// }`,
      points: [
        explanation('Component instantiation creates profile structures, not immediate execution'),
        syntax('component(args...)', 'function-like syntax creates profiles'),
        whenToUse('when building reusable component structures'),
        performance('profiles are data structures that can be stored, modified, and executed later')
      ]
    }),
    solution({
      code: `// Args fill params based on component definitions:
// button component has these params:
// - title (mandatory)
// - action (mandatory) 
// - style (optional)

button('Save', log('saved'))
//     ^^^^^ fills 'title' param
//            ^^^^^^^^^^^^^ fills 'action' param (another component instance)`,
      points: [
        explanation('Args fill component params by position to create instances'),
        syntax('positional args', 'first arg fills first param, second fills second, etc.'),
        whenToUse('understanding how component parameters get filled during instantiation'),
        performance('param filling happens at instantiation time, not execution time')
      ]
    })
  )
})

Doclet('componentsWithinComponents', {
  impl: exercise(
    problem('How components nest within other components - building complexity from simplicity'),
    solution({
      code: `// Components can be used as args to fill other components' params:
button('Save', log('saved'))
//             ^^^^^^^^^^^^ log() component instance fills button's 'action' param

group([
  text('User: Homer'),           // text() instance in group's 'controls' param
  button('Edit', log('edit')),   // button() instance in group's 'controls' param  
  button('Delete', log('delete')) // another button() instance
])`,
      points: [
        explanation('Components can contain other components as inner instances'),
        syntax('component nesting', 'inner components fill outer component params'),
        whenToUse('when building complex functionality from simple building blocks'),
        performance('nested structure is built at instantiation, executed as single unit')
      ]
    }),
    solution({
      code: `// Cross-DSL composition - mixing components from different DSLs:
button(
  toUpperCase('save'),          // data<common> component fills ui param
  runActions([                  // action<common> component fills action param
    log('saving doc %$docId%'), // action<common> component in action sequence
    saveDoc('%$docId%')         // action<common> - save to database with docId variable
  ])
)`,
      points: [
        explanation('Components from different DSLs can work together when types are compatible'),
        syntax('cross-DSL usage', 'data<common> components can fill ui params'),
        syntax('runActions([...])', 'action<common> component that runs sequence of actions'),
        syntax('%$docId%', 'variable that resolves to document ID at runtime'),
        whenToUse('when building rich functionality that spans multiple domains')
      ]
    })
  )
})

Doclet('runtimeVariablesVsInstantiationArgs', {
  impl: exercise(
    problem('Understanding variables vs args - data flow vs structure building'),
    solution({
      code: `// VARIABLES - resolved at execution time for data flow:
'%$people%'        // → resolves to actual people array at runtime
'%%'               // → current data flowing through pipeline  
'%name%'           // → property access on current data item

// ARGS - used at instantiation time for structure building:
toUpperCase('hello')           // → 'hello' fills 'text' param
button('Save', log('saved'))   // → 'Save' fills 'title', log() fills 'action'
group([text(), button()])      // → array fills 'controls' param`,
      points: [
        explanation('Variables are for data flow at runtime, args are for structure at instantiation'),
        syntax('%$variable%', 'runtime variable - data flows through at execution'),
        syntax('component(args)', 'instantiation args - structure built at compile time'),
        whenToUse('variables for dynamic data, args for static structure')
      ]
    }),
    solution({
      code: `// Example mixing both:
button(
  toUpperCase('%$currentUser/name%'),  // Variable provides runtime data
  runActions([                         // Args provide action structure
    log('Form submitted by %$currentUser/name% for doc %$docId%'),
    saveDoc('%$docId%')                // Variable provides document ID to save
  ])
)`,
      points: [
        explanation('Same component can use both runtime variables and instantiation args'),
        syntax('mixed usage', 'args build structure, variables provide runtime data flow'),
        syntax('runActions([...])', 'action<common> component for sequencing actions'),
        syntax('%$docId%', 'variable resolves to specific document ID at execution time'),
        whenToUse('when building dynamic interfaces that respond to runtime data'),
        performance('structure built once, variables resolved each execution')
      ]
    })
  )
})

Doclet('typeSystemInAction', {
  impl: exercise(
    problem('Understanding TGP type system through working examples'),
    solution({
      code: `// Type constraints ensure components are used correctly:
button(
  'Save Document',              // string fills title param  
  runActions([                  // action<common> fills action param ✅
    log('saving %$docId%'),     // action<common> 
    saveDoc('%$docId%')         // action<common>
  ])
)

// This would be a type error:
button(
  'Save Document',
  pipeline('%$data%', count())  // ❌ data<common> cannot fill action param
)`,
      points: [
        explanation('Type system prevents invalid component combinations at instantiation time'),
        syntax('type matching', 'param type must match arg component type'),
        doNot('using data components where actions are expected'),
        whenToUse('understanding why certain combinations work or fail')
      ]
    }),
    solution({
      code: `// Data processing example:
pipeline(
  '%$documents%',               // data source
  filter('%status% == "draft"'), // boolean<common> fills filter param ✅
  '%title%',                    // data transformation
  toUpperCase()                 // data<common> transformation ✅
)

// This would be a type error:  
pipeline(
  '%$documents%',
  saveDoc('processing'),            // ❌ action<common> cannot be pipeline operator
  '%title%'
)`,
      points: [
        explanation('Pipeline operators must be OF TYPE data<common> or boolean<common>'),
        syntax('pipeline type rules', 'only data and boolean components work in pipelines'),
        doNot('using action components as pipeline operators'),
        comparison('action sequences', { advantage: 'pipelines optimize for data flow, actions for side effects' })
      ]
    })
  )
})

Doclet('executionPatterns', {
  impl: exercise(
    problem('How component instances get executed - from instantiation to results'),
    solution({
      code: `// Method 1: Direct execution with empty context
const buttonInstance = button('Save', log('clicked'))
const result = buttonInstance.$run({})

// Method 2: Context-based execution  
const result2 = new Ctx()
  .setVars({docId: 'doc123', currentUser: {name: 'Homer'}})
  .run(buttonInstance)

// Method 3: Runtime instantiation and execution
const result3 = new Ctx()
  .setVars({docId: 'doc456'})
  .run(button(
    'Save Document',
    runActions([
      log('saving %$docId%'),
      saveDoc('%$docId%')
    ])
  ))`,
      points: [
        explanation('Component instances can be executed in multiple ways'),
        syntax('template.$run({})', 'execute with empty context'),
        syntax('new Ctx().setVars({}).run(template)', 'execute with specific variables'),
        whenToUse('different execution patterns for different use cases'),
        performance('same instance can be executed multiple times with different contexts')
      ]
    })
  )
})

Doclet('practicalTGPExample', {
  impl: exercise(
    problem('Complete example - building a document editor interface with TGP'),
    solution({
      code: `// Real-world example combining multiple DSLs:
group([
  text('Document: %$document/title%'),          // ui + runtime variable
  text('Status: %$document/status%'),           // ui + runtime variable
  group([                                       // nested ui structure
    button(                                     // ui component
      'Save',                                   // static arg
      runActions([                              // action<common> component
        log('Saving document %$document/id%'), // action with variable
        saveDoc('%$document/id%'),              // action with variable
        showMessage('Document saved!')          // action component
      ])
    ),
    button(
      'Delete', 
      runActions([
        log('Deleting document %$document/id%'),
        deleteDoc('%$document/id%'),
        navigate('/documents')
      ])
    )
  ])
])`,
      points: [
        explanation('Real applications combine UI structure, data flow, and actions'),
        syntax('nested composition', 'groups contain buttons, buttons contain actions'),
        syntax('cross-DSL integration', 'ui + action + data components working together'),
        whenToUse('building complete interactive applications'),
        performance('entire interface defined declaratively, executed reactively')
      ]
    }),
    mechanismUnderTheHood({
      snippet: `// This creates a complex nested profile structure:
{
  "$$": "control<ui>group",
  "controls": [
    {"$$": "control<ui>text", "text": "Document: %$document/title%"},
    {"$$": "control<ui>text", "text": "Status: %$document/status%"}, 
    {
      "$$": "control<ui>group",
      "controls": [
        {
          "$$": "control<ui>button",
          "title": "Save",
          "action": {
            "$$": "action<common>runActions",
            "actions": [
              {"$$": "action<common>log", "logName": "Saving document %$document/id%"},
              {"$$": "action<common>saveDoc", "docId": "%$document/id%"},
              {"$$": "action<common>showMessage", "message": "Document saved!"}
            ]
          }
        }
        // ... more buttons
      ]
    }
  ]
}`,
      explain: 'Complex UIs become nested profile structures that can be serialized, sent to other processes if needed, and executed'
    })
  )
})

Doclet('abstractingToTGPPrinciples', {
  impl: exercise(
    problem('From concrete examples to abstract TGP principles'),
    solution({
      code: `// What we've seen with concrete examples reveals TGP patterns:

// 1. Components are OF TYPE a specific type within a DSL
toUpperCase()  // is OF TYPE data<common>
button()       // is OF TYPE control<ui>
runActions()   // is OF TYPE action<common>

// 2. Instantiation creates profiles with args filling params
button('Save', runActions([...]))  // args fill button's title and action params

// 3. Type compatibility enables safe composition  
button(toUpperCase('save'), runActions([...]))  // data<common> can fill ui title param
// button('Save', pipeline(...))  // ❌ would be type error - data<common> cannot fill action param`,
      points: [
        explanation('Concrete examples show universal TGP patterns in action'),
        syntax('type<dsl> identity', 'every component is OF TYPE within a DSL'),
        syntax('type safety', 'prevents invalid combinations at instantiation time'),
        whenToUse('understanding the fundamental patterns that make TGP work'),
        performance('type system enables safe composition across different domains')
      ]
    }),
    solution({
      code: `// TGP enables:
// - Domain organization (common vs ui vs action DSLs)
// - Type safety (compatible components can compose, incompatible ones cannot)  
// - Flexible instantiation (positional, named, or mixed args)
// - Runtime/compile separation (structure vs data flow)
// - Cross-domain composition (ui + data + actions working together)
// - Serializable components (profiles can be saved, transmitted, modified)

// This is why you can build complex applications from simple, reusable components!`,
      points: [
        explanation('TGP provides the foundation for building complex systems from simple parts'),
        syntax('compositional architecture', 'small components combine into larger functionality'),
        syntax('declarative programming', 'describe what you want, not how to achieve it'),
        whenToUse('when building maintainable, reusable component-based systems'),
        comparison('traditional programming', { advantage: 'declarative composition with type safety across domains' })
      ]
    })
  )
})
