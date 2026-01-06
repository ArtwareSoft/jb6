import { jb } from '@jb6/repo'
import '../utils/core-utils.js'
import '../utils/jb-expression.js'
import '../utils/jb-args.js'
import '../utils/jb-core.js'
import '../utils/tgp.js'
const { coreUtils } = jb

const {
  common: { Data }
} = jb.dsls
const { logException, logError, isNode } = coreUtils
Object.assign(coreUtils, {runNodeCli, runNodeCliViaJbWebServer, runCliInContext, runBashScript, runNodeCliStreamViaJbWebServer, buildNodeCliCmd})

function buildNodeCliCmd(script, options = {}) {
  options.importMapsInCli = options.importMapsInCli || jb.coreRegistry.importMapsInCli
  const importParts = options.importMapsInCli ? ['--import', options.importMapsInCli] : []
  const cmd = `node --inspect-brk --experimental-vm-modules --expose-gc --input-type=module ${importParts.join(' ')} -e "${script.replace(/\$/g, '\\$').replace(/"/g, '\\"')}"`
  return { cmd, importParts }
}

Data('bash', {
  params: [
    {id: 'script', as: 'text' }
  ],
  impl: (ctx, {}, {script}) => runBashScript(script)
})

async function runCliInContext(script, options, onStatus) {
  let res = {}
  if (!isNode && onStatus)
    res = runNodeCliStreamViaJbWebServer(script, options = {}, onStatus)
  else if (!isNode)
    res = await runNodeCliViaJbWebServer(script, options)  
  else
    res = await runNodeCli(script, options, onStatus)
  return res
}

async function runNodeCli(script, options = {}, onStatus) {
  const {spawn} = await import('child_process')
  const { cmd, importParts } = buildNodeCliCmd(script, options)
  const cwd = options.projectDir
  const scriptToRun = `console.log = () => {};\nconsole.error = () => {};\n${script}`

  return new Promise(resolve => {
    let out = '', err = ''
    try {
      const child = spawn(process.execPath, ['--experimental-vm-modules', '--expose-gc', '--input-type=module', ...importParts, '-e', scriptToRun], {cwd })
      child.stdout.on('data', d => out += d)
      child.stderr.on('data', d => {
        const text = '' + d
        err += text
        onStatus && onStatus(text)
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
          resolve({err: 'json parse error', error: e.message || e, cmd, cwd, textToParse: out, stderr: err})
        }
      })
    } catch(e) {
      logException(e, 'error in run node cli stream', {cmd, cwd})
      resolve({error: e, cmd, cwd})
    }
  })
}

async function runNodeCliViaJbWebServer(script, options = {}) {
  try { 
    const expressUrl = options.expressUrl || ''
    const { cmd } = buildNodeCliCmd(script, options)
    const res = await fetch(`${expressUrl}/run-cli`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script, ...options })
    })
    if (!res.ok) {
      const text = await res.text()
      return { error: `runNodeCliViaJbWebServer failed: ${res.status} – ${text}`, ...options}
    }
    
    const { result, error } = await res.json()
    if (error) 
      return { error, cmd, ...options }

    return { ...result, cmd }
  } catch (e) {
    return { error: `runNodeCliViaJbWebServer exception: ${e.message}`, ...options}
  }
}

async function runNodeCliStreamViaJbWebServer(script, options = {}, onStatus) {
  try {
    const expressUrl = options.expressUrl || ''
    const { cmd } = buildNodeCliCmd(script, options)

    const startRes = await fetch(`${expressUrl}/run-cli-stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script, ...options })
    })
    if (!startRes.ok) {
      const text = await startRes.text()
      return { error: `runNodeCliStreamViaJbWebServer failed: ${startRes.status} – ${text}`, ...options }
    }

    const { statusUrl, contentUrl, error } = await startRes.json()
    if (error) return { error, cmd, ...options }

    // stream status (SSE)
    const es = new EventSource(statusUrl)
    es.onmessage = ev => {
      try {
        const msg = JSON.parse(ev.data)
        if (msg.type === 'status' && onStatus) onStatus(msg.text)
        if (msg.type === 'done') es.close()
      } catch (e) {}
    }

    // poll for result
    while (true) {
      const r = await fetch(contentUrl)
      if (r.status === 202) { await new Promise(x => setTimeout(x, 200)); continue }
      if (!r.ok) {
        const text = await r.text()
        es.close()
        return { error: `runNodeCliStreamViaJbWebServer result failed: ${r.status} – ${text}`, cmd, ...options }
      }
      const final = await r.json()
      es.close()
      return { ...final, cmd }
    }
  } catch (e) {
    return { error: `runNodeCliStreamViaJbWebServer exception: ${e.message}`, ...options }
  }
}


async function runBashScript(script) {
  if (!isNode) {
    const response = await fetch('/run-bash', { method: 'POST', headers: {'Content-Type': 'application/json' }, body: JSON.stringify({ script }) })
    const result = await response.json()
    return result.result
  }
  const {spawn} = await import('child_process')
  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''

    const child = spawn('bash', ['-c', script], { encoding: 'utf8' })
    child.stdout.on('data', data => {
      stdout += data
    })
    child.stderr.on('data', data => {
      stderr += data
    })

    child.on('close', code => {
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