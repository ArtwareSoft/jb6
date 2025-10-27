import fs from 'fs'
import vm from 'node:vm'

import https from 'node:https'
import http from 'node:http'
import module from 'node:module'
import { createRequire } from 'node:module'

const nodeRequire = createRequire(import.meta.url)

function isBuiltin(specifier) {
  return module.builtinModules.includes(specifier)
}

function isBuiltinOrNpm(specifier) {
    return isBuiltin(specifier) || (!specifier.startsWith('file://') && !specifier.startsWith('http') && !specifier.startsWith('@') && !specifier.startsWith('.'))
}

import { jb } from '@jb6/repo'
import './import-map-services.js'

const { coreUtils } = jb
const {resolveWithImportMap, calcImportData, logError } = coreUtils
Object.assign(coreUtils, { getOrCreateVm })

const vmCache = {}

async function getOrCreateVm(options) {
    const { vmId, resources} = options
    if (vmId && vmCache[vmId]) return vmCache[vmId]
    const {importMap, staticMappings } = resources ? await calcImportData(resources) : options

    const moduleCache = new Map()

    function calcIdentifierUrl(specifier, referrer = {}) {
        //if (isBuiltinOrNpm(specifier)) return specifier
        const fixRelative = specifier[0] == '.' ? safeResolveURL(specifier, referrer.identifier).href : specifier
        const resolved = resolveWithImportMap(fixRelative.replace(/^file:\/\//,''), importMap, staticMappings)
        if (!resolved) {
            debugger
            console.error('can not resolve', specifier, fixRelative, referrer.identifier, referrer)
        }
        return safeResolveURL(resolved.startsWith('file://') ? resolved : ('file://' + resolved)).href
    }

    function loadModule(identifier, context, {fileContent} = {}) {
        if (!identifier)
            debugger
        if (moduleCache.has(identifier)) {
            console.log('♻️ Reusing cached module', identifier)
            return moduleCache.get(identifier)
        }
        
        console.log('📦 Creating new module', identifier)
        try {
            // if (isBuiltinOrNpm(identifier)) {
            //     console.log('🔧 built in or npm', identifier)
            //     return (async() => {
            //         const exports = await import(identifier) // use the global await ...
            //         const fakeModule = { namespace: exports, link: () => {}, evaluate: () => {} }
            //         moduleCache.set(identifier, fakeModule)
            //         return fakeModule    
            //     })()
            // }
    
            const source = fileContent || fs.readFileSync(safeResolveURL(identifier), 'utf8')

            const mod = new vm.SourceTextModule(source, { identifier, context,
                // initializeImportMeta(meta) {
                //     meta.url = identifier;
                // },
                importModuleDynamically: async (specifier, referrer) => {
                    const content = /^https?:\/\//.test(specifier) && await fetchRemoteCode(specifier)
                    const child = loadModule(calcIdentifierUrl(specifier, referrer), context, {fileContent: content })
                    await child.link(linker)
                    await child.evaluate()
                    return child.namespace
                }
            })

            moduleCache.set(identifier, mod)
            return mod
        } catch (e) {
            console.log(e)
        }
    }

    function linker(specifier, referrer) {
        console.log('linker', specifier, referrer.identifier)
        const childId = calcIdentifierUrl(specifier,referrer)
        return loadModule(childId, referrer.context, {fileContent: ''})
    }

    async function init() {
        const httpRequests = {}

        const JSDOM = options.resources?.JSDOM && (await import('jsdom')).JSDOM

        const context = vm.createContext({ console, httpRequests, setTimeout, clearTimeout, setInterval, clearInterval, process, JSDOM })
        const {entryFiles} = await coreUtils.calcImportData(resources)
        const initCode = ['import { jb } from "@jb6/core"', "globalThis.jb = jb",entryFiles.map(e=>`import '${e}'`)].join('\n')
        const mod = await loadModule(vmId || 'entryScript', context , {fileContent: initCode, displayErrors: true })
        await mod.link(linker)
        await mod.evaluate()

        async function evalScript(code) {
            try {
                const reqId = '' + Math.floor(10000000 + Math.random() * 90000000)
                const withReqId = `globalThis.httpReqId = '${reqId}'; \n${code}`
                return vm.runInContext(withReqId,context, {filename: `evalScript-${reqId}`, displayErrors: true})
            } catch(e) {
                logError('error evaluating script', {code, e})
            }
        }
        async function runHttpRequest(script, req, res) {
            const reqId = '' + Math.floor(10000000 + Math.random() * 90000000)
            httpRequests[reqId] = { req, res }
            const fileContent = `
                const httpReqId = '${reqId}'
                ${script}`
            const mod = await loadModule(reqId, context , {fileContent })
            await mod.link(linker)
            try {
                const result = await mod.evaluate()
                delete httpRequests[reqId]
                return result
            } catch(e) {
                logError('error evaluating httpReq', e)
            }
        }

        return { context, runHttpRequest, httpRequests, evalScript }
    }

    const entry = await init()
    return {vmId, ...entry}
}

async function fetchRemoteCode(url) {
  return new Promise((resolve, reject) => {
    const getter = url.startsWith('https:') ? https.get : http.get
    getter(url, (res) => {
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} ${url}`))
      let data = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => resolve(data))
    }).on('error', reject)
  })
}

function safeResolveURL(specifier, base) {
    try {
      return new URL(specifier, base)
    } catch (e) {
      debugger
      return { error: e.message, specifier, base }
    }
}