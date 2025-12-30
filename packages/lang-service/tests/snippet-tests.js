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
const { json }  = ns

Test('snippet.Data', {
  HeavyTest: true,
  impl: snippetTest(`pipeline('hello')`, equals('hello'))
})

Test('snippet.rx', {
  HeavyTest: true,
  impl: snippetTest({
    profileText: `pipe(
  rx.pipe(
    rx.data(list('h', 'he', 'hel', 'hell', 'hello', 'hello w', 'hello wo', 'hello wor', 'hello worl', 'hello world')),
    rx.debounceTime(1),
    rx.map('Search: %%'),
    rx.distinctUntilChanged(),
  ),
  join(',')
)`,
    expectedResult: equals('Search: h,Search: he,Search: hel,Search: hell,Search: hello,Search: hello w,Search: hello wo,Search: hello wor,Search: hello worl,Search: hello world')
  })
})

Test('snippet.expression', {
  HeavyTest: true,
  impl: snippetTest('hello', equals('hello'))
})

Test('snippet.typeError', {
  HeavyTest: true,
  impl: snippetTest(`dataTest('hey', pipeline())`, contains('can not find comp pipeline', { allText: '%syntaxError%' }))
})

Test('snippet.ns', {
  HeavyTest: true,
  impl: snippetTest({
    profileText: `pipeline(asIs([{a: 1},{a: 1}, {a:2}]), splitByPivot('a'), enrichGroupProps(group.count('aCounter')))`,
    expectedResult: equals('%0/aCounter%', 2),
  })
})

Test('snippet.probe', {
  HeavyTest: true,
  impl: snippetTest(`pipeline(asIs([{a: 1}, {a: 2}]), '%__a%')`, equals('1', '%0/in/data/a%'))
})

Test('snippet.prompt', {
  HeavyTest: true,
  impl: snippetTest(`user('hello')`, equals('hello', '%content%'), {
  })
})

Test('snippet.runTest', {
  HeavyTest: true,
  impl: snippetTest('completionTest.param1()', '%success%')
})

Test('snippet.runFullTest', {
  HeavyTest: true,
  impl: snippetTest({
    profileText: `dataTest('hey', equals('hey'))`,
    expectedResult: '%success%'
  })
})

Test('snippet.runReactTest', {
  HeavyTest: true,
  impl: snippetTest({
    profileText: `reactTest(({},{react: {h, useState}}) => () => {
    const [text, setText] = useState('Click me')
    return h('button', { onClick: () => setText('Clicked!') }, text)
  }, contains('Clicked!'), {
    userActions: click('Click me')
  })`,
    expectedResult: '%success%',
  })
})

Test('snippet.pipeline', {
  HeavyTest: true,
  impl: snippetTest(`pipeline('%$people%', '%name%')`, contains('Homer', { allText: json.stringify() }), {
    setupCode: `Const('people', [{name: 'Homer', age: 42}, {name: 'Bart', age: 12}, {name: 'Lisa', age: 10}])`
  })
})

Test('genieTest.snippet.jb', {
  HeavyTest: true,
  impl: snippetTest(`pipeline('%$people%', '%name%')`, contains('Homer', { allText: json.stringify() }), {
    setupCode: `Const('people', [{name: 'Homer', age: 42}, {name: 'Bart', age: 12}, {name: 'Lisa', age: 10}])`,
    repoRoot: '/home/shaiby/projects/Genie',
    fetchByEnvHttpServer: 'http://localhost:3000'
  })
})
