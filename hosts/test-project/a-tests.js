import "@jb6/testing"
import "@jb6/common"
import { coreUtils, dsls } from "@jb6/core"
import './main.js'

const { 
    tgp: { Const, TgpType,
      var : { Var } 
    },
    'common': { Data, Action, Boolean,
      data: { pipeline, cmpA, filter, join, property, obj, delay, asIs }, 
      Boolean: { contains, equals },
      Prop: { prop }
    },
    test: { Test,
      test: { dataTest }
    }
} = dsls

// DefComponents('abs,acos', templateParam => Data(`math.${templateParam}`, {
//     autoGen: true,
//     category: 'math:70',
//     params: [
//       {id: 'func', as: 'string', defaultValue: templateParam}
//     ],
//     impl: (ctx, {}, {func}) => Math[func](ctx.data)
//   })
// )

Test('myTests.HelloWorld', {
  impl: dataTest(pipeline('hello world'), contains('world'))
})

Test('myTests.statusViaStderr', {
  impl: dataTest(async () => {
    coreUtils.broadcastStatus('1')
    await coreUtils.delay(20)
    coreUtils.broadcastStatus('2')
    return 'hi'
  } , contains('hi'))
})

Test('aTests.testCmpA', {
  impl: dataTest(pipeline(Var('personA', asIs({name: 'Dan'})), 'hello', cmpA()), contains('hello cmpA'))
})

Test('how', { impl: '' })
