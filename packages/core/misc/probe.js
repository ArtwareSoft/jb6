import { jb } from '@jb6/repo'
import '../utils/core-utils.js'
import '../utils/jb-expression.js'
import '../utils/jb-args.js'
import '../utils/jb-core.js'
import '../utils/tgp.js'
import './jb-cli.js'
import './import-map-services.js'

const { coreUtils } = jb
const { Ctx, log, logError, logException, compByFullId, calcValue, waitForInnerElements, compareArrays,
  asJbComp, compIdOfProfile, stripData, unique, toCapitalType } = coreUtils
const { tgp: { Component }, test: { Logger, logger: { domainLogger } } } = jb.dsls

// probeLogger: dedicated carrier for live probe progress (visited comps). Wrapped-to-stderr in the child and
// routed browser-side via dispatchChildLine → eventEmitter, where the studio's visitsProgress view listens.
Logger('probeLogger', { impl: domainLogger('probe') })

jb.probeRepository = {
    probeCounter: 0
}
Object.assign(coreUtils, {runProbe, runProbeCli, createClaudeDirForProbe})

async function runProbeCli(probePath, resources = {}, {onStatus = null, claudeDir = ''} = {}) {
  try {
    const { extraCode, circuitCmpId, repoRoot, fetchByEnvHttpServer, entryPointPaths, resolution = 'default' } = resources
    const loggerNames = (resources.logger || '').split(',').map(s => s.trim()).filter(Boolean)
    const ctx = coreUtils.ensureLoggers(['probeLogger', 'cliLogger', ...loggerNames], {ctx: resources.ctx})
    ctx.vars.cliLogger?.progress?.({step: 'resolveImports', status: 'running'})

    const circuitInLoadedFiles = entryPointPaths && !circuitCmpId && (() => {
      const normPath = probePath.indexOf('<') == -1 ? `test<test>${probePath}` : probePath
      const c = calcCircuit(normPath, ctx)
      return typeof c == 'string' && !!compByFullId(c, jb)
    })()
    let imp, strategy
    if (entryPointPaths && (extraCode || circuitCmpId || circuitInLoadedFiles)) {
      strategy = extraCode ? 'files:extraCode' : circuitCmpId ? 'files:circuitCmpId' : 'files:circuitInLoadedFiles'
      imp = await coreUtils.calcImportsForFiles(coreUtils.asArray(entryPointPaths), {repoRoot, ctx})
    } else {
      strategy = 'scan:calcImportsForProfile'
      if (!coreUtils.calcImportsForProfile)
        await import('@jb6/lang-service/src/tgp-model-data.js')
      const cmpId = (circuitCmpId || probePath).split('~')[0]
      imp = await coreUtils.calcImportsForProfile(`{$: '${cmpId}'}`, {repoRoot, fetchByEnvHttpServer, entryPointPaths, ctx})
    }
    if (imp.error)
      return { probeRes: null, error: imp.error, diagnostic: imp.diagnostic }
    ctx.vars.cliLogger?.progress?.({step: 'resolveImports', status: 'done', strategy})
    const { projectDir, importMapsInCli } = imp
    const testFiles = imp.testFiles || imp.tgpModel?.testFiles || []
    const allImportFiles = unique([...(imp.topLevelImports || []), ...testFiles])
    const importsStr = allImportFiles.map(f => `await import('${f}')`).join('\n')

    const script = `
      import { jb, dsls, coreUtils } from '@jb6/core'
      import '@jb6/testing'
      import '@jb6/core/misc/jb-cli.js'
      import '@jb6/core/misc/probe.js'
      const probePath = '${probePath}'
      const loggerNames = ${JSON.stringify(loggerNames)}
      try {
        ${extraCode || ''}
        // probeLogger + cliLogger are wrapped-to-stderr so live visit progress and the staticImportsLoaded timing (emitted by jb-logging) stream back even without ?logger=
        const _ctx = coreUtils.ensureLoggers(['probeLogger', 'cliLogger', ...loggerNames], {wrapToStderr: true})
        _ctx.vars.cliLogger.progress({step: 'spawn', status: 'done'})   // child's FIRST emit → spawn already happened (~10ms), so it's reported done
        _ctx.vars.cliLogger.progress({step: 'imports', status: 'running'})   // child-side stepper step: loading probed comp + test imports (streams to studio via stderr)
        const _tImports = Date.now()
        ${importsStr}
        _ctx.vars.cliLogger.progress({step: 'imports', status: 'done'})
        const _tProbe = Date.now()
        const probeRes = await jb.coreUtils.runProbe(probePath, {...${JSON.stringify({circuitCmpId})}, progressLogger: _ctx.vars.probeLogger, ctx: _ctx})
        _ctx.vars.cliLogger.info({t: 'probeCli timing', importsMs: _tProbe - _tImports, probeMs: Date.now() - _tProbe, fileCount: ${allImportFiles.length}}, {}, {ctx: _ctx})
        await coreUtils.writeServiceResult(probeRes)
      } catch (e) {
        await coreUtils.writeServiceResult({error: e.stack})
        console.error(e)
      }
    `
    const { result: rawResult, error, cmd } = await coreUtils.runCliInContext(script,
      {projectDir, importMapsInCli, ctx, bindLoggers: ['probeLogger', 'cliLogger', ...loggerNames].join(','), stream: 'both'}, onStatus)
    const result = coreUtils.resolveRefs(rawResult)   // child JSON-serializes with stripData ref-dedup ([jbReference:...]); rebuild the graph so out isn't a dangling ref
    const probeLog = ctx ? coreUtils.harvestLogs(ctx, loggerNames) : {}
    if (resolution == 'all')
      return { probeRes: result, error, cmd, projectDir, topLevelImports: allImportFiles, ...probeLog }
    // result[] records are {in:{data,vars}, out, from}. 'default' = in.data + out (no vars) -
    // the "what flowed through" view. 'output' = only out side. 'input' = full in (with vars) + out.
    const projectRec = ({in: i, out, from}) => resolution == 'output' ? { out, from }
      : resolution == 'input' ? { in: i, out, from }
      : { in: i && { data: i.data }, out, from }
    const projectResult = r => r.map(projectRec)
    return { probeRes: result && { circuitCmpId: result.circuitCmpId, probePath: result.probePath,
      result: result.result && projectResult(result.result), visits: result.visits, circuitRes: result.circuitRes, errors: result.errors }, error, ...probeLog }
  } catch (error) {
    return { probeRes: null, error: error.stack || String(error) }
  }
}

        //const claudeDirRes = await coreUtils.createClaudeDirForProbe({claudeDir, probePath, probeRes,imports})
        //probeRes.claudeDir = claudeDirRes

async function runProbe(_probePath, {circuitCmpId, timeout, progressLogger, ctx = new Ctx() } = {}) {
  if (!_probePath) {
       logError(`probe runCircuit missing probe path`, {})
       return { error: `probe runCircuit missing probe path` }
    }
    const probePath = _probePath.indexOf('<') == -1 ? `test<test>${_probePath}` : _probePath
    log('probe start run circuit',{probePath})
    progressLogger?.info?.({t: 'beforeCalcCircuit', probePath}, {}, {ctx})
    progressLogger?.progress?.({step: 'calcCircuit', status: 'running', probePath})   // stepper step: circuit inference (progress channel → eventEmitter → studio)
    let circuit = circuitCmpId || calcCircuit(probePath, ctx)
    progressLogger?.info?.({t: 'afterCalcCircuit', circuit}, {}, {ctx})
    progressLogger?.progress?.({step: 'calcCircuit', status: 'done', circuit})
    progressLogger?.progress?.({step: 'runCircuit', status: 'running', circuit})   // stepper step: about to run the circuit
    if (circuit.error)
      return circuit
    if (!circuit)
        return { error: `probe can not infer circuitCtx from ${probePath}` }
    if (!compByFullId(circuit, jb) && compByFullId(`test<test>${circuit}`, jb))
      circuit = `test<test>${circuit}`

    if (!compByFullId(circuit, jb))
      return { error: `can not find comp circuit ${circuit}` }

    let probeObj = new Probe(circuit, progressLogger)
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
}

function calcCircuit(probePath, ctx) {
    if (!probePath)
       return { error: `calcCircuitPath : no probe path` }
    const fullCmpId = probePath.split('~')[0]
    const comp = compByFullId(fullCmpId, jb)
    if (!comp)
      return { error: `calcCircuitPath : can not find comp ${fullCmpId} in jb repo` }

    const [type, dsl] = fullCmpId.match(/^([^<]+)<([^>]+)>/).slice(1)
    const t0 = Date.now()
    const [strategy, circuitCmpId] = [
      ['comp names its circuit',      comp.circuit],
      ['TgpType is circuit',          jb.dsls[dsl]?.[toCapitalType(type)]?.isCircuit && fullCmpId],
      ['backtrace best caller',       circuitOptions(fullCmpId)[0]?.id]
    ].find(([, id]) => id) || ['self - no circuit found', fullCmpId]
    ctx?.vars?.probeLogger?.info?.({t: 'calcCircuit', fullCmpId, strategy, circuitCmpId, ms: Date.now() - t0}, {}, {ctx})
    return circuitCmpId
}

async function createClaudeDirForProbe({ probePath, probeRes, imports, claudeDir } = {}) {
  if (!claudeDir) return
  const repoRoot = await coreUtils.calcRepoRoot()
  const { entryFiles, importMap } = await coreUtils.calcImportData()

  const createdAt = new Date().toISOString()
  const circuitCmpId = probeRes?.circuitCmpId || ''
  const hasError = !!probeRes?.error

  const files = {
    'probe-result.json': JSON.stringify(probeRes, null, 2),
    'CLAUDE.md': `# Purpose
This directory is a frozen snapshot of a JB "probe" execution, intended for analysis and debugging in Claude Code.

# What to read first
1) probe-result.json (primary)

# Ground rules
- Do NOT modify any files unless explicitly asked.
- Treat probe-result.json as the source of truth.
- If something is unclear, infer carefully and state assumptions.

#imports 
${JSON.stringify(imports,null,2)}
#importMaps
${JSON.stringify(importMap,null,2)}
#entryFiles
${JSON.stringify(entryFiles,null,2)}


#guidance

to read the relevant source code, use the imports and import map

# Probe metadata
- circuitCmpId: ${circuitCmpId}
- probePath: ${probePath}
- createdAt: ${createdAt}
- repoRoot: ${repoRoot}
- hasError: ${hasError}

`
  }

  const { rm, mkdir, writeFile } = await import('fs/promises')
  const path = await import('path')
  await rm(claudeDir, { recursive: true, force: true })
  await mkdir(claudeDir, { recursive: true })
  await Promise.all(Object.entries(files).map(([fname, content]) => writeFile(path.join(claudeDir, fname), content, 'utf8')))
  return claudeDir
}


function stripProbeResult(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(entry => {
    const { from = null, out = null, in: input = {} } = entry || {}
    const safeIn = { data: input.data, params: input.jbCtx?.params, vars: input.vars }
    const safeOut = out instanceof coreUtils.Ctx ? { data: out.data, params: out.jbCtx?.params, vars: out.vars } : out

    return stripData({ from, out: safeOut, in: safeIn }, {reshowVisited: true})
  })
}

class Probe {
    constructor(circuitCmpId, progressLogger) {
        this.circuitCtx = new Ctx().setVars({singleTest: true})
        this.circuitCtx.jbCtx.probe = this
        this.circuitCmpId = this.circuitCtx.jbCtx.path = circuitCmpId
        this.records = {}
        this.visits = {}   // accumulated {tgpPath: count}, emitted live as progress (throttled in record)
        this.progressLogger = progressLogger
        this._lastEmit = 0
        this.circuitComp = compByFullId(circuitCmpId, jb)
        this.id = ++jb.probeRepository.probeCounter
    }

    emitVisits(force) {
        const now = Date.now()
        if (!force && now - this._lastEmit < 100) return
        this._lastEmit = now
        this.progressLogger?.progress?.({t: 'visit', visits: {...this.visits}})
    }

    emitStart() {
        this.progressLogger?.progress?.({t: 'probeStart', probePath: this.probePath, circuitCmpId: this.circuitCmpId, visits: {}})
    }

    async runCircuit(probePath,maxTime) {
        this.maxTime = maxTime || 50
        this.startTime = Date.now()
        log('probe run circuit',{probePath, probe: this})
        this.records[probePath]
        this.probePath = probePath
        this.emitStart()   // immediate "probe is alive" signal, before the (slow-booting) circuit runs

        try {
            this.active = true
            let res
            if (this.circuitCmpId.match(/^react-comp</)) {
              const { reactUtils } = await import('@jb6/react')
              const { reactCmp, props, ctx } = await reactUtils.wrapReactCompWithSampleData(this.circuitCmpId, this.circuitCtx)
              res = reactUtils.probeReactComp(ctx, reactCmp, props)
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
            this.emitVisits(true)   // final flush so the last window's totals reach the view

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
        const lexicalPath = ctx.jbCtx.lexicalStack?.[1] || ''
        const path = [_path,lexicalPath].find(p=>probe.probePath.split('~')[0] == p.split('~')[0])
        //if (!path) return
        probe.visits[path] = probe.visits[path] || 0
        probe.visits[path]++
        probe.emitVisits()
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
      const [type, dsl] = id.match(/^([^<]+)<([^>]+)>/).slice(1)
      if (!jb.dsls[dsl]?.[toCapitalType(type)]?.isCircuit) return 0
      return id.indexOf(shortId) != -1 ? 20 : 10   // circuit type; +bonus when it names the probed comp
    }

    function noOpenParams(id) {
      return (compByFullId(id, jb)?.params || []).filter(p=>!p.defaultValue).length == 0
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
