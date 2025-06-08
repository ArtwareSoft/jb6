import { coreUtils, dsls, ns } from '../core/all.js'
import { callbag } from './jb-callbag.js'
import './rx-operators.js'
import '../db/writable.js'

const { toArray, jb } = coreUtils
const {
  rx: { RXOperator },
  tgp: { TgpType },
  common: { Data, Action, Boolean,
    action: { writeValue }, 
  },  
} = dsls
const { rx } = ns

const RXSource = TgpType('source', 'rx', {modifierId: 'RXSource'})
const RXSink = TgpType('sink', 'rx', {modifierId: 'RXSink'})

RXSource('rx.pipe', {
  moreTypes: 'data<common>,action<common>',
  description: 'pipeline of reactive observables with source',
  params: [
    {id: 'source', type: 'source', dynamic: true, mandatory: true, templateValue: '', composite: true },
    {id: 'elems', type: 'op[]', dynamic: true, mandatory: true, secondParamAsArray: true, description: 'chain/map data functions'}

//    {id: 'elems', type: 'rx[]', as: 'array', mandatory: true, dynamic: true, templateValue: []}
  ],
  impl: (ctx, {source, elems}) =>
    callbag.pipe(...callbag.injectSniffers([source(ctx), ...elems(ctx)].filter(x => x), ctx))
})

RXSource('source.data',{
  params: [
    {id: 'Data', mandatory: true}
  ],
  impl: (ctx, {Data}) => callbag.map(x => ctx.dataObj(x))(callbag.fromIter(toArray(Data)))
})

const { source } = ns

RXSource('source.callbag',{
  params: [
    {id: 'callbagSrc', mandatory: true, description: 'callbag source function'}
  ],
  impl: (ctx,{callbagSrc}) => callbag.map(x=>ctx.dataObj(x))(callbagSrc || callbag.fromIter([]))
})

RXSource('source.callbackLoop',{
  params: [
    {id: 'registerFunc', mandatory: true, description: 'receive callback function. needs to be recalled for next event'},
  ],
  impl: (ctx,{registerFunc}) => callbag.map(x=>ctx.dataObj(x))(callbag.fromCallbackLoop(registerFunc))
})

RXSource('source.animationFrame',{
  impl: source.callbackLoop(({},{uiTest}) => (uiTest ? jb.ext.test : globalThis).requestAnimationFrame || (() => {}))
})

/*
producer interface: obs => {
  bind('myBind', handler)
  return () => unbind('myBind',handler)
  function handler(x) { obs(x) }
}
*/

RXSource('source.producer',  {
  params: [
    {id: 'producer', dynamic: true, mandatory: true, description: 'producer function'},
  ],
  impl: (ctx, {producer}) => callbag.map(x => ctx.dataObj(x))(callbag.fromProducer(producer))
})

RXSource('source.event', {
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

RXSource('source.any', {
  params: [
    {id: 'source', mandatory: true, description: 'the source is detected by its type: promise, iterable, single, callbag element, etc..'}
  ],
  impl: (ctx, {source}) => callbag.map(x => ctx.dataObj(x))(callbag.fromAny(source || []))
})

RXSource('source.promise', {
  params: [
    {id: 'promise', mandatory: true}
  ],
  impl: (ctx, {promise}) => callbag.map(x => ctx.dataObj(x))(callbag.fromPromise(promise))
})

RXSource('source.interval', {
  params: [
    {id: 'interval', as: 'number', templateValue: '1000', description: 'time in mSec'}
  ],
  impl: (ctx, {interval}) => callbag.map(x => ctx.dataObj(x))(callbag.interval(interval))
})

RXSource('source.merge', {
  category: 'source',
  description: 'merge callbags sources (or any)',
  params: [
    {id: 'sources', type: 'source[]', as: 'array', mandatory: true, dynamic: true, templateValue: [], composite: true}
  ],
  impl: (ctx, {sources}) => callbag.merge(...sources(ctx))
})

RXSource('source.mergeConcat', {
  description: 'merge sources while keeping the order of sources',
  params: [
    {id: 'sources', type: 'source[]', as: 'array', mandatory: true, dynamic: true, templateValue: [], composite: true}
  ],
  impl: rx.pipe(
    source.data(({},{},{sources}) => sources.profile),
    rx.concatMap(ctx => ctx.run(ctx.data))
  )
})

RXSink('sink.subscribe', {
  description: 'forEach action for all items',
  params: [
    {id: 'next', type: 'action', dynamic: true, mandatory: true},
    {id: 'error', type: 'action', dynamic: true},
    {id: 'complete', type: 'action', dynamic: true}
  ],
  impl: (ctx,{next, error, complete}) => callbag.subscribe(ctx2 => next(ctx2), ctx2 => error(ctx2), () => complete())
})
const { sink } = ns

RXSink('sink.action', {
  type: 'rx',
  category: 'sink',
  description: 'subscribe',
  params: [
    {id: 'action', type: 'action', dynamic: true, mandatory: true}
  ],
  impl: (ctx,{action}) => callbag.subscribe(ctx2 => { ctx; return action(ctx2) })
})

RXSink('sink.data', {
  type: 'rx',
  params: [
    {id: 'Data', as: 'ref', dynamic: true, mandatory: true}
  ],
  impl: sink.action(writeValue('%$Data()%', '%%'))
})

// ********** subject 
Data('rx.subject',{
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

RXSink('sink.notifySubject', {
  params: [
    {id: 'subject', mandatory: true}
  ],
  impl: (ctx,{subject}) => callbag.subscribe(e => subject.trigger.next(e))
})

RXSource('source.subject', {
  params: [
    {id: 'subject', mandatory: true}
  ],
  impl: (ctx,{subject}) => subject.source
})

Action('subject.notify', {
  params: [
    {id: 'subject', mandatory: true},
    {id: 'Data', dynamic: true, defaultValue: '%%'}
  ],
  impl: (ctx,{subject,Data}) => subject.trigger.next(ctx.dataObj(Data(ctx)))
})

Action('subject.complete', {
  params: [
    {id: 'subject', mandatory: true}
  ],
  impl: (ctx,{subject}) => subject.trigger.complete()
})

Action('subject.sendError', {
  params: [
    {id: 'subject', mandatory: true},
    {id: 'error', dynamic: true, mandatory: true}
  ],
  impl: (ctx,{subject,error}) => subject.trigger.error(error())
})

RXOperator('rx.flatMapArrays', {
  description: 'match inputs to data arrays',
  params: [
    {id: 'func', dynamic: true, defaultValue: '%%', description: 'should return array, items will be passed one by one'}
  ],
  impl: rx.flatMap(source.data('%$func()%'))
})

// export const source = { data: source.data, callbag: _callbag, callbackLoop, animationFrame, producer, event, any, promise, interval, mergeConcat, merge, subject: subject_source}
// export const sink = { action: sink.action, data: sink_data, notifySubject: sink_notifySubject }
// export const rx = { pipe, subscribe, subject: _subject, flatMapArrays, ...operators}
// export const subject = { notify: notifySubject, complete: completeSubject, sendError: sendErrorToSubject}
