import { dsls, ns } from '@jb6/core'
import '@jb6/common'
import './social-db-tester.js'

const { 
  tgp: { Const, 
    var : { Var } 
  },
  'social-db': { DataStore,
    'data-store': { dataStore },
    'db-impl': { inMemoryTesting },
    'sharing': { globalUserOnly, friends },
    'data-store-feature': { sampleData }
  },
  test: { Test, 
    test: { dataTest, socialDbSingleUser }
  }, 
  common: { Boolean, Data, Action,
    boolean: { equals, contains },
    data: { asIs, pipeline, pipe, first, property },
    action: { runActions }
  }
} = dsls

const { socialDB } = ns

// =============================================================================
// SIMPLE DATA STORES FOR TESTING  
// =============================================================================

const simpleNotes = DataStore('simpleNotes', {
  impl: dataStore('notes', globalUserOnly(), {
    dbImpl: inMemoryTesting(),
    features: [
      sampleData(asIs({
          note1: {id: 'note1', title: 'First Note', content: 'This is my first note', createdAt: 1745526152578},
          note2: {id: 'note2', title: 'Second Note', content: 'This is my second note', createdAt: 1745526152579}
      }))
    ]
  })
})

const todoList = DataStore('todoList', {
  impl: dataStore('todos', friends(), {
    dataStructure: 'array',
    dbImpl: inMemoryTesting(),
    features: [
      sampleData(asIs([
          {id: 'todo1', text: 'Buy groceries', completed: false, createdAt: 1745526152578},
          {id: 'todo2', text: 'Walk the dog', completed: true, createdAt: 1745526152579},
          {id: 'todo3', text: 'Finish project', completed: false, createdAt: 1745526152580}
      ]))
    ]
  })
})

Test('socialDBTest.get', {
  impl: socialDbSingleUser({
    operations: runActions(socialDB.put(simpleNotes(), asIs({myNote: {title: 'Test Note', content: 'Hello World'}}))),
    query: pipe(socialDB.get(simpleNotes()), '%myNote/title%'),
    expectedResult: equals('Test Note')
  })
})
