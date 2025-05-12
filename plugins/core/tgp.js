import { jb, coreUtils } from './core-utils.js'
const { asJbComp, resolveProfileTop, jbComp, jbCompProxy } = coreUtils

Object.assign(coreUtils, { globalsOfType })

const CompDef = comp => jbCompProxy(new jbComp(resolveProfileTop(comp)))

const tgpComp = CompDef({ // bootstraping
  dsl: 'tgp',
  type: 'comp',
  id: 'tgpComp',
  params: [
    {id: 'id', as: 'string', mandatory: true},
    {id: 'type', as: 'string', byName: true},
    {id: 'dsl', as: 'string'},
    {id: 'description', as: 'string'},
    {id: 'params', type: 'param[]'},
    {id: 'impl', dynamicTypeFromParent: (parent, dsls) => dsls.tgp.comp[parent.$]?.dslType, mandatory: true}
  ]
})

Object.assign(jb.dsls.tgp, { TgpType, TgpTypeModifier, DefComponents, tgpComp })

function TgpTypeModifier(id, extraCompProps, tgpModel = jb) {
  return TgpType(extraCompProps.type, extraCompProps.dsl, {modifierId: id, ...extraCompProps}, tgpModel)
}

function TgpType(type, dsl, extraCompProps, tgpModel = jb) {
  const {ns, dsls} = tgpModel
  const capitalLetterId = extraCompProps?.modifierId || type.replace(/-|\./g,'_').replace(/^[a-z]/, c => c.toUpperCase())
  const dslType = `${type}<${dsl}>`
  const tgpType = (arg0,arg1) => {
    let [id,comp] = ['',null]
    if (typeof arg0 == 'string')
     [id,comp] = [arg0,arg1]
    else
      comp = arg0

    tgpType[id] = Component({...comp, id, dsl, type, ...extraCompProps})
    ;[type, ...(comp.moreTypes||'').split(',')].filter(x=>x).forEach(typeInStr=> {
      let [_type,_dsl] = [typeInStr,dsl]
      if (typeInStr.indexOf('<') != -1)
        [_type, _dsl] = splitDslType(typeInStr)
      dsls[_dsl][_type][id] = tgpType[id]
    })
    if (id.split('.').length > 1) {
      const [_ns, innerName] = id.split('.')
      ns[_ns] = ns[_ns] || {}
      ns[_ns][innerName] = tgpType[id]
    }
    return tgpType[id]
  }
  Object.assign(tgpType, {capitalLetterId, type, dsl, dslType})
  dsls[dsl] = dsls[dsl] || {}
  dsls[dsl][type] = dsls[dsl][type] || {}
  dsls[dsl][capitalLetterId] = tgpType
  return tgpType

  function Component(comp) {
    comp.$ = tgpComp[asJbComp]
    comp.$location = comp.$location || calcSourceLocation(new Error().stack.split(/\r|\n/)) || {}
    return CompDef(comp)
  }  
}

// meta tgp
const Any = TgpType('any','tgp')
const MetaVar = TgpType('var','tgp', {modifierId: 'Var'})
const MetaComp = TgpType('comp','tgp')
const MetaParam = TgpType('param','tgp')

// MetaComp('tgpType', {
//   id: 'comp<tgp>tgpType', // this id is used for tgp-model-data registration 
//   dsl: 'tgp',
//   type: 'comp',
//   params: [
//     {id: 'type', as: 'string', mandatory: true},
//     {id: 'dsl', as: 'string', byName: true}
//   ],
//   instanceParams: [
//     {id: 'id', as: 'string', mandatory: true},
//     {id: 'description', as: 'string'},
//     {id: 'params', type: 'param[]'},
//     {id: 'impl', dynamicTypeFromParent: parent => parent.$dslType, mandatory: true}
//   ]
// })

// MetaComp('tgpComp', { // appears also above, for bootstraping
//   params: [
//     {id: 'id', as: 'string', mandatory: true},
//     {id: 'type', as: 'string', byName: true},
//     {id: 'dsl', as: 'string'},
//     {id: 'description', as: 'string'},
//     {id: 'params', type: 'param[]'},
//     {id: 'impl', dynamicTypeFromParent: parent => parent.$dslType, mandatory: true}
//   ]
// })

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
      {id: 'async', as: 'boolean', type: 'boolean<common>'}
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




