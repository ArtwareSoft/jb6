import { dsls } from '@jb6/core'
import '@jb6/common'
import '@jb6/testing'

const { 
  tgp: { Const, TgpType, 
    var : { Var } 
  },
  common: { Data, Action, Boolean,
    data: { pipeline, filter, join, property, obj, delay, asIs, count, max, min, first, last, slice, unique }, 
    Boolean: { contains, equals, and, or, not, notContains },
    Prop: { prop }
  },
  test: { Test,
    test: { dataTest }
  }
} = dsls


Const('people2', [
    {name: 'Homer Simpson', age: 42, male: true},
    {name: 'Marge Simpson', age: 38, male: false},
    {name: 'Bart Simpson', age: 12, male: true}
])

Test('piplineTest.filter', {
  impl: dataTest(pipeline('%$people2%', filter('%age%==42'), '%name%'), contains('Homer'))
})

Test('pipelineTest.join', {
  impl: dataTest(
    pipeline('%$people2%', join(',', '', '', '%name%')), 
    contains('Homer Simpson,Marge Simpson,Bart Simpson')
  )
})

Test('pipelineTest.count', {
  impl: dataTest(pipeline('%$people2%', count()), equals(3))
})

Test('pipelineTest.maxAge', {
  impl: dataTest(
    pipeline('%$people2%', max('%age%')),
    equals(42)
  )
})

Test('pipelineTest.minAge', {
  impl: dataTest(
    pipeline('%$people2%', min('%age%')),
    equals(12)
  )
})

Test('pipelineTest.first', {
  impl: dataTest(
    pipeline('%$people2%', first()),
    equals({name: 'Homer Simpson', age: 42, male: true})
  )
})

Test('pipelineTest.last', {
  impl: dataTest(
    pipeline('%$people2%', last()),
    equals({name: 'Bart Simpson', age: 12, male: true})
  )
})

Test('pipelineTest.filterMale', {
  impl: dataTest(
    pipeline('%$people2%', filter('%male%==true'), '%name%'),
    contains('Homer Simpson')
  )
})

Test('pipelineTest.notContains', {
  impl: dataTest(
    pipeline('%$people2%', '%name%'),
    notContains(['Lisa'], '%name%')
  )
})

Test('pipelineTest.and', {
  impl: dataTest(
    and([equals(1, 1), equals(2, 2)]),
    equals(true)
  )
})

Test('pipelineTest.or', {
  impl: dataTest(
    or([equals(1, 2), equals(2, 2)]),
    equals(true)
  )
})

Test('pipelineTest.not', {
  impl: dataTest(
    not(equals(1, 2)),
    equals(true)
  )
})

Test('pipelineTest.slice', {
  impl: dataTest(
    pipeline('%$people2%', slice(1, 3), '%name%'),
    contains('Marge Simpson')
  )
})

Test('pipelineTest.unique', {
  impl: dataTest(
    pipeline([
      {name: 'A', age: 1},
      {name: 'B', age: 2},
      {name: 'A', age: 1}
    ], unique('name')),
    equals([
      {name: 'A', age: 1},
      {name: 'B', age: 2}
    ])
  )
})
