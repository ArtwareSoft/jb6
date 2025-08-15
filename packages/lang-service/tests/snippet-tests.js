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

Test('snippet.expression', {
  HeavyTest: true,
  impl: snippetTest('hello', equals('hello', '%result%'))
})

Test('snippet.typeError', {
  HeavyTest: true,
  impl: snippetTest(`dataTest('hey', pipeline())`, contains('can not find comp pipeline', { allText: '%syntaxError%' }))
})

Test('snippet.ns', {
  HeavyTest: true,
  impl: snippetTest({
    profileText: `pipeline(asIs([{a: 1},{a: 1}, {a:2}]), splitByPivot('a'), enrichGroupProps(group.count('aCounter')))`,
    expectedResult: equals('%result/0/aCounter%', 2),
  })
})

Test('snippet.probe', {
  HeavyTest: true,
  impl: snippetTest(`pipeline(asIs([{a: 1}, {a: 2}]), '%__a%')`, equals('1', '%result/0/a%'))
})

Test('snippet.prompt', {
  HeavyTest: true,
  impl: snippetTest(`user('hello')`, equals('hello', '%result/content%'), {
  })
})

Test('snippet.runTest', {
  HeavyTest: true,
  impl: snippetTest('completionTest.param1()', '%result/success%')
})

Test('snippet.runFullTest', {
  HeavyTest: true,
  impl: snippetTest({
    profileText: `dataTest('hey', equals('hey'))`,
    expectedResult: '%result/success%'
  })
})

Test('snippet.runReactTest', {
  HeavyTest: true,
  impl: snippetTest({
    profileText: `reactTest(() => {
    const [text, setText] = useState('Click me')
    return h('button', { onClick: () => setText('Clicked!') }, text)
  }, contains('Clicked!'), {
    userActions: click('Click me')
  })`,
    expectedResult: '%result/success%',
    setupCode: `const { h, L, useState, useEffect, useRef, useContext, reactUtils } = await import('@jb6/react')`
  })
})
