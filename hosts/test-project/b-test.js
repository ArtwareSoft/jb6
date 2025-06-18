import "@jb6/testing"
import { dsls } from "@jb6/core"
import './main.js'

const { 
    common: { Data, Action, Boolean,
      data: { pipeline, cmpB, filter, join, property, obj, delay }, 
      Boolean: { contains, equals },
    },
    test: { Test,
      test: { dataTest }
    }
} = dsls


Test('bTests.cmpB', {
  impl: dataTest(pipeline('hello', cmpB()), contains('hello comp1'))
})

