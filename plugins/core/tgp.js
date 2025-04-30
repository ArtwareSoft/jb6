import { jb, Ctx, run, Var, CompDef } from './jb-core.js'
import { asJbComp, resolveProfileTop } from './jb-macro.js'
import { logError } from './logger.js'
export { jb, Ctx, run, Var }

jb.tgp = {}

jb.ext.tgp = {
  resolveProfileTop(comp) {  
    const dsl = comp.dsl || ''
    comp.$type = comp.type.indexOf('>') == -1 ? `${comp.type}<${dsl}>` : comp.type
    ;(comp.params || []).forEach(p=> {
      if (p.as == 'boolean' && ['boolean','ref'].indexOf(p.type) == -1) 
        p.type = 'boolean<>'
      const t1 = (p.type || '').replace(/\[\]/g,'') || 'data<>'
      p.$type = t1.indexOf('<') == -1 ? `${t1}<${comp.dsl || ''}>` : t1
      if (p.$type == 'control<>') debugger
    })
  },
  validateTgpTypes(profile) {

  }
}

export const tgpComp = CompDef({
  dsl: 'tgp',
  type: 'comp',
  id: 'comp<tgp>tgpComp',
  params: [
    {id: 'id', as: 'string', mandatory: true},
    {id: 'type', as: 'string', byName: true},
    {id: 'dsl', as: 'string'},
    {id: 'description', as: 'string'},
    {id: 'params', type: 'param[]'},
    {id: 'impl', type: '$implType<>', dynamicType: '%type%', mandatory: true}
  ]
})

export function Component(comp) {
    comp.$ = tgpComp[asJbComp]
    comp.$location = comp.$location || calcSourceLocation(new Error().stack.split(/\r|\n/)) || {}
    return CompDef(comp)
}

export const TgpType = (type, extraCompProps) => {
  const dsl = extraCompProps?.dsl || ''
  const typeWithDsl = `${type}<${dsl}>`
  const tgpType = (arg0,arg1) => {
    let [shortId,comp] = ['',null]
    if (typeof arg0 == 'string')
     [shortId,comp] = [arg0,arg1]
    else
      comp = arg0

    const id = shortId ? `${typeWithDsl}${shortId}` : ''
    return jb.tgp[dsl][type][shortId] = tgpType[shortId] = Component({...comp, id, dsl, type, ...extraCompProps})
  }
  tgpType.type = type
  tgpType.dsl = dsl
  tgpType.typeWithDsl = typeWithDsl
  jb.tgp[dsl] = jb.tgp[dsl] || {}
  jb.tgp[dsl][type] = {}
  return tgpType
}

export function globalsOfType(tgpType) { // not via tgpModel
  return Object.keys(tgpType).map(x=>tgpType[x]).map(x=>x[asJbComp]).filter(x=>x)
    .filter(x=>!(x.params || []).length).map(({id})=>id.split('>').pop())
}

// core types: Data and action
export const Any = TgpType('any')
export const Data = TgpType('data')
export const Boolean = TgpType('boolean')
export const Action = TgpType('action')

export function DefComponents(items,def) { items.forEach(item=>def(item)) }

export const tgpType = CompDef({
  dsl: 'tgp',
  type: 'comp',
  id: 'comp<tgp>tgpType',
  params: [
    {id: 'type', as: 'string', mandatory: true},
    {id: 'dsl', as: 'string', byName: true}
  ],
})

export const compByType = CompDef({
  dsl: 'tgp',
  type: 'comp',
  id: 'comp<tgp>compByType',
  params: [
    {id: 'id', as: 'string', mandatory: true},
    {id: 'description', as: 'string'},
    {id: 'params', type: 'param[]'},
    {id: 'impl', type: '$implType<>', dynamicType: '%type%', mandatory: true}
  ]
})

export const param = CompDef({
  dsl: 'tgp',
  type: 'param',
  id: 'param<tgp>param',
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

function calcSourceLocation(errStack) {
  try {
      const takeOutHostNameAndPort = /\/\/[^\/:]+(:\d+)?\//
      const line = errStack.map(x=>x.trim().replace(takeOutHostNameAndPort,'/'))
          .filter(x=>x && !x.match(/^Error/) && !x.match(/tgp.js/)).shift()
      const location = line ? (line.split('at ').pop().split('eval (').pop().split(' (').pop().match(/\\?([^:]+):([^:]+):[^:]+$/) || ['','','','']).slice(1,3) : ['','']
      location[0] = location[0].split('?')[0]
      if (location[0].match(/jb-loader.js/)) debugger
      const path = location[0]
      return { path, line: location[1] }
  } catch(e) {
    console.log(e)
  }      
}

const extHandlers = {}
const notifications = []
export function onInjectExtension(ext, handler) {
    setTimeout(() => {
        extHandlers[ext] = extHandlers[ext] || []
        extHandlers[ext].push(handler)
        // notify older notifications
        notifications.filter(n=>n.ext == ext).forEach(({extObj, level})=>handler(extObj, level))
    },0)
}

export function notifyInjectExtension(ext, extObj, level=1) {
    (extHandlers[ext] || []).forEach(h=>h(extObj, level))
    notifications.push({ext, extObj, level})
}


