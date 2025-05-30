import { coreUtils, dsls } from '@jb6/core'
const { asArray, unique } = coreUtils
const { 
  tgp: { TgpType },
  common: { Data, Aggregator,
    data: { prop, pipeline,  removeProps, join, max, min, count },
  },
} = dsls

const GroupProp = TgpType('group-prop','common')

const splitByPivot = Aggregator('splitByPivot', {
  params: [
    {id: 'pivot', as: 'string', description: 'prop name', mandatory: true},
    {id: 'items', as: 'array', defaultValue: '%%'}
  ],
  impl: (ctx, {pivot, items}) => {
      const keys = unique(items.map(item=>item[pivot]))
      const groups = Object.fromEntries(keys.map(key=> [key,[]]))
      items.forEach(item => groups[item[pivot]].push(item))
      return keys.map(key => ({[pivot]: key, items: groups[key]}))
  }
})

const groupProps = Data('groupProps', {
  description: 'aggregate, extend group obj with a group props',
  params: [
    {id: 'props', type: 'group-prop[]', mandatory: true},
  ],
  impl: ({data}, {props}) => props.flatMap(x=>asArray(x)).reduce((item,prop) => ({...item, ...prop.enrichGroupItem(item)}), data )
})

Aggregator('groupBy', {
  params: [
    {id: 'pivot', as: 'string', description: 'new prop name', mandatory: true},
    {id: 'calcPivot', dynamic: true, mandatory: true, byName: true},
    {id: 'aggregate', type: 'group-prop[]', mandatory: true},
    {id: 'inputItems', defaultValue: '%%'},
  ],
  impl: pipeline(
    '%$inputItems%',
    prop('%$pivot%', '%$calcPivot()%'),
    splitByPivot('%$pivot%'),
    groupProps('%$aggregate%'),
    removeProps('items'),
  )
})

GroupProp('prop', {
  description: 'assign, extend group obj with a single prop, input is items',
  params: [
    {id: 'name', as: 'string', mandatory: true},
    {id: 'val', dynamic: true, mandatory: true, defaultValue: '', description: 'input is group items'},
    {id: 'type', as: 'string', options: 'string,number,boolean,object,array,asIs', defaultValue: 'asIs'},
  ],
  impl: (ctx, {name, val, type}) => ({ 
    enrichGroupItem: item => ({...item, [name]: jb.core.tojstype(val(ctx.setData(item.items)), type)}) 
  })
})

GroupProp('count', {
  params: [
    {id: 'as', as: 'string', defaultValue: 'count'},
  ],
  impl: prop('%$as%', count())
})

GroupProp('join', {
  params: [
    {id: 'prop', as: 'string', mandatory: true},
    {id: 'as', as: 'string', mandatory: true, byName: true},
    {id: 'separator', as: 'string', defaultValue: ','},
  ],
  impl: prop('%$as%', join({data: '%{%$prop%}%', separator: '%$separator%'}))
})

GroupProp('max', {
  params: [
    {id: 'prop', as: 'string', mandatory: true},
    {id: 'as', as: 'string', defaultValue: 'max', byName: true}
  ],
  impl: prop('%$as%', max({data: '%{%$prop%}%'}))
})

GroupProp('min', {
  params: [
    {id: 'prop', as: 'string', mandatory: true},
    {id: 'as', as: 'string', defaultValue: 'min', byName: true}
  ],
  impl: prop('%$as%', min({data: '%{%$prop%}%'}))
})

/*
example usage:

The rule in TGP parameter handling is that once you have a parameter marked with byName: true, that parameter and all parameters after it must be specified by name in the function call, not positionally.

pipeline('%$products%',
  groupBy('category', {
    calcPivot: '%category%',
    aggregate: [count('itemCount'), min('price', {as: 'minPrice'}), max('price', {as: 'maxPrice'})]
  }),
  filter('%itemCount% > 1')
)
*/

