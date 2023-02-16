const downloadWebsite = require("./index.js")
const urls = ["https://webflow.com"]

downloadWebsite(urls, [
  "https://assets.website-files.com",
  "https://assets-global.website-files.com",
])
