import { jb } from '@jb6/repo'
import './core-utils.js'
const { coreUtils } = jb
const { asJbComp, resolveProfileTop, jbComp, jbCompProxy, splitDslType, Ctx, asArray, logError } = coreUtils

Object.assign(coreUtils, { globalsOfType, ptsOfType, toCapitalType })

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
    {id: 'HeavyTest', as: 'boolean' },
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

const nsProxy = (ns) => new Proxy(() => 0, {
  get: (o,id) => {
    const res = (...args) => ({ $: '__', $delayed: () => {
      const comp = jb.nsRepo[ns][id]
      if (!comp) {
        logError(`delayed ns profile. can not find profile ${ns}.${id}`)
        return 'missing ${ns}.${id}'
      }
      return comp(...args) 
    }} )
    res.$run = (...args) => new Ctx().run(res(...args))
    return res
  }
})

const forwardProxy = (dsl,type,id) => new Proxy(() => 0, {
  get: (o,p) => {
    const comp = jb.dsls[dsl]?.[type]?.[id]
    if (!comp) {
      logError(`delayed forward profile. can not find profile ${type}<${dsl}>${id}`)
      return 'missing ${type}<${dsl}>${id}'
    }
    if (p == '$run')
      return (...args) => comp.$run(...args) 
    
    return p === asJbComp && comp[asJbComp]
  },
  apply: () => (...args) => ({ $: '__', $delayed: () => {
      const comp = jb.dsls[dsl]?.[type]?.[id]
      if (!comp) {
        logError(`delayed forward profile. can not find profile ${type}<${dsl}>${id}`)
        return 'missing ${type}<${dsl}>${id}'
      }
      return comp(...args) 
    }})
})

function toCapitalType(type) {
  return type.replace(/-(.)/g, (_, letter) => letter.toUpperCase()).replace(/^./, c => c.toUpperCase())
}

function TgpType(type, dsl, extraCompProps, tgpModel = jb) {
  const {ns, dsls, nsRepo} = tgpModel
  const capitalLetterId = extraCompProps?.modifierId || toCapitalType(type)
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
      // ns[_ns] = ns[_ns] || {}
      // ns[_ns][innerName] = tgpType[id]

      ns[_ns] = ns[_ns] || nsProxy(_ns)
      nsRepo[_ns] = nsRepo[_ns] || {}
      nsRepo[_ns][innerName] = tgpType[id]
    }
    return tgpType[id]
  }

  const forward = id => forwardProxy(dsl,type,id)
  Object.assign(tgpType, {capitalLetterId, type, dsl, dslType, forward})
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
    {id: 'as', as: 'string', options: 'string,text,number,boolean,ref,single,array'},
    {id: 'dynamic', as: 'boolean' },
    {id: 'mandatory', as: 'boolean' },
    {id: 'composite', as: 'boolean' },
    {id: 'defaultValue', dynamicType: '%type%'},
    {id: 'byName', as: 'boolean'},
    {id: 'asIs', as: 'boolean', description: 'do not evaluate expressions'},
    {id: 'dynamicTypeFromParent', as: 'string'},
    {id: 'secondParamAsArray', as: 'boolean'},
    {id: 'newLinesInCode', as: 'boolean'},
    {id: 'importance', as: 'text'},
    {id: 'guidance', as: 'text'},
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
const Action = TgpType('action','common')

TgpType('boolean','common')
TgpType('reactive-source','rx') // callbag api
TgpType('reactive-operator','rx') // callbag api

function DefComponents(items,def) { items.split(',').forEach(item=>def(item)) } // 'templateParam' must be used as param name

function calcSourceLocation(errStack) {
  try {
      const takeOutHostNameAndPort = /\/\/[^\/:]+(:\d+)?\//
      const line = errStack.map(x=>x.trim().replace(takeOutHostNameAndPort,'/'))
          .filter(x=>x && !x.match(/^Error/) && !x.match(/tgp.js/)).shift()
      const location = line ? (line.split('at ').pop().split('eval (').pop().split(' (').pop().match(/\\?([^:]+):([^:]+):[^:]+$/) || ['','','','']).slice(1,3) : ['','']
      location[0] = location[0].split('?')[0]
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

// Action('writeValue', {
//   params: [
//     {id: 'to', as: 'ref', mandatory: true},
//     {id: 'value', mandatory: true},
//   ],
//   impl: (ctx,to,value) => {
//     const val = calcValue(value)
//     if (isPromise(val))
//       return Promise.resolve(val).then(_val=>jb.dbUtils?.writeValue(to,_val,ctx))
//     else
//       jb.dbUtils?.writeValue(to,val,ctx)
//   }
// })