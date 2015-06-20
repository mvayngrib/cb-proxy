
var from = parseInt(process.argv[2] || 0, 10)
var debug = require('debug')('clone-blockr')
var Blockchain = require('cb-blockr')
var blockchain = new Blockchain('testnet', 'http://localhost:62362/?url=')
var batchSize = 10

function next () {
  var heights = []
  for (var i = 0; i < batchSize; i++) {
    heights.push(from + i)
  }

  blockchain.blocks.get(heights, function (err, blocks) {
    var loaded = 0
    if (blocks) {
      // count the ones we loaded
      blocks.every(function (b) {
        if (b) {
          loaded++
          return true
        }
      })
    }

    debug('loaded ' + loaded + ' blocks')
    from += loaded
    next()
  })
}

next()
