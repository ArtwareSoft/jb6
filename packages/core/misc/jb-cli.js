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
Object.assign(coreUtils, {runNodeCli, runNodeCliViaJbWebServer, runCliInContext, runBashScript})

Data('bash', {
  params: [
    {id: 'script', as: 'text' }
  ],
  impl: (ctx, {script}) => runBashScript(script)
})

async function runCliInContext(script, options) {
  let res = {}
  if (!isNode)
    res = await  runNodeCliViaJbWebServer(script, options)
  else
    res = await runNodeCli(script, options)
  return res
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

async function runNodeCli(script, { projectDir: cwd} = {}) {
  const {spawn} = await import('child_process')
  const cmd = `node --inspect-brk --input-type=module -e "${script.replace(/"/g, '\\"')}"`
  const scriptToRun = `console.log = () => {};\n${script}`
  return new Promise(resolve => {
    let out = '', err = ''
    try {
      const child = spawn('/bin/node', ['--input-type=module', '-e', scriptToRun], {cwd, encoding: 'utf8'})
      child.stdout.on('data', d => out += d)
      child.stderr.on('data', d => err += d)
      child.on('close', code => {
        if (code !== 0) {
          const error = Object.assign(new Error(`Exit ${code}`), {stdout: out, stderr: err})
          logException(error, 'error in run node cli', {cmd, ...options, cwd, stdout: out})
          return resolve({error, cmd, cwd})
        }
        try {
          const result = JSON.parse(out)
          resolve({result, cmd, cwd})
        } catch (e) {
          resolve({error: e, cmd, ...options, cwd})    
        }
      })
    } catch(e) {
      logException(e, 'error in run node cli', {cmd, ...options, cwd})
      resolve({error: e, cmd, ...options, cwd})
    }
  })
}

async function runNodeCliViaJbWebServer(script, options = {}) {
  try { 
    const expressUrl = options.expressUrl || ''
    const cmd = `node --inspect-brk --input-type=module -e "${script.replace(/"/g, '\\"')}"`
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


