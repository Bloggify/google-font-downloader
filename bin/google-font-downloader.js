#!/usr/bin/env node

"use strict";

const Tilda = require("tilda")
    , WritableStream = require("streamp").writable
    , tinyreq = require("tinyreq")
    , matchAll = require("match-all")
    ;

const USER_AGENT =  "User-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.181 Safari/537.36"

new Tilda(`${__dirname}/../package.json`, {
    args: [
        {
            name: "url"
          , desc: "The Google APIs url."
          , required: true
        }
    ],
    examples: [
        "google-font-downloader https://fonts.googleapis.com/css?family=Open+Sans:400,400i,700,700i",
        "google-font-downloader https://fonts.googleapis.com/css?family=Open+Sans -d=custom/path",
        "google-font-downloader https://fonts.googleapis.com/css?family=Open+Sans -t=0",
        "google-font-downloader https://fonts.googleapis.com/css?family=Open+Sans -s=1",
        "google-font-downloader https://fonts.googleapis.com/css2?family=Overpass:wght@100..900&family=Red+Hat+Display:wght@300..900&family=Permanent+Marker&display=swap -d=custom/path -t=0 -s=1",
    ]
}).option([
    {
        opts: ["directory", "d"],
        desc: "Directory where files are stored",
        name: "directory",
        default: "./fonts",
    }, {
        opts: ["timestamp", "t"],
        desc: "Add a timestamp to the stylesheet file (default: 1)",
        name: "timestamp",
        default: 1,
    }, {
        opts: ["scss", "s"],
        desc: "Use a scss-extension for the stylesheet for inclusion in a scss-project (default: 0)",
        name: "scss",
        default: 0,
    }
]).main(action => {
    const url = action.args.url
    const directory = action.options.directory.value
    const timestamp = action.options.timestamp.value
    const scss = action.options.scss.value
    const data = {}
    console.log(`Getting the external CSS: ${url}`)
    tinyreq({
        url,
        headers: {
            "user-agent": USER_AGENT
        }
    }).then(body => {
        const matchFontFilesRegex = /url\((https\:\/\/fonts\.gstatic\.com\/.*)\) format/gm

        data.original_stylesheet = body
        data.local_stylesheet = body
        data.font_urls = matchAll(body, matchFontFilesRegex).toArray()
        data.local_font_paths = data.font_urls.map(c => `${directory}/${c.split("/").slice(4).join("/")}`)
        data.style_sheet_paths = data.font_urls.map(c => `./${c.split("/").slice(4).join("/")}`)
        data.fonts = data.font_urls.map((c, index) => ({
            remote: c,
            local: data.local_font_paths[index],
            stylesheet: data.style_sheet_paths[index],
        }))

        console.log(`Detected ${data.fonts.length} font files to download.`)
        return Promise.all(data.fonts.map(c => {
            data.local_stylesheet = data.local_stylesheet.replace(c.remote, c.stylesheet)
            return new Promise(res => {
                const req = tinyreq({ url: c.remote, encoding: null, headers: { "user-agent": USER_AGENT } })
                    , stream = new WritableStream(c.local)

                req.on("data", data => {
                    stream.write(data)
                }).on("error", e => {
                    console.error("Failed to download " + c.remote)
                    console.error(e)
                    res()
                }).on("end", () => {
                    console.log(`Downloaded ${c.remote} in ${c.local}`)
                    stream.end()
                    res()
                })
            })
        }))
    }).then(() => {
        const ts = timestamp ? `-${Date.now()}` : '';
        const ext = scss ? 'scss' : 'css';
        const fileName = `${directory}/google-fonts${ts}.${ext}`
            , cssStream = new WritableStream(fileName)

        console.log(`Writting the CSS into ${fileName}`)
        cssStream.end(data.local_stylesheet)
    })
});
