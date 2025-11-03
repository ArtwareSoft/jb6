import { dsls, ns } from '@jb6/core'
import { h, L, useState, useEffect, useRef, useContext, reactUtils } from '@jb6/react'
import './react-testers.js'

const { 
  test: { Test, 
      'ui-action': { click, longPress, actions },
      test: { dataTest, reactTest }
  }, 
  common: { Data, Action, Boolean,
    data: { pipeline, filter, join, property, obj, delay }, 
    Boolean: { contains, equals },
    Prop: { prop }
  }
} = dsls

Test('reactTest.helloWorld', {
  impl: reactTest(() => h('div', {}, 'hello world'), contains('hello world'))
})

Test('reactTest.buttonClick', {
  impl: reactTest({
    reactComp: () => {
    const [text, setText] = useState('Click me')
    return h('button', { onClick: () => setText('Clicked!') }, text)
  },
    expectedResult: contains('Clicked!'),
    userActions: actions(click('Click me'))
  })
})

Test('reactTest.buttonClickWithParams', {
  params: [
    {id: 'textAfterClick', as: 'string', defaultValue: 'Clicked!'}
  ],
  impl: reactTest({
    reactComp: ({},{},{textAfterClick}) => {
    const [text, setText] = useState('Click me')
    return h('button', { onClick: () => setText(textAfterClick) }, text)
  },
    expectedResult: contains('%$textAfterClick%'),
    userActions: actions(click('Click me'))
  })
})

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
    reactComp: () => {
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
    reactComp: () => {
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

