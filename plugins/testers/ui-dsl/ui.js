import { Test, TgpType } from '../../testers/data-tester.js'

export const typeRules = [{ isOf: ['data<>','boolean<>'] }]

export const Control = TgpType('control',{dsl: 'ui'})
export const Feature = TgpType('feature',{dsl: 'ui'})

export const group = Control('group', {
    params: [
        {id: 'controls', type: 'control[]', mandatory: true, dynamic: true, composite: true},
        {id: 'title', as: 'string', dynamic: true, byName: true},
        {id: 'layout', type: 'layout'},
        {id: 'style', type: 'group-style', mandatory: true, dynamic: true},
        {id: 'features', type: 'feature[]', dynamic: true}    
    ]
})

const button = Control({
    params: [
        {id: 'text', as: 'ref', mandatory: true, templateValue: 'my text', dynamic: true},
        {id: 'title', as: 'ref', dynamic: true},
        {id: 'style', type: 'text-style', dynamic: true},
        {id: 'features', type: 'feature[]', dynamic: true}    
    ]
})

export const controlWithCondition = Control('controlWithCondition', {
    macroByValue: true,
    params: [
        {id: 'condition', type: 'boolean', dynamic: true, mandatory: true, as: 'boolean'},
        {id: 'control', type: 'control', mandatory: true, dynamic: true, composite: true},
        {id: 'title', as: 'string'}
    ]
})

export const text = Control('text', {
    params: [
        {id: 'text', as: 'ref', mandatory: true, templateValue: 'my text', dynamic: true},
        {id: 'title', as: 'ref', dynamic: true},
        {id: 'style', type: 'text-style', dynamic: true},
        {id: 'features', type: 'feature[]', dynamic: true}    
    ]
})

export const uiTest = Test('uiTest', {
    params: [
        {id: 'control', type: 'control<ui>', dynamic: true, mandatory: true},
        {id: 'expectedResult', type: 'boolean', dynamic: true, mandatory: true},
        {id: 'runBefore', type: 'action', dynamic: true},
        {id: 'allowError', as: 'boolean', dynamic: true, type: 'boolean'},
        {id: 'timeout', as: 'number', defaultValue: 200},
        {id: 'cleanUp', type: 'action', dynamic: true},
        {id: 'expectedCounters', as: 'single'},
        {id: 'emulateFrontEnd', as: 'boolean', type: 'boolean'},
        {id: 'transactiveHeadless', as: 'boolean', type: 'boolean'},
        {id: 'spy'}
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