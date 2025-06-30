import { dsls } from '@jb6/core'
import '@jb6/common'
import '@jb6/testing'
import '@jb6/llm-guide'

// please look at tgpModel for packages/common/llm-guide/common-llm-guide.js
// my repo is  /home/shaiby/projects/jb6
// also explore the files inside /llm-guide/index.js

const { 
  tgp: { Const, var: { Var } }, 
  common: { data: { pipeline, filter, count, join }, Boolean: { and } },
  doclet: { Doclet,
    doclet: { exercise },
    guidance: { solution, doNot, bestPractice, mechanismUnderTheHood, illegalSyntax }, 
    explanation: { explanation }, 
    explanationPoint: { whenToUse, performance, comparison, syntax },
    problemStatement: {problem}
  } 
} = dsls

Const('people', [{name: 'Homer', age: 42}, {name: 'Bart', age: 12}, {name: 'Lisa', age: 10}])

Data('how', {
  impl: ''
})

Doclet('countUnder30', {
  impl: exercise(
    problem('count people under 30'),
    solution({
      code: pipeline('%$people%', filter('%age% < 30'), count()),
      expl: explanation(
        'count() uses %% parameter by default',
        syntax('%$people%', 'get the content of the variable "people" use it as source'),
        syntax(`filter('%age% < 30')`, 'use filter with expression, filter can also have boolean components "filter(between(1,10))"'),
        whenToUse('in pipelines when chaining operations'),
        performance('good for small datasets, slower on 10k+ items')
      )
    }),
    solution({
      code: count(pipeline('%$people%', filter('%age% < 30'))),
      expl: explanation(
        'explicit parameter to count()',
        syntax({
          expression: 'count(data_exp)',
          explain: 'count first param is "items". it counts them. when inside a pipe the items defaultValue is "%%", means the array passed in the pipe'
        }),
        whenToUse('when you need more control over data flow'),
        comparison('pipeline approach', { advantage: 'clearer data flow' })
      )
    }),
    solution((ctx) => ctx.data.filter(p => p.age < 30).length, explanation('JavaScript function approach',
      whenToUse('large datasets (1k+ items)'),
      performance('fastest - native JavaScript execution. avoid the pipeline interpreter iteration')
    )),
    doNot('%$people[age<30]%', { reason: 'XPath syntax not supported' }),
    doNot('SELECT COUNT(*) FROM people WHERE age < 30', { reason: 'SQL queries not supported' }),
    doNot('$.people[?(@.age<30)].length', { reason: 'JSONPath not supported' }),
    mechanismUnderTheHood({
      snippet: `Aggregator('count', {
  description: 'length, size of array',
  params: [
    {id: 'items', as: 'array', defaultValue: '%%'}
  ],
  impl: ({},{items}) => items.length
})`,
      explain: 'count is aggregator operator works on array of items. notice its "items" param that allows it to be used as source or inside a pipeline'
    })
  )
})

Doclet('joinNames', {
  impl: exercise(
    problem('get names of all people concatenated with comma'),
    solution(pipeline('%$people%', '%name%', join()), explanation(
      ', is default separator at data<common>join',
      whenToUse('when you need comma-separated lists'),
      performance('efficient string concatenation')
    )),
    solution(join('%$people/name%'), explanation(
      'property path shortcut',
      whenToUse('for direct property access from variables'),
      comparison('pipeline approach', { advantage: 'more concise syntax' })
    )),
    solution((ctx) => ctx.data.map(p => p.name).join(','), explanation(
      'JavaScript function approach',
      whenToUse('for large datasets or when you need explicit separator control'),
      performance('fastest - native JavaScript, scales well to 10k+ items')
    )),
    doNot('%$people%.name.join(",")', { reason: 'property chaining not supported' }),
    doNot('CONCAT(people.name)', { reason: 'SQL functions not supported' }),
    mechanismUnderTheHood({
      snippet: `Data('pipeline', {
  description: 'flat map data arrays one after the other, does not wait for promises and rx',
  params: [
    {id: 'source', type: 'data', dynamic: true, mandatory: true, templateValue: '', composite: true },
    {id: 'operators', type: 'data[]', dynamic: true, mandatory: true, secondParamAsArray: true, description: 'chain/map operators'}
  ],
  impl: (ctx, { operators, source } ) => asArray(operators.profile).reduce( (dataArray, profile ,index) => runAsAggregator(ctx, operators, index,dataArray,profile), source())
})

function runAsAggregator(ctx, arg, index, dataArray, profile) {
    if (!profile || profile.$disabled) return dataArray
    if (profile.$?.aggregator)
      return ctx.setData(asArray(dataArray)).runInnerArg(arg, index)
    return asArray(dataArray)
      .map(item => ctx.setData(item).runInnerArg(arg, index))
      .filter(x=>x!=null)
      .flatMap(x=> asArray(calcValue(x)))
}  
`,
      explain: 'pipeline starts with source data, flat maps the operators and filters null values between them'
    })
  )
})

Doclet('complexFilter', {
  impl: exercise(
    'filter people who are under 30 AND named Bart',
    solution({
      code: pipeline('%$people%', filter(and('%age% < 30','%name% == "Bart"')), '%name%'),
      expl: explanation(
        'and() function for multiple conditions',
        whenToUse('when you need multiple boolean conditions'),
        comparison('&& operator', { advantage: 'supported in DSL expressions' })
      )
    }),
    solution({
      code: pipeline('%$people%', filter('%age% < 30'), filter('%name% == "Bart"'), '%name%'),
      expl: explanation(
        'chain multiple filters',
        whenToUse('when conditions are logically separate'),
        performance('filters early, reduces data processing')
      )
    }),
    solution({
      code: (ctx) => ctx.data.filter(p => p.age < 30 && p.name === 'Bart').map(p => p.name),
      expl: explanation(
        'JavaScript function approach',
        whenToUse('for complex boolean logic or large datasets'),
        performance('fastest - native JavaScript, efficient on 10k+ items')
      )
    }),
    doNot(`filter('%age% < 30 && %name% == "Bart"')`, {
      reason: '&& operator not supported in expressions'
    }),
    doNot(`WHERE age < 30 AND name = 'Bart'`, { reason: 'SQL WHERE clauses not supported' }),
    bestPractice('extractSuffix(":", "%$parts/3%")', {
      better: 'pipeline("%$parts/3%", extractSuffix(":"))',
      reason: 'direct function call better than unnecessary pipeline for single operations'
    }),
    mechanismUnderTheHood({
      snippet: `Aggregator('filter', {
  params: [
    {id: 'filter', type: 'boolean', as: 'boolean', dynamic: true, mandatory: true}
  ],
  impl: (ctx, {filter}) => toArray(ctx.data).filter(item => filter(ctx.setData(item)))
})`,
      explain: 'filter is aggregator operator the filters array of items'
    })
  )
})

Doclet('formatAndJoin', {
  impl: exercise(
    problem('Get a comma-separated list of people under 30, formatted as "Name (age)"'),
    solution({
      code: pipeline('%$people%', filter('%age% < 30'), '%name% (%age%)', join()),
      expl: explanation(
        'A pure TGP solution',
        comparison('JS function approach', {
          advantage: 'More declarative and potentially easier for other tools to parse and understand.'
        }),
        syntax('%name% (%age%)', 'data template based on pipeline input')
      )
    }),
    doNot('pipeline(filter(people), ...)', {
      reason: 'Must provide a data source (e.g., %$people%) as the first argument to pipeline.'
    }),
    illegalSyntax('%$name% (%$age%)', { reason: 'data is not in variables' })
  )
})

Doclet('nestedPipeline', {
  impl: exercise({
    problem: problem({
      statement: 'Get names of children for each parent, formatted as "Child is child of Parent"',
      intro: `This exercise demonstrates how to use nested pipelines to process hierarchical data.
        The outer pipeline iterates over a collection of parents, and for each parent,
        an inner pipeline processes its children. This pattern is useful for complex data transformations`
    }),
    guidance: [
      solution({
        code: pipeline('%$peopleWithChildren%', pipeline(Var('parent'), '%children%', '%name% is child of %$parent/name%'), join()),
        expl: explanation(
          'Nested pipeline with variable usage',
          syntax({
            expression: `pipeline(Var('parent'), '%children%', '%name% is child of %$parent/name%')`,
            explain: `The inner pipeline iterates over children, using the 'parent' variable from the outer pipeline.`
          }),
          whenToUse('when processing hierarchical data or performing operations on sub-collections'),
          comparison('flat pipeline', {
            advantage: 'clearer separation of concerns for complex transformations'
          })
        )
      })
    ],
    outro: 'Nested pipelines provide a powerful way to handle complex data structures by breaking down the transformation into smaller, manageable steps.'
  })
})

Doclet('variableUsage', {
  impl: exercise({
    problem: problem({
      statement: 'Demonstrate variable definition and usage',
      intro: `This exercise illustrates how to define and use variables within a pipeline.
        Variables can improve readability and reusability of values in your DSL expressions.`
    }),
    guidance: [
      solution({
        code: pipeline(Var('sep', '-'), '%$items/id%', '%% %$sep%', join()),
        expl: explanation(
          'Define and use a variable within a pipeline',
          syntax(`Var('sep', '-')', 'Defines a variable named 'sep' with value '-'`),
          syntax('%% %$sep%', `Uses the 'sep' variable in a string template`),
          whenToUse('when a value is reused multiple times or needs to be clearly named'),
          performance('minimal overhead, improves readability')
        )
      }),
      doNot('%% -', {
        reason: 'Hardcoding values reduces flexibility and readability compared to using variables.'
      })
    ],
    outro: `Using variables makes your DSL expressions more dynamic and easier to maintain, 
      especially when dealing with frequently used or configurable values.`
  })
})
