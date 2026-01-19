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

async function runProbeCli(probePath, resources, {onStatus = null, claudeDir = ''} = {}) {
    const { extraCode } = resources
    const {entryFiles, testFiles, importMap, projectDir } = await coreUtils.calcImportData(resources)
    const allTests = testFiles.filter(path=>path.includes('all-tests'))
    const testsToInclude = allTests.length ? allTests : testFiles
    const imports = unique([...entryFiles, ...testsToInclude]) // ,...moreTests

    const script = `
      import { writeFile } from 'fs/promises'
      import { jb, dsls, coreUtils } from '@jb6/core'
      import '@jb6/testing'
      import '@jb6/core/misc/probe.js'
      const imports = ${JSON.stringify(imports)}
      try {
        ${extraCode || ''}
        await Promise.all(imports.map(f => import(f))) // .catch(e => console.error(e.stack) )
        jb.workflowUtils?.workflowEvents?.on('status', text => console.error(text))
        const result = await jb.coreUtils.runProbe(${JSON.stringify(probePath)})
        await coreUtils.writeServiceResult(result)
      } catch (e) {
        await coreUtils.writeServiceResult({error: e.stack})
        console.error(e)
      }
    `
    try {
      const { result, error, cmd } = await coreUtils.runCliInContext(script, {projectDir, importMapsInCli: importMap.importMapsInCli}, onStatus)
      if (claudeDir)
        await createClaudeDirForProbe({projectDir, probePath, probeRes: result, cmd, imports, claudeDir, error, importMap })
  
      return { probeRes: result, error, cmd, projectDir }
    } catch (error) {
      debugger
      return { probeRes: null, error: error.stack, projectDir}
    }
}

async function runProbe(_probePath, {circuitCmpId, timeout } = {}) {
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

        const circuitCmpId = comp.circuit  
                || comp.impl?.expectedResult && cmpId // test
                || comp.sampleCtxData && cmpId // react comp
                || circuitOptions(cmpId)[0]?.id || cmpId
        return circuitCmpId
    }
}

async function createClaudeDirForProbe({ projectDir, probePath, probeRes, cmd, imports, claudeDir, error, importMap } = {}) {
  const createdAt = new Date().toISOString()
  const circuitCmpId = probeRes?.circuitCmpId || ''
  const hasError = !!probeRes?.error || error
  const totalTime = probeRes?.totalTime ?? 'N/A'
  const visitsCount = probeRes?.visits ? Object.keys(probeRes.visits).length : 'N/A'
  const resultEntries = Array.isArray(probeRes?.result) ? probeRes.result.length : 'N/A'
  const errorsCount = Array.isArray(probeRes?.errors) ? probeRes.errors.length : 'N/A'
  const logsCount = Array.isArray(probeRes?.logs) ? probeRes.logs.length : 'N/A'
  const importMapStr = JSON.stringify(importMap,null,2)

  const files = {
    'probe-result.json': JSON.stringify(probeRes, null, 2),
    'CLAUDE.md': `# Purpose
This directory is a frozen snapshot of a JB "probe" execution, intended for analysis and debugging in Claude Code.

# What to read first
1) probe-result.json (primary)

# Ground rules
- Do NOT modify any JSON files unless explicitly asked.
- Treat probe-result.json as the source of truth.
- If something is unclear, infer carefully and state assumptions.

#imports 
${imports}
${importMapStr}

# Task guidance
- read the relevant source code, use the imports and import map
- Start by summarizing:
  - probePath, circuitCmpId, totalTime, and top visited paths
  - any errors + where they appear in the probe timeline
- Then produce:
  - likely root cause(s)
  - minimal reproduction hints
  - concrete next steps and what to inspect in codebase

# Probe metadata
- probePath: ${probePath}
- circuitCmpId: ${circuitCmpId}
- createdAt: ${createdAt}
- projectDir: ${projectDir}
- cmd: ${cmd || ''}

# Summary
- hasError: ${hasError}
- totalTime: ${totalTime}
- visitsCount: ${visitsCount}
- resultEntries: ${resultEntries}
- errorsCount: ${errorsCount}
- logsCount: ${logsCount}

`
  }

  if (!coreUtils.isNode) {
    const script = `
      const { rm, mkdir, writeFile } = await import('fs/promises')
      const path = await import('path')
      const claudeDir = '${claudeDir}'
      await rm(claudeDir, { recursive: true, force: true })
      await mkdir(claudeDir, { recursive: true })
      const files = ${JSON.stringify(files)}

      await Promise.all(Object.entries(files).map(([fname, content]) => writeFile(path.join(claudeDir, fname), content, 'utf8')))
      process.stdout.write('{"success": true}')
    `
    const res = await coreUtils.runCliInContext(script, {projectDir, importMapsInCli: importMap.importMapsInCli})
    return res
  } else {
    const { rm, mkdir, writeFile } = await import('fs/promises')
    const path = await import('path')
    await rm(claudeDir, { recursive: true, force: true })
    await mkdir(claudeDir, { recursive: true })
    await Promise.all(Object.entries(files).map(([fname, content]) => writeFile(path.join(claudeDir, fname), content, 'utf8')))
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
        this.circuitCmpId = this.circuitCtx.jbCtx.path = circuitCmpId
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
            let res
            if (this.circuitCmpId.match(/^react-comp</)) {
              const { reactUtils } = await import('@jb6/react')
              const { reactCmp, props } = reactUtils.wrapReactCompWithSampleData(this.circuitCmpId)
              res = reactUtils.probeReactComp(this.circuitCtx, reactCmp, props)
            } else {
              res = await this.circuitComp.runProfile({}, this.circuitCtx)
            }

            this.circuitRes = await waitForInnerElements(res)
            this.result = this.records[probePath] || []
            this.result = await waitForInnerElements(this.result)
            const resolvedOuts = await Promise.all(this.result.map(x=>waitForInnerElements(x.out)))
            log('probe completed',{probePath, probe: this})
            // ref to values
            this.result.forEach((obj,i)=> { obj.out = calcValue(resolvedOuts[i]) ; obj.in.data = calcValue(obj.in.data)})

            return this
        } catch (error) {
          if (typeof error.message == 'string' && error.message.match(/Cannot find module/))
            this.error = error.stack
          this.result = this.result || []
          if (error != 'probe tails')
            logException(error,'probe run',{})
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
      if (id.match(/^react-comp<react>/)) return 10 // react comp

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
