import { dsls, ns } from '@jb6/core'
import '@jb6/common'

const {
  tgp: { 
    any: { typeAdapter }
  },
  common: { Data }
} = dsls

Data('ns1.test1', {
  impl: ''
})
const { ns1 } = ns

Data('xx', {
  impl: typeAdapter('action<common>', ns1.test1())
})
