import { dsls } from '@jb6/core'
import '@jb6/common'
import '@jb6/testing'
import '@jb6/llm-guide'

const { 
  doclet: { Doclet,
    doclet: { exercise },
    guidance: { doNot, bestPractice },
    'naming-system': { namingSystem },
    'naming-category': { namingCategory },
    'naming-collision': { namingCollision },
    explanationPoint: { explanation, evidence, syntax, performance },
    problemStatement: { problem }
  } 
} = dsls

Doclet('tgpNamingConventions', {
  impl: exercise(
    problem({
      statement: 'TGP naming conventions prevent namespace collisions and improve code clarity',
      intro: 'Consistent naming patterns across DSLs, types, components, and parameters eliminate conflicts and make TGP systems more maintainable.'
    }),
    
    namingSystem({
      problem: 'Generic component names can conflict with namespaces created by dotted component IDs, causing import collisions and confusion',
      
      categories: [
        namingCategory({
          name: 'DSL Names',
          pattern: 'kebab-case, domain-specific',
          examples: `'social-db'        // ✅ descriptive domain
'ui'               // ✅ clear purpose
'activity-detection'  // ✅ specific functionality  
'myStuff'          // ❌ too generic
'DB'               // ❌ too abbreviated`,
          reasoning: 'DSL names define domain boundaries and should clearly indicate their purpose',
          buildsToward: 'TgpType names that organize components within these domains'
        }),
        
        namingCategory({
          name: 'TgpType Names', 
          pattern: 'singular nouns, kebab-case',
          examples: `TgpType('data-store', 'social-db')     // ✅ singular noun
TgpType('activity-detection', 'social-db')  // ✅ descriptive
TgpType('polling-strategy', 'social-db')    // ✅ specific purpose
TgpType('dataStores', 'social-db')         // ❌ plural form
TgpType('doActivity', 'social-db')         // ❌ verb phrase`,
          reasoning: 'Types represent categories of components, not instances, so singular nouns are grammatically correct',
          buildsToward: 'Variable names for type factories that create these component types'
        }),
        
        namingCategory({
          name: 'TgpType Variables',
          pattern: 'camelCase, match type purpose',
          examples: `const dataStore = TgpType('data-store', 'social-db')        // ✅ camelCase factory name
const activityDetection = TgpType('activity-detection', 'social-db')  // ✅ descriptive
const notificationMechanism = TgpType('notification-mechanism', 'social-db')
const DataStore = TgpType('data-store', 'social-db')        // ❌ PascalCase - not consistent
const ds = TgpType('data-store', 'social-db')              // ❌ too abbreviated`,
          reasoning: 'camelCase follows JavaScript variable naming conventions and distinguishes type factories from constants',
          buildsToward: 'Generic component names that will be registered in the DSL system'
        }),
        
        namingCategory({
          name: 'Generic Component Names',
          pattern: 'camelCase, domain-specific',
          examples: `DataStore('socialDbStore', {           // ✅ domain-specific, descriptive
  params: [
    {id: 'fileName', as: 'string'},
    {id: 'sharing', type: 'sharing'}
  ]
})

DbImpl('fileBasedImpl', { ... })       // ✅ implementation-specific
DbImpl('contextualImpl', { ... })      // ✅ purpose-specific

// Common DSL examples:
Data('pipeline', { ... })              // ✅ specific operation name
Action('runActions', { ... })          // ✅ specific action name

// PROBLEMATIC PATTERNS:
DataStore('dataStore', { ... })        // ❌ same as type name - collision risk!
DbImpl('dbImpl', { ... })              // ❌ generic type name`,
          reasoning: 'Generic components are reusable building blocks that need distinctive names describing their specific purpose',
          buildsToward: 'Potential namespace conflicts when components use dotted IDs for organization'
        }),
        
        namingCategory({
          name: 'Parameter IDs',
          pattern: 'camelCase, descriptive purpose',
          examples: `{id: 'fileName', as: 'string', mandatory: true}       // ✅ clear purpose
{id: 'activityDetection', type: 'activity-detection'} // ✅ descriptive
{id: 'pollingStrategy', type: 'polling-strategy'}     // ✅ specific
{id: 'sharingMode', as: 'string', options: 'public,private'}  // ✅ descriptive

{id: 'data', as: 'string'}             // ❌ too generic
{id: 'fn', as: 'string'}               // ❌ abbreviated  
{id: 'stuff', as: 'array'}             // ❌ meaningless`,
          reasoning: 'Parameter names should clearly indicate what they contain or control, following JavaScript variable naming conventions'
        })
      ],
      
      collision: namingCollision({
        scenario: `// THE COLLISION SCENARIO:
DataStore('dataStore', {               // Creates dsls['social-db']['data-store']['dataStore']
  params: [
    {id: 'fileName', as: 'string', mandatory: true},
    {id: 'sharing', type: 'sharing', mandatory: true}
  ]
})

Action('dataStore.put', { ... })       // Creates ns.dataStore namespace 
Action('dataStore.refine', { ... })    // Adds to ns.dataStore
Action('dataStore.append', { ... })    // Adds to ns.dataStore

// IMPORT COLLISION:
const { 'data-store': { dataStore } } = dsls   // Import generic component
const { dataStore } = ns                       // ❌ COLLISION! Namespace object`,
        explanation: 'TGP creates namespaces when component IDs contain dots. "dataStore.put" creates ns.dataStore, which conflicts with importing the dataStore generic component',
        fix: `// SOLUTION: Domain-specific naming eliminates collision
DataStore('socialDbStore', {           // ✅ specific component name
  params: [
    {id: 'fileName', as: 'string', mandatory: true},
    {id: 'sharing', type: 'sharing', mandatory: true}
  ]
})

Action('socialDbStore.put', { ... })   // ✅ creates ns.socialDbStore namespace
Action('socialDbStore.refine', { ... })
Action('socialDbStore.append', { ... })

// NO COLLISION:
const { 'data-store': { socialDbStore } } = dsls  // Import generic component
const { socialDbStore } = ns                      // ✅ refers to namespace - no conflict`,
        evidence: 'Real collision discovered in packages/social-db: dataStore component vs ns.dataStore namespace created by Action("dataStore.put") pattern'
      }),
      
      solution: 'Use domain-specific names that describe purpose rather than generic type names. This prevents namespace collisions and improves code clarity.'
    }),

    doNot('using type names as generic component names', {
      reason: 'creates namespace collisions when used with dotted component IDs'
    }),

    bestPractice({
      suboptimalCode: `DataStore('dataStore', { ... })
Action('dataStore.put', { ... })
const { dataStore } = ns  // collision!`,
      better: `DataStore('socialDbStore', { ... })
Action('socialDbStore.put', { ... })  
const { socialDbStore } = ns  // clear reference`,
      reason: 'domain-specific names eliminate namespace collision risk and improve clarity'
    })
  )
})