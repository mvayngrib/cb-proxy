#!/usr/bin/env node

var app = require('express')()
var CBProxy = require('./index')
var DEFAULT_PORT = 62362
var argv = require('minimist')(process.argv.slice(2), {
  alias: {
    p: 'port',
    c: 'cache-path'
  }
})

var port = argv.port || DEFAULT_PORT
app.listen(port)

var proxy = new CBProxy({
  router: app,
  path: argv['cache-path']
})

var exiting
process.on('exit', cleanup)
process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)
process.on('uncaughtException', function (err) {
  console.log('Uncaught exception, caught in process catch-all: ' + err.message)
  console.log(err.stack)
})

function cleanup () {
  if (exiting) return

  exiting = true
  proxy.destroy(function () {
    process.exit()
  })

  // just in case
  setTimeout(process.exit.bind(1), 5000)
}
