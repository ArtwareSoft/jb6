import { coreUtils } from '@jb6/core'
const { calcImportMap } = coreUtils

export async function serveImportMap(app, {express}) {
  const {imports, dirEntriesToServe} = await calcImportMap()
  for (const {dir, pkgId, pkgDir} of dirEntriesToServe) {
    app.use(`/packages/${dir}`, express.static(pkgDir))
  }
  app.get('/import-map.json', (_req, res) => res.json({ imports }))
}





