import { dsls, ns } from '@jb6/core'
import './lang-service-testers.js'

const {
  tgp: { Const
  },
  test: { Test,
    test: { snippetTest, dataTest }
  },
  common: { Data, Action, Boolean,
    data: { calcCompTextAndCursor, pipeline, list, filter, join, property, obj, delay, pipe, first, slice, asIs }, 
    boolean: { equals, contains, notContains, and, not },
    prop: { prop },
  },
} = dsls

Test('snippet.Data', {
  HeavyTest: true,
  impl: snippetTest(`pipeline('hello')`, equals('hello', '%result%'))
})

Test('snippet.exp', {
  HeavyTest: true,
  impl: snippetTest(`'hello'`, equals('hello', '%result%'))
})

Test('snippet.typeError', {
  HeavyTest: true,
  impl: snippetTest(`Test({impl: dataTest('hey', pipeline())})`, contains('boolean', { allText: '%syntaxError%' }))
})

Test('snippet.ns', {
  impl: snippetTest({
    compText: `pipeline(asIs([{a: 1},{a: 1}, {a:2}]), splitByPivot('a'), enrichGroupProps(group.count('aCounter')))`,
    expectedResult: equals('%result/0/aCounter%', 2),
    entryPointPaths: '/home/shaiby/projects/jb6/packages/common/common-tests.js'
  })
})

Test('snippet.probe', {
  HeavyTest: true,
  impl: snippetTest(`pipeline(asIs([{a: 1}, {a: 2}]), '%__a%')`, equals('1', '%result/0/in/data/a%'))
})

Test('snippet.entryPointPaths', {
  impl: snippetTest(`pipeline('hello')`, equals('hello', '%result%'), {
    entryPointPaths: '/home/shaiby/projects/jb6/packages/common/aggregators.js'
  })
})

Test('snippet.llmApiTests', {
  impl: snippetTest(`Prompt('p',{impl:user('hello')})`, equals('hello', '%result/content%'), {
    entryPointPaths: '/home/shaiby/projects/jb6/packages/llm-api/tests/llm-api-tests.js'
  })
})
