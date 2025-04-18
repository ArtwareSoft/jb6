import { notifyInjectExtension } from '../core/jb-core.js'

const passiveSym = Symbol.for('passive')
export const consts = {}
function markAsPassive(obj) {
    if (obj && typeof obj == 'object') {
        obj[passiveSym] = true
        Object.values(obj).forEach(v=>markAsPassive(v))
    }
    return obj
}

notifyInjectExtension('db', {consts}, 1)

export function Const(id, val) {
    consts[id] = markAsPassive(val || {})
}
