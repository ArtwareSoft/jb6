import { Data, Aggregator, Component } from './jb-common.js'
import { utils } from './common-utils.js'

export const aggregate = Aggregator('aggregate', {
  description: 'in pipeline, calc function on all items, rather then one by one',
  params: [
    {id: 'aggregator', type: 'data', mandatory: true, dynamic: true}
  ],
  impl: ({},{ aggregator} ) => aggregator()
})

export const objFromProperties = Aggregator('objFromProperties', {
  description: 'object from entries of properties {id,val}',
  params: [
    {id: 'properties', defaultValue: '%%', as: 'array'}
  ],
  impl: ({},{ properties} ) => Object.fromEntries(properties.map(({id,val}) => [id,val]))
})

export const objFromEntries = Aggregator('objFromEntries', {
  description: 'object from entries',
  params: [
    {id: 'entries', defaultValue: '%%', as: 'array'}
  ],
  impl: ({},{entries}) => Object.fromEntries(entries)
})

export const unique = Aggregator('unique', {
  params: [
    {id: 'id', as: 'string', dynamic: true, defaultValue: '%%'},
    {id: 'items', as: 'array', defaultValue: '%%'}
  ],
  impl: (ctx,{id,items}) => {
		const _idFunc = id.profile == '%%' ? x=>x : x => id(ctx.setData(x))
		return utils.unique(items,_idFunc)
	}
})

export const max = Aggregator('max', {
  impl: ctx => Math.max.apply(0,utils.asArray(ctx.data))
})

export const min = Aggregator('min', {
  impl: ctx => Math.min.apply(0,utils.asArray(ctx.data))
})

export const sum = Aggregator('sum', {
  impl: ctx => utils.asArray(ctx.data).reduce((acc,item) => +item+acc, 0)
})

export const slice = Aggregator('slice', {
  params: [
    {id: 'start', as: 'number', defaultValue: 0, description: '0-based index', mandatory: true},
    {id: 'end', as: 'number', mandatory: true, description: '0-based index of where to end the selection (not including itself)'}
  ],
  impl: ({data},{start,end}) => {
		if (!data || !data.slice) return null
		return end ? data.slice(start,end) : data.slice(start)
	}
})

export const sort = Aggregator('sort', {
  params: [
    {id: 'propertyName', as: 'string', description: 'sort by property inside object'},
    {id: 'lexical', as: 'boolean', type: 'boolean'},
    {id: 'ascending', as: 'boolean', type: 'boolean'}
  ],
  impl: ({data},{prop,lexical,ascending}) => {
    if (!data || ! Array.isArray(data)) return null;
    let sortFunc
    const firstData = data[0] //jb.entries(data[0]||{})[0][1]
		if (lexical || isNaN(firstData))
			sortFunc = prop ? (x,y) => (x[prop] == y[prop] ? 0 : x[prop] < y[prop] ? -1 : 1) : (x,y) => (x == y ? 0 : x < y ? -1 : 1);
		else
			sortFunc = prop ? (x,y) => (x[prop]-y[prop]) : (x,y) => (x-y);
		if (ascending)
  		return data.slice(0).sort((x,y)=>sortFunc(x,y));
		return data.slice(0).sort((x,y)=>sortFunc(y,x));
	}
})

export const first = Aggregator('first', {
  params: [
    {id: 'items', as: 'array', defaultValue: '%%'}
  ],
  impl: ({},{items}) => items[0]
})

export const last = Aggregator('last', {
  params: [
    {id: 'items', as: 'array', defaultValue: '%%'}
  ],
  impl: ({},{items}) => items.slice(-1)[0]
})

export const count = Aggregator('count', {
  description: 'length, size of array',
  params: [
    {id: 'items', as: 'array', defaultValue: '%%'}
  ],
  impl: ({},{items}) => items.length
})

export const reverse = Aggregator('reverse', {
  params: [
    {id: 'items', as: 'array', defaultValue: '%%'}
  ],
  impl: ({},{items}) => items.slice(0).reverse()
})

export const sample = Aggregator('sample', {
  params: [
    {id: 'size', as: 'number', defaultValue: 300},
    {id: 'items', as: 'array', defaultValue: '%%'}
  ],
  impl: ({},size,{items}) =>	items.filter((x,i)=>i % (Math.floor(items.length/size) ||1) == 0)
})

export const prop = Data('prop', {
  description: 'assign, extend obj with a single prop',
  params: [
    {id: 'name', as: 'string', mandatory: true},
    {id: 'val', dynamic: true, mandatory: true, defaultValue: ''},
    {id: 'type', as: 'string', options: 'string,number,boolean,object,array,asIs', defaultValue: 'asIs'},
    {id: 'obj', byName: true, defaultValue: '%%'}
  ],
  impl: (ctx,{name,val,type,obj}) => ({...obj, [name]: jb.core.tojstype(val(),type)})
})

export const removeProps = Data('removeProps', {
  description: 'remove properties from object',
  params: [
    {id: 'names', type: 'data[]', mandatory: true},
    {id: 'obj', byName: true, defaultValue: '%%'}
  ],
  impl: (ctx,{names,obj}) => names.reduce((obj,name) => { const{ [name]: _, ...rest } = obj; return rest }, obj)
})
