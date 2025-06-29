import { jb } from '@jb6/repo'
import '../utils/core-utils.js'
import '../utils/jb-expression.js'
import '../utils/jb-args.js'
import '../utils/jb-core.js'
import '../utils/tgp.js'
const { coreUtils } = jb

const { logException, logError, isNode } = coreUtils
Object.assign(coreUtils, {runNodeCli, runNodeCliViaJbWebServer, runCliInContext})

async function runCliInContext(script, {requireNode, importMap} = {}) {
  let res = {}
  if (!isNode && !requireNode)
    res = await runCliInIframe(script, {importMap})
  else if (!isNode && requireNode)
    res = await  runNodeCliViaJbWebServer(script, {importMap})
  else
    res = await runNodeCli(script, {importMap})
  return res
}

async function runNodeCli(script, {importMap} = {}) {
  const { execFile } = await import('child_process')
  const cwd = importMap?.projectRoot || ''
  const args = ['--input-type=module', '-e', script]
  const cmd = process.execPath + ' ' + args.map(a => JSON.stringify(a)).join(' ')
  const { error, stdout } = await new Promise(res =>
    execFile(process.execPath, args, { cwd, encoding: 'utf8' }, (err, out) =>
      res({ error: err, stdout: out })
    )
  )
  if (error) {
    logException(error, 'error in run node cli', { cmd, importMap, stdout })
    return { error, cmd, importMap }
  }
  try {
    const result = JSON.parse(stdout)
    return { result, cmd, importMap }
  } catch (e) {
    logException(e, 'error in run node cli', { cmd, importMap, stdout })
    return { error: e, cmd, importMap }
  }
}

async function runNodeCliViaJbWebServer(script, {importMap, expressUrl = ''} = {}) {
  try { 
    const res = await fetch(`${expressUrl}/run-cli`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script, importMap })
    })
    if (!res.ok) {
      const text = await res.text()
      return { error: `runNodeCliViaJbWebServer failed: ${res.status} – ${text}`}
    }
    
    const { result, error } = await res.json()
    if (error) 
      return { error }

    return result
  } catch (e) {
    return { error: `runNodeCliViaJbWebServer exception: ${e.message}`}
  }
}

async function runCliInIframe(script, {importMap} = {}) {
  const cliId = 'cli_' + Math.random().toString(36).slice(2)

  return new Promise( resolve => {
    const iframe = document.createElement('iframe')
    iframe.style.display = 'none'

    function onMsg(e) {
      if (e.source === iframe.contentWindow && e.data?.cliId === cliId) {
        console.log('runCliInIframe',e)
        window.removeEventListener('message', onMsg)
        document.body.removeChild(iframe)

        //if (e.data.error) console.error(e.data.error)
        return resolve({ result: e.data.result, error: e.data.error, cmd: 'iframe' })
      }
    }
    window.addEventListener('message', onMsg)

    //const importMap = document.querySelector('script[type="importmap"]')?.outerHTML || ''

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <script type="importmap">
        ${JSON.stringify(importMap,null,2)}
        </script>
      <script type="module">
            const cliId = '${cliId}'
            const send = msg => parent.postMessage({ cliId, ...msg }, '*')

            globalThis.process = {
              stdout: {
                write: s => {
                  try {
                    send({ result: JSON.parse(s) })
                  } catch {
                    send({ result: s })
                  }
                }
              },
              exit: code => {}
            }

            console.error = (...args) => send({ error: args.map(String).join(' ') })
            console.log = (...args) => send({ log: args.map(String).join(' ') })
        </script>
      </head>
      <body>
        <script type="module">
            ${script}
        </script>
      </body>
      </html>
    `
    iframe.srcdoc = html
    document.body.appendChild(iframe)
  })
}

