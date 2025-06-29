import { dsls } from '@jb6/core'
import '@jb6/testing'
import '@jb6/llm-guide'

// please look at tgpModel for packages/common/llm-guide/common-llm-guide.js
// my repo is  /home/shaiby/projects/jb6
// also explore the files inside /llm-guide/index.js

const { 
  tgp: { Const }, 
  common: { data: { pipeline, filter, count, join }, Boolean: { and } },
  doclet: { Doclet,
    doclet: { exercise },
    guidance: { solution, doNot, bestPractice }, 
    explanation: { explanation }, 
    explanationPoint: { whenToUse, performance, comparison } 
  } 
} = dsls

Const('people', [{name: 'Homer', age: 42}, {name: 'Bart', age: 12}, {name: 'Lisa', age: 10}])

Doclet('countUnder30', {
  impl: exercise(
    'count people under 30',
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
    solution((ctx) => ctx.data.filter(p => p.age < 30).length, explanation(
      'JavaScript function approach',
      whenToUse('large datasets (1k+ items)'),
      performance('fastest - native JavaScript execution. avoid the pipeline interpreter iteration')
    )),
    doNot('%$people[age<30]%', { reason: 'XPath syntax not supported' }),
    doNot('SELECT COUNT(*) FROM people WHERE age < 30', { reason: 'SQL queries not supported' }),
    doNot('$.people[?(@.age<30)].length', { reason: 'JSONPath not supported' }),
    mechanismUnderTheHood('')
  )
})

Doclet('joinNames', {
  impl: exercise('get names of all people concatenated with comma',
    solution(pipeline('%$people%', '%name%', join()), explanation(', is default separator at data<common>join',
      whenToUse('when you need comma-separated lists'),
      performance('efficient string concatenation')
    )),
    solution(join('%$people/name%'), explanation('property path shortcut',
      whenToUse('for direct property access from variables'),
      comparison('pipeline approach', {advantage: 'more concise syntax'})
    )),
    solution((ctx) => ctx.data.map(p => p.name).join(','), explanation('JavaScript function approach',
      whenToUse('for large datasets or when you need explicit separator control'),
      performance('fastest - native JavaScript, scales well to 10k+ items')
    )),
    doNot('%$people%.name.join(",")', { reason: 'property chaining not supported' }),
    doNot('CONCAT(people.name)', { reason: 'SQL functions not supported' })
  )
})

Doclet('complexFilter', {
  impl: exercise('filter people who are under 30 AND named Bart',
    solution(pipeline('%$people%', filter(and('%age% < 30', '%name% == "Bart"')), '%name%'), explanation('and() function for multiple conditions',
      whenToUse('when you need multiple boolean conditions'),
      comparison('&& operator', {advantage: 'supported in DSL expressions'})
    )),
    solution(pipeline('%$people%', filter('%age% < 30'), filter('%name% == "Bart"'), '%name%'), explanation('chain multiple filters',
      whenToUse('when conditions are logically separate'),
      performance('filters early, reduces data processing')
    )),
    solution((ctx) => ctx.data.filter(p => p.age < 30 && p.name === 'Bart').map(p => p.name), explanation('JavaScript function approach',
      whenToUse('for complex boolean logic or large datasets'),
      performance('fastest - native JavaScript, efficient on 10k+ items')
    )),
    doNot("filter('%age% < 30 && %name% == \"Bart\"')", { reason: '&& operator not supported in expressions' }),
    doNot("WHERE age < 30 AND name = 'Bart'", { reason: 'SQL WHERE clauses not supported' }),
    bestPractice('extractSuffix(":", "%$parts/3%")', { 
      better: 'pipeline("%$parts/3%", extractSuffix(":"))', 
      reason: 'direct function call better than unnecessary pipeline for single operations' 
    })
  )
})

Doclet('formatAndJoin', {
  impl: exercise('Get a comma-separated list of people under 30, formatted as "Name (age)"',
    solution(
      pipeline('%$people%',
        filter('%age% < 30'),
        obj(
          prop('formatted', pipeline(list('%name%',' (','%age%',')'), join({separator:''})) )
        ),
        '%formatted%',
        join()
      ),
      explanation(
        'A pure TGP solution using a nested pipeline to format each item.',
        whenToUse('When you want to stay entirely within the DSL for complex item transformations.'),
        comparison('JS function approach', { advantage: 'More declarative and potentially easier for other tools to parse and understand.' })
      )
    ),
    solution(
      pipeline('%$people%', filter('%age% < 30'), (ctx) => `${ctx.data.name} (${ctx.data.age})`, join()),
      explanation(
        'Combine filtering, mapping, and joining in a single pipeline with a JS function.',
        whenToUse('when a simple JS snippet is the most readable way to format data within a pipeline.'),
        performance('Efficient for small to medium datasets; the JS function within the pipeline is highly performant.')
      )
    ),
    solution(
      (ctx) => ctx.data.people.filter(p => p.age < 30).map(p => `${p.name} (${p.age})`).join(','),
      explanation(
        'Pure JavaScript function for maximum performance.',
        whenToUse('for very large datasets or when complex logic is easier to express in JS.'),
        performance('Fastest approach, leveraging native array methods.')
      )
    ),
    doNot('pipeline(filter(people), ...)', { reason: 'Must provide a data source (e.g., %$people%) as the first argument to pipeline.' })
  )
})

Doclet('firstVsFirstNotEmpty', {
  impl: exercise(
    'Get the first non-empty value from a list of possible sources',
    solution(
      pipeline(
        list('', null, undefined, 'foo', 'bar'),
        first()
      ),
      explanation(
        'first() returns the first item in the list, even if it is empty or falsy',
        whenToUse('when you want the very first value, regardless of content'),
        performance('fast, but may return empty/falsy values')
      )
    ),
    solution(
      pipeline(
        list('', null, undefined, 'foo', 'bar'),
        firstNotEmpty()
      ),
      explanation(
        'firstNotEmpty() skips empty/falsy values and returns the first non-empty one',
        whenToUse('when you want to skip empty/falsy values in fallback chains'),
        performance('slightly slower, but safer for fallback logic')
      )
    ),
    solution(
      pipeline(
        list('', null, undefined, 'foo', 'bar'),
        firstSucceeding()
      ),
      explanation(
        'firstSucceeding() tries each item until one succeeds (does not throw or error)',
        whenToUse('when you want to try multiple strategies or sources until one works'),
        comparison('firstNotEmpty', { advantage: 'handles errors, not just empty values' })
      )
    ),
    doNot(
      'pipeline(list("", null, undefined, "foo", "bar"), first()) // expecting non-empty',
      { reason: 'first() does not skip empty/falsy values, may return unexpected result' }
    ),
    bestPractice(
      'pipeline(list(source1, source2, source3), first())',
      { better: 'pipeline(list(source1, source2, source3), firstNotEmpty())', reason: 'firstNotEmpty() is safer for fallback chains' }
    )
  )
})

Doclet('pipelineNullFiltering', {
  impl: exercise(
    'Demonstrate how pipeline clears null values after each non-aggregator step',
    solution(
      pipeline(
        list('a', null, 'b', undefined, '', 'c'),
        (item) => item && item !== '' ? item : null,
        // after this step, only ['a', 'b', 'c'] remain
        first()
      ),
      explanation(
        'After the mapping step, all null/undefined results are filtered out by pipeline. Only non-null values are passed to the next step.',
        whenToUse('when you want to clean data before aggregation or selection'),
        performance('automatic null filtering can simplify pipelines')
      )
    ),
    solution(
      pipeline(
        list('a', null, 'b', undefined, '', 'c'),
        (item) => item && item !== '' ? item : null
        // No aggregator: result is ["a", "b", "c"]
      ),
      explanation(
        'If you stop before an aggregator, the output is the cleaned array with nulls removed.',
        whenToUse('when you want to preprocess data for further use')
      )
    ),
    doNot(
      'pipeline(list("a", null, "b", undefined, "", "c"), first()) // expecting to get null or empty',
      { reason: 'pipeline will filter out null/undefined, so first() will never see them' }
    ),
    bestPractice(
      'pipeline(list(...), myMapFn, first())',
      { better: 'pipeline(list(...), myMapFn, first()) // safe, as nulls are filtered automatically', reason: 'No need for extra filter(notEmpty()) step unless you want to remove empty strings or falsy values' }
    )
  )
})

Doclet('pipelineNullFilteringPrinciple', {
  impl: principle(
    '5',
    'Pipeline automatically filters out null/undefined after each non-aggregator step',
    'This behavior ensures that downstream operators and aggregators only see meaningful values, simplifying pipeline construction and reducing the need for manual filtering.',
    explanation(
      'Summary: In JB6 DSL, after each non-aggregator step in a pipeline, all null/undefined results are automatically filtered out.',
      'Practical Example:',
      {
        type: 'code',
        code: `pipeline(
  list('a', null, 'b', undefined, '', 'c'),
  (item) => item && item !== '' ? item : null,
  first()
) // returns "a"`
      },
      'Advanced: The implementation of pipeline and runAsAggregator reveals why nulls are filtered:',
      {
        type: 'code',
        code: `// pipeline implementation
Data('pipeline', {
  impl: (ctx, { items, source } ) =>
    asArray(items.profile).reduce(
      (dataArray, profile ,index) => runAsAggregator(ctx, items, index, dataArray, profile),
      source()
    )
})

// runAsAggregator implementation
function runAsAggregator(ctx, arg, index, dataArray, profile) {
  if (!profile || profile.$disabled) return dataArray
  if (profile.$?.aggregator)
    return ctx.setData(asArray(dataArray)).runInnerArg(arg, index)
  return asArray(dataArray)
    .map(item => ctx.setData(item).runInnerArg(arg, index))
    .filter(x=>x!=null)
    .flatMap(x=> asArray(calcValue(x)))
}`
      },
      'As shown, after each non-aggregator step, nulls are filtered out before passing to the next step.',
      whenToUse('when you want to clean data before aggregation or selection'),
      performance('automatic null filtering can simplify pipelines')
    )
  )
})