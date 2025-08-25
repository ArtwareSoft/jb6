import { dsls, coreUtils, ns } from '@jb6/core'
import '@jb6/testing'
import '@jb6/jq'

const { 
  tgp: { Const, TgpType, 
    var : { Var } 
  },
  common: { Data, Action, Boolean,
    data: { jq , pipeline, filter, join, property, obj, delay, asIs }, 
    Boolean: { contains, equals, and },
    Prop: { prop }
  },
  test: { Test,
    test: { dataTest }
  }
} = dsls

Test('jqTest.simple', {
  impl: dataTest(pipeline(asIs({x: [{y: 2}, {y: 4}]}), jq('.x[].y')), equals([2,4]))
})