import { coreUtils, dsls, ns } from '@jb6/core'
import './react-testers.js'

const { 
  test: { Test, 
      'ui-action': { click, longPress, actions, waitForText },
      test: { dataTest, reactTest }
  }, 
  common: { Data, Action, Boolean,
    data: { pipeline, filter, join, property, obj, delay }, 
    Boolean: { contains, equals },
    Prop: { prop }
  },
  react: { ReactComp, HFunc,
    'react-comp': { comp, compWithAsyncCtx },
  }
} = dsls

Test('reactTest.helloWorld', {
  impl: reactTest(({}, {react: {h}}) => () => h('div', {}, 'hello world'), contains('hello world'))
})

Test('reactTest.buttonClick', {
  impl: reactTest({
    hFunc: ({}, {react: {h, useState}}) => () => {
      const [text, setText] = useState('Click me')
      return h('button', { onClick: () => setText('Clicked!') }, text)
    },
    expectedResult: contains('Clicked!'),
    userActions: actions(click('Click me'))
  })
})

Test('reactTest.use', {
  impl: reactTest({
    hFunc: ({}, {react: {h, use}}) => {
      const textPromise = coreUtils.delay(20).then(()=>'hello')
      return () => {
        const text = use(textPromise)
        return h('div', {}, text)
      }
    },
    expectedResult: contains('hello'),
    userActions: waitForText('hello')
  })
})

const compWithP1AndV1 = ReactComp('compWithP1AndV1', {
  params: [
    {id: 'p1', as: 'string '}
  ],
  impl: comp({
    hFunc: ({}, {v1, react: {h}} , {p1}) => 
      () => h('div', {}, `myComp p1: ${p1}, v1: ${v1}` ),
    enrichCtx: ctx => ctx.setVars({v1: 'v1Val'})
  })
})

const asyncComp = ReactComp('asyncComp', {
  params: [
    {id: 'p1', as: 'string '}
  ],
  impl: compWithAsyncCtx(({}, {v1, react: {h}} , {p1}) => 
      () => h('div', {}, `myComp p1: ${p1}, v1: ${v1}` ), {
    enrichCtx: ctx => coreUtils.delay(20).then(()=>ctx.setVars({v1: 'v1Val'}))
  })
})

Test('reactTest.usingjbComp', {
  impl: reactTest(compWithP1AndV1('p1Val'), contains('myComp p1: p1Val, v1: v1Val'))
})

Test('reactTest.usingjbCompWithHH', {
  impl: reactTest({
    hFunc: (ctx, {react: {h, hh}}) => () => hh(ctx, compWithP1AndV1('p1Val')),
    expectedResult: contains('myComp p1: p1Val, v1: v1Val')
  })
})

Test('reactTest.usingjbCompWith$run', {
  impl: reactTest({
    hFunc: (ctx, {react: {h}}) => () => h('div', {}, compWithP1AndV1.$runWithCtx(ctx,'p1Val')() ),
    expectedResult: contains('myComp p1: p1Val, v1: v1Val')
  })
})

Test('reactTest.asyncComp', {
  impl: reactTest(asyncComp('p1Val'), contains('myComp p1: p1Val, v1: v1Val'), {
    userActions: waitForText('v1Val')
  })
})

Test('reactTest.usingAsyncCompWithHH', {
  doNotRunInTests: true,
  impl: reactTest({
    hFunc: (ctx, {react: {h, hh}}) => () => hh(ctx, asyncComp('p1Val')),
    expectedResult: contains('myComp p1: p1Val, v1: v1Val'),
    userActions: waitForText('v1Val')
  })
})

Test('reactTest.use.erichCtxAsync', {
  impl: reactTest({
    hFunc: (ctx, {react: {h, use}}) => {
      const ctxPromise = enrichCtx(ctx)
      return () => {
        const ctx = use(ctxPromise)
        const { text } = ctx.vars
        return h('div', {}, text)
      }

      function enrichCtx(ctx) {
        return coreUtils.delay(20).then(() => ctx.setVars({text: 'hello'}))
      }
    },
    expectedResult: contains('hello'),
    userActions: waitForText('hello')
  })
})

Test('reactTest.use.erichCtxAsync.inner', {
  impl: reactTest({
    hFunc: (ctx, {react: {h, use}}) => {
      const ctxPromise = enrichCtx(ctx)
      const comp1 = () => {
        const ctx = use(ctxPromise)
        const { text } = ctx.vars
        return h('div', {}, text)
      }

      return () => h(comp1)

      function enrichCtx(ctx) {
        return coreUtils.delay(20).then(() => ctx.setVars({text: 'hello'}))
      }
    },
    expectedResult: contains('hello'),
    userActions: waitForText('hello')
  })
})

Test('reactTest.buttonClickWithParams', {
  params: [
    {id: 'textAfterClick', as: 'string', defaultValue: 'Clicked!'}
  ],
  impl: reactTest({
    hFunc: ({}, {react: {h, useState}}, {textAfterClick}) => () => {
      const [text, setText] = useState('Click me')
      return h('button', { onClick: () => setText(textAfterClick) }, text)
    },
    expectedResult: contains('%$textAfterClick%'),
    userActions: actions(click('Click me'))
  })
})

// These tests fails in probe-view. it is OK
Test('reactTest.cli', {
  HeavyTest: true,
  impl: dataTest({
    calculate: async () => {
    const result = await jb.testingUtils.runTestCli('reactTest.buttonClickWithParams', {textAfterClick : 'kuki'},  {entryPointPaths: `${jb.coreRegistry.jb6Root}/packages/react/tests/react-tests.js`})
    return result?.result?.testRes
  },
    expectedResult: contains('kuki'),
    timeout: 2000
  })
})

Test('reactTest.vm', {
  HeavyTest: true,
  impl: dataTest({
    calculate: async () => {
    const builtIn = { JSDOM: 'jsdom' }
    const results = await Promise.all([
      jb.testingUtils.runTestVm({
        testID: 'reactTest.buttonClickWithParams', params: {textAfterClick : 'aaa'}, 
        resources: { entryPointPaths: `${jb.coreRegistry.jb6Root}/packages/react/tests/react-tests.js`}, builtIn }),
      jb.testingUtils.runTestVm({
          testID: 'reactTest.buttonClickWithParams', params: {textAfterClick : 'bbb'}, 
          resources: { entryPointPaths: `${jb.coreRegistry.jb6Root}/packages/react/tests/react-tests.js`}, builtIn }),
     ])
    return results.map(r=> r?.testRes).join(',')
  },
    expectedResult: contains('aaa','bbb'),
    timeout: 2000
  })
})

Test('reactTest.buttonForClick', {
  impl: reactTest({
    hFunc: ({}, {react: {h, useState}}) => () => {
    const [text, setText] = useState('Click me')
    return h('button', { onClick: () => setText('Clicked!') }, text)
  },
    expectedResult: contains('Click me'),
  })
})

// Test('reactTest.err', {
//   impl: reactTest(() => h('div'), contains('Clicked!'), {
//     userActions: [
//       waitForSelector('aaaaaaaaaaaaaaaaaaaaaa'),
//       click(),
//       waitForText()
//     ]
//   })
// })

Test('reactTest.longPress', {
  impl: reactTest({
    hFunc: ({}, {react: {h, useState, useRef}}) => () => {
      const [text, setText] = useState('LongPress me')
      const timeoutRef = useRef(null)
      
      const start = () => timeoutRef.current = setTimeout(() => setText('LongPress!'), 20)
      const stop = () => { 
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
      }
      
      return h('div:cursor-pointer', { 
        onMouseDown: start, onMouseUp: stop, onTouchStart: start, onTouchEnd: stop
      }, h('div',{}, h('div',{}, text)))
    },
    expectedResult: contains('LongPress!'),
    userActions: longPress('LongPress me', { timeToPress: 30 })
  })
})

