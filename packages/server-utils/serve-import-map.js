import path from 'path'
import fsp from 'fs/promises'
import { coreUtils, jb } from '@jb6/core'
import '@jb6/core/misc/jb-cli.js'
import '@jb6/core/misc/import-map-services.js'
import child from 'child_process'

jb.serverUtils = jb.serverUtils || {}
Object.assign(jb.serverUtils, {serveImportMap, serveGotoSource, serveEditSource})

const { getStaticServeConfig, calcRepoRoot } = coreUtils

async function serveImportMap(app, {express}) {
  try {
    const repoRoot = await calcRepoRoot()
    const {importMap, staticMappings} = await getStaticServeConfig(repoRoot)
    console.log('staticMappings', staticMappings)
    
    for (const {urlPath, diskPath} of staticMappings) {
      app.use(urlPath, async (req, res, next) => {
        if (!req.path.endsWith('.html')) return next()
        try {
          const html = await fsp.readFile(path.join(diskPath, req.path), 'utf8')
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

function serveGotoSource(app) {
  app.get('/gotoSource', (req, res) => {
    const open_editor_cmd = process.env.open_editor_cmd || 'code -r -g '
    const cmd = [open_editor_cmd,req.query.filePos].join(' ').replace(/jb6_packages/g,'packages')
    console.log(cmd)
    child.exec(cmd,{})
    res.status(200).send('cmd')
  })
}

function serveEditSource(app, {express}) {
  let _staticMappings
  app.post('/editSource', express.json(), async (req, res) => {
    try {
      const { filePath, range, newText } = req.body
      const repoRoot = await calcRepoRoot()
      _staticMappings = _staticMappings || (await getStaticServeConfig(repoRoot)).staticMappings
      const mapping = [..._staticMappings].sort((a,b) => b.urlPath.length - a.urlPath.length).find(m => filePath.startsWith(m.urlPath))
      const fullPath = mapping ? path.join(mapping.diskPath, filePath.slice(mapping.urlPath.length)) : path.join(repoRoot, filePath)
      console.log('editSource', { filePath, fullPath, mapping: mapping?.urlPath })
      const content = await fsp.readFile(fullPath, 'utf8')
      const lines = content.split('\n')
      const fromOffset = lines.slice(0, range.start.line).reduce((s, l) => s + l.length + 1, 0) + range.start.col
      const toOffset = lines.slice(0, range.end.line).reduce((s, l) => s + l.length + 1, 0) + range.end.col
      const newContent = content.slice(0, fromOffset) + newText + content.slice(toOffset)
      await fsp.writeFile(fullPath, newContent, 'utf8')
      res.json({ ok: true })
    } catch (e) {
      console.error('editSource error:', e)
      res.status(500).json({ error: e.message })
    }
  })
}


