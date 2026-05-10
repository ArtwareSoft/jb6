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
  common: { Data }
} = jb.dsls
const { logException, logError, isNode } = coreUtils
Object.assign(coreUtils, {runNodeCli, runNodeCliViaJbWebServer, runCliInContext, runBashScript, runNodeCliStreamViaJbWebServer, runBashScriptStreamViaJbWebServer, buildNodeCliCmd, makeBindLoggersOnStatus, buildBindLoggersPrelude})

function buildNodeCliCmd(script, options = {}) {
  options.importMapsInCli = options.importMapsInCli || jb.coreRegistry.importMapsInCli
  const importParts = options.importMapsInCli ? ['--import', options.importMapsInCli] : []
  const cmd = `node --inspect-brk --experimental-vm-modules --expose-gc --input-type=module ${importParts.join(' ')} -e "${script.replace(/\$/g, '\\$').replace(/"/g, '\\"')}"`
  return { cmd, importParts }
}

// Wraps user onStatus with a stderr-line parser. When the child emits JSONL `{kind:'log',logger,channel,event}`
// lines (via the bindLoggers prelude), routes each to ctx.vars[logger][channel](event). Unparseable lines pass through.
function makeBindLoggersOnStatus({ctx, bindLoggers, userOnStatus}) {
  if (!bindLoggers) return userOnStatus
  const names = bindLoggers.split(',').map(s => s.trim()).filter(Boolean)
  const loggers = Object.fromEntries(names.map(n => [n, ctx?.vars?.[n]]).filter(([,v]) => v))
  let buf = ''
  return ({stream, text}) => {
    if (stream !== 'stderr' || !text) { userOnStatus?.({stream, text}); return }
    buf += text
    const lines = buf.split('\n')
    buf = lines.pop() || ''
    const passThrough = []
    for (const line of lines) {
      if (!line) continue
      let obj; try { obj = JSON.parse(line) } catch { passThrough.push(line); continue }
      if (obj?.kind === 'log' && loggers[obj.logger]?.[obj.channel])
        try { loggers[obj.logger][obj.channel](obj.event, {}, {ctx}) } catch {}
      else passThrough.push(line)
    }
    if (passThrough.length && userOnStatus) userOnStatus({stream, text: passThrough.join('\n') + '\n'})
  }
}

// Script prelude that wraps each named logger's info/progress/error to also emit JSONL on stderr.
function buildBindLoggersPrelude(bindLoggers) {
  const names = (bindLoggers || '').split(',').map(s => s.trim()).filter(Boolean)
  if (!names.length) return ''
  return `
import { jb as _jb } from '@jb6/core'
for (const _n of ${JSON.stringify(names)}) {
  const _comp = _jb.dsls.test.logger[_n]?.[Symbol.for('asJbComp')]
  if (!_comp) continue
  const _orig = _comp.impl
  _comp.impl = (...a) => {
    const _inst = _orig(...a)
    for (const _ch of ['info','progress','error']) {
      const _o = _inst[_ch]?.bind(_inst)
      if (!_o) continue
      _inst[_ch] = (e, ...x) => {
        try { process.stderr.write(JSON.stringify({kind:'log', logger:_n, channel:_ch, event:e}) + '\\n') } catch {}
        return _o(e, ...x)
      }
    }
    return _inst
  }
}
`
}

Component('bash', {
  params: [
    {id: 'script', as: 'text'}
  ],
  impl: (ctx, {}, {script}) => runBashScript(script)
})

async function runCliInContext(script, options = {}, onStatus) {
  const {ctx, bindLoggers} = options
  const wrappedScript = buildBindLoggersPrelude(bindLoggers) + script
  const wrappedOnStatus = makeBindLoggersOnStatus({ctx, bindLoggers, userOnStatus: onStatus})
  let res = {}
  if (!isNode && wrappedOnStatus)
    res = runNodeCliStreamViaJbWebServer(wrappedScript, options, wrappedOnStatus)
  else if (!isNode)
    res = await runNodeCliViaJbWebServer(wrappedScript, options)
  else
    res = await runNodeCli(wrappedScript, options, wrappedOnStatus)
  return res
}

async function runNodeCli(script, options = {}, onStatus) {
  const {spawn} = await import('child_process')
  const { cmd, importParts } = buildNodeCliCmd(script, options)
  const cwd = options.projectDir
  const scriptToRun = `console.log = () => {};\n${script}`

  const stream = options.stream || 'stderr' // 'stderr' | 'stdout' | 'both'

  return new Promise(resolve => {
    let out = '', err = ''
    try {
      const child = spawn(process.execPath, ['--experimental-vm-modules', '--expose-gc', '--input-type=module', ...importParts, '-e', scriptToRun], {cwd })

      child.stdout.on('data', d => {
        const text = '' + d
        out += text
        if (onStatus && (stream === 'stdout' || stream === 'both'))
          onStatus({ stream: 'stdout', text })
      })

      child.stderr.on('data', d => {
        const text = '' + d
        err += text
        if (onStatus && (stream === 'stderr' || stream === 'both'))
          onStatus({ stream: 'stderr', text: text.replace(/\x1b\[[0-9;]*[a-zA-Z]|\r/g, '').trim() })
      })

      child.on('close', code => {
        if (code !== 0) {
          const error = Object.assign(new Error(`Exit ${code}`), {stdout: out, stderr: err})
          logException(error, 'error in run node cli stream', {cmd, cwd, stdout: out})
          return resolve({error, cmd, cwd, code, stderr: err})
        }
        try {
          const result = JSON.parse(out)
          resolve({result, cmd, cwd, stderr: err})
        } catch (e) {
          resolve({err: 'json parse error', error: e.stack || e, cmd, cwd, textToParse: out, stderr: err})
        }
      })
    } catch(e) {
      logException(e, 'error in run node cli stream', {cmd, cwd})
      resolve({error: e, cmd, cwd})
    }
  })
}

async function runNodeCliViaJbWebServer(script, options = {}, ctx) {
  try {
    const expressUrl = options.expressUrl || ''
    const { cmd } = buildNodeCliCmd(script, options)
    const cliLogger = ctx?.vars?.cliLogger
    cliLogger?.info?.({t: 'POST /run-cli', expressUrl, scriptLen: script.length}, {}, {ctx})
    const res = await fetch(`${expressUrl}/run-cli`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script, ...options })
    })
    cliLogger?.info?.({t: '/run-cli response', ok: res.ok, status: res.status}, {}, {ctx})
    if (!res.ok) {
      const text = await res.text()
      cliLogger?.error?.({t: '/run-cli !ok', status: res.status, body: text.slice(0,500)}, {}, {ctx})
      return { error: `runNodeCliViaJbWebServer failed: ${res.status} – ${text}`, ...options}
    }

    const json = await res.json()
    const { result, error } = json
    cliLogger?.info?.({t: '/run-cli json', hasResult: !!result, error, stderr: String(result?.stderr || '').slice(0,500), textToParse: String(result?.textToParse || '').slice(0,500)}, {}, {ctx})
    if (error)
      return { error, cmd, ...options }

    return { ...result, cmd }
  } catch (e) {
    return { error: `runNodeCliViaJbWebServer exception: ${e.stack}`, ...options}
  }
}

// shared SSE consumer: posts to startUrl, reads SSE stream via fetch, fetches contentUrl on done
// works in both browser and Node (uses fetch ReadableStream — no EventSource dependency)
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
    buf += decoder.decode(value, { stream: true })
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
    const expressUrl = options.expressUrl || ''
    const { cmd } = buildNodeCliCmd(script, options)
    const result = await streamViaSSE({
      startUrl: `${expressUrl}/run-cli-stream`,
      body: { script, ...options },
      onStatus: chunk => {
        if (!onStatus) return
        const text = typeof chunk === 'string' ? chunk : chunk?.text
        const stream = typeof chunk === 'string' ? 'stderr' : chunk?.stream
        onStatus({ stream, text })
      }
    })
    if (result.error) return { error: result.error, cmd, ...options }
    return { ...result, cmd }
  } catch (e) {
    return { error: `runNodeCliStreamViaJbWebServer exception: ${e.stack}`, ...options }
  }
}

// browser-side bash streaming: feeds line-buffered onStdoutLine/onStderrLine from SSE chunks
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
