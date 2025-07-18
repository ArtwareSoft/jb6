import { dsls, ns } from '@jb6/core'
import './mcp-testers.js'

const {
  tgp: { Const},
  test: { Test,
    test: { dataTest, mcpToolTest }
  },
  common: { Data, Action, Boolean,
    data: { pipeline, asIs }, 
    boolean: { equals, contains, notContains, and, not },
    prop: { prop },
  },
} = dsls

Test('mcpTest.scrambleText', {
  HeavyTest: true,
  impl: mcpToolTest('scrambleText', asIs({texts: 'hello world##test text'}), {
    expectedResult: equals('kVmbpZWZk5Wd##\nkVmbpZWZk5Wd', '%stdout/result.content/text%')
  })
})

Test('mcpTest.tgpModel', {
  HeavyTest: true,
  impl: mcpToolTest({
    tool: 'tgpModel',
    args: asIs({repoRoot: '/home/shaiby/projects/jb6', filePath: 'packages/common/common-tests.js'}),
    expectedResult: contains('secondParamAsArray', { allText: '%stdout/result/content/text%' })
  })
})
