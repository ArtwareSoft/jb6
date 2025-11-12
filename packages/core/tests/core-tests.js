import { dsls, coreUtils, ns } from '@jb6/core'
import '@jb6/testing'
import '@jb6/llm-guide'
import '@jb6/core/misc/pretty-print.js'

const { 
  tgp: { Const, TgpType, 
    var : { Var } 
  },
  common: { Data, Action, Boolean,
    data: { pipeline, filter, join, property, obj, delay, asIs }, 
    Boolean: { contains, equals, and },
    Prop: { prop }
  },
  test: { Test,
    test: { dataTest }
  }
} = dsls
const { prettyPrintComp, prettyPrint } = coreUtils
const { math } = ns

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

Test('coreTest.ns', {
  impl: dataTest(pipeline(-2, math.abs()), equals(2))
})

Data('ns1.nsWithRun', {
  params: [
    {id: 'inp', as: 'string'}
  ],
  impl: '%$inp%'
})
const {ns1} = ns

Test('coreTest.nsWith$run', {
  impl: dataTest(() => ns1.nsWithRun.$run('hello'), equals('hello'))
})

Test('coreTest.forwardWith$run', {
  impl: dataTest(() => Data.forward('forward1').$run('hello'), equals('hello'))
})

Data('forward1', {
  params: [
    {id: 'inp', as: 'string'}
  ],
  impl: '%$inp%'
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

const withVarUsingParam = Data('withVarUsingParam', {
  params: [
    {id: 'val', defaultValue: pipeline('5')}
  ],
  impl: pipeline(Var('val1', '%$val%'), '%$val1%')
})

Test('coreTest.withVarUsingParam', {
  impl: dataTest(withVarUsingParam(), equals(5))
})

const getAsBool = Data({
  params: [
    {id: 'val', as: 'boolean', type: 'boolean'}
  ],
  impl: (ctx, {}, {val}) => val
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
  impl: (ctx, {}, {tst1}) => tst1
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

Test('coreTest.asIsArray', {
  impl: dataTest(pipeline(asIs([{a: 1}, {a: 2}]), '%a%', join()), equals('1,2'))
})

// Test('coreTest.and', {
//   impl: dataTest({
//     calculate: pipeline('%$people%', filter(and('%age% < 30', '%name% == Bart Simpson')), '%name%', join()),
//     expectedResult: equals('Bart Simpson')
//   })
// })

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

Test('prettyPrintTest.comp', {
  impl: dataTest({
    calculate: () => prettyPrintComp(dsls.test.test['coreTest.asyncVar'], {tgpModel: jb} ),
    expectedResult: equals(asIs(`tgpComp('coreTest.asyncVar', {
  impl: dataTest(pipeline(Var(), Var(), '%$a%,%$b%'), equals('3,5'))
})`))
  })
})



Test('vmTest.minimal', {
  HeavyTest: true,
  impl: dataTest({
    calculate: async () => {
      const builtIn = {}
      const result = await jb.testingUtils.runTestVm({
          testID: 'coreTest.ns', resources: { entryPointPaths: `${jb.coreRegistry.jb6Root}/packages/core/tests/core-tests.js`}, builtIn })
      return result
    },
    expectedResult: contains('aaa','bbb'),
    timeout: 2000
  })
})

const asIsParam = Data({
  params: [
    {id: 'param', as: 'string', asIs: true}
  ],
  impl: (ctx, {}, {param}) => param
})

Test('expTest.asIsParam', {
  impl: dataTest(asIsParam('%%'), contains('%'))
})

Test('coreUtilsTest.resolveRefs', {
  impl: dataTest({
    calculate: () => {
      const shared = { id: 'shared', value: 42 }
      const dag = {root: [shared,shared], a: {id: 'a', shared}, b : {shared} }
      
      const stripped = coreUtils.stripData(dag)
      const resolved = coreUtils.resolveRefs(stripped)
      const ref = stripped.root[1]
      return `${ref}-${prettyPrint(resolved)}`      
    },
    expectedResult: equals(`[jbReference: root.0]-{\n  root: [\n    {id: 'shared', value: 42},\n    {id: 'shared', value: 42}\n  ],\n  a: {id: 'a', shared: {id: 'shared', value: 42}},\n  b: {shared: {id: 'shared', value: 42}}\n}`)
  })
})
