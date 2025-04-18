const getAsBool = Data({
  params: [
    {id: 'val', as: 'boolean', type: 'boolean'}
  ],
  impl: (ctx,{val}) => val
})

Test('dbTest.getRefValueAsBoolean', {
  impl: dataTest(getAsBool('%$person/male%'), ({data}) => data === true)
})

Test('dbTest.expOfRefWithBooleanType', {
  impl: dataTest({
    vars: [Var('a', 'false')],
    calculate: ctx => ctx.exp('%$person/male%','boolean'),
    expectedResult: ({data}) => data === true
  })
})