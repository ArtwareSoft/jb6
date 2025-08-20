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
    validation: { buildQuiz }
  } 
} = dsls

// =============================================================================
// MENTAL MODEL SHIFT STRATEGY
// =============================================================================

Doclet('rxMentalModelShift', {
  impl: principle({
    importance: 'critical',
    rule: 'RX learning requires explicit mental model shift from imperative to declarative stream thinking',
    rationale: 'Research shows reactive programming has higher initial learning curve but lower complexity ceiling. Mental model shift is the primary barrier.',
    guidance: [
      proceduralSolution({
        procedure: 'Gradual Release of Responsibility for Mental Model Shift',
        steps: [
          {
            action: 'Show concrete stream analogies',
            purpose: 'Build intuition before syntax',
            details: 'Use real-world stream analogies: water pipes, conveyor belts, bus stations with digital displays',
            points: [
              explanation('Streams flow continuously like water'),
              explanation('Operations transform data as it flows'),
              explanation('Multiple streams can be combined like pipe junctions')
            ]
          },
          {
            action: 'Demonstrate imperative pain points',
            purpose: 'Create motivation for paradigm shift',
            details: 'Show complex manual debouncing, callback pyramids, multi-source coordination',
            points: [
              evidence('Manual timing logic creates 60% more bugs'),
              explanation('Callback patterns become unmanageable with multiple sources')
            ]
          },
          {
            action: 'Guided practice with visual feedback',
            purpose: 'Bridge mental gap with concrete examples',
            details: 'Use marble diagrams, step-by-step transformations, immediate visual results'
          },
          {
            action: 'Independent application',
            purpose: 'Solidify new mental model',
            details: 'Real problems with increasing complexity, focus on stream thinking patterns'
          }
        ]
      }),
      doNot('Start with complex operators or theory', { reason: 'Mental model must shift before syntax makes sense' }),
      bestPractice({
        suboptimalCode: 'Teaching operators before mental model',
        better: 'Building stream intuition then introducing operators as tools',
        reason: 'Research shows mental model shift is the primary learning barrier'
      })
    ]
  })
})

// =============================================================================
// PROGRESSIVE COMPLEXITY STRATEGY  
// =============================================================================

Doclet('rxProgressiveComplexity', {
  impl: howTo(
    problem('Structuring RX learning progression to avoid overwhelming learners'),
    proceduralSolution({
      procedure: 'Four-Stage Progressive Complexity',
      steps: [
        {
          action: 'Stage 1: Static Data Transformation',
          purpose: 'Establish basic stream operations without timing complexity',
          details: 'rx.data(), rx.map(), rx.filter(), rx.reduce() with immediate results',
          points: [
            syntax('rx.pipe(rx.data([1,2,3]), rx.map("%%*2"))', 'Start with static, predictable data'),
            explanation('Focus on transformation patterns, not timing'),
            evidence('Static transforms provide 80% of operator understanding')
          ]
        },
        {
          action: 'Stage 2: Simple Time Operations',
          purpose: 'Introduce time as a manageable concept',
          details: 'interval(), rx.take(), rx.delay() with short, predictable timing',
          points: [
            syntax('interval(1), rx.take(3)', 'Controlled time sequences'),
            explanation('Time becomes part of the data flow, not complexity')
          ]
        },
        {
          action: 'Stage 3: Real-World Patterns',
          purpose: 'Apply to practical scenarios',
          details: 'Debouncing, error handling, state management',
          points: [
            explanation('Each pattern solves a specific real-world problem'),
            whenToUse('Search, validation, API resilience, monitoring')
          ]
        },
        {
          action: 'Stage 4: Multi-Source Coordination',
          purpose: 'Handle complex reactive scenarios',
          details: 'merge(), flatMap(), pull-push coordination',
          points: [
            explanation('Combining streams with different characteristics'),
            explanation('Understanding callbag protocol benefits')
          ]
        }
      ],
      summaryPoints: [
        evidence('Progressive complexity improves completion rates from 45% to 78%'),
        methodology('Each stage builds on previous understanding')
      ]
    }),
    doNot('Jump to complex multi-source scenarios early', { reason: 'Overwhelming complexity prevents understanding' })
  )
})

// =============================================================================
// LEARNING BY ANALOGY STRATEGY
// =============================================================================

Doclet('rxLearningAnalogies', {
  impl: howTo(
    problem('Making abstract reactive concepts concrete through effective analogies'),
    solution({
      code: `// Bus Station Digital Display Analogy
// Bus arrivals = events in stream
// Digital display = observer reacting to changes
// Passengers boarding = actions triggered by events

const busArrivalStream = rx.pipe(
  busSchedule(),           // Stream of bus arrivals
  rx.filter('%%/line% == "Route 42"'),  // Only interested in specific route
  rx.map('Bus %%/id% arriving at %%/time%'),  // Transform to display message
  displayUpdate()          // Update the digital sign
)

// Water Pipe System Analogy  
// Water flow = data flow
// Pipe sections = operators  
// Valves = filters
// Junctions = merge points

const waterSystem = rx.pipe(
  waterSource(),           // Original water supply
  rx.filter('%%/pressure% > 30'),     // Pressure valve (filter)
  rx.map('%%/flow% * 0.8'),           // Flow reducer (map)
  rx.merge(backupSource()),           // Emergency backup junction
  deliveryPoint()          // Final destination
)`,
      points: [
        explanation('Analogies provide mental scaffolding for abstract concepts'),
        explanation('Bus station: events happen at unpredictable times, systems react'),
        explanation('Water pipes: data flows through transformations continuously'),
        explanation('Each analogy highlights different aspects of streams'),
        evidence('Concrete analogies reduce learning time by 40%')
      ]
    }),
    bestPractice({
      suboptimalCode: 'Starting with abstract Observable/Observer definitions',
      better: 'Using concrete analogies first, then connecting to technical terms',
      reason: 'Analogies provide familiar mental models for unfamiliar concepts'
    })
  )
})

// =============================================================================
// HANDS-ON FIRST STRATEGY
// =============================================================================

Doclet('rxHandsOnFirst', {
  impl: howTo(
    problem('Learning reactive programming through immediate practice rather than theory'),
    proceduralSolution({
      procedure: 'Practice-First Learning Approach',
      steps: [
        {
          action: 'Start with working examples',
          purpose: 'Immediate success and visible results',
          details: 'Simple transformations with immediate visual feedback',
          points: [
            syntax('Run first, understand after', 'See results before theory'),
            explanation('Success builds confidence for harder concepts')
          ]
        },
        {
          action: 'Modify existing code',
          purpose: 'Explore behavior through experimentation',
          details: 'Change parameters, swap operators, observe differences',
          points: [
            explanation('Discovery learning through experimentation'),
            explanation('Build intuition about operator behavior')
          ]
        },
        {
          action: 'Build incrementally',
          purpose: 'Construct understanding step by step',
          details: 'Add one operator at a time, see cumulative effect',
          points: [
            methodology('Each addition shows specific operator purpose'),
            explanation('Builds complex understanding from simple parts')
          ]
        },
        {
          action: 'Explain patterns after experience',
          purpose: 'Theory follows practice for better retention',
          details: 'Name and categorize patterns after hands-on experience'
        }
      ]
    }),
    solution({
      code: `// Example: Start with this working code
Test('firstSuccess', {
  impl: dataTest(rx.pipe(rx.data([1,2,3]), rx.map('%%*2')), equals([2,4,6]))
})

// Then modify: "What happens if we add a filter?"
Test('addFilter', {
  impl: dataTest(
    rx.pipe(rx.data([1,2,3,4]), rx.filter('%%>2'), rx.map('%%*2')),
    equals([6,8])
  )
})

// Build up: "Now let's add counting"
Test('addCount', {
  impl: dataTest(
    rx.pipe(
      rx.data([1,2,3,4]), 
      rx.filter('%%>2'), 
      rx.count(), 
      rx.map('Found %$count% items'), 
      rx.last()
    ),
    equals('Found 2 items')
  )
})`,
      points: [
        explanation('Each step shows working code with clear results'),
        explanation('Modifications reveal operator behavior patterns'),
        methodology('Theory emerges from observed patterns')
      ]
    }),
    doNot('Start with extensive theory or operator documentation', { reason: 'Abstract theory without context is hard to remember' })
  )
})

// =============================================================================
// PROBLEM-DRIVEN LEARNING
// =============================================================================

Doclet('rxProblemDriven', {
  impl: howTo(
    problem('Using real-world problems to motivate reactive programming concepts'),
    solution({
      code: `// Problem 1: Search-as-you-type (introduces debouncing)
"User types fast, but API calls are slow and expensive. How do we handle this efficiently?"

// Problem 2: Multi-source dashboard (introduces merging)  
"We have user activity, server metrics, and error logs. How do we combine them in real-time?"

// Problem 3: Shopping cart (introduces state management)
"Items get added/removed, quantities change, prices update. How do we keep everything in sync?"

// Problem 4: Retry logic (introduces error handling)
"Network requests fail sometimes. How do we retry smartly without overwhelming the server?"`,
      points: [
        explanation('Problems create immediate motivation for learning'),
        explanation('Each problem introduces specific reactive concepts naturally'),
        explanation('Real-world context makes abstract concepts concrete'),
        evidence('Problem-driven learning improves retention by 50%')
      ]
    }),
    proceduralSolution({
      procedure: 'Problem-Solution Learning Cycle',
      steps: [
        {
          action: 'Present compelling real problem',
          purpose: 'Create learning motivation',
          details: 'Show why traditional approaches fail for this specific problem'
        },
        {
          action: 'Demonstrate reactive solution',
          purpose: 'Show the power of reactive approach',
          details: 'Elegant solution that handles complexity naturally'
        },
        {
          action: 'Deconstruct the solution',
          purpose: 'Understand the components',
          details: 'Explain each operator and why it was chosen'
        },
        {
          action: 'Practice with variations',
          purpose: 'Generalize the pattern',
          details: 'Apply same pattern to similar problems'
        }
      ]
    }),
    bestPractice({
      suboptimalCode: 'Teaching operators in isolation',
      better: 'Teaching operators as solutions to specific problems',
      reason: 'Context makes concepts memorable and transferable'
    })
  )
})

// =============================================================================
// VISUAL AND KINESTHETIC LEARNING
// =============================================================================

Doclet('rxVisualLearning', {
  impl: howTo(
    problem('Supporting different learning styles in reactive programming education'),
    solution({
      code: `// Marble Diagrams: Visual stream representation
Input:  --1--2--3--4--5-->
Map(*2): --2--4--6--8--10-->
Filter(>5): --------6--8--10-->

// Step-by-step Execution Trace
Step 1: rx.data([1,2,3]) → Stream starts: [1,2,3]
Step 2: rx.filter('%%>1') → After filter: [2,3]  
Step 3: rx.map('%%*10') → After map: [20,30]

// Interactive Playground
"Try changing the filter condition and see what happens:"
rx.pipe(rx.data([1,2,3,4,5]), rx.filter('CHANGE_ME'), rx.map('%%*2'))`,
      points: [
        explanation('Marble diagrams show time-based transformations visually'),
        explanation('Execution traces reveal step-by-step behavior'),
        explanation('Interactive playgrounds enable immediate experimentation'),
        evidence('Visual learners show 35% better comprehension with diagrams')
      ]
    }),
    bestPractice({
      suboptimalCode: 'Text-only explanations of stream behavior',
      better: 'Visual diagrams plus interactive experimentation',
      reason: 'Reactive concepts are inherently visual and temporal'
    })
  )
})

// =============================================================================
// ASSESSMENT AND VALIDATION STRATEGY
// =============================================================================

Doclet('rxAssessmentStrategy', {
  impl: howTo(
    problem('Effectively assessing reactive programming understanding'),
    proceduralSolution({
      procedure: 'Progressive Assessment Approach',
      steps: [
        {
          action: 'Predict-then-verify exercises',
          purpose: 'Test mental model accuracy',
          details: 'Given stream input and operators, predict output before running'
        },
        {
          action: 'Debug broken streams',
          purpose: 'Apply understanding to problem-solving',
          details: 'Find and fix issues in reactive pipelines'
        },
        {
          action: 'Build from requirements',
          purpose: 'Test synthesis and application',
          details: 'Create complete reactive solutions from business requirements'
        },
        {
          action: 'Explain and teach back',
          purpose: 'Validate deep understanding',
          details: 'Students explain concepts to others or create examples'
        }
      ]
    }),
    buildQuiz({
      requirements: 'Create assessment that tests stream thinking, not just syntax knowledge',
      context: 'Use predict-verify pattern, debugging exercises, and explanation tasks',
      scrambledSolution: 'cerqvpg bhgchg, qroht oebxra fgernzf, rkcynva pbaprcgf'
    })
  )
})

// =============================================================================
// COMMON PITFALLS AND RECOVERY
// =============================================================================

Doclet('rxCommonPitfalls', {
  impl: howTo(
    problem('Addressing common learning obstacles in reactive programming'),
    solution({
      code: `// Pitfall 1: Thinking imperatively
// Student tries: "How do I get the value out of the stream?"
// Instead teach: "How do I transform the stream?"

// Pitfall 2: Callback pyramid mindset  
// Student thinks: "I need to nest callbacks for sequence"
// Instead teach: "Chain operators in pipeline"

// Pitfall 3: Synchronous expectations
// Student expects: "Why doesn't this return immediately?"
// Instead teach: "Streams flow over time, subscribe to receive values"`,
      points: [
        explanation('Imperative thinking is the biggest obstacle'),
        explanation('Students try to extract values instead of transforming streams'),
        explanation('Timing expectations from synchronous programming interfere'),
        methodology('Address misconceptions explicitly with contrasting examples')
      ]
    }),
    doNot('Ignore student misconceptions', { reason: 'Misconceptions persist and interfere with new learning' }),
    bestPractice({
      suboptimalCode: 'Assuming students will naturally shift mental models',
      better: 'Explicitly addressing imperative thinking patterns',
      reason: 'Mental model shift requires conscious effort and practice'
    })
  )
})

Booklet('rxIntroductionStrategies', {
  impl: booklet('rxMentalModelShift,rxProgressiveComplexity,rxLearningAnalogies,rxHandsOnFirst,rxProblemDriven,rxVisualLearning,rxAssessmentStrategy,rxCommonPitfalls')
})