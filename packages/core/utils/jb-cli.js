import { coreUtils } from './core-utils.js'

const { logCli, logError, logException } = coreUtils
Object.assign(coreUtils, {runNodeCli, runNodeCliViaJbWebServer, runCliInContext})

async function runCliInContext(script, {cwd = ''} = {}) {
    const isNode = !globalThis.document
    if (isNode) {
        return runNodeCli(script, {cwd})
    } else {
        return runCliInIframe(script, {cwd})
    }
}

async function runNodeCli(script, {cwd = ''} = {}) {
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

async function runNodeCliViaJbWebServer(script, {cwd = '', expressUrl = ''} = {}) {
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

async function runCliInIframe(userScript, {cwd} = {}) {
  const cliId = 'cli_' + Math.random().toString(36).slice(2)

  return new Promise( resolve => {
    const iframe = document.createElement('iframe')
    iframe.style.display = 'none'

    function onMsg(e) {
      if (e.source === iframe.contentWindow && e.data?.cliId === cliId) {
        window.removeEventListener('message', onMsg)
        document.body.removeChild(iframe)

        if (e.data.error) console.error(e.data.error)
        return resolve(e.data.result)
      }
    }
    window.addEventListener('message', onMsg)

    const importMap = document.querySelector('script[type="importmap"]')?.outerHTML || ''

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        ${importMap}
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
            ${userScript}
        </script>
      </body>
      </html>
    `
    iframe.srcdoc = html
    document.body.appendChild(iframe)
  })
}

