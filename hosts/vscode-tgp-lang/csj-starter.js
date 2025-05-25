const path            = require('path')
const { pathToFileURL } = require('url')

async function activate(context, ...rest) {
  const vscode = require('vscode')
  const channel = vscode.window.createOutputChannel('jbart')
  context.subscriptions.push(channel)
  channel.appendLine('🔄 jbart extension starting…')
  globalThis.vscodeNS = vscode
  globalThis.jbVSCodeLog = line => channel.appendLine(line)
  globalThis.VSCodeRequire = require
  try {
    const fileUrl = pathToFileURL(path.join(__dirname, 'tgp-lang-extension.mjs')).href
    channel.appendLine(fileUrl)
    const { doActivate } = await import(fileUrl)
    doActivate(context)
 } catch (err) {
    channel.appendLine('❌ failed to load ESM extension:')
    channel.appendLine(err.stack)
    throw err
  }
}

module.exports = { activate }
