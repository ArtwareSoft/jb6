import { dsls } from '@jb6/core'
import '@jb6/common'
import '@jb6/testing'
import '@jb6/llm-guide'

const { 
  tgp: { Const, var: { Var } }, 
  common: { data: { pipeline, filter, count, join, toUpperCase } },
  'llm-guide': { Doclet,
    'llm-guide': { exercise, principle },
    guidance: { solution, doNot, bestPractice, mechanismUnderTheHood }, 
    explanationPoint: { whenToUse, performance, comparison, syntax, explanation, evidence, impact },
    problemStatement: { problem }
  } 
} = dsls

// Sample data for examples
Const('sampleUsers', [
  {userId: 'alice', name: 'Alice', rooms: ['room1', 'room2']},
  {userId: 'bob', name: 'Bob', rooms: ['room1', 'room3']},
  {userId: 'charlie', name: 'Charlie', rooms: ['room2']}
])

Const('sampleRooms', [
  {roomId: 'room1', name: 'Project Alpha', participants: ['alice', 'bob']},
  {roomId: 'room2', name: 'Design Team', participants: ['alice', 'charlie']},
  {roomId: 'room3', name: 'Engineering', participants: ['bob']}
])

Const('contentTypeScopes', [
  {scope: 'room', description: 'Shared by all room participants', example: 'chat messages'},
  {scope: 'userPerRoom', description: 'User private data within specific room', example: 'private notes'},
  {scope: 'userGlobal', description: 'User private data across all rooms', example: 'user settings'},
  {scope: 'userPublish', description: 'User public profile data', example: 'profile info'},
  {scope: 'wonderPublish', description: 'Platform-wide shared data', example: 'movies database'},
  {scope: 'userPublishToWonder', description: 'User publishing to platform (encrypted)', example: 'shared vectors'}
])

Doclet('understandingDataStores', {
  impl: exercise(
    problem('What are DataStores in the social-db DSL and how do they enable distributed collaborative storage?'),
    solution({
      code: `// DataStore is a TGP component for distributed collaborative storage
// Think of it as a "smart file" that knows:
// 1. WHERE to store data (scope-based routing via readVisibility)
// 2. HOW to handle conflicts (via collaborativeWrite strategies)  
// 3. HOW to cache data (based on activity patterns)
// 4. HOW to enable real-time collaboration (activity detection)

const { dataStore } = dsls['social-db']['data-store']

// Examples of different data stores:
const chatMessages = dataStore('messages', {
  dataStructure: 'appendOnly',        // Only append operations allowed
  readVisibility: 'roomMembers',     // Shared by all room participants
  collaborativeWrite: multiUserDistributed()  // Advanced race condition handling
})

const privateNotes = dataStore('notes', {
  dataStructure: 'randomAccess',      // Full CRUD operations allowed
  readVisibility: 'private',          // Private to user within room context
  collaborativeWrite: singleUser()    // No collaboration needed
})

const userSettings = dataStore('settings', {
  dataStructure: 'randomAccess',      // Can be updated
  readVisibility: 'private',          // Private across all rooms (userGlobal scope)
  collaborativeWrite: singleUser()    // User-only access
})`,
      points: [
        explanation('DataStore abstracts distributed file storage with scope-aware routing and collaboration'),
        syntax('dataStructure parameter', 'appendOnly vs randomAccess determines allowed operations'),
        syntax('readVisibility parameter', 'determines storage location and access scope'),
        syntax('collaborativeWrite parameter', 'determines conflict resolution strategy'),
        whenToUse('when building collaborative applications that need typed, scoped data access'),
        performance('eliminates need to manually compute storage paths and handle conflicts')
      ]
    }),
    solution({
      code: `// The key insight: User + Room context determines everything
// USER (userId): Who is accessing the data - identity and permissions
// ROOM (roomId): Collaborative workspace - shared context and participants

// Storage location computed as:
// readVisibility + writeAccess + userId + roomId + fileName = unique storage path

// Examples of computed paths based on readVisibility:
// 'roomMembers': /rooms/room1/messages.json (shared by all in room1)
// 'private' with multiUser: /users/alice/room1-notes.json (alice's private notes in room1)  
// 'private' with singleUser: /users/alice/settings.json (alice's global settings)
// 'world': /usersPub/alice/profile.json (alice's public profile)`,
      points: [
        explanation('User + Room context provides the coordinate system for all data access'),
        syntax('readVisibility + writeAccess formula', 'determines storage location computation'),
        comparison('traditional databases', { advantage: 'eliminates complex permission systems via scope-based routing' }),
        performance('path computation enables distributed storage without central coordination')
      ]
    })
  )
})

Doclet('dataStructureAndVisibilityScopes', {
  impl: exercise(
    problem('Understanding dataStructure and readVisibility - the two key parameters that control DataStore behavior'),
    solution({
      code: `// TWO KEY DATASTORE PARAMETERS control behavior:

// 1. DATA STRUCTURE - What operations are allowed
const chatMessages = dataStore('messages', { 
  dataStructure: 'appendOnly'        // Only append operations allowed
})
// Operations: get(), appendItem(), sendMessage()
// Use case: Chat messages, event logs, audit trails

const todoList = dataStore('todos', { 
  dataStructure: 'randomAccess'      // Full CRUD operations allowed
})  
// Operations: get(), put(), refine(), appendItem()
// Use case: Todo lists, documents, user profiles, any mutable data

// 2. READ VISIBILITY - Who can access and where it's stored
const sharedChat = dataStore('room', {
  readVisibility: 'roomMembers'      // All room participants can access
})
// Path: /rooms/room1/room.json
// Access: All participants in room1 can read/write

const privateNotes = dataStore('notes', {
  readVisibility: 'private'          // Private to user (scope depends on writeAccess)
})
// Path: /users/alice/room1-notes.json (if multiUser writeAccess)
// Path: /users/alice/notes.json (if singleUser writeAccess)
// Access: Only alice can access`,
      points: [
        explanation('DataStructure and readVisibility are the two core parameters that define DataStore behavior'),
        syntax('appendOnly', 'immutable items - only append operations allowed'),
        syntax('randomAccess', 'mutable items - full CRUD operations allowed'),
        syntax('roomMembers', 'shared storage accessible by room participants'),
        syntax('private', 'user-private storage, scope determined by writeAccess'),
        whenToUse('appendOnly for immutable data, randomAccess for mutable data')
      ]
    }),
    solution({
      code: `// ADDITIONAL READ VISIBILITY OPTIONS:

const userProfile = dataStore('profile', {
  readVisibility: 'world'            // Public data readable by anyone
})
// Path: /usersPub/alice/profile.json  
// Access: Public - can be read by anyone
// Use case: User profiles, public achievements, bio info

const platformData = dataStore('movies', {
  readVisibility: 'world'            // Platform-maintained shared resources
})
// Path: /usersPub/wonder/movies.json
// Access: Platform-maintained, read by anyone  
// Use case: Reference data, catalogs, shared databases

// VISIBILITY + STRUCTURE COMBINATIONS:

// Append-only shared chat
const chatRoom = dataStore('messages', {
  dataStructure: 'appendOnly',
  readVisibility: 'roomMembers'
})

// Mutable private user data  
const userSettings = dataStore('preferences', {
  dataStructure: 'randomAccess',
  readVisibility: 'private'
})

// Public read-only reference data
const moviesCatalog = dataStore('movies-db', {
  dataStructure: 'randomAccess',     // Platform can update
  readVisibility: 'world'            // Users can read
})`,
      points: [
        explanation('Different visibility levels enable various collaboration patterns'),
        syntax('world visibility', 'public data readable by anyone'),
        syntax('platform data', 'shared resources maintained by the platform'),
        performance('visibility determines both storage location and access control'),
        comparison('traditional databases', { advantage: 'access control embedded in storage routing' })
      ]
    })
  )
})

Doclet('dataStoreOperations', {
  impl: exercise(
    problem('Understanding get, put, refine, and appendItem operations - how to interact with DataStore data'),
    solution({
      code: `// FOUR CORE OPERATIONS for DataStore data access:

const { get, put, refine, sendMessage } = dsls['social-db']['action']
const chatMessages = dataStore('messages', {
  dataStructure: 'appendOnly',
  readVisibility: 'roomMembers'
})

// 1. GET - Read data with smart caching
await get(chatMessages, userId, roomId)
// Returns: Current content or default value ([])
// Caching: Uses cache based on collaborative write strategy
// Use case: Reading current state, displaying data

// 2. PUT - Direct write, replace entire content  
await put(chatMessages, userId, roomId, [])
// Action: Completely replaces existing content
// Notification: Alerts other room participants via activity detection
// Use case: Setting initial data, complete resets

// 3. REFINE - Atomic update with conflict resolution
await refine(chatMessages, userId, roomId, (currentMessages) => {
  return [...currentMessages, newMessage]
})
// Action: Reads current, applies function, writes atomically
// Conflicts: Advanced race condition recovery with mergeReadWithCache
// Use case: Adding items, updating existing data safely

// 4. SEND MESSAGE - Append with structured messaging
await sendMessage(chatMessages, userId, roomId, 'Hello everyone!')
// Action: Creates structured message with id, timestamp, sender
// Structure: {id, time, sender, type, content}
// Use case: Chat messages, notifications, structured communication`,
      points: [
        explanation('Four operations provide complete CRUD functionality with advanced conflict handling'),
        syntax('get(dataStore, userId, roomId)', 'cached read operation'),
        syntax('put(dataStore, userId, roomId, content)', 'direct write replaces all content'),
        syntax('refine(dataStore, userId, roomId, updateFn)', 'atomic update with race condition recovery'),
        syntax('sendMessage(dataStore, userId, roomId, message)', 'structured messaging for communication'),
        whenToUse('get for reading, put for initialization, refine for safe updates, sendMessage for communication')
      ]
    }),
    solution({
      code: `// REFINE OPERATION - Advanced race condition handling
// Problem: Multiple users updating same data simultaneously
// Solution: Optimistic concurrency control with automatic recovery

await refine(chatMessages, userId, roomId, (messages) => {
  const newMessage = {
    id: \`\${Date.now()}_\${userId}_\${Math.random().toString(36).slice(2, 8)}\`,
    time: Date.now(), 
    sender: userId,
    content: 'Hello everyone!'
  }
  return [...messages, newMessage]  // Pure function - no side effects
})

// What happens internally with multiUserDistributed:
// 1. Read current messages + timestamp stamps
// 2. Apply update function to get new content
// 3. Write new content with new timestamp  
// 4. If race condition detected, use mergeReadWithCache to recover lost items
// 5. reCheckRefine verifies write success and attempts surgical recovery
// 6. Maximum 3 retries with exponential backoff before failing`,
      points: [
        explanation('Refine enables safe concurrent updates through advanced race condition recovery'),
        syntax('updateFunction', 'pure function that transforms current state to new state'),
        syntax('mergeReadWithCache', 'compares server data with cache to detect lost items'),
        syntax('reCheckRefine', 'verifies write success and attempts surgical recovery'),
        performance('automatic retry mechanism with exponential backoff handles conflicts gracefully'),
        comparison('simple retry', { advantage: 'sophisticated recovery preserves all user contributions' }),
        evidence('operation logging enables precise recovery of lost operations')
      ]
    })
  )
})

Doclet('collaborativeWriteStrategies', {
  impl: exercise(
    problem('Understanding collaborative write strategies - singleUser vs multiUserDistributed'),
    solution({
      code: `// TWO COLLABORATIVE WRITE STRATEGIES handle different use cases:

const { singleUser, multiUserDistributed } = dsls['social-db']['collaborative-write']

// 1. SINGLE USER - No collaboration needed
const userSettings = dataStore('preferences', {
  collaborativeWrite: singleUser(),
  readVisibility: 'private'
})
// Features: Simple caching, no conflict resolution, fast performance
// Use case: User preferences, private notes, single-user data

// 2. MULTI-USER DISTRIBUTED - Advanced collaboration
const chatMessages = dataStore('messages', {
  collaborativeWrite: multiUserDistributed({
    activityDetection: fileBased()  // Activity tracking system
  }),
  readVisibility: 'roomMembers'
})
// Features: Race condition recovery, activity detection, real-time collaboration
// Use case: Chat messages, shared documents, collaborative editing`,
      points: [
        explanation('Collaborative write strategy determines how conflicts and collaboration are handled'),
        syntax('singleUser()', 'simple strategy for user-only data with no collaboration'),
        syntax('multiUserDistributed()', 'advanced strategy with race condition recovery'),
        syntax('activityDetection', 'configures how user activity is tracked'),
        whenToUse('singleUser for private data, multiUserDistributed for shared collaborative data'),
        performance('singleUser is faster, multiUserDistributed provides safety for collaboration')
      ]
    }),
    solution({
      code: `// MULTI-USER DISTRIBUTED FEATURES:

const collaborativeData = dataStore('shared-todos', {
  collaborativeWrite: multiUserDistributed(),
  dataStructure: 'randomAccess',
  readVisibility: 'roomMembers'
})

// Advanced race condition recovery:
// 1. mergeReadWithCache - detects lost items by comparing server vs cache
// 2. reCheckRefine - verifies write success and attempts surgical recovery  
// 3. Operation logging - tracks what each operation was trying to accomplish
// 4. ID-based conflict resolution - newer timestamps win when items conflict

// Activity detection features:
// - isAlone() - detects if user is alone in room for caching optimization
// - subscribeToUpdates() - real-time notifications when others make changes
// - notifyInternalActivity() - broadcasts user actions to other participants

// What this enables:
// ✅ Lost updates are automatically recovered
// ✅ Real-time awareness of other users' activity  
// ✅ Optimized caching when working alone
// ✅ Precise conflict resolution with timestamp-based merging`,
      points: [
        explanation('MultiUserDistributed provides comprehensive collaboration features'),
        syntax('mergeReadWithCache', 'compares fresh server data with local cache'),
        syntax('reCheckRefine', 'verifies write operations succeeded'),
        syntax('operation logging', 'enables surgical recovery of specific lost operations'),
        syntax('activity detection', 'provides real-time awareness and presence information'),
        performance('sophisticated recovery ensures no user contributions are lost'),
        evidence('based on patterns from refine-race-problem-llm-guide.js')
      ]
    })
  )
}),

Doclet('raceConditionRecovery', {
  impl: exercise(
    problem('How does the social-db DSL handle race conditions when multiple users edit simultaneously?'),
    solution({
      code: `// RACE CONDITION SCENARIO:
// T1: Alice and Bob both read the same initial state: [{id: 1, text: "Buy milk"}]
// T2: Alice adds: {id: 2, text: "Alice's task"} 
// T3: Bob adds: {id: 3, text: "Bob's task"} using STALE data from T1
// T4: Bob's write overwrites Alice's changes completely!

// SOLUTION: multiUserDistributed automatically recovers lost data

const todoList = dataStore('todos', {
  collaborativeWrite: multiUserDistributed(),
  dataStructure: 'randomAccess'
})

// When Bob reads after his write, mergeReadWithCache detects the problem:
// freshDataFromServer: [{id: 1, text: "Buy milk"}, {id: 3, text: "Bob's task"}] 
// cachedDataLocal: [{id: 1, text: "Buy milk"}, {id: 2, text: "Alice's task"}]
// Missing from server: Alice's task with id: 2

// mergeReadWithCache automatically recovers:
mergeReadWithCache: (freshDataFromServer, cachedDataLocal) => {
  const freshIds = new Set(freshDataFromServer.map(item => item.id))
  const missingItems = cachedDataLocal.filter(item => !freshIds.has(item.id))
  return [...freshDataFromServer, ...missingItems]  // Alice's task restored!
}`,
      points: [
        explanation('Race conditions occur when multiple users modify data with stale reads'),
        syntax('mergeReadWithCache', 'compares server data with cache to detect lost items'),
        syntax('ID-based recovery', 'uses unique IDs to identify missing items'),
        performance('automatic recovery happens transparently during normal read operations'),
        evidence('preserves all user contributions even in race condition scenarios')
      ]
    }),
    solution({
      code: `// WRITE VERIFICATION AND SURGICAL RECOVERY:

// After every refine operation, reCheckRefine verifies success:
reCheckRefine: async ({stamp}, content, dataStoreArgs) => {
  const serverFile = await readServerFile(url)
  
  if (!serverFile.stamps.includes(stamp)) {
    // My stamp is missing - write was overwritten!
    console.warn('Race condition detected, attempting recovery...')
    
    const lostOperation = getOperationByStamp(stamp)
    
    switch (lostOperation.type) {
      case 'ADD_ITEM':
        // Re-add the lost item if it doesn't exist
        if (!content.find(item => item.id === lostOperation.item.id)) {
          await refineFile(url, items => [...items, lostOperation.item])
        }
        break
        
      case 'UPDATE_ITEM':  
        // Re-apply update if our timestamp is newer
        const existing = content.find(item => item.id === lostOperation.item.id)
        if (!existing || lostOperation.item.modifiedAt > existing.modifiedAt) {
          await refineFile(url, items => 
            items.map(item => item.id === lostOperation.item.id ? lostOperation.item : item)
          )
        }
        break
    }
  }
}`,
      points: [
        explanation('Write verification ensures refine operations actually persisted'),
        syntax('stamp verification', 'checks if operation timestamp exists in server file'),
        syntax('operation replay', 'precisely replays only the lost operation'),
        syntax('timestamp conflicts', 'newer modifications win when items have same ID'),
        performance('surgical recovery - only the specific lost operation is replayed'),
        comparison('full state recovery', { advantage: 'more efficient and precise than rebuilding entire state' })
      ]
    })
  )
})

Doclet('structuredMessaging', {
  impl: exercise(
    problem('How does the social-db DSL handle structured messaging and communication?'),
    solution({
      code: `// STRUCTURED MESSAGING with appendOnly DataStores

const { sendMessage } = dsls['social-db']['action']
const chatRoom = dataStore('messages', {
  dataStructure: 'appendOnly',        // Messages are immutable once created
  readVisibility: 'roomMembers',     // Shared by room participants
  collaborativeWrite: multiUserDistributed()  // Race condition protection
})

// Sending simple text messages:
await sendMessage(chatRoom, userId, roomId, 'Hello everyone!')

// Automatically creates structured message:
{
  id: '1703123456789_alice_a1b2c3d4',    // Unique timestamp-based ID
  time: 1703123456789,                   // Timestamp for ordering
  sender: 'alice',                       // Who sent the message  
  type: 'text',                          // Message type
  content: 'Hello everyone!'             // Actual message content
}

// Sending structured messages:
await sendMessage(chatRoom, userId, roomId, {
  type: 'image',
  content: 'https://example.com/image.jpg',
  caption: 'Check out this design!',
  metadata: { size: '1920x1080', format: 'jpeg' }
})`,
      points: [
        explanation('SendMessage creates structured communication with consistent format'),
        syntax('sendMessage(dataStore, userId, roomId, message)', 'append structured message'),
        syntax('message structure', 'standardized format with id, time, sender, type, content'),
        syntax('timestamp-based IDs', 'enable chronological ordering and conflict resolution'),
        whenToUse('for any communication features: chat, comments, notifications, activity feeds'),
        performance('structured format enables message ordering, threading, and rich content')
      ]
    }),
    solution({
      code: `// APPEND-ONLY vs GENERAL PURPOSE DataStores for messaging:

// Messaging-optimized (append-only):
const chatMessages = dataStore('room', { 
  dataStructure: 'appendOnly'       // Only append operations
})
await sendMessage(chatMessages, userId, roomId, 'Hello!')
// Optimized for: High-frequency messaging, immutable message history

// General-purpose (random access):
const roomItems = dataStore('items', { 
  dataStructure: 'randomAccess'     // Full CRUD operations
})
await refine(roomItems, userId, roomId, (items) => {
  return [...items, { name: 'New Item', category: 'tools', createdBy: userId }]
})
// Use for: Todo lists, documents, any data that needs updates/deletes

// Both get race condition protection with multiUserDistributed:
// ✅ Lost messages/items are automatically recovered
// ✅ Unique IDs prevent conflicts and enable precise merging
// ✅ Real-time activity detection for collaboration awareness`,
      points: [
        explanation('AppendOnly DataStores are optimized for messaging, randomAccess for general data'),
        syntax('appendOnly structure', 'immutable items - perfect for message history'),
        syntax('randomAccess structure', 'mutable items - good for documents and lists'),
        comparison('traditional messaging', { advantage: 'built-in race condition recovery and real-time collaboration' }),
        performance('appendOnly operations are simpler and faster than full CRUD'),
        evidence('both structures get the same collaborative features and safety guarantees')
      ]
    })
  )
})

Doclet('realTimeCollaboration', {
  impl: exercise(
    problem('How does the social-db DSL enable real-time awareness and collaboration?'),
    solution({
      code: `// REAL-TIME COLLABORATION through activity detection and subscriptions

const { subscribeToUpdates } = dsls['social-db']['action']
const chatMessages = dataStore('messages', {
  collaborativeWrite: multiUserDistributed({
    activityDetection: fileBased()  // File-based activity tracking
  })
})

// 1. ACTIVITY DETECTION - Know who's active when
// isAlone() - detects if user is working solo (5+ min since external activity)
const isUserAlone = await chatMessages.isAlone()
// Benefits: Better caching when solo, optimized polling frequency

// 2. PRESENCE DETECTION - Real-time awareness
// Internal activity: User's own actions (reading, writing, scrolling)
// External activity: Other users' actions detected via polling/notifications

// 3. SUBSCRIPTION SYSTEM - React to changes in real-time
await subscribeToUpdates(chatMessages, userId, roomId, (event) => {
  if (event.externalActivity) {
    console.log('Someone else made changes!')
    refreshChatUI()
  }
  if (event.internalActivity) {
    console.log('My action was processed')  
    updateActivityIndicator()
  }
}, { triggerNow: true })`,
      points: [
        explanation('Real-time collaboration built on activity detection and event subscription'),
        syntax('subscribeToUpdates()', 'register callbacks for room changes'),
        syntax('isAlone()', 'detect solo vs collaborative work modes for optimization'),
        syntax('activityDetection', 'configures how user activity is tracked and communicated'),
        performance('presence detection enables performance optimizations when working alone'),
        whenToUse('for live collaborative features like cursor tracking, live updates, presence indicators')
      ]
    }),
    solution({
      code: `// ACTIVITY DETECTION STRATEGIES:

// File-based activity detection (default):
const fileBasedChat = dataStore('messages', {
  collaborativeWrite: multiUserDistributed({
    activityDetection: fileBased({
      pollingStrategy: adaptive(),           // Smart polling that adapts to activity
      notificationMechanism: none(),        // No push notifications
      aloneTimeThreshold: 300000            // 5 minutes to be considered alone
    })
  })
})

// Push notification-based (for real-time apps):
const realTimeChat = dataStore('messages', {
  collaborativeWrite: multiUserDistributed({
    activityDetection: pushNotifications({
      serverUrl: 'https://notifications.example.com',
      fallbackToPolling: true              // Graceful degradation
    })
  })
})

// How activity detection works:
// - File-based: Uses individual activity files + aggregated summary
// - Adaptive polling: 1s when active, 10s when alone, stops after 30min idle
// - Push notifications: WebSocket/SSE for instant notifications
// - Graceful fallback: Push notifications fall back to polling if needed`,
      points: [
        explanation('Different activity detection strategies balance real-time performance with infrastructure complexity'),
        syntax('fileBased()', 'uses file system for activity coordination - works with static hosting'),
        syntax('pushNotifications()', 'uses WebSocket/SSE for instant notifications'),
        syntax('adaptive polling', 'adjusts frequency based on activity level for efficiency'),
        performance('file-based works anywhere, push notifications provide better real-time experience'),
        comparison('WebSocket connections', { advantage: 'file-based works with static file hosting, no persistent connections needed' })
      ]
    })
  )
})

Doclet('distributedStorageArchitecture', {
  impl: exercise(
    problem('How does ContentType implement a distributed database using files and URLs?'),
    solution({
      code: `// DISTRIBUTED STORAGE via computed URLs and file abstraction

// URL COMPUTATION FORMULA:
// Storage Location = base + scope + userId + roomId + fileName + ".json"

function fullUrl(scope, userId, roomId, fileName) {
  const roomPath = \`/rooms/\${roomId}\`
  const userPath = \`/users/\${userId}\`
  const userPubPath = \`/usersPub/\${userId}\`
  
  switch(scope) {
    case 'room': return \`\${roomPath}/\${fileName}.json\`
    case 'userPerRoom': return \`\${userPath}/\${roomId}-\${fileName}.json\`  
    case 'userGlobal': return \`\${userPath}/\${fileName}.json\`
    case 'userPublish': return \`\${userPubPath}/\${fileName}.json\`
    // ... other scopes
  }
}

// Examples:
// room scope: /rooms/room1/messages.json
// userPerRoom: /users/alice/room1-notes.json
// userGlobal: /users/alice/settings.json`,
      points: [
        explanation('Distributed database implemented through systematic URL computation'),
        syntax('scope + userId + roomId + fileName', 'deterministic path generation'),
        performance('no central coordination needed - paths computed locally'),
        comparison('traditional databases', { advantage: 'works with any file storage system (local, cloud, CDN)' })
      ]
    }),
    solution({
      code: `// CONFLICT RESOLUTION via optimistic concurrency control

// File format includes timestamps for conflict detection:
{
  "content": [...actual data...],
  "stamps": ["alice:1703123456789", "bob:1703123466234"]
}

// Refine operation with conflict handling:
async function refineFile(url, updateAction, options) {
  for (let retries = 3; retries > 0; retries--) {
    // 1. Read current content + stamps
    const response = await fetch(url)
    const data = response.ok ? await response.json() : {content: initialValue, stamps: []}
    
    // 2. Apply update function
    const newContent = updateAction(data.content)
    
    // 3. Add our timestamp
    const stamp = \`\${userId}:\${Date.now()}\`
    const newData = {
      content: newContent,
      stamps: [...data.stamps, stamp].filter(recent)
    }
    
    // 4. Atomic write (will fail if file changed)
    const saveResponse = await fetch(url, {
      method: 'PUT', 
      body: JSON.stringify(newData)
    })
    
    if (saveResponse.ok) return newContent
    // If failed, retry with fresh data
  }
  throw new Error('Max retries exceeded')
}`,
      points: [
        explanation('Optimistic concurrency control prevents data loss during concurrent updates'),
        syntax('stamps array', 'timestamp tracking for conflict detection'),
        performance('automatic retry mechanism handles conflicts gracefully'),
        evidence('3-retry limit prevents infinite loops while handling most conflicts'),
        comparison('database transactions', { advantage: 'works with simple file storage, no database server needed' })
      ]
    }),
    mechanismUnderTheHood({
      snippet: `// Storage infrastructure abstraction:
// LOCAL: files/rooms/room1/messages.json
// CLOUD: https://storage.googleapis.com/bucket/room1/messages.json
// CDN: https://cdn.example.com/rooms/room1/messages.json

// Same ContentType code works across all storage backends
// URL computation handles the routing automatically
// Caching and conflict resolution work identically everywhere`,
      explain: 'ContentType abstracts storage backend - same API works with local files, cloud storage, or CDNs'
    })
  )
})

Doclet('dataStorePatterns', {
  impl: exercise(
    problem('Common patterns and best practices for using DataStore effectively'),
    solution({
      code: `// PATTERN 1: Chat/Communication Systems
const chatMessages = dataStore('messages', {
  dataStructure: 'appendOnly',           // Messages are immutable
  readVisibility: 'roomMembers',        // Shared by room participants  
  collaborativeWrite: multiUserDistributed()  // Race condition protection
})

const privateNotes = dataStore('private-notes', {
  dataStructure: 'randomAccess',        // Notes can be edited
  readVisibility: 'private',            // Private to user within room
  collaborativeWrite: singleUser()      // No collaboration needed
})

// PATTERN 2: User Preferences and Settings  
const userSettings = dataStore('settings', {
  dataStructure: 'randomAccess',        // Settings can be updated
  readVisibility: 'private',            // Private across all rooms (userGlobal scope)
  collaborativeWrite: singleUser()      // User-only access
})

const roomPreferences = dataStore('room-prefs', {
  dataStructure: 'randomAccess',        // Preferences can change
  readVisibility: 'private',            // Private to user within specific room  
  collaborativeWrite: singleUser()      // User-only data
})`,
      points: [
        explanation('Standard patterns solve common collaborative application needs'),
        syntax('appendOnly + roomMembers', 'ideal for chat and communication systems'),
        syntax('randomAccess + private', 'perfect for user settings and preferences'),
        syntax('collaborativeWrite strategy', 'choose based on whether data is shared or private'),
        whenToUse('these patterns as starting points for most collaborative features')
      ]
    }),
    solution({
      code: `// PATTERN 3: Collaborative Documents and Lists
const sharedTodoList = dataStore('todos', {
  dataStructure: 'randomAccess',        // Todos can be updated/deleted
  readVisibility: 'roomMembers',        // Shared by team members
  collaborativeWrite: multiUserDistributed()  // Advanced race condition handling
})

const documentComments = dataStore('comments', {
  dataStructure: 'appendOnly',          // Comments are immutable once posted
  readVisibility: 'roomMembers',        // Visible to document collaborators
  collaborativeWrite: multiUserDistributed()  // Race condition protection
})

// PATTERN 4: Public Data and Profiles
const userProfile = dataStore('profile', {
  dataStructure: 'randomAccess',        // Profile can be updated
  readVisibility: 'world',              // Public - readable by anyone
  collaborativeWrite: singleUser()      // Only user can edit their profile
})

// ANTI-PATTERNS to avoid:
// ❌ WRONG: Using appendOnly for data that needs updates
// ❌ WRONG: Using multiUserDistributed for single-user private data
// ❌ WRONG: Using world visibility for sensitive user data`,
      points: [
        explanation('Collaborative patterns balance real-time features with performance'),
        syntax('randomAccess + multiUserDistributed', 'for shared mutable data like todo lists'),
        syntax('appendOnly + multiUserDistributed', 'for shared immutable data like comments'),
        syntax('world visibility', 'for public data that anyone can read'),
        doNot('using appendOnly for data that needs updates'),
        doNot('using multiUserDistributed for single-user data'),
        performance('proper pattern selection is critical for both functionality and performance')
      ]
    })
  )
}),

Doclet('socialDbTgpImplementation', {
  impl: exercise(
    problem('How does the social-db DSL integrate with TGP components for declarative distributed database operations?'),
    solution({
      code: `// DECLARATIVE DATA ACCESS with TGP integration

import { dsls } from '@jb6/core'
import '@jb6/social-db'

const { 
  'social-db': {
    'data-store': { dataStore },
    'action': { get, put, refine, sendMessage, subscribeToUpdates }
  },
  common: {
    data: { pipeline, filter, count, join }
  }
} = dsls

// Define DataStore
const chatMessages = dataStore('messages', {
  dataStructure: 'appendOnly',
  readVisibility: 'roomMembers',
  collaborativeWrite: multiUserDistributed()
})

// Declarative data processing with TGP pipelines:
pipeline(
  get(chatMessages, '%$userId%', '%$roomId%'),
  filter('%sender% != "%$userId%"'),        // Other users' messages
  '%content%',                              // Extract content
  join('\\n')                               // Combine into single string
)`,
      points: [
        explanation('Social-db DSL integrates with TGP for declarative distributed database operations'),
        syntax('TGP action components', 'get, put, refine, sendMessage work as pipeline components'),
        syntax('pipeline operations', 'combine DataStore access with data processing'),
        syntax('variable references', '%$userId% and %$roomId% resolve at runtime'),
        performance('TGP type system ensures operations match DataStore capabilities'),
        whenToUse('when building complex data processing workflows on distributed collaborative data')
      ]
    }),
    solution({
      code: `// REACTIVE COLLABORATION with TGP actions:

// Real-time data subscription:
subscribeToUpdates(chatMessages, '%$userId%', '%$roomId%', 
  runActions([
    log('New activity detected'),
    get(chatMessages, '%$userId%', '%$roomId%'),  // Refresh data
    updateUI('%$latestMessages%')                 // Update interface
  ])
)

// Complex collaborative workflows:
runActions([
  sendMessage(chatMessages, '%$userId%', '%$roomId%', '%$newMessage%'),
  get(chatMessages, '%$userId%', '%$roomId%'),
  filter('%time% > %$lastViewTime%'),           // New messages since last view
  count(),                                      // Count new messages
  showNotification('You have %% new messages')  // Display count
])`,
      points: [
        explanation('TGP enables complex reactive workflows combining collaboration and data processing'),
        syntax('subscribeToUpdates', 'TGP action that registers callbacks for data changes'),
        syntax('runActions([...])', 'sequences multiple operations declaratively'),
        syntax('%% placeholder', 'receives output from previous pipeline operation'),
        performance('declarative approach is more maintainable than imperative event handling'),
        evidence('combines real-time collaboration with powerful data processing capabilities')
      ]
    }),
    mechanismUnderTheHood({
      snippet: `// TGP social-db DSL architecture:
// 1. DataStore TGP type with configurable collaboration strategies
// 2. Action TGP components for CRUD operations  
// 3. Data TGP components for read operations in pipelines
// 4. Integration with common DSL for data processing
// 5. Type safety ensures operations match DataStore capabilities

// This enables:
pipeline(
  dataStore('items', {collaborativeWrite: multiUserDistributed()}),
  get('%$userId%', '%$roomId%'),
  filter('%completed% == false'),
  count()
) 
// → Declarative distributed database with race condition recovery`,
      explain: 'TGP implementation provides type-safe declarative access to distributed collaborative data with automatic conflict resolution'
    })
  )
})
