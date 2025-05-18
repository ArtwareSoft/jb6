#!/usr/bin/env node

import { runTests } from '@jb6/testers'

if (process.argv.length < 3) {
    console.error('Usage: node run-tests-cli.js <module-path> [--test=<testName>] [--not=<pattern>] [--pattern=<pattern>] [--take=<number>]')
    process.exit(1)
}
const cliParams = process.argv.slice(3).reduce((acc, arg) => {
    const [key, value] = arg.split('=')
    if (key.startsWith('--'))
        acc[key.slice(2)] = value
    return acc
}, {})

const params = { 
    specificTest: cliParams.test,
    notPattern: cliParams.not,
    ...Object.fromEntries(['pattern','take'].map(x=>[x,cliParams[x]]))
}

let importPath = process.argv[2]
if (process.argv.length < 3) {
    console.error('Usage: node run-tests-cli.js <module-path>');
    process.exit(1);
}
importPath = importPath == 'all' ? '@jb6/testers/all-tests.js' : importPath

const resolvedPath = importPath.startsWith('.')
  ? new URL(importPath, `file://${process.cwd()}/`).href
  : importPath;

import(resolvedPath).then(() => runTests(params)).catch(error =>
    console.error(`Failed to import module: ${resolvedPath}`, error))


