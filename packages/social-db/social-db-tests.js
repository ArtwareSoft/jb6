import { dsls } from '@jb6/core'
import '@jb6/common'
import './social-db-tester.js'

const { 
  'social-db': { DataStore,
    'data-store': { dataStore },
    'db-impl': { inMemoryTesting },
    'sharing': { userOnly, friends },
    'data-store-feature': { sampleData }
  },
  test: { Test, 
    test: { dataTest, socialDbSingleUser }
  }, 
  common: { Boolean, Data, Action,
    boolean: { equals, contains },
    data: { asIs, pipeline, first, property },
    action: { runActions }
  }
} = dsls

const { dataStore } = ns

// =============================================================================
// SIMPLE DATA STORES FOR TESTING  
// =============================================================================

const simpleNotes = DataStore('simpleNotes', {
  impl: dataStore('notes', {  
    sharing: userOnly(),
    dataStructure: 'keyValue',
    dbImpl: inMemoryTesting(),
    features: [sampleData(asIs({
      note1: { id: 'note1', title: 'First Note', content: 'This is my first note', createdAt: 1745526152578 },
      note2: { id: 'note2', title: 'Second Note', content: 'This is my second note', createdAt: 1745526152579 }
    }))]
  })
})

const todoList = DataStore('todoList', {
  impl: dataStore('todos', {
    sharing: friends(),
    dataStructure: 'array',
    dbImpl: inMemoryTesting(),
    features: [sampleData(asIs([
      { id: 'todo1', text: 'Buy groceries', completed: false, createdAt: 1745526152578 },
      { id: 'todo2', text: 'Walk the dog', completed: true, createdAt: 1745526152579 },
      { id: 'todo3', text: 'Finish project', completed: false, createdAt: 1745526152580 }
    ]))]
  })
})

Test('testSimpleNotesGet', {
  impl: socialDbSingleUser({
    operations: runActions(
      put(simpleNotes(), asIs({ myNote: { title: 'Test Note', content: 'Hello World' } }))
    ),
    query: pipeline(
      get(simpleNotes(), 'user1', 'room1'),
      property('myNote.title')
    ),
    expectedResult: 'Test Note'
  })
})

Test('testSimpleNotesRefine', {
  impl: socialDbSingleUser({
    operations: runActions(
      put(simpleNotes(), asIs({})),
      refine(simpleNotes(), 
        asIs(notes => ({ ...notes, newNote: { title: 'Added Note', content: 'Added via refine' } }))
      )
    ),
    query: pipeline(
      get(simpleNotes(), 'user1', 'room1'),
      property('newNote.title')
    ),
    expectedResult: 'Added Note'
  })
})

Test('testTodoListAppend', {
  impl: socialDbSingleUser({
    operations: runActions(
      put(todoList(), asIs([])),
      appendItem(todoList(), asIs({ id: 'todo-new', text: 'New Task', completed: false }))
    ),
    query: pipeline(
      get(todoList(), 'user1', 'room1'),
      first(),
      property('text')
    ),
    expectedResult: 'New Task'
  })
})

Test('testTodoListMultipleOperations', {
  impl: socialDbSingleUser({
    operations: runActions(
      put(todoList(), asIs([])),
      appendItem(todoList(), asIs({ id: 'todo1', text: 'Task 1', completed: false })),
      appendItem(todoList(), asIs({ id: 'todo2', text: 'Task 2', completed: true })),
      refine(todoList(), 
        asIs(todos => todos.map(todo => 
          todo.id === 'todo1' ? { ...todo, completed: true } : todo
        ))
      )
    ),
    query: pipeline(
      get(todoList(), 'user1', 'room1'),
      first(),
      property('completed')
    ),
    expectedResult: true
  })
})

// =============================================================================
// ADDITIONAL TESTS  
// =============================================================================

Test('socialDb2Users', {
  params: [
    {id: 'dataStore', type: 'data-store<social-db>', mandatory: true},
    {id: 'initialData', as: 'object', defaultValue: {}},
    {id: 'userA', type: 'action<common>', mandatory: true},
    {id: 'userB', type: 'action<common>', mandatory: true},
    {id: 'expectedResult', dynamic: true, mandatory: true},
  ],
  impl: dataTest({
    calculate: async (ctx, {dataStore, initialData, userA, userB}) => {
      // Initialize data store with initial data
      if (Object.keys(initialData).length > 0) {
        await dataStore.put('system', 'room1', initialData)
      }
      
      // Execute user A actions
      await userA({ctx, dataStore, userId: 'userA', roomId: 'room1'})
      
      // Execute user B actions  
      await userB({ctx, dataStore, userId: 'userB', roomId: 'room1'})
      
      // Return final state
      return await dataStore.get('system', 'room1')
    },
    expectedResult: '%$expectedResult()%',
    timeout: 3000,
    includeTestRes: true
  })
})

