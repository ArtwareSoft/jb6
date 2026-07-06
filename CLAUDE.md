## jb6 and TGP

TGP: TgpType (abstract type), Component (generic def), Profile (concrete JSON instance)
example:
TgpType('color', 'css')

Component('rgb', { type: 'color<css>', params: [{id: 'r', as: 'number'}, {id: 'g', as: 'number'}, {id: 'b', as: 'number'}] })
Component('hsl', { type: 'color<css>', ... })

TgpType('gradient', 'css')
Component('linearGradient', { type: 'gradient<css>', params: [{id: 'direction', as: 'string'}, {id: 'stops', type: 'color<css>[]'}] })
Component('radialGradient', { type: 'gradient<css>', ... })
...

// Profile: linear-gradient(to right, rgb(255,99,71), hsl(45,100,50))
{$: 'gradient<css>linearGradient', direction: 'to right', stops: [{$: 'color<css>rgb', r: 255, g: 99, b: 71}, {$: 'color<css>hsl', h: 45, s: 100, l: 50}]}

You must understand tgp before writing or using tgp components. read packages/core/utils/jb-core.js/jb-core.js, jb-args.js, tgp.js, jb-expression.js in details
LLM mem is drifting, when you need tgp, ask yourself "can I explain how 'dynamic: true' actually works" - if not, read carefully *again* jb-core,jb-args,tgp.js and explain 'dynamic: true' mechanism in details.

## TGP MCP Tools
run mcp via our server
curl -s -X POST http://localhost:8083/mcp -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1, ...

**Execution**
- `runTgpSnippet({profileText: '...', logger})` — execute a JSON profile. All `$` references are auto-resolved — source files discovered and imported automatically. Returns execution result + logger output.
- `runTest({testId: 'asset.crud'})` — shorthand for `runTgpSnippet({profileText: "{$: 'test<test>asset.crud'}"})`
- `runProbe({probePath: 'test<test>myTest~impl~calculate~items~0'})` — run a circuit and capture the intermediate `{in,out}` at a probePath (a `~`-path into a runnable comp). Auto-detects the enclosing circuit; returns the recorded `{in,out}` + visits + circuitRes + logs/errors. Use it to inspect what flows through a specific spot mid-run. `resolution: 'input'|'output'|'all'` narrows/expands the detail.
- `wonderFetch({url, method, body, logger})` — read/write room content via wUrls (GET/list, PUT/POST/PATCH); `body` is a JSON string. Wraps the `wFetch` comp (db-drivers.js).
- `harvestLiveCompViaPlaywright({url, settleMs?, logger})` — verify a bare live react-comp url (react-comp-view.html/wComp.html WITH `&logger=uiLogger,...`); launches Playwright in a jb-cli child and returns the harvested `{log,errors}` per logger. Use before handing a clickable link.

## TGP Tests and Loggers
Domain loggers produce logs as parts of tests results. Enable loggers with `{"$": "test<test>AnyTester", "logger": "logger1,logger2", .
In impl code, loggers are accessed via `ctx.vars`. Usage example, `assetLogger?.info?.({t: 'myEvent', ...data}, {}, {ctx})`
When running a test, always set relevant loggers, and check the log results. checking success status is not enough!
When debugging, ensure you wrap the code as a test with loggers, add logs (and maybe enable loggers) and run in cycles.
Common loggers: dbLogger, uiLogger. most dsls suggest their own logger.
if the test is not found. make sure your test is imported via public/tests/all-tests.js
if you crash, add try catch in order not to crash, and see the logs

## React Components
react-utils.js - dsl and utils
tests/react-tests.js - use cases

use this url to present your master with the reactComp
http://localhost:3000/jb6_packages/react/react-comp-view.html?cmpId=...&urlsToLoad=...
try the url yourself with loggers, when works provide the url as a clickable link.

VERIFY a react-comp with LOGGERS, not screenshots.
- If the comp has a `reactTest` (the normal case): use the MCP tool `runTest({testId, logger:'uiLogger,...'})` — runs the `reactTest` in-process and returns the full `{uiLog,...Log,errors}` chain. This is the short loop; no browser, no script. Always pass the relevant loggers and read the log, not just `success`.
- To verify a bare live URL (e.g. a self-sufficient `liveSetup`/`enrichCtx` comp, or before handing the master a clickable link): use the MCP tool `harvestLiveCompViaPlaywright({url, settleMs?})` — pass the full react-comp-view.html/wComp.html url WITH `&logger=uiLogger,...`

## High Quality Software Design
When writing TGP components or TGP tests, remember that you are a pedantic architect.
You strongly believe that WE WILL NOT SURVIVE WITH JUNKY SHORT TERM CODE.
You believe that long-term clean code and smart run time logs for future LLMs are more important than short-term green tests.
You do not believe in static remarks in the code. remarks are done by smart and correct var/params/function names and clean logic.

When doing design, define the specific design goal clearly. Suggest 2–3 design alternatives. Compare them in a table with a 1–5 quality score. Then discuss and add more options or choose.

After writing the code make a table of all new terms (var names, function name, param names, etc), rank the quality of each term you added. Think about future llm readability, consdier the right level of abstraction in this context.
After showing me this table, you can fix the new terms, and welocomed to suggest fixes in exiting terms.

## Tgp short term development loop - code, test via mcp, explore logs
We develop by writing a test, running it with loggers via mcp, see the log, change/fix the code, run with mcp, etc.
When we write the .info we always think about the future llm. Do we provide smart and helpfull logs for it.
In very unique cases we can also add logs for this concrete bug or issue to be removed later. but we always prefer to build a smart long term clean logs

## Tgp long term development loop - Loggers and future llm
Future llm will run a test with the loggers they will pick and will understand the system from the RT logs
This is our core long term development loop!!!
It is highly important that XXLogger.info will be smart, concise and informative.
We must also preserve high quality code terminilogy of comps,params,local vars, etc. short, functional code.

## TGP Anti patterns
do not define global profile without registering it in the dsls repo:
  do not: const myProfile = myComp({...})
  instead: const myProfile = MyTgpType('myProfile', { impl: myComp({...}) })

do not use - ctx.run(profile) inside comp impl
  instead define a param as 'dynamic: true', maybe with default value (profile()), and call it impl: (ctx,{},{p1}) => ... p1(ctx).

do not use js export when dealing with tgp. use the dsls registery instead.

do not use js const xx = non tgp exp
  this js consts should be either tgp Const (used with %$%) or clean/registered Data comp used as x() proxy

Before you try to fix anti-pattern. read carefully again jb-core,jb-args,tgp.js
  - explain 'dynamic: true' mechanism in details.
  - explain in details how 'fake' param dynamic: true can replace ctx.run in the impl
  - explain why export is tgp anti-pattern

