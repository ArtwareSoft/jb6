import { dsls, coreUtils } from '@jb6/core'
import {} from '@jb6/testing'
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


Const('person', {
    name: 'Homer Simpson',
    male: true,
    isMale: 'yes',
    age: 42
})

Const('peopleWithChildren', [
  {
    name: 'Homer',
    children: [{name: 'Bart'}, {name: 'Lisa'}],
  },
  {
    name: 'Marge',
    children: [{name: 'Bart'}, {name: 'Lisa'}],
  }
])

Const('personWithChildren', {
    name: "Homer Simpson",
    children: [{ name: 'Bart' }, { name: 'Lisa' }, { name: 'Maggie' } ],
    friends: [{ name: 'Barnie' } ],
})
  
Const('people', [
    {name: 'Homer Simpson', age: 42, male: true},
    {name: 'Marge Simpson', age: 38, male: false},
    {name: 'Bart Simpson', age: 12, male: true}
])

Test('coreTest.datum2', {
  impl: dataTest(pipeline('%%', { data: 'hello' }), equals('hello'))
})

Test('coreTest.propertyPassive', {
  impl: dataTest(property('name', obj(prop('name', 'homer')), { useRef: true }), equals('homer'))
})

const withDefaultValueComp = Data('withDefaultValueComp', {
  params: [
    {id: 'val', defaultValue: pipeline('5')}
  ],
  impl: '%$val%'
})

Test('coreTest.DefaultValueComp', {
  impl: dataTest(withDefaultValueComp(), equals(5))
})

const getAsBool = Data({
  params: [
    {id: 'val', as: 'boolean', type: 'boolean'}
  ],
  impl: (ctx,{val}) => val
})

Test('myTests.HelloWorld', {
  impl: dataTest(pipeline('hello world'), contains('world'))
})

Test('coreTest.getExpValueAsBoolean', {
  impl: dataTest(getAsBool('%$person/name%==Homer Simpson'), ({data}) => data === true)
})

Test('coreTest.getValueViaBooleanTypeVar', {
  impl: dataTest({
    vars: [Var('a', 'false')],
    calculate: getAsBool('%$a%'),
    expectedResult: ({data}) => data === false
  })
})

const nullParamPt = Data({
  params: [
    {id: 'tst1', as: 'string'}
  ],
  impl: (ctx,{tst1}) => tst1
})
Test('coreTest.emptyParamAsString', {
  impl: dataTest(nullParamPt(), ctx => ctx.data == '' && ctx.data != null)
})

Test('coreTest.asArrayBug', {
  impl: dataTest({
    vars: Var('items', [{id: 1}, {id: 2}]),
    calculate: ctx => ctx.exp('%$items/id%','array'),
    expectedResult: ctx => ctx.data[0] == 1 && !Array.isArray(ctx.data[0])
  })
})

Test('coreTest.varsCases', {
  impl: dataTest({
    vars: [
      Var('items', [{id: 1}, {id: 2}])
    ],
    calculate: pipeline(Var('sep', '-'), '%$items/id%', '%% %$sep%', join()),
    expectedResult: equals('1 -,2 -')
  })
})

Test('coreTest.asyncVar', {
  impl: dataTest(pipeline(Var('b', 5), Var('a', delay(1, 3), { async: true }), '%$a%,%$b%'), equals('3,5'))
})

Test('coreTest.waitForInnerElements.promiseInArray', {
  impl: dataTest(()=> [coreUtils.delay(1,1)], equals(()=>[1]))
})

Test('coreTest.waitForInnerElements.doublePromiseInArray', {
  impl: dataTest(()=> [coreUtils.delay(1).then(()=>[coreUtils.delay(1,5)])], equals(5))
})

const withArrayParam = Data({
  params: [
    {id: 'arr', type: 't1[]'}
  ],
  impl: '%$arr%'
})

const withArrayParam2 = Data({
  params: [
    {id: 'arr', type: 't1[]'}
  ],
  impl: withArrayParam('%$arr%')
})

const t1 = Data({
  type: 't1',
  impl: 'txt'
})

Test('coreTest.usingArrayParam', {
  impl: dataTest(withArrayParam2(t1(), t1()), equals(join(','), 'txt,txt'))
})

Test('expTest.select', {
  impl: dataTest({
    calculate: pipeline('%$peopleWithChildren%', pipeline(Var('parent'), '%children%', '%name% is child of %$parent/name%'), join()),
    expectedResult: equals(
      'Bart is child of Homer,Lisa is child of Homer,Bart is child of Marge,Lisa is child of Marge'
    )
  })
})

Test('expTest.boolean', {
  impl: dataTest(pipeline('%$people%', filter('%age%==42'), '%name%'), contains('Homer'))
})

Test('expTest.dynamicExp', {
  impl: dataTest(pipeline('name','%$people/{%%}%'), contains('Homer'))
})

Test('expTest.expWithArray', {
  impl: dataTest('%$personWithChildren/children[0]/name%', equals('Bart'))
})

Test('expTest.arrayLength', {
  impl: dataTest('%$personWithChildren/children/length%', equals(3))
})

Test('expTest.stringLength', {
  impl: dataTest('%$personWithChildren/name/length%', equals(13))
})

Test('expTest.activateMethod', {
  impl: dataTest({
    vars: [
      Var('o1', () => ({ f1: () => ({a:5}) }))
    ],
    calculate: '%$o1/f1()/a%',
    expectedResult: equals(5)
  })
})

Test('expTest.conditionalText', {
  impl: dataTest({
    vars: [
      Var('full', 'full'),
      Var('empty', '')
    ],
    calculate: '{?%$full% is full?}{?%$empty% is empty?}',
    expectedResult: equals('full is full')
  })
})

Test('expTest.expWithArrayVar', {
  impl: dataTest({
    vars: [
      Var('children', '%$personWithChildren/children%')
    ],
    calculate: '%$children[0]/name%',
    expectedResult: equals('Bart')
  })
})