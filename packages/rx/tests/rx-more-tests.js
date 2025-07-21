import { coreUtils, dsls, ns, jb } from '@jb6/core'
import '@jb6/rx'
//import '@jb6/rx/rx-common.js'
//import '@jb6/rx/rx-misc.js'

import '@jb6/testing'

const { rxUtils } = jb
const { log, logError, isPromise, calcPath } = coreUtils
const {
  tgp: { TgpType },
  common: { Data, Action, Boolean,
    data: { pipeline, filter, join, property, obj, delay, asIs }, 
    Boolean: { contains, equals, and },
    Prop: { prop }
  },
  test: { Test, 
    test: { dataTest}
  }
} = dsls
const { rx } = ns


/*
Test('rxTest.queue.add', {
  impl: dataTest({
    calculate: pipe(
      rx.pipe(
        rx.data(1),
        rx.resource('q1', rx.queue(list(1,2,3))),
        rx.do(runActions(delay(1), action.addToQueue('%$q1%', 4))),
        rx.flatMap(source.queue('%$q1%')),
        rx.take(4)
      ),
      join(',')
    ),
    expectedResult: equals('1,2,3,4')
  })
})

Test('rxTest.queue.remove', {
  impl: dataTest({
    calculate: pipe(
      rx.pipe(
        rx.data(1),
        rx.resource('q1', rx.queue(list(1,2,3))),
        rx.do(action.removeFromQueue('%$q1%', 2)),
        rx.flatMap(source.queue('%$q1%')),
        rx.take(2),
        rx.log('test')
      ),
      join(',')
    ),
    expectedResult: equals('1,3')
  })
})


Test('rxTest.fork.cleanActiveSource', {
  impl: dataTest({
    vars: [Var('a', obj())],
    calculate: pipe(
      rx.pipe(
        interval(1),
        rx.log('test 0'),
        rx.fork(rx.take(1), sink.data('%$a/fork%', { data: '%$a/fork%' })),
        rx.skip(1),
        rx.take(1),
        rx.delay(1)
      ),
      join(',')
    ),
    expectedResult: and(() => jb.spy.search('test 0').length == 2, equals('%%,%$a/fork%', '1,0')),
    spy: 'test'
  })
})
*/