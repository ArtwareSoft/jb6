import { dsls } from '@jb6/core'
import '@jb6/common'
import '@jb6/testing'
import '@jb6/llm-guide'

const { 
  'llm-guide': { Doclet,
    doclet: { exercise },
    guidance: { doNot, solution  },
    explanationPoint: { bestPractice, namingCategory,namingCollision },
    problemStatement: { problem }
  } 
} = dsls


Doclet('tgpNamingConventions', {
Doclet('tgpNamingConventions', {
  impl: exercise(
    problem({
      statement: 'How to use package namespaces when extending foreign DSLs with new operations',
      intro: 'When your package needs to add operations to DSLs you don\'t own (like adding social-db operations to common DSL components), namespaces provide clean extension without modifying the original DSL.'
    }),
    solution({
      code: `// THE CHALLENGE: Extending foreign DSLs

// Your social-db package wants to add operations to common DSL components:
// packages/common/ owns the common DSL
// packages/social-db/ wants to add get/put/refine operations

// ❌ CANNOT modify common DSL directly (you don't own it)
// ✅ SOLUTION: Use package namespace for your operations

// 1. Define components in the foreign DSL (common):
DataStore('dataStore', {               // ← Extends common DSL
  params: [
    {id: 'fileName', as: 'string', mandatory: true},
    {id: 'sharing', type: 'sharing', mandatory: true}
  ]
})

// 2. Add your package operations via namespace:
Action('socialDb.get', { ... })       // ← Your operations in your namespace
Action('socialDb.put', { ... })       // ← Clean extension without DSL modification
Action('socialDb.refine', { ... })    // ← Package-owned operations`,
      points: [
        explanation('Namespaces enable packages to extend foreign DSLs without modifying the original DSL'),
        syntax('Action("packageName.operation")', 'adds operations to your package namespace, not the foreign DSL'),
        whenToUse('when your package needs to add operations to DSLs owned by other packages'),
        performance('avoids DSL pollution while providing clean extension mechanism'),
        comparison('modifying foreign DSL', { advantage: 'no dependency conflicts, clear ownership boundaries' })
      ]
    }),
    solution({
      code: `// PRACTICAL USAGE: Foreign DSL extension in action

// 3. Clean usage separates DSL components from package operations:
const { dataStore } = dsls.common['data-store']  // ← Component from common DSL
const { socialDb } = ns                          // ← Operations from social-db package

// Use the common DSL component:
const store = dataStore('messages', {            // ← Native common DSL usage
  sharing: globalUserOnly(),
  dataStructure: 'appendOnly'
})

// Use your package operations:
await socialDb.get(store, userId, roomId)        // ← Your package's implementation
await socialDb.put(store, userId, roomId, data)  // ← Clear package attribution
await socialDb.refine(store, userId, roomId, fn) // ← Package-owned functionality`,
      points: [
        explanation('Clean separation: DSL components vs package operations'),
        syntax('dsls.common vs ns.socialDb', 'different sources for different purposes'),
        whenToUse('when you need both the foreign DSL component and your package operations'),
        performance('enables multiple packages to extend same DSL without conflicts'),
        evidence('social-db, testing, llm-guide all extend common DSL via their own namespaces')
      ]
    })
  )
})