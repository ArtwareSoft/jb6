import { dsls, ns } from '@jb6/core'
import { h, L, useState, useEffect, useRef, useContext, reactUtils } from '@jb6/react'

import { } from './react-testers.js'

const { 
  test: { Test, 
    test: { dataTest, reactInBrowserTest }
  }, 
  common: { Data, Action, Boolean,
    data: { pipeline, filter, join, property, obj, delay }, 
    Boolean: { contains, equals },
    Prop: { prop }
  }
} = dsls

Test('reactTest.HelloWorld', {
  impl: reactInBrowserTest(() => h('div', {}, 'hello world'), { expectedResult: contains('hello world') })
})

