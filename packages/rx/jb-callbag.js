import { coreUtils } from '../core/core-utils.js'
const { log, logError, isPromise, calcPath } = coreUtils

export const callbag = {
  fromIter: iter => (start, sink) => {
      if (start !== 0) return
      const iterator =
          typeof Symbol !== 'undefined' && iter[Symbol.iterator]
          ? iter[Symbol.iterator]()
          : iter
      let inloop = false
      let got1 = false
      let res
      function loop() {
          inloop = true
          while (got1) {
              got1 = false
              res = iterator.next()
              if (res.done) sink(2)
              else sink(1, res.value)
          }
          inloop = false
      }
      sink(0, function fromIter(t, d) {
          if (t === 1) {
              got1 = true
              if (!inloop && !(res && res.done)) loop()
          }
      })
  },
  pipe(..._cbs) {
    const cbs = _cbs.filter(x=>x)
    if (!cbs[0]) return
    let res = cbs[0]
    for (let i = 1, n = cbs.length; i < n; i++) {
      const newRes = cbs[i](res)
      if (!newRes) debugger
      newRes.ctx = cbs[i].ctx
      Object.defineProperty(newRes, 'name',{value: 'register ' + cbs[i].name})

      res = newRes
    }
    return res
  },
  Do: f => source => (start, sink) => {
      if (start !== 0) return
      source(0, function Do(t, d) {
          if (t == 1) f(d)
          sink(t, d)
      })
  },
  filter: condition => source => (start, sink) => {
      if (start !== 0) return
      let talkback
      source(0, function filter(t, d) {
        if (t === 0) {
          talkback = d
          sink(t, d)
        } else if (t === 1) {
          if (condition(d)) sink(t, d)
          else talkback(1)
        }
        else sink(t, d)
      })
  },
  map: f => source => (start, sink) => {
      if (start !== 0) return
      source(0, function map(t, d) {
        if (t == 1 && d != null) 
          sink(1,f(d))
        else
          sink(t, d)
      })
  },
  throwError: (condition,err) => source => (start, sink) => {
    let talkback
    if (start !== 0) return
    source(0, function throwError(t, d) {
      if (t === 0) talkback = d
      if (t == 1 && condition(d)) {
        talkback && talkback(2)
        sink(2,err)
      } else {
        sink(t, d)
      }
    })
  },
  distinct: keyFunc => source => (start, sink) => {
    if (start !== 0) return
    let prev = {}, talkback
    source(0, function distinct(t,d) {
        if (t === 0) talkback = d
        if (t == 1) {
          const key = keyFunc(d)
          if (typeof key == 'string') {
            if (prev[key]) {
                talkback && talkback(1)
                return
            }
            prev[key] = true
          }
        }
        sink(t, d)
    })
  },  
  distinctUntilChanged: (compare,ctx) => source => (start, sink) => {
      compare = compare || ((prev, cur) => prev === cur)
      if (start !== 0) return
      let inited = false, prev, talkback
      source(0, function distinctUntilChanged(t,d) {
          if (t === 0) {
            talkback = d
            sink(t, d)
          } else if (t == 1) {
            if (inited && compare(prev, d)) {
                talkback(1)
                ctx && ctx.dataObj('same as prev',null,d)
                return
            }
            inited = true
            prev = d
            ctx && ctx.dataObj(d,null,d)
            sink(1, d)
          } else {
              sink(t, d)
              return
          }
      })
  },  
  takeUntil(notifier) {
      if (isPromise(notifier))
          notifier = callbag.fromPromise(notifier)
      const UNIQUE = {}
      return source => (start, sink) => {
          if (start !== 0) return
          let sourceTalkback, notifierTalkback, inited = false, done = UNIQUE

          source(0, function takeUntil(t, d) {
              if (t === 0) {
                  sourceTalkback = d

                  notifier(0, function takeUntilNotifier(t, d) {
                      if (t === 0) {
                          notifierTalkback = d
                          notifierTalkback(1)
                          return
                      }
                      if (t === 1) {
                          done = void 0
                          notifierTalkback(2)
                          sourceTalkback(2)
                          if (inited) sink(2)
                          return
                      }
                      if (t === 2) {
                          //notifierTalkback = null
                          done = d
                          if (d != null) {
                              sourceTalkback(2)
                              if (inited) sink(t, d)
                          }
                      }
                  })
                  inited = true

                  sink(0, function takeUntilSink(t, d) {
                      if (done !== UNIQUE) return
                      if (t === 2 && notifierTalkback) notifierTalkback(2)
                      sourceTalkback(t, d)
                  })

                  if (done !== UNIQUE) sink(2, done)
                  return
              }
              if (t === 2) notifierTalkback(2)
              if (done === UNIQUE) sink(t, d)
          })
      }
  },
  concatMap(_makeSource,combineResults) {
    const makeSource = (...args) => callbag.fromAny(_makeSource(...args))
    if (!combineResults) combineResults = (input, inner) => inner
    return source => (start, sink) => {
        if (start !== 0) return
        let queue = [], activeCb, sourceEnded, allEnded, sourceTalkback, activecbTalkBack, waitingForNext = false
        source(0, function concatMap(t,d) {
          if (t == 0)
            sourceTalkback = d
          else if (t == 1)
            queue.push(d)
          else if (t ==2)
            sourceEnded = true
          tick()
        })
        sink(0, function concatMap(t,d) {
          if (t == 1) {
            waitingForNext = true
            tick()
          } else if (t == 2) {
            allEnded = true
            queue = []
            sourceTalkback && sourceTalkback(2)
          }
        })
        
        function tick() {
          if (allEnded) return
          if (!activeCb && queue.length) {
            const input = queue.shift()
            activeCb = makeSource(input)
            activeCb(0, function concatMap(t,d) {
              if (t == 0) {
                activecbTalkBack = d
                tick()
                //waitingForNext && activecbTalkBack && activecbTalkBack(1)
              } else if (t == 1) {
                waitingForNext = false
                sink(1, combineResults(input,d))
                //activecbTalkBack && activecbTalkBack(1)
              } else if (t == 2 && d) {
                allEnded = true
                queue = []
                sink(2,d)
                sourceTalkback && sourceTalkback(2)
              } else if (t == 2) {
                waitingForNext = true
                activecbTalkBack = activeCb = null
                tick()
              }
            })
          }
          if (sourceEnded && !activeCb && !queue.length) {
            allEnded = true
            sink(2)
          }
          if (waitingForNext) {
            if (activecbTalkBack) activecbTalkBack(1);
            if (!activeCb) sourceTalkback && sourceTalkback(1)
          }
        }
    }
  },
  // concatMap2(_makeSource,combineResults) {
  //   const makeSource = (...args) => callbag.fromAny(_makeSource(...args))
  //   return source => (start, sink) => {
  //       if (start !== 0) return
  //       let queue = []
  //       let innerTalkback, sourceTalkback, sourceEnded
  //       if (!combineResults) combineResults = (input, inner) => inner

  //       const concatMapSink= input => function concatMap(t, d) {
  //         if (t === 0) {
  //           innerTalkback = d
  //           innerTalkback(1)
  //         } else if (t === 1) {
  //           sink(1, combineResults(input,d))
  //           innerTalkback(1)
  //         } else if (t === 2) {
  //           innerTalkback = null
  //           if (queue.length === 0) {
  //             stopOrContinue(d)
  //             return
  //           }
  //           const input = queue.shift()
  //           const src = makeSource(input)
  //           src(0, concatMapSink(input))
  //         }
  //       }

  //       source(0, function concatMap(t, d) {
  //         if (t === 0) {
  //           sourceTalkback = d
  //           sink(0, wrappedSink)
  //           return
  //         } else if (t === 1) {
  //           if (innerTalkback) 
  //             queue.push(d) 
  //           else {
  //             const src = makeSource(d)
  //             src(0, concatMapSink(d))
  //             src(1)
  //           }
  //         } else if (t === 2) {
  //           sourceEnded = true
  //           stopOrContinue(d)
  //         }
  //       })

  //       function wrappedSink(t, d) {
  //         if (t === 2 && innerTalkback) innerTalkback(2, d)
  //         sourceTalkback(t, d)
  //       }
    
  //       function stopOrContinue(d) {
  //         if (d != undefined) {
  //           queue = []
  //           innerTalkback = innerTalkback = null
  //           sink(2, d)
  //           return
  //         }
  //         if (sourceEnded && !innerTalkback && queue.length == 0) {
  //           sink(2, d)
  //           return
  //         }
  //         innerTalkback && innerTalkback(1)
  //       }
  //     }
  // },
  flatMap: (_makeSource, combineResults) => source => (start, sink) => {
      if (start !== 0) return
      const makeSource = (...args) => callbag.fromAny(_makeSource(...args))
      if (!combineResults) combineResults = (input, inner) => inner

      let index = 0
      const talkbacks = {}
      let sourceEnded = false
      let inputSourceTalkback = null

      source(0, function flatMap(t, d) {
        if (t === 0) {
            inputSourceTalkback = d
            sink(0, pullHandle)
        }
        if (t === 1) {
            makeSource(d)(0, makeSink(index++, d))
        }
        if (t === 2) {
            sourceEnded = true
            stopOrContinue(d)
        }
      })

      function makeSink(i, input) { 
        return (t, d) => {
          if (t === 0) {talkbacks[i] = d; talkbacks[i](1)}
          if (t === 1)
            sink(1, d == null ? null : combineResults(input, d))
          if (t === 2) {
              delete talkbacks[i]
              stopOrContinue(d)
          }
      }}

      function stopOrContinue(d) {
        if (sourceEnded && Object.keys(talkbacks).length === 0) 
          sink(2, d)
        else 
          !sourceEnded && inputSourceTalkback && inputSourceTalkback(1)
      }

      function pullHandle(t, d) {
        const currTalkback = Object.values(talkbacks).pop()
        if (t === 1) {
          currTalkback && currTalkback(1)
          if (!sourceEnded) inputSourceTalkback(1)
        }
        if (t === 2) {
          stopOrContinue(d)
        }
      }
  },
  merge(..._sources) {
      const sources = _sources.filter(x=>x).filter(x=>callbag.fromAny(x))
      return function merge(start, sink) {
        if (start !== 0) return
        const n = sources.length
        const sourceTalkbacks = new Array(n)
        let startCount = 0
        let endCount = 0
        let ended = false
        const talkback = (t, d) => {
          if (t === 2) ended = true
          for (let i = 0; i < n; i++) sourceTalkbacks[i] && sourceTalkbacks[i](t, d)
        }
        for (let i = 0; i < n; i++) {
          if (ended) return
          sources[i](0, (t, d) => {
            if (t === 0) {
              sourceTalkbacks[i] = d
              sink(0, talkback) // if (++startCount === 1) 
            } else if (t === 2 && d) {
              ended = true
              for (let j = 0; j < n; j++) if (j !== i && sourceTalkbacks[j]) sourceTalkbacks[j](2)
              sink(2, d)
            } else if (t === 2) {
              sourceTalkbacks[i] = void 0
              if (++endCount === n) sink(2)
            } else sink(t, d)
          })
        }
      }
  },
  fork: (...cbs) => source => (start, sink) => {
    if (start != 0) return
    let sinks = []
    let talkback = null

    registerSink(sink)
    callbag.pipe(forkSource, ...cbs)

    source(0, function mainForkSource(t, d) {
      if (t == 0) {
        talkback = d
        talkback(1)
      } else {
        const zinkz = sinks.slice(0)
        for (let i = 0, n = zinkz.length, sink; i < n; i++) {
            sink = zinkz[i]
            if (sinks.indexOf(sink) > -1) sink(t, d)
        }
      }
    })

    function forkSource(start, forkSink) {
      if (start == 0) registerSink(forkSink)
    }

    function registerSink(sink) {
      sinks.push(sink)
      sink(0, function fork(t,d) {
          if (t === 2) {
              const i = sinks.indexOf(sink)
              if (i > -1) sinks.splice(i, 1)
              if (!sinks.length)
                talkback && talkback(2)
          }
          if (t == 1 && !d) // talkback
            talkback && talkback(1)
      })
    }
  },
  race(..._sources) { // take only the first result including errors and complete
    const sources = _sources.filter(x=>x).filter(x=>callbag.fromAny(x))
    return function race(start, sink) {
      if (start !== 0) return
      const n = sources.length
      const sourceTalkbacks = new Array(n)
      let ended = false
      const talkback = (t, d) => {
        if (t === 2) ended = true
        for (let i = 0; i < n; i++) sourceTalkbacks[i] && sourceTalkbacks[i](t, d)
      }
      for (let i = 0; i < n; i++) {
        if (ended) return
        sources[i](0, function race(t, d) {
          if (t === 0) {
            sourceTalkbacks[i] = d
            sink(0, talkback)
          } else {
            ended = true
            for (let j = 0; j < n; j++) 
              if (j !== i && sourceTalkbacks[j]) sourceTalkbacks[j](2)
            sink(1,d)
            sink(2)
          }
        })
      }
  }},
  fromEvent: (event, elem, options) => (start, sink) => {
      if (!elem || !elem.addEventListener) return
      if (start !== 0) return
      let disposed = false
      const handler = ev => sink(1, ev)
    
      sink(0, function fromEvent(t, d) {
        if (t !== 2) {
          return
        }
        disposed = true
        if (elem.removeEventListener) elem.removeEventListener(event, handler, options)
        else if (elem.removeListener) elem.removeListener(event, handler, options)
        else throw new Error('cannot remove listener from elem. No method found.')
      })
    
      if (disposed) return
    
      if (elem.addEventListener) elem.addEventListener(event, handler, options)
      else if (elem.addListener) elem.addListener(event, handler, options)
      else throw new Error('cannot add listener to elem. No method found.')
  },
  fromCallbackLoop: register => (start, sink) => {
    if (start !== 0) return
    let sinkDone
    let handler = register(callbackLoop)
    function callbackLoop(d) { 
      if (sinkDone) return
      sink(1,d || 0)
      handler = register(callbackLoop)
    }
  
    sink(0, t => sinkDone = t == 2 )
  },
  fromProducer: producer => (start, sink) => {
    if (start !== 0) return
    if (typeof producer !== 'function') {
      logError('producer must be a function',{producer})
      sink(2,'non function producer')
      return
    }
    let sinkDone
    const cleanFunc = producer(function fromProducer(d) { return !sinkDone && sink(1,d) })
    sink(0, (t,d) => {
      if (!sinkDone) {
        sinkDone = t == 2
        if (sinkDone && typeof cleanFunc === 'function') cleanFunc()
      }
    })
  },
  subject(id) {
      let sinks = []
      function subj(t, d, transactive) {
          if (t === 0) {
              const sink = d
              id && log(`${id} subject sink registered`,{sink})
              sinks.push(sink)
              sink(0, function subject(t,d) {
                  if (t === 2) {
                      const i = sinks.indexOf(sink)
                      if (i > -1) {
                        const sink = sinks.splice(i, 1)
                        id && log(`${id} subject sink unregistered`,{sink})
                      }
                  }
              })
          } else {
            id && t == 1 && log(`${id} subject next`,{d, sinks: sinks.slice(0)})
            id && t == 2 && log(`${id} subject complete`,{d, sinks: sinks.slice(0)})
            sinks.slice(0).forEach(sink=> {
              const td = transactive ? callbag.childTxInData(d,sinks.length) : d
              sinks.indexOf(sink) > -1 && sink(t, td)
            })
          }
      }
      subj.next = (data,transactive) => subj(1,data,transactive)
      subj.complete = () => subj(2)
      subj.error = err => subj(2,err)
      subj.sinks = sinks
      return subj
  },
  replay: keep => source => {
    keep = keep || 0
    let store = [], sinks = [], talkback, done = false
  
    const sliceNum = keep > 0 ? -1 * keep : 0;
  
    source(0, function replay(t, d) {
      if (t == 0) {
        talkback = d
        return
      }
      if (t == 1) {
        store.push(d)
        store = store.slice(sliceNum)
        sinks.forEach(sink => sink(1, d))
      }
      if (t == 2) {
        done = true
        sinks.forEach(sink => sink(2))
        sinks = []
      }
    })

    replay.sinks = sinks
    return replay
  
    function replay(start, sink) {
      if (start !== 0) return
      sinks.push(sink)
      sink(0, function replay(t, d) {
        if (t == 0) return
        if (t == 1) {
          talkback(1)
          return
        }
        if (t == 2)
          sinks = sinks.filter(s => s !== sink)
      })
  
      store.forEach(entry => sink(1, entry))
  
      if (done) sink(2)
    }
  },
  catchError: fn => source => (start, sink) => {
      if (start !== 0) return
      let done
      source(0, function catchError(t, d) {
        if (done) return
        if (t === 2 && d !== undefined) { done= true; sink(1, fn(d)); sink(2) } 
        else sink(t, d) 
      }
    )
  },
  // swallow events. When new event arrives wait for a duration to spit it, if another event arrived when waiting, the original event is 'deleted'
  // 'immediate' means that the first event is spitted immediately
  debounceTime: (duration,immediate = true) => source => (start, sink) => {
      if (start !== 0) return
      let timeout
      source(0, function debounceTime(t, d) {
        let immediateEventSent = false
        if (!timeout && immediate) { sink(t,d); immediateEventSent = true }
        if (timeout) clearTimeout(timeout)
        if (t === 1) timeout = setTimeout(() => { 
          timeout = null; 
          if (!immediateEventSent) sink(1, d)
        }, typeof duration == 'function' ? duration() : duration)
        else sink(t, d)
      })
  },
  throttleTime: (duration,emitLast) => source => (start, sink) => {
    if (start !== 0) return
    let talkbackToSource, sourceTerminated = false, sinkTerminated = false, last, timeout
    sink(0, function throttle(t, d) {
      if (t === 2) sinkTerminated = true
    })
    source(0, function throttle(t, d) {
      if (t === 0) {
        talkbackToSource = d
        talkbackToSource(1)
      } else if (sinkTerminated) {
        return
      } else if (t === 1) {
        if (!timeout) {
          sink(t, d)
          last = null
          timeout = setTimeout(() => {
            timeout = null
            if (!sourceTerminated) talkbackToSource(1)
            if ((emitLast === undefined || emitLast) && last != null)
              sink(t,d)
          }, typeof duration == 'function' ? duration() : duration)
        } else {
          last = d
        }
      } else if (t === 2) {
        sourceTerminated = true
        sink(t, d)
      }
    })
  },      
  take: (max,ctx) => source => (start, sink) => {
      if (start !== 0) return
      let taken = 0, sourceTalkback, end
      function talkback(t, d) {
        if (t === 2) end = true
        sourceTalkback(t, d)
      }
      source(0, function take(t, d) {
        if (t === 0) {
          sourceTalkback = d
          sink(0, talkback)
        } else if (t === 1) {
          if (taken < max) {
            taken++
            sink(t, d)
            ctx && ctx.dataObj(d)
            if (taken === max && !end) {
              end = true
              sourceTalkback(2)
              sink(2)
            }
          }
        } else {
          sink(t, d)
        }
      })
  },
  takeWhile: (predicate,passLastEvent) => source => (start, sink) => {
      if (start !== 0) return
      let talkback
      source(0, function takeWhile(t,d) {
        if (t === 0) talkback = d
        if (t === 1 && !predicate(d)) {
          if (passLastEvent) sink(t,d)
          talkback(2)
          sink(2)
        } else {
          sink(t, d)
        }
      })
  },
  last: () => source => (start, sink) => {
      if (start !== 0) return
      let talkback, lastVal, matched = false
      source(0, function last(t, d) {
        if (t === 0) {
          talkback = d
          sink(t, d)
        } else if (t === 1) {
          lastVal = d
          matched = true
          talkback(1)
        } else if (t === 2) {
          if (matched) sink(1, lastVal)
          sink(2)
        }
      })
  },
  toArray: () => source => (start, sink) => {
    if (start !== 0) return
    let talkback, res = [], ended
    source(0, function toArray(t, d) {
      if (t === 0) {
        talkback = d
        sink(t, (t,d) => {
          if (t == 2) end()
          talkback(t,d)
        })
      } else if (t === 1) {
        res.push(d)
        talkback && talkback(1)
      } else if (t === 2) {
        if (!d) end()
        sink(2,d)
      }
    })
    function end() {
      if (!ended && res.length) sink(1, res)
      ended = true
    }
  },      
  forEach: operation => source => {
    let talkback
    source(0, function forEach(t, d) {
        if (t === 0) talkback = d
        if (t === 1) operation(d)
        if (t === 1 || t === 0) talkback(1)
    })
  },
  subscribe: (listener = {}) => source => {
      if (typeof listener === "function") listener = { next: listener }
      let { next, error, complete } = listener
      let talkback, done
      source(0, function subscribe(t, d) {
        if (t === 0) talkback = d
        if (t === 1 && next) next(d)
        if (t === 1 || t === 0) talkback(1)  // Pull
        if (t === 2) done = true
        if (t === 2 && !d && complete) complete()
        if (t === 2 && !!d && error) error( d )
        if (t === 2 && listener.finally) listener.finally( d )
      })
      return {
        dispose: () => talkback && !done && talkback(2),
        isDone: () => done,
        isActive: () => talkback && !done
      }
  },
  // toPromise: source => {
  //     return new Promise((resolve, reject) => {
  //       callbag.subscribe({
  //         next: resolve,
  //         error: reject,
  //         complete: () => {
  //           const err = new Error('No elements in sequence.')
  //           err.code = 'NO_ELEMENTS'
  //           reject(err)
  //         },
  //       })(callbag.last(source))
  //     })
  // },
  toPromiseArray: source => {
      const res = []
      let talkback
      return new Promise((resolve, reject) => {
              source(0, function toPromiseArray(t, d) {
                  if (t === 0) talkback = d
                  if (t === 1) res.push(d)
                  if (t === 1 || t === 0) talkback && talkback(1)  // Pull
                  if (t === 2 && !d) resolve(res)
                  if (t === 2 && !!d) reject( d )
          })
      })
  },
  fromPromise: pr => (start, sink) => {
    let sinkDone
    if (start !== 0) return
    Promise.resolve(pr).then(d =>{ 
      log('callbag promise resolved',{d, sinkDone})
      if (!sinkDone) {
        sink(1,d)
        sink(2) 
      }
    }).catch(err => sink(2,err))

    sink(0, function mapPromiseTB(t,d) {
      log('callbag promise talkback',{t,d})
      if (t == 2) sinkDone = true
    })
  },
  mapPromise: promiseF => callbag.concatMap(d => callbag.fromPromise(Promise.resolve().then(()=>promiseF(d)))),
  doPromise: promiseF => callbag.concatMap(d => callbag.fromPromise(Promise.resolve().then(()=>promiseF(d)).then(()=>d))),
  interval: period => (start, sink) => {
    if (start !== 0) return
    let i = 0
    const id = setInterval(function set_interval() {
      sink(1, i++)
    }, period)
    sink(0, t => t === 2 && clearInterval(id))
  },
  startWith: (...xs) => source => (start, sink) => {
      if (start !== 0) return
      let disposed = false
      let inputTalkback
      let trackPull = false
      let lastPull
    
      sink(0, function startWith(t, d) {
        if (trackPull && t === 1) {
          lastPull = [1, d]
        }
    
        if (t === 2) {
          disposed = true
          xs.length = 0
        }
    
        if (!inputTalkback) return
        inputTalkback(t, d)
      })
    
      while (xs.length !== 0) {
        if (xs.length === 1) {
          trackPull = true
        }
        sink(1, xs.shift())
      }
    
      if (disposed) return
    
      source(0, function startWith(t, d) {
        if (t === 0) {
          inputTalkback = d
          trackPull = false
    
          if (lastPull) {
            inputTalkback(...lastPull)
            lastPull = null
          }
          return
        }
        sink(t, d)
      })
  },
  delay: duration => source => (start, sink) => {
      if (start !== 0) return
      let working = false, talkback
      const queue = []
      source(0, function delay(t,d) {
        if (t === 0) talkback = d
        if (t > 0) {
          queue.push({t,d})
          workOnQueue()
        }
      })
      sink(0, function delay(t,d) {
        if (t == 1 && !d && talkback)
          talkback(1)
        if (t == 2) {
          queue.splice(0,queue.length)
          talkback && talkback(t,d)
        }
      })

      function workOnQueue() {
        if (!working && queue.length > 0)
          workOnInput(queue.splice(0,1)[0])
      }

      function workOnInput({t,d}) {
        const id = setTimeout(()=> {
          clearTimeout(id)
          sink(t,d)
          working = false
          workOnQueue()
        }, callbag.valueFromfunctionOrConstant(duration,d))
        working = true
      }
  },
  skip: max => source => (start, sink) => {
      if (start !== 0) return
      let skipped = 0, talkback
      source(0, function skip(t, d) {
        if (t === 0) talkback = d
        if (t === 1 && skipped < max) {
            skipped++
            talkback(1)
            return
        }
        sink(t, d)
      })
  },
  sniffer: (source, snifferSubject) => (start, sink) => {
    if (start !== 0) return
    let talkback
    const talkbackWrapper = (t,d) => { report('talkback',t,d); talkback(t,d) }
    const sniffer = (t,d) => {
      report('out',t,d)
      if (t == 0) {
        talkback = d
        Object.defineProperty(talkbackWrapper, 'name', { value: talkback.name + '-sniffer' })
        sink(0, talkbackWrapper)
        return
      }
      sink(t,d)
    }
    sniffer.ctx = source.ctx    
    Object.defineProperty(sniffer, 'name', { value: source.name + '-sniffer' })
    sniffer.dispose = () => { console.log('dispose', sink,talkback); debugger }

    source(0,sniffer)
    
    function report(dir,t,d) {
      const now = new Date()
      const time = `${now.getSeconds()}:${now.getMilliseconds()}`
      snifferSubject.next({dir, t, d, time})
      if (t == 2)
        snifferSubject.complete && snifferSubject.complete(d)
    }
  },
  timeoutLimit: (timeout,err) => source => (start, sink) => {
    if (start !== 0) return
    let talkback
    let timeoutId = setTimeout(()=> {
      talkback && talkback(2)
      sink(2, typeof err == 'function' ? err() : err || 'timeout')
    }, typeof timeout == 'function' ? timeout() : timeout)

    source(0, function timeoutLimit(t, d) {
      if (t === 2) clearTimeout(timeoutId)
      if (t === 0) talkback = d
      sink(t, d)
    })        
  },
  fromCallBag: source => source,
  fromAny: (source, name, options) => {
      const f = source && 'from' + (isPromise(source) ? 'Promise'
          : source.addEventListener ? 'Event'
          : typeof source[Symbol.iterator] === 'function' ? 'Iter'
          : '')
      if (callbag[f]) 
          return callbag[f](source, name, options)
      else if (callbag.isCallbag(source))
          return source
      else
          return callbag.fromIter([source])
  },
//  isSink: cb => typeof cb == 'function' && cb.toString().match(/source/),
  isCallbag: cb => typeof cb == 'function' && cb.toString().split('=>')[0].split('{')[0].replace(/\s/g,'').match(/start,sink|t,d/),
  isCallbagOperator: cb => typeof cb == 'function' && cb.toString().match(/^\s*source\s*=>/),
  injectSniffers(cbs,ctx) {
    return cbs
  },  
  log: name => callbag.Do(x=>console.log(name,x)),
  jbLog: (name,...params) => callbag.Do(data => log(name,{data,...params})),
  valueFromfunctionOrConstant(val,data) {
    return typeof val == 'function' ? val(val.runCtx && val.runCtx.setData(data)) : val
  },
  childTxInCtx(ctx,noOfChildren) {
    const tx = calcPath(ctx,'vars.tx')
    if (noOfChildren < 2 || !tx) return ctx
    return ctx.setVars({tx: callbag.transaction(tx)})
  },
  childTxInData(data,noOfChildren) {
    const ctx = calcPath(data,'srcCtx')
    const ctxWithRx = ctx && callbag.childTxInCtx(ctx,noOfChildren)
    return (!ctxWithRx || ctxWithRx == ctx) ? data : { ...data, srcCtx: ctxWithRx}
  },
  transaction(parent) { 
    const tx = {
      parent,
      children: [],
      isComplete() { 
        return this.done = this.done || this.children.reduce((acc,t) => acc && t.isDone() , true)
      },
      next(d) { this.cb.next(d) },
      complete() { 
        this.done = true
        this.cb.complete()
      },
      addChild(childTx) {
        this.children.push(childTx)
        childTx.cb(0, function tx(t,d) { 
          if (t == 1) this.cb(1,d)
          if (t == 2) this.isComplete() && this.cb(2)
        })
      },
      cb: callbag.subject()
    }
    parent && parent.addChild(tx)
    return tx
  }
}
