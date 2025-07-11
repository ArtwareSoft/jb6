import { dsls } from '@jb6/core'
import '@jb6/common'
import '@jb6/testing'
import '@jb6/llm-guide'

const { 
  doclet: { Doclet,
    doclet: { exercise },
    guidance: { solution, doNot, bestPractice }, 
    explanationPoint: { whenToUse, performance, explanation, syntax },
    problemStatement: { problem }
  } 
} = dsls

Doclet('latestActivityDetectionEssentials', {
  impl: exercise(
    problem('What does activity detection actually do and when should you use it?'),
    solution({
      code: `// SIMPLE OUTPUT: Boolean + timestamp
const output = {
  externalActivity: true,           // "Someone else did something"
  timestamp: 1703123456789,         // "When it happened"
  fromUser: 'alice'                 // "Who did it" (optional)
}

// USAGE: Subscribe to room updates
chatRoom.subscribeToUpdates(userId, roomId, (event) => {
  if (event.externalActivity) {
    refreshMessageList()              // Update UI
    showNotification("New activity!") // Notify user
  }
})`,
      points: [
        explanation('Entire system produces simple boolean: "did someone else do something?"'),
        syntax('externalActivity', 'core boolean answer for real-time collaboration'),
        whenToUse('chat messages, shared documents, presence indicators')
      ]
    }),
    solution({
      code: `// WHEN TO USE: Multi-user real-time coordination
const chatRoom = dataStore('room', {
  latestActivityDetection: fileBased(),     // ✅ Multiple users, real-time needed
  writeAccess: 'multiUser',
  dataStructure: 'appendOnly'
})

// WHEN NOT TO USE: Single user or no real-time needs  
const userSettings = dataStore('settings', {
  // No activity detection needed - private data
  writeAccess: 'singleUser',
  readVisibility: 'private'
})

// DECISION RULE: "Do I need real-time awareness of other users?"`,
      points: [
        explanation('Only use for collaborative features that need real-time coordination'),
        whenToUse('chat, collaborative editing, presence indicators'),
        whenToUse('NOT for: private user data, batch processing, single-user scenarios')
      ]
    })
  )
})

Doclet('howItWorksDistributed', {
  impl: exercise(
    problem('How do browsers coordinate without a central server?'),
    solution({
      code: `// PEER-TO-PEER: Each user owns their activity file
await fetch('/rooms/room1/active-alice.txt', {method: 'PUT', body: Date.now()})  // Alice only
await fetch('/rooms/room1/active-bob.txt', {method: 'PUT', body: Date.now()})    // Bob only
// Result: Zero conflicts, exclusive write space per user

// DETECTION: Each browser reads others' files
const bobActivity = await fetch('/rooms/room1/active-bob.txt', {method: 'HEAD'})
const charlieActivity = await fetch('/rooms/room1/active-charlie.txt', {method: 'HEAD'})
// All browsers run same algorithm = eventual consistency`,
      points: [
        explanation('Each user writes only their own activity file, eliminating conflicts'),
        syntax('exclusive ownership', 'user writes only to /active-{userId}.txt'),
        performance('zero write conflicts - users never block each other')
      ]
    }),
    solution({
      code: `// PERFORMANCE: Two-phase detection
// Phase 1: Quick check cached aggregate
const myCache = await fetch('/users/alice/room1-cache.json')  // 1 request
if (nothingNewInCache) return false  // Fast path

// Phase 2: Individual verification (only when needed)
const freshActivity = await Promise.all(otherUsers.map(user => 
  fetch(\`/rooms/room1/active-\${user}.txt\`, {method: 'HEAD'})  
))
// Result: 80-90% fewer network requests`,
      points: [
        explanation('Cached aggregated view enables fast-path optimization'),
        syntax('two-phase detection', 'cheap check, then expensive verification only when needed'),
        performance('reduces network requests by 80-90% when room is quiet')
      ]
    })
  )
})

Doclet('commonMistakes', {
  impl: exercise(
    problem('What are the most common misconceptions about this distributed system?'),
    doNot('// ❌ WRONG: Central coordination\nserver.getAllUserActivity()  // No central server exists!', {
      reason: 'This is peer-to-peer - each browser operates independently'
    }),
    doNot('// ❌ WRONG: Shared mutable state\nawait refineFile("/shared-activity.json", (global) => {\n  global[userId] = Date.now()  // Multiple users = conflicts!\n})', {
      reason: 'Shared state creates write conflicts - individual ownership eliminates contention'
    }),
    solution({
      code: `// ✅ CORRECT: Independent peers with convergent behavior
async function myIndependentDetection() {
  // 1. Write ONLY my activity (exclusive, no conflicts)
  await writeFile(\`/rooms/room1/active-\${myUserId}.txt\`, Date.now())
  
  // 2. Read others' activity (read-only, no conflicts)
  const othersActivity = await Promise.all(
    otherUsers.map(id => getTimestamp(\`/rooms/room1/active-\${id}.txt\`))
  )
  
  // 3. All peers converge to same state (same inputs + same algorithm)
}`,
      points: [
        explanation('Each browser runs identical algorithm independently'),
        syntax('convergent reads', 'reading same sources guarantees consistency'),
        performance('no coordination overhead - scales linearly')
      ]
    }),
    bestPractice({
      suboptimalCode: 'Using activity detection for all data stores',
      better: 'Using appropriate coordination level for each data type\'s needs',
      reason: 'unnecessary complexity adds overhead without providing value'
    })
  )
})
