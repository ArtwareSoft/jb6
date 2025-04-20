import { Test, PPPosOfPath} from './pretty-print-testers.js'
import { prettyPrintWithPositions, prettyPrint} from './pretty-print.js'
import { getPosOfPath} from '../text-editor/tgp-text-editor.js'
import { jb } from '../../core/jb-core.js'
import { pipeline, split, Var, list, Data } from '../../common/jb-common.js'

Test('PPrintTest.varsPath', {
  impl: PPPosOfPath(() => split(Var('a', 'b')), 'data<>', 'edit!~$vars~0~val', '27,27')
})

Data('PPrintTest.singleParamByNameComp', {
  params: [
    {id: 'p1', as: 'boolean', type: 'boolean<>', byName: true}
  ]
})

Data('PPrintTest.singleParamByName', {
  impl: PPPosOfPath(() => pipeline(PPrintTest.singleParamByNameComp({p1: true})), 'data<>', 'begin!~source~p1', '48,48')
})

Data('PPrintTest.secondParamAsArray', {
  impl: PPPosOfPath(() => pipeline(list(1,2), '%%'), 'data<>', 'begin!~items~0', '20,20')
})

Data('PPrintTest.secondParamAsArrayWithVars', {
  impl: PPPosOfPath(() => pipeline(Var('a', 3), '%%', 'aa'), 'data<>', 'begin!~items~0', '28,28')
})

Test('PPrintTest.secondParamAsArrayWithLongVars', {
  impl: PPPosOfPath({
    profile: () => pipeline(Var('a', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'), '%%', 'aaaaaaaaaaaaaaaaaaaaaadasdaaaaaaaaaaaaaaaaaaaaa'),
    expectedType: 'data<>',
    path: 'begin!~items~0',
    expectedPos: '82,82'
  })
})

Test('PPrintTest.asyncVar', {
  impl: PPPosOfPath(() => pipeline(Var('a',3, {async: true})), 'data<>', 'begin!~$vars~0~async', '30,30')
})

/*
Test('PPrintTest.prependInGroup', {
  impl: PPPosOfPath(() => group(text(''), text('')), 'control<>', 'prependPT!~controls', '6,11')
})

Test('PPrintTest.prependSingleInArrayPath', {
  impl: PPPosOfPath(() => group(text('')), 'control<>', 'prependPT!~controls', '6,11')
})

Test('PPrintTest.singleInArrayPath', {
  impl: PPPosOfPath(() => group(text('')), 'control<>', 'begin!~controls~text', '11,11')
})


Data('PPrintTest.multiLineExample', {
  params: [
    {id: 'param1'}
  ],
  impl: group(
    text('hello'),
    group(text('-1-'), controlWithCondition('1==2', text('-1.5-')), text('-2-')),
    text('world')
  )
})

Test('PPrintTest.multiLine.prepend', {
  impl: PPPosOfPath(() => jb.comps['control<>PPrintTest.multiLineExample'], 'control<>', 'prependPT!~impl~controls', '93,98')
})

Test('PPrintTest.param', {
  impl: dataTest({
    calculate: () => prettyPrintComp('PPrintTest.multiLineExample',jb.comps['control<>PPrintTest.multiLineExample']),
    expectedResult: contains(`{id: 'param1'}`)
  })
})

Test('PPrintTest.multiLine.implBegin', {
  impl: PPPosOfPath(() => jb.comps['control<>PPrintTest.multiLineExample'], 'control<>', 'begin!~impl', '87,87')
})

Test('PPrintTest.multiLine.implEnd', {
  impl: PPPosOfPath(() => jb.comps['control<>PPrintTest.multiLineExample'], 'control<>', 'end!~impl', '216,216')
})

Data('PPrintTest.dslNameOverideExample', {
  type: 'settlement<location>',
  impl: pipeline({ state: israel() })
})

Test('PPrintTest.dslNameOveride', {
  impl: PPPosOfPath(() => jb.comps['settlement<location>PPrintTest.dslNameOverideExample'], 'settlement<location>', 'addProp!~impl~state', '113,113')
})

Test('PPrintTest.remark.pipeline', {
  impl: dataTest({
    calculate: pipeline(
      () => prettyPrintWithPositions(pipeline(Var('x',1), 'a' , {'//': 'hello'}),{type: 'data<>', singleLine: true}),
      log('test'),
      '%text%'
    ),
    expectedResult: equals(`pipeline(Var('x', 1), 'a', { '//': 'hello' })`)
  })
})

Test('PPrintTest.newLinesInCode', {
  impl: dataTest({
    calculate: () => prettyPrint(html(`<div>\n</div>`),{type: 'control<>'}),
    expectedResult: equals('html(`<div>\n</div>`)')
  })
})

Test('PPrintTest.Positions.closeArray', {
  impl: PPPosOfPath({
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

Test('PPrintTest.posOfFoldFunctionBug', {
  impl: dataTest(() => getPosOfPath('data<>test.foldFunction~impl~items~0'), equals('%line%', 4))
})

Test('PPrintTest.singleFunc', {
  impl: PPPosOfPath(() => frontEnd.init(({ }, { }) => 5), 'feature<>', 'function!~action', '14,29')
})

Test('PPrintTest.primitiveArray', {
  impl: dataTest({
    calculate: () => prettyPrintWithPositions(list(1, 2, 3, 4), {type: 'data<>'}),
    expectedResult: equals('%text%', 'list(1,2,3,4)')
  })
})

Test('PPrintTest.byValue.cutTailingUndefinedArgs', {
  impl: dataTest(() => prettyPrint(css.boxShadow({ inset: false }), {type: 'feature<>'}), notContains('undefined'))
})

Test('PPrintTest.async', {
  impl: dataTest(() => prettyPrint({ async a() { 3 } }), and(not(contains('a:')), contains('async a() { 3 }')))
})

Test('PPrintTest.asIs', {
  impl: dataTest(() => prettyPrint(asIs({remoteRun: { $: 'runCtx' }})), contains('$:'))
})

Test('PPrintTest.asIsLarge', {
  impl: dataTest({
    calculate: () => prettyPrint(equals(asIs({ edit: { range: {start: {line: 3, col: 0}, end: {line: 3, col: 0}},
    newText: `Test('dataTest.test.tst1', {\n  impl: dataTest(test.tst1(), equals(''))\n})` }, cursorPos: {line: 4, col: 0} })
  ), {type: 'data<>'}),
    expectedResult: equals(`equals(asIs({\n    edit: {\n      range: {start: {line: 3, col: 0}, end: {line: 3, col: 0}},\n      newText: \`Test('dataTest.test.tst1', {\\n  impl: dataTest(test.tst1(), equals(''))\\n})\`\n    },\n    cursorPos: {line: 4, col: 0}\n}))`)
  })
})

// Test('PPrintTest.tooLong', {
//   impl: dataTest({
//     calculate: () => prettyPrintComp('UiTreeTest.treeDD.sameArray',jb.comps['test<>UiTreeTest.treeDD.sameArray']),
//     expectedResult: contains('\n')
//   })
// })

Test('PPrintTest.asyncInProfile', {
  impl: dataTest({
    calculate: () => prettyPrint(dataTest(async () => { 5 }), {type: 'test<>'}),
    expectedResult: and(not(contains('a:')), contains('async () => { 5 }'))
  })
})

Test('PPrintTest.funcDefaults', {
  impl: dataTest({
    calculate: () => prettyPrint({ aB(c, { b } = {}) { 3 } }),
    expectedResult: and(not(contains('aB:')), contains('aB(c, { b } = {}) { 3 }')),
    runBefore: runActionOnItems(list(1,2,3), delay(), 'index')
  })
})

Test('PPrintTest.typeAdapter.from', {
  impl: dataTest({
    calculate: prettyPrint(() => typeAdapter('state<location>', israel()), true),
    expectedResult: equals(`typeAdapter('state<location>', israel())`)
  })
})

Test('PPrintTest.asIs', {
  impl: dataTest({
    calculate: prettyPrint(() => equals('hello', asIs({ line: 1, col: 47 })), {
      type: 'boolean<>'
    }),
    expectedResult: equals(`equals('hello', asIs({line: 1, col: 47}))`)
  })
})

Test('PPrintTest.typeAdapter.to', {
  impl: dataTest(pipeline(typeAdapter('state<location>', israel()), '%capital/name%'), equals('Jerusalem'))
})

Test('PPrintTest.vars', {
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