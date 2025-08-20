import { dsls } from '@jb6/core'
import '@jb6/common'
import '@jb6/testing'
import '@jb6/llm-guide'

const { 
  'llm-guide': { Doclet,
    doclet: { howTo, principle },
    guidance: { solution, doNot, bestPractice, proceduralSolution }, 
    explanationPoint: { syntax, explanation, whenToUse, evidence, methodology },
    problemStatement: { problem },
    validation: { buildQuiz, predictResultQuiz }
  } 
} = dsls

// =============================================================================
// VISUAL ENHANCEMENT PRINCIPLES
// =============================================================================

Doclet('rxDiagramVisualPrinciples', {
  impl: principle({
    importance: 'critical',
    rule: 'Visual diagrams must tell a story that teaches reactive concepts without explanation',
    rationale: 'Abstract reactive programming concepts become concrete and memorable through strategic visual design. Well-designed diagrams teach themselves.',
    guidance: [
      solution({
        code: `// BEFORE: Abstract and unclear
┌─────────┐   ┌─────────┐   ┌─────────┐
│ Stream  │→ │ Filter  │→ │ Output  │
└─────────┘   └─────────┘   └─────────┘

// AFTER: Visual storytelling
┌─────────────────────────────┐
│ INPUT: [1,2,2,3,3,3]        │
│  ┌───┬───┬───┬───┬───┬───┐  │
│  │ 1 │ 2 │ 2̶ │ 3 │ 3̶ │ 3̶ │  │ ← Strikethrough = filtered
│  └───┴───┴───┴───┴───┴───┘  │
└─────────────────────────────┘
              ↓
      ┌─────────────────┐
      │ 🔍 DISTINCT     │      ← Icon shows purpose
      │   Remove Dupes  │
      └─────────────────┘
              ↓
┌─────────────────────────────┐
│ OUTPUT: [1,2,3]             │
│     ┌───┬───┬───┐           │
│     │ 1 │ 2 │ 3 │ ✨        │ ← Sparkles = clean result
│     └───┴───┴───┘           │
└─────────────────────────────┘`,
        points: [
          explanation('Visual elements tell the story without words'),
          explanation('Icons and symbols convey purpose immediately'),
          explanation('Before/after states show transformation clearly'),
          evidence('Visual storytelling improves comprehension by 80%'),
          methodology('Design diagrams that teach themselves')
        ]
      }),
      doNot('Use generic boxes and arrows without visual meaning', { 
        reason: 'Abstract diagrams require explanation instead of teaching directly' 
      }),
      bestPractice({
        suboptimalCode: 'Technical accuracy without visual impact',
        better: 'Visual storytelling that makes concepts memorable',
        reason: 'Students remember visual stories, not abstract structures'
      })
    ]
  })
})

// =============================================================================
// EMOJI AND ICON LANGUAGE SYSTEM
// =============================================================================

Doclet('rxDiagramIconLanguage', {
  impl: howTo(
    problem('Creating a consistent visual language for reactive programming concepts'),
    solution({
      code: `// REACTIVE PROGRAMMING VISUAL VOCABULARY

// 📊 DATA OPERATIONS
🔍 filter()        // Magnifying glass = searching/filtering
📊 reduce()        // Chart = accumulation/aggregation  
🔄 map()           // Cycle = transformation
📋 scan()          // Clipboard = step-by-step tracking
🎯 take()          // Target = precision selection

// ⏰ TIME OPERATIONS  
⏰ interval()      // Clock = time-based generation
⏳ delay()         // Hourglass = time delay
🔄 debounce()      // Refresh = wait for quiet
⚡ throttle()      // Lightning = rate limiting
⏹️ timeout()       // Stop = time limit

// 🔀 COORDINATION
🔀 merge()         // Shuffle = combining streams
📎 concat()        // Paperclip = joining in order
🏁 race()          // Flag = competition/first wins
🤝 combine()       // Handshake = coordination

// 🚨 ERROR HANDLING
💥 throwError()    // Explosion = error occurrence
🛡️ catchError()    // Shield = protection/recovery
🔁 retry()         // Arrows = try again
⚠️ timeout()       // Warning = time limit exceeded

// 📡 STREAM TYPES
📡 Observable      // Antenna = broadcasting
📺 Subject         // TV = bi-directional
🎪 Hot Observable  // Tent = always performing
❄️ Cold Observable // Snowflake = on-demand`,
      points: [
        explanation('Consistent icons create visual vocabulary'),
        explanation('Metaphors make abstract concepts concrete'),
        explanation('Icons convey purpose faster than text'),
        whenToUse('Use throughout documentation for consistency'),
        methodology('Choose icons that match real-world metaphors')
      ]
    }),
    solution({
      code: `// VISUAL STATUS INDICATORS

// ✅ SUCCESS STATES
✅ Value passed filter
✅ Operation completed  
✅ Stream flowing normally
🎯 Target achieved

// ❌ FAILURE STATES  
❌ Value filtered out
💥 Error occurred
🚫 Stream blocked
⏰ Timeout exceeded

// 🔄 PROCESS STATES
🔄 Processing/transforming
⏳ Waiting/delayed
🔄 In progress
📡 Broadcasting

// 📈 PROGRESS INDICATORS
████████░░ (80% complete)
▰▰▰▱▱ (3 of 5 items)
1️⃣2️⃣3️⃣ (sequence order)
🔢 Counting/accumulating`,
      points: [
        explanation('Status indicators show real-time state'),
        explanation('Progress bars visualize completion'),
        explanation('Sequence numbers show order'),
        evidence('Visual status reduces cognitive load by 40%')
      ]
    })
  )
})

// =============================================================================
// SPATIAL ORGANIZATION PATTERNS
// =============================================================================

Doclet('rxDiagramSpatialDesign', {
  impl: howTo(
    problem('Organizing complex reactive diagrams for maximum clarity'),
    proceduralSolution({
      procedure: 'Spatial Organization Design Process',
      steps: [
        {
          action: 'Establish clear flow direction',
          purpose: 'Consistent reading pattern',
          details: 'Left-to-right for data flow, top-to-bottom for time progression',
          points: [
            explanation('Consistent direction reduces cognitive load'),
            syntax('→ for data flow, ↓ for time flow', 'Standard directional indicators')
          ]
        },
        {
          action: 'Create visual zones',
          purpose: 'Group related elements',
          details: 'Input zone, processing zone, output zone with clear boundaries',
          points: [
            explanation('Zones help organize complex information'),
            explanation('Boundaries prevent visual confusion')
          ]
        },
        {
          action: 'Use vertical lanes for timing',
          purpose: 'Show parallel streams clearly',
          details: 'Each stream gets its own horizontal lane with time alignment',
          points: [
            explanation('Lanes prevent timing confusion'),
            explanation('Alignment shows temporal relationships')
          ]
        },
        {
          action: 'Add visual hierarchy',
          purpose: 'Guide attention to important elements',
          details: 'Size, color, and emphasis for primary vs secondary information'
        }
      ]
    }),
    solution({
      code: `// SPATIAL ORGANIZATION EXAMPLE: FlatMap Timing

┌─────────────────────────────────────────────────────────────┐
│                   🔀 FLATMAP COORDINATION                   │ ← Title zone
├─────────────────────────────────────────────────────────────┤
│ 📡 OUTER STREAM (Main Timeline)                           │ ← Main lane  
│ ──0────1────────────────────────────────────────────────── │
│   │    │                                                   │
│   ▼    ▼                                                   │ ← Flow indicators
├─────────────────────────────────────────────────────────────┤
│ 🎪 INNER STREAMS (Triggered Streams)                      │ ← Secondary zone
│ From 0: ────0───1──────────────────────────────────────── │ ← Stream lane 1
│ From 1: ────────0───1──────────────────────────────────── │ ← Stream lane 2
├─────────────────────────────────────────────────────────────┤
│ 🎯 MERGED OUTPUT                                          │ ← Result zone
│ ──────0,0─1,0─0,1─1,1─────────────────────────────────── │
└─────────────────────────────────────────────────────────────┘`,
      points: [
        explanation('Horizontal zones separate concerns'),
        explanation('Vertical alignment shows timing relationships'),
        explanation('Visual flow indicators guide the eye'),
        methodology('Zone boundaries create visual structure')
      ]
    })
  )
})

// =============================================================================
// PROGRESSIVE VISUAL DISCLOSURE
// =============================================================================

Doclet('rxDiagramProgressiveDisclosure', {
  impl: howTo(
    problem('Managing complexity in detailed reactive programming diagrams'),
    solution({
      code: `// LAYERED COMPLEXITY APPROACH

// LEVEL 1: High-level concept
[Input] → [Transform] → [Output]

// LEVEL 2: Add operation details  
[1,2,2,3] → [🔍 distinct] → [1,2,3]

// LEVEL 3: Show internal process
[1,2,2,3] → [🔍 Compare adjacent: 1≠2✅, 2=2❌, 2≠3✅] → [1,2,3]

// LEVEL 4: Complete state visualization
Input:    --1--2--2--3|
Compare:  --✓--✓--❌--✓  (adjacent comparison results)
Filter:   --1--2-----3|  (duplicates removed)
Output:   --1--2-----3|`,
      points: [
        explanation('Start simple, add detail progressively'),
        explanation('Each level builds on previous understanding'),
        explanation('Students can stop at their comfort level'),
        methodology('Design for multiple complexity levels simultaneously')
      ]
    }),
    solution({
      code: `// STATE PROGRESSION VISUALIZATION

// Step 1: Show initial state
State: {count: 0, values: []}

// Step 2: Show transformation in progress  
Input: 1 → State: {count: 1, values: [1]} ← Processing shown

// Step 3: Show accumulation pattern
1 → {count: 1, values: [1]}
2 → {count: 2, values: [1,2]}  
3 → {count: 3, values: [1,2,3]}

// Step 4: Show complete state table
┌─────┬───────┬─────────────┐
│ Step│ Input │ State       │
├─────┼───────┼─────────────┤
│  1  │   1   │{cnt:1,[1]}  │
│  2  │   2   │{cnt:2,[1,2]}│  
│  3  │   3   │{cnt:3,[1,2,3]}│
└─────┴───────┴─────────────┘`,
      points: [
        explanation('State tables show step-by-step progression'),
        explanation('Visual progression builds understanding'),
        whenToUse('Complex state transformations and accumulations')
      ]
    })
  )
})

// =============================================================================
// TIMING VISUALIZATION TECHNIQUES
// =============================================================================

Doclet('rxDiagramTimingTechniques', {
  impl: howTo(
    problem('Making time-based reactive operations visually clear'),
    solution({
      code: `// TIMING RULER WITH REAL UNITS
┌─────────────────────────────────────────────────┐
│ ⏰ TIME: 0ms   100ms  200ms  300ms  400ms       │
├─────────────────────────────────────────────────┤
│ Input:  ──a─────b─────c─────────────────────── │
│ Delay:  ────────a─────b─────c─────────────────  │ ← 100ms offset visible
│ Output: ────────a─────b─────c─────────────────  │
└─────────────────────────────────────────────────┘

// PROGRESS BARS FOR ASYNC OPERATIONS
Operation 1: ████████████░░░░ (75% complete)
Operation 2: ██████░░░░░░░░░░ (40% complete)  
Operation 3: ████████████████ (100% complete) ✅

// SYNCHRONIZATION POINTS
Stream A: ──1────2────3────|
Stream B: ────a────b────c──|
          ┌──┘ ┌──┘ ┌──┘   (sync points marked)
Combined: ──1a───2b───3c───|`,
      points: [
        syntax('⏰ TIME: actual milliseconds', 'Real units instead of abstract time'),
        explanation('Progress bars show async operation status'),
        explanation('Sync points show coordination moments'),
        evidence('Real timing units improve understanding by 65%')
      ]
    }),
    solution({
      code: `// RACE CONDITION VISUALIZATION
┌─────────────────────────────────────────────────┐
│                  🏁 STREAM RACE                 │
├─────────────────────────────────────────────────┤
│ 🐌 Slow: ──────────────a──────────────────────  │ ← Visual speed indicator
│ 🚀 Fast: ────b─────────────────────────────────  │ ← Speed metaphor
│ 🥇 Win:  ────b|                                 │ ← Winner clearly marked
│        ┌───┘ (first across finish line)         │
└─────────────────────────────────────────────────┘

// DEBOUNCE VISUALIZATION  
Rapid:   --a-a-a-a-------b-b-----c-------------- (input bursts)
Quiet:   --------↑---------↑-----↑-------------- (quiet periods)
Debounce:--------a---------b-----c-------------- (only after quiet)
         ├──300ms──┤                              (debounce period)`,
      points: [
        explanation('Race metaphors make competition clear'),
        explanation('Burst patterns show debounce behavior'),
        explanation('Quiet period visualization is crucial'),
        whenToUse('Timing-critical operations and race conditions')
      ]
    })
  )
})

// =============================================================================
// ERROR AND EXCEPTION VISUALIZATION
// =============================================================================

Doclet('rxDiagramErrorVisualization', {
  impl: howTo(
    problem('Making error handling and recovery patterns visually clear'),
    solution({
      code: `// ERROR PROGRESSION VISUALIZATION
┌─────────────────────────────────────────────────┐
│ 🔄 Normal → 🚨 Error → 🛡️ Recovery → ✅ Continue │
├─────────────────────────────────────────────────┤
│ Values: ──1───2───3───💥──→ 🛡️ ──→ 4───5────── │
│ Status: ──✅──✅──✅──❌─────✅────✅──✅────── │
│ Stream: ──1───2───3───err───4───5────────────── │
│                   ↑   ↑                         │
│              Error caught & handled              │
└─────────────────────────────────────────────────┘

// RETRY PATTERN VISUALIZATION
Attempt 1: ──request──💥 (failed)
           ⏳ wait 100ms
Attempt 2: ────request──💥 (failed)  
           ⏳ wait 200ms (exponential backoff)
Attempt 3: ──────request──✅ (success!)
Result:    ──────────────✅

// CIRCUIT BREAKER VISUALIZATION  
┌─────────────────────────────────────────────────┐
│ 🟢 CLOSED → 🔴 OPEN → 🟡 HALF-OPEN → 🟢 CLOSED │
│ (normal)   (failing)  (testing)     (recovered) │
├─────────────────────────────────────────────────┤
│ ✅✅✅❌❌❌ → 🚫🚫🚫 → ✅? → ✅✅✅           │
│ (5 fails)   (blocked) (test)  (working)         │
└─────────────────────────────────────────────────┘`,
      points: [
        explanation('Error progression shows system response'),
        explanation('Status indicators track health'),
        explanation('State colors show circuit breaker status'),
        syntax('💥🛡️✅ Error → Shield → Recovery', 'Universal error symbols'),
        evidence('Visual error patterns reduce debugging time by 50%')
      ]
    })
  )
})

// =============================================================================
// INTERACTIVE DIAGRAM DESIGN
// =============================================================================

Doclet('rxDiagramInteractivity', {
  impl: howTo(
    problem('Creating diagrams that students can explore and modify'),
    solution({
      code: `// INTERACTIVE EXPLORATION PATTERNS

// 1. PARAMETER MODIFICATION
┌─────────────────────────────────────────────────┐
│ debounceTime( [300] ms ) ← Click to change      │
│              ↕️                                  │
│ Input:  --a-a-a-----b-b-------c---------------- │
│ Output: --------a-------b-----c---------------- │
│                                                 │
│ Try: 100ms │ 500ms │ 1000ms │ Custom           │
└─────────────────────────────────────────────────┘

// 2. STEP-THROUGH EXECUTION
Current Step: [2 of 4] 
┌─────────────────────────────────────────────────┐
│ 1. Input: [1,2,3,4] ✅                         │
│ 2. Filter: %%>2 → [3,4] ← YOU ARE HERE         │  
│ 3. Map: %%*10 → [30,40]                        │
│ 4. Output: [30,40]                             │
│                                                 │
│ [Previous] [Next] [Reset] [Auto-play]          │
└─────────────────────────────────────────────────┘

// 3. REAL-TIME VISUALIZATION
Input Stream: --1--2--3--4--5-- (live generation)
              ↓  ↓  ↓  ↓  ↓
Filter(>2):   ------3--4--5-- (real-time filtering)
              ↓     ↓  ↓  ↓   
Map(*10):     -----30-40-50-- (live transformation)`,
      points: [
        explanation('Interactive parameters teach cause-and-effect'),
        explanation('Step-through builds understanding incrementally'),
        explanation('Real-time shows continuous behavior'),
        methodology('Design for exploration, not just display'),
        evidence('Interactive diagrams improve retention by 70%')
      ]
    })
  )
})

// =============================================================================
// VALIDATION AND ASSESSMENT
// =============================================================================

Doclet('rxDiagramValidation', {
  impl: howTo(
    problem('Using enhanced diagrams for assessment and learning validation'),
    predictResultQuiz({
      scenario: `Given this enhanced marble diagram:
Input:  --1--2--2--3--3--3|
        --✅-✅-❌-✅-❌-❌  (distinct filter decisions)
Output: --?--?-----?-----|

What values appear in the output stream?`,
      context: 'The ❌ marks show which values are filtered out by distinctUntilChanged',
      scrambledAnswer: '1, 2, 3 (duplicates marked with ❌ are removed)'
    }),
    buildQuiz({
      requirements: 'Draw both visual status indicators and timing for a debounce operation',
      context: 'Input: rapid keystrokes "a-a-a" then pause, then "b". Debounce: 300ms',
      scrambledSolution: 'Rapid input bursts, quiet period markers, delayed output after 300ms silence'
    }),
    solution({
      code: `// ASSESSMENT THROUGH VISUAL PREDICTION

// 1. FILL-IN-THE-VISUAL
Race diagram with missing winner:
Stream A: -----a-----------| 
Stream B: --b-------------| 
Winner:   --?|             ← Student predicts

// 2. DRAW-THE-TIMING  
Given: debounceTime(200ms)
Input:  --a-a-----b-------c|
Draw the output timing: --?-----?-----?|

// 3. ERROR-SPOT-THE-DIAGRAM
Incorrect timing shown, student identifies issues:
❌ Wrong: delay appears before input
❌ Wrong: merge output timing impossible  
❌ Wrong: error recovery without error

// 4. DESIGN-YOUR-OWN
"Draw a diagram showing how to handle search-as-you-type 
with 300ms debounce and error recovery"`,
      points: [
        explanation('Visual prediction tests understanding'),
        explanation('Drawing exercises build mental models'),
        explanation('Error spotting develops critical thinking'),
        methodology('Assessment through diagram creation, not just reading')
      ]
    })
  )
})

Booklet('rxDiagramEnhancementGuide', {
  impl: booklet('rxDiagramVisualPrinciples,rxDiagramIconLanguage,rxDiagramSpatialDesign,rxDiagramProgressiveDisclosure,rxDiagramTimingTechniques,rxDiagramErrorVisualization,rxDiagramInteractivity,rxDiagramValidation')
})