import { dsls } from '@jb6/core'
import '@jb6/common'
import '@jb6/testing'
import '@jb6/llm-guide'

const { 
  tgp: { Const },
  doclet: { Doclet,
    doclet: { exercise },
    guidance: { solution, doNot, bestPractice, mechanismUnderTheHood }, 
    explanationPoint: { whenToUse, performance, comparison, syntax, explanation, evidence, impact },
    problemStatement: { problem }
  } 
} = dsls

// Sample data for race condition examples
Const('initialTodos', [
  {id: 1, text: "Buy milk", author: "system"}
])

Const('serverFileFormat', {
  content: [
    {id: 1, text: "Buy milk", author: "system"}
  ],
  stamps: ["system:1703123400000"]
})

Doclet('refineRaceConditionProblem', {
  impl: exercise(
    problem({
      statement: 'What happens when multiple users call refine() simultaneously on the same data?',
      importance: 'critical',
      intro: 'Refine operations use optimistic concurrency control, but race conditions can cause lost updates when multiple users modify data simultaneously with stale reads.'
    }),
    solution({
      code: `// THE RACE CONDITION SCENARIO:

// T1: Initial server state  
serverFile = {
  content: [{id: 1, text: "Buy milk"}],
  stamps: ["system:1703123400000"]
}

// T2: Alice and Bob both read the SAME initial state
aliceReads = {content: [{id: 1, text: "Buy milk"}], stamps: ["system:1703123400000"]}
bobReads = {content: [{id: 1, text: "Buy milk"}], stamps: ["system:1703123400000"]}

// T3: Alice's refine operation
await todos.refine('alice', 'room1', (todos) => {
  return [...todos, {id: 2, text: "Alice's task", author: "alice"}]
})
// Alice writes: {content: [..., {id: 2}], stamps: [..., "alice:1703123450000"]}

// T4: Bob's refine operation (using STALE data from T2!)
await todos.refine('bob', 'room1', (todos) => {
  return [...todos, {id: 3, text: "Bob's task", author: "bob"}]  
})
// Bob writes: {content: [..., {id: 3}], stamps: [..., "bob:1703123451000"]}
// 🚨 ALICE'S CHANGES ARE COMPLETELY OVERWRITTEN!`,
      points: [
        explanation('Both users start with identical stale data, causing last-write-wins overwrites'),
        syntax('refine(userId, roomId, updateFunction)', 'optimistic concurrency - no locking'),
        syntax('stamps array', 'tracks all write operations with user:timestamp format'),
        evidence('Race conditions occur when read-to-write time exceeds update frequency'),
        impact('Lost updates can cause data loss and user frustration in collaborative apps')
      ]
    }),
    solution({
      code: `// WHAT GETS LOST IN THE RACE:

// Before race (what should happen):
expectedResult = {
  content: [
    {id: 1, text: "Buy milk"},
    {id: 2, text: "Alice's task", author: "alice"},  // Alice's contribution
    {id: 3, text: "Bob's task", author: "bob"}       // Bob's contribution  
  ],
  stamps: [
    "system:1703123400000",
    "alice:1703123450000",    // Alice's stamp
    "bob:1703123451000"       // Bob's stamp
  ]
}

// After race (what actually happens):
actualResult = {
  content: [
    {id: 1, text: "Buy milk"},
    {id: 3, text: "Bob's task", author: "bob"}       // Only Bob's task survives
  ],
  stamps: [
    "system:1703123400000", 
    "bob:1703123451000"       // Only Bob's stamp survives
  ]
}

// BOTH Alice's content AND stamp are completely lost!`,
      points: [
        explanation('Last write wins - Bob\'s entire file overwrites Alice\'s entire file'),
        syntax('atomic write', 'both content and stamps written together or not at all'),
        evidence('If stamp exists, content MUST exist - they are written atomically'),
        performance('No partial writes possible - file system guarantees atomicity'),
        comparison('database transactions', { advantage: 'simpler but more vulnerable to races' })
      ]
    })
  )
})

Doclet('detectingLostUpdates', {
  impl: exercise(
    problem({
      statement: 'How can the system detect and recover from lost updates caused by race conditions?',
      intro: 'Two mechanisms help detect lost updates: mergeReadWithCache for reading stale data, and reCheckRefine for verifying write success.'
    }),
    solution({
      code: `// DETECTION 1: mergeReadWithCache - Comparing fresh vs cached data

// Alice's cache after her successful write:
aliceCache = [
  {id: 1, text: "Buy milk"},
  {id: 2, text: "Alice's task", author: "alice"}
]

// Alice reads server after Bob's overwrite:
freshFromServer = [
  {id: 1, text: "Buy milk"}, 
  {id: 3, text: "Bob's task", author: "bob"}
  // Missing: {id: 2, text: "Alice's task"} 🚨
]

// mergeReadWithCache detects missing data:
mergeReadWithCache: (freshData, cachedData) => {
  const freshIds = new Set(freshData.map(item => item.id))
  const missingFromServer = cachedData.filter(item => !freshIds.has(item.id))
  
  // Restore Alice's lost task from cache
  return [...freshData, ...missingFromServer]
  // Result: [{id: 1}, {id: 3}, {id: 2}] - Alice's task restored!
}`,
      points: [
        explanation('Compares server data with local cache to detect missing items'),
        syntax('Set operations', 'efficient way to find missing IDs between datasets'),
        whenToUse('when reads might return incomplete data due to race conditions'),
        performance('Cache acts as backup to recover lost data'),
        evidence('Assumes cache is more complete than server data in race scenarios')
      ]
    }),
    solution({
      code: `// DETECTION 2: reCheckRefine - Verifying write success

// After Alice's refine operation:
aliceStamp = "alice:1703123450000"
aliceExpectedContent = [{id: 1}, {id: 2, text: "Alice's task"}]

// reCheckRefine verifies the write succeeded:
reCheckRefine: ({stamp}, content) => {
  // Read current server file to check stamp presence  
  const currentFile = await readFile(url)
  
  if (!currentFile.stamps.includes(stamp)) {
    // Alice's stamp is MISSING = her write was overwritten!
    console.warn(\`Write verification failed for \${stamp}\`)
    console.warn("My refine operation was lost in a race condition")
    
    // Could trigger recovery mechanisms here:
    // - Retry the refine operation
    // - Merge lost changes back into current data
    // - Notify user of conflict
    
    return false  // Indicates write was lost
  }
  
  // If stamp exists, content MUST exist (atomic writes)
  return true  // Write was successful and persisted
}`,
      points: [
        explanation('Verifies that a refine operation actually persisted by checking for timestamp'),
        syntax('stamp format', 'userId:timestamp uniquely identifies each write operation'),
        syntax('atomic writes', 'stamp and content always written together'),
        whenToUse('after refine operations to ensure data persistence'),
        performance('Quick verification prevents silent data loss')
      ]
    })
  )
})

Doclet('preventingRaceConditions', {
  impl: exercise(
    problem({
      statement: 'What strategies can prevent or minimize refine race conditions?',
      intro: 'Several approaches can reduce race condition frequency: faster operations, conflict retry mechanisms, operational transforms, and architectural patterns.'
    }),
    solution({
      code: `// STRATEGY 1: Minimize read-to-write time

// ❌ SLOW: Multiple operations between read and write increase race window
const todos = await dataStore.get(userId, roomId)  
await validateTask(newTask)          // Network call
await checkPermissions(userId)       // Database query  
await logActivity(userId, 'add')     // Another network call
await dataStore.refine(userId, roomId, todos => [...todos, newTask])  // STALE!

// ✅ FAST: Prepare everything before reading
await validateTask(newTask)          // Pre-validate
await checkPermissions(userId)       // Pre-authorize  
await logActivity(userId, 'add')     // Pre-log
await dataStore.refine(userId, roomId, todos => [...todos, newTask])  // Fresh!`,
      points: [
        explanation('Shorter time between read and write reduces race condition probability'),
        performance('Each millisecond of delay increases collision risk exponentially'),
        syntax('prepare-then-refine pattern', 'do expensive operations before reading data'),
        whenToUse('when refine operations involve expensive computations or network calls'),
        evidence('Race probability = update_frequency × read_to_write_time')
      ]
    }),
    solution({
      code: `// STRATEGY 2: Automatic retry with backoff

async function safeRefine(dataStore, userId, roomId, updateFunction, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await dataStore.refine(userId, roomId, updateFunction)
      
      // Verify the write succeeded
      if (await verifyRefineSuccess(userId, roomId)) {
        return result  // Success!
      }
    } catch (error) {
      if (attempt === maxRetries) throw error
    }
    
    // Exponential backoff before retry
    const delay = Math.min(100 * Math.pow(2, attempt), 1000)
    await sleep(delay + Math.random() * 100)  // Add jitter
  }
  
  throw new Error('Refine failed after maximum retries')
}`,
      points: [
        explanation('Automatic retries with exponential backoff handle most race conditions'),
        syntax('exponential backoff', 'delay increases: 100ms, 200ms, 400ms, 800ms'),
        syntax('jitter', 'random delay prevents thundering herd of simultaneous retries'),
        performance('Most race conditions resolve within 2-3 retries'),
        whenToUse('when temporary conflicts are acceptable and eventual consistency is sufficient')
      ]
    }),
    solution({
      code: `// STRATEGY 3: Conflict-free data structures (when possible)

// ❌ CONFLICT-PRONE: Position-dependent operations
await todos.refine(userId, roomId, todos => {
  todos.splice(2, 1)  // Delete item at position 2 - conflicts with insertions!
  return todos
})

// ✅ CONFLICT-FREE: ID-based operations  
await todos.refine(userId, roomId, todos => {
  return todos.filter(item => item.id !== targetId)  // Delete by ID - no position conflicts
})

// ✅ CONFLICT-FREE: Append-only operations
await todos.refine(userId, roomId, todos => {
  return [...todos, newItem]  // Append never conflicts with other appends
})

// ✅ CONFLICT-FREE: Commutative operations
await counters.refine(userId, roomId, counters => {
  return {...counters, likes: (counters.likes || 0) + 1}  // Addition is commutative
})`,
      points: [
        explanation('Some operations are naturally conflict-free and can execute in any order'),
        syntax('append-only', 'adding new items never conflicts with other additions'),
        syntax('commutative operations', 'order doesn\'t matter: A+B = B+A'),
        syntax('ID-based operations', 'avoid position-dependent array modifications'),
        performance('Conflict-free operations eliminate race conditions entirely')
      ]
    })
  )
})

Doclet('architecturalSolutions', {
  impl: exercise(
    problem({
      statement: 'What architectural patterns can eliminate refine race conditions entirely?',
      intro: 'Advanced solutions include operational transforms, event sourcing, and command queuing that provide stronger consistency guarantees.'
    }),
    solution({
      code: `// SOLUTION 1: Individual user ownership

// ❌ SHARED: Multiple users writing to same file (race conditions)
const sharedTodos = dataStore('shared-todos', {
  writeAccess: 'multiUser',    // Alice and Bob both write here - conflicts!
  readVisibility: 'roomMembers'
})

// ✅ INDIVIDUAL: Each user owns their data (no conflicts)  
const aliceTodos = dataStore('user-todos', {
  writeAccess: 'singleUser',   // Only Alice writes here - no conflicts!
  readVisibility: 'private'
})

const bobTodos = dataStore('user-todos', {  
  writeAccess: 'singleUser',   // Only Bob writes here - no conflicts!
  readVisibility: 'private'
})

// Merge view for display:
const allTodos = [...aliceTodos.get(), ...bobTodos.get()]`,
      points: [
        explanation('Individual ownership eliminates write conflicts by design'),
        syntax('writeAccess: singleUser', 'only one user can write to this data store'),
        performance('Zero race conditions when each user owns their data'),
        comparison('shared mutable state', { advantage: 'conflict-free by construction' }),
        whenToUse('when data can be partitioned by user ownership')
      ]
    }),
    solution({
      code: `// SOLUTION 2: Event sourcing with append-only log

// ❌ MUTABLE STATE: Direct updates cause conflicts
await todos.refine(userId, roomId, todos => {
  todos[2].completed = true  // Mutates existing state - conflicts!
  return todos
})

// ✅ EVENT LOG: Append events, rebuild state
await eventLog.append(userId, roomId, {
  type: 'TASK_COMPLETED',
  taskId: 'task-123', 
  userId: 'alice',
  timestamp: Date.now()
})

// Rebuild current state from events:
const currentTodos = eventLog.getEvents().reduce((state, event) => {
  switch (event.type) {
    case 'TASK_ADDED': return [...state, event.task]
    case 'TASK_COMPLETED': return state.map(t => 
      t.id === event.taskId ? {...t, completed: true} : t
    )
    default: return state
  }
}, [])`,
      points: [
        explanation('Event sourcing makes all operations append-only and conflict-free'),
        syntax('append-only log', 'events are immutable once written'),
        syntax('state reconstruction', 'current state derived from event history'),
        performance('Appends never conflict - natural conflict resolution'),
        whenToUse('when you need full audit trail and conflict-free operations')
      ]
    }),
    solution({
      code: `// SOLUTION 3: Operational Transform (advanced)

// When Alice and Bob make concurrent edits:
aliceOp = {type: 'INSERT', position: 5, text: 'Alice'}
bobOp = {type: 'INSERT', position: 3, text: 'Bob'}

// Transform operations to work together:
function transform(op1, op2) {
  if (op1.type === 'INSERT' && op2.type === 'INSERT') {
    if (op1.position <= op2.position) {
      // Alice's insert affects Bob's position
      return {...op2, position: op2.position + op1.text.length}
    }
  }
  return op2
}

// Apply both operations in correct order:
const transformedBobOp = transform(aliceOp, bobOp)
// Result: Both Alice and Bob's changes preserved without conflicts`,
      points: [
        explanation('Operational Transform automatically merges concurrent operations'),
        syntax('transform function', 'adjusts operations to work together'),
        performance('Enables real-time collaborative editing like Google Docs'),
        whenToUse('when you need real-time collaboration with automatic conflict resolution'),
        evidence('Used by Google Docs, Figma, and other collaborative editors')
      ]
    })
  )
})

Doclet('commonMistakes', {
  impl: exercise(
    problem({
      statement: 'What are common misconceptions about refine race conditions?',
      intro: 'Developers often misunderstand the timing, scope, and solutions for race conditions in optimistic concurrency systems.'
    }),
    doNot(`// ❌ MISCONCEPTION: "Refine is atomic, so no race conditions"
await todos.refine(userId, roomId, todos => {
  // This function executes atomically, but the READ happened earlier!
  return [...todos, newTask]  // Risk: 'todos' might be stale data
})`, {
      reason: 'The update function is atomic, but it operates on data that was read earlier'
    }),
    doNot(`// ❌ MISCONCEPTION: "Add delays to prevent races"  
await todos.refine(userId, roomId, todos => {
  await sleep(Math.random() * 1000)  // ❌ Makes race window BIGGER!
  return [...todos, newTask]
})`, {
      reason: 'Delays increase the race window and make conflicts MORE likely, not less'
    }),
    doNot(`// ❌ MISCONCEPTION: "Locks will solve this"
await acquireLock('todos-lock')
const todos = await dataStore.get(userId, roomId)
todos.push(newTask)
await dataStore.put(userId, roomId, todos)  
await releaseLock('todos-lock')`, {
      reason: 'Distributed locks are complex, error-prone, and hurt performance'
    }),
    solution({
      code: `// ✅ CORRECT UNDERSTANDING: Race window is read-to-write time

// Race condition timing:
const readTime = Date.now()
const todos = await dataStore.get(userId, roomId)        // T1: Read data
// ... other operations happen here ...                   // T2-T5: Race window!
await dataStore.refine(userId, roomId, todos => {        // T6: Write data
  return [...todos, newTask]  // Uses data from T1, might be stale
})

// The race window is T1 to T6, not just the refine operation itself`,
      points: [
        explanation('Race conditions happen between read and write, not during the atomic write'),
        syntax('race window', 'time between reading data and writing updated data'),
        performance('Minimizing race window is key to reducing conflict probability'),
        evidence('Zero race window = zero conflicts (immediate read-modify-write)')
      ]
    }),
    bestPractice({
      suboptimalCode: 'Adding artificial delays or complex locking mechanisms',
      better: 'Using conflict-free operations and automatic retry with backoff',
      reason: 'Simple solutions are more reliable and performant than complex synchronization'
    }),
    mechanismUnderTheHood({
      snippet: `// How refine actually works internally:
async function refine(userId, roomId, updateFunction) {
  const response = await fetch(url)                    // 1. Read current state
  const data = await response.json()                  // 2. Parse data
  const newContent = updateFunction(data.content)     // 3. Apply changes 
  const stamp = \`\${userId}:\${Date.now()}\`          // 4. Create timestamp
  const newData = {                                   // 5. Build new file
    content: newContent,
    stamps: [...data.stamps, stamp]
  }
  await fetch(url, {method: 'PUT', body: JSON.stringify(newData)})  // 6. Write atomically
}

// Race conditions happen if another refine executes between steps 1 and 6`,
      explain: 'Understanding the internal timing helps identify where race conditions can occur'
    })
  )
})


Doclet('dataStructuresAndIdBasedRecovery', {
  impl: exercise(
    problem({
      statement: 'How do data structures (appendOnly vs randomAccess) and unique IDs affect race condition recovery?',
      intro: 'With unique IDs available, we can implement sophisticated conflict resolution that preserves all user contributions regardless of data structure type.'
    }),
    solution({
      code: `// DATA STRUCTURE TYPES in social-db:

// APPEND-ONLY: New items added to end, existing items never modified
const chatMessages = dataStore('messages', {
  dataStructure: 'appendOnly',     // Only append operations allowed
  writeAccess: 'multiUser'
})

// RANDOM-ACCESS: Items can be added, modified, or deleted anywhere  
const todoList = dataStore('todos', {
  dataStructure: 'randomAccess',   // Full CRUD operations allowed
  writeAccess: 'multiUser'
})

// UNIQUE IDs: Every item has a unique identifier
const messageWithId = {
  id: 'msg_1703123456789_alice_001',  // Unique across all users and time
  content: 'Hello everyone!',
  author: 'alice',
  timestamp: 1703123456789
}

const todoWithId = {
  id: 'todo_1703123456789_bob_001',   // Unique across all users and time  
  text: 'Buy groceries',
  completed: false,
  author: 'bob',
  createdAt: 1703123456789
}`,
      points: [
        explanation('Data structure type determines what operations are allowed and how conflicts are handled'),
        syntax('appendOnly', 'items are immutable once created - only appends allowed'),
        syntax('randomAccess', 'items can be created, updated, or deleted at any position'),
        syntax('unique IDs', 'every item has globally unique identifier across users and time'),
        performance('unique IDs enable precise conflict detection and resolution')
      ]
    }),
    solution({
      code: `// APPEND-ONLY RACE CONDITION RECOVERY:

// Race scenario - both users append simultaneously:
// Alice adds: {id: 'msg_alice_001', content: 'Alice message'}
// Bob adds: {id: 'msg_bob_001', content: 'Bob message'}

mergeReadWithCache: (freshData, cachedData) => {
  // For append-only: merge by unique ID, preserve all items
  const allItems = [...(cachedData || []), ...freshData]
  
  // Deduplicate by ID (in case of duplicates)
  const uniqueItems = allItems.reduce((acc, item) => {
    if (!acc.find(existing => existing.id === item.id)) {
      acc.push(item)
    }
    return acc
  }, [])
  
  // Sort by timestamp to maintain chronological order
  return uniqueItems.sort((a, b) => a.timestamp - b.timestamp)
}

// Result: Both Alice's and Bob's messages preserved in chronological order`,
      points: [
        explanation('Append-only structures can merge by combining all unique items'),
        syntax('ID-based deduplication', 'prevents duplicate items when merging caches'),
        syntax('timestamp sorting', 'maintains chronological order for messages/events'),
        performance('Append-only recovery is simple - just combine and deduplicate'),
        evidence('No items are ever lost - all contributions preserved')
      ]
    }),
    solution({
      code: `// RANDOM-ACCESS RACE CONDITION RECOVERY:

// Race scenario - users modify same todo list:
// Alice adds: {id: 'todo_alice_001', text: 'Alice task'}
// Bob adds: {id: 'todo_bob_001', text: 'Bob task'}  
// Bob modifies: {id: 'todo_existing_123', completed: true}

mergeReadWithCache: (freshData, cachedData) => {
  // Start with fresh data as base
  const mergedItems = [...freshData]
  const freshIds = new Set(freshData.map(item => item.id))
  
  // Add missing items from cache (lost due to race)
  for (const cachedItem of cachedData || []) {
    if (!freshIds.has(cachedItem.id)) {
      mergedItems.push(cachedItem)  // Restore lost item
    }
  }
  
  // For conflicts on same ID, prefer most recent timestamp
  const itemsByID = {}
  for (const item of mergedItems) {
    if (!itemsByID[item.id] || item.modifiedAt > itemsByID[item.id].modifiedAt) {
      itemsByID[item.id] = item
    }
  }
  
  return Object.values(itemsByID).sort((a, b) => a.createdAt - b.createdAt)
}`,
      points: [
        explanation('Random-access structures merge by ID, resolving conflicts by timestamp'),
        syntax('conflict resolution', 'when same ID exists multiple times, newest wins'),
        syntax('lost item recovery', 'items missing from fresh data restored from cache'),
        performance('ID-based merging preserves all user contributions'),
        whenToUse('when items can be modified after creation')
      ]
    }),
    solution({
      code: `// INTELLIGENT CONFLICT RESOLUTION WITH IDs:

reCheckRefine: ({stamp}, content) => {
  // Read current server state
  const serverFile = await readFile(url)
  
  if (!serverFile.stamps.includes(stamp)) {
    // My stamp is missing - write was overwritten
    console.warn('Write lost in race condition, attempting recovery...')
    
    // Extract my changes from the stamp
    const [userId, timestamp] = stamp.split(':')
    
    // Find what I was trying to add/modify (stored in local operation log)
    const myOperation = getOperationByStamp(stamp)
    
    // Apply intelligent merge based on operation type:
    switch (myOperation.type) {
      case 'ADD_ITEM':
        // For adds: just append if ID doesn't exist
        if (!content.find(item => item.id === myOperation.item.id)) {
          await refineFile(url, items => [...items, myOperation.item])
        }
        break
        
      case 'UPDATE_ITEM':
        // For updates: apply if our timestamp is newer
        const existingItem = content.find(item => item.id === myOperation.item.id)
        if (!existingItem || myOperation.item.modifiedAt > existingItem.modifiedAt) {
          await refineFile(url, items => 
            items.map(item => 
              item.id === myOperation.item.id ? myOperation.item : item
            )
          )
        }
        break
        
      case 'DELETE_ITEM':
        // For deletes: remove if item still exists
        if (content.find(item => item.id === myOperation.targetId)) {
          await refineFile(url, items => 
            items.filter(item => item.id !== myOperation.targetId)
          )
        }
        break
    }
    
    return true  // Recovery attempted
  }
  
  return true  // No recovery needed
}`,
      points: [
        explanation('With unique IDs, lost operations can be precisely replayed'),
        syntax('operation log', 'track what each stamp was trying to accomplish'),
        syntax('timestamp-based conflicts', 'newer modifications win when IDs collide'),
        syntax('type-specific recovery', 'different strategies for add/update/delete'),
        performance('Surgical recovery - only replay the lost operation, not entire state')
      ]
    })
  )
})

Doclet('idGenerationStrategies', {
  impl: exercise(
    problem({
      statement: 'How should unique IDs be generated to enable effective conflict resolution?',
      intro: 'ID generation strategy affects conflict detection, ordering, and debugging. Different patterns work better for different data structures.'
    }),
    solution({
      code: `// APPEND-ONLY ID STRATEGY: Timestamp + User + Sequence

function generateAppendOnlyId(userId, sequenceCounter = 0) {
  const timestamp = Date.now()
  const sequence = sequenceCounter.toString().padStart(3, '0')
  return \`\${timestamp}_\${userId}_\${sequence}\`
}

// Examples:
// "1703123456789_alice_001"  - Alice's first item at this millisecond
// "1703123456789_alice_002"  - Alice's second item at same millisecond  
// "1703123456790_bob_001"    - Bob's item 1ms later

// Benefits for append-only:
// - Natural chronological ordering
// - No collisions between users
// - Sequence handles same-millisecond operations
// - Human-readable for debugging`,
      points: [
        explanation('Timestamp-based IDs provide natural chronological ordering for append-only data'),
        syntax('timestamp_user_sequence', 'format ensures uniqueness and sortability'),
        performance('Lexicographic sorting matches chronological ordering'),
        whenToUse('for messages, events, logs, and other append-only data'),
        evidence('Timestamp prefix enables efficient range queries and pagination')
      ]
    }),
    solution({
      code: `// RANDOM-ACCESS ID STRATEGY: UUID with metadata

function generateRandomAccessId(userId, itemType) {
  const uuid = crypto.randomUUID()  // Globally unique
  const timestamp = Date.now()
  return \`\${itemType}_\${timestamp}_\${userId}_\${uuid.substring(0, 8)}\`
}

// Examples:
// "todo_1703123456789_alice_a1b2c3d4"     - Alice's todo item
// "user_1703123456789_bob_e5f6g7h8"       - Bob's user profile
// "comment_1703123456789_charlie_i9j0k1l2" - Charlie's comment

// Benefits for random-access:
// - Type prefix for debugging and filtering
// - Timestamp for conflict resolution
// - User ID for ownership tracking  
// - UUID suffix prevents all collisions
// - Self-describing and debuggable`,
      points: [
        explanation('UUID-based IDs prevent all possible collisions while remaining human-readable'),
        syntax('type_timestamp_user_uuid', 'format includes metadata for debugging'),
        syntax('UUID collision probability', 'effectively zero for practical purposes'),
        performance('Self-contained metadata reduces need for additional lookups'),
        whenToUse('for todos, documents, user profiles, and other mutable data')
      ]
    }),
    solution({
      code: `// CONFLICT RESOLUTION WITH SMART IDs:

// ID contains timestamp - enables automatic conflict resolution
function resolveConflictByTimestamp(item1, item2) {
  // Extract timestamps from IDs
  const timestamp1 = parseInt(item1.id.split('_')[1])
  const timestamp2 = parseInt(item2.id.split('_')[1])
  
  // Newer timestamp wins
  return timestamp1 > timestamp2 ? item1 : item2
}

// ID contains user - enables per-user ownership  
function getItemOwner(item) {
  return item.id.split('_')[2]  // Extract user from ID
}

// ID contains type - enables type-specific handling
function getItemType(item) {
  return item.id.split('_')[0]  // Extract type from ID
}

// Smart merging using ID metadata:
mergeReadWithCache: (freshData, cachedData) => {
  const allItems = [...freshData, ...(cachedData || [])]
  const itemsByID = {}
  
  for (const item of allItems) {
    const existingItem = itemsByID[item.id]
    if (!existingItem) {
      itemsByID[item.id] = item
    } else {
      // Use timestamp from ID to resolve conflicts
      itemsByID[item.id] = resolveConflictByTimestamp(item, existingItem)
    }
  }
  
  return Object.values(itemsByID)
}`,
      points: [
        explanation('Smart ID format enables automatic conflict resolution using embedded metadata'),
        syntax('ID parsing', 'extract timestamp, user, and type from structured ID'),
        syntax('timestamp conflicts', 'newer timestamp wins when same ID appears multiple times'),
        performance('No additional database lookups needed - metadata is in the ID'),
        evidence('Self-contained conflict resolution reduces system complexity')
      ]
    })
  )
})

Doclet('practicalRecoveryPatterns', {
  impl: exercise(
    problem({
      statement: 'What are the complete recovery patterns for real-world applications with unique IDs?',
      intro: 'Combining data structure awareness with unique IDs enables robust recovery patterns that preserve all user work.'
    }),
    solution({
      code: `// CHAT APPLICATION RECOVERY (append-only):

const chatRoom = dataStore('messages', {
  dataStructure: 'appendOnly',
  writeAccess: 'multiUser',
  collaborativeWrite: multiUserDistributed({
    mergeReadWithCache: (freshMessages, cachedMessages) => {
      // Merge all messages by ID
      const allMessages = [...(cachedMessages || []), ...freshMessages]
      const uniqueMessages = new Map()
      
      for (const msg of allMessages) {
        if (!uniqueMessages.has(msg.id)) {
          uniqueMessages.set(msg.id, msg)
        }
      }
      
      // Sort chronologically by timestamp from ID
      return Array.from(uniqueMessages.values())
        .sort((a, b) => {
          const timeA = parseInt(a.id.split('_')[0])
          const timeB = parseInt(b.id.split('_')[0])
          return timeA - timeB
        })
    },
    
    reCheckRefine: async ({stamp}, content) => {
      const serverFile = await readFile(url)
      if (!serverFile.stamps.includes(stamp)) {
        // Recover lost message
        const lostMessage = getMessageByStamp(stamp)
        if (lostMessage && !content.find(m => m.id === lostMessage.id)) {
          await refineFile(url, messages => [...messages, lostMessage])
        }
      }
      return true
    }
  })
})`,
      points: [
        explanation('Chat recovery preserves all messages and maintains chronological order'),
        syntax('Map deduplication', 'efficient way to remove duplicate messages by ID'),
        syntax('timestamp extraction', 'sort order derived from ID timestamp'),
        performance('Lost messages are simply appended back - no complex merging needed'),
        evidence('Append-only structure makes recovery straightforward')
      ]
    }),
    solution({
      code: `// TODO APPLICATION RECOVERY (random-access):

const todoList = dataStore('todos', {
  dataStructure: 'randomAccess', 
  writeAccess: 'multiUser',
  collaborativeWrite: multiUserDistributed({
    mergeReadWithCache: (freshTodos, cachedTodos) => {
      const allTodos = [...freshTodos, ...(cachedTodos || [])]
      const todosByID = new Map()
      
      for (const todo of allTodos) {
        const existing = todosByID.get(todo.id)
        if (!existing || todo.modifiedAt > existing.modifiedAt) {
          todosByID.set(todo.id, todo)  // Newer version wins
        }
      }
      
      return Array.from(todosByID.values())
        .sort((a, b) => a.createdAt - b.createdAt)
    },
    
    reCheckRefine: async ({stamp}, content) => {
      const serverFile = await readFile(url)
      if (!serverFile.stamps.includes(stamp)) {
        const lostOperation = getOperationByStamp(stamp)
        
        switch (lostOperation.type) {
          case 'ADD_TODO':
            if (!content.find(t => t.id === lostOperation.todo.id)) {
              await refineFile(url, todos => [...todos, lostOperation.todo])
            }
            break
            
          case 'UPDATE_TODO':
            const existing = content.find(t => t.id === lostOperation.todo.id)
            if (!existing || lostOperation.todo.modifiedAt > existing.modifiedAt) {
              await refineFile(url, todos => 
                todos.map(t => t.id === lostOperation.todo.id ? lostOperation.todo : t)
              )
            }
            break
            
          case 'DELETE_TODO':
            await refineFile(url, todos => 
              todos.filter(t => t.id !== lostOperation.targetId)
            )
            break
        }
      }
      return true
    }
  })
})`,
      points: [
        explanation('Todo recovery handles add/update/delete operations with timestamp-based conflict resolution'),
        syntax('operation replay', 'lost operations are precisely replayed based on type'),
        syntax('timestamp comparison', 'newer modifications win when same item modified'),
        performance('Surgical recovery - only the lost operation is replayed'),
        whenToUse('for any mutable data where items can be created, updated, or deleted')
      ]
    }),
    mechanismUnderTheHood({
      snippet: `// Operation logging for precise recovery:
const operationLog = new Map()  // stamp -> operation

function logOperation(stamp, operation) {
  operationLog.set(stamp, {
    stamp,
    type: operation.type,        // 'ADD_ITEM', 'UPDATE_ITEM', 'DELETE_ITEM'
    item: operation.item,        // The item being modified
    targetId: operation.targetId, // For deletes
    timestamp: Date.now()
  })
}

// When refine is called:
const stamp = \`\${userId}:\${Date.now()}\`
logOperation(stamp, {type: 'ADD_ITEM', item: newTodo})
await dataStore.refine(userId, roomId, todos => [...todos, newTodo])

// Recovery can precisely replay the lost operation:
const lostOp = operationLog.get(lostStamp)
// Apply exactly what was lost, nothing more`,
      explain: 'Operation logging enables surgical recovery - only the lost operation is replayed, not entire state reconstruction'
    })
  )
})
