import { dsls, ns } from '@jb6/core'
import { h, L, useState, useEffect, useRef, useContext, reactUtils } from '@jb6/react'
import './react-testers.js'

const { 
  test: { Test, 
    test: { dataTest, reactTest }
  }, 
  common: { Data, Action, Boolean,
    data: { pipeline, filter, join, property, obj, delay }, 
    Boolean: { contains, equals },
    Prop: { prop }
  }
} = dsls

Test('reactTest.HelloWorld', {
  impl: reactTest(() => h('div', {}, 'hello world'), contains('hello world'))
})

