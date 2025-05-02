import { jb } from './jb-core.js'
import { log, logError } from './logger.js'

const isPrimitiveValue = val => ['string','boolean','number'].indexOf(typeof val) != -1

const val = v => jb.ext.db ? jb.ext.db.val(v) : v
const asRef = v => jb.ext.db ? jb.ext.db.asRef(v) : logError('asRef. extension db/writable.js was not loaded',{})

export const consts = {}
export function Const(id, val) {
    const passiveSym = Symbol.for('passive')
    consts[id] = markAsPassive(val || {})

    function markAsPassive(obj) {
        if (obj && typeof obj == 'object') {
            obj[passiveSym] = true
            Object.values(obj).forEach(v=>markAsPassive(v))
        }
        return obj
    }    
}

export const RT_types = {
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

function compName(profile) {
  return profile.$?.id || profile.$$
}

const compParams = comp => comp?.params || []
const parentPath = path => path.split('~').slice(0,-1).join('~')


const asArray = v => v == null ? [] : (Array.isArray(v) ? v : [v])
const toArray = RT_types.array
const toString = RT_types.string
const toNumber = RT_types.number
const toSingle = RT_types.single
const toJstype = (val,type) => RT_types[type](val)

export const utils = { 
    isPromise, isPrimitiveValue, isRefType, resolveFinishedPromise, unique, asArray, toArray, toString, toNumber, toSingle, toJstype, 
    compName, compParams, parentPath,
    val: x=>val(x)
}
export { log, logError }

