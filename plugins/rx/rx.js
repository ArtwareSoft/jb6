import { TgpType, Action, Data, jb } from '../core/tgp.js'
import { utils } from '../core/core-utils.js'
import { callbag } from './jb-callbag.js'
import { operators, RXOperator } from './rx-operators.js'
import { writeValue } from '../db/writable.js'

export const RXSource = TgpType('source', 'rx')
export const RXSink = TgpType('sink', 'rx')
export { RXOperator }

const pipe = RXSource({
  moreTypes: 'data<common>,action<common>',
  description: 'pipeline of reactive observables with source',
  params: [
    {id: 'elems', type: 'rx[]', as: 'array', mandatory: true, dynamic: true, templateValue: []}
  ],
  impl: (ctx, {elems}) =>
    callbag.pipe(...callbag.injectSniffers(elems(ctx).filter(x => x), ctx))
})

const source_data = RXSource({
  params: [
    {id: 'Data', mandatory: true}
  ],
  impl: (ctx, {Data}) => callbag.map(x => ctx.dataObj(x))(callbag.fromIter(utils.toArray(Data)))
})

const _callbag = RXSource({
  params: [
    {id: 'callbagSrc', mandatory: true, description: 'callbag source function'}
  ],
  impl: (ctx,{callbagSrc}) => callbag.map(x=>ctx.dataObj(x))(callbagSrc || callbag.fromIter([]))
})

const callbackLoop = RXSource({
  params: [
    {id: 'registerFunc', mandatory: true, description: 'receive callback function. needs to be recalled for next event'},
  ],
  impl: (ctx,{registerFunc}) => callbag.map(x=>ctx.dataObj(x))(callbag.fromCallbackLoop(registerFunc))
})

const animationFrame = RXSource({
  impl: callbackLoop(({},{uiTest}) => (uiTest ? jb.ext.test : globalThis).requestAnimationFrame || (() => {}))
})

/*
producer interface: obs => {
  bind('myBind', handler)
  return () => unbind('myBind',handler)
  function handler(x) { obs(x) }
}
*/

const producer = RXSource({
  params: [
    {id: 'producer', dynamic: true, mandatory: true, description: 'producer function'},
  ],
  impl: (ctx, {producer}) => callbag.map(x => ctx.dataObj(x))(callbag.fromProducer(producer))
})

const event = RXSource({
  params: [
    {id: 'event', as: 'string', mandatory: true, options: 'load,blur,change,focus,keydown,keypress,keyup,click,dblclick,mousedown,mousemove,mouseup,mouseout,mouseover,scroll,resize'},
    {id: 'elem', description: 'html element', defaultValue: () => globalThis.document},
    {id: 'options', description: 'addEventListener options, https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener'},
    {id: 'selector', as: 'string', description: 'optional, including the elem', byName: true}
  ],
  impl: (ctx, {event, elem: _elem, options, selector}) => {
    const elem = selector ? jb.ext.ui?.findIncludeSelf(_elem, selector)[0] : _elem
    return elem && callbag.map(sourceEvent => ctx.setVars({sourceEvent, elem}).dataObj(sourceEvent))(callbag.fromEvent(event, elem, options))
  }
})

const any = RXSource({
  params: [
    {id: 'source', mandatory: true, description: 'the source is detected by its type: promise, iterable, single, callbag element, etc..'}
  ],
  impl: (ctx, {source}) => callbag.map(x => ctx.dataObj(x))(callbag.fromAny(source || []))
})

const promise = RXSource({
  params: [
    {id: 'promise', mandatory: true}
  ],
  impl: (ctx, {promise}) => callbag.map(x => ctx.dataObj(x))(callbag.fromPromise(promise))
})

const interval = RXSource({
  params: [
    {id: 'interval', as: 'number', templateValue: '1000', description: 'time in mSec'}
  ],
  impl: (ctx, {interval}) => callbag.map(x => ctx.dataObj(x))(callbag.interval(interval))
})

const merge = RXSource({
  category: 'source',
  description: 'merge callbags sources (or any)',
  params: [
    {id: 'sources', type: 'rx[]', as: 'array', mandatory: true, dynamic: true, templateValue: [], composite: true}
  ],
  impl: (ctx, {sources}) => callbag.merge(...sources(ctx))
})

const mergeConcat = RXSource({
  description: 'merge sources while keeping the order of sources',
  params: [
    {id: 'sources', type: 'rx[]', as: 'array', mandatory: true, dynamic: true, templateValue: [], composite: true}
  ],
  impl: pipe(
    source_data(({},{},{sources}) => sources.profile),
    operators.concatMap(ctx => ctx.run(ctx.data))
  )
})

const subscribe = RXSink({
  description: 'forEach action for all items',
  params: [
    {id: 'next', type: 'action', dynamic: true, mandatory: true},
    {id: 'error', type: 'action', dynamic: true},
    {id: 'complete', type: 'action', dynamic: true}
  ],
  impl: (ctx,{next, error, complete}) => callbag.subscribe(ctx2 => next(ctx2), ctx2 => error(ctx2), () => complete())
})

const sink_action = RXSink('action', {
  type: 'rx',
  category: 'sink',
  description: 'subscribe',
  params: [
    {id: 'action', type: 'action', dynamic: true, mandatory: true}
  ],
  impl: (ctx,{action}) => callbag.subscribe(ctx2 => { ctx; return action(ctx2) })
})

const sink_data = RXSink('data', {
  type: 'rx',
  params: [
    {id: 'Data', as: 'ref', dynamic: true, mandatory: true}
  ],
  impl: sink_action(writeValue('%$Data()%', '%%'))
})

// ********** subject 
const _subject = Data({
  description: 'callbag "variable" that you can write or listen to',
  category: 'variable',
  params: [
    {id: 'id', as: 'string', description: 'can be used for logging'},
    {id: 'replay', as: 'boolean', description: 'keep pushed items for late subscription', type: 'boolean'},
    {id: 'itemsToKeep', as: 'number', description: 'relevant for replay, empty for unlimited'}
  ],
  impl: (ctx,{id, replay,itemsToKeep}) => {
      const trigger = callbag.subject(id)
      const source = replay ? callbag.replay(itemsToKeep)(trigger): trigger
      source.ctx = trigger.ctx = ctx
      return { trigger, source } 
    }
})

const sink_notifySubject = RXSink({
  params: [
    {id: 'subject', mandatory: true}
  ],
  impl: (ctx,{subject}) => callbag.subscribe(e => subject.trigger.next(e))
})

const subject_source = RXSource({
  params: [
    {id: 'subject', mandatory: true}
  ],
  impl: (ctx,{subject}) => subject.source
})

const notifySubject = Action({
  params: [
    {id: 'subject', mandatory: true},
    {id: 'Data', dynamic: true, defaultValue: '%%'}
  ],
  impl: (ctx,{subject,Data}) => subject.trigger.next(ctx.dataObj(Data(ctx)))
})

const completeSubject = Action({
  params: [
    {id: 'subject', mandatory: true}
  ],
  impl: (ctx,{subject}) => subject.trigger.complete()
})

const sendErrorToSubject = Action({
  params: [
    {id: 'subject', mandatory: true},
    {id: 'error', dynamic: true, mandatory: true}
  ],
  impl: (ctx,{subject,error}) => subject.trigger.error(error())
})

const flatMapArrays = RXOperator({
  description: 'match inputs to data arrays',
  params: [
    {id: 'func', dynamic: true, defaultValue: '%%', description: 'should return array, items will be passed one by one'}
  ],
  impl: operators.flatMap(source_data('%$func()%'))
})

export const source = { data: source_data, callbag: _callbag, callbackLoop, animationFrame, producer, event, any, promise, interval, mergeConcat, merge, subject: subject_source}
export const sink = { action: sink_action, data: sink_data, notifySubject: sink_notifySubject }
export const rx = { pipe, subscribe, subject: _subject, flatMapArrays, ...operators}
export const subject = { notify: notifySubject, complete: completeSubject, sendError: sendErrorToSubject}
