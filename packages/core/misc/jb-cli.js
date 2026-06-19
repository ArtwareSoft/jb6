import { jb } from '@jb6/repo'
import '../utils/core-utils.js'
import '../utils/jb-expression.js'
import '../utils/jb-args.js'
import '../utils/jb-core.js'
import '../utils/tgp.js'
import '../utils/jb-logging.js'
const { coreUtils } = jb

const {
  tgp: { Component },
  common: { Data },
  test: { Logger, logger: { domainLogger } }
} = jb.dsls
const { logException, logError, isNode } = coreUtils
Object.assign(coreUtils, {runNodeCli, runNodeCliViaJbWebServer, runCliInContext, runBashScript, runNodeCliStreamViaJbWebServer, runBashScriptStreamViaJbWebServer, buildNodeCliCmd, makeChildOutputRouter})

Logger('cliLogger', { impl: domainLogger('cli') })

function buildNodeCliCmd(script, options = {}) {
  options.importMapsInCli = options.importMapsInCli || jb.coreRegistry.importMapsInCli
  const importParts = options.importMapsInCli ? ['--import', options.importMapsInCli] : []
  const cmd = `node --inspect-brk --experimental-vm-modules --expose-gc --input-type=module ${importParts.join(' ')} -e "${script.replace(/\$/g, '\\$').replace(/"/g, '\\"')}"`
  return { cmd, importParts }
}

// Reverse of wrapLoggerInstanceToStderr: parses JSONL `{kind:'log',logger,channel,event}` from child output and routes to ctx loggers.
// Non-JSONL lines flow through cliLogger as info events so nothing is silently dropped.
const tryParse = line => { try { return JSON.parse(line) } catch { return null } }
function dispatchChildLine({ctx, line, stream}) {
  if (!line) return
  const ev = tryParse(line)
  if (ev?.kind === 'log') {
    const lg = ctx?.vars?.[ev.logger]
    const fn = lg?.[ev.channel]
    if (typeof fn === 'function') {
      try { ev.channel === 'progress' || ev.channel === 'status' ? fn.call(lg, ev.event) : fn.call(lg, ev.event, {}, {ctx}) } catch (e) {
        ctx.vars.errorLogger.error({t: 'dispatch error', logger: ev.logger, channel: ev.channel, err: e.stack}, {}, {ctx})
      }
    } else {
      ctx.vars.errorLogger.error({t: 'dispatch missing', logger: ev.logger, channel: ev.channel, hasLogger: !!lg, availableChannels: lg && Object.keys(lg).filter(k=>typeof lg[k]==='function')}, {}, {ctx})
    }
    return
  }
  ctx?.vars?.cliLogger?.info?.({t: 'cli line', stream, line}, {}, {ctx})
}
// Stateful line-buffered router for chunked stdio. Splits on '\n'; call .flush() to drain trailing partials.
function makeChildOutputRouter({ctx, bindLoggers}) {
  if (!bindLoggers && !ctx?.vars?.cliLogger) return null
  const bufs = {stdout: '', stderr: ''}
  const router = ({stream, text}) => {
    if (stream === 'flush') {
      for (const s of ['stdout','stderr']) { if (bufs[s]) { dispatchChildLine({ctx, line: bufs[s], stream: s}); bufs[s] = '' } }
      return
    }
    if (!text) return
    bufs[stream] += text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\r[^\n]*(?=\r|$)/g, '')
    const lines = bufs[stream].split('\n')
    bufs[stream] = lines.pop()
    lines.forEach(line => dispatchChildLine({ctx, line, stream}))
  }
  router.flush = () => router({stream: 'flush'})
  return router
}

Component('bash', {
  params: [
    {id: 'script', as: 'text'}
  ],
  impl: (ctx, {}, {script}) => runBashScript(script)
})

// Run a TGP CLI script. options: {ctx, bindLoggers, projectDir, importMapsInCli, expressUrl}.
// In browser: routes through jb-web-server SSE. In Node: spawns a child directly.
// Child stderr JSONL lines route to ctx.vars[loggerName]; non-JSONL falls through to ctx.vars.cliLogger.
async function runCliInContext(script, options = {}) {
  options.ctx = coreUtils.ensureLoggers([], options.ctx)   // always a ctx with errorLogger — single source of truth downstream
  const router = makeChildOutputRouter(options)
  if (!isNode && router) return runNodeCliStreamViaJbWebServer(script, options, router)
  if (!isNode) return runNodeCliViaJbWebServer(script, options)
  return runNodeCli(script, options)
}

async function runNodeCli(script, options = {}) {
  const {spawn} = await import('child_process')
  const { cmd, importParts } = buildNodeCliCmd(script, options)
  const cwd = options.projectDir
  const scriptToRun = `console.log = () => {};\n${script}`
  const router = makeChildOutputRouter(options)
  const onChunk = options.onChunk  // raw {stream,text} chunks — used by SSE server to broadcast
  options.ctx?.vars?.cliLogger?.info?.({t: 'spawn cli', cmd, cwd}, {}, {ctx: options.ctx})

  return new Promise(resolve => {
    let out = '', err = ''
    try {
      const child = spawn(process.execPath, ['--experimental-vm-modules', '--expose-gc', '--input-type=module', ...importParts, '-e', scriptToRun], {cwd})
      options.onChild?.(child)
      child.stdout.on('data', d => { const text = '' + d; out += text; router?.({stream: 'stdout', text}); onChunk?.({stream: 'stdout', text}) })
      child.stderr.on('data', d => { const text = '' + d; err += text; router?.({stream: 'stderr', text}); onChunk?.({stream: 'stderr', text}) })
      child.on('close', code => {
        router?.flush?.()
        if (code !== 0) {
          const error = Object.assign(new Error(`Exit ${code}`), {stdout: out, stderr: err})
          logException(error, 'error in run node cli stream', {cmd, cwd, stdout: out})
          return resolve({error, cmd, cwd, code, stderr: err})
        }
        try { resolve({result: JSON.parse(out), cmd, cwd, stderr: err}) }
        catch (e) { resolve({err: 'json parse error', error: e.stack || e, cmd, cwd, textToParse: out, stderr: err}) }
      })
    } catch(e) {
      logException(e, 'error in run node cli stream', {cmd, cwd})
      resolve({error: e, cmd, cwd})
    }
  })
}

async function runNodeCliViaJbWebServer(script, options = {}) {
  const { ctx, ...optionsToSend } = options
  try {
    const expressUrl = options.expressUrl || ''
    const { cmd } = buildNodeCliCmd(script, options)
    const cliLogger = ctx?.vars?.cliLogger
    cliLogger?.info?.({t: 'POST /run-cli', expressUrl, scriptLen: script.length}, {}, {ctx})
    const res = await fetch(`${expressUrl}/run-cli`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script, ...optionsToSend })
    })
    cliLogger?.info?.({t: '/run-cli response', ok: res.ok, status: res.status}, {}, {ctx})
    if (!res.ok) {
      const text = await res.text()
      ctx.vars.errorLogger.error({t: '/run-cli !ok', status: res.status, body: text.slice(0,500)}, {}, {ctx})
      return { error: `runNodeCliViaJbWebServer failed: ${res.status} – ${text}`, ...optionsToSend }
    }

    const json = await res.json()
    const { result, error } = json
    cliLogger?.info?.({t: '/run-cli json', hasResult: !!result, error, stderr: String(result?.stderr || '').slice(0,500), textToParse: String(result?.textToParse || '').slice(0,500)}, {}, {ctx})
    if (error)
      return { error, cmd, ...optionsToSend }

    return { ...result, cmd }
  } catch (e) {
    return { error: `runNodeCliViaJbWebServer exception: ${e.stack}`, ...optionsToSend }
  }
}

// Shared SSE consumer: posts to startUrl, reads SSE stream via fetch, fetches contentUrl on done.
// Works in both browser and Node (uses fetch ReadableStream — no EventSource dependency).
//
// SSE protocol on the wire (per https://html.spec.whatwg.org/multipage/server-sent-events.html):
//   data: <single-line value>\n
//   data: <single-line value>\n   ← optional repeat for multi-line values (joined with \n on the receiver)
//   \n                            ← blank line ends the message
// So message terminator is `\n\n`. A single `data:` line cannot itself contain a raw `\n`.
// Producer writes `data: ${JSON.stringify(msg)}\n\n` — JSON.stringify guarantees no raw `\n` in its output
// (any newlines in values are escaped to `\\n`), so the format is safe and unambiguous.
//
// Parsing flow below:
//   buf.split('\n\n')          → individual SSE messages
//   ev.split('\n').find(...)   → the `data:` field within a message
//   dataLine.slice(5).trim()   → strip `data:` prefix + any whitespace
//   JSON.parse                 → un-escape and recover the original payload (newlines inside strings restored)
async function streamViaSSE({ startUrl, body, onStatus, onUrls }) {
  const startRes = await fetch(startUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!startRes.ok) {
    const text = await startRes.text()
    return { error: `streamViaSSE start failed: ${startRes.status} – ${text}` }
  }
  const urls = await startRes.json()
  const { statusUrl, contentUrl, error } = urls
  if (error) return { error }
  if (onUrls) onUrls(urls)

  const origin = (typeof location !== 'undefined' && location.origin) || 'http://localhost'
  const absStatus  = /^https?:/.test(statusUrl)  ? statusUrl  : new URL(statusUrl,  new URL(startUrl,  origin).href).href
  const absContent = /^https?:/.test(contentUrl) ? contentUrl : new URL(contentUrl, new URL(startUrl,  origin).href).href

  const sse = await fetch(absStatus, { headers: { Accept: 'text/event-stream' } })
  const reader = sse.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let done = false
  while (!done) {
    const { value, done: streamDone } = await reader.read()
    if (streamDone) break
    const chunk = decoder.decode(value, { stream: true })
    buf += chunk
    const events = buf.split('\n\n')
    buf = events.pop() || ''
    for (const ev of events) {
      const dataLine = ev.split('\n').find(l => l.startsWith('data:'))
      if (!dataLine) continue
      try {
        const msg = JSON.parse(dataLine.slice(5).trim())
        if (msg.type === 'status' && onStatus) onStatus(msg.text)
        if (msg.type === 'done') { done = true; break }
      } catch (e) {}
    }
  }
  reader.cancel().catch(() => {})

  const r = await fetch(absContent)
  if (!r.ok) return { error: `streamViaSSE content failed: ${r.status} – ${await r.text()}` }
  return await r.json()
}

async function runNodeCliStreamViaJbWebServer(script, options = {}, onStatus) {
  try {
    const { ctx, expressUrl = '', ...optionsToPass } = options
    const { cmd } = buildNodeCliCmd(script, optionsToPass)
    const result = await streamViaSSE({
      startUrl: `${expressUrl}/run-cli-stream`,
      body: { script, ...optionsToPass },
      onStatus: chunk => {
        if (!onStatus) return
        const text = typeof chunk === 'string' ? chunk : chunk?.text
        const stream = typeof chunk === 'string' ? 'stderr' : chunk?.stream
        onStatus({ stream, text })
      }
    })
    onStatus?.flush?.()
    if (result.error) return { error: result.error, cmd, ...options }
    return { ...result, cmd }
  } catch (e) {
    return { error: `runNodeCliStreamViaJbWebServer exception: ${e.stack}`, ...options }
  }
}

/// browser-side bash streaming: feeds line-buffered onStdoutLine/onStderrLine from SSE chunks
// onStatus(chunk) — raw {stream,text} chunks as they arrive (before line buffering)
async function runBashScriptStreamViaJbWebServer(script, { onStdoutLine, onStderrLine, onStatus, onStart } = {}, options = {}) {
  try {
    const expressUrl = options.expressUrl || ''
    const buf = { stdout: '', stderr: '' }
    const flushChunk = (stream, text) => {
      const cb = stream === 'stderr' ? onStderrLine : onStdoutLine
      if (!cb) return
      const combined = buf[stream] + text
      const lines = combined.split('\n')
      buf[stream] = lines.pop() || ''
      lines.forEach(cb)
    }
    const result = await streamViaSSE({
      startUrl: `${expressUrl}/run-bash-stream`,
      body: { script, ...options },
      onUrls: urls => {
        if (!onStart || !urls?.runId) return
        const kill = (signal = 'SIGTERM') =>
          fetch(`${expressUrl}/run-bash-stream/${urls.runId}/cancel`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ signal })
          }).catch(() => {})
        onStart({ pid: urls.runId, kill })
      },
      onStatus: chunk => {
        if (!chunk) return
        if (onStatus) onStatus(chunk)
        flushChunk(chunk.stream, chunk.text || '')
      }
    })
    if (onStdoutLine && buf.stdout) onStdoutLine(buf.stdout)
    if (onStderrLine && buf.stderr) onStderrLine(buf.stderr)
    if (result.error) return { error: result.error, script }
    return result
  } catch (e) {
    return { error: `runBashScriptStreamViaJbWebServer exception: ${e.stack}`, script }
  }
}

async function runBashScript(script, callbacks) {
  const { onStdoutLine, onStderrLine, onStart, _onChunk } = callbacks || {}
  if (!isNode) {
    if (onStdoutLine || onStderrLine || onStart)
      return runBashScriptStreamViaJbWebServer(script, { onStdoutLine, onStderrLine, onStart })
    const response = await fetch('/run-bash', { method: 'POST', headers: {'Content-Type': 'application/json' }, body: JSON.stringify({ script }) })
    const result = await response.json()
    return result.result
  }
  const {spawn} = await import('child_process')
  return new Promise((resolve) => {
    let stdout = '', stderr = '', outBuf = '', errBuf = ''
    const emit = (data, isErr) => {
      const text = String(data)
      if (isErr) stderr += text; else stdout += text
      if (_onChunk) _onChunk({ stream: isErr ? 'stderr' : 'stdout', text })
      const cb = isErr ? onStderrLine : onStdoutLine
      if (!cb) return
      const buf = (isErr ? errBuf : outBuf) + text
      const lines = buf.split('\n')
      const tail = lines.pop() || ''
      if (isErr) errBuf = tail; else outBuf = tail
      lines.forEach(cb)
    }

    const child = spawn('bash', ['-c', script], { encoding: 'utf8', detached: true })
    if (onStart) {
      const kill = (signal = 'SIGTERM') => { try { process.kill(-child.pid, signal) } catch (e) {} }
      onStart({ pid: child.pid, kill })
    }
    child.stdout.on('data', d => emit(d, false))
    child.stderr.on('data', d => emit(d, true))

    child.on('close', code => {
      if (onStdoutLine && outBuf) onStdoutLine(outBuf)
      if (onStderrLine && errBuf) onStderrLine(errBuf)
      if (code !== 0) {
        const error = `Shell script exited with code ${code}`
        logError('error in run shell script', { error, script, stdout, stderr })
        return resolve({ error, stdout, stderr, script })
      }
      try {
        stdout = JSON.parse(stdout)
      } catch (e) {}
      resolve({ stdout, stderr, script })
    })

    child.on('error', err => {
      logException(err, 'error spawning shell script', { script })
      resolve({script, err})
    })
  })
}
