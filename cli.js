#!/usr/bin/env node
const downloadWebsite = require("./index.js")
downloadWebsite(String(process.argv[2]), process.argv.slice(3))
