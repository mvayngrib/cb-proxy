
var throttle = require('throttleme')

module.exports = Queue

function Queue(wait) {
  this._period = wait
  this._processOne = throttle(this._processOne, wait)
  this._queue = []
}

Queue.prototype.push = function (task) {
  this._queue.push(task)
  this._process()
}

Queue.prototype._process = function () {
  if (this._processing || !this._queue.length || this._paused) return

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

Queue.prototype.pause = function () {
  this._paused = true
}

Queue.prototype.resume = function () {
  this._paused = false
  this._process()
}

Queue.prototype.waitTime = function () {
  return this._queue.length * this._period
}
