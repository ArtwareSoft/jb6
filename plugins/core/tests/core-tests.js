import { Data, Var } from './jb-core.js'
import { Test } from '../../testers/tester.js'
import { dataTest } from '../../testers/data-tester.js'
import { pipeline, equals, delay, join } from '../../common/common.js'

Test('coreTest.datum2', {
  impl: dataTest(pipeline('%%', { data: 'hello' }), equals('hello'))
})

Test('coreTest.propertyPassive', {
  impl: dataTest(property('name', obj(prop('name', 'homer')), { useRef: true }), equals('homer'))
})

Test('test.withDefaultValueComp', {
  params: [
    {id: 'val', defaultValue: pipeline('5')}
  ],
  impl: '%$val%'
})
Test('coreTest.DefaultValueComp', {
  impl: dataTest(test.withDefaultValueComp(), equals(5))
})

Data('test.getAsBool', {
  params: [
    {id: 'val', as: 'boolean', type: 'boolean'}
  ],
  impl: (ctx,{val}) => val
})

Test('coreTest.getRefValueAsBoolean', {
  impl: dataTest(test.getAsBool('%$person/male%'), ({data}) => data === true)
})

Test('coreTest.getExpValueAsBoolean', {
  impl: dataTest(test.getAsBool('%$person/name%==Homer Simpson'), ({data}) => data === true)
})

Test('coreTest.getValueViaBooleanTypeVar', {
  impl: dataTest({
    vars: [Var('a', 'false')],
    calculate: test.getAsBool('%$a%'),
    expectedResult: ({data}) => data === false
  })
})

Test('coreTest.ctx.expOfRefWithBooleanType', {
  impl: dataTest({
    vars: [Var('a', 'false')],
    calculate: ctx => ctx.exp('%$person/male%','boolean'),
    expectedResult: ({data}) => data === true
  })
})

Data('coreTest.nullParamPt', {
  params: [
    {id: 'tst1', as: 'string'}
  ],
  impl: (ctx,tst1) => tst1
})
Test('coreTest.emptyParamAsString', {
  impl: dataTest(coreTest.nullParamPt(), ctx => ctx.data == '' && ctx.data != null)
})

Test('coreTest.asArrayBug', {
  impl: dataTest({
    vars: [
      Var('items', [{id: 1}, {id: 2}])
    ],
    calculate: ctx =>                                                                                                                                                                                                
      ctx.exp('%$items/id%','array'),
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

// Test('coreTest.waitForInnerElements.promiseInArray', {
//   impl: dataTest(()=> [jb.delay(1,1)], equals(()=>[1]))
// })

// Test('coreTest.waitForInnerElements.doublePromiseInArray', {
//   impl: dataTest(()=> [jb.delay(1).then(()=>[jb.delay(1,5)])], equals(5))
// })

// Test('coreTest.waitForInnerElements.cb', {
//   impl: dataTest(()=> [jb.callbag.fromIter([1,2])], equals(()=>[1,2]))
// })

// Test('coreTest.waitForInnerElements.cbAndPromise', {
//   impl: dataTest(()=> [jb.callbag.fromIter([1,2]),jb.delay(1).then(()=>jb.callbag.fromIter([3])),jb.callbag.fromIter([4,5])], equals(()=>[1,2,3,4,5]))
// })

// Test('coreTest.waitForInnerElements.cb', {
//   impl: dataTest(rx.pipe(source.data([1,2])), equals(()=>[1,2]))
// })

Data('test.withArrayParam', {
  params: [
    {id: 'arr', type: 't1[]'}
  ],
  impl: '%$arr%'
})

Data('test.withArrayParam2', {
  params: [
    {id: 'arr', type: 't1[]'}
  ],
  impl: test.withArrayParam('$debugger:%$arr%')
})

Data('test.t1', {
  type: 't1',
  impl: 'txt'
})

Test('coreTest.usingArrayParam', {
  impl: dataTest(test.withArrayParam2(test.t1(), test.t1()), equals(join(','), 'txt,txt'))
})