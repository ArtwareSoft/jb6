import { dsls, coreUtils, ns } from '@jb6/core'
import '@jb6/testing'
import '@jb6/common'

const { 
  tgp: { Const, 
    var : { Var } 
  },
  common: { Data, Action, Boolean,
    data: { splitByPivot, enrichGroupProps, pipeline, filter, property, obj, prefix, suffix, removePrefix, removeSuffix, 
           toUpperCase, toLowerCase, capitalize, replace, extractPrefix, extractSuffix,
           formatNumber, formatDate, split, groupBy, asIs, 
            }, 
    Boolean: { contains, equals, and, startsWith, endsWith },
    Prop: { prop },
  },
  test: { Test,
    test: { dataTest }
  }
} = dsls
const { group } = ns

// Test data
Const('sampleText', 'hello-world-test')
Const('employees', [
  {name: 'John', age: 25, dept: 'sales', salary: 50000},
  {name: 'Jane', age: 30, dept: 'sales', salary: 60000},
  {name: 'Bob', age: 35, dept: 'tech', salary: 80000},
  {name: 'Alice', age: 28, dept: 'tech', salary: 75000},
  {name: 'Mike', age: 40, dept: 'hr', salary: 55000}
])

Const('testDate', new Date('2023-01-15T10:30:00'))
Const('testObject', {name: 'test', value: 42, items: [1, 2, 3]})

// ===== GROUP BY TESTS =====

Test('groupBy.stepByStep', {
  impl: dataTest({
    calculate: pipeline(
      '%$employees%',
      splitByPivot('dept'),
      enrichGroupProps(group.count('numEmployees')),
      enrichGroupProps(group.max('salary')),
      '%numEmployees% employees max %maxSalary%'
    ),
    expectedResult: equals(asIs(['2 employees max 60000','2 employees max 80000','1 employees max 55000']))
  })
})
  
