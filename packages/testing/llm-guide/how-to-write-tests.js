import { dsls } from '@jb6/core'
import '@jb6/common'
import '@jb6/testing'
import '@jb6/llm-guide'

const { 
  tgp: { Const }, 
  common: { data: { pipeline, splitByPivot, enrichGroupProps, asIs }, boolean: { equals } },
  test: { Test, test: { dataTest } },
  'llm-guide': { Doclet, Booklet,
    booklet: { booklet },
    doclet: { principle },
    guidance: { solution, doNot, bestPractice }, 
    explanationPoint: { explanation }
  } 
} = dsls

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
      doNot('// ❌ BAD - test internal data structures', {
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
        badCode: `// ❌ Overly complex data
        // Const('employees', [
        //   {name: 'John Smith Jr.', age: 25, dept: 'sales', salary: 50000, address: {...}, projects: [...]},
        //   // ... 20 more complex objects
        // ])`,
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

Doclet('testDevelopmentWorkflow', {
  impl: principle({
    importance: 'high',
    rule: 'Verify test logic with snippets and probes before writing the actual test',
    rationale: 'Incremental verification prevents test bugs and builds confidence in correctness',
    evidence: explanation('Using __ probes helps understand component behavior before committing to expectations'),
    dslCompIds: ['guidance<llm-guide>solution']
  })
})

Doclet('testNamingClarity', {
  impl: principle({
    importance: '3',
    rule: 'Use descriptive test names that indicate what behavior is being verified',
    rationale: 'Clear names provide documentation and enable quick failure diagnosis',
    evidence: explanation('Test names like "component.behavior" make test organization and purpose immediately clear'),
    dslCompIds: ['guidance<llm-guide>solution', 'guidance<llm-guide>doNot']
  })
})

Doclet('testCoveragePyramid', {
  impl: principle({
    importance: 'high',
    rule: 'Balance component tests (many), integration tests (some), and workflow tests (few)',
    rationale: 'Balanced coverage provides confidence while remaining maintainable',
    evidence: explanation('Most tests at component level provide precise failure localization, fewer integration and workflow tests catch interaction issues'),
    dslCompIds: ['guidance<llm-guide>solution']
  })
})
