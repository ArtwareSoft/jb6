import "@jb6/testing"
import "@jb6/common"
import { dsls } from "@jb6/core"
const { 
    tgp: { Const, TgpType, 
      var : { Var } 
    },
    common: { Data, Action, Boolean,
      data: { pipeline, filter, join, property, obj, delay }, 
      Boolean: { contains, equals },
      Prop: { prop }
    },
    test: { Test,
      test: { dataTest }
    }
} = dsls

Test('myTests.HelloWorld', {
  impl: dataTest(pipeline('hello world'), contains('world'))
})


