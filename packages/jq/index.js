import {dsls} from '@jb6/core'

const {
    common: { Data }
} = dsls

//import jq from './jq.js'
// let jqPromise = null
// function init_jq() {
//   if (jqPromise) return jqPromise
//   jqPromise = new Promise((resolve, reject) => {
//     const s = document.createElement('script')
//     s.src = `/jb6_packages/jq/lib/jq.js`
//     //s.async = true
//     s.onerror = () => reject(new Error(`Failed to load ${s.src}`))
//     s.onload = () => Promise.resolve(window.jq).then(res=>resolve(res))
//     document.head.appendChild(s)
//   })

//   return jqPromise
// }
//const jq = await init_jq()

import jq from './lib/jqjs.js'

Data('jq',{
    params: [
        {id: 'script', as: 'text', asIs: true}
    ],
    impl: (ctx,{script}) => {
        ctx.jbCtx.compiledJq = ctx.jbCtx.compiledJq || jq.compileJb(script)
        return [...ctx.jbCtx.compiledJq(ctx)]
    }
})

