// ********** queue 
component('rx.queue', {
  type: 'data',
  description: 'message queue',
  category: 'variable',
  params: [
    {id: 'items', as: 'array'}
  ],
  impl: (ctx,items) => ({ items: items.slice(0), subject: callbag.subject(), mkmk: 5 })
})

RXSource('queue', {
  params: [
    {id: 'queue', mandatory: true}
  ],
  impl: source.merge(source.data('%$queue/items%'), '%$queue/subject%')
})

component('action.addToQueue', {
  type: 'action',
  params: [
    {id: 'queue', mandatory: true},
    {id: 'item', dynamic: true, defaultValue: '%%'}
  ],
  impl: (ctx,queue,item) => {
    const toAdd = item(ctx)
    queue.items.push(toAdd)
    queue.subject.next(ctx.dataObj(toAdd)) 
  }
})

component('action.removeFromQueue', {
  type: 'action',
  params: [
    {id: 'queue', mandatory: true},
    {id: 'item', dynamic: true, defaultValue: '%%'}
  ],
  impl: (ctx,queue,item) => {
		const index = queue.items.indexOf(item(ctx))
		if (index != -1)
      queue.items.splice(index,1)
  }
})
