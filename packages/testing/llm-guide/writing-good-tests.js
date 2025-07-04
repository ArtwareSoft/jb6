import { dsls } from '@jb6/core'
import '@jb6/common'
import '@jb6/testing'
import '@jb6/llm-guide'

const { 
  tgp: { Const }, 
  common: { data: { pipeline, splitByPivot, enrichGroupProps, asIs }, boolean: { equals } },
  test: { Test, test: { dataTest } },
  doclet: { Doclet,
    doclet: { principle },
    guidance: { solution, doNot, bestPractice }, 
    explanationPoint: { explanation }
  } 
} = dsls

// Sample data for examples
Const('employees', [
  {name: 'John', dept: 'sales', salary: 50000},
  {name: 'Jane', dept: 'sales', salary: 60000},
  {name: 'Bob', dept: 'tech', salary: 80000}
])

Doclet('testBehaviorNotImplementation', {
  impl: principle('5 of 5', 'Test user-visible behavior, not internal implementation details', {
    rationale: 'Tests that focus on behavior survive refactoring and provide stable verification',
    guidance: [
      solution({
        code: `// ✅ GOOD - test final outcomes
Test('groupBy.summary', {
  impl: dataTest({
    calculate: pipeline('%$employees%', splitByPivot('dept'), enrichGroupProps(group.count()), '%dept%:%count%'),
    expectedResult: equals(asIs(['sales:2', 'tech:1']))
  })
})`,
        points: [
          explanation('Extract only the values users care about, ignore internal structure')
        ]
      }),
      doNot({
        badCode: `// ❌ BAD - test internal data structures\nTest('groupBy.internals', {\n  impl: dataTest({\n    calculate: pipeline('%$employees%', splitByPivot('dept')),\n    expectedResult: equals(asIs([{dept: 'sales', items: [...], internalProp: 'value'}]))\n  })\n})`,
        reason: 'internal structures change during refactoring, breaking tests unnecessarily'
      })
    ]
  })
})

Doclet('smallFocusedTests', {
  impl: principle('4 of 5', 'Write small tests that verify one specific behavior each', {
    rationale: 'Small tests provide precise failure diagnosis and are easier to maintain',
    guidance: [
      solution({
        code: `// ✅ One behavior per test
Test('splitByPivot.basic', {
  impl: dataTest({
    calculate: pipeline('%$employees%', splitByPivot('dept'), '%dept%'),
    expectedResult: equals(asIs(['sales', 'tech']))
  })
})

Test('splitByPivot.edgeCases', {
  impl: dataTest({
    calculate: pipeline(list(), splitByPivot('dept')),
    expectedResult: equals(asIs([]))
  })
})`,
        points: [
          explanation('Each test has a clear, single purpose')
        ]
      }),
      bestPractice({
        suboptimalCode: 'one giant test that covers multiple behaviors',
        better: 'multiple focused tests, each verifying one specific behavior',
        reason: 'focused tests provide precise failure diagnosis and easier maintenance'
      })
    ]
  })
})

Doclet('minimalTestData', {
  impl: principle('4 of 5', 'Use minimal, representative test data that clearly demonstrates the behavior', {
    rationale: 'Simple data makes tests fast, predictable, and easy to understand',
    guidance: [
      solution({
        code: `// ✅ Minimal, clear data
Const('employees', [
  {name: 'John', dept: 'sales', salary: 50000},
  {name: 'Jane', dept: 'sales', salary: 60000},
  {name: 'Bob', dept: 'tech', salary: 80000}
])`,
        points: [
          explanation('Just enough data to demonstrate grouping, aggregation, and edge cases')
        ]
      }),
      doNot({
        badCode: `// ❌ Overly complex data\nConst('employees', [\n  {name: 'John Smith Jr.', age: 25, dept: 'sales', salary: 50000, address: {...}, projects: [...]},\n  // ... 20 more complex objects\n])`,
        reason: 'complex data makes it hard to understand what the test is actually verifying'
      })
    ]
  })
})

Doclet('extractKeyValues', {
  impl: principle({
    importance: 'critical',
    rule: 'Extract only the key values needed to verify the behavior being tested',
    rationale: 'Concise assertions focus on what matters and remain stable during changes',
    guidance: [
      solution({
        code: `// ✅ Extract key values
Test('groupBy.counts', {
  impl: dataTest({
    calculate: pipeline('%$employees%', splitByPivot('dept'), enrichGroupProps(group.count()), '%dept%:%count%'),
    expectedResult: equals(asIs(['sales:2', 'tech:1']))
  })
})`,
        points: [explanation('Template %dept%:%count% extracts exactly what needs verification')]
      }),
      doNot(`// ❌ Verbose full objects
Test('groupBy.verbose', {
  impl: dataTest({
    calculate: pipeline('%$employees%', splitByPivot('dept'), enrichGroupProps(group.count())),
    expectedResult: equals(asIs([
      {dept: 'sales', items: [full objects...], count: 2, otherProps: ...}
    ]))
  })
})`, {
        reason: 'verbose assertions are brittle and obscure the actual behavior being tested'
      })
    ]
  })
})

solution({
  code: `// ✅ Extract key values
Test('groupBy.counts', {
  impl: dataTest({
    calculate: pipeline('%$employees%', splitByPivot('dept'), enrichGroupProps(group.count()), '%dept%:%count%'),
    expectedResult: equals(asIs(['sales:2', 'tech:1']))
  })
})`,
  points: [explanation('Template %dept%:%count% extracts exactly what needs verification')]
})

doNot(`// ❌ Verbose full objects
Test('groupBy.verbose', {
  impl: dataTest({
    calculate: pipeline('%$employees%', splitByPivot('dept'), enrichGroupProps(group.count())),
    expectedResult: equals(asIs([
      {dept: 'sales', items: [full objects...], count: 2, otherProps: ...}
    ]))
  })
})`, {
  reason: 'verbose assertions are brittle and obscure the actual behavior being tested'
})

Doclet('testDevelopmentWorkflow', {
  impl: principle({
    importance: 'high',
    rule: 'Verify test logic with snippets and probes before writing the actual test',
    rationale: 'Incremental verification prevents test bugs and builds confidence in correctness',
    evidence: explanation('Using __ probes helps understand component behavior before committing to expectations'),
    dslCompIds: ['guidance<doclet>solution']
  })
})

solution({
  code: `// ✅ Verify step by step before writing test
// 1. Check data: '%$employees%'
// 2. Test grouping: pipeline('%$employees%', splitByPivot('dept'), __)
// 3. Test extraction: pipeline('%$employees%', splitByPivot('dept'), '%dept%')
// 4. Write test with verified expectation

Test('splitByPivot.basic', {
  impl: dataTest({
    calculate: pipeline('%$employees%', splitByPivot('dept'), '%dept%'),
    expectedResult: equals(asIs(['sales', 'tech']))  // ← verified result
  })
})`,
  points: [explanation('Systematic verification ensures test correctness before committing')]
})

Doclet('testNamingClarity', {
  impl: principle({
    importance: '3',
    rule: 'Use descriptive test names that indicate what behavior is being verified',
    rationale: 'Clear names provide documentation and enable quick failure diagnosis',
    evidence: explanation('Test names like "component.behavior" make test organization and purpose immediately clear'),
    dslCompIds: ['guidance<doclet>solution', 'guidance<doclet>doNot']
  })
})

solution({
  code: `// ✅ Descriptive names
Test('splitByPivot.basic', {...})        // Component + core behavior
Test('splitByPivot.edgeCases', {...})    // Component + edge conditions  
Test('groupBy.workflow', {...})          // Feature + usage pattern`,
  points: [explanation('Names immediately communicate what is being tested')]
})

doNot(`// ❌ Vague names
Test('test1', {...})
Test('basicTest', {...})
Test('checkSomething', {...})`, {
  reason: 'unclear names provide no documentation value and make debugging difficult'
})

Doclet('testCoveragePyramid', {
  impl: principle({
    importance: 'high',
    rule: 'Balance component tests (many), integration tests (some), and workflow tests (few)',
    rationale: 'Balanced coverage provides confidence while remaining maintainable',
    evidence: explanation('Most tests at component level provide precise failure localization, fewer integration and workflow tests catch interaction issues'),
    dslCompIds: ['guidance<doclet>solution']
  })
})

solution({
  code: `// ✅ Balanced test pyramid
// Component tests (many) - individual behaviors
Test('splitByPivot.basic', {...})
Test('enrichGroupProps.count', {...})

// Integration tests (some) - component combinations  
Test('groupBy.multipleAggregations', {...})

// Workflow tests (few) - end-to-end scenarios
Test('groupBy.departmentReport', {...})`,
  points: [explanation('Pyramid structure: many focused tests, fewer integration tests, minimal workflow tests')]
})
