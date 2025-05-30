import { langServiceUtils } from './lang-service-parsing-utils.js'
import { coreUtils } from '@jb6/core'
const { jb, toArray, unique, calcVar, log, isPrimitiveValue, calcValue, Ctx } = coreUtils
const { consts } = jb.coreRegistry

Object.assign(langServiceUtils, { suggestionsOfProbe, applyOption })

function suggestionsOfProbe(probeObj, input, probePath) {
  return new suggestions(input).calcOptions(probeObj,probePath)
}

class suggestions {
    constructor(input) {
      this.input = input
      this.pos = input.selectionStart
      this.text = input.value.substr(0,this.pos).trim().slice(0,100)
      this.text_with_open_close = this.text.replace(/%([^%{}\s><"']*)%/g, (_,x) => `{${x}}`)
      this.exp = rev((rev(this.text_with_open_close).match(/([^\}%]*%)/) || ['',''])[1])
      this.exp = this.exp || rev((rev(this.text_with_open_close).match(/([^\}=]*=)/) || ['',''])[1])
      this.tail = rev((rev(this.exp).match(/([^%.\/=]*)(\/|\.|%|=)/)||['',''])[1])
      this.tailSymbol = this.text_with_open_close.slice(-1-this.tail.length).slice(0,1) // % or /
      if (this.tailSymbol == '%' && this.exp.slice(0,2) == '%$')
        this.tailSymbol = '%$'
      this.base = this.exp.slice(0,-1-this.tail.length) + '%'
      this.inputVal = input.value.slice(0,100)
      this.inputPos = input.selectionStart

      function rev(str) {
        return str.split('').reverse().join('')
      }
    }

    varsOfCtx(probeCtx) {
      const { jbCtx: { args }} = probeCtx  
    
      const vars = [...Object.keys(args || {}), ...Object.keys(probeCtx.vars || {}), ...Object.keys(consts || {})]
      return vars.map(x=> valueOption('$'+x,calcVar(x,probeCtx),[this.pos,this.tail,this.input,this.base]))
    }
    
    calcOptions(probeObj, path) {
      const probeCtx = new Ctx(probeObj.result?.[0]?.in || {})
      const visits = probeObj.visits
      const circuitCmpId = probeObj.circuitCmpId.split('>').pop()

      let options = []
      const nonOptionProps = [this.pos,this.tail,this.input,this.base]

      if (this.tailSymbol == '%')
        options = [...innerPropsOptions(probeCtx.data), ...indexOptions(probeCtx.data), ...this.varsOfCtx(probeCtx) ]
      else if (this.tailSymbol == '%$')
        options = this.varsOfCtx(probeCtx)
      else if (this.tailSymbol == '/' || this.tailSymbol == '.') {
        const baseVal = probeCtx.exp(this.base)
        options = [...innerPropsOptions(baseVal), ...indexOptions(baseVal)]
      }

      options = [
        valueOption('#circuit', circuitCmpId, nonOptionProps),
        valueOption('#visits',''+visits, nonOptionProps),
        valueOption('#data', probeCtx.data, nonOptionProps),
        ...unique(options,x=>x.toPaste)
      ]        
      // if (this.tail != '' && jb.frame.Fuse)
      //   options = new jb.frame.Fuse(options,{keys: ['toPaste','description']}).search(this.tail || '').map(x=>x.item)

      const optionsHash = options.map(o=>o.toPaste).join(',')
      log('suggestions calc',{ sugg: this, options,probeCtx,path })

      return {optionsHash, options}

      function indexOptions(baseVal) {
        return Array.isArray(baseVal) ? baseVal.slice(0,2).map((v,i) => valueOption(''+i,v,nonOptionProps)) : []
      }
      function innerPropsOptions(baseVal) {
        return toArray(baseVal).slice(0,2)
          .flatMap(x=>Object.entries(x).map(x=> valueOption(x[0],x[1],nonOptionProps)))
      }
    }
}

function valueOption(toPaste,value,[pos,tail,input,base]) {
    const detail = valAsText(value)
    const text = [toPaste,detail ? `(${detail})`: ''].filter(x=>x).join(' ')
    return { type: 'value', toPaste, valueType: typeof value, pos,tail, text, input, code: toPaste, detail, base }

    function valAsText(val) {
      if (typeof val == 'string' && val.length > 30)
        return `${val.substring(0,30)}...`
      else if (isPrimitiveValue(val))
        return ''+val
      else if (val == null)
        return 'null'
      else if (Array.isArray(val) && val.every(x=>isPrimitiveValue(x)) && val.length < 4)
        return `[${val.slice(0,3).join(',')}]`
      else if (Array.isArray(val))
        return `${val.length} item${val.length != 1 ? 's' : ''}`
      else if (val && typeof val == 'object')
        return `${Object.keys(val).length} prop${Object.keys(val).length != 1 ? 's' : ''}`
      return typeof value
    }
}

function applyOption(addSuffix, ctx) { // suffix % or /
    const option = calcValue(ctx.vars.selectedOption)
    if (option.type == 'value') {
      const input = option.input
      const primiteVal = typeof option.value != 'object'
      const toPaste = option.toPaste + (primiteVal ? '%' : addSuffix)
      const pos = option.pos + 1
      //const newVal = () => input.value.substr(0,option.pos-option.tail.length) + toPaste + input.value.substr(pos)
      // ctx.runAction({$: 'editableText.setInputState',
      //     assumedVal: () => input.value,
      //     newVal,
      //     selectionStart: pos + toPaste.length,
      // })
      // if (toPaste.match(/%$/))
      //   ctx.runAction(writeValue('%$$model/databind()%', newVal))        
    }
}
