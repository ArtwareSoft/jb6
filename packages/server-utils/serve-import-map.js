import path from 'path'
import fs from 'fs/promises'
import { coreUtils, jb } from '@jb6/core'
import '@jb6/core/misc/jb-cli.js'
//import '@jb6/core/misc/jb-vm.js'
import '@jb6/core/misc/import-map-services.js'
import child from 'child_process'

const { getStaticServeConfig, calcRepoRoot, runNodeCli, runBashScript, calcHash, getOrCreateVm} = coreUtils

jb.serverUtils = {serveImportMap, serveCli, serveGotoSource}
export const { serverUtils } = jb

async function serveImportMap(app, {express}) {
  try {
    const repoRoot = await calcRepoRoot()
    const {importMap, staticMappings} = await getStaticServeConfig(repoRoot)
    console.log('staticMappings', staticMappings)
    
    for (const {urlPath, diskPath} of staticMappings) {
      app.use(urlPath, async (req, res, next) => {
        if (!req.path.endsWith('.html')) return next()
        try {
          const html = await fs.readFile(path.join(diskPath, req.path), 'utf8')
          const htmlToSend = html.replace(/JB_IMPORT_MAP/g, JSON.stringify(importMap))
          return res.type('html').send(htmlToSend)
        } catch (err) {
          console.log(err)
          return next()
        }
      })
    
      app.use(urlPath, express.static(diskPath))
    }
  } catch (error) {
    console.error('error:', error)    
  }
}
 
function serveCli(app) {
  app.post('/run-cli', async (req, res) => {
    if (!req.body) {
      res.status(200).json({ error: 'no body in req' })
      return
    }
    const { script, ...options } = req.body
    const result = await runNodeCli(script, options)
    res.status(200).json({ result })
  })

  app.post('/run-bash', async (req, res) => {
    const { script } = req.body
    const result = await runBashScript(script)
    res.status(200).json({ result })
  })
}

function serveGotoSource(app) {
  app.get('/gotoSource', (req, res) => {
    const open_editor_cmd = process.env.open_editor_cmd || 'code -r -g '
    const cmd = [open_editor_cmd,req.query.filePos].join(' ').replace(/jb6_packages/g,'packages')
    console.log(cmd)
    child.exec(cmd,{})
    res.status(200).send('cmd')
  })
}


