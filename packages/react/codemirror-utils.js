import { dsls } from '@jb6/core'
import { reactUtils } from '@jb6/react'

const {
    react : { ReactComp ,
        'react-comp': { comp }
    }
} = dsls

const CM_VER = '5.65.2'
const cdn = p => `https://cdnjs.cloudflare.com/ajax/libs/codemirror/${CM_VER}${p}`

const loadCss = h =>
  document.querySelector(`link[href="${h}"]`) ||
  document.head.appendChild(Object.assign(document.createElement('link'), {
    rel: 'stylesheet', href: h
  }))

const loadScript = s => new Promise(r => {
  if (document.querySelector(`script[src="${s}"]`)) return r()
  document.head.appendChild(Object.assign(document.createElement('script'), {
    src: s, async: false, onload: r
  }))
})

let _codeMirrorPromise
const codeMirrorPromise = () => _codeMirrorPromise ||= (async () => {
  ['/codemirror.min.css','/addon/dialog/dialog.min.css','/addon/fold/foldgutter.min.css']
    .forEach(p => loadCss(cdn(p)))

  await loadScript(cdn('/codemirror.min.js'))
  await Promise.all([
    '/mode/javascript/javascript.min.js',
    '/mode/xml/xml.min.js',
    '/addon/fold/foldcode.min.js',
    '/addon/fold/foldgutter.min.js',
    '/addon/fold/brace-fold.min.js',
    '/addon/fold/indent-fold.min.js',
    '/addon/fold/comment-fold.min.js'
  ].map(p => loadScript(cdn(p))))

  return window.CodeMirror
})()

Object.assign(reactUtils, { codeMirrorPromise })

ReactComp('CodeMirrorJs', {
  impl: comp({
    hFunc: (ctx, {react: {h, use, useRef, useEffect}}) => ({ code, onCursorActivity }) => {
        const CodeMirror = use(codeMirrorPromise())
        const host = useRef()
        const cm = useRef()
      
        useEffect(() => {
          cm.current ||= CodeMirror(host.current, { value: code, mode: 'javascript', readOnly: true, lineNumbers: true })
          onCursorActivity && cm.current.on('cursorActivity', () => onCursorActivity(cm.current))
        }, [])
      
        useEffect(() => { cm.current?.setValue(code) }, [code])
      
        return h('div:h-full', { ref: host })    
      }
  })
})
  
