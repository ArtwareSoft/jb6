import { dsls } from '@jb6/core'
import './index.js'

const {
  common: { Data, Action }
} = dsls

// client of a public object bucket (GCS/S3/R2, or the localhost serveBucket simulation).
// %$bucketUrl% is the bucket base url - same origin '/bucket' when the page is served by the jb6 web server.
// every op logs its {status, key, size} to bucketLogger, so a test (or a future reader of the logs) sees the
// budget refusals (413 over maxObjectBytes, 507 over maxBucketBytes) exactly as the bucket reported them.
const objectUrl = (bucketUrl, key) => `${bucketUrl || '/bucket'}/${key}`
// a real bucket answers errors in xml, not json - keep its <Code>/<Message> as the error instead of throwing on
// parse, so a refusal (403 on a read-only bucket, 413 over budget) reads as one line in the ui and in the log
const bucketResult = async response => {
  const text = await response.text()
  try { return JSON.parse(text) } catch (notJson) {
    const tag = name => (text.match(new RegExp(`<${name}>([^<]*)</${name}>`)) || [])[1]
    return { error: [tag('Code'), tag('Message')].filter(Boolean).join(': ') || text.slice(0, 120) }
  }
}

Action('bucket.put', {
  description: 'store an object in the bucket, returns {ok, status, key, size, usage, limits}',
  params: [
    {id: 'key', as: 'string', mandatory: true, description: 'object key, e.g. forms/homer@springfield.com.json'},
    {id: 'object', dynamic: true, defaultValue: '%%'},
    {id: 'bucketUrl', as: 'string', defaultValue: '%$bucketUrl%'}
  ],
  impl: async (ctx, {bucketLogger}, {key, object, bucketUrl}) => {
    const url = objectUrl(bucketUrl, key)
    const response = await fetch(url, {method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(object(ctx))})
    const result = await bucketResult(response)
    bucketLogger?.info?.({t: 'put', url, status: response.status, ...result}, {}, {ctx})
    return {ok: response.ok, status: response.status, ...result}
  }
})

Data('bucket.get', {
  description: 'read a json object from the bucket, null when there is no such object',
  params: [
    {id: 'key', as: 'string', mandatory: true},
    {id: 'bucketUrl', as: 'string', defaultValue: '%$bucketUrl%'}
  ],
  impl: async (ctx, {bucketLogger}, {key, bucketUrl}) => {
    const url = objectUrl(bucketUrl, key)
    const response = await fetch(url).catch(error => ({ok: false, status: 0, text: () => error.message}))
    const result = await bucketResult(response)
    const logEntry = {t: 'get', url, status: response.status, found: !!response.ok, ...(response.ok ? {} : {error: result.error})}
    response.ok ? bucketLogger?.info?.(logEntry, {}, {ctx}) : bucketLogger?.error?.(logEntry, {}, {ctx})
    return response.ok ? result : null
  }
})

Data('bucket.list', {
  description: 'the objects under a key prefix with the bucket usage and limits',
  params: [
    {id: 'prefix', as: 'string'},
    {id: 'bucketUrl', as: 'string', defaultValue: '%$bucketUrl%'}
  ],
  impl: async (ctx, {bucketLogger}, {prefix, bucketUrl}) => {
    const url = `${bucketUrl || '/bucket'}?prefix=${encodeURIComponent(prefix)}`
    const response = await fetch(url)
    const result = await bucketResult(response)
    bucketLogger?.info?.({t: 'list', url, status: response.status, objects: result.objects?.length, usage: result.usage}, {}, {ctx})
    return result
  }
})

Action('bucket.append', {
  description: `DEMO ONLY. appends one json line to a .jsonl object by read-concat-write, since a bucket is a
plain object store with no append. the read-modify-write has no locking, so two concurrent appends lose a line -
a knowing bug, acceptable for a demo and not for anything else. in production the append belongs on the server:
the endpoint that authorizes the write serializes the lines (or composes objects) and the page only posts to it`,
  params: [
    {id: 'key', as: 'string', mandatory: true, description: 'e.g. data/requests.jsonl'},
    {id: 'object', dynamic: true, defaultValue: '%%'},
    {id: 'bucketUrl', as: 'string', defaultValue: '%$bucketUrl%'}
  ],
  impl: async (ctx, {bucketLogger}, {key, object, bucketUrl}) => {
    const url = objectUrl(bucketUrl, key)
    const current = await fetch(url)
    const text = (current.ok ? await current.text() : '') + JSON.stringify(object(ctx)).replace(/\n/g, ' ') + '\n'
    const response = await fetch(url, {method: 'PUT', headers: {'Content-Type': 'text/plain'}, body: text})
    const result = await bucketResult(response)
    const lines = text.split('\n').filter(Boolean).length
    bucketLogger?.info?.({t: 'append', url, status: response.status, ...result, lines}, {}, {ctx})
    return {ok: response.ok, status: response.status, ...result, lines}
  }
})

Action('bucket.delete', {
  params: [
    {id: 'key', as: 'string', mandatory: true},
    {id: 'bucketUrl', as: 'string', defaultValue: '%$bucketUrl%'}
  ],
  impl: async (ctx, {bucketLogger}, {key, bucketUrl}) => {
    const url = objectUrl(bucketUrl, key)
    const response = await fetch(url, {method: 'DELETE'})
    const result = await bucketResult(response)
    bucketLogger?.info?.({t: 'delete', url, status: response.status, ...result}, {}, {ctx})
    return result
  }
})
