export const jb = {
  proxies: {},
  ext: {},
  coreRegistry: {
    consts: {}
  },
  dsls: {
    tgp: { Const }
  },
  ns: {}
}

const isPrimitiveValue = val => ['string','boolean','number'].indexOf(typeof val) != -1

const val = v => jb.ext.db ? jb.ext.db.val(v) : v
const asRef = v => jb.ext.db ? jb.ext.db.asRef(v) : logError('asRef. extension db/writable.js was not loaded',{})

const RT_types = {
    asIs: x => x,
    object(value) {
      if (Array.isArray(value))
        value = value[0]
      if (value && typeof value === 'object')
        return val(value)
      return {}
    },
    string(value) {
      if (Array.isArray(value)) value = value[0]
      if (value == null) return ''
      value = val(value)
      if (typeof(value) == 'undefined') return ''
      return '' + value
    },
    number(value) {
      if (Array.isArray(value)) value = value[0]
      if (value == null || value == undefined) return null // 0 is not null
      const num = Number(val(value),true)
      return isNaN(num) ? null : num
    },
    array(value) {
      if (typeof value == 'function' && value.profile)
        value = value()
      value = val(value)
      if (Array.isArray(value)) return value
      if (value == null) return []
      return [value]
    },
    boolean(value) {
      if (Array.isArray(value)) value = value[0]
      value = val(value)
      return value && value != 'false' ? true : false
    },
    single(value) {
      if (Array.isArray(value))
        value = value[0]
      return val(value)
    },
    ref(value) {
      if (Array.isArray(value))
        value = value[0]
      return asRef(value)
    },
    'ref[]': function(value) {
      return asRef(value)
    },
    value(value) {
      return val(value)
    }
}

const isRefType = jstype => jstype === 'ref' || jstype === 'ref[]'

function resolveFinishedPromise(val) {
    if (val && typeof val == 'object' && val._state == 1) // finished promise
      return val._result
    return val
}

const unique = (ar,f) => {
    const keys = {}, res = []
    ar.forEach(x =>{
      const key = f ? f(x) : x
      if (!keys[key]) res.push(x)
      keys[key] = true
    })
    return res
}
const isPromise = v => v && v != null && typeof v.then === 'function'

function compIdOfProfile(profile) {
  if (typeof profile.$$ == 'string') return profile.$$
  return `${profile.$$.$dslType}${profile.$$.id}`
}

const compParams = comp => comp?.params || []
const parentPath = path => path.split('~').slice(0,-1).join('~')

const asArray = v => v == null ? [] : (Array.isArray(v) ? v : [v])
const toArray = RT_types.array
const toString = RT_types.string
const toNumber = RT_types.number
const toSingle = RT_types.single
const toJstype = (val,type) => RT_types[type](val)

function log(logNames, logObj) {
  jb.ext.spy?.log(logNames, logObj)
}

function logError(err,logObj) {
  const { ctx, url, line, col } = logObj || {}
  const { jbCtx: { callerStack, creatorStack }} = ctx || { jbCtx: {} }
  const srcLink = url && globalThis.window ? `${window.location.origin}${url}:${line+1}:${col} ` : ''
  globalThis.window && globalThis.console.error(srcLink+'%c Error: ','color: red', err, logObj, callerStack, creatorStack)
  const errObj = { err , ...logObj, callerStack, creatorStack}
  globalThis.jbHost?.process && globalThis.jbHost.process.stderr.write(err)
  jb.ext.spy?.log('error', errObj)
}

function logException(e,err,logObj) {
  globalThis.window && globalThis.console.log('%c Exception: ','color: red', err, e, logObj)
  const errObj = { e, err, stack: e.stack||'', ...logObj}
  globalThis.jbHost?.process && globalThis.jbHost.process.stderr.write(`${err}\n${e}`)
  jb.ext.spy?.log('exception error', errObj)
}

function Const(id, val) {
  const passiveSym = Symbol.for('passive')
  jb.coreRegistry.consts[id] = markAsPassive(val || {})

  function markAsPassive(obj) {
      if (obj && typeof obj == 'object') {
          obj[passiveSym] = true
          Object.values(obj).forEach(v=>markAsPassive(v))
      }
      return obj
  }    
}

function calcPath(object,_path,value) {
  if (!object) return object
  let cur = object
  if (typeof _path === 'string') _path = _path.split('.')
  _path = coreUtils.asArray(_path)

  if (typeof value == 'undefined') {  // get
    return _path.reduce((o,k)=>o && o[k], object)
  } else { // set
    for(let i=0;i<_path.length;i++)
      if (i == _path.length-1)
        cur[_path[i]] = value
      else
        cur = cur[_path[i]] = cur[_path[i]] || {}
    return value
  }
}

function splitDslType(dslType) {
  return dslType.match(/^([^<]+)<([^>]+)>$/).slice(1)
}

jb.coreUtils = {
  jb, RT_types, log, logError, logException, 
  isPromise, isPrimitiveValue, isRefType, resolveFinishedPromise, unique, asArray, toArray, toString, toNumber, toSingle, toJstype, 
  compIdOfProfile, compParams, parentPath, calcPath, splitDslType,
  val: x=>val(x)
}

export const coreUtils = jb.coreUtils

