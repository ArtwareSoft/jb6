import { dsls, coreUtils, ns } from '@jb6/core'
import '@jb6/testing'
import '@jb6/jq'

const { 
  tgp: { Const, TgpType, 
    var : { Var } 
  },
  common: { Data, Action, Boolean,
    data: { jq , pipeline, filter, join, property, obj, delay, asIs, first }, 
    Boolean: { contains, equals, and },
    Prop: { prop }
  },
  test: { Test,
    test: { dataTest }
  }
} = dsls

Test('jqTest.simple', {
  impl: dataTest(pipeline(Var('myVar', 5), asIs({x: [{y: 2}, {y: 4}]}), jq('.x[].y + $myVar')), equals([7,9]))
})

Test('jqTest.groupBy', {
  impl: dataTest({
    calculate: pipeline(
      asIs({
          people: [
            {name: 'Alice', age: 25, department: 'Engineering'},
            {name: 'Bob', age: 30, department: 'Engineering'},
            {name: 'Charlie', age: 28, department: 'Sales'},
            {name: 'David', age: 35, department: 'Sales'},
            {name: 'Eve', age: 22, department: 'Marketing'}
          ]
      }),
      jq('.people | group_by(.department)'),
      jq('map({department: .[0].department, count: length, avgAge: (map(.age) | add / length), members: map(.name)})'),
      first()
    ),
    expectedResult: equals([
      {department: 'Engineering', count: 2, avgAge: 27.5, members: ['Alice','Bob']},
      {department: 'Sales', count: 2, avgAge: 31.5, members: ['Charlie','David']},
      {department: 'Marketing', count: 1, avgAge: 22, members: ['Eve']}
    ])
  })
})