const path            = require('path')
const { pathToFileURL } = require('url')
const { realpath } = require('fs/promises')

async function activate(context) {
  const vscode = require('vscode')
  const { workspace, window } = vscode
  const channel = window.createOutputChannel('jbart')
  context.subscriptions.push(channel)

  globalThis.VSCodeStudioExtensionRoot = context.extensionPath
  globalThis.VSCodeStudioExtensionRootLinked = path.dirname(await realpath(VSCodeStudioExtensionRoot + '/node_modules/@jb6/repo'))

  const folders = workspace.workspaceFolders
  globalThis.VSCodeWorkspaceProjectRoot = folders?.[0]?.uri.fsPath

  const vsCodelog = line => channel.appendLine(line)

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
    vsCodelog(args.map(arg =>
      typeof arg === 'object' ? safeStringify(arg) : String(arg)
    ).join(' '))
    
  globalThis.vscodeNS       = vscode
  globalThis.requireResolve = path => require.resolve(path)

  vsCodelog('🔄 jbart extension starting…')
  try {
    const { doActivate } = await import(pathToFileURL(path.join(__dirname, 'tgp-lang-extension.mjs')).href)
    doActivate(context)
  } catch (err) {
    vsCodelog('❌ failed to load ESM extension:')
    vsCodelog(err.stack)
    throw err
  }
}

module.exports = { activate }
