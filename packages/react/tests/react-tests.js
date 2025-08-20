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

Test('reactTest.buttonForClick', {
  impl: reactTest({
    reactComp: () => {
    const [text, setText] = useState('Click me')
    return h('button', { onClick: () => setText('Clicked!') }, text)
  },
    expectedResult: contains('Clicked!'),
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

