import { dsls, ns } from '@jb6/core'
import './mcp-testers.js'

const {
  tgp: { Const},
  test: { Test,
    test: { dataTest, mcpToolTest }
  },
  common: { Data, Action, Boolean,
    data: { pipe, pipeline, asIs, tgpModel, keys, join, filter }, 
    boolean: { equals, contains, notContains, and, not },
    prop: { prop },
  },
} = dsls
const { json } = ns

Test('mcpTest.scrambleText', {
  HeavyTest: true,
  impl: mcpToolTest('scrambleText', asIs({texts: 'hello world##test text'}), {
    expectedResult: equals('=QGby92dg8GbsVGa##\n0hXZ0BCdzVGd')
  })
})

Test('mcpTest.compileTailwindCSS', {
  HeavyTest: true,
  impl: mcpToolTest('compileTailwindCSS', asIs({html: '<div class="p-6"></div>'}), {
    expectedResult: contains('padding: calc(var(--spacing) * 6')
  })
})

Test('mcpTest.compileTailwindCSSChart', {
  HeavyTest: true,
  impl: mcpToolTest('compileTailwindCSS', asIs({html: `<div class="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-6">
  <h2 class="text-2xl font-bold text-center mb-6">TITLE HERE</h2>
  <div class="space-y-4">
    <!-- Bars go here -->
  </div>
</div>`}), {
    expectedResult: contains('padding: calc(var(--spacing) * 6')
  })
})

Test('genieMcpTest.scrambleText', {
  HeavyTest: true,
  impl: mcpToolTest('scrambleText', asIs({texts: 'hello world##test text'}), {
    repoRoot: '/home/shaiby/projects/Genie',
    jb6PackagesRoot: '/home/shaiby/projects/Genie/public/3rd-party/@jb6',
    importMapsInCli: './public/core/nodejs-importmap.js',
    expectedResult: equals('=QGby92dg8GbsVGa##\n0hXZ0BCdzVGd')
  })
})

Test('genieMcpTest.tgpModel', {
  HeavyTest: true,
  impl: mcpToolTest('tgpModel', asIs({forDsls: 'common'}), {
    repoRoot: '/home/shaiby/projects/Genie',
    jb6PackagesRoot: '/home/shaiby/projects/Genie/public/3rd-party/@jb6',
    importMapsInCli: './public/core/nodejs-importmap.js',
    expectedResult: contains('boolean<common>')
  })
})

Test('genieMcpTest.wonderWorkflow', {
  HeavyTest: true,
  doNotRunInTests: true,
  impl: mcpToolTest('wonderWorkflow', asIs({userMessage: 'say hello'}), {
    repoRoot: '/home/shaiby/projects/Genie',
    jb6PackagesRoot: '/home/shaiby/projects/Genie/public/3rd-party/@jb6',
    importMapsInCli: './public/core/nodejs-importmap.js',
    expectedResult: contains('ello')
  })
})

Test('genieMcpTest.snippet', {
  HeavyTest: true,
  impl: mcpToolTest({
    tool: 'runSnippet',
    args: asIs({
        profileText: `pipeline('%$people%', '%name%')`,
        setupCode: `Const('people', [{name: 'Homer', age: 42}, {name: 'Bart', age: 12}, {name: 'Lisa', age: 10}])`
    }),
    repoRoot: '/home/shaiby/projects/Genie',
    jb6PackagesRoot: '/home/shaiby/projects/Genie/public/3rd-party/@jb6',
    importMapsInCli: './public/core/nodejs-importmap.js',
    expectedResult: contains('Homer')
  })
})

Test('mcpTest.tgpModel', {
  HeavyTest: true,
  impl: mcpToolTest('tgpModel', asIs({forDsls: 'common'}), { expectedResult: contains('common') })
})

// Test('autoGenTest.allBooklets', {
//   HeavyTest: true,
//   impl: dataTest({
//     calculate: pipe(tgpModel('llm-guide'), '%dsls/llm-guide/booklet%', keys(), filter('%% != booklet'), join()),
//     expectedResult: contains('commonDslQuizzes')
//   })
// })

Test('mcpTest.listBooklets', {
  HeavyTest: true,
  impl: mcpToolTest('listBooklets', asIs(), { expectedResult: contains('commonDslQuizzes') })
})

Test('mcpTest.bookletsContent', {
  HeavyTest: true,
  impl: mcpToolTest({
    tool: 'bookletsContentTool',
    args: asIs({booklets: 'tgpPrimer'}),
    expectedResult: contains('secondParamAsArray')
  })
})

Test('mcpTest.snippet', {
  HeavyTest: true,
  impl: mcpToolTest({
    tool: 'runSnippet',
    args: asIs({
        profileText: `pipeline('%$people%', '%name%')`,
        setupCode: `Const('people', [{name: 'Homer', age: 42}, {name: 'Bart', age: 12}, {name: 'Lisa', age: 10}])`
    }),
    expectedResult: contains('Homer')
  })
})

