# How to develop a jb6 form with Claude

The loop: learn the model, write the comp through the mcp, run it with loggers, read the log, upload last.

## 1. Learn tgp before you write a line

Read `packages/core/utils/jb-core.js`, `jb-args.js`, `tgp.js`, `jb-expression.js`. The self check from CLAUDE.md:
*can you explain what `dynamic: true` actually does?* If not, read them again before touching a comp.

**`dynamic: true`** (`paramRunner.resolve`, jb-core.js). A normal param is evaluated when the comp's args are
built. A dynamic one is not evaluated at all - the arg is a thunk closed over the **lexical** ctx, the ctx where
the profile was written:

```js
(dynamicCtx, arrayIndex) => doResolve(mergeDataCtx(lexicalCtx, dynamicCtx))
```

- the impl decides when to run it and with what data: `f.options(ctx.setData(record))` evaluates the author's
  profile with the record as `%%`, while `%$cities%` and `%$someParam%` still resolve where it was written -
  lexical for names, dynamic for data.
- `thunk.profile` is the raw profile in the slot, `undefined` when the use left it empty. It is the **only** way
  to ask "did the author fill this slot", because the thunk itself is always there.
- the second argument is `arrayIndex` for array profiles (`ctx.runInnerArg(arg, i)`), never vars.

This is what replaces `ctx.run(profile)` inside an impl: declare the sub-circuit as a dynamic slot (with a
`defaultValue` if it must do something when empty) and call it with the ctx you choose. `ctx.run` loses the
lexical ctx, skips coercion, and hides the profile from the type system, `~path` addressing, the probe and the
formatter. Same reason `export` is an anti-pattern: a comp's identity is its registry entry `type<dsl>id`, the
only name that survives serialization to the cli, the vm and the browser.

## 2. Scan the dsl before reaching for a comp

```bash
scanDsl {dsl: 'common', details: 'all-comps-with-params'}     # the model, not grep
scanDsl {dsl: 'react,test'}
sourceCodeOfComp {cmpFullId: 'data<common>pipe'}
```

The description is the contract: `pipeline` *"does not wait for promises and rx"*, `pipe` *"wait for promises and
reactive (callbag) data"*. Choosing by name instead of by description crashed the page once already.

## 3. Start the local server (once)

```bash
npm run local
```

It serves the packages, the mcp at `/mcp`, and `serveBucket` at `/bucket` - a PUT/GET stand-in for a public
bucket, with byte caps and `seedFiles` for the bucket's own reference data (`metadata/cities.json`). It is a
plain object store - GET, PUT, DELETE, list - exactly like the real thing: no append verb, because a bucket has
none. `bucket.append` fakes one in the client (GET, concat, PUT) and is **demo only** - no locking, so two
concurrent appends lose a line; in production that belongs on the server.

| url | for |
|---|---|
| `/jb6_packages/react/react-comp-view.html?cmpId=<comp>&urlsToLoad=<file>` | developing - has the ctrl-J picker |
| `/jb6_packages/react/react-comp-page.html?cmpId=<comp>&urlsToLoad=<file>` | what you publish - no picker, no lang-service |

Add `&logger=uiLogger,bucketLogger` to turn loggers on, and `&ctx-<name>=<value>` to set any ctx var
(`&ctx-bucketUrl=http://localhost:8083/bucket`).

Never restart the server for a comp change: every `tools/call` runs in a fresh CLI. Restart only after editing
server code (`serve-*.js`, `express-testing-utils.js`).

## 4. Write the comp through the mcp

```bash
curl -s -X POST http://localhost:8083/mcp -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1,
  "method":"tools/call","params":{"name":"safeEditTgpComp","arguments":{
    "tgpPath":"react-comp<react>myForm~impl","profileText":"inputForm({...})","existingProfileText":"*"}}}'
```

- `safeEditTgpComp` for an impl or a single slot (`~impl~setup`, `~impl~fields~2~options`). It validates and
  formats, and it refuses unregistered globals - `const x = Var(...)` must be `CtxEnricher('x', {impl: Var(...)})`.
- It cannot create a new comp, and it mis-formats a `~params~` slot (emits `param(...)`, which the model parser
  rejects): add new comps and params with `replaceFileSection`, then `formatAndValidateTgpComp` to check.

## 5. Debug with loggers, never screenshots

```bash
runTest     {testId: 'reactTest.myForm', logger: 'uiLogger,bucketLogger'}   # in process, no browser
playwrightHarvest {url: '<page url>', automation: '<ui-action<react> profile as json>', domSelector: '#show'}
runProbe    {probePath: 'react-comp<react>myForm~impl~fields~2~options'}    # one spot in a circuit
```

`playwrightHarvest` returns `{errors, logs, html, timeline, network}` - `network` is where a missing file shows up
as a 404, `logs` is what your `.info` calls wrote. An empty mcp reply means the child CLI crashed: rerun as
`runTgpSnippet` with `logger: 'snippetLogger'` to get its `stderrTail`.

## 6. The four rules that cost the most time

| rule | why |
|---|---|
| a `dynamic: true` param is **always** a function - test `f.options.profile` to know if the use filled the slot | otherwise every field looks like a picklist |
| `pipe` is async, `pipeline` is not - resolve a `pipe` in an effect, never during render | a promise has no `.map` |
| load data in `setup`/`enrichCtx`, not in the render | one fetch, progress indicator, sync options afterwards |
| `waitForText` must name something that exists **only after** the step | a placeholder or a subtitle that already contains the word ends the wait immediately |
| a logged `.error` fails a `dataTest` unless it sets `allowError` | that is the harness telling you an error is not expected output |
| what a param slot drops, it drops silently | pass a param the comp does not declare and the formatter removes it - check the echoed profile |

## 7. Upload when it is green

```bash
DRY_RUN=yes bash scripts/upload-jb-react-to-bucket.sh          # stages, no cloud
# harvest the url it prints (playwrightHarvest, section 5), read the loggers, then:
BUCKET=<bucket> bash scripts/upload-jb-react-to-bucket.sh      # the real upload
# harvest the bucket url the same way
```

See [how-to-upload-jb-react-to-the-cloud.md](./how-to-upload-jb-react-to-the-cloud.md) for what lands where, and
for the public-bucket budget question.
