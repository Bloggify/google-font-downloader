#!/usr/bin/env node


"use strict";

var Tilda = require("tilda"),
    WritableStream = require("streamp").writable,
    tinyreq = require("tinyreq"),
    matchAll = require("match-all");

var USER_AGENT = "User-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.181 Safari/537.36";

new Tilda(__dirname + "/../package.json", {
    args: [{
        name: "url",
        desc: "The Google APIs url.",
        required: true
    },
	{
        name: "css",
        desc: "The CSS file name [optional].",
        required: false
    }],
    examples: ["google-font-downloader https://fonts.googleapis.com/css?family=Open+Sans:400,400i,700,700i"]
}).main(function (action) {
    var url = action.args.url;
    var data = {};
    console.log("Getting the external CSS: " + url);
    tinyreq({
        url: url,
        headers: {
            "user-agent": USER_AGENT
        }
    }).then(function (body) {
        var matchFontFilesRegex = /url\((https\:\/\/fonts\.gstatic\.com\/.*)\) format/gm;

        data.original_stylesheet = body;
        data.local_stylesheet = body;
        data.font_urls = matchAll(body, matchFontFilesRegex).toArray();
        data.local_font_paths = data.font_urls.map(function (c) {
            return "fonts/" + c.split("/").slice(4).join("/");
        });
        data.fonts = data.font_urls.map(function (c, index) {
            return {
                remote: c,
                local: data.local_font_paths[index]
            };
        });

        console.log("Detected " + data.fonts.length + " font files to download.");
        return Promise.all(data.fonts.map(function (c) {
            data.local_stylesheet = data.local_stylesheet.replace(c.remote, c.local);
            return new Promise(function (res) {
                var req = tinyreq({ url: c.remote, encoding: null, headers: { "user-agent": USER_AGENT } }),
                    stream = new WritableStream(c.local);

                req.on("data", function (data) {
                    stream.write(data);
                }).on("error", function (e) {
                    console.error("Failed to download " + c.remote);
                    console.error(e);
                    res();
                }).on("end", function () {
                    console.log("Downloaded " + c.remote + " in " + c.local);
                    stream.end();
                    res();
                });
            });
        }));
    }).then(function () {
		var cssFileName = action.args.css;
		if (!cssFileName)
		{	
			cssFileName = "google-fonts-" + Date.now() + ".css";
		}
		var fileName = cssFileName, cssStream = new WritableStream(fileName);
        console.log("Writting the CSS into " + fileName);
        cssStream.end(data.local_stylesheet);
    });
});