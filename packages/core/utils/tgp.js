import { jb } from '@jb6/repo'
import './core-utils.js'
const { coreUtils } = jb
const { asJbComp, resolveProfileTop, jbComp, jbCompProxy, splitDslType } = coreUtils

Object.assign(coreUtils, { globalsOfType, ptsOfType })

const CompDef = comp => jbCompProxy(new jbComp(resolveProfileTop(comp)))

const tgpComp = CompDef({ // bootstraping
  dsl: 'tgp',
  type: 'comp',
  id: 'tgpComp',
  params: [
    {id: 'id', as: 'string', mandatory: true},
    {id: 'type', as: 'string', byName: true},
    {id: 'dsl', as: 'string'},
    {id: 'macroByValue', as: 'boolean'},
    {id: 'description', as: 'string'},
    {id: 'doNotRunInTests', as: 'boolean' },
    {id: 'circuit', as: 'string' },
    {id: 'params', type: 'param[]'},
    {id: 'impl', dynamicTypeFromParent: (parent, dsls) => dsls.tgp.comp[parent.$]?.dslType, mandatory: true},
  ]
})

Object.assign(jb.dsls.tgp, { TgpType, TgpTypeModifier, DefComponents, tgpComp })

function TgpTypeModifier(id, extraCompProps, tgpModel = jb) {
  return TgpType(extraCompProps.type, extraCompProps.dsl, {modifierId: id, ...extraCompProps}, tgpModel)
}

function TgpType(type, dsl, extraCompProps, tgpModel = jb) {
  const {ns, dsls} = tgpModel
  const capitalLetterId = extraCompProps?.modifierId || type.replace(/-(.)/g, (_, letter) => letter.toUpperCase()).replace(/^./, c => c.toUpperCase())
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

MetaParam('param', {
  params: [
    {id: 'id', as: 'string', mandatory: true},
    {id: 'type', as: 'string', description: 'type or type<dsl> e.g. control,control[],control<ui>'},
    {id: 'description', as: 'string'},
    {id: 'as', as: 'string', options: 'string,number,boolean,ref,single,array'},
    {id: 'dynamic', as: 'boolean' },
    {id: 'mandatory', as: 'boolean' },
    {id: 'composite', as: 'boolean' },
    {id: 'defaultValue', dynamicType: '%type%'},
    {id: 'byName', as: 'boolean'},
    {id: 'dynamicTypeFromParent', as: 'string'},
    {id: 'secondParamAsArray', as: 'boolean'},
    {id: 'newLinesInCode', as: 'boolean'},
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
const Action = TgpType('action','common')

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
  return Object.keys(tgpType).map(x=>tgpType[x]).map(x=>x[asJbComp]).filter(x=>x).filter(x=>!(x.params || []).length).map(({id})=>id.split('>').pop())
}

function ptsOfType(tgpType) { // not via tgpModel
  return Object.keys(tgpType).map(x=>tgpType[x]).map(x=>x[asJbComp]).filter(x=>x).filter(x=>(x.params || []).length).map(({id})=>id.split('>').pop())
}

Data('asIs', {
  params: [
    {id: 'val', ignore: true}
  ],
  impl: ctx => ctx.args.val
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

Any('typeAdapter', {
  params: [
    {id: 'fromType', as: 'string', mandatory: true, description: 'e.g. type1<myDsl>'},
    {id: 'val', dynamicTypeFromParent: 'fromType', mandatory: true}
  ],
  impl: (ctx, {val}) => val
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

Action('runActions', {
  params: [
    {id: 'actions', type: 'action[]', dynamic: true, composite: true, mandatory: true}
  ],
  impl: (ctx, {actions}) => asArray(actions).reduce((pr,_,index) => pr.finally(() => ctx.runInnerArg(actions,index)), Promise.resolve())
})


