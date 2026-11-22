import path from 'path'
import fsp from 'fs/promises'
import { coreUtils, jb } from '@jb6/core'

const { calcRepoRoot } = coreUtils
jb.serverUtils = jb.serverUtils || {}
Object.assign(jb.serverUtils, { serveBucket })

// localhost stand-in for a public object bucket (GCS/S3/R2): PUT an object, GET it back, list, DELETE.
// the caps (maxObjectBytes, maxBucketBytes) are the budget guard a real public bucket needs - here they
// fail the request with the usage in the body, so a client sees the same refusal shape it would in the cloud.
function serveBucket(app, {express, urlPath = '/bucket', bucketDir, seedFiles = {}, maxObjectBytes = 64 * 1024, maxBucketBytes = 4 * 1024 * 1024} = {}) {
  const limits = { maxObjectBytes, maxBucketBytes }
  let rootPromise

  // a page served from a bucket/cdn is another origin, so the simulation answers its preflight. this is a
  // localhost dev service - a real bucket grants writes per signed url, never to every origin.
  app.use(urlPath, (req, res, next) => {
    res.set({ 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,PUT,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' })
    req.method == 'OPTIONS' ? res.status(204).end() : next()
  })

  app.get(urlPath, async (req, res) => {
    const objects = await listObjects(req.query.prefix || '')
    res.json({ objects, usage: bucketUsage(objects), limits })
  })

  app.get(`${urlPath}/*objectKey`, async (req, res) => {
    const key = keyOfRequest(req)
    if (!key) return res.status(400).json({ error: 'illegal object key', key: rawKeyOfRequest(req) })
    const text = await fsp.readFile(await diskPathOfKey(key), 'utf8').catch(() => null)
    if (text == null) return res.status(404).json({ error: 'no such object', key })
    res.type(contentTypeOfKey(key)).send(text)
  })

  const textParser = express.text({ type: () => true, limit: maxObjectBytes + 1024 })
  const readObjectText = (req, res, next) => textParser(req, res, parseError => parseError
    ? res.status(413).json({ error: 'object over maxObjectBytes', key: keyOfRequest(req), parseError: parseError.type, limits })
    : next())

  app.put(`${urlPath}/*objectKey`, readObjectText, async (req, res) => {
    const key = keyOfRequest(req)
    if (!key) return res.status(400).json({ error: 'illegal object key', key: rawKeyOfRequest(req) })
    const text = objectText(req)
    const size = Buffer.byteLength(text)
    if (size > maxObjectBytes)
      return res.status(413).json({ error: 'object over maxObjectBytes', key, size, limits })
    const objects = await listObjects('')
    const bytesAfterPut = bucketUsage(objects).bytes - (objects.find(o => o.key == key)?.size || 0) + size
    if (bytesAfterPut > maxBucketBytes)
      return res.status(507).json({ error: 'bucket over maxBucketBytes', key, size, bytesAfterPut, limits })
    const diskPath = await diskPathOfKey(key)
    await fsp.mkdir(path.dirname(diskPath), { recursive: true })
    await fsp.writeFile(diskPath, text, 'utf8')
    console.log('bucket PUT', key, size)
    res.json({ key, size, usage: { bytes: bytesAfterPut, objects: objects.some(o => o.key == key) ? objects.length : objects.length + 1 }, limits })
  })

  app.delete(`${urlPath}/*objectKey`, async (req, res) => {
    const key = keyOfRequest(req)
    if (!key) return res.status(400).json({ error: 'illegal object key', key: rawKeyOfRequest(req) })
    const deleted = await fsp.rm(await diskPathOfKey(key)).then(() => true, () => false)
    res.json({ key, deleted })
  })

  function rawKeyOfRequest(req) {
    return [].concat(req.params.objectKey || []).join('/')
  }

  function keyOfRequest(req) {
    const key = rawKeyOfRequest(req)
    const segments = key.split('/')
    const legal = /^[\w][\w.\-/@]{0,119}$/.test(key) && segments.every(segment => segment && segment != '..')
    return legal ? key : ''
  }

  async function bucketRoot() {
    rootPromise = rootPromise || (async () => {
      const repoRoot = await calcRepoRoot()
      const root = bucketDir || path.join(repoRoot, '.local-bucket')
      await fsp.mkdir(root, { recursive: true })
      // seedFiles are the bucket's static data (e.g. cities.json): in the cloud they are uploaded objects,
      // here they are copied in on startup, so a page reads them through %$bucketUrl% in both places
      for (const [key, repoPath] of Object.entries(seedFiles)) {
        const target = path.join(root, key)
        await fsp.mkdir(path.dirname(target), { recursive: true })
        await fsp.copyFile(path.join(repoRoot, repoPath), target)
      }
      return root
    })()
    return rootPromise
  }

  async function diskPathOfKey(key) {
    return path.join(await bucketRoot(), key)
  }

  async function listObjects(prefix) {
    const root = await bucketRoot()
    const walk = async dir => (await Promise.all((await fsp.readdir(dir, { withFileTypes: true })).map(async entry => {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) return walk(full)
      const { size, mtimeMs } = await fsp.stat(full)
      return [{ key: path.relative(root, full).split(path.sep).join('/'), size, updated: mtimeMs }]
    }))).flat()
    return (await walk(root)).filter(object => object.key.startsWith(prefix))
  }
}

function bucketUsage(objects) {
  return { bytes: objects.reduce((sum, object) => sum + object.size, 0), objects: objects.length }
}

function contentTypeOfKey(key) {
  return key.endsWith('.json') ? 'application/json' : key.endsWith('.html') ? 'text/html' : 'text/plain'
}

function objectText(req) {
  return typeof req.body == 'string' ? req.body : req.body == null ? '' : JSON.stringify(req.body)
}
