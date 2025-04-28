import { jb, Any, Data } from './tgp.js'
import { logError, log as _log } from './logger.js'

export const typeAdapter = Any('typeAdapter', {
  params: [
    {id: 'fromType', as: 'string', mandatory: true, description: 'e.g. type1<myDsl>'},
    {id: 'val'}
  ],
  impl: ctx => ctx.args.val
})

export const If = Any('If', {
  macroByValue: true,
  params: [
    {id: 'condition', as: 'boolean', mandatory: true, dynamic: true, type: 'boolean'},
    {id: 'then', type: '$asParent', dynamic: true, composite: true},
    {id: 'Else', type: '$asParent', dynamic: true}
  ],
  impl: ({},{ cond,this: _then, else: _else}) => cond() ? _then() : _else()
})

export const TBD = Any('TBD', {
  hidden: true,
  impl: 'TBD'
})

export const runCtx = Any('runCtx', {
  type: 'any',
  hidden: true,
  params: [
    {id: 'path', as: 'string'},
    {id: 'Vars'},
    {id: 'profile'}
  ]
})

export const log = Data('log', {
  moreTypes: 'action<>',
  params: [
    {id: 'logName', as: 'string', mandatory: 'true'},
    {id: 'logObj', as: 'single', defaultValue: '%%'}
  ],
  impl: (ctx,{logName,logObj}) => { _log(logName,{...logObj,ctx}); return ctx.data }
})
