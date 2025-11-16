import { dsls, coreUtils, jb } from '@jb6/core'
import '@jb6/core/misc/jb-cli.js'

const {
    common: { Data },
    tgp: { TgpType }
} = dsls

Data('tailwindHtmlToPng', {
  params: [
    {id: 'html', as: 'text', defaultValue: '%%'},
    {id: 'width', as: 'number', defaultValue: 400},
    {id: 'paddingBottom', as: 'number', defaultValue: 10},
  ],
  impl: ({},{},args) => tailwindHtmlToPng(args)
})

jb.tailwindCardUtils = { tailwindHtmlToPng, h }

function h(t, p = {}, ...c){
  let [tag,cls]= typeof t==="string" ? t.split(/:(.+)/) : [t]
  if (c && c[0] && Array.isArray(c[0]) && c[0][0]?.key == null)
    c = [...c[0],...c.slice(1)]

  const className=[p.className,cls].filter(Boolean).join(' ').trim()
  return createElement(tag,className ? {...p,className} : p,...c)
}

function createElement(type, props = {}, ...children) {
  const vdom = { type, props, children }
  vdom.toHtml = () => {
    const attrs = Object.entries(props).map(([k, v]) => ` ${k === 'className' ? 'class' : k}="${v}"`).join('')
    const inner = children.map(c => (typeof c === 'object' ? c.toHtml() : c)).join('')
    return `<${type}${attrs}>${inner}</${type}>`
  }
  return vdom
}

const CHROME_PORT = 9222

function sleep(ms) { return new Promise(res => setTimeout(res, ms)) }

async function isChromeAlive() {
  try {
    const res = await fetch(`http://localhost:${CHROME_PORT}/json/version`, { method: 'GET' })
    return res.ok
  } catch (e) {
    return false
  }
}

async function ensureChromeDaemon(chromeBin) {
  // simple in-process lock so we don’t spawn 10 chromes at once
  if (!globalThis.__ensureChromePromise) {
    globalThis.__ensureChromePromise = (async () => {
      if (await isChromeAlive()) return

      const { spawn } = await import('child_process')
      const child = spawn(chromeBin, [
        '--headless=new', `--remote-debugging-port=${CHROME_PORT}`, '--user-data-dir=/tmp/chrome-profile', '--no-sandbox', '--disable-gpu', '--disable-extensions', '--disable-background-networking',
        '--disable-dev-shm-usage', '--disable-sync', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check' ], { detached: true, stdio: 'ignore'
      })
      child.unref()

      // wait up to ~5s for Chrome to come up
      for (let i = 0; i < 20; i++) {
        if (await isChromeAlive()) return
        await sleep(250)
      }
      throw new Error('Chrome remote-debugging port not responding')
    })().finally(() => {
      globalThis.__ensureChromePromise = null
    })
  }
  return globalThis.__ensureChromePromise
}

let tailwindCompilerPromise

async function getTailwindCompiler(config = {}) {
  if (!tailwindCompilerPromise) {
    tailwindCompilerPromise = (async () => {
      const postcssMod = await import('postcss')
      const twPostcssMod = await import('@tailwindcss/postcss')

      const postcss = postcssMod.default || postcssMod
      const tailwindPostcss = twPostcssMod.default || twPostcssMod

      class TailwindCompiler {
        constructor(cfg = {}) {
          this.cfg = cfg
        }
        async compile(html) {
          const processor = postcss([
            tailwindPostcss({
              ...this.cfg,
              content: [{ raw: html, extension: 'html' }]
            })
          ])

          const result = await processor.process(
            '@tailwind base; @tailwind components; @tailwind utilities;',
            { from: undefined }
          )
          return result.css
        }
      }

      return new TailwindCompiler(config)
    })()
  }
  return tailwindCompilerPromise
}

async function tailwindHtmlToPng(args) {
  const { html, width = 400, paddingBottom = 10 } = args

  if (!coreUtils.isNode) {
    const script = `
      import { coreUtils, jb } from '@jb6/core'
      import '@jb6/react/tailwind-card.js'
      try {
        const result = await jb.tailwindCardUtils.tailwindHtmlToPng(${JSON.stringify(args)})
        await coreUtils.writeServiceResult(result)
      } catch (e) {
        await coreUtils.writeServiceResult(e.message || e)
      }`
    const res = await coreUtils.runNodeCliViaJbWebServer(script)
    return res.result
  }

  const compiler = await getTailwindCompiler()
  const htmlForTailwind = `<body><div id="root">${html}</div></body>`

  const tailwindCss = await compiler.compile(htmlForTailwind)

  const layoutCss = `
    :root {
      color-scheme: light;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
    }
    #root {
      box-sizing: border-box;
      max-width: ${width}px;
      margin: 0 auto;
      padding: 16px 16px ${paddingBottom}px;
      /* optional: make it feel like a card */
      /* background: #ffffff; */
    }
  `
  const finalHTML = `<!doctype html><html><head><meta charset="utf-8"><style>${layoutCss}\n${tailwindCss}</style></head>${htmlForTailwind}</html>`

  const puppeteer = (await import('puppeteer-core')).default
  const chromeBin = process.env.CHROME_BIN || 'google-chrome'
  await ensureChromeDaemon(chromeBin)

  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${CHROME_PORT}`, defaultViewport: null })

  const page = await browser.newPage()
  await page.setJavaScriptEnabled(false)
  await page.setRequestInterception(true)
  page.on('request', r => r.abort())

  await page.setViewport({ width: width + 3, height: 400, deviceScaleFactor: 1 })
  await page.setContent(finalHTML, { waitUntil: 'domcontentloaded' })

  const height = await page.evaluate(() => {
    const root = document.getElementById('root')
    if (!root) return 400
    const rect = root.getBoundingClientRect()
    // bottom = top + height (includes padding)
    return Math.ceil(rect.bottom)
  })

  // Resize to fit content exactly
  await page.setViewport({
    width: width + 3,
    height: Math.max(200, height),
    deviceScaleFactor: 1
  })

  const pngBuffer = await page.screenshot({type: 'png', captureBeyondViewport: false })
  await page.close()

  return { imageUrl: `data:image/png;base64,${pngBuffer.toString('base64')}`, html: finalHTML }
}

