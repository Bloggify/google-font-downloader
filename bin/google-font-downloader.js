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
        "google-font-downloader https://fonts.googleapis.com/css?family=Open+Sans:400,400i,700,700i"
    ]
}).main(action => {
    const url = action.args.url
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
        data.local_font_paths = data.font_urls.map(c => `fonts/${c.split("/").slice(4).join("/")}`)
        data.fonts = data.font_urls.map((c, index) => ({
            remote: c,
            local: data.local_font_paths[index]
        }))

        console.log(`Detected ${data.fonts.length} font files to download.`)
        return Promise.all(data.fonts.map(c => {
            data.local_stylesheet = data.local_stylesheet.replace(c.remote, c.local)
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
        const fileName = `google-fonts-${Date.now()}.css`
            , cssStream = new WritableStream(fileName)

        console.log(`Writting the CSS into ${fileName}`)
        cssStream.end(data.local_stylesheet)
    })
});
