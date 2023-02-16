# Webflow Downloader

Takes snapshot of webflow pages and makes it offline so that those pages can be hosted somewhere else

### Env Requirements

- Node 14+
- npm/yarn

### Setup guide

- First download/clone the repo locally
- Open terminal in the folder or `cd` into the folder
- Run `npm install` to install dependencies

### Download your pages hosted on Webflow

Once the project setup is complete:

- Add URLs of your pages to urls array in `download.js` file

```js
// download.js
const urls = ["https://webflow.com"] // add your URLs here
// ...
```

- Run `node download.js` on the terminal to start download

### Use it as a package in another project

Added the package to your project

```shell
npm i webflow-downloader
```

You can import the package by requiring it

```javascript
// import the package
const downloadWebsite = require("webflow-downloader")
const urls = ["https://webflow.com", "https://webflow.com/about"]

// invoke the package and pass URLs
downloadWebsite(urls)

// only downloads assets hosted on webflow by passing the assets domain to the function
const assetDomains = ["https://assets.website-files.com"]
downloadWebsite(urls, assetDomains)

// customize download folder name by passing the folder name
const downloadFolder = "Website" // <= default
downloadWebsite(urls, assetDomains, downloadFolder)
```

### Limitations

- It doesn't load/render the html pages to find the links, instead it uses regular expression to find the links and fetches those assets
- It only matches asset path with full url, which means if the asset path is a relative path then it will not fetch that asset
- It doesn't look into js files for links as simple text replace might break the page, it's better to replace the assets manually after downloading

Eg:

```html
<!-- ✅ it will fetch this asset -->
<img src="https://webflow.com/my-image.png" />

<!-- ❌ won't match -->
<img src="/my-image.png" />
```

### Contributing

Feel free to update this as required

Made with ❤ by <a href="https://github.com/RatnadeepBiswakarma">Ratnadeep</a>
