import { dsls, ns, coreUtils } from '@jb6/core'
import {} from '@jb6/testing'
import {} from '@jb6/remote'
import {} from '@jb6/lang-service'
import {} from './lang-service-testers.js'
const { langService, jbm } = ns

const { 
  tgp: { Const, TgpType, 
    var : { Var } 
  },
  common: { Data, Action, Boolean,
    data: { calcCompTextAndCursor, pipeline, filter, join, property, obj, delay }, 
    Boolean: { contains, equals },
    Prop: { prop }
  },
  jbm: { Jbm },
  test: { Test,
    test: { dataTest }
  }
} = dsls
const { remote } = ns

Jbm('jbm.langServer',{
  impl: jbm.rpc(8088)
})

const langServer = profile => jbm.langServer.$run().rjbm.remoteExec({profile})

Test('langServerTest.completions', {
    doNotRunInTests: true,
    impl: dataTest(async () => {
      const compTextAndCursor = await calcCompTextAndCursor.$run('dataTest(pipeline(l__ist()))')
      const res = await langServer(langService.completionItems.$resolve({compTextAndCursor}))
      return res
    }, contains())
})

