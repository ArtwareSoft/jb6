# TGP Profile Sugar & Args Mapping

In TGP, a **profile** is the component’s identity plus a flat object of its parameter values—think of it like a template instantiation rather than a direct JS call. For example:

```js
// “split” vanilla profile
{
  $: /* split component metadata */,
  separator: ',',
  text: 'a,b,c',
  part: 'first'
}
```

---

## Mapping Rules

1. **ByName‐only (“vanilla”)**
   Every parameter must be provided in a `{ … }` object:

   ```js
   comp({ a:1, b:2, c:3 })
   ```

2. **ByValue sugar**
   You may omit naming for an **initial span** of parameters, controlled by:

   * **Param flags**: `byName:true`, `type:'X[]'`, `secondParamAsArray:true`
   * **Component flag**: `macroByValue:true`

3. **Default byValue span**
   Starting at **param 0**, you may supply byValue until you:

   * Hit a param with `byName:true`, **or**
   * Have given two byValue params (slots 0–1) with no array/varargs flags

4. **Array‐collapse on param 0**
   If `params[0].type` ends in `[]`, **only** param 0 may be byValue (it expands every element), and **param 1+** must be byName.

5. **Varargs on param 1**
   If `params[1].secondParamAsArray===true`, **only** param 0 may be byValue, and param 1 consumes **all** remaining byValue args as separate arguments.

6. **Force all byName**
   Mark **param 0** as `byName:true` → **no** byValue sugar anywhere.

7. **Force all byValue**
   Set `macroByValue:true` on the component → map **every** parameter byValue, ignoring byName/array rules.

---

## Examples

### 1. Simple “plus”

```js
Data('plus', {
  category: 'math:80',
  params: [
    { id: 'x', as: 'number', mandatory: true },
    { id: 'y', as: 'number', mandatory: true }
  ],
  impl: (ctx, { x, y }) => +x + +y
})
```

**Resolved profile:**  `{ x: 2, y: 3 }`
**Printed DSL:**

```js
plus(2, 3)
```

### 2. byName “split”

```js
Data('split', {
  description: 'breaks string using separator',
  params: [
    { id: 'separator', as: 'string', defaultValue: ',' },
    { id: 'text',      as: 'string', defaultValue: '%%', byName: true },
    { id: 'part',      options: 'all,first,second,last,but first,but last', defaultValue: 'all' }
  ],
  impl: (ctx, { separator, text, part }) => { /*…*/ }
})
```

**Resolved profile:**  `{ separator: ',', text: 'a,b,c', part: 'first' }`
**Printed DSL:**

```js
split(',', { text: 'a,b,c', part: 'first' })
```

### 3. firstParamAsArray “contains”

```js
export const contains = Boolean('contains', {
  params: [
    { id: 'text',    type: 'data[]', as: 'array', mandatory: true },
    { id: 'allText', defaultValue: '%%',        as: 'string' },
    { id: 'anyOrder', as: 'boolean', type: 'boolean' }
  ],
  impl: (ctx, { text, allText, anyOrder }) => { /*…*/ }
})
```

**Resolved profile:**  `{ text: ['a','b','c'], allText: 'foobar', anyOrder: true }`
**Printed DSL:**

```js
contains('a', 'b', 'c', { allText: 'foobar', anyOrder: true } )
```

### 4. secondParamAsArray “pipeline”

```js
Data('pipeline', {
  description: 'flat map data arrays one after the other',
  params: [
    { id: 'source', type: 'data',  dynamic: true, mandatory: true },
    { id: 'items',  type: 'data[]', dynamic: true, mandatory: true, secondParamAsArray: true }
  ],
  impl: (ctx, { source, items }) => { /*…*/ }
})
```

**Resolved profile:**  `{ source: srcFn, items: [mapA, mapB, mapC] }`
**Printed DSL:**

```js
pipeline( srcFn, mapA, mapB, mapC)
```
