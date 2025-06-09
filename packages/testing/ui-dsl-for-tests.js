import { dsls } from '@jb6/core'
import '@jb6/testing'
import '@jb6/common'

const { 
    common: { Data },
    tgp: { TgpType},
    test: { Test }
} = dsls

const Control = TgpType('control','ui')
const Feature = TgpType('feature','ui')

TgpType('ui-action','test')
TgpType('jbm','jbm')

Control('group', {
  params: [
    {id: 'controls', type: 'control[]', mandatory: true, dynamic: true, composite: true},
    {id: 'title', as: 'string', dynamic: true, byName: true},
    {id: 'layout', type: 'layout'},
    {id: 'style', type: 'group-style', mandatory: true, dynamic: true},
    {id: 'features', type: 'feature[]', dynamic: true}
  ]
})

Control('button', {
  params: [
    {id: 'title', as: 'ref', mandatory: true, templateValue: 'click me', dynamic: true},
    {id: 'action', type: 'action<common>', mandatory: true, dynamic: true},
    {id: 'style', type: 'button-style', dynamic: true},
    {id: 'raised', as: 'boolean', dynamic: true, type: 'boolean'},
    {id: 'disabledTillActionFinished', as: 'boolean', type: 'boolean'},
    {id: 'features', type: 'feature[]', dynamic: true}
  ]
})

const button2 = Control('button2', {  
  params: []
})

Control('controlWithCondition', {
  macroByValue: true,
  params: [
    {id: 'condition', type: 'boolean', dynamic: true, mandatory: true, as: 'boolean'},
    {id: 'control', type: 'control', mandatory: true, dynamic: true, composite: true},
    {id: 'title', as: 'string'}
  ]
})

Control('text', {
  params: [
    {id: 'text', as: 'ref', mandatory: true, templateValue: 'my text', dynamic: true},
    {id: 'title', as: 'ref', dynamic: true},
    {id: 'style', type: 'text-style', dynamic: true},
    {id: 'features', type: 'feature[]', dynamic: true}
  ]
})

Test('uiTest', {
  params: [
    {id: 'control', type: 'control<ui>', dynamic: true, mandatory: true},
    {id: 'expectedResult', type: 'boolean', dynamic: true, mandatory: true},
    {id: 'runBefore', type: 'action', dynamic: true},
    {id: 'uiAction', type: 'ui-action<test>', dynamic: true},
    {id: 'allowError', as: 'boolean', dynamic: true, type: 'boolean'},
    {id: 'timeout', as: 'number', defaultValue: 200},
    {id: 'cleanUp', type: 'action', dynamic: true},
    {id: 'expectedCounters', as: 'single'},
    {id: 'backEndJbm', type: 'jbm<jbm>'},
    {id: 'emulateFrontEnd', as: 'boolean', type: 'boolean'},
    {id: 'transactiveHeadless', as: 'boolean', type: 'boolean'},
    {id: 'spy'},
    {id: 'covers'}
  ]
})

Feature('method', {
  description: 'define backend event handler',
  params: [
    {id: 'id', as: 'string', mandatory: true, description: 'if using the pattern onXXHandler, or onKeyXXHandler automaticaly binds to UI event XX, assuming on-XX:true is defined at the template'},
    {id: 'action', type: 'action', mandatory: true, dynamic: true}
  ]
})

Feature('id', {
  description: 'adds id to html element',
  params: [
    {id: 'id', mandatory: true, as: 'string', dynamic: true}
  ]
})

// for testing action map
Data('singleParamByNameComp', {
  params: [
    {id: 'p1', as: 'boolean', type: 'boolean<common>', byName: true}
  ]
})