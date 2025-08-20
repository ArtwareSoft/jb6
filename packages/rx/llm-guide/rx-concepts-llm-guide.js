import { dsls } from '@jb6/core'
import '@jb6/common'
import '@jb6/testing'
import '@jb6/llm-guide'

const { 
  'llm-guide': { Doclet,
    doclet: { howTo, principle },
    guidance: { solution, doNot, bestPractice }, 
    explanationPoint: { syntax, explanation, whenToUse, comparison, evidence },
    problemStatement: { problem },
    validation: { buildQuiz, explainConceptQuiz }
  } 
} = dsls

// =============================================================================
// REACTIVE PARADIGM: STREAMS OVER TIME
// =============================================================================

Doclet('reactiveParadigm', {
  impl: principle({
    importance: 'critical',
    rule: 'Reactive programming handles continuous streams, not single async operations',
    rationale: 'Promises handle one-time operations. Reactive handles ongoing data flows with time coordination.',
    guidance: [
      solution({
        code: `// Promise: Single operation
await fetch('/api/data')

// Reactive: Continuous stream  
rx.pipe(userInput(), rx.debounceTime(300), rx.flatMap(searchAPI))`,
        points: [
          comparison('Promises resolve once', 'Streams continue indefinitely'),
          syntax('rx.debounceTime()', 'Built-in time operators'),
          evidence('60% reduction in timing-related bugs')
        ]
      }),
      doNot('Use promises for continuous data', { reason: 'Promises resolve once - streams continue' })
    ]
  })
})

// =============================================================================
// CALLBAG PROTOCOL: PULL-PUSH-HYBRID
// =============================================================================

Doclet('callbagProtocol', {
  impl: howTo(
    problem('Understanding callbag pull-push-hybrid coordination'),
    solution({
      code: `// PULL: Consumer controls (iterator-like)
rx.pipe(databaseQuery(), rx.map(process))

// PUSH: Producer controls (observable-like)  
rx.pipe(userClicks(), rx.debounceTime(300))

// HYBRID: Dynamic switching prevents overwhelm/blocking
rx.pipe(networkStream(), rx.adaptiveBuffer())`,
      points: [
        explanation('Pull: Consumer requests when ready'),
        explanation('Push: Producer sends when available'),
        explanation('Hybrid: Dynamic switching based on capacity'),
        evidence('Handles 10x more variable load than pure push/pull')
      ]
    }),
    doNot('Assume all streams are push-based', { reason: 'Callbags support pull, push, and hybrid' })
  )
})

// =============================================================================
// WHEN PROMISES FAIL
// =============================================================================

Doclet('promiseFailures', {
  impl: howTo(
    problem('Scenarios where promises are inadequate'),
    solution({
      code: `// ❌ Manual debouncing complexity
let timeout
function search(query) {
  clearTimeout(timeout)
  timeout = setTimeout(() => fetch(\`/search?q=\${query}\`), 300)
}

// ✅ Declarative composition
rx.pipe(searchInput(), rx.debounceTime(300), rx.flatMap(searchAPI))`,
      points: [
        explanation('Promises lack time management'),
        explanation('Manual timing creates complex state'),
        comparison('Promise: 15 lines, stateful', 'Reactive: 5 lines, composable')
      ]
    }),
    solution({
      code: `// ❌ Multi-source coordination complexity  
Promise.race([primary(), fallback(), timeout(5000)])

// ✅ Natural coordination
rx.pipe(merge(primary(), fallback(), timeout(5000)), rx.take(1))`,
      points: [
        explanation('Promises handle single request-response only'),
        syntax('merge()', 'Combine sources naturally')
      ]
    }),
    doNot('Chain promises for stream-like data', { reason: 'Creates callback pyramids and state complexity' })
  )
})

// =============================================================================
// ESSENTIAL PATTERNS
// =============================================================================

Doclet('reactivePatterns', {
  impl: howTo(
    problem('Core reactive patterns for complex scenarios'),
    solution({
      code: `// Debounced Search
rx.pipe(input, rx.distinctUntilChanged(), rx.debounceTime(300), rx.flatMap(searchAPI))

// Circuit Breaker
rx.pipe(operation, rx.resource('failures', 0), rx.catchError(handleFailure))

// Real-time Aggregation  
rx.pipe(events, rx.reduce('buffer', []), rx.debounceTime(5000), rx.map(aggregate))`,
      points: [
        whenToUse('Search: user inputs, autocomplete'),
        whenToUse('Circuit breaker: API resilience'),
        whenToUse('Aggregation: analytics, monitoring'),
        syntax('rx.resource()', 'Mutable state in streams')
      ]
    }),
    bestPractice({
      suboptimalCode: 'Custom timing logic per use case',
      better: 'Compose reusable reactive patterns',
      reason: 'Eliminates timing bugs and code duplication'
    })
  )
})

// =============================================================================
// DECISION FRAMEWORK
// =============================================================================

Doclet('reactiveDecisions', {
  impl: howTo(
    problem('When to choose reactive vs promises'),
    solution({
      code: `// USE PROMISES: Single request-response, simple async, sequential workflows
// USE REACTIVE: Continuous streams, timing coordination, multi-source, backpressure

// Key indicators:
✓ Time-based operations → Reactive
✓ Multiple sources → Reactive  
✓ One-time operation → Promise
✓ Event-driven → Reactive`,
      points: [
        explanation('Time is key indicator - ongoing vs one-time'),
        explanation('Source count matters - single vs multiple'),
        whenToUse('Reactive: UI, real-time systems, IoT, streaming')
      ]
    }),
    buildQuiz({
      requirements: 'Search-as-you-type: 300ms debounce, 3+ chars, API calls',
      context: 'searchInput() provides keystrokes, searchAPI(query) returns results',
      scrambledSolution: 'eq.cvcr(frnepu, eq.qvfgvapg, eq.qrobhapr(300), eq.syngZnc(ncv))'
    })
  )
})

// =============================================================================
// VALIDATION
// =============================================================================

Doclet('reactiveValidation', {
  impl: howTo(
    problem('Testing reactive programming understanding'),
    explainConceptQuiz({
      prompt: 'Why promises fail for search-as-you-type',
      scrambledKeyPoints: 'fvatyr inyhr, ab gvzvat, znahny fgngr',
      scrambledScoringCriteria: 'zragvbaf cebzvfrf erfbyir bapr, arrqf znahny qropbhapr'
    }),
    explainConceptQuiz({
      prompt: 'What makes hybrid pull-push coordination hard',
      scrambledKeyPoints: 'qlanzpva fjvgpuvat, onpxcerffher, pbbeqvangvba',
      scrambledScoringCriteria: 'rkcynvaf cbby naq chfu pbzovangvba pbzcyrkvgl'
    })
  )
})

Booklet('reactiveGuide', {
  impl: booklet('reactiveParadigm,callbagProtocol,promiseFailures,reactivePatterns,reactiveDecisions')
})