const path            = require('path')
const { pathToFileURL } = require('url')

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
  globalThis.console.error = globalThis.console.log

  globalThis.vscodeNS       = vscode
  globalThis.VSCodeRequire  = require

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
