import { val, asRef } from './db.js'

export const isPrimitiveValue = val => ['string','boolean','number'].indexOf(typeof val) != -1

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

export const isRefType = jstype => jstype === 'ref' || jstype === 'ref[]'

export function resolveFinishedPromise(val) {
    if (val && typeof val == 'object' && val._state == 1) // finished promise
      return val._result
    return val
}

export const unique = (ar,f) => {
    const keys = {}, res = []
    ar.forEach(x =>{
      const key = f ? f(x) : x
      if (!keys[key]) res.push(x)
      keys[key] = true
    })
    return res
}

export const asArray = v => v == null ? [] : (Array.isArray(v) ? v : [v])

export const path = (object,_path,value) => {
    if (!object) return object
    let cur = object
    if (typeof _path === 'string') _path = _path.split('.')
    _path = asArray(_path)

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