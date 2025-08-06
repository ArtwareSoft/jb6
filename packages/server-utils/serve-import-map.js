import path from 'path'
import fs from 'fs/promises'
import { coreUtils } from '@jb6/core'
import '@jb6/core/misc/import-map-services.js'    // Keep old implementation available
import '@jb6/core/misc/import-map-services.js'   // NEW: Import new services

const { calcImportMap, getStaticServeConfig, calcRepoRoot } = coreUtils

export async function serveImportMap(app, {express}) {
  // NEW IMPLEMENTATION using new service
  try {
    const repoRoot = await calcRepoRoot()
    const {importMap, staticMappings} = await getStaticServeConfig(repoRoot)
    console.log('NEW: serving', staticMappings)
    
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
    // app.get('/import-map.json', (_req, res) => res.json(importMap))
    // app.get('/staticMappings', async (req, res) => {
    //   res.status(200).send(staticMappings)
    // })
  } catch (error) {
    console.error('error:', error)    
  }
}


