import { coreUtils } from '@jb6/core'
const { jb, Ctx, log, logError, logException, compByFullId, calcValue, waitForInnerElements, compareArrays, stripData } = coreUtils

export async function runCircuit(probePath,circuitCmpId,timeout,ctx) {
    if (!probePath)
        return logError(`probe runCircuit missing probe path`, {})
    log('probe start run circuit',{probePath})
    const circuit = circuitCmpId || calcCircuit()
    if (!circuit)
        return logError(`probe can not infer circuitCtx from ${probePath}`, {ctx})

    return new Probe(circuit).runCircuit(probePath,timeout)

    function calcCircuit() {
        if (!probePath) 
            return logError(`calcCircuitPath : no probe path`, {ctx,probePath})
        const cmpId = path.split('~')[0]
        const resolvedComp = compByFullId(cmpId) 
        const circuitCmpId = resolvedComp.circuit  || resolvedComp.impl?.expectedResult && cmpId // test
                || circuitOptions(cmpId)[0]?.id || cmpId
        return circuitCmpId
    }
}

export function stripProbeResult(result) {
  return (result || []).map (x => stripData({from: x.from, out: x.out,in: {data: x.in.data, params: x.in.cmpCtx?.params, vars: x.in.vars}}))
}

jb.probeRepository = {
    probeCounter: 0,
    singleVisitPaths: {},
    singleVisitCounters: {},
    http_get_cache: {},
    refs: {}
}

class Probe {
    constructor(circuitCmpId) {
        this.circuitCtx = new Ctx()
        this.circuitCtx.jbCtx.probe = this
        this.records = {}
        this.visits = {}
        this.circuitComp = compByFullId(circuitCmpId)
        this.id = ++jb.probeRepository.probeCounter
    }

    async runCircuit(probePath,maxTime) {
        this.maxTime = maxTime || 50
        this.startTime = new Date().getTime()
        log('probe run circuit',{probePath, probe: this})
        this.records[probePath]
        this.probePath = probePath

        try {
            this.active = true
            this.circuitRes = await waitForInnerElements(this.circuitComp.runProfile({}, this.circuitCtx))
            this.result = this.records[probePath] || []
            await waitForInnerElements(this.result)
            this.completed = true
            this.totalTime = new Date().getTime()-this.startTime
            log('probe completed',{probePath, probe: this})
            // ref to values
            this.result.forEach(obj=> { obj.out = calcValue(obj.out) ; obj.in.data = calcValue(obj.in.data)})

            return this
        } catch (e) {
            if (e != 'probe tails')
                logException(e,'probe run',{probe: this})
        } finally {
            this.active = false
        }
    }

    // called from jb_run
    record(ctx,out,data,vars) {
        const {probe, path } = ctx.jbCtx
        if (!probe.active) return
        if (probe.probePath.split('~')[0] != path.split('~')[0]) return
        probe.visits[path] = probe.visits[path] || 0
        probe.visits[path]++
        //jb.probe.singleVisitPaths[path] = ctx
        //jb.probe.singleVisitCounters[path] = (jb.probe.singleVisitCounters[path] || 0) + 1
        if (probe.probePath.indexOf(path) != 0) return

        const _ctx = data ? ctx = ctx.setData(data).setVars(vars||{}) : ctx // used by ctx.data(..,) in rx
        if (probe.id < jb.probeRepository.probeCounter) {
            log('probe probeCounter is larger than current',{ctx, probe, counter: jb.probeRepository.probeCounter})
            probe.active = false
            throw 'probe tails'
            return
        }
        probe.startTime = probe.startTime || new Date().getTime() // for the remote probe
        const now = new Date().getTime()
        // if (now - probe.startTime > probe.maxTime && !ctx.vars.testID) {
        //     log('probe timeout',{ctx, probe,now})
        //     probe.active = false
        //     throw 'probe tails'
        //     //throw 'out of time';
        // }
        probe.records[path] = probe.records[path] || []
        const found = probe.records[path].find(x=>compareArrays(x.in.data,_ctx.data))
        if (found)
            found.counter++
        else
            probe.records[path].push({in: _ctx, out, counter: 0})
        log('probe record',{path,out,found,ctx})

        return out
    }
}
 
function circuitOptions(compId) {
    const refs = getOrCalcAllRefs()
    const shortId = compId.split('>').pop().split('.').pop()
    const candidates = {[compId]: true}
    while (expand()) {}
    const comps = Object.keys(candidates).filter(compId => noOpenParams(compId))
    return comps.sort((x,y) => mark(y) - mark(x)).map(id=>({id, shortId: id.split('>').pop(), location: jb.comps[id].$location}))

    function mark(id) {
      if (id.match(/^test<>/) && id.indexOf(shortId) != -1) return 20
      if (id.match(/^test<>/)) return 10
      return 0
    }

    function noOpenParams(id) {
      return (jb.comps[id].params || []).filter(p=>!p.defaultValue).length == 0
    }

    function expand() {
      const length_before = Object.keys(candidates).length
      Object.keys(candidates).forEach(k=> 
        refs[k] && (refs[k].by || []).forEach(caller=>candidates[caller] = true))
      return Object.keys(candidates).length > length_before
    }
}

function getOrCalcAllRefs() {
    if (Object.keys(jb.probeRepository.refs).length) return
    const refs = {}
    const comps = Object.fromEntries(Object.entries(jb.dsls).flatMap(([dsl,types]) => 
          Object.entries(types).flatMap(([type,tgpType]) => Object.entries(tgpType).map(([id,comp]) => [`${type}<${dsl}>${id}`, comp]))))

    Object.keys(comps).filter(k=>comps[k]).forEach(k=>
      refs[k] = {
        refs: [...calcRefs(comps[k].impl), ...calcRefs(comps[k].params|| [])].filter((x,index,_self) => x && _self.indexOf(x) === index),
        by: []
    })
    Object.keys(comps).filter(k=>comps[k]).forEach(k=>
      refs[k].refs.forEach(cross=>
        refs[cross] && refs[cross].by.push(k))
    )
    jb.probeRepository.refs = refs

    function calcRefs(profile) {
      if (profile == null || typeof profile != 'object') return [];
      return Object.values(profile).reduce((res,v)=> [...res,...calcRefs(v)], [jb.utils.compName(profile)])
    }    
}

