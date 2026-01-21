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

Data('jq', {
  moreTypes: 'boolean<common>',
  params: [
    {id: 'script', as: 'text', asIs: true},
    {id: 'first', as: 'boolean', byName: true}
  ],
  impl: (ctx, {}, {script, first}) => {
    const complied = ctx.jbCtx.compiledJq = ctx.jbCtx.compiledJq || jq.compileJb(script)
    const parentParam = ctx.jbCtx.parentParam
    const single = first || parentParam?.$dslType == 'boolean<common>' || ['string','text','number','boolean'].indexOf(parentParam?.as) != -1
    return single ? complied(ctx).next().value : Array.from(complied(ctx))
  }
})

Data('jqArray', {
  params: [
    {id: 'exp', as: 'text'},
  ],
  impl: (ctx, { workflowLogger }, {exp}) => {
    const logger = workflowLogger || ctx.vars.logger
    const compiledJq = compileJqExpression(exp, '| .[]', logger, ctx, 'jqArray')
    const result = executeJq(compiledJq, ctx, logger, exp, 'jqArray', (gen) => Array.from(gen))
    return result || []
  }
})

Data('jqSingle', {
  params: [
    {id: 'exp', as: 'text'},
  ],
  impl: (ctx, { workflowLogger }, {exp}) => {
    const logger = workflowLogger || ctx.vars.logger
    const compiledJq = compileJqExpression(exp, null, logger, ctx, 'jqSingle')
    return executeJq(compiledJq, ctx, logger, exp, 'jqSingle')
  }
})

Data('jqBoolean', {
  moreTypes: 'boolean<common>',
  params: [
    {id: 'exp', as: 'text', type: 'data<common>', $dslType: 'data<common>'}
  ],
  impl: (ctx, { workflowLogger }, {exp}) => {
    const logger = workflowLogger || ctx.vars.logger
    const compiledJq = compileJqExpression(exp, null, logger, ctx, 'jqBoolean')
    const result = executeJq(compiledJq, ctx, logger, exp, 'jqBoolean')
    return !!result
  }
})


function compileJqExpression(exp, suffix, logger, ctx, operationName) {
  const cacheKey = suffix ? exp + suffix : exp
  try {
    return jb.jQRepository[cacheKey] = jb.jQRepository[cacheKey] || coreUtils.compileJb(exp + (suffix || ''))
  } catch (error) {
    logger?.error({t: `compile ${operationName} error`, exp}, {}, {ctx, error})
    return null
  }
}

function executeJq(compiledJq, ctx, logger, exp, operationName, extractor) {
  if (!compiledJq) return null
  
  try {
    const result = extractor ? extractor(compiledJq(ctx)) : compiledJq(ctx).next().value
    logger?.info({t: operationName}, { exp, res: result }, {ctx})
    return result
  } catch (error) {
    logger?.error({t: `run ${operationName} error`, exp}, {}, {ctx, error})
    return null
  }
}


