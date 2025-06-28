import { dsls, ns } from '@jb6/core'
import './lang-service-testers.js'
const { langService } = ns

const {
  tgp: { Const
  },
  test: { Test,
    test: { dataTest, completionOptionsTest, completionActionTest }
  },
  common: { Data, Action, Boolean,
    data: { calcCompTextAndCursor, pipeline, list, filter, join, property, obj, delay, pipe, first, slice, asIs }, 
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

Test('completionTest.VariableDeclarationBug', {
  impl: completionOptionsTest(`group(__)`, ['button2'])
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

Test('completionTest.reformat', {
  impl: completionOptionsTest(`uiTest(__text( ''))`, ['🔄 reformat'])
})

Test('completionTest.prettyPrintFunctionAsIs', {
  impl: completionActionTest('dataTest({calculate: asIs({ range: { start: 3 }}) __})', {
    completionToActivate: 'expectedResult',
    expectedEdit: {
      range: {start: {line: 1, col: 17}, end: {line: 1, col: 59}},
      newText: 'asIs({range: {start: 3}}), true'
    },
    expectedCursorPos: '1,44'
  })
})

Test('completionTest.prettyPrintFunction', {
  impl: completionActionTest('dataTest({runBefore: () => {} __})', {
    completionToActivate: 'calculate',
    expectedEdit: asIs({range: {start: {line: 1, col: 17}, end: {line: 1, col: 18}}, newText: `'', { `}),
    expectedCursorPos: '1,18'
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

Const('peopleArray', {
    people: [
      {name: 'Homer Simpson', age: 42, male: true},
      {name: 'Marge Simpson', age: 38, male: false},
      {name: 'Bart Simpson', age: 12, male: true}
    ]
})

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

Test('completionTest.multiLine', {
  impl: completionActionTest({
    compText: `group(__\n    text('hello'),\n    group(text('-1-'), controlWithCondition('1==2', text('-1.5-')), text('-2-')),\n    text('world')\n  )`,
    completionToActivate: 'button',
    expectedEdit: asIs({range: {start: {line: 2, col: 4}, end: {line: 2, col: 4}}, newText: `button('click me'),\n    `}),
    expectedCursorPos: '2,12'
  })
})

Test('completionTest.multiLineWithConstVar', {
  impl: completionActionTest({
    compText: `ALL:const aa = Test('x', {\n  impl: uiTest(group(__\n    text('hello'),\n    group(text('-1-'), controlWithCondition('1==2', text('-1.5-')), text('-2-')),\n    text('world')\n  ))\n})`,
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

Test('completionActionTest.defaultValueAsProfile', {
  impl: completionActionTest(`ALL:Data('cmp1', __{ params: [{id: 'x', defaultValue: list()}] })`, {
    completionToActivate: '🔄 reformat',
    expectedEdit: asIs({
        range: {start: {line: 0, col: 14}, end: {line: 0, col: 57}},
        newText: `\n  params: [\n    {id: 'x', defaultValue: list()}\n  ]\n`
    }),
    expectedCursorPos: '0,13'
  })
})

Test('completionActionTest.defaultValueWithDslType', {
  impl: completionActionTest(`ALL:Control('ctrl1', __{ params: [{id: 'f', type: 'feature', defaultValue: method()}] })`, {
    completionToActivate: '🔄 reformat',
    expectedEdit: asIs({
        range: {start: {line: 0, col: 18}, end: {line: 0, col: 80}},
        newText: `\n  params: [\n    {id: 'f', type: 'feature', defaultValue: method()}\n  ]\n`
    }),
    expectedCursorPos: '0,17'
  })
})

Test('completionActionTest.macroByValue', {
  impl: completionActionTest(`ALL:Data('cmp1', __{ macroByValue: true, params: [{id: 'p'}] })`, {
    completionToActivate: '🔄 reformat',
    expectedEdit: asIs({
        range: {start: {line: 0, col: 14}, end: {line: 0, col: 55}},
        newText: `\n  macroByValue: true,\n  params: [\n    {id: 'p'}\n  ]\n`
    }),
    expectedCursorPos: '0,13'
  })
})

Test('completionActionTest.asIsJson', {
  impl: completionActionTest(`ALL:Data('cmp1', __{ impl: asIs({"a": 3}) })`, {
    completionToActivate: '🔄 reformat',
    expectedEdit: asIs({range: {start: {line: 0, col: 14}, end: {line: 0, col: 36}}, newText: '\n  impl: asIs({a: 3})\n'}),
    expectedCursorPos: '0,13'
  })
})

Test('completionActionTest.asIsArray', {
  impl: completionActionTest(`ALL:Data('cmp1', __{ impl: asIs([{a: 3}]) })`, {
    completionToActivate: '🔄 reformat',
    expectedEdit: asIs({
        range: {start: {line: 0, col: 14}, end: {line: 0, col: 36}},
        newText: '\n  impl: asIs([{a: 3}])\n'
    }),
    expectedCursorPos: '0,13'
  })
})

Test('completionActionTest.keepName', {
  impl: completionActionTest(`ALL:const cmp1 = Data('cmp1', __{ impl: asIs([{a: 3}]) })`, {
    completionToActivate: '🔄 reformat',
    expectedEdit: asIs({
        range: {start: {line: 0, col: 27}, end: {line: 0, col: 49}},
        newText: '\n  impl: asIs([{a: 3}])\n'
    }),
    expectedCursorPos: '0,26'
  })
})

Test('completionActionTest.defaultValueWithDslType', {
  impl: completionActionTest(`ALL:Control('ctrl1', __{ params: [{id: 'f', type: 'feature', defaultValue: method()}] })`, {
    completionToActivate: '🔄 reformat',
    expectedEdit: asIs({
        range: {start: {line: 0, col: 18}, end: {line: 0, col: 80}},
        newText: `\n  params: [\n    {id: 'f', type: 'feature', defaultValue: method()}\n  ]\n`
    }),
    expectedCursorPos: '0,17'
  })
})


Test('langServiceTest.provideDefinition', {
  impl: dataTest({
    calculate: langService.definition(calcCompTextAndCursor(`dataTest('', __not())`)),
    expectedResult: contains('jb-common', { data: '%path%' })
  })
})

Test('langServiceTest.closestComp', {
  impl: dataTest({
    calculate: calcCompTextAndCursor(`ALL:const a = 3;\nData('cmp1', { impl: pipeline(li__st()) })`),
    expectedResult: equals(`Data('cmp1', { impl: pipeline(list()) })`, '%compText%')
  })
})

Test('langServiceTest.provideDefinition.firstInPipe', {
  impl: dataTest({
    calculate: langService.definition(calcCompTextAndCursor('dataTest(pipeline(l__ist()))')),
    expectedResult: contains('/packages/common/jb-common.js', { data: '%path%' })
  })
})

Test('langServiceTest.provideDefinition.inProfile', {
  impl: dataTest({
    calculate: langService.definition(calcCompTextAndCursor('dataTest(pipeline(l__ist()))')),
    expectedResult: contains('/packages/common/jb-common.js', { data: '%path%' })
  })
})

Test('langServiceTest.moveInArrayEdits', {
  impl: dataTest({
    calculate: langService.moveInArrayEdits(1, calcCompTextAndCursor(`dataTest(pipeline(list(1,2,3), __slice(0, 2), join()), equals('1,2'))`)),
    expectedResult: equals('%cursorPos%', asIs({line: 1, col: 47}))
  })
})

Test('langServiceTest.duplicateEdits', {
  impl: dataTest({
    calculate: langService.duplicateEdits(calcCompTextAndCursor(`dataTest(pipeline(list(1,2,3), __slice(0, 2), join()), equals('1,2'))`)),
    expectedResult: equals(asIs({
        edit: {range: {start: {line: 1, col: 52}, end: {line: 1, col: 52}}, newText: 'slice(0, 2), '},
        cursorPos: {line: 1, col: 52},
        hash: 2054365702
    }))
  })
})

Test('langServiceTest.deleteEdits', {
  impl: dataTest({
    calculate: langService.deleteEdits(calcCompTextAndCursor(`dataTest(pipeline(list(1,2,3), __slice(0, 2), join()), equals('1,2'))`)),
    expectedResult: equals(asIs({
        edit: {range: {start: {line: 1, col: 39}, end: {line: 1, col: 52}}, newText: ''},
        cursorPos: {line: 1, col: 39},
        hash: 2054365702
    }))
  })
})

Test('langServiceTest.createTestEdits', {
  impl: dataTest({
    calculate: langService.createTestEdits(calcCompTextAndCursor(`Data('tst1', {\n  impl: pipeline(list(1,2,3), __slice(0, 2), join())\n})`)),
    expectedResult: equals(asIs({
        edit: {
          range: {start: {line: 3, col: 0}, end: {line: 3, col: 0}},
          newText: `\nTest('dataTest.tst1', {\n  impl: dataTest(tst1(), equals(''))\n})\n`
        },
        cursorPos: {line: 4, col: 0}
    }))
  })
})

// Test('langServiceTest.compReferences.list', {
//   impl: dataTest({
//     calculate: langService.compReferences(calcCompTextAndCursor("dataTest('', e__quals(5))")),
//     expectedResult: contains('/packages/common/jb-common.js', { data: '%path%' })
//   })
// })

// Test('langServiceTest.enableEdits', {
//   impl: dataTest({
//     calculate: pipe(
//       calcCompTextAndCursor(`dataTest(pipeline(list(1,2,3), __slice(0, 2, { $disabled: true }), join()), equals('1,2'))`),
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
