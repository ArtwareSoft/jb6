import { jb, coreUtils } from './core-utils.js'
const { asJbComp, resolveProfileTop, jbComp, jbCompProxy } = coreUtils

const CompDef = comp => jbCompProxy(new jbComp(resolveProfileTop(comp)))

Object.assign(coreUtils, { globalsOfType })
Object.assign(jb.dsls.tgp, { TgpType, TgpTypeModifier, DefComponents })

export const tgpComp = CompDef({ // bootstraping
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

function TgpTypeModifier(id, extraCompProps) {
  return TgpType(extraCompProps.type, extraCompProps.dsl, {modifierId: id, ...extraCompProps})
}

function TgpType(type, dsl, extraCompProps) {
  const capitalLetterId = extraCompProps?.modifierId || type.replace(/-|\./g,'_').replace(/^[a-z]/, c => c.toUpperCase())
  const typeWithDsl = `${type}<${dsl}>`
  const tgpType = (arg0,arg1) => {
    let [shortId,comp] = ['',null]
    if (typeof arg0 == 'string')
     [shortId,comp] = [arg0,arg1]
    else
      comp = arg0

    const id = shortId ? `${typeWithDsl}${shortId}` : ''
    tgpType[shortId] = Component({...comp, id, dsl, type, ...extraCompProps})
    ;[type, ...(comp.moreTypes||'').split(',')].filter(x=>x).forEach(typeInStr=> {
      let [_type,_dsl] = [typeInStr,dsl]
      if (typeInStr.indexOf('<') != -1)
        [_type, _dsl] = typeInStr.match(/([^<]+)<([^>]+)/).slice(1)
      jb.dsls[_dsl][_type][shortId] = tgpType[shortId]
    })
    return tgpType[shortId]
  }
  Object.assign(tgpType, {capitalLetterId,type,dsl,typeWithDsl})
  jb.dsls[dsl] = jb.dsls[dsl] || {}
  jb.dsls[dsl][type] = jb.dsls[dsl][type] || {}
  jb.dsls[dsl][capitalLetterId] = tgpType
  return tgpType

  function Component(comp) {
    comp.$ = tgpComp[asJbComp]
    comp.$location = comp.$location || calcSourceLocation(new Error().stack.split(/\r|\n/)) || {}
    return CompDef(comp)
  }  
}

// meta tgp
const Any = TgpType('any','tgp')
const MetaVar = TgpType('var','tgp')
const MetaComp = TgpType('comp','tgp')
const MetaParam = TgpType('param','tgp')

MetaComp('tgpComp', { // appears also above, for bootstraping
  params: [
    {id: 'id', as: 'string', mandatory: true},
    {id: 'type', as: 'string', byName: true},
    {id: 'dsl', as: 'string'},
    {id: 'description', as: 'string'},
    {id: 'params', type: 'param[]'},
    {id: 'impl', type: '$implType<>', dynamicType: '%type%', mandatory: true}
  ]
})

MetaComp('tgpType', {
  params: [
    {id: 'type', as: 'string', mandatory: true},
    {id: 'dsl', as: 'string', byName: true}
  ],
  instanceParams: [
    {id: 'id', as: 'string', mandatory: true},
    {id: 'description', as: 'string'},
    {id: 'params', type: 'param[]'},
    {id: 'impl', type: '$implType<>', dynamicType: '%type%', mandatory: true}
  ]
})

MetaParam('param', {
  params: [
    {id: 'id', as: 'string', mandatory: true},
    {id: 'type', as: 'string'},
    {id: 'description', as: 'string'},
    {id: 'as', as: 'string', options: 'string,number,boolean,ref,single,array'},
    {id: 'dynamic', type: 'boolean', as: 'boolean', defaultValue: true},
    {id: 'mandatory', type: 'boolean', as: 'boolean', defaultValue: true},
    {id: 'composite', type: 'boolean', as: 'boolean', defaultValue: true},
    {id: 'defaultValue', dynamicType: '%type%'}
  ]
})

MetaVar('Var', {
  params: [
      {id: 'name', as: 'string', mandatory: true},
      {id: 'val', dynamic: true, type: 'data', mandatory: true, defaultValue: '%%'},
      {id: 'async', as: 'boolean', type: 'boolean<>'}
  ]
})

// common dsl
const Data = TgpType('data','common')
const Boolean = TgpType('boolean','common')

function DefComponents(items,def) { items.forEach(item=>def(item)) }

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

function globalsOfType(tgpType) { // not via tgpModel
  return Object.keys(tgpType).map(x=>tgpType[x]).map(x=>x[asJbComp]).filter(x=>x)
    .filter(x=>!(x.params || []).length).map(({id})=>id.split('>').pop())
}

// const extHandlers = {}
// const notifications = []
// export function onInjectExtension(ext, handler) {
//     setTimeout(() => {
//         extHandlers[ext] = extHandlers[ext] || []
//         extHandlers[ext].push(handler)
//         // notify older notifications
//         notifications.filter(n=>n.ext == ext).forEach(({extObj, level})=>handler(extObj, level))
//     },0)
// }

// export function notifyInjectExtension(ext, extObj, level=1) {
//     (extHandlers[ext] || []).forEach(h=>h(extObj, level))
//     notifications.push({ext, extObj, level})
// }

Any('asIs', {
  params: [
    {id: 'val', ignore: true}
  ],
  impl: ctx => { debugger; ctx.args.val }
})

Any('If', {
  macroByValue: true,
  params: [
    {id: 'condition', as: 'boolean', mandatory: true, dynamic: true, type: 'boolean'},
    {id: 'then', type: '$asParent', dynamic: true, composite: true},
    {id: 'Else', type: '$asParent', dynamic: true}
  ],
  impl: ({},{ condition, then, Else}) => condition() ? then() : Else()
})

Any('TBD', {
  hidden: true,
  impl: 'TBD'
})

Any('runCtx', {
  type: 'any',
  hidden: true,
  params: [
    {id: 'path', as: 'string'},
    {id: 'Vars'},
    {id: 'profile'}
  ]
})

jb.ext.tgp = {
  resolveProfileTop(comp) {  
    const dsl = comp.dsl || ''
    comp.$type = comp.type.indexOf('>') == -1 ? `${comp.type}<${dsl}>` : comp.type
    ;(comp.params || []).forEach(p=> {
      if (p.as == 'boolean' && ['boolean','ref'].indexOf(p.type) == -1) 
        p.type = 'boolean<common>'
      const t1 = (p.type || '').replace(/\[\]/g,'') || 'data<common>'
      p.$type = t1.indexOf('<') == -1 ? `${t1}<${comp.dsl || ''}>` : t1
      if (p.$type == 'control<>') debugger
    })
  },
  validateTgpTypes(profile) {

  }
}


// export const tgpType = CompDef({
//   dsl: 'tgp',
//   type: 'comp',
//   id: 'comp<tgp>tgpType',
//   params: [
//     {id: 'type', as: 'string', mandatory: true},
//     {id: 'dsl', as: 'string', byName: true}
//   ],
// })


// CompDef({
//   dsl: 'tgp',
//   type: 'comp',
//   id: 'comp<tgp>compByType',
//   params: [
//     {id: 'id', as: 'string', mandatory: true},
//     {id: 'description', as: 'string'},
//     {id: 'params', type: 'param[]'},
//     {id: 'impl', type: '$implType<>', dynamicType: '%type%', mandatory: true}
//   ]
// })

