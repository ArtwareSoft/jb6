import { dsls } from '@jb6/core'
import '@jb6/common'
import '@jb6/testing'
import '@jb6/llm-guide'

const { 
  tgp: { Const, var: { Var } }, 
  common: { data: { pipeline, filter, count, join, toUpperCase }, Boolean: { and } },
  ui: { control: { button, text, group } },
  'llm-guide': { Doclet, Booklet,
    booklet: { booklet},
    doclet: { howTo, principle },
    guidance: { solution, doNot, bestPractice, mechanismUnderTheHood, illegalSyntax }, 
    explanationPoint: { whenToUse, performance, comparison, syntax, explanation },
    problemStatement: {problem}
  } 
} = dsls

// =============================================================================
// PASS 1: BASIC MENTAL MODELS (Get Started Fast)
// =============================================================================

Doclet('tgpBasics', {
  impl: howTo(
    problem('Understanding Type-Generic Profiles (TGP) - the component system in jb6'),
    solution({
      code: `// Component instantiation creates profiles (JSON-like structures)
{
  "$$": "data<common>pipeline",
  "source": "%$people%",
  "operators": [
    {"$$": "data<common>filter", "filter": "%age% < 30"},
    {"$$": "data<common>count"}
  ]
}`,
      points: [
        explanation('Component instantiation creates profiles (data structures) with $$ indicating the component type'),
        syntax('$$', 'component identifier in format "type<dsl>componentName"'),
        whenToUse('when building reusable component structures'),
        performance('profiles are serializable and can be stored/transmitted')
      ]
    }),
    solution({
      code: `// Shorthand instantiation syntax
pipeline('%$people%', filter('%age% < 30'), count())`,
      points: [
        explanation('Function-like instantiation syntax is syntactic sugar that creates profiles'),
        syntax('instantiation syntax', 'creates profile structure with $$ property'),
        whenToUse('when instantiating components inline for readability'),
        comparison('profile syntax', { advantage: 'more readable and familiar to developers' })
      ]
    }),
    mechanismUnderTheHood({
      snippet: `// Component instantiation process:
pipeline('%$people%', filter('%age% < 30'), count())

// Creates this profile structure:
{
  "$$": "data<common>pipeline",
  "source": "%$people%",
  "operators": [
    {"$$": "data<common>filter", "filter": "%age% < 30"},
    {"$$": "data<common>count"}
  ]
}

// Later, $run() further instantiates according to DSL type:
profile.$run(ctx) // → instantiated according to "data<common>pipeline" implementation`,
      explain: 'Component instantiation creates profiles, then $run() further instantiates them according to their DSL type'
    })
  )
})

Doclet('workingWithCommonDSL', {
  impl: howTo(
    problem('Working with the common DSL - data processing components'),
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

Doclet('profiles', {
  impl: howTo(
    problem('Understanding profiles - component instantiation'),
    solution({
      code: `// Profiles as direct component instantiation nesting
pipeline(
  '%$people%',
  filter('%age% < 30'),    // Profile
  count()                  // Profile
)`,
      points: [
        explanation('Profiles are nested within other components'),
        syntax('direct nesting', 'components can contain other components as parameters'),
        whenToUse('when building complex operations from simpler components'),
        performance('profiles are compiled inline, no global lookup needed')
      ]
    }),
    mechanismUnderTheHood({
      snippet: `// Profile compilation:
filter(and('%age% < 30', '%name% == "Bart"'))

// Becomes nested profile structure:
{
  "$$": "data<common>filter",
  "filter": {
    "$$": "boolean<common>and", 
    "items": ["%age% < 30", "%name% == \\"Bart\\""]
  }
}`,
      explain: 'profiles create nested component hierarchies in the profile structure'
    })
  )
})

// =============================================================================
// PASS 2: SYSTEM UNDERSTANDING (How It Works)
// =============================================================================

Doclet('compDefExplanation', {
  impl: principle('critical', 'CompDef (Component Definition) creates reusable components from TgpTypes', {
    rationale: 'CompDef provides the three-level structure that enables TGP component system: TgpType creates CompDef, CompDef creates component, component creates profile.',
    guidance: [
      solution({
        code: `// TgpType creates CompDef:
const Data = TgpType('data', 'common')           // Data is CompDef for data components

// CompDef creates components:
Data('pipeline', {                               // CompDef defines pipeline component
  params: [
    {id: 'source', type: 'data', mandatory: true},
    {id: 'operators', type: 'data[]', mandatory: true, secondParamAsArray: true}
  ],
  impl: (ctx, {source, operators}) => {
    return operators.reduce((data, op) => op(ctx.setData(data)), source())
  }
})

// Component creates profiles:
pipeline('%$people%', filter('%age% < 30'), count())    // Creates profile structure`,
        points: [
          explanation('CompDef creates reusable components from TgpTypes'),
          syntax('Data("componentName", { params, impl })', 'CompDef registration pattern'),
          syntax('TgpType → CompDef → component → profile', 'three-level TGP structure'),
          performance('CompDef enables component reuse across the entire system'),
          whenToUse('when creating new components that others can use')
        ]
      }),
      solution({
        code: `// Component instantiation uses CompDef:
pipeline('%$people%', filter('%age% < 30'), count())     
// ^^^^^^^^ Uses the component created by CompDef

// The three-level progression:
// 1. TgpType('data', 'common') creates CompDef (Data)
// 2. Data('pipeline', {...}) creates component (pipeline)  
// 3. pipeline(...args) creates profile`,
        points: [
          explanation('Three-level structure: TgpType creates CompDef, CompDef creates component, component creates profile'),
          syntax('component instantiation', 'creates profiles, not immediate execution'),
          whenToUse('understanding the fundamental TGP component creation hierarchy'),
          performance('profiles can be stored, modified, and instantiated later')
        ]
      }),
      solution({
        code: `// CompDef naming conventions:
const Data = TgpType('data', 'common')           // ✅ PascalCase CompDef variable
const Control = TgpType('control', 'ui')         // ✅ Matches domain purpose
const Action = TgpType('action', 'common')       // ✅ Clear, descriptive

const dataType = TgpType('data', 'common')       // ❌ camelCase inappropriate for CompDef
const d = TgpType('data', 'common')              // ❌ abbreviated, unclear`,
        points: [
          syntax('PascalCase CompDef variables', 'Data, Control, Action - match their domain purpose'),
          explanation('CompDef variables should clearly indicate their component type and domain'),
          whenToUse('when creating CompDef variables for component definition')
        ]
      })
    ]
  })
})

// =============================================================================
// TGP TERMINOLOGY ERRORS DOCLET
// =============================================================================

Doclet('tgpTerminologyErrors', {
  impl: principle('high', 'Use precise TGP terminology to avoid confusion with external programming concepts', {
    rationale: 'LLMs often mix TGP terminology with general programming terms, creating confusion. TGP has specific terminology that should be used consistently.',
    guidance: [
      solution({
        code: `// ✅ CORRECT TGP TERMINOLOGY:
// TgpType creates CompDef
const Data = TgpType('data', 'common')           // Data is CompDef
  
// CompDef creates component  
Data('pipeline', { params, impl })               // pipeline is component

// Component creates profile
pipeline('%$people%', count())                   // Creates profile structure

// Profile instantiation
profile.$run(ctx)                                // Instantiates profile according to DSL`,
        points: [
          syntax('TgpType → CompDef → component → profile', 'correct TGP hierarchy'),
          syntax('profile.$run()', 'profile instantiation, not execution'),
          explanation('TGP uses specific terms that should not be mixed with general programming terminology')
        ]
      }),
      doNot('Using general programming terminology instead of TGP terms', {
        reason: 'Creates confusion and misunderstanding of TGP concepts'
      }),
      solution({
        code: `// ❌ COMMON TERMINOLOGY ERRORS:

// ERROR: Using "factory" (external term)
"TgpType creates type factories"                 // ❌ Use "CompDef" 
"CompDef creates component factories"            // ❌ Use "component"
"component factory creates instances"            // ❌ Use "profile"

// ERROR: Using "instance" instead of "profile"  
"component instantiation creates instances"      // ❌ Use "profile"
"component instances can be stored"              // ❌ Use "profile"

// ERROR: Using "execution" instead of "instantiation"
"profile execution"                              // ❌ Use "profile instantiation" 
"execute the component"                          // ❌ Use "instantiate the profile"

// ERROR: Mixing "class" terminology
"component class definition"                     // ❌ Use "CompDef"
"instantiate a class"                           // ❌ Use "create profile"`,
        points: [
          explanation('Avoid "factory" - use CompDef and component'),
          explanation('Avoid "instance" - use profile'),
          explanation('Avoid "execution" - use instantiation'),
          explanation('Avoid OOP terms like "class" - use TGP terminology'),
          syntax('profile', 'not instance - profiles are data structures, not objects')
        ]
      }),
      solution({
        code: `// ✅ CORRECT TGP TERMINOLOGY CHEAT SHEET:

// CREATION HIERARCHY:
TgpType()     → creates → CompDef
CompDef()     → creates → component  
component()   → creates → profile
profile.$run() → instantiates according to DSL

// NAMING:
CompDef variable: PascalCase (Data, Control, Action)
component name: camelCase (pipeline, button, filter)
profile: JSON structure with $$ property

// CONCEPTS:
✅ "profile"          ❌ "instance"
✅ "instantiation"    ❌ "execution" 
✅ "CompDef"         ❌ "factory"
✅ "component"       ❌ "component factory"
✅ "DSL"             ❌ "namespace"
✅ "type<dsl>"       ❌ "class hierarchy"`,
        points: [
          syntax('TGP terminology', 'use TGP-specific terms consistently'),
          explanation('TGP terminology is precise and should not be mixed with general programming terms'),
          performance('consistent terminology improves understanding and reduces confusion'),
          whenToUse('always when discussing TGP concepts')
        ]
      }),
      bestPractice({
        suboptimalCode: 'CompDef creates component factories that instantiate component instances',
        better: 'CompDef creates components that create profiles',
        reason: 'TGP terminology is precise - avoid external programming terms like "factory" and "instance"'
      }),
      doNot('Mixing OOP terminology (class, instance, factory) with TGP concepts', {
        reason: 'TGP has its own conceptual model - mixing terminologies creates confusion'
      }),
      doNot('Using "execution" when referring to profile instantiation', {
        reason: 'profiles are instantiated according to DSL type, not executed like functions'
      })
    ]
  })
})
Doclet('understandingDSLs', {
  impl: howTo(
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
        comparison('single global namespace', {
          advantage: 'prevents naming conflicts and enables domain-specific features'
        })
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
        explanation('Every profile shows its type<dsl> in the $$ property'),
        syntax('"$$": "type<dsl>componentName"', 'component identifier format'),
        whenToUse('understanding the internal structure of profiles'),
        performance('type<dsl> format enables the system to route components correctly')
      ]
    })
  )
})

Doclet('workingWithUIDSL', {
  impl: howTo(
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

Doclet('argsPosition', {
  impl: howTo(
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
  impl: howTo(
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

// =============================================================================
// PASS 3: ADVANCED COMPOSITION (Build Complex Things)
// =============================================================================

Doclet('componentsWithinComponents', {
  impl: howTo(
    problem('How components nest within other components - building complexity from simplicity'),
    solution({
      code: `// Components can be used as args to fill other components' params:
button('Save', log('saved'))
//             ^^^^^^^^^^^^ log() profile fills button's 'action' param

group([
  text('User: Homer'),           // text() profile in group's 'controls' param
  button('Edit', log('edit')),   // button() profile in group's 'controls' param  
  button('Delete', log('delete')) // another button() profile
])`,
      points: [
        explanation('Components can contain other components as profiles'),
        syntax('component nesting', 'profiles fill outer component params'),
        whenToUse('when building complex functionality from simple building blocks'),
        performance('nested structure is built at instantiation, instantiated as single unit')
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
  impl: howTo(
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
  impl: howTo(
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

Doclet('definingComponents', {
  impl: howTo(
    problem('Defining reusable components - storing component definitions in the system'),
    solution({
      code: `// Define components using DSL functions
Data('peopleUnder30', {
  impl: pipeline('%$people%', filter('%age% < 30'), count())
})

// Use the component
peopleUnder30()  // instantiates the defined component`,
      points: [
        explanation('Data(), Control(), Test() etc. define reusable components'),
        syntax('Data(), Control()', 'DSL functions that register components'),
        whenToUse('when creating reusable components for your application'),
        performance('defined components enable reuse and modular architecture')
      ]
    })
  )
})

// =============================================================================
// PASS 4: PRODUCTION PATTERNS (Real-World Usage)
// =============================================================================

Doclet('templating', {
  impl: howTo(
    problem('Understanding templating - creating profiles with parameters instead of immediate execution'),
    solution({
      code: `// Templating: Component instantiation creates profile template
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
        syntax('component instantiation', 'function-like syntax generates templates, not immediate execution'),
        whenToUse('when building component structures for later instantiation'),
        performance('templates are data structures that can be stored, modified, and instantiated')
      ]
    }),
    solution({
      code: `// Template with parameters vs instantiation
const template = pipeline('%$people%', count())  // Creates template
const result = template.$run()                   // Instantiates template according to DSL type

// NOT immediate execution:
// pipeline() does NOT immediately run - it creates a template!`,
      points: [
        explanation('Component instantiation creates templates, $run() further instantiates them according to DSL type'),
        syntax('template vs instantiation', 'clear separation between template creation and DSL-specific instantiation'),
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
        explanation('Parameters become template slots filled at instantiation time'),
        syntax('parameter placeholders', '%age% becomes slot in template structure'),
        whenToUse('when creating templates that work with different data contexts'),
        performance('parameter resolution happens at instantiation, not template creation')
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

// Instantiation happens separately:
template.$run(ctx) // → further instantiation according to DSL type`,
      explain: 'templating separates template creation from DSL-specific instantiation, enabling inspection and modification'
    })
  )
})

Doclet('forwardReferences', {
  impl: howTo(
    problem('Using components before they are defined in default values'),
    solution({
      code: `// Forward reference for default value:
 const fileBased = ActivityDetection.forward('fileBased')
 
 {id: 'activityDetection', defaultValue: fileBased()}
 
 // Later: ActivityDetection('fileBased', {...})`,
      points: [
        explanation('Forward references solve component ordering in default values'),
        syntax('TgpType.forward(\'id\')', 'creates lazy proxy for later resolution'),
        whenToUse('when component used as default before definition')
      ]
    }),
    mechanismUnderTheHood({
      snippet: `apply: () => () => dsls[dsl][type][componentId]()`,
      explain: 'returns function that resolves component when actually needed'
    })
  )
 })

Doclet('instantiationPatterns', {
  impl: howTo(
    problem('How profiles get instantiated - from template creation to results'),
    solution({
      code: `// Method 1: Direct instantiation with empty context
const buttonProfile = button('Save', log('clicked'))
const result = buttonProfile.$run({})

// Method 2: Context-based instantiation  
const result2 = new Ctx()
  .setVars({docId: 'doc123', currentUser: {name: 'Homer'}})
  .run(buttonProfile)

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
        explanation('Profiles can be instantiated in multiple ways'),
        syntax('profile.$run({})', 'instantiate with empty context'),
        syntax('new Ctx().setVars({}).run(profile)', 'instantiate with specific variables'),
        whenToUse('different instantiation patterns for different use cases'),
        performance('same profile can be instantiated multiple times with different contexts')
      ]
    })
  )
})

Doclet('practicalTGPExample', {
  impl: howTo(
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
        performance('entire interface defined declaratively, instantiated reactively')
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
      explain: 'Complex UIs become nested profile structures that can be serialized, sent to other processes if needed, and instantiated'
    })
  )
})

Doclet('abstractingToTGPPrinciples', {
  impl: howTo(
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

Booklet('tgpPrimer', {
  impl: booklet(
    'tgpBasics,workingWithCommonDSL,profiles,compDefExplanation,tgpTerminologyErrors,understandingDSLs,argsPosition,argsByValue,componentsWithinComponents'
  )
})