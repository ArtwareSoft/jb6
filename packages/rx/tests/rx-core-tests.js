import { coreUtils, dsls, ns, jb } from '@jb6/core'
import '@jb6/rx'
import '@jb6/testing'

const { rxUtils } = jb
const { log, logError, isPromise, calcPath } = coreUtils
const {
  tgp: { TgpType },
  common: { Data, Action, Boolean,
    data: { pipeline, filter, join, property, obj, delay, asIs, pipe, list }, 
    Boolean: { contains, equals, and },
    Prop: { prop }
  },
  test: { Test, 
    test: { dataTest}
  }
} = dsls
const { rx } = ns

Test('rxTest.pipeWithObservable', {
  impl: dataTest(pipe(ctx => rxUtils.fromIter([1,2]), '%%a', join()), equals('1a,2a'))
})
  
Test('rxTest.mapPromise', {
  impl: dataTest(rx.pipe(rx.data(0), rx.mapPromise(({data}) => coreUtils.delay(1,data+2))), equals('2'))
})

Test('rxTest.doPromise', {
  impl: dataTest({
    calculate: rx.pipe(rx.data(1), rx.doPromise(delay(1, '-%%-')), rx.mapPromise(delay(1, '-%%-'))),
    expectedResult: equals('-1-')
  })
})

Test('rxTest.pipe', {
  impl: dataTest({
    calculate: pipe(rx.pipe(rx.data(list('1','2','3','4')), rx.map('-%%-')), join(',')),
    expectedResult: equals('-1-,-2-,-3-,-4-')
  })
})
