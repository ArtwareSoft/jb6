import { jb } from '@jb6/repo'
import '../utils/core-utils.js'
import '../utils/jb-expression.js'
import '../utils/jb-args.js'
import '../utils/jb-core.js'
import '../utils/tgp.js'
import './jb-cli.js'

const { coreUtils } = jb
const { Ctx, log, logError, logException, compByFullId, calcValue, waitForInnerElements, compareArrays, 
  asJbComp, compIdOfProfile, stripData, unique } = coreUtils

jb.probeRepository = {
    probeCounter: 0
}
Object.assign(coreUtils, {runProbe, runProbeCli})

async function runProbeCli(probePath, resources) {
    const { extraCode } = resources
    const {entryFiles, testFiles, importMap, jb6_testFiles, projectDir } = await coreUtils.calcImportData(resources)
    //const moreTests = jb6_testFiles.filter(x=>x.includes(projectDir))
    const imports = unique([...entryFiles, ...testFiles]) // ,...moreTests
    const script = `
      import { writeFile } from 'fs/promises'
      import { jb, dsls, coreUtils } from '@jb6/core'
      import '@jb6/testing'
      import '@jb6/core/misc/probe.js'
      const imports = ${JSON.stringify(imports)}
      try {
        ${extraCode || ''}
        await Promise.all(imports.map(f => import(f))) // .catch(e => console.error(e.stack) )
        const result = await jb.coreUtils.runProbe(${JSON.stringify(probePath)})
        await coreUtils.writeServiceResult(result)
      } catch (e) {
        await coreUtils.writeServiceResult({error: e.stack})
        console.error(e)
      }
    `
    try {
      const { result, error, cmd } = await coreUtils.runCliInContext(script, {projectDir, importMapsInCli: importMap.importMapsInCli})
      return { probeRes: result, error, cmd, projectDir }
    } catch (error) {
      debugger
      return { probeRes: null, error, projectDir}
    }
}

async function runProbe(_probePath, {circuitCmpId, timeout, ctx} = {}) {
  debugger
  if (!_probePath) {
       logError(`probe runCircuit missing probe path`, {})
       return { error: `probe runCircuit missing probe path` }
    }
    const probePath = _probePath.indexOf('<') == -1 ? `test<test>${_probePath}` : _probePath
    log('probe start run circuit',{probePath})
    let circuit = circuitCmpId || calcCircuit()
    if (circuit.error)
      return circuit
    if (!circuit)
        return { error: `probe can not infer circuitCtx from ${probePath}` }
    if (!compByFullId(circuit, jb) && compByFullId(`test<test>${circuit}`, jb))
      circuit = `test<test>${circuit}`

    if (!compByFullId(circuit, jb))
      return { error: `can not find comp circuit ${circuit}` }

    let probeObj = new Probe(circuit)
    try {
      await probeObj.runCircuit(probePath,timeout)
    } catch (e) {}

    const result = {
        circuitCmpId: circuit, 
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
           return { error: `calcCircuitPath : no probe path` }
        const cmpId = probePath.split('~')[0]
        const comp = compByFullId(cmpId, jb)?.[asJbComp]
        if (!comp)
          return { error: `calcCircuitPath : can not find comp ${cmpId} in jb repo` }

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
    return stripData({ from, out, in: safeIn }, {reshowVisited: true});
  });
}

class Probe {
    constructor(circuitCmpId) {
        this.circuitCtx = new Ctx().setVars({singleTest: true})
        this.circuitCtx.jbCtx.probe = this
        this.circuitCtx.jbCtx.path = circuitCmpId
        this.records = {}
        this.visits = {}
        this.circuitComp = compByFullId(circuitCmpId, jb)[asJbComp]
        this.id = ++jb.probeRepository.probeCounter
    }

    async runCircuit(probePath,maxTime) {
        this.maxTime = maxTime || 50
        this.startTime = Date.now()
        log('probe run circuit',{probePath, probe: this})
        this.records[probePath]
        this.probePath = probePath

        try {
            this.active = true
            const res = await this.circuitComp.runProfile({}, this.circuitCtx)
            this.circuitRes = await waitForInnerElements(res)
            this.result = this.records[probePath] || []
            this.result = await waitForInnerElements(this.result)
            const resolvedOuts = await Promise.all(this.result.map(x=>waitForInnerElements(x.out)))
            log('probe completed',{probePath, probe: this})
            // ref to values
            this.result.forEach((obj,i)=> { obj.out = calcValue(resolvedOuts[i]) ; obj.in.data = calcValue(obj.in.data)})

            return this
        } catch (e) {
          if (typeof e.message == 'string' && e.message.match(/Cannot find module/))
            this.error = e.message
          this.result = this.result || []
          if (e != 'probe tails')
            logException(e,'probe run',{})
        } finally {
            this.totalTime = Date.now()-this.startTime
            this.active = false
        }
    }

    // called from jb_run
    record(ctx,out,data,vars) {
        const {probe, path : _path } = ctx.jbCtx
        if (!probe.active || typeof out == 'function') return
        const creatorPath = ctx.jbCtx.creatorStack?.[1] || ''
        const path = [_path,creatorPath].find(p=>probe.probePath.split('~')[0] == p.split('~')[0])
        //if (!path) return
        probe.visits[path] = probe.visits[path] || 0
        probe.visits[path]++
        if (probe.probePath.indexOf(path) != 0) return

        const _ctx = data ? ctx = ctx.setData(data).setVars(vars||{}) : ctx // used by ctx.data(..,) in rx
        if (probe.id < jb.probeRepository.probeCounter) {
            log('probe probeCounter is larger than current',{ctx, probe, counter: jb.probeRepository.probeCounter})
            // probe.active = false
            //throw { error: `probeCounter is larger than current. id: ${probe.id} counter: ${jb.probeRepository.probeCounter}`, path }
            //return
        }
        probe.startTime = probe.startTime || Date.now() // for the remote probe
        //const now = Date.now()
        // if (now - probe.startTime > probe.maxTime && !ctx.vars.testID) {
        //     log('probe timeout',{ctx, probe,now})
        //     probe.active = false
        //     throw 'probe tails'
        //     //throw 'out of time';
        // }
        probe.records[path] = probe.records[path] || []
        const found = probe.probePath != path && probe.records[path].find(x=>compareArrays(x.in.data,_ctx.data))
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
      if (id.match(/^test<>/) && id.indexOf(shortId) != -1) return 20 // test with cmp name
      if (id.match(/^test</)) return 10 // just a test
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
          Object.entries(types).filter(([_,tgpType]) => typeof tgpType == 'object')
            .flatMap(([type,tgpType]) => Object.entries(tgpType).map(([id,comp]) => [`${type}<${dsl}>${id}`, comp[asJbComp]]))))

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
      if (profile == null || typeof profile != 'object') return []
      const cmpId = (profile.$$ || profile.$) ? [compIdOfProfile(profile)] : []
      return Object.values(profile).reduce((res,v)=> [...res,...calcRefs(v)], cmpId)
    }    
}

