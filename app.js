#!/usr/bin/env node

var app = require('express')()
var jsend = require('jsend')
var superagent = require('superagent')
var level = require('level')
var Queue = require('./queue')
var THROTTLE = 500
var DEFAULT_PORT = 62362
var argv = require('minimist')(process.argv.slice(2))
var port = parseInt(argv._[0], 10) || DEFAULT_PORT
var dbPath = argv.db || './blockr.db'
var db = level(dbPath, {
  valueEncoding: 'json'
})

var queue = new Queue(THROTTLE)

app.get('/', function (req, res) {
  var url = req.query.url
  if (!isCacheable(url)) {
    return queue.push(function (cb) {
      fetch(url, function (err, _res) {
        cb(err)

        if (err) return fail(work.res, err.message)

        res.send(_res.body)
      })
    })
  }

  var split = toUrls(url)
  getCached(split, function (results) {
    var missing = split
      .filter(function (r, i) {
        return !results[i]
      })

    if (!missing.length) return success()

    queue.push(function (cb) {
      fetch(toUrl(missing), function (err, res) {
        cb(err)

        if (err) return fail(res, err.message)

        var status = res.body.status
        var data = res.body.data
        if (status !== 'success') return fail(res, data)

        if (!Array.isArray(data)) data = [data]

        for (var i = 0, j = 0; i < results.length; i++) {
          if (!results[i]) {
            // var url = base + '/' + ids[i]
            results[i] = data[j++]
          }
        }

        success()
        db.batch(data.map(function (item, i) {
          return { type: 'put', key: missing[i], value: item }
        }), function (err) {
          if (err) console.log('Failed to store retrieved data', err)
        })
      })
    })

    function success () {
      res.send(jsend.success(results.length === 1 ? results[0] : results))
    }
  })
})

app.listen(port)

function isCacheable (url) {
  var match = url.match(/([a-zA-Z]+)\.blockr.io\/api\/v\d+\/(block|tx)\/(info|raw)\/([^\?]+)$/)
  return match && match[4] && match[4].split(/\s+/).indexOf('last') === -1
}

function fail (res, msg) {
  return res.send(jsend.fail({ error: msg }))
}

function getBase (url) {
  return url.slice(0, url.lastIndexOf('/'))
}

function toUrls (url) {
  var base = getBase(url)
  var ids = url.slice(base.length + 1).split(',')
  return ids.map(function (id) {
    return base + '/' + id
  })
}

function toUrl (urls) {
  var base = getBase(urls[0])
  return base + '/' + urls.map(function (url) {
    return url.slice(base.length + 1)
  }).join(',')
}

function getCached (urls, cb) {
  var togo = urls.length
  var results = urls.map(function () { return null })
  urls.forEach(function (url, i) {
    db.get(url, function (err, info) {
      results[i] = info
      if (--togo === 0) cb(results)
    })
  })
}

function fetch (url, cb) {
  return superagent.get(url).end(cb)
}
