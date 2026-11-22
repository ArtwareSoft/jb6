# How to upload jb6/react to the cloud

A jb6 react comp is plain ESM plus an import map. A static host that serves files is all it needs - no bundler,
no server, no build. This is how [form-sample.js](./form-sample.js) gets a public url.

## The shape: three lines in the bucket

```
gs://<bucket>/
├── <version>/jb6_packages/   50 files, 460 KB   public, max-age=31536000, immutable
│   └── core/ common/ react/ repo/ + react-comp-page.html
├── metadata/cities.json      reference data the page reads   public, max-age=300
└── data/requests.jsonl       what the app writes             (absent until something writes it)
```

A **version is a package**: an upload writes a whole new directory and never overwrites anything, so `immutable`
is safe - a cached file cannot be wrong, because its url names its content. Code, metadata and data each move on
their own schedule: a code upload never touches `metadata/`, and neither touches `data/`.

Shipping a fix = hand out the new version url. Rolling back = hand out the old one, which keeps serving its own
code until you delete it.

## One command, twice

```bash
DRY_RUN=yes bash scripts/upload-jb-react-to-bucket.sh          # stages, touches no cloud
# harvest the url it prints with the playwrightHarvest mcp tool, read the loggers, then:
BUCKET=<bucket> PROJECT_ID=<project> REACT_LIB_CDN=https://jb6-cdn.pages.dev/ \
  bash scripts/upload-jb-react-to-bucket.sh                    # the real upload
```

`DRY_RUN=yes` stages the exact artifact under `.tmp/upload-stage/$VERSION` with a localhost base url, and the jb6
web server serves it at `/upload-stage/$VERSION` - so the page you test is the page that goes up, with no cloud
account. [upload-jb-react-to-bucket.sh](../../scripts/upload-jb-react-to-bucket.sh) then:

1. rewrites jb6's own import map to this version's urls, filtered to `$PACKAGES`
2. stages the packages, the page with the map inlined, and `$BUCKET_DATA` into `$BUCKET_DATA_DIR` (`metadata`)
3. asserts every `.js` alias in the map points at a file that was really staged
4. creates the bucket if new: `--uniform-bucket-level-access`, `allUsers:objectViewer` (**reads only**), CORS `GET,HEAD`
5. uploads the version `--gzip-in-flight-all --cache-control="public, max-age=31536000, immutable"`
6. uploads the metadata with `max-age=$DATA_MAX_AGE`

GCS does not compress on the fly, hence `--gzip-in-flight-all`: objects are stored gzipped with
`Content-Encoding: gzip` and served that way.

## The import map is the whole trick

Locally the jb6 web server replaces `JB_IMPORT_MAP` in any served `.html` with the repo's map
(`@jb6/core` -> `/jb6_packages/core/index.js`). For the cloud the same map is rewritten to the version's base url
and cut down to the uploaded packages, so an alias in the map means the files are really there:

```json
{"imports": {
  "@jb6/core":  "https://storage.googleapis.com/<bucket>/<version>/jb6_packages/core/index.js",
  "@jb6/core/": "https://storage.googleapis.com/<bucket>/<version>/jb6_packages/core/",
  "@jb6/react/lib/": "https://jb6-cdn.pages.dev/"
}}
```

The page url carries the rest: `?cmpId=<comp>`, `&urlsToLoad=<absolute url of the file that defines it>` (it is
imported by the page, not resolved through the map), and `&ctx-bucketUrl=https://storage.googleapis.com/<bucket>`
- the bucket root, so `metadata/` and `data/` both hang off it.

## What goes up, and what does not

Never uploaded: `node_modules`, `tests`, `*.md`, `*.sh`, and `react/lib` when the cdn is used. `lang-service` is
not needed either - it is pulled in only by `jb-pick-box.js` (the ctrl-J picker) that
[react-comp-view.html](./react-comp-view.html) loads for development. [react-comp-page.html](./react-comp-page.html)
is its published twin: same `?cmpId=&urlsToLoad=` url, 27 requests instead of 33.

## The vendored runtime comes off the cdn

`REACT_LIB_CDN=https://jb6-cdn.pages.dev/` adds one key to the import map, and a longer alias wins, so react,
tailwind and lucide come off the shared cdn while every `@jb6` package stays at your version. The upload drops
from 1.5 MB to 460 KB and that egress is free. No login to *consume* it; a Cloudflare login is only needed to
publish there. The shelf carries vendored libs only - react, tailwind, lucide, codemirror, echarts, reveal.mjs -
never jb6 source, and not everything we vendor (no maplibre, xterm, novnc, reveal css).

## The form reads metadata and writes data

```js
setup: Var('cities', bucket.get('metadata/cities.json')),   // one GET, before the first render
progressIndicator: dots('Loading cities'),                   // shown until it resolves
fields: [
  field('state', 'State', 'Select a state', { options: pipe('%$cities%', '%state%') }),
  field('city',  'City',  'Select a city',  { options: pipe(Var('pickedState', '%state%'), '%$cities%',
                                                            filter('%state% == %$pickedState%'), '%cities%') })
],
onSubmit: bucket.append('data/requests.jsonl')
```

`inputForm` knows nothing about cities or buckets: `setup` is forwarded into `comp`'s `enrichCtx`, which is
async-aware, so the load happens once, off the render path, with the indicator up. `options` is a `dynamic: true`
slot called as `f.options(ctx.setData(record))`, so the city list reads `%state%` out of the record it is handed.
The state-city coupling exists only in the use.

When the metadata is not there, the get is logged to `bucketErrors` and the selects render **no options**,
disabled - an empty picklist, never a blank page.

**`bucket.append` is demo only.** A bucket is a plain object store with no append, so the comp does
read-concat-write: GET the `.jsonl`, add the line, PUT it back. There is no locking, so two concurrent appends
lose a line. That is fine for a demo and for nothing else: in production the append belongs on the server - the
endpoint that authorizes the write serializes the lines (or composes objects) and the page only posts to it.

## Reads are public. Writes are not.

The script grants `allUsers:objectViewer` and never `objectCreator`, so a published form renders everywhere and
any write returns **403**:

```
PUT metadata/cities.json  -> 403
PUT data/requests.jsonl   -> 403
```

The page shows `Write is blocked in this demo: AccessDenied: Access denied.` - the sentence comes from the use
(`failureText`), the rest is the bucket's own `<Code>: <Message>`, which the client pulls out of the xml.

| write option | how | when |
|---|---|---|
| local | `&ctx-bucketUrl=http://localhost:8083/bucket` | development only - the page must also be served from localhost |
| signed url | a tiny endpoint (Cloud Run / Worker) mints a `PUT` signed url per submission, and serializes appends; the bucket stays write-private | production |
| public writes | `allUsers:objectCreator` | never without a lifecycle rule - anyone on the internet can fill it |

Two things that look like options and are not:

- **A page on the bucket cannot write to your localhost simulation.** Chrome blocks it: *"Permission was denied
  for this request to access the `loopback` address space"*.
- **Pre-creating the file does not buy you an append.** Replacing an existing object needs
  `storage.objects.create` **and** `storage.objects.delete`, and `objectCreator` only has create - so with public
  writes anyone could add *new* keys but not change existing ones.

## Can a public bucket be abused, and can a budget stop it?

Not with a hard cap on GCS. A Cloud Billing budget is an **alert**, not a limit - the only way to make it stop
spending is a budget-triggered function that disables billing on the whole project. So the defences are
structural:

- **public reads only** - no `objectCreator` for `allUsers`; uniform bucket-level access on, so no stray object ACLs
- **immutable version prefixes** - repeat viewers hit cache, not the bucket
- **a lifecycle rule** deleting old versions and submissions
- **Cloud CDN in front** if the traffic is real - cache egress is cheaper than bucket egress
- **a budget alert** at a few dollars - it will not stop the bill, it tells you one is starting
- **Cloudflare Pages/R2** when strangers get the link: static requests are free and unlimited there, which is the
  only real protection against a traffic bill (limits: 500 deployments/month, 20,000 files, 25 MiB per file)

The localhost simulation caps what a real bucket cannot: `serve-bucket.js` refuses an object over
`maxObjectBytes` (413) and a bucket over `maxBucketBytes` (507). On a real bucket the signed-url endpoint is the
only place that can rate-limit a writer.

## Verify, never assume

`playwrightHarvest` (an mcp tool, and a `data<common>` comp) loads the url in real chromium, runs a
`ui-action<react>` automation in it and returns `{errors, logs, html, timeline, network}` - read the loggers and
the request statuses, never a screenshot. A healthy published page shows 27 requests to the bucket, 3 to the cdn, `get 200` for
`metadata/cities.json`, `state:20` then `city:4` after picking a state, and - on a read-only bucket - `append 403`
with the blocked message on screen. See
[how-to-develop-jb6-forms-with-claude.md](./how-to-develop-jb6-forms-with-claude.md) for the local loop.

## When it breaks

| symptom | cause |
|---|---|
| 404 on `react-all-19.2.0-dev.mjs` | `react-utils` picks the react build by hostname; localhost wants dev, the cloud wants prod. The dry run stages both, the upload ships prod |
| `failed: <?xml version=...` | a bucket answers errors in xml; the client keeps `<Code>: <Message>` instead of parsing json |
| `blocked by CORS policy: ... loopback address space` | a cloud page reaching for localhost - see above |
| `HTTPError 403: The billing account ... is disabled` | bucket creation needs an active billing account on that project |
| the selects say **no options** | `ctx-bucketUrl` points somewhere without `metadata/cities.json`; look in `bucketErrors` |
