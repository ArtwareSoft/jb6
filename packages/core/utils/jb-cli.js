import { coreUtils } from './core-utils.js'

const { logCli, logError, logException } = coreUtils
Object.assign(coreUtils, {runNodeCli, runNodeCliViaJbWebServer, runCliInContext})

async function runCliInContext(script, cwd = '') {
    const isNode = !globalThis.document
    if (isNode) {
        return runNodeCli(script, cwd)
    } else {
        return runNodeCliViaJbWebServer(script, cwd)
    }
}

async function runNodeCli(script, cwd = '') {
  const { promisify } = await import('util')
  const { execFile: execFileCb } = await import('child_process')
  const execFile = promisify(execFileCb)

  try {
      const { stdout } = await execFile(
        process.execPath,
        ['--input-type=module', '-e', script],
        { cwd, encoding: 'utf8' }
      )
      return JSON.parse(stdout)
  } catch (e) {
      // if execFile succeeded but JSON.parse blew up, it'll be here with e.stdout
      if (e.stdout) {            
        logCli(`can not parse result json: ${e.stdout}`)
      } else {
        logCli(`can not run probe cli: ${e}`)
      }
  }  
}

async function runNodeCliViaJbWebServer(script, cwd = '', expressUrl = '') {
  const res = await fetch(`${expressUrl}/run-cli`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ script, cwd })
  })

  if (!res.ok) {
    const text = await res.text()
    logError(`runNodeCliViaExpress failed: ${res.status} – ${text}`)
  }

  const { result, error } = await res.json()
  if (error) logError(`CLI error: ${error}`)
  return result
}
