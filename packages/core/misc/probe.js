import { jb } from '@jb6/repo'
import '../utils/core-utils.js'
import '../utils/jb-expression.js'
import '../utils/jb-args.js'
import '../utils/jb-core.js'
import '../utils/tgp.js'
import './jb-cli.js'

const { coreUtils } = jb
const { Ctx, log, logError, logException, compByFullId, calcValue, waitForInnerElements, compareArrays, asJbComp, runCliInContext, absPathToUrl } = coreUtils

jb.probeRepository = {
    probeCounter: 0,
    refs: {}
}
Object.assign(coreUtils, {runProbe, runProbeCli})

async function runProbeCli(probePath, filePath, {extraCode, importMap} = {}) {
    const script = `
      import { jb, dsls } from '@jb6/core'
      import '@jb6/core/misc/probe.js'
      import '${absPathToUrl(filePath, importMap?.serveEntries || [])}'
      ;(async () => {
        try {
          ${extraCode || ''}
          const result = await jb.coreUtils.runProbe(${JSON.stringify(probePath)})
          process.stdout.write(JSON.stringify(result, null, 2))
        } catch (e) {
          console.error(e)
        }
        process.exit(0)
      })()
    `

    try {
      const { result, error, cmd } = await runCliInContext(script, {importMap})
      return { probeRes: result, error, cmd, importMap }
    } catch (error) {
      debugger
      return { probeRes: null, error, importMap}
    }
}

async function runProbe(_probePath, {circuitCmpId, timeout, ctx} = {}) {
    if (!_probePath)
        return logError(`probe runCircuit missing probe path`, {})
    const probePath = _probePath.indexOf('<') == -1 ? `test<test>${_probePath}` : _probePath
    log('probe start run circuit',{probePath})
    const circuit = circuitCmpId || calcCircuit()
    if (!circuit)
        return logError(`probe can not infer circuitCtx from ${probePath}`, {ctx})

    const probeObj = await new Probe(circuit).runCircuit(probePath,timeout)

    const result = {
        circuitCmpId : circuit, 
        probePath,
        visits: probeObj.visits,
        totalTime: probeObj.totalTime,
        result: stripProbeResult(probeObj.result),
        circuitRes: stripData(probeObj.circuitRes),
        errors: stripData(jb.ext.spy?.search('error')),
        logs: stripData(jb.ext.spy?.logs)
    }

    return result

    function calcCircuit() {
        if (!probePath) 
            return logError(`calcCircuitPath : no probe path`, {ctx,probePath})
        const cmpId = probePath.split('~')[0]
        const comp = compByFullId(cmpId, jb)[asJbComp]
        const circuitCmpId = comp.circuit  || comp.impl?.expectedResult && cmpId // test
                || circuitOptions(cmpId)[0]?.id || cmpId
        return circuitCmpId
    }
}

function stripProbeResult(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(entry => {
    const { from = null, out = null, in: input = {} } = entry || {};
    const safeIn = {
      data:   input.data   ?? null,
      params: input.cmpCtx?.params ?? null,
      vars:   input.vars   ?? null
    };
    return stripData({ from, out, in: safeIn });
  });
}

function stripData(value, { MAX_OBJ_DEPTH = 100, MAX_ARRAY_LENGTH = 10000 } = {}) {
  return _strip(value, 0, '');

  function _strip(data, depth, path) {
    if (data == null) return data;
    if (['string','number','boolean'].includes(typeof data)) {
      return data;
    }
    if (typeof data === 'function') {
      return '[Function]';
    }
    if (depth > MAX_OBJ_DEPTH) {
      return `[Max depth reached at ${path}]`;
    }
    if (Array.isArray(data)) {
      if (data.length > MAX_ARRAY_LENGTH) {
        data = data.slice(0, MAX_ARRAY_LENGTH);
      }
      return data.map((item, i) => _strip(item, depth + 1, `${path}[${i}]`));
    }
    if (data instanceof Error) {
      return { $$: 'Error', message: data.message };
    }
    if (typeof data === 'object' && data.constructor?.name !== 'Object') {
      return { $$: data.constructor.name };
    }
    return Object.fromEntries(
      Object.entries(data).map(([k, v]) => [
        k,
        _strip(v, depth + 1, path ? `${path}.${k}` : k)
      ])
    );
  }
}

class Probe {
    constructor(circuitCmpId) {
        this.circuitCtx = new Ctx()
        this.circuitCtx.jbCtx.probe = this
        this.records = {}
        this.visits = {}
        this.circuitComp = compByFullId(circuitCmpId, jb)[asJbComp]
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
            const res = await this.circuitComp.runProfile({}, this.circuitCtx)
            this.circuitRes = await waitForInnerElements(res)
            this.result = this.records[probePath] || []
            await waitForInnerElements(this.result)
            log('probe completed',{probePath, probe: this})
            // ref to values
            this.result.forEach(obj=> { obj.out = calcValue(obj.out) ; obj.in.data = calcValue(obj.in.data)})

            return this
        } catch (e) {
          if (typeof e.message == 'string' && e.message.match(/Cannot find module/))
            this.error = e.message
          this.totalTime = new Date().getTime()-this.startTime
          this.result = this.result || []
          if (e != 'probe tails')
            logException(e,'probe run',{})
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
        if (probe.probePath.indexOf(path) != 0) return

        const _ctx = data ? ctx = ctx.setData(data).setVars(vars||{}) : ctx // used by ctx.data(..,) in rx
        if (probe.id < jb.probeRepository.probeCounter) {
            log('probe probeCounter is larger than current',{ctx, probe, counter: jb.probeRepository.probeCounter})
            probe.active = false
            throw 'probe tails'
            return
        }
        probe.startTime = probe.startTime || new Date().getTime() // for the remote probe
        //const now = new Date().getTime()
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
    const refs = jb.probeRepository.refs = jb.probeRepository.refs || calcAllRefs()
    const shortId = compId.split('>').pop().split('.').pop()
    const candidates = {[compId]: true}
    while (expand()) {}
    const comps = Object.keys(candidates).filter(compId => noOpenParams(compId))
    return comps.sort((x,y) => mark(y) - mark(x)).map(id=>({id, shortId: id.split('>').pop()}))

    function mark(id) {
      if (id.match(/^test<>/) && id.indexOf(shortId) != -1) return 20
      if (id.match(/^test<>/)) return 10
      return 0
    }

    function noOpenParams(id) {
      return (compByFullId(id, jb)[asJbComp]?.params || []).filter(p=>!p.defaultValue).length == 0
    }

    function expand() {
      const length_before = Object.keys(candidates).length
      Object.keys(candidates).forEach(k=> 
        refs[k] && (refs[k].by || []).forEach(caller=>candidates[caller] = true))
      return Object.keys(candidates).length > length_before
    }
}

function calcAllRefs() {
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
    return refs

    function calcRefs(profile) {
      if (profile == null || typeof profile != 'object') return [];
      return Object.values(profile).reduce((res,v)=> [...res,...calcRefs(v)], [jb.utils.compName(profile)])
    }    
}

