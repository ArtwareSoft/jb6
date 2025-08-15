import { dsls, ns } from '@jb6/core'
import './mcp-testers.js'
import '@jb6/llm-api/llm-api-mcp-tools.js'

const {
  tgp: { Const},
  test: { Test,
    test: { dataTest, mcpToolTest }
  },
  common: { Data, Action, Boolean,
    data: { pipeline, asIs, tgpModel }, 
    boolean: { equals, contains, notContains, and, not },
    prop: { prop },
  },
} = dsls
const { json } = ns

Test('mcpTest.scrambleText', {
  HeavyTest: true,
  impl: mcpToolTest('scrambleText', asIs({texts: 'hello world##test text'}), {
    expectedResult: equals('=QGby92dg8GbsVGa##\n0hXZ0BCdzVGd', '%stdout/result/content/text%')
  })
})

Test('mcpTest.resultArrayBug', {
  HeavyTest: true,
  impl: mcpToolTest('scrambleText', asIs({texts: 'hello world##test text'}), {
    expectedResult: ({data}) => !Array.isArray(data.stdout.result)
  })
})

Test('mcpTest.tgpModel', {
  HeavyTest: true,
  impl: mcpToolTest({
    tool: 'tgpModel',
    args: asIs({forDsls: 'common'}),
    expectedResult: contains('secondParamAsArray', { allText: '%stdout/result/content/text%' })
  })
})

Test('autoGenTest.tgpModel', {
  HeavyTest: true,
  impl: dataTest(tgpModel('common', { includeLocation: true }), contains('items', { allText: json.stringify('%dsls/common/data/min%') }))
})

Test('mcpTest.bookletsContent', {
  HeavyTest: true,
  impl: mcpToolTest({
    tool: 'bookletsContentTool',
    args: asIs({booklets: 'tgpPrimer'}),
    expectedResult: contains('secondParamAsArray', { allText: '%stdout/result/content/text%' })
  })
})

Test('mcpTest.snippet.pipeline', {
  HeavyTest: true,
  impl: mcpToolTest({
    tool: 'runSnippet',
    args: asIs({
        profileText: `pipeline('%$people%', '%name%')`,
        setupCode: `Const('people', [{name: 'Homer', age: 42}, {name: 'Bart', age: 12}, {name: 'Lisa', age: 10}])`
    }),
    expectedResult: contains('Homer', { allText: '%stdout/result/content/text%'} )
  })
})

