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
  impl: snippetTest(`pipeline('hello')`, equals('hello', '%result%'))
})

Test('snippet.exp', {
  impl: snippetTest(`'hello'`, equals('hello', '%result%'))
})

Test('snippet.typeError', {
  impl: snippetTest(`Test({impl: dataTest('hey', pipeline())})`, contains('boolean', { allText: '%syntaxError%' }))
})

Test('snippet.probe', {
  impl: snippetTest(`pipeline(asIs([{a: 1}, {a: 2}]), '%__a%')`, equals('1', '%result/0/in/data/a%'), {
    probe: true
  })
})

Test('snippet.filePath', {
  doNotRunInTests: true,
  impl: snippetTest(`Data({ impl: pipeline('hello')}) `, equals('hello', '%result%'), {
    filePath: '/home/shaiby/projects/jb6/packages/common/llm-guide/common-llm-guide.js'
  })
})
