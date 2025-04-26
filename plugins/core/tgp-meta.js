import { Component } from './jb-core.js'

export const tgpCompDef = Component('tgpCompDef', {
  type: 'tgpCompDef',
  params: [
    {id: 'id', as: 'string', mandatory: true},
    {id: 'type', as: 'string', byName: true},
    {id: 'dsl', as: 'string'},
    {id: 'category', as: 'string'},
    {id: 'description', as: 'string'},
    {id: 'location' },
    {id: 'params', type: 'tgpParam[]'},
    {id: 'impl', type: '$implType<>', dynamicType: '%type%', mandatory: true}
  ]
})

export const tgpType = Component('tgpType', {
  type: 'tgpType',
  params: [
    {id: 'type', as: 'string', mandatory: true},
    {id: 'dsl', as: 'string', byName: true}
  ]
})

export const param = Component('param', {
  type: 'tgpParam',
  singleInType: true,
  params: [
    {id: 'id', as: 'string', mandatory: true},
    {id: 'type', as: 'string'},
    {id: 'description', as: 'string'},
    {id: 'as', as: 'string', options: 'string,number,boolean,ref,single,array'},
    {id: 'dynamic', type: 'boolean', as: 'boolean', defaultValue: true},
    {id: 'mandatory', type: 'boolean', as: 'boolean', defaultValue: true},
    {id: 'composite', type: 'boolean', as: 'boolean', defaultValue: true},
    {id: 'singleInType', type: 'boolean', as: 'boolean', defaultValue: true},
    {id: 'defaultValue', dynamicType: '%type%'}
  ]
})

