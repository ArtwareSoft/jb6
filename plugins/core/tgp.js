import { jb, Ctx, run, jbComp, Var } from './jb-core.js'
import { asJbComp, jbCompProxy, resolveProfileTop, argsToProfile, OrigArgs, systemParams } from './jb-macro.js'
import { logError } from './logger.js'
export { jb, Ctx, run, Var }

jb.ext.tgp = {
  resloveParam(p, jbComp) {
    if (p.as == 'boolean' && ['boolean','ref'].indexOf(p.type) == -1) 
      p.type = 'boolean<>'
    const t1 = (p.type || '').replace(/\[\]/g,'') || 'data<>'
    p.$type = t1.indexOf('<') == -1 ? `${t1}<${jbComp.dsl}>` : t1
  },
  validateTgpTypes(profile) {

  }
}

const CompDef = comp => jbCompProxy(new jbComp(resolveProfileTop(comp))) // avoid recursion of Component
export const tgpCompDef = CompDef({
  id: 'tgpCompDef<>tgpCompDef',
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

export function Component(comp) {
    comp.$ = tgpCompDef[asJbComp]
    comp.$location = comp.$location || calcSourceLocation(new Error().stack.split(/\r|\n/)) || {}
    return jbCompProxy(new jbComp(resolveProfileTop(comp)))
}

export const TgpType = (type, extraCompProps) => {
  const typeWithDsl = `${type}<${extraCompProps?.dsl || ''}>`
  const tgpType = (arg0,arg1) => {
    let [shortId,comp] = ['',null]
    if (typeof arg0 == 'string')
     [shortId,comp] = [arg0,arg1]
    else
      comp = arg0

    const id = shortId ? `${typeWithDsl}${shortId}` : ''
    return jb.types[typeWithDsl][shortId] = tgpType[shortId] = Component({...comp, id, type, ...extraCompProps})
  }
  tgpType.type = type
  tgpType.typeWithDsl = typeWithDsl
  jb.types[typeWithDsl] = {}
  return tgpType
}

export function globalsOfType(tgpType) {
  return Object.keys(tgpType).map(x=>tgpType[x]).map(x=>x[asJbComp]).filter(x=>x)
    .filter(x=>!(x.params || []).length).map(({id})=>id.split('>').pop())
}

// core types: Data and action
export const Any = TgpType('any')
export const Data = TgpType('data')
export const Boolean = TgpType('boolean')
export const Action = TgpType('action')

export function DefComponents(items,def) { items.forEach(item=>def(item)) }

export const tgpType = Component({
  id: 'tgpType<>tgpType',
  type: 'tgpType',
  params: [
    {id: 'type', as: 'string', mandatory: true},
    {id: 'dsl', as: 'string', byName: true}
  ]
})

export const param = Component({
  id: 'tgpParam<>param',
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



// export function ComponentOld(...args) {
//   if (typeof args[0] != 'string') {
//       const comp = args[0]
// //      comp.$dsl = comp.dsl || ''
//       comp.$ = tgpCompDef[asJbComp] //'tgpCompDef<>tgpCompDef'
//       return jbCompProxy(resolveCompArgs(new jbComp(resolveProfileTop(comp))))
//   }

//   const [id, comp] = args
// //  comp.$dsl = comp.dsl || ''
//   comp.$ = tgpCompDef[asJbComp]
//   //if (comp.type == 'any') jb.genericCompIds[id] = true
//   comp.$location = calcSourceLocation(new Error().stack.split(/\r|\n/)) || {}

//   //registerProxy(id)
//   const resolved = resolveProfileTop(comp, {id})
//   return jbCompProxy(new jbComp(resolved)) // lazy resolveCompArgs
// }

