import { coreUtils, dsls, ns } from '@jb6/core'
import './react-testers.js'
import '@jb6/react/progress-indicators.js'

const { json } = ns
const {
  tgp: { Component },
  test: { Test,
      'ui-action': { click, longPress, actions, waitForText },
      test: { dataTest, reactTest }
  },
  common: {
    data: { asIs },
    boolean: { contains, equals, and },
  },
  react: { ReactComp,
    'react-comp': { comp },
    'react-metadata': { containerComp, importUrl },
    'progress-indicator': { spinner, dots, byStatus, byProgress }
  }
} = dsls

Test('reactTest.helloWorld', {
  impl: reactTest(({}, {react: {h}}) => () => h('div', {}, 'hello world'), contains('hello world'))
})

Test('reactTest.buttonClick', {
  impl: reactTest({
    testedComp: ({}, {react: {h, useState}}) => () => {
      const [text, setText] = useState('Click me')
      return h('button', { onClick: () => setText('Clicked!') }, text)
    },
    expectedResult: contains('Clicked!'),
    userActions: actions(click('Click me')),
    logger: 'uiLogger'
  })
})

Test('reactTest.use', {
  impl: reactTest({
    testedComp: ({}, {react: {h, use}}) => {
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
    {id: 'p1', as: 'string ', type: 'data<common>', $dslType: 'data<common>'}
  ],
  impl: comp({
    hFunc: ({}, {v1, react: {h}}) => ({p1}) => h('div', {}, `myComp p1: ${p1}, v1: ${v1}`),
    enrichCtx: ctx => ctx.setVars({v1: 'v1Val'})
  })
})

Test('reactTest.usingjbComp', {
  impl: reactTest({
    testedComp: (ctx, {react: {h, hh}}) => () => h('div', {}, hh(ctx, compWithP1AndV1, {p1: 'p1Val'})),
    expectedResult: contains('myComp p1: p1Val, v1: v1Val')
  })
})

const asyncComp = ReactComp('asyncComp', {
  params: [
    {id: 'p1', as: 'string '}
  ],
  impl: comp({
    hFunc: ({}, {v1, react: {h}}) => ({p1}) => h('div', {}, `myComp p1: ${p1}, v1: ${v1}`),
    enrichCtx: ctx => coreUtils.delay(20).then(()=>ctx.setVars({v1: 'v1Val'}))
  })
})

Test('reactTest.asyncComp', {
  impl: reactTest({
    testedComp: (ctx, {react: {h, hh}}) => () => hh(ctx, asyncComp, {p1: 'p1Val'}),
    expectedResult: contains('myComp p1: p1Val, v1: v1Val'),
    userActions: waitForText('v1Val')
  })
})

const userComp = ReactComp('userComp', {
  impl: comp({ hFunc: ({}, {userName, react: {h}}) => () => h('div', {}, `User: ${userName}`) })
})

Test('reactTest.strongRefresh', {
  impl: reactTest({
    testedComp: (ctx, {react: {h, hh, hhStrongRefresh}}) => () => h('div', {}, [
        hh(ctx.setVars({userName: 'John'}), userComp),  // Shows: "User: John" (cached)
        hh(ctx.setVars({ userName: 'Jane' }), userComp),                      // Shows: "User: John" (still cached!)
        hhStrongRefresh(ctx.setVars({ userName: 'Jane' }), userComp)          // Shows: "User: Jane" (fresh)
    ]),
    expectedResult: and(contains('User: John'), contains('User: Jane'))
  })
})

const userCompAsync = ReactComp('userCompAsync', {
  impl: comp({
    hFunc: ({}, {userName, react: {h}}) => () => h('div', {}, `User: ${userName}`),
    enrichCtx: ctx => coreUtils.delay(10).then(()=> ctx)
  })
})

Test('reactTest.strongRefreshAsync', {
  impl: reactTest({
    testedComp: (ctx, {react: {h, hh, hhStrongRefresh}}) => () => h('div', {}, [
        hh(ctx.setVars({userName: 'John'}), userCompAsync),  // Shows: "User: John" (cached)
        hh(ctx.setVars({ userName: 'Jane' }), userCompAsync),                      // Shows: "User: John" (still cached!)
        hhStrongRefresh(ctx.setVars({ userName: 'Jane' }), userCompAsync)          // Shows: "User: Jane" (fresh)
    ]),
    expectedResult: and(contains('User: John'), contains('User: Jane')),
    userActions: waitForText('Jane')
  })
})

const refreshMainInner = ReactComp('refreshMainInner', {
  impl: comp({
    hFunc: ({}, {userName, react: {h}}) => ({refreshMain}) => h('div', {}, [
      h('div', {}, `User: ${userName}`),
      h('button', { onClick: () => refreshMain({userName: 'Jane'}) }, 'Change to Jane')
    ]),
    enrichCtx: ctx => coreUtils.delay(1).then(()=> ctx)
  })
})

Test('reactTest.refreshMainWithNewVars', {
  impl: reactTest({
    testedComp: (ctx, {react: { hhStrongRefresh, useState}}) => () => {
        const [vars, setVars] = useState({userName: 'John'})
        return hhStrongRefresh(ctx.setVars(vars), refreshMainInner, { refreshMain: (vars) => setVars(vars) })
    },
    expectedResult: contains('User: Jane'),
    userActions: actions(waitForText('Change to Jane'), click(), waitForText('Jane'))
  })
})

Test('reactTest.buttonClickWithParams', {
  params: [
    {id: 'textAfterClick', as: 'string', defaultValue: 'Clicked!'}
  ],
  impl: reactTest({
    testedComp: ({}, {react: {h, useState}}, {textAfterClick}) => () => {
      const [text, setText] = useState('Click me')
      return h('button', { onClick: () => setText(textAfterClick) }, text)
    },
    expectedResult: contains('%$textAfterClick%'),
    userActions: actions(click('Click me'))
  })
})

Test('reactTest.buttonForClick', {
  impl: reactTest({
    testedComp: ({}, {react: {h, useState}}) => () => {
    const [text, setText] = useState('Click me')
    return h('button', { onClick: () => setText('Clicked!') }, text)
  },
    expectedResult: contains('Click me'),
  })
})

Test('reactTest.longPress', {
  impl: reactTest({
    testedComp: ({}, {react: {h, useState, useRef}}) => () => {
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

Component('showMe', {
  type: 'react-comp<react>',
  params: [
    {id: 'textToShowAfter', defaultValue: 'after text' }
  ],
  impl: comp({
    hFunc: ({}, {text1, v1, react: {h}}, {textToShowAfter}) => ({}) => h('div', {}, text1, v1, textToShowAfter),
    enrichCtx: ctx => ctx.setVars({text1: ctx.data.text}),
    sampleCtxData: asIs({data: {text: 'hello world'}, vars: {v1: 'v1Val'}})
  })
})

ReactComp('test.sampleContainer', {
  impl: comp({
    hFunc: (ctx, {testedComp, react: {h, hh}}) => ({}) => 
      h('div', {}, 'container', hh(ctx, dsls.react['react-comp'][testedComp]))
  })
})

ReactComp('test.inContainer', {
  impl: comp({
    hFunc: ({}, {react: {h}}) => ({}) => h('div', {}, 'hello'),
    metadata: containerComp('test.sampleContainer')
  })
})

const compWithImportUrl = ReactComp('compWithImportUrl', {
  impl: comp({
    hFunc: ({}, {react: {h}}) => () => h('div', {}, 'importUrl loaded'),
    metadata: importUrl('./tests/test-import-module.mjs')
  })
})

Test('reactTest.importUrl', {
  impl: reactTest({
    testedComp: (ctx, {react: {h, hh}}) => () => hh(ctx, compWithImportUrl),
    expectedResult: contains('importUrl loaded'),
    userActions: waitForText('importUrl loaded')
  })
})

// progress-indicator usage: react-comp.comp renders the progressIndicator while its async enrichCtx is pending.

Test('reactTest.progress.defaultSpinner', {
  impl: reactTest({
    testedComp: comp({
      hFunc: ({}, {react: {h}}) => () => h('div', {}, 'report ready'),
      enrichCtx: ctx => coreUtils.delay(20).then(()=> ctx)
    }),
    expectedResult: contains('spinner', { allText: json.stringify('%$uiLogger/uiLog%') }),
    userActions: waitForText('report ready'),
    logger: 'uiLogger'
  })
})

Test('reactTest.progress.dots', {
  impl: reactTest({
    testedComp: comp({
      hFunc: ({}, {react: {h}}) => () => h('div', {}, 'report ready'),
      enrichCtx: ctx => coreUtils.delay(20).then(()=> ctx),
      progressIndicator: dots('Loading', 10)
    }),
    expectedResult: contains('Loading', { allText: json.stringify('%$uiLogger/uiLog%') }),
    userActions: waitForText('report ready'),
    logger: 'uiLogger'
  })
})

Test('reactTest.progress.byStatus', {
  impl: reactTest({
    testedComp: comp({
      hFunc: ({}, {react: {h}}) => () => h('div', {}, 'model ready'),
      enrichCtx: async (ctx, {uiLogger}) => {
        await coreUtils.delay(10).then(()=> uiLogger.status('1'))
        await coreUtils.delay(10).then(()=> uiLogger.status('232'))
        await coreUtils.delay(0)
        return ctx
      },
      progressIndicator: byStatus('Loading model')
    }),
    expectedResult: contains('1', '232', { allText: json.stringify('%$uiLogger/uiLog%') }),
    userActions: waitForText('232'),
    logger: 'uiLogger'
  })
})

Test('reactTest.progress.byProgress', {
  impl: reactTest({
    testedComp: comp({
      hFunc: ({}, {react: {h}}) => () => h('div', {}, 'report ready'),
      enrichCtx: async (ctx, {uiLogger}) => {
        await coreUtils.delay(10).then(()=> uiLogger.progress({t: 'aggregating', pct: 10}))
        await coreUtils.delay(10).then(()=> uiLogger.progress({t: 'aggregating', pct: 80}))
        await coreUtils.delay(10)
        return ctx
      },
      progressIndicator: byProgress({
        title: 'Loading report',
        logger: 'uiLogger',
        hFunc: ({}, {react: {h}}) => ({progressEvent}) =>
          h('div', {}, `${progressEvent.t} — ${progressEvent.pct}%`)
      })
    }),
    expectedResult: contains('10', '80', { allText: json.stringify('%$uiLogger/uiLog%') }),
    userActions: waitForText('80'),
    logger: 'uiLogger'
  })
})
