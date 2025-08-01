import path from 'path'
import fs from 'fs/promises'
import { coreUtils } from '@jb6/core'
import '@jb6/core/misc/calc-import-map.js'
const { calcImportMap } = coreUtils

export async function serveImportMap(app, {express}) {
  const {imports, serveEntries} = await calcImportMap()
  console.log('serving',serveEntries)
  for (const {urlPath, pkgDir} of serveEntries) {
    app.use(urlPath, async (req, res, next) => {
      if (!req.path.endsWith('.html')) return next()
      try {
        const html = await fs.readFile(path.join(pkgDir, req.path), 'utf8')
        const htmlToSend = html.replace(/JB_IMPORT_MAP/, JSON.stringify({imports}))
        return res.type('html').send(htmlToSend)
      } catch (err) {
        console.log(err)
        return next()
      }
    })
  
    app.use(urlPath, express.static(pkgDir))
  }
  app.get('/import-map.json', (_req, res) => res.json({ imports }))
  app.get('/serveEntries', async (req, res) => {
    res.status(200).send(serveEntries)
  })
}


