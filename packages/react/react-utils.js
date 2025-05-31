import { jb } from '@jb6/core'
import './lib/tailwind-4.js'
import { icons } from './lib/lucide-04.js'
export const reactUtils = jb.reactUtils = { h, L, waitForReact }

let reactPromise
function waitForReact() {
  if (!reactPromise) {
    const urls = [
      '/packages/react/lib/react.development.js',
      '/packages/react/lib/react-dom.development.js'
    ]
    reactPromise = Promise.all(urls.map(src => new Promise((resolve, reject) => {
      let s = document.head.querySelector(`script[src="${src}"]`)
      if (s) return resolve()
      s = document.createElement('script')
      s.src = src
      s.onload = resolve
      s.onerror = () => reject(new Error(`Failed to load ${src}`))
      document.head.appendChild(s)
    }))).then(() => React)
  }
  return reactPromise
}

waitForReact().then(React => {
  const { useState, useEffect, useRef, useContext } = React
  Object.assign(reactUtils, { useState, useEffect, useRef, useContext, ReactDOM })
})

function h(t, p = {}, ...c){
  let [tag,cls]= typeof t==="string" ? t.split(/:(.+)/) : [t]
  if (tag == 'L') {
    tag = L(cls)
    cls = ''
  }
  if (c && c[0] && Array.isArray(c[0]) && c[0][0]?.key == null)
    c = [...c[0],...c.slice(1)]

  const className=[p.className,cls].filter(Boolean).join(' ').trim()
  return React.createElement(tag,className ? {...p,className} : p,...c)
}

const toPascal = s => s.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join('')

function L(iconName) {
  const icon = icons[toPascal(iconName)] || icons.ShieldQuestion
  
  return function LucideIcon(props) {
    const { size, width, height, color, stroke, strokeWidth, ...restProps } = props
    
    return React.createElement(
      'svg',
      {
        xmlns: 'http://www.w3.org/2000/svg',
        width: width || size || '24',
        height: height || size || '24',
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: stroke || color || 'currentColor',
        strokeWidth: strokeWidth || '2',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        ...restProps
      },
      icon.map((item, index) => React.createElement(item[0],{ key: index, ...item[1]}))
    )
  }
}