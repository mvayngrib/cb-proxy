
var throttle = require('throttleme')

module.exports = Queue

function Queue(wait) {
  this._processOne = throttle(this._processOne, wait)
  this._queue = []
}

Queue.prototype.push = function (url, cb) {
  this._queue.push(url)
  this._process()
}

Queue.prototype._process = function () {
  if (this._processing || !this._queue.length) return

  this._processOne()
}

Queue.prototype._processOne = function () {
  var self = this
  this._processing = true

  var worker = this._queue.shift()
  worker(function () {
    self._processing = false
    self._process()
  })
}
