const fs = require("fs")
const glob = require("glob")
const path = require("path")
const axios = require("axios")
const { SingleBar, Presets } = require("cli-progress")
const replace = require("replace-in-file")

const log = console.log

class Downloader {
  constructor(urls, assetsDomains, downloadFolder) {
    this.urls = urls
    this.downloadFolder = downloadFolder || "Website"
    this.allAssets = new Map()
    this.assetIterator = null
    this.assetsFolder = "assets"
    this.assetsDomains = assetsDomains
    this.assetDownloadCount = 0
    this.assetDownloadStatus = new Map()
    this.urlRegex = /\b(https?:\/\/[^\s]+\.[a-zA-Z]{2,})\b/g
    this.progress = new SingleBar({}, Presets.shades_classic)
  }

  escapeRegExpChars(text) {
    /* https://stackoverflow.com/a/9310752 */
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&")
  }

  getFileNameFromURL(url = "") {
    let { pathname } = new URL(url)
    if (pathname.endsWith("/")) {
      pathname = pathname.substring(0, pathname.lastIndexOf("/"))
    }
    return pathname.substring(pathname.lastIndexOf("/") + 1) || "index" // default
  }

  getNestedFolder(url) {
    let { pathname } = new URL(url)
    if (pathname.startsWith("/")) {
      // remove starting slash
      pathname = pathname.replace("/", "")
    }
    if (pathname.endsWith("/")) {
      // remove trailing slash
      pathname = pathname.substring(0, pathname.lastIndexOf("/"))
    }

    const fileName = this.getFileNameFromURL(url)
    return pathname.replace(fileName, "")
  }

  getArraySegment(arr, start = 0, end) {
    return arr.slice(start, end)
  }

  outputFailedAssets() {
    if (this.assetDownloadStatus.size > 0) {
      let failed = []
      this.assetDownloadStatus.forEach(item => {
        if (item.status !== 200) {
          failed.push(item)
        }
      })
      if (failed.length > 0) {
        log("\nAssets failed to download:")
        console.table(failed)
      }
    }
  }

  async downloadPage(url) {
    const { data } = await axios.get(url)
    const nestedDir = this.getNestedFolder(url)
    if (nestedDir && !fs.existsSync(nestedDir)) {
      fs.mkdirSync(path.join(this.downloadFolder, nestedDir), {
        recursive: true,
      })
    }

    const fileName = `${this.getFileNameFromURL(url)}.html`

    const filePath = nestedDir
      ? path.join(this.downloadFolder, nestedDir, fileName)
      : path.join(this.downloadFolder, fileName)

    await fs.promises.writeFile(filePath, data)
    return data
  }

  updateURLsInLocalFile() {
    log("Updating links with local assets, please wait...")
    let replaceMap = new Map() // {url: localFilePath}

    this.allAssets.forEach((urls, fileName) => {
      const filePath = path.join(this.assetsFolder, fileName)
      urls.forEach(url => {
        replaceMap.set(url, filePath)
      })
    })

    replace.sync({
      files: [
        `${this.downloadFolder}/**.html`,
        `${this.downloadFolder}/**/**.html`,
        `${this.downloadFolder}/assets/**.css`,
      ],
      processor: input => {
        replaceMap.forEach((filePath, url) => {
          // escape regex reserved characters otherwise replace won't work properly
          let safeUrl = this.escapeRegExpChars(url)
          let regexp = new RegExp(safeUrl, "g")
          input = input.replace(regexp, `/${filePath}`)
        })
        return input
      },
    })
    log("The pages are ready to work offline")
  }

  checkCssFileForLinks(path) {
    const files = glob.sync(path)
    if (files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        let data = fs.readFileSync(files[i]).toString()
        this.findAllAssetsToDownload(data)
        log("\n\nUpdated assets list from css file")
        log(`\nDownloading ${this.allAssets.size} assets`)
        this.progress.start(this.allAssets.size, this.assetDownloadCount)
      }
    }
  }

  findAllAssetsToDownload(html) {
    // match any url which ends with extensions eg: .jpg, .js, .svg
    let assets = html.match(this.urlRegex) || []

    // filter assets by domain as shared by user
    if (this.assetsDomains?.length > 0) {
      assets = assets.filter(item =>
        this.assetsDomains.find(domain => item.startsWith(domain))
      )
    }

    assets.forEach(url => {
      const fileName = this.getFileNameFromURL(url)
      if (this.allAssets.has(fileName)) {
        const update = [...this.allAssets.get(fileName), url]
        this.allAssets.set(fileName, update)
      } else {
        this.allAssets.set(fileName, [url])
      }
    })
  }

  checkAndGotoNextDownload() {
    if (this.assetDownloadStatus.size === this.allAssets.size) {
      log("\n\nDownloaded all assets")
      this.progress.stop()
      this.updateURLsInLocalFile()

      this.outputFailedAssets()
    } else {
      setTimeout(() => {
        this.downloadAssets()
      }, 1000)
    }
  }

  downloadAssets() {
    // exit condition of this recursive function
    const value = this.assetIterator.next().value
    if (!value) {
      return
    }

    const [fileName, urls] = value
    const url = urls[0]
    // create the file path for individual assets
    const assetPath = path.join(
      this.downloadFolder,
      this.assetsFolder,
      fileName
    )
    // create the directory if not present
    const assetDir = path.dirname(assetPath)
    if (!fs.existsSync(assetDir)) {
      fs.mkdirSync(assetDir, { recursive: true })
    }
    axios
      .get(url, {
        responseType: "stream",
      })
      .then(response => {
        const writer = fs.createWriteStream(assetPath)
        writer.on("finish", () => {
          this.assetDownloadCount++
          this.progress.update(this.assetDownloadCount)
          this.assetDownloadStatus.set(url, {
            fileName,
            status: 200,
          })
          if (url.endsWith(".css")) {
            this.checkCssFileForLinks(assetPath)
          }
          this.checkAndGotoNextDownload()
        })
        response.data.pipe(writer)
      })
      .catch(error => {
        this.assetDownloadStatus.set(url, {
          fileName,
          status: error?.response?.status || 400,
        })
        this.assetDownloadCount++

        this.checkAndGotoNextDownload()
      })
  }

  async initialize() {
    if (fs.existsSync(this.downloadFolder)) {
      console.error(
        `"${this.downloadFolder}" folder is already present, please move/delete the folder first`
      )
      return
    }
    fs.mkdirSync(this.downloadFolder, { recursive: true })

    log("Downloading web pages")
    this.progress.start(this.urls.length)

    for (const url of this.urls) {
      const html = await this.downloadPage(url)
      this.findAllAssetsToDownload(html)
      this.progress.increment()
    }
    this.progress.stop()
    this.assetIterator = this.allAssets.entries()

    /* Download assets */
    log(`\nDownloading ${this.allAssets.size} assets`)
    this.progress.start(this.allAssets.size)

    // start 10 instance of downloader
    for (let i = 0; i < 10; i++) {
      this.downloadAssets()
    }
  }
}

module.exports = function downloadWebsite(
  pageURLs,
  assetsDomains = ["https://assets.website-files.com"],
  downloadFolder
) {
  if (!pageURLs || pageURLs === "undefined") {
    console.error(
      "PageURLs must have the url or list of urls of the pages you want to download"
    )
    return
  }

  pageURLs = typeof pageURLs === "string" ? [pageURLs] : pageURLs
  assetsDomains =
    typeof assetsDomains === "string" ? [assetsDomains] : assetsDomains

  new Downloader(pageURLs, assetsDomains, downloadFolder).initialize()
}
