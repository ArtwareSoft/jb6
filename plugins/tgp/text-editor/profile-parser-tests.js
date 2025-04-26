import { Test, actionMapTest} from './profile-parser-testers.js'
import { prettyPrintWithPositions, prettyPrint} from '../formatter/pretty-print.js'
import { getPosOfPath} from './tgp-text-editor.js'
import { jb } from '../../core/jb-core.js'
import { pipeline, split, Var, list, Data } from '../../common/jb-common.js'

Test('actionMapTest.simple', {
  impl: actionMapTest(() => split(',' , {text: '%%', part: 'first'}), 'data<>', 'propInfo!~part', '29,35')
})

Test('actionMapTest.varsPath', {
  impl: actionMapTest(() => split({vars: [Var('a', 100), Var('b', 'txt')]}), 'data<>', 'edit!~vars~0~val', '26,26')
})

Test('actionMapTest.varsPathSingleVar', {
  impl: actionMapTest(() => split({vars: Var('a', 'b')}), 'data<>', 'edit!~vars~0~val', '27,27')
})

Test('actionMapTest.varsPathInPipeline', {
  impl: actionMapTest(() => pipeline(Var('a', 'b'),''), 'data<>', 'edit!~vars~0~val', '19,19')
})

/*

Data('actionMapTest.singleParamByNameComp', {
  params: [
    {id: 'p1', as: 'boolean', type: 'boolean<>', byName: true}
  ]
})


Test('actionMapTest.singleParamByName', {
  impl: actionMapTest(() => pipeline(actionMapTest.singleParamByNameComp({p1: true})), 'data<>', 'begin!~source~p1', '48,48')
})

Test('actionMapTest.secondParamAsArray', {
  impl: actionMapTest(() => pipeline(list(1,2), '%%'), 'data<>', 'begin!~items~0', '20,20')
})

Test('actionMapTest.secondParamAsArrayWithVars', {
  impl: actionMapTest(() => pipeline(Var('a', 3), '%%', 'aa'), 'data<>', 'begin!~items~0', '28,28')
})

Test('actionMapTest.secondParamAsArrayWithLongVars', {
  impl: actionMapTest({
    profile: () => pipeline(Var('a', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'), '%%', 'aaaaaaaaaaaaaaaaaaaaaadasdaaaaaaaaaaaaaaaaaaaaa'),
    expectedType: 'data<>',
    path: 'begin!~items~0',
    expectedPos: '82,82'
  })
})

Test('actionMapTest.asyncVar', {
  impl: actionMapTest(() => pipeline(Var('a',3, {async: true})), 'data<>', 'begin!~vars~0~async', '30,30')
})


Test('actionMapTest.prependInGroup', {
  impl: actionMapTest(() => group(text(''), text('')), 'control<>', 'prependPT!~controls', '6,11')
})

Test('actionMapTest.prependSingleInArrayPath', {
  impl: actionMapTest(() => group(text('')), 'control<>', 'prependPT!~controls', '6,11')
})

Test('actionMapTest.singleInArrayPath', {
  impl: actionMapTest(() => group(text('')), 'control<>', 'begin!~controls~text', '11,11')
})


Data('actionMapTest.multiLineExample', {
  params: [
    {id: 'param1'}
  ],
  impl: group(
    text('hello'),
    group(text('-1-'), controlWithCondition('1==2', text('-1.5-')), text('-2-')),
    text('world')
  )
})

Test('actionMapTest.multiLine.prepend', {
  impl: actionMapTest(() => jb.comps['control<>actionMapTest.multiLineExample'], 'control<>', 'prependPT!~impl~controls', '93,98')
})

Test('actionMapTest.param', {
  impl: dataTest({
    calculate: () => prettyPrintComp('actionMapTest.multiLineExample',jb.comps['control<>actionMapTest.multiLineExample']),
    expectedResult: contains(`{id: 'param1'}`)
  })
})

Test('actionMapTest.multiLine.implBegin', {
  impl: actionMapTest(() => jb.comps['control<>actionMapTest.multiLineExample'], 'control<>', 'begin!~impl', '87,87')
})

Test('actionMapTest.multiLine.implEnd', {
  impl: actionMapTest(() => jb.comps['control<>actionMapTest.multiLineExample'], 'control<>', 'end!~impl', '216,216')
})

Data('actionMapTest.dslNameOverideExample', {
  type: 'settlement<location>',
  impl: pipeline({ state: israel() })
})

Test('actionMapTest.dslNameOveride', {
  impl: actionMapTest(() => jb.comps['settlement<location>actionMapTest.dslNameOverideExample'], 'settlement<location>', 'addProp!~impl~state', '113,113')
})

Test('actionMapTest.remark.pipeline', {
  impl: dataTest({
    calculate: pipeline(
      () => prettyPrintWithPositions(pipeline(Var('x',1), 'a' , {'//': 'hello'}),{type: 'data<>', singleLine: true}),
      log('test'),
      '%text%'
    ),
    expectedResult: equals(`pipeline(Var('x', 1), 'a', { '//': 'hello' })`)
  })
})

Test('actionMapTest.newLinesInCode', {
  impl: dataTest({
    calculate: () => prettyPrint(html(`<div>\n</div>`),{type: 'control<>'}),
    expectedResult: equals('html(`<div>\n</div>`)')
  })
})

Test('actionMapTest.Positions.closeArray', {
  impl: actionMapTest({
    profile: () => text('hey', { features: [css.color('green'), css.color('green')] }), 
    expectedType: 'control<>',
    path: 'end!~features',
    expectedPos: '65,65'
  })
})

Data('test.foldFunction', {
  impl: pipeline({
    source: () => prettyPrintWithPositions(frontEnd.var('itemPropsProfile', ({ }, { $model }) => 
      $model.itemProps.profile) , {type: 'feature<>', }),
    items: ['%text%']
  })
})

Test('actionMapTest.posOfFoldFunctionBug', {
  impl: dataTest(() => getPosOfPath('data<>test.foldFunction~impl~items~0'), equals('%line%', 4))
})

Test('actionMapTest.singleFunc', {
  impl: actionMapTest(() => frontEnd.init(({ }, { }) => 5), 'feature<>', 'function!~action', '14,29')
})

Test('actionMapTest.primitiveArray', {
  impl: dataTest({
    calculate: () => prettyPrintWithPositions(list(1, 2, 3, 4), {type: 'data<>'}),
    expectedResult: equals('%text%', 'list(1,2,3,4)')
  })
})

Test('actionMapTest.byValue.cutTailingUndefinedArgs', {
  impl: dataTest(() => prettyPrint(css.boxShadow({ inset: false }), {type: 'feature<>'}), notContains('undefined'))
})

Test('actionMapTest.async', {
  impl: dataTest(() => prettyPrint({ async a() { 3 } }), and(not(contains('a:')), contains('async a() { 3 }')))
})

Test('actionMapTest.asIs', {
  impl: dataTest(() => prettyPrint(asIs({remoteRun: { $: 'runCtx' }})), contains('$:'))
})

Test('actionMapTest.asIsLarge', {
  impl: dataTest({
    calculate: () => prettyPrint(equals(asIs({ edit: { range: {start: {line: 3, col: 0}, end: {line: 3, col: 0}},
    newText: `Test('dataTest.test.tst1', {\n  impl: dataTest(test.tst1(), equals(''))\n})` }, cursorPos: {line: 4, col: 0} })
  ), {type: 'data<>'}),
    expectedResult: equals(`equals(asIs({\n    edit: {\n      range: {start: {line: 3, col: 0}, end: {line: 3, col: 0}},\n      newText: \`Test('dataTest.test.tst1', {\\n  impl: dataTest(test.tst1(), equals(''))\\n})\`\n    },\n    cursorPos: {line: 4, col: 0}\n}))`)
  })
})

// Test('actionMapTest.tooLong', {
//   impl: dataTest({
//     calculate: () => prettyPrintComp('UiTreeTest.treeDD.sameArray',jb.comps['test<>UiTreeTest.treeDD.sameArray']),
//     expectedResult: contains('\n')
//   })
// })

Test('actionMapTest.asyncInProfile', {
  impl: dataTest({
    calculate: () => prettyPrint(dataTest(async () => { 5 }), {type: 'test<>'}),
    expectedResult: and(not(contains('a:')), contains('async () => { 5 }'))
  })
})

Test('actionMapTest.funcDefaults', {
  impl: dataTest({
    calculate: () => prettyPrint({ aB(c, { b } = {}) { 3 } }),
    expectedResult: and(not(contains('aB:')), contains('aB(c, { b } = {}) { 3 }')),
    runBefore: runActionOnItems(list(1,2,3), delay(), 'index')
  })
})

Test('actionMapTest.typeAdapter.from', {
  impl: dataTest({
    calculate: prettyPrint(() => typeAdapter('state<location>', israel()), true),
    expectedResult: equals(`typeAdapter('state<location>', israel())`)
  })
})

Test('actionMapTest.asIs', {
  impl: dataTest({
    calculate: prettyPrint(() => equals('hello', asIs({ line: 1, col: 47 })), {
      type: 'boolean<>'
    }),
    expectedResult: equals(`equals('hello', asIs({line: 1, col: 47}))`)
  })
})

Test('actionMapTest.typeAdapter.to', {
  impl: dataTest(pipeline(typeAdapter('state<location>', israel()), '%capital/name%'), equals('Jerusalem'))
})

Test('actionMapTest.vars', {
  impl: dataTest(
    ctx => {
    try {
      const testToTest = 'coreTest.varsCases'
      const compTxt = prettyPrintComp(testToTest.replace(/varsCases/, 'varsCases2'), jb.comps['test<>'+testToTest])
      eval(compTxt)
      return ctx.run(coreTest.asArrayBug(),'test<>') // checks for error
        .then(({ success }) => success && compTxt)
    } catch (e) {
      return false
    }
  },
    contains(`Var('items', [{id: 1}, {id: 2}])`)
  )
})

*/