import { dsls, ns } from '@jb6/core'
import {} from './lang-service-testers.js'
const { langService } = ns

const {
  tgp: {
    any: { asIs }
  },
  test: { Test,
    test: { dataTest, completionOptionsTest, completionActionTest }
  },
  common: { Data, Action, Boolean,
    data: { dummyCompProps, pipeline, list, filter, join, property, obj, delay, pipe, first, slice }, 
    boolean: { equals, contains, notContains, and, not },
    prop: { prop },
  },
} = dsls

Test('completionTest.param1', {
  impl: completionOptionsTest(`uiTest(text(__'hello world', ''), contains('hello world'))`, ['style'])
})

Test('completionTest.param', {
  impl: completionOptionsTest({
    compText: `uiTest(__text(__'hello world',__ ''__)__,__ __contains('hello world')__)`,
    expectedSelections: ['runBefore','style','style','style','runBefore','runBefore','not','runBefore']
  })
})

Test('completionTest.pt', {
  impl: completionOptionsTest({
    compText: `uiTest(group(__text('__hello world'), __text('2'__)__), __contains('hello world','2'))`,
    expectedSelections: ['button','pipeline','button','style','button','not']
  })
})

Test('completionTest.text', {
  impl: completionOptionsTest(`uiTest(text(__'__hello'__, __'__'__))`, ['style','pipeline','style','style','pipeline','style'])
})

Test('completionTest.mixedSingleArgAsArrayMiddle', {
  impl: completionOptionsTest(`group(button('click me')__,__ { features: method() })`, ['button','button'])
})

Test('completionTest.betweentwoFirstArgs', {
  impl: completionOptionsTest(`uiTest(text('hello world'),__ contains('hello world'))`, ['runBefore'])
})

Test('completionTest.pipeline', {
  impl: completionOptionsTest(`uiTest(text(pipeline(''__)))`, ['split'])
})

Test('completionTest.pipeline2', {
  impl: completionOptionsTest(`uiTest(text(pipeline('__')))`, ['split'])
})

Test('completionTest.secondParamAsArray', {
  impl: completionOptionsTest(`dataTest(pipeline('a',__ '__-%%-',__ '%%'__))`, ['split','split','split','split'])
})

Test('completionTest.secondParamAsArray1', {
  impl: completionOptionsTest(`dataTest(pipeline('a',__ '-%%-', '%%'))`, ['split'])
})

// Test('completionTest.typeAdapter', {
//   impl: completionOptionsTest(`uiTest(text(typeAdapter('state<location>', __TBD())))`, {
//     expectedSelections: ['israel']
//   })
// })

Test('completionTest.createPipelineFromComp', {
  impl: completionActionTest(`uiTest(text(__split()))`, {
    completionToActivate: 'pipeline',
    expectedEdit: asIs({range: {start: {line: 1, col: 20}, end: {line: 1, col: 26}}, newText: 'pipeline(split()'}),
    expectedCursorPos: '1,36'
  })
})

Test('completionTest.newBooleanAsTrue', {
  impl: completionActionTest('uiTest(__text(split()))', {
    completionToActivate: 'allowError',
    expectedEdit: asIs({range: {start: {line: 1, col: 28}, end: {line: 1, col: 28}}, newText: ', { allowError: true }'}),
    expectedCursorPos: '1,44'
  })
})

Test('completionTest.groupInGroup', {
  impl: completionOptionsTest(`uiTest(group(group(__text(''))))`, {
    expectedSelections: ['button']
  })
})

Test('completionTest.singleArgAsArray.begin', {
  impl: completionActionTest(`uiTest(group(__text('')))`, {
    completionToActivate: 'features',
    expectedEdit: asIs({range: {start: {line: 1, col: 29}, end: {line: 1, col: 29}}, newText: ', { features: TBD() }'}),
    expectedCursorPos: '1,43'
  })
})

Test('completionTest.singleArgAsArray.end', {
  impl: completionActionTest(`uiTest(group(text('')__))`, {
    completionToActivate: 'button',
    expectedEdit: asIs({range: {start: {line: 1, col: 29}, end: {line: 1, col: 29}}, newText: `, button('click me')`}),
    expectedCursorPos: '1,39'
  })
})

Test('completionTest.singleArgAsArray.middle', {
  impl: completionActionTest(`uiTest(group(text(''),__ text('2')))`, {
    completionToActivate: 'button',
    expectedEdit: asIs({range: {start: {line: 1, col: 31}, end: {line: 1, col: 31}}, newText: `button('click me'), `}),
    expectedCursorPos: '1,39'
  })
})

Test('completionTest.paramsAndProfiles', {
  impl: completionOptionsTest(`uiTest(__text(''))`, {
    expectedSelections: ['runBefore','button']
  })
})

Test('completionTest.createPipelineFromString', {
  impl: completionActionTest(`uiTest(text('__aa'))`, {
    completionToActivate: 'pipeline',
    expectedEdit: asIs({range: {start: {line: 1, col: 20}, end: {line: 1, col: 24}}, newText: `pipeline('aa')`}),
    expectedCursorPos: '1,33'
  })
})

Test('completionTest.createPipelineFromEmptyString', {
  impl: completionActionTest(`uiTest(text('hello world', '__'))`, {
    completionToActivate: 'pipeline',
    expectedEdit: asIs({range: {start: {line: 1, col: 35}, end: {line: 1, col: 37}}, newText: `pipeline('')`}),
    expectedCursorPos: '1,46'
  })
})

Test('completionTest.insideVar', {
  impl: completionActionTest(`dataTest({ vars: [Var('a', '__b')] })`, {
    completionToActivate: 'pipeline',
    expectedEdit: asIs({
        range: {start: {line: 1, col: 26}, end: {line: 1, col: 39}},
        newText: `\n    Var('a', pipeline('b'))\n  `
    }),
    expectedCursorPos: '2,25'
  })
})

Test('completionTest.splitPart', {
  impl: completionOptionsTest(`uiTest(text(pipeline(split(__))))`, {
    expectedSelections: ['part']
  })
})

Test('completionTest.dynamicFormat', {
  impl: completionActionTest({
    compText: `uiTest(__text('my text'), contains('hello world'))`,
    completionToActivate: 'uiAction',
    expectedEdit: asIs({range: {start: {line: 1, col: 55}, end: {line: 1, col: 55}}, newText: ', { uiAction: TBD() }'}),
    expectedCursorPos: '1,69'
  })
})

Test('completionTest.inComp', {
  impl: completionActionTest({
    compText: `uiTest(text('my text'), con__tains('hello world'))`,
    completionToActivate: 'notContains',
    expectedEdit: asIs({range: {start: {line: 1, col: 32}, end: {line: 1, col: 33}}, newText: 'notC'}),
    expectedCursorPos: '1,45'
  })
})

Test('completionTest.wrapWithGroup', {
  impl: completionActionTest(`uiTest(__text())`, {
    completionToActivate: 'group',
    expectedEdit: asIs({range: {start: {line: 1, col: 15}, end: {line: 1, col: 20}}, newText: 'group(text()'}),
    expectedCursorPos: '1,27'
  })
})

Test('completionTest.addText', {
  impl: completionActionTest(`uiTest(group(__))`, {
    completionToActivate: 'text',
    expectedEdit: asIs({range: {start: {line: 1, col: 21}, end: {line: 1, col: 21}}, newText: `text('my text')`}),
    expectedCursorPos: '1,27'
  })
})

Test('completionTest.wrapWithGroup2', {
  impl: completionActionTest({
    compText: `uiTest(group(text(''), __button('click me')))`,
    completionToActivate: 'group',
    expectedEdit: asIs({range: {start: {line: 1, col: 31}, end: {line: 1, col: 48}}, newText: `group(button('click me')`}),
    expectedCursorPos: '1,55'
  })
})

Test('completionTest.wrapWithArray', {
  impl: completionActionTest({
    compText: `uiTest(text({ features: __id('x') }), contains())`,
    completionToActivate: 'wrap with array',
    expectedEdit: asIs({range: {start: {line: 1, col: 32}, end: {line: 1, col: 39}}, newText: `[id('x')]`}),
    expectedCursorPos: '1,40'
  })
})

Test('completionTest.buttonFeature', {
  impl: completionOptionsTest(`uiTest(button('', { features: [__] }))`, {
    expectedSelections: ['method','button.ctrlAction']
  })
})

Test('completionTest.singleParamAsArray.data', {
  impl: completionOptionsTest(`dataTest('', contains(__))`, ['split'])
})

Test('completionTest.actionReplaceTBD', {
  impl: completionActionTest(`uiTest(button('x', runActions(__TBD())))`, {
    completionToActivate: 'delay',
    expectedEdit: asIs({range: {start: {line: 1, col: 38}, end: {line: 1, col: 41}}, newText: 'delay'}),
    expectedCursorPos: '1,44'
  })
})
/*
Data('completionTest.fixEditedSample', {
  impl: pipeline()
})

Test('completionTest.fixEditedCompSpaces', {
  impl: fixEditedCompTest({
    compText: `Data('fixEditedSample', {\n   impl:     split(__)\n})`,
    expectedFixedComp: '{\n  impl: split()\n}'
  })
})

Test('completionTest.fixEditedCompWrongName', {
  impl: fixEditedCompTest({
    compText: `Data('fixEditedSample' ,{\n  impl: split(__a)\n})`,
    expectedFixedComp: `{\n  impl: split(TBD())\n}`
  })
})
*/

/*
Test('completionTest.people', {
  impl: completionOptionsTest(`dataTest('%$peopleArray/__')`, {
    expectedSelections: ['people (3 items)']
  })
})


Test('completionTest.person', {
  impl: completionOptionsTest(`dataTest('%$__')`, {
    expectedSelections: ['$person (4 props)']
  })
})

Test('completionTest.writePerson', {
  impl: completionActionTest(`dataTest('%$__')`, {
    completionToActivate: '$person (4 props)',
    expectedEdit: asIs({range: {start: {line: 1, col: 20}, end: {line: 1, col: 20}}, newText: 'person/'}),
    expectedCursorPos: '1,27'
  })
})

Test('completionTest.writePersonInner', {
  impl: completionActionTest(`dataTest('%$p__er')`, {
    completionToActivate: '$person (4 props)',
    expectedEdit: asIs({range: {start: {line: 1, col: 23}, end: {line: 1, col: 23}}, newText: 'son/'}),
    expectedCursorPos: '1,27'
  })
})

Test('completionTest.writePersonInner2', {
  impl: completionActionTest(`dataTest('%$per__')`, {
    completionToActivate: '$person (4 props)',
    expectedEdit: asIs({range: {start: {line: 1, col: 23}, end: {line: 1, col: 23}}, newText: 'son/'}),
    expectedCursorPos: '1,27'
  })
})

Test('completionTest.writePersonName', {
  impl: completionActionTest(`dataTest('%$person/__')`, {
    completionToActivate: 'name (Homer Simpson)',
    expectedEdit: asIs({range: {start: {line: 1, col: 27}, end: {line: 1, col: 27}}, newText: 'name%'}),
    expectedCursorPos: '1,33'
  })
})

Test('completionTest.writePreviewValue', {
  impl: completionActionTest(`dataTest('%$peopleArray/__')`, {
    completionToActivate: 'people (3 items)',
    expectedEdit: asIs({range: {start: {line: 1, col: 32}, end: {line: 1, col: 32}}, newText: 'people/'}),
    expectedCursorPos: '1,39'
  })
})
*/
/*
Test('completionTest.dslTest.createProp', {
  impl: completionActionTest(`state(__)`, {
    completionToActivate: 'capital',
    expectedEdit: asIs({range: {start: {line: 1, col: 14}, end: {line: 1, col: 14}}, newText: 'TBD()'}),
    expectedCursorPos: '1,14',
    dsl: 'location'
  })
})

Test('completionTest.dslTest.nameOverride', {
  impl: completionOptionsTest(`state(pipeline(__))`, {
    expectedSelections: ['checkNameOverride'],
    dsl: 'location'
  })
})

Test('completionTest.dslTest.top', {
  impl: completionOptionsTest(`state(__)`, {
    expectedSelections: ['capital'],
    dsl: 'location'
  })
})

Test('completionTest.dslTest.typeRules', {
  impl: completionOptionsTest(`Test('x', {\n  type: 'data',\n  impl: pipeline('__')\n})`, ['split'], {
    dsl: 'location'
  })
})

Test('completionTest.dslTest.defaultValue', {
  impl: completionOptionsTest({
    compText: `Test('x', {\n  type: 'data<common>',\n  params: [\n    {id: 'p1', type: 'state<location>', defaultValue: __israel()}\n  ]\n})`,
    expectedSelections: ['israel2'],
    filePath: '/plugins/core/dsl-tests.js'
  })
})
*/

Test('completionTest.multiLine', {
  impl: completionActionTest({
    compText: `group(__\n    text('hello'),\n    group(text('-1-'), controlWithCondition('1==2', text('-1.5-')), text('-2-')),\n    text('world')\n  )`,
    completionToActivate: 'button',
    expectedEdit: asIs({range: {start: {line: 2, col: 4}, end: {line: 2, col: 4}}, newText: `button('click me'),\n    `}),
    expectedCursorPos: '2,12'
  })
})

Test('completionTest.multiLineAddProp', {
  impl: completionActionTest({
    compText: `group(__\n    text('hello'),\n    group(text('-1-'), controlWithCondition('1==2', text('-1.5-')), text('-2-')),\n    text('world')\n  )`,
    completionToActivate: 'features',
    expectedEdit: asIs({
        range: {start: {line: 1, col: 21}, end: {line: 5, col: 2}},
        newText: `{\n    controls: [\n      text('hello'),\n      group(text('-1-'), controlWithCondition('1==2', text('-1.5-')), text('-2-')),\n      text('world')\n    ],\n    features: TBD()\n  }`
    }),
    expectedCursorPos: '7,14'
  })
})

/*
Test('completionTest.multiLineFeatures', {
  impl: completionActionTest({
    compText: `group(text('my text'), {\n    features: [\n      method(),__\n      calcProp(),\n      css.class('asddddddddddddddddddddddddddd')\n    ]\n  })`,
    completionToActivate: 'method',
    expectedEdit: asIs({range: {start: {line: 4, col: 6}, end: {line: 4, col: 6}}, newText: 'method(),\n      '}),
    expectedCursorPos: '4,13'
  })
})
*/

Test('langServiceTest.provideDefinition', {
  impl: dataTest({
    calculate: pipe(dummyCompProps(`dataTest('', __not())`), langService.definition()),
    expectedResult: contains('jb-common', { data: '%path%' })
  })
})

// Test('langServiceTest.provideDefinition.inFunc', {
//   impl: dataTest({
//     calculate: pipe(dummyCompProps(`dataTest('', () => { utils.prettyPrint('aa'); return 3})`), langService.definition()),
//     expectedResult: equals('/plugins/tgp/formatter/pretty-print.js', { data: '%path%' })
//   })
// })

Test('langServiceTest.provideDefinition.firstInPipe', {
  impl: dataTest({
    calculate: pipe(dummyCompProps('dataTest(pipeline(l__ist()))'), langService.definition()),
    expectedResult: equals('/packages/common/jb-common.js', { data: '%path%' })
  })
})

Test('langServiceTest.provideDefinition.inProfile', {
  impl: dataTest({
    calculate: pipe(dummyCompProps('dataTest(pipeline(l__ist()))'), langService.definition()),
    expectedResult: equals('/packages/common/jb-common.js', { data: '%path%' })
  })
})

Test('langServiceTest.moveInArrayEdits', {
  impl: dataTest({
    calculate: pipe(
      dummyCompProps(`dataTest(pipeline(list(1,2,3), __slice(0, 2), join()), equals('1,2'))`),
      langService.moveInArrayEdits(1),
      first()
    ),
    expectedResult: equals('%cursorPos%', asIs({line: 1, col: 47}))
  })
})

Test('langServiceTest.duplicateEdits', {
  impl: dataTest({
    calculate: pipe(
      dummyCompProps(`dataTest(pipeline(list(1,2,3), __slice(0, 2), join()), equals('1,2'))`),
      langService.duplicateEdits(),
      first()
    ),
    expectedResult: equals(asIs({
        edit: {range: {start: {line: 1, col: 52}, end: {line: 1, col: 52}}, newText: 'slice(0, 2), '},
        cursorPos: {line: 1, col: 52},
        hash: 2054365702
    }))
  })
})

Test('langServiceTest.deleteEdits', {
  impl: dataTest({
    calculate: pipe(
      dummyCompProps(`dataTest(pipeline(list(1,2,3), __slice(0, 2), join()), equals('1,2'))`),
      langService.deleteEdits(),
      first()
    ),
    expectedResult: equals(asIs({
        edit: {range: {start: {line: 1, col: 39}, end: {line: 1, col: 52}}, newText: ''},
        cursorPos: {line: 1, col: 39},
        hash: 2054365702
    }))
  })
})

Test('langServiceTest.createTestEdits', {
  impl: dataTest({
    calculate: pipe(
      dummyCompProps(`Data('tst1', {\n  impl: pipeline(list(1,2,3), __slice(0, 2), join())\n})`),
      langService.createTestEdits(),
      first()
    ),
    expectedResult: equals(asIs({
        edit: {
          range: {start: {line: 3, col: 0}, end: {line: 3, col: 0}},
          newText: `\nTest('dataTest.tst1', {\n  impl: dataTest(tst1(), equals(''))\n})\n`
        },
        cursorPos: {line: 4, col: 0}
    }))
  })
})

// Test('langServiceTest.enableEdits', {
//   impl: dataTest({
//     calculate: pipe(
//       dummyCompProps(`dataTest(pipeline(list(1,2,3), __slice(0, 2, { $disabled: true }), join()), equals('1,2'))`),
//       langService.disableEdits(),
//       first()
//     ),
//     expectedResult: equals(asIs({
//         edit: {range: {start: {line: 1, col: 49}, end: {line: 1, col: 70}}, newText: ''},
//         cursorPos: {line: 1, col: 39},
//         hash: -1274638064
//     }))
//   })
// })
