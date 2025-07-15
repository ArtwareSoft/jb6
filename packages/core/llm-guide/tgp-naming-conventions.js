import { dsls } from '@jb6/core'
import '@jb6/common'
import '@jb6/testing'
import '@jb6/llm-guide'

const { 
  'llm-guide': { Doclet, ExplanationPoint,
    doclet: { principle },
    guidance: { solution, doNot, bestPractice },
    explanationPoint: { explanation, evidence, syntax, performance },
    problemStatement: { problem }
  } 
} = dsls

const namingCategory = ExplanationPoint('namingCategory', {
  description: 'Individual naming category with examples and reasoning',
  params: [
    {id: 'name', as: 'string', mandatory: true, description: 'Category name (e.g., "DSL Names")'},
    {id: 'pattern', as: 'string', mandatory: true, description: 'Naming pattern to follow'},
    {id: 'examples', as: 'text', mandatory: true, description: 'Real syntax examples with good/bad comparisons'},
    {id: 'reasoning', as: 'text', mandatory: true, description: 'Why this pattern matters'},
    {id: 'buildsToward', as: 'text', description: 'How this category connects to the next in the progression'}
  ]
})

const namingCollision = ExplanationPoint('namingCollision', {
  description: 'Concrete collision scenario with evidence and solution',
  params: [
    {id: 'scenario', as: 'text', mandatory: true, description: 'Concrete code showing the collision happening'},
    {id: 'explanation', as: 'text', mandatory: true, description: 'Technical explanation of why the collision occurs'},
    {id: 'fix', as: 'text', mandatory: true, description: 'How the naming rules prevent this collision'},
    {id: 'evidence', as: 'text', description: 'Real-world evidence this collision occurred'}
  ]
})

Doclet('tgpNamingConventions', {
  impl: principle({
    importance: 'high',
    rule: 'Use domain-specific naming patterns to prevent namespace collisions and improve code clarity',
    rationale: `Consistent naming patterns across DSLs, types, components, and parameters eliminate conflicts and make TGP systems more maintainable.
                Generic component names can conflict with namespaces created by dotted component IDs.`,
    guidance: [
      solution({
        code: `// Naming convention hierarchy that prevents collisions:
// 1. DSL Names: kebab-case, domain-specific
// 2. TgpType Names: singular nouns, kebab-case  
// 3. TgpType Variables: camelCase, match type purpose
// 4. Generic Component Names: camelCase, domain-specific
// 5. Parameter IDs: camelCase, descriptive purpose`,
        points: [
          namingCategory('DSL Names', 'kebab-case, domain-specific', {
            examples: `'social-db'        // ✅ descriptive domain
'ui'               // ✅ clear purpose
'activity-detection'  // ✅ specific functionality  
'myStuff'          // ❌ too generic
'DB'               // ❌ too abbreviated`,
            reasoning: 'DSL names define domain boundaries and should clearly indicate their purpose',
            buildsToward: 'TgpType names that organize components within these domains'
          }),
          namingCategory('TgpType Names', 'singular nouns, kebab-case', {
            examples: `TgpType('data-store', 'social-db')     // ✅ singular noun
TgpType('activity-detection', 'social-db')  // ✅ descriptive
TgpType('polling-strategy', 'social-db')    // ✅ specific purpose
TgpType('dataStores', 'social-db')         // ❌ plural form
TgpType('doActivity', 'social-db')         // ❌ verb phrase`,
            reasoning: 'Types represent categories of components, not instances, so singular nouns are grammatically correct',
            buildsToward: 'Variable names for type factories that create these component types'
          }),
          namingCategory('Generic Component Names', 'camelCase, domain-specific', {
            examples: `DataStore('socialDbStore', {...})     // ✅ domain-specific, descriptive
Data('pipeline', {...})                   // ✅ specific operation name
Action('runActions', {...})               // ✅ specific action name

DataStore('dataStore', {...})             // ❌ same as type name - collision risk!
DbImpl('dbImpl', {...})                   // ❌ generic type name`,
            reasoning: 'Generic components need distinctive names describing their specific purpose to avoid namespace conflicts'
          })
        ]
      }),
      solution({
        code: `// THE COLLISION SCENARIO:
DataStore('dataStore', {...})             // Creates dsls['social-db']['data-store']['dataStore']
Action('dataStore.put', {...})            // Creates ns.dataStore namespace 

// IMPORT COLLISION:
const { 'data-store': { dataStore } } = dsls   // Import generic component
const { dataStore } = ns                       // ❌ COLLISION! Namespace object`,
        points: [
          namingCollision({
            scenario: `DataStore('dataStore', {...}) + Action('dataStore.put', {...})`,
            explanation: 'TGP creates namespaces when component IDs contain dots. "dataStore.put" creates ns.dataStore, which conflicts with importing the dataStore generic component',
            fix: `DataStore('socialDbStore', {...}) + Action('socialDbStore.put', {...})`,
            evidence: 'Real collision discovered in packages/social-db: dataStore component vs ns.dataStore namespace'
          })
        ]
      }),
      solution({
        code: `// SOLUTION: Domain-specific naming eliminates collision
DataStore('socialDbStore', {...})         // ✅ specific component name
Action('socialDbStore.put', {...})        // ✅ creates ns.socialDbStore namespace

// NO COLLISION:
const { 'data-store': { socialDbStore } } = dsls  // Import generic component
const { socialDbStore } = ns                      // ✅ refers to namespace - no conflict`,
        points: [
          evidence('Domain-specific naming prevents namespace collisions and improves code clarity'),
          syntax('domain-specific names', 'describe purpose rather than generic type names'),
          performance('eliminates import resolution conflicts and improves maintainability')
        ]
      }),
      doNot('using type names as generic component names', {
        reason: 'creates namespace collisions when used with dotted component IDs'
      }),
      bestPractice({
        suboptimalCode: `DataStore('dataStore', {...})
Action('dataStore.put', {...})
const { dataStore } = ns  // collision!`,
        better: `DataStore('socialDbStore', {...})
Action('socialDbStore.put', {...})  
const { socialDbStore } = ns  // clear reference`,
        reason: 'domain-specific names eliminate namespace collision risk and improve clarity'
      })
    ]
  })
})