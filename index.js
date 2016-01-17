
var fs = require('fs')
var debug = require('debug')('cb-proxy')
var jsend = require('jsend')
var superagent = require('superagent')
var typeforce = require('typeforce')
var Cache = require('lru-cache')
var extend = require('xtend')
var pick = require('object.pick')
var Queue = require('./queue')
var THROTTLE = 100
var DEFAULT_SAVE_INTERVAL = 60000
var REJECT_WAIT_TIME = 3000
var PAUSE_TIME = 300000
var CACHE_DEFAULTS = {
  maxAge: 300000,
  max: 10000
}

var noop = function () {}

module.exports = function (opts) {
  typeforce({
    router: typeforce.oneOf('EventEmitter', 'Function'),
    path: 'String',
    throttle: '?Number',
    max: '?Number',
    maxAge: '?Number'
  }, opts)

  var cachePath = opts.path
  var cache = new Cache(extend(CACHE_DEFAULTS, pick(opts, ['max', 'maxAge'])))

  try {
    var savedCached = fs.readFileSync(cachePath)
    if (savedCached) {
      cache.load(JSON.parse(savedCached))
    }
  } catch (err) {}

  var resumeTimeout
  var needsWriteToDisk
  var saveInterval = setInterval(saveToDisk, DEFAULT_SAVE_INTERVAL)

  var throttle = isNaN(opts.throttle) ? THROTTLE : opts.throttle
  var router = opts.router
  var queue = new Queue(throttle)
  router.get('/', function (req, res) {
    var waitTime = queue.waitTime()
    var url = req.query.url.replace('http:', 'https:')
    if (!isCacheable(url)) {
      if (waitTime > REJECT_WAIT_TIME) {
        return failTooMany(res)
      }

      debug('queuing', url)
      return queue.push(function (cb) {
        fetch(url, function (err, _res) {
          cb(err)

          if (err) return fail(res, err.message)

          res.send(_res.body)
        })
      })
    }

    var split = toUrls(url)
    // don't update the lru-ness with cache.get()
    var results = split.map(cache.peek, cache)
    var missing = split
      .filter(function (r, i) {
        return !results[i]
      })

    if (!missing.length) return success()

    if (waitTime > REJECT_WAIT_TIME) {
      return failTooMany(res)
    }

    debug('fetching', missing)
    queue.push(function (cb) {
      fetch(toUrl(missing), function (err, _res) {
        cb(err)

        if (err && /many requests/i.test(err.message)) {
          debug('got throttled, pausing for', PAUSE_TIME, 'ms')
          queue.pause()
          // wait five minutes
          clearTimeout(resumeTimeout)
          resumeTimeout = setTimeout(queue.resume.bind(queue), PAUSE_TIME).unref()
        }

        if (err) return fail(res, err.message)

        var status = _res.body.status
        var data = _res.body.data
        if (status !== 'success') return fail(res, data)

        if (!Array.isArray(data)) data = [data]

        for (var i = 0, j = 0; i < results.length; i++) {
          if (!results[i]) {
            results[i] = data[j++]
          }
        }

        success()
        debug('saving', missing)
        data.forEach(function (item, i) {
          needsWriteToDisk = cache.set(missing[i], item) || needsWriteToDisk
        })
      })
    })

    function success () {
      res.send(jsend.success(results.length === 1 ? results[0] : results))
    }
  })

  function saveToDisk (cb) {
    cb = cb || noop
    if (needsWriteToDisk) {
      debug('saving to disk')
      needsWriteToDisk = false
      fs.writeFile(cachePath, JSON.stringify(cache.dump()), cb)
    } else {
      cb()
    }
  }

  return {
    destroy: function (cb) {
      clearTimeout(resumeTimeout)
      clearInterval(saveInterval)
      return saveToDisk(cb)
    }
  }
}

function isCacheable (url) {
  var match = url.match(/([a-zA-Z]+)\.blockr.io\/api\/v\d+\/(address|block|tx)\/(unconfirmed\/)?(txs|info|raw)\/([^\?]+)$/)
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

function fetch (url, cb) {
  debug('fetching', url)
  return superagent.get(url).end(cb)
}

function failTooMany (res) {
  res.status(400).json(jsend.fail({
    message: 'Too many requests'
  }))
}
