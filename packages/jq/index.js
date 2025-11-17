import {dsls, jb, coreUtils} from '@jb6/core'
import jq from './lib/jqjs.js'

const {
    common: { Data }
} = dsls

jb.jQRepository = {}

coreUtils.jbjq = (script, ctx) => {
    const compiledJq = (jb.jQRepository[script] = jb.jQRepository[script] || jq.compileJb(script))
    return Array.from(compiledJq(ctx))[0]
}
coreUtils.jq = jq

coreUtils.compileJb = jq.compileJb

Data('jq',{
    params: [
        {id: 'script', as: 'text', asIs: true}
    ],
    impl: (ctx, {}, {script}) => {
        ctx.jbCtx.compiledJq = ctx.jbCtx.compiledJq || jq.compileJb(script)
        return [...ctx.jbCtx.compiledJq(ctx)]
    }
})

