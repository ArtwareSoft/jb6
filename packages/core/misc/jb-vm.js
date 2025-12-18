import fs from 'fs'
import vm from 'node:vm'

import https from 'node:https'
import http from 'node:http'

import { jb } from '@jb6/repo'
import './import-map-services.js'

const { coreUtils } = jb
const {resolveWithImportMap, calcImportData, logError } = coreUtils
Object.assign(coreUtils, { getOrCreateVm })

const vmCache = {}

async function getOrCreateVm(options) {
    const { vmId, resources} = options
    if (vmId && vmCache[vmId]) return vmCache[vmId]
    const importData = resources ? await calcImportData(resources) : options
    const {importMap, staticMappings } = importData
    if (!importMap) {
        console.error('can not calc importMap',importData, resources,options)
        return 
    }

    const moduleCache = new Map()
    const vmCleanup = []
    const builtInModules = {}

    function calcSpecifierUrl(specifier, referrer = {}) {
        if (/^https?:\/\//.test(specifier) || builtInModules[specifier]) return specifier
        const fixRelative = specifier[0] == '.' ? safeResolveURL(specifier, referrer.identifier).href : specifier
        const resolved = resolveWithImportMap(fixRelative.replace(/^file:\/\//,''), importMap, staticMappings)
        if (!resolved) {
            console.error('can not resolve', specifier, fixRelative, referrer.identifier, referrer)
            return ''
        }
        return safeResolveURL(resolved.startsWith('file://') ? resolved : ('file://' + resolved)).href
    }

    function loadModule(identifier, context, {fileContent, referrer} = {}) {
        if (!identifier)
            debugger
        if (moduleCache.has(identifier)) {
            //console.log('♻️ Reusing cached module', identifier)
            return moduleCache.get(identifier)
        }
        
        //console.log('📦 Creating new module', identifier)
        try {
            let mod
            if (builtInModules[identifier]) {
                mod = new vm.SyntheticModule(
                    Object.keys(builtInModules[identifier]), // export names
                    function init() {
                      for (const [key, value] of Object.entries(builtInModules[identifier]))
                        this.setExport(key, value)
                    },
                    { context, identifier }
                  )
            } else {
                try {
                    const source = fileContent || fs.readFileSync(safeResolveURL(identifier), 'utf8')
                    mod = new vm.SourceTextModule(source, { identifier, context,
                        importModuleDynamically: (specifier, referrer) => importModuleDynamically (context, specifier, referrer)
                    })
                } catch(error) {
                    console.log(`can not find module ${identifier} from '${referrer?.identifier}'`)
                    return new vm.SyntheticModule([], () => {}, { context, identifier: `error loading module ${identifier} from ${referrer?.identifier}` })
                }
            }
            moduleCache.set(identifier, mod)
            return mod
        } catch (error) {
            console.log(error.stack)
        }
    }

    function linker(specifier, referrer) {
        //console.log('linker', specifier, referrer.identifier)
        const childId = calcSpecifierUrl(specifier,referrer)
        const res = childId && loadModule(childId, referrer.context, {fileContent: '', referrer})
        if (!res)
            return new vm.SyntheticModule([], () => {}, { context, identifier: `error calculating url for ${specifier} from ${referrer?.identifier}` })
        return res
    }

    async function importModuleDynamically (context, specifier, referrer) {
        const resolvedId = calcSpecifierUrl(specifier, referrer)
        if (!resolvedId) 
            throw new Error(`Cannot resolve dynamic import '${specifier}' from '${referrer?.identifier}'`)
    
        const content = /^https?:\/\//.test(resolvedId) && await fetchRemoteCode(resolvedId)
        const child = loadModule(resolvedId, context, { fileContent: content, referrer})
        if (child.status === 'unlinked')
            await child.link(linker)

        await child.evaluate()
        return child.namespace    
    }

    async function init() {
        const httpRequests = {}
        const builtIn = options.builtIn || {}
        await Promise.all(Object.entries(builtIn || {}).filter(e=>typeof e[1] == 'string').map( async e => {
            builtIn[e[0]] = await import(e[1])
            builtInModules[e[1]] = builtIn[e[0]] = builtIn[e[0]].default || builtIn[e[0]]
        }))

        const context = vm.createContext({ 
            console, vmId, httpRequests, setTimeout, clearTimeout, setInterval, clearInterval, process, AbortController,
            URLSearchParams, atob, gc, performance, URL, calcSpecifierUrl, Buffer,
            fetch,
            vmCleanup, builtIn, __repoRoot: globalThis.__repoRoot })
        const {entryFiles} = await coreUtils.calcImportData(resources)
        const initCode = ['import { jb } from "@jb6/core"', "globalThis.jb = jb",entryFiles.map(e=>`import '${e}'`)].join('\n')
        const mod = await loadModule(vmId || 'entryScript', context , {fileContent: initCode, displayErrors: true })
        await mod.link(linker)
        await mod.evaluate()

        async function evalScript(code) {
            try {
                const reqId = '' + Math.floor(10000000 + Math.random() * 90000000)
                const withReqId = `globalThis.reqId = '${reqId}'; \n${code}`
                return vm.runInContext(withReqId,context, {filename: `evalScript-${reqId}`, displayErrors: true, 
                    importModuleDynamically: (specifier, referrer) => importModuleDynamically (context, specifier, referrer)})
            } catch(e) {
                logError('error evaluating script', {code, e})
            }
        }
        
        function destroy() {
           moduleCache.clear()
           delete vmCache[vmId]
           vmCleanup.forEach(f=>f())
           for (const k of Object.keys(context)) delete context[k]
           context.globalThis = null
           gc()
        }

        return { context, httpRequests, evalScript, destroy }
    }

    const entry = await init()
    return vmCache[vmId] = {vmId, ...entry}
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