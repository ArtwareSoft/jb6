export const prefix = Data('prefix', {
  category: 'string:90',
  params: [
    {id: 'separator', as: 'string', mandatory: true},
    {id: 'text', as: 'string', defaultValue: '%%'}
  ],
  impl: (ctx, {separator, text}) => (text||'').substring(0,text.indexOf(separator))
})

export const suffix = Data('suffix', {
  category: 'string:90',
  params: [
    {id: 'separator', as: 'string', mandatory: true},
    {id: 'text', as: 'string', defaultValue: '%%'}
  ],
  impl: (ctx, {separator, text}) => (text||'').substring(text.lastIndexOf(separator)+separator.length)
})

export const removePrefix = Data('removePrefix', {
  category: 'string:80',
  params: [
    {id: 'separator', as: 'string', mandatory: true},
    {id: 'text', as: 'string', defaultValue: '%%'}
  ],
  impl: (ctx, {separator, text}) => text.indexOf(separator) == -1 ? text : text.substring(text.indexOf(separator)+separator.length)
})

export const removeSuffix = Data('removeSuffix', {
  category: 'string:80',
  params: [
    {id: 'separator', as: 'string', mandatory: true},
    {id: 'text', as: 'string', defaultValue: '%%'}
  ],
  impl: (ctx, {separator, text}) => text.lastIndexOf(separator) == -1 ? text : text.substring(0,text.lastIndexOf(separator))
})

export const removeSuffixRegex = Data('removeSuffixRegex', {
  category: 'string:80',
  params: [
    {id: 'suffix', as: 'string', mandatory: true, description: 'regular expression. e.g [0-9]*'},
    {id: 'text', as: 'string', defaultValue: '%%'}
  ],
  impl: (ctx, {suffix, text}) => {
    ctx.jbCtx.profile.prefixRegexp = ctx.jbCtx.profile.prefixRegexp || new RegExp(suffix+'$');
    const m = (text||'').match(ctx.jbCtx.profile.prefixRegexp);
    return (m && (text||'').substring(m.index+1)) || text;
  }
})

export const matchRegex = Boolean('matchRegex', {
  description: 'validation with regular expression',
  params: [
    {id: 'regex', as: 'string', mandatory: true, description: 'e.g: [a-zA-Z]*'},
    {id: 'text', as: 'string', defaultValue: '%%'}
  ],
  impl: (ctx, {regex, text}) => text.match(new RegExp(regex))
})

export const toUpperCase = Data('toUpperCase', {
  params: [
    {id: 'text', as: 'string', defaultValue: '%%'}
  ],
  impl: (ctx, {text}) => text.toUpperCase()
})

export const toLowerCase = Data('toLowerCase', {
  params: [
    {id: 'text', as: 'string', defaultValue: '%%'}
  ],
  impl: (ctx, {text}) => text.toLowerCase()
})

export const capitalize = Data('capitalize', {
  params: [
    {id: 'text', as: 'string', defaultValue: '%%'}
  ],
  impl: (ctx, {text}) => text.charAt(0).toUpperCase() + text.slice(1)
})

export const notContains = Boolean('notContains', {
  params: [
    {id: 'text', type: 'data[]', as: 'array', mandatory: true},
    {id: 'allText', defaultValue: '%%', as: 'array', byName: true}
  ],
  impl: not(contains('%$text%', { allText: '%$allText%' }))
})

export const startsWith = Boolean('startsWith', {
  description: 'begins with, includes, contains',
  params: [
    {id: 'startsWith', as: 'string', mandatory: true},
    {id: 'text', defaultValue: '%%', as: 'string', byName: true}
  ],
  impl: (ctx, {startsWith, text}) => text.startsWith(startsWith)
})

export const endsWith = Boolean('endsWith', {
  description: 'includes, contains',
  params: [
    {id: 'endsWith', as: 'string', mandatory: true},
    {id: 'text', defaultValue: '%%', as: 'string'}
  ],
  impl: (ctx, {endsWith, text}) => text.endsWith(endsWith)
})

export const jsonStringify = Data('json.stringify', {
  params: [
    {id: 'value', defaultValue: '%%'},
    {id: 'space', as: 'string', description: 'use space or tab to make pretty output'}
  ],
  impl: (ctx, {value, space}) => JSON.stringify(utils.val(value),null,space)
})

export const jsonParse = Data('json.parse', {
  params: [
    {id: 'text', as: 'string', defaultValue: '%%'}
  ],
  impl: (ctx, {text}) => {
    try {
      return JSON.parse(text)
    } catch (e) {
      jb.logException(e,'json parse',{text, ctx})
    }
  }
})

export const replace = Data('replace', {
  params: [
    {id: 'find', as: 'string', mandatory: true},
    {id: 'replace', as: 'string', mandatory: true},
    {id: 'text', as: 'string', defaultValue: '%%'},
    {id: 'useRegex', type: 'boolean', as: 'boolean', defaultValue: true},
    {id: 'regexFlags', as: 'string', defaultValue: 'g', description: 'g,i,m'}
  ],
  impl: (ctx, {find, replace, text, useRegex, regexFlags}) =>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                
    useRegex ? text.replace(new RegExp(find,regexFlags) ,replace) : text.replace(find,replace)
})

export const extractPrefix = Data('extractPrefix', {
  params: [
    {id: 'separator', as: 'string', description: '/w- alphnumberic, /s- whitespace, ^- beginline, $-endline'},
    {id: 'text', as: 'string', defaultValue: '%%', byName: true},
    {id: 'regex', type: 'boolean', as: 'boolean', description: 'separator is regex'},
    {id: 'keepSeparator', type: 'boolean', as: 'boolean'}
  ],
  impl: (ctx, {separator, text, regex, keepSeparator}) => {
    if (!regex) {
      return text.substring(0,text.indexOf(separator)) + (keepSeparator ? separator : '')
    } else { // regex
      const match = text.match(separator)
      if (match)
        return text.substring(0,match.index) + (keepSeparator ? match[0] : '')
    }
  }
})

export const extractSuffix = Data('extractSuffix', {
  params: [
    {id: 'separator', as: 'string', description: '/w- alphnumberic, /s- whitespace, ^- beginline, $-endline'},
    {id: 'text', as: 'string', defaultValue: '%%', byName: true},
    {id: 'regex', type: 'boolean', as: 'boolean', description: 'separator is regex'},
    {id: 'keepSeparator', type: 'boolean', as: 'boolean'}
  ],
  impl: (ctx, {separator, text, regex, keepSeparator}) => {
    if (!regex) {
      return text.substring(text.lastIndexOf(separator) + (keepSeparator ? 0 : separator.length));
    } else { // regex
      const match = text.match(separator+'(?![\\s\\S]*' + separator +')'); // (?!) means not after, [\\s\\S]* means any char including new lines
      if (match)
        return text.substring(match.index + (keepSeparator ? 0 : match[0].length));
    }
  }
})

export const formatDate = Data('formatDate', {
  description: 'using toLocaleDateString',
  params: [
    {id: 'date', defaultValue: '%%', description: 'Date value'},
    {id: 'dateStyle', as: 'string', options: 'full,long,medium,short'},
    {id: 'timeStyle', as: 'string', options: 'full,long,medium,short'},
    {id: 'weekday', as: 'string', options: 'long,short,narrow'},
    {id: 'year', as: 'string', options: 'numeric,2-digit'},
    {id: 'month', as: 'string', options: 'numeric,2-digit,long,short,narrow'},
    {id: 'day', as: 'string', options: 'numeric,2-digit'},
    {id: 'hour', as: 'string', options: 'numeric,2-digit'},
    {id: 'minute', as: 'string', options: 'numeric,2-digit'},
    {id: 'second', as: 'string', options: 'numeric,2-digit'},
    {id: 'timeZoneName', as: 'string', options: 'long,short'}
  ],
  impl: (ctx, params) => new Date(params.date).toLocaleDateString(undefined, Object.fromEntries(jb.entries(params).filter(e=>e[1])))
})

export const formatNumber = Data('formatNumber', {
  description: 'using toLocaleDateString',
  params: [
    {id: 'precision', as: 'number', defaultValue: '2', description: '10.33'},
    {id: 'num', defaultValue: '%%'}
  ],
  impl: (ctx, {precision, num: x}) => typeof x == 'number' ? +x.toFixed(+precision) : x
})
