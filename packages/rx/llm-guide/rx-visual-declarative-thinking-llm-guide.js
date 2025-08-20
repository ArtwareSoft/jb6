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
// VISUAL DECLARATIVE THINKING PRINCIPLE
// =============================================================================

Doclet('rxVisualDeclarativeThinking', {
  impl: principle({
    importance: 'critical',
    rule: 'Data flow diagrams and marble diagrams are essential for developing declarative reactive thinking',
    rationale: 'Visual representations bridge the gap from imperative step-by-step thinking to declarative data transformation thinking. They make abstract stream concepts concrete and teachable.',
    guidance: [
      solution({
        code: `// IMPERATIVE THINKING (step-by-step instructions):
let results = []
for (let i = 0; i < data.length; i++) {
  if (data[i] > 2) {
    results.push(data[i] * 10)
  }
}

// DECLARATIVE THINKING (data transformation pipeline):
[1,2,3,4] → filter(>2) → map(*10) → [30,40]

// VISUAL DATA FLOW DIAGRAM:
┌─────────┐    ┌──────────┐    ┌─────────┐    ┌──────────┐
│ [1,2,3,4] │ → │ filter(>2) │ → │ map(*10) │ → │ [30,40] │
└─────────┘    └──────────┘    └─────────┘    └──────────┘

// MARBLE DIAGRAM (time-based):
Input:   --1--2--3--4|
Filter:  -----2--3--4|  (>2)
Map:     ----20-30-40|  (*10)
Output:  ----20-30-40|`,
        points: [
          explanation('Data flow diagrams show transformation pipeline structure'),
          explanation('Marble diagrams add time dimension to transformations'),
          explanation('Visual thinking shifts focus from "how" to "what"'),
          evidence('Visual learners show 60% better comprehension with diagrams'),
          methodology('Draw before code - visualization drives implementation')
        ]
      }),
      doNot('Start with code syntax before establishing visual mental model', { 
        reason: 'Code syntax reinforces imperative thinking patterns' 
      }),
      bestPractice({
        suboptimalCode: 'Teaching operators through text descriptions',
        better: 'Teaching operators through visual data flow first',
        reason: 'Visual thinking naturally leads to declarative composition'
      })
    ]
  })
})

// =============================================================================
// DATA FLOW DIAGRAM FUNDAMENTALS
// =============================================================================

Doclet('rxDataFlowDiagrams', {
  impl: howTo(
    problem('Using data flow diagrams to develop declarative thinking patterns'),
    proceduralSolution({
      procedure: 'Data Flow Diagram Learning Progression',
      steps: [
        {
          action: 'Start with simple linear transformations',
          purpose: 'Establish pipeline thinking',
          details: 'Single input → single transformation → single output',
          points: [
            syntax('Data → Transform → Result', 'Basic pipeline structure'),
            explanation('Focus on data transformation, not step-by-step instructions')
          ]
        },
        {
          action: 'Add multiple transformation stages',
          purpose: 'Build composition understanding',
          details: 'Chain transformations to show operator composition',
          points: [
            explanation('Each stage transforms the entire stream'),
            explanation('Output of one stage becomes input of next')
          ]
        },
        {
          action: 'Introduce branching and merging',
          purpose: 'Handle multiple data sources',
          details: 'Show how streams can split, merge, and recombine',
          points: [
            explanation('Streams can fork into parallel processing'),
            explanation('Multiple streams can merge into single stream')
          ]
        },
        {
          action: 'Add state and feedback loops',
          purpose: 'Handle stateful transformations',
          details: 'Show how state flows through transformations',
          points: [
            explanation('State becomes part of the data flow'),
            explanation('Feedback creates continuous reactive loops')
          ]
        }
      ]
    }),
    solution({
      code: `// PROGRESSION 1: Linear Pipeline
┌─────────┐    ┌─────────┐    ┌─────────┐
│  Input  │ → │  Map(*2) │ → │ Output  │
└─────────┘    └─────────┘    └─────────┘

// PROGRESSION 2: Multi-stage Composition  
┌─────────┐    ┌──────────┐    ┌─────────┐    ┌─────────┐
│ [1,2,3,4] │ → │ filter(>2) │ → │ map(*10) │ → │ [30,40] │
└─────────┘    └──────────┘    └─────────┘    └─────────┘

// PROGRESSION 3: Branching and Merging
                    ┌─ map(+1) ─┐
┌─────────┐        │           │    ┌─────────┐
│ Stream  │ ─────→ ┤           ├──→ │ merge() │ → Output
└─────────┘        │           │    └─────────┘
                    └─ map(*2) ─┘

// PROGRESSION 4: Stateful Flow
┌─────────┐    ┌─────────────┐    ┌─────────┐
│ Events  │ → │ reduce(sum) │ → │ Running │
└─────────┘    │   ↺ State   │    │  Total  │
               └─────────────┘    └─────────┘`,
      points: [
        explanation('Each progression builds declarative thinking'),
        explanation('Focus shifts from procedure to data transformation'),
        methodology('Draw the flow before writing the code')
      ]
    })
  )
})

// =============================================================================
// MARBLE DIAGRAM FUNDAMENTALS
// =============================================================================

Doclet('rxMarbleDiagrams', {
  impl: howTo(
    problem('Using marble diagrams to understand time-based reactive operations'),
    solution({
      code: `// BASIC MARBLE NOTATION:
// --a--b--c|     : Stream with values a,b,c then completes
// --a--b--c#     : Stream with values a,b,c then errors  
// --a--b--c...   : Stream continues indefinitely
// -----a---b|    : Stream with delays between values

// TRANSFORMATION EXAMPLES:

// Map: Transform each value
Input:   --1--2--3--|
map(*2): --2--4--6--|

// Filter: Keep only matching values  
Input:    --1--2--3--4--|
filter(>2): -------3--4--|

// Debounce: Wait for quiet period
Input:     --a-b-c------d--|
debounce:  -------c------d--|

// Merge: Combine multiple streams
Stream A:  --a-----c-----|
Stream B:  ----b------d--|  
merge:     --a-b---c--d--|

// FlatMap: Transform to inner streams
Input:     --1-----2-----|
flatMap:   --a-b---c-d---|
           (1→a,b  2→c,d)`,
      points: [
        syntax('-- represents time', 'Time flows left to right'),
        syntax('| means completion', 'Stream ends successfully'),
        syntax('# means error', 'Stream ends with error'),
        explanation('Marble diagrams show timing relationships clearly'),
        explanation('Essential for understanding time-based operators'),
        evidence('Marble diagrams reduce timing confusion by 70%')
      ]
    }),
    proceduralSolution({
      procedure: 'Marble Diagram Learning Process',
      steps: [
        {
          action: 'Read existing marble diagrams',
          purpose: 'Learn the notation and timing concepts',
          details: 'Study operator documentation with marble examples'
        },
        {
          action: 'Predict marble outputs',
          purpose: 'Test understanding of timing behavior',
          details: 'Given input marble and operator, draw expected output'
        },
        {
          action: 'Draw custom scenarios',
          purpose: 'Apply marble thinking to real problems',
          details: 'Create marble diagrams for your specific use cases'
        },
        {
          action: 'Verify with code',
          purpose: 'Confirm marble predictions match reality',
          details: 'Implement the marble scenario and test results'
        }
      ]
    })
  )
})

// =============================================================================
// COMBINING DIAGRAMS FOR COMPLEX SCENARIOS
// =============================================================================

Doclet('rxCombinedDiagramming', {
  impl: howTo(
    problem('Using both data flow and marble diagrams for complex reactive scenarios'),
    solution({
      code: `// COMPLEX SCENARIO: Search-as-you-type with debouncing

// DATA FLOW DIAGRAM (Structure):
┌──────────┐   ┌─────────────┐   ┌──────────┐   ┌─────────┐
│ KeyPress │→│ distinctUntil │→│ debounce │→│ API Call │
│  Events  │   │  Changed     │   │ (300ms)   │   │ Results  │
└──────────┘   └─────────────┘   └──────────┘   └─────────┘

// MARBLE DIAGRAM (Timing):
KeyPress:    --a-a-b-b-b-c-----d-d--|
distinct:    --a---b-----c-----d----|  
debounce:    -------b-----c-------d-|
API calls:   -------B-----C-------D-|
             (B=search"b", C=search"c", D=search"d")

// COMBINED UNDERSTANDING:
// Structure: What transformations happen in what order
// Timing: When transformations happen relative to input events`,
      points: [
        explanation('Data flow shows the transformation structure'),
        explanation('Marble diagrams show the timing behavior'),
        explanation('Combined view gives complete understanding'),
        methodology('Use both diagrams for complex scenarios'),
        whenToUse('Complex scenarios: debouncing, merging, error handling')
      ]
    }),
    solution({
      code: `// IMPLEMENTATION GUIDED BY DIAGRAMS:
Test('searchAsYouType', {
  impl: dataTest(
    rx.pipe(
      keyPressEvents(),           // Input from data flow diagram
      rx.distinctUntilChanged(),  // First transformation box
      rx.debounceTime(300),       // Second transformation box  
      rx.flatMap(searchAPI)       // Final transformation box
    ),
    // Expected timing matches marble diagram
    equals(['resultB', 'resultC', 'resultD'])
  )
})`,
      points: [
        explanation('Diagrams guide implementation structure'),
        explanation('Visual design becomes declarative code'),
        methodology('Diagram first, then implement')
      ]
    })
  )
})

// =============================================================================
// VISUAL THINKING EXERCISES
// =============================================================================

Doclet('rxVisualThinkingExercises', {
  impl: howTo(
    problem('Developing visual declarative thinking through progressive exercises'),
    proceduralSolution({
      procedure: 'Visual Thinking Development Exercises',
      steps: [
        {
          action: 'Diagram-to-code translation',
          purpose: 'Connect visual thinking to implementation',
          details: 'Given data flow diagram, write the corresponding rx.pipe() code'
        },
        {
          action: 'Code-to-diagram reverse engineering',
          purpose: 'Verify understanding of existing code',
          details: 'Given rx.pipe() code, draw the data flow and marble diagrams'
        },
        {
          action: 'Problem-to-diagram design',
          purpose: 'Apply visual thinking to new problems',
          details: 'Given problem description, design the visual solution first'
        },
        {
          action: 'Debugging with diagrams',
          purpose: 'Use visual thinking for problem-solving',
          details: 'Draw expected vs actual behavior to find issues'
        }
      ]
    }),
    buildQuiz({
      requirements: 'Create exercise where students must draw both data flow and marble diagrams for a given problem',
      context: 'Problem: Rate-limited API calls with retry logic on failure',
      scrambledSolution: 'qngn sybi: vcng → engr yvzvg → ncv pnyy → reebe unaqyr → ergel, zneoyr: fubjf gvzvat naq ergel qryinlf'
    }),
    predictResultQuiz({
      scenario: `Data Flow: [1,2,3,4,5] → filter(>3) → map(*2) → count()
Marble: --1--2--3--4--5| → -------3--4--5| → ------6--8-10| → -----------2|`,
      context: 'Trace through both the structural and timing aspects',
      scrambledAnswer: 'Final count: 2 (values 4 and 5 pass filter, become 8 and 10, count is 2)'
    })
  )
})

// =============================================================================
// TOOLS AND TECHNIQUES FOR VISUAL LEARNING
// =============================================================================

Doclet('rxVisualLearningTools', {
  impl: howTo(
    problem('Practical tools and techniques for visual reactive programming education'),
    solution({
      code: `// INTERACTIVE MARBLE DIAGRAM TOOLS:
// 1. RxJS Marble Testing syntax for precise timing
const marble = '-a-b-c|'
const values = { a: 1, b: 2, c: 3 }
// Result: emits 1, 2, 3 with specific timing

// 2. ASCII Art Data Flow in Comments  
/*
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│ User Input  │ → │ Validation   │ → │ API Submit  │
│ (keypress)  │    │ (debounce)   │    │ (retry)     │
└─────────────┘    └──────────────┘    └─────────────┘
*/

// 3. Step-by-step Visual Trace
// Input: [1,2,3,4]
// After filter(>2): [3,4]  
// After map(*10): [30,40]
// Final result: [30,40]

// 4. Interactive Playground Approach
rx.pipe(
  rx.data([1,2,3,4,5]),
  rx.filter('%%>CHANGE_ME'),  // Student modifies this
  rx.map('%%*CHANGE_ME'),     // And this
  // Visual output updates immediately
)`,
      points: [
        explanation('Interactive tools provide immediate visual feedback'),
        explanation('ASCII art in comments keeps diagrams with code'),
        explanation('Step-by-step traces show transformation progression'),
        methodology('Visual learning needs interactive experimentation')
      ]
    }),
    bestPractice({
      suboptimalCode: 'Static diagrams in separate documentation',
      better: 'Interactive diagrams that update with code changes',
      reason: 'Dynamic visual feedback reinforces learning'
    })
  )
})

Booklet('rxVisualDeclarativeGuide', {
  impl: booklet('rxVisualDeclarativeThinking,rxDataFlowDiagrams,rxMarbleDiagrams,rxCombinedDiagramming,rxVisualThinkingExercises,rxVisualLearningTools')
})