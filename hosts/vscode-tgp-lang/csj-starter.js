const path            = require('path')
const { pathToFileURL } = require('url')
const { execFile } = require('child_process')

async function activate(context, ...rest) {
  const vscode = require('vscode')
  const channel = vscode.window.createOutputChannel('jbart')
  context.subscriptions.push(channel)

  const logToChannel = line => channel.appendLine(line)

  // safe JSON.stringify wrapper
  function safeStringify(obj) {
    try {
      return JSON.stringify(obj, null, 2)
    } catch {
      if (obj && typeof obj === 'object')
        return `[object with keys: ${Object.keys(obj).join(', ')}]`
      return String(obj)
    }
  }

  // redirect console.log/error globally
  globalThis.jbVSCodeLog = globalThis.console.log = (...args) =>
    logToChannel(args.map(arg =>
      typeof arg === 'object' ? safeStringify(arg) : String(arg)
    ).join(' '))
    
  globalThis.vscodeNS       = vscode
  globalThis.VSCodeRequire  = require

  globalThis.jbVSCodeCli = async (script, {cwd = ''} = {}) => {
    const { workspace, window } = vscode
    const folders = workspace.workspaceFolders
    if (!folders || folders.length === 0) {
      window.showErrorMessage('Open a workspace to compute the import map')
      return { imports: {}, dirEntriesToServe: [] }
    }
    const cwd = folders[0].uri.fsPath
    jbVSCodeLog('calc-import-map cwd:', cwd)

    return new Promise(resolve => execFile( process.execPath, ['--input-type=module', '-e', script], { cwd, encoding: 'utf8' },
        (err, stdout, stderr) => {
          if (stderr) jbVSCodeLog(stderr)
          if (err) {
            jbVSCodeLog(`CLI execution failed: ${stderr || err.message}`)
            return resolve(null)
          }
          try {
            const json = JSON.parse(stdout)
            return resolve(json)
          } catch (e) {
            jbVSCodeLog(`Invalid JSON from CLI: ${stdout}`)
            return resolve(null)
          }
        }
      )
    )
  }

  globalThis.calcImportMapsFromVSCodeExt = async () => {
    const inlineScript = `
  import { coreUtils } from '@jb6/core'
  ;(async()=>{
    try {
      const result = await coreUtils.calcImportMap()
      process.stdout.write(JSON.stringify(result,null,2))
    } catch (e) {
      console.error(e)
    }
  })()`
    return jbVSCodeCli(inlineScript)
  }

  channel.appendLine('🔄 jbart extension starting…')
  try {
    const fileUrl = pathToFileURL(path.join(__dirname, 'tgp-lang-extension.mjs')).href
    channel.appendLine(`Loading ESM from: ${fileUrl}`)
    const { doActivate } = await import(fileUrl)
    doActivate(context)
  } catch (err) {
    channel.appendLine('❌ failed to load ESM extension:')
    channel.appendLine(err.stack)
    throw err
  }
}

module.exports = { activate }
