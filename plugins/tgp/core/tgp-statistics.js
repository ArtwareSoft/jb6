import { utils, Data, jb } from '../../common/common-utils.js'

const refs = {}, comps = {}
function calcRefs() {
  if (Object.keys(comps).length) return
  comps = Object.fromEntries(Object.entries(jb.dsls).flatMap(([dsl,types]) => 
    Object.entries(types).flatMap(([type,tgpType]) => Object.entries(tgpType).map(([id,comp]) => [`${type}<${dsl}>${id}`, comp]))))

  Object.keys(comps).filter(k=>comps[k]).forEach(k=>
    refs[k] = {
      refs: [...calcRefs(comps[k].impl), ...calcRefs(comps[k].params|| [])].filter((x,index,_self) => x && _self.indexOf(x) === index),
      by: []
  })
  Object.keys(comps).filter(k=>comps[k]).forEach(k=>
    refs[k].refs.forEach(cross=>
      refs[cross] && refs[cross].by.push(k))
  )

  function calcRefs(profile) {
    if (profile == null || typeof profile != 'object') return [];
    return Object.values(profile).reduce((res,v)=> [...res,...calcRefs(v)], [utils.compName(profile)])
  }    
}

export function circuitOptions(compId) {
  calcRefs()
  const shortId = compId.split('>').pop().split('.').pop()
  const candidates = {[compId]: true}
  while (expand()) {}
  const _comps = Object.keys(candidates).filter(compId => noOpenParams(compId))
  return _comps.sort((x,y) => mark(y) - mark(x)).map(id=>({id, shortId: id.split('>').pop(), location: comps[id].$location}))

  function mark(id) {
    if (id.match(/^test<test>/) && id.indexOf(shortId) != -1) return 20
    if (id.match(/^test<test>/)) return 10
    return 0
  }

  function noOpenParams(id) {
    return (comps[id].params || []).filter(p=>!p.defaultValue).length == 0
  }

  function expand() {
    const length_before = Object.keys(candidates).length
    Object.keys(candidates).forEach(k=> 
      refs[k] && (refs[k].by || []).forEach(caller=>candidates[caller] = true))
    return Object.keys(candidates).length > length_before
  }
}

Data('tgp.componentStatistics', {
  params: [
    {id: 'cmpId', as: 'string', defaultValue: '%%'}
  ],
  impl: (ctx,cmpId) => {
	  calcRefs()

    const cmp = comps[cmpId]
    const cmpRefs = refs[cmpId] || {}
    if (!cmp) return {}
    const asStr = '' //utils.prettyPrint(cmp.impl || '',{comps: comps})

    return {
      id: cmpId,
      file: (cmp.$location || {}).path,
      lineInFile: +(cmp.$location ||{}).line,
      linesOfCode: (asStr.match(/\n/g)||[]).length,
      refs: cmpRefs.refs,
      referredBy: cmpRefs.by,
      type: cmp.type || 'data',
      implType: typeof cmp.impl,
      refCount: calcPath(cmpRefs.by,'length'),
      size: asStr.length
    }
	}
})

Data('tgp.references', {
  params: [
    {id: 'path', as: 'string'}
  ],
  impl: (ctx,path) => {
	  if (path.indexOf('~') != -1) return [];

    return Object.entries(comps)
    	.map(e=>({id: e[0], refs: refs(e[1].impl,`${e[0]}~impl`)}))
      .filter(e=>e.refs.length > 0)

    function refs(profile, parentPath) {
    	if (profile && typeof profile == 'object') {
        var subResult = Object.keys(profile).reduce((res,prop)=>
      		res.concat(refs(profile[prop],`${parentPath}~${prop}`)) ,[]);
      	return (profile.$ == path ? [parentPath] : []).concat(subResult);
      }
      return [];
    }
	}
})
