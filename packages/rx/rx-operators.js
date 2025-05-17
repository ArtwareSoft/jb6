import { coreUtils, dsls, ns } from '../core/all.js'
import { callbag } from './jb-callbag.js'
const { log } = coreUtils
const {
  tgp: { TgpType,
    any: { If }
  },
} = dsls

export const RXOperator = TgpType('op', 'rx', {modifierId: 'RXOperator'})

export function addDebugInfo(f,ctx) { f.ctx = ctx; return f}

RXOperator('rx.innerPipe',{
  description: 'composite operator, inner reactive pipeline without source',
  params: [
    {id: 'elems', type: 'op[]', as: 'array', mandatory: true, templateValue: []}
  ],
  impl: (ctx, {elems}) => source => callbag.pipe(source, ...elems)
})

const { rx } = ns

RXOperator('rx.fork',{
  description: 'separate operator with same source data',
  params: [
    {id: 'elems', type: 'op[]', as: 'array', mandatory: true, templateValue: []}
  ],
  impl: (ctx, {elems}) => callbag.fork(...elems)
})

RXOperator('rx.startWith',{
  description: 'startWith callbags sources (or any)',
  params: [
    {id: 'sources', type: 'source[]', as: 'array'}
  ],
  impl: (ctx, {sources}) => callbag.startWith(...sources)
})

RXOperator('rx.var',{
  description: 'define an immutable variable that can be used later in the pipe',
  params: [
    {id: 'name', as: 'string', dynamic: true, mandatory: true, description: 'if empty, does nothing'},
    {id: 'value', dynamic: true, defaultValue: '%%', mandatory: true}
  ],
  impl: If('%$name%', (ctx, {}, {name, value}) => source => (start, sink) => {
    if (start != 0) return
    return source(0, function Var(t, d) {
      sink(t, t === 1 ? d && {data: d.data, vars: {...d.vars, [name()]: value(d)}} : d)
    })
  })
})

RXOperator('rx.vars',{
  description: 'define an immutable variables that can be used later in the pipe',
  params: [
    {id: 'Vars', dynamic: true}
  ],
  impl: (ctx, {Vars}) => source => (start, sink) => {
    if (start != 0) return
    return source(0, function VarsFunc(t, d) {
      sink(t, t === 1 ? d && {data: d.data, vars: {...d.vars, ...Vars(d)}} : d)
    })
  }
})

RXOperator('rx.resource',{
  description: 'define a static mutable variable that can be used later in the pipe',
  params: [
    {id: 'name', as: 'string', dynamic: true, mandatory: true, description: 'if empty, does nothing'},
    {id: 'value', dynamic: true, mandatory: true}
  ],
  impl: If('%$name%', (ctx, {}, {name, value}) => source => (start, sink) => {
    if (start != 0) return
    let val, calculated
    return source(0, function Var(t, d) {
      val = calculated ? val : value()
      calculated = true
      sink(t, t === 1 ? d && {data: d.data, vars: {...d.vars, [name()]: val}} : d)
    })
  })
})

RXOperator('rx.reduce',{
  description: 'incrementally aggregates/accumulates data in a variable, e.g. count, concat, max, etc',
  params: [
    {id: 'varName', as: 'string', mandatory: true, description: 'the result is accumulated in this var', templateValue: 'acc'},
    {id: 'initialValue', dynamic: true, description: 'receives first value as input', mandatory: true},
    {id: 'value', dynamic: true, defaultValue: '%%', description: 'the accumulated value use %$acc%,%% %$prev%', mandatory: true},
    {id: 'avoidFirst', as: 'boolean', description: 'used for join with separators, initialValue uses the first value without adding the separtor', type: 'boolean'}
  ],
  impl: (ctx, {varName, initialValue, value, avoidFirst}) => source => (start, sink) => {
    if (start !== 0) return
    let acc, prev, first = true
    source(0, function reduce(t, d) {
      if (t == 1) {
        if (first) {
          acc = initialValue(d)
          first = false
          if (!avoidFirst)
            acc = value({data: d.data, vars: {...d.vars, [varName]: acc}})
        } else {
          acc = value({data: d.data, vars: {...d.vars, prev, [varName]: acc}})
        }
        sink(t, acc == null ? d : {data: d.data, vars: {...d.vars, [varName]: acc}})
        prev = d.data
      } else {
        sink(t, d)
      }
    })
  }
})

RXOperator('rx.count',{
  params: [
    {id: 'varName', as: 'string', mandatory: true, defaultValue: 'count'}
  ],
  impl: rx.reduce('%$varName%', 0, {value: (ctx, {}, {varName}) => ctx.vars[varName] + 1})
})

RXOperator('rx.join',{
  params: [
    {id: 'varName', as: 'string', mandatory: true, defaultValue: 'join'},
    {id: 'separator', as: 'string', defaultValue: ','}
  ],
  impl: rx.reduce('%$varName%', '%%', {
    value: (ctx, {}, {varName, separator}) => [ctx.vars[varName], ctx.data].join(separator),
    avoidFirst: true
  })
})

RXOperator('rx.max',{
  params: [
    {id: 'varName', as: 'string', mandatory: true, defaultValue: 'max'},
    {id: 'value', dynamic: true, defaultValue: '%%'}
  ],
  impl: rx.reduce('%$varName%', -Infinity, {
    value: (ctx, {}, {varName, value}) => Math.max(ctx.vars[varName], value(ctx))
  })
})

RXOperator('rx.do',{
  params: [
    {id: 'action', type: 'action', dynamic: true, mandatory: true}
  ],
  impl: (ctx, {action}) => callbag.Do(ctx2 => action(ctx2))
})

RXOperator('rx.doPromise',{
  params: [
    {id: 'action', type: 'action', dynamic: true, mandatory: true}
  ],
  impl: (ctx, {action}) => callbag.doPromise(ctx2 => action(ctx2))
})

RXOperator('rx.map',{
  params: [
    {id: 'func', dynamic: true, mandatory: true}
  ],
  impl: (ctx, {func}) => callbag.map(addDebugInfo(ctx2 => ctx.dataObj(func(ctx2), ctx2.vars || {}, ctx2.data), ctx))
})

RXOperator('rx.mapPromise',{
  params: [
    {id: 'func', type: 'data', moreTypes: 'action<common>', dynamic: true, mandatory: true}
  ],
  impl: (ctx, {func}) => callbag.mapPromise(ctx2 => Promise.resolve(func(ctx2)).then(data => ctx.dataObj(data, ctx2.vars || {}, ctx2.data))
    .catch(err => ({vars: {...ctx2.vars, err}, data: err})))
})

RXOperator('rx.filter',{
  category: 'filter',
  params: [
    {id: 'filter', type: 'boolean', dynamic: true, mandatory: true}
  ],
  impl: (ctx, {filter}) => callbag.filter(addDebugInfo(ctx2 => filter(ctx2), ctx))
})

RXOperator('rx.flatMap',{
  description: 'match inputs the callbags or promises',
  params: [
    {id: 'source', type: 'rx', category: 'source', dynamic: true, mandatory: true, description: 'map each input to source callbag'},
    {id: 'onInputBegin', type: 'action', dynamic: true, byName: true},
    {id: 'onInputEnd', type: 'action', dynamic: true},
    {id: 'onItem', type: 'action', dynamic: true}
  ],
  impl: (ctx, {source: sourceGenerator, onInputBegin, onInputEnd, onItem}) => source => (start, sink) => {
    if (start !== 0) return
    let sourceTalkback, innerSources = [], sourceEnded

    source(0, function flatMap(t, d) {
      if (t === 0)
        sourceTalkback = d
      if (t === 1 && d != null)
        createInnerSrc(d)
      if (t === 2) {
        sourceEnded = true
        stopOrContinue(d)
      }
    })

    sink(0, function flatMap(t, d) {
      if (t == 1 && d == null || t == 2) {
        sourceTalkback && sourceTalkback(t, d)
        innerSources.forEach(src => src.talkback && src.talkback(t, d))
      }
    })

    function createInnerSrc(d) {
      const ctxToUse = ctx.setData(d.data).setVars(d.vars)
      const newSrc = sourceGenerator(ctxToUse)
      innerSources.push(newSrc)
      onInputBegin.profile && onInputBegin(ctxToUse)
      newSrc(0, function flatMap(t, d) {
        if (t == 0) newSrc.talkback = d
        if (t == 1) {
          if (d && onItem.profile) onItem(ctxToUse.setData(d))
          sink(t, d)
        }
        if (t != 2 && newSrc.talkback) newSrc.talkback(1)
        if (t == 2) {
          onInputEnd.profile && onInputEnd(ctxToUse)
          innerSources.splice(innerSources.indexOf(newSrc), 1)
          stopOrContinue(d)
        }
      })
    }

    function stopOrContinue(d) {
      if (sourceEnded && innerSources.length == 0)
        sink(2, d)
    }
  }
})

RXOperator('rx.concatMap',{
  category: 'operator,combine',
  params: [
    {id: 'func', type: 'rx', dynamic: true, mandatory: true, description: 'keeps the order of the results, can return array, promise or callbag'},
    {id: 'combineResultWithInput', dynamic: true, description: 'combines %$input% with the inner result %%'}
  ],
  impl: (ctx, {func, combineResultWithInput: combine}) => combine.profile
    ? callbag.concatMap(ctx2 => func(ctx2), (input, {data}) => combine({data, vars: {...input.vars, input: input.data}}))
    : callbag.concatMap(ctx2 => func(ctx2))
})

RXOperator('rx.distinctUntilChanged',{
  description: 'filters adjacent items in stream',
  category: 'filter',
  params: [
    {id: 'equalsFunc', dynamic: true, mandatory: true, defaultValue: ({data}, {prev}) => data === prev, description: 'e.g. %% == %$prev%'}
  ],
  impl: (ctx, {equalsFunc}) => callbag.distinctUntilChanged((prev, cur) => equalsFunc(ctx.setData(cur.data).setVars({prev:prev.data})), ctx)
})

RXOperator('rx.distinct',{
  description: 'filters unique values',
  category: 'filter',
  params: [
    {id: 'key', as: 'string', dynamic: true, defaultValue: '%%'}
  ],
  impl: (ctx, {key}) => callbag.distinct(addDebugInfo(ctx2 => key(ctx2), ctx))
})

RXOperator('rx.catchError',{
  category: 'error',
  impl: ctx => callbag.catchError(err => ctx.dataObj(err))
})

RXOperator('rx.timeoutLimit', {
  category: 'error',
  params: [
    {id: 'timeout', dynamic: true, defaultValue: '3000', description: 'can be dynamic'},
    {id: 'error', dynamic: true, defaultValue: 'timeout'}
  ],
  impl: (ctx, {timeout, error}) => callbag.timeoutLimit(timeout, error)
})

RXOperator('rx.throwError',{
  category: 'error',
  params: [
    {id: 'condition', as: 'boolean', dynamic: true, mandatory: true, type: 'boolean'},
    {id: 'error', mandatory: true}
  ],
  impl: (ctx, {condition, error}) => callbag.throwError(ctx2 => condition(ctx2), error)
})

RXOperator('rx.debounceTime',{
  description: 'waits for a cooldown period, them emits the last arrived',
  params: [
    {id: 'cooldownPeriod', dynamic: true, description: 'can be dynamic'},
    {id: 'immediate', as: 'boolean', description: 'emits the first event immediately, default is true', type: 'boolean'}
  ],
  impl: (ctx, {cooldownPeriod, immediate}) => callbag.debounceTime(cooldownPeriod, immediate)
})

RXOperator('rx.throttleTime',{
  description: 'enforces a cooldown period. Any data that arrives during the showOnly time is ignored',
  params: [
    {id: 'cooldownPeriod', dynamic: true, description: 'can be dynamic'},
    {id: 'emitLast', as: 'boolean', description: 'emits the last event arrived at the end of the cooldown, default is true', type: 'boolean'}
  ],
  impl: (ctx, {cooldownPeriod, emitLast}) => callbag.throttleTime(cooldownPeriod, emitLast)
})

RXOperator('rx.delay',{
  params: [
    {id: 'time', dynamic: true, description: 'can be dynamic'}
  ],
  impl: (ctx, {time}) => callbag.delay(time)
})

RXOperator('rx.replay',{
  description: 'stores messages and replay them for later subscription',
  params: [
    {id: 'itemsToKeep', as: 'number', description: 'empty for unlimited'}
  ],
  impl: (ctx, {itemsToKeep}) => callbag.replay(itemsToKeep)
})

RXOperator('rx.takeUntil',{
  description: 'closes the stream when events comes from notifier',
  category: 'terminate',
  params: [
    {id: 'notifier', type: 'rx', description: 'can be also promise or any other'}
  ],
  impl: (ctx, {notifier}) => callbag.takeUntil({notifier})
})

RXOperator('rx.take',{
  description: 'closes the stream after taking some items',
  category: 'terminate',
  params: [
    {id: 'count', as: 'number', dynamic: true, mandatory: true}
  ],
  impl: (ctx, {count}) => callbag.take(count(), ctx)
})

RXOperator('rx.takeWhile',{
  description: 'closes the stream on condition',
  category: 'terminate',
  params: [
    {id: 'whileCondition', as: 'boolean', dynamic: true, mandatory: true, type: 'boolean'},
    {id: 'passLastEvent', as: 'boolean', type: 'boolean', byName: true}
  ],
  impl: (ctx, {whileCondition, passLastEvent}) => callbag.takeWhile(ctx => whileCondition(ctx), passLastEvent)
})

RXOperator('rx.toArray',{
  description: 'wait for all and returns next item as array',
  impl: ctx => source => callbag.pipe(source, callbag.toArray(), callbag.map(arr => ctx.dataObj(arr.map(x => x.data))))
})

RXOperator('rx.last',{
  category: 'filter',
  impl: () => callbag.last()
})

RXOperator('rx.skip',{
  category: 'filter',
  params: [
    {id: 'count', as: 'number', dynamic: true}
  ],
  impl: (ctx, {count}) => callbag.skip(count())
})

RXOperator('rx.log',{
  description: 'log flow data, used for debug',
  params: [
    {id: 'name', as: 'string', dynamic: true, description: 'log names'},
    {id: 'extra', as: 'single', dynamic: true, description: 'object. more properties to log'}
  ],
  impl: rx.do((ctx, vars, {name, extra}) => log(name(ctx), {data: ctx.data, vars, ...extra(ctx), ctx: ctx.cmpCtx}))
})

RXOperator('rx.clog',{
  description: 'console.log flow data, used for debug',
  params: [
    {id: 'name', as: 'string'}
  ],
  impl: rx.do((x, {}, {name}) => console.log(name, x))
})

RXOperator('rx.sniffer',{
  description: 'console.log data & control',
  params: [
    {id: 'name', as: 'string'}
  ],
  impl: (ctx, {name}) => source => callbag.sniffer(source, {next: x => console.log(name, x)})
})
