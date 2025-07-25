import { coreUtils } from '@jb6/core'
import '@jb6/core/misc/calc-import-map.js'
const { calcImportMap } = coreUtils

export async function serveImportMap(app, {express}) {
  const {imports, serveEntries} = await calcImportMap()
  console.log('serving',serveEntries)
  for (const {urlPath, pkgDir} of serveEntries) {
    app.use(urlPath, express.static(pkgDir))
  }
  app.get('/import-map.json', (_req, res) => res.json({ imports }))
  app.get('/serveEntries', async (req, res) => {
    res.status(200).send(serveEntries)
  })
}


