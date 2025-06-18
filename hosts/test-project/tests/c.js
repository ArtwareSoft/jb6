import "@jb6/testing"
import { dsls } from "@jb6/core"
import '../main.js'

const { 
    common: { Data, Action, Boolean,
      data: { pipeline, cmpC, filter, join, property, obj, delay }, 
      Boolean: { contains, equals },
    },
    test: { Test,
      test: { dataTest }
    }
} = dsls

Test('cTests.cmpC', {
  impl: dataTest(pipeline('hello', cmpC()), contains('hello cmpC'))
})
