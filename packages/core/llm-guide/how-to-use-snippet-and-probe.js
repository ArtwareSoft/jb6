import { dsls } from '@jb6/core'
import '@jb6/common'
import '@jb6/testing'
import '@jb6/llm-guide'

const { 
  tgp: { Const }, 
  common: { Data, data: { pipeline, filter, count, join, sum }, boolean: { and, equals } },
  test: { Test, test : { dataTest } },
  'llm-guide': { Doclet,
    doclet: { howTo },
    guidance: { solution, doNot, bestPractice, mechanismUnderTheHood }, 
    explanationPoint: { whenToUse, performance, comparison, syntax, explanation },
    problemStatement: { problem }
  } 
} = dsls

// Sample data for examples
Const('people', [{name: 'Homer', age: 42}, {name: 'Bart', age: 12}, {name: 'Lisa', age: 10}])

// Example circuit: Data component + Test component
Data('peopleUnder30', {
  impl: pipeline('%$people%', filter('%age% < 30'), count())
})

const { peopleUnder30 } = dsls.common.data

Test('peopleUnder30Test', {
  impl: dataTest(peopleUnder30(), equals(2))
})

Doclet('circuitConcept', {
  impl: howTo(
    problem('Understanding the Circuit concept - execution environment containing multiple related components'),
    solution({
      code: `Data('peopleUnder30', {
  impl: pipeline('%$people%', filter('%age% < 30'), count())
})

Test('peopleUnder30Test', {
  impl: dataTest(peopleUnder30(), equals(2))
})`,
      points: [
        explanation('Circuit contains both the data component and its test'),
        syntax('Data + Test pattern', 'main component plus verification test form a circuit'),
        whenToUse('when building reusable components with verification'),
        performance('circuit provides shared execution context and variable scope')
      ]
    }),
    solution({
      code: `Test('peopleUnder30Test', {
  impl: dataTest(
    pipeline('%$people%', filter('%age% < 30'), count() __),
    equals(2)
  )
})`,
      points: [
        explanation('Probe in test captures data flow within circuit execution'),
        syntax('probe in test context', 'shows intermediate results during test execution'),
        whenToUse('when debugging component behavior in real execution environment'),
        comparison('isolated snippet', { advantage: 'shows execution with proper test context and setup' })
      ]
    }),
    solution({
      code: `// Circuit discovery process:
// probePath: "test<testing>peopleUnder30Test~impl~expectedResult~operators~2"  
// circuit: "test<testing>peopleUnder30Test"
// The test becomes the execution environment for the probe`,
      points: [
        explanation('Circuit discovery identifies test as execution environment'),
        syntax('circuit identification', 'system finds best execution context for probe'),
        performance('circuit provides variables, lifecycle management, and shared context'),
        comparison('component isolation', {
          advantage: 'real execution environment with proper dependencies'
        })
      ]
    }),
    mechanismUnderTheHood({
      snippet: `// Circuit discovery logic:
function calcCircuit() {
  const cmpId = probePath.split('~')[0]  // "test<testing>peopleUnder30Test"
  const comp = compByFullId(cmpId, jb)   // Find the test component
  
  // Circuit priority order:
  return comp.circuit                           // 1. Explicit circuit property
      || (comp.impl?.expectedResult && cmpId)   // 2. Test acts as circuit ✓
      || circuitOptions(cmpId)[0]?.id           // 3. Find components that reference this
      || cmpId                                  // 4. Self-circuit fallback
}

// Circuit execution:
// 1. Test component runs as circuit host
// 2. dataTest executes pipeline('%$people%', filter(...), count())
// 3. equals(2) validates result in same circuit context
// 4. Probe captures intermediate data during execution`,
      explain: 'circuit provides execution environment where multiple components share context, variables, and lifecycle'
    })
  )
})

Doclet('snippetExecution', {
  impl: howTo(
    problem('Understanding TGP snippet execution for testing expressions'),
    solution({
      code: "'%$people%'",
      points: [
        explanation('Access the people variable - returns the full array'),
        syntax("'%$people%'", 'variable access in string context'),
        whenToUse('when you need to verify variable content'),
        performance('direct execution without pipeline overhead')
      ]
    }),
    solution({
      code: "pipeline('%$people%', filter('%age% < 30'), count())",
      points: [
        explanation('Complete pipeline that returns 2 (count of people under 30)'),
        syntax('pipeline composition', 'chaining operations for data processing'),
        whenToUse('when testing multi-step transformations'),
        performance('executes full pipeline and returns final result')
      ]
    }),
    solution({
      code: "'%$people/name%'",
      points: [
        explanation('Property path access returns array of names'),
        syntax('property path', 'direct property extraction from variable'),
        whenToUse('when you need simple property extraction'),
        comparison('pipeline approach', { advantage: 'more concise for simple operations' })
      ]
    }),
    doNot('console.log(%$people%)', { reason: 'console.log is not available in snippet execution context' }),
    doNot('var x = %$people%', { reason: 'variable declarations not supported in snippets' }),
    mechanismUnderTheHood({
      snippet: `// Snippet execution wraps your expression:
Data('noName', {impl: YOUR_EXPRESSION})
const result = await dsls['common']['data']['noName'].$run()
// Returns the final computed value`,
      explain: 'snippets create temporary data components and execute them in isolation'
    })
  )
})

Doclet('probeBasics', {
  impl: howTo(
    problem('Using probe (__) as a cursor to inspect data flow at specific points'),
    solution({
      code: `'%$people/__%'`,
      points: [
        explanation('Probe inside variable expression captures variable resolution'),
        syntax(`'%$people/__%'`, 'probe cursor at variable access point'),
        whenToUse('when you need to verify what data a variable contains'),
        performance('shows data with execution metadata and context')
      ]
    }),
    solution({
      code: `pipeline('%$people%', filter('%age% < 30'), __)`,
      points: [
        explanation('Probe at end of pipeline stage shows filtered results'),
        syntax('pipeline(..., __)', 'probe cursor replaces the end position'),
        whenToUse('when debugging intermediate pipeline results'),
        comparison('final result', { advantage: 'shows data before next operation' })
      ]
    }),
    solution({
      code: `pipeline('%$people%', '%name__%')`,
      points: [
        explanation('Probe in template shows each person object during iteration'),
        syntax('%name__%', 'probe cursor within template evaluation'),
        whenToUse('when you need to see individual item processing'),
        performance('captures context for each data item separately')
      ]
    }),
    bestPractice({
      suboptimalCode: `pipeline('%$people%', __, count())`,
      better: `pipeline('%$people%'__, count())`,
      reason: 'treat __ as cursor position rather than component'
    }),
    doNot(`'%$people%__'`, { reason: 'probe must be separated by / in variable expressions' }),
    mechanismUnderTheHood({
      snippet: `// Probe __ acts as a cursor position marker:
// - Replaces the exact position where you want to inspect data
// - Does not add extra parameters or commas
// - Shows data flow at that precise execution point
// - Think of it as "placing your cursor" in the expression`,
      explain: 'probe is a positional marker, not a function parameter'
    })
  )
})

Doclet('probeInExpressions', {
  impl: howTo(
    problem('Advanced probe placement within expressions and function calls'),
    solution({
      code: "count('%$people/__%')",
      points: [
        explanation('Probe inside function parameter shows data being passed to count'),
        syntax('count("%$people/__%")', 'probe at function parameter evaluation'),
        whenToUse('when you need to verify function inputs'),
        performance('captures parameter data without affecting function execution')
      ]
    }),
    solution({
      code: "pipeline('%$people%', '%age%', __)",
      points: [
        explanation('Probe after property extraction shows array [42,12,10]'),
        syntax('property extraction with probe', 'probe shows intermediate transformation'),
        whenToUse('when debugging data transformations before aggregation'),
        comparison('after sum()', { advantage: 'shows data structure before final operation' })
      ]
    }),
    solution({
      code: "pipeline('%$people%', filter(and('%age% < 30', '%name% == \"Bart\"')), __)",
      points: [
        explanation('Probe after complex filter shows only matching records'),
        syntax('complex boolean logic with probe', 'probe reveals filter effectiveness'),
        whenToUse('when debugging complex filter conditions'),
        performance('execution trace shows boolean evaluation performance')
      ]
    }),
    bestPractice("'%name% (%age%)__%'", {
      better: "pipeline('%$people%', '%name% (%age%)', __)",
      reason: 'probe outside template provides cleaner data inspection than inside template'
    })
  )
})

Doclet('probeResultInterpretation', {
  impl: howTo(
    problem('Understanding probe output structure and execution metadata'),
    solution({
      code: "'%$people/__%'",
      points: [
        explanation('circuitRes contains the actual data at probe point'),
        explanation('result array shows execution context with in/out data'),
        explanation('visits object shows component execution counts'),
        explanation('totalTime provides performance timing'),
        syntax('probe result structure', 'standardized debugging information format')
      ]
    }),
    mechanismUnderTheHood({
      snippet: `// Probe result structure:
{
  "circuitRes": actual_data_at_probe_point,
  "result": [
    {
      "out": transformed_data_output,
      "in": {
        "data": input_data_context,
        "vars": available_variables_scope,
        "params": function_parameters
      }
    }
  ],
  "visits": {"component_path": execution_count},
  "totalTime": execution_milliseconds,
  "probePath": "exact_execution_path_to_probe"
}`,
      explain: 'each field provides different debugging insights for optimization and error detection'
    }),
    solution({
      code: "pipeline('%$people%', filter('%age% < 30'), __)",
      points: [
        explanation('visits shows filter executed 3 times (once per person)'),
        explanation('probePath indicates exact location in execution tree'),
        explanation('result.in.data shows individual person objects during filtering'),
        performance('totalTime helps identify performance bottlenecks'),
        whenToUse('when optimizing complex expressions or debugging performance')
      ]
    })
  )
})

Doclet('snippetDebuggingWorkflow', {
  impl: howTo(
    problem('Systematic debugging approach using snippets and probes together'),
    solution({
      code: "'%$people/__%'",
      points: [
        explanation('Step 1: Verify data source with probe - confirm variable content'),
        whenToUse('always start debugging by confirming your data source'),
        performance('quick verification prevents downstream debugging complexity')
      ]
    }),
    solution({
      code: "pipeline('%$people%', filter('%age% < 30'), __)",
      points: [
        explanation('Step 2: Test operations with probes - verify each transformation'),
        whenToUse('after adding each pipeline operation'),
        comparison('final result only', { advantage: 'catches errors at the exact failure point' })
      ]
    }),
    solution({
      code: "pipeline('%$people%', filter('%age% < 30'), '%name% (%age%)', __)",
      points: [
        explanation('Step 3: Test formatting with probes - verify templates work correctly'),
        whenToUse('before final aggregation operations'),
        performance('ensures formatting works before expensive operations')
      ]
    }),
    solution({
      code: "pipeline('%$people%', filter('%age% < 30'), '%name% (%age%)', join())",
      points: [
        explanation('Step 4: Final execution without probe - run complete expression'),
        whenToUse('after verifying all intermediate steps work correctly'),
        performance('high confidence in correctness due to systematic verification')
      ]
    }),
    bestPractice('building complex expressions all at once', {
      better: 'build incrementally with probes at each step',
      reason: 'systematic approach prevents errors and improves understanding of data flow'
    })
  )
})
