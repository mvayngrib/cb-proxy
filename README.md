# cb-proxy

_This module is used by [Tradle](https://github.com/tradle/about/wiki)_

Proxy for [common-blockchain](https://github.com/common-blockchain/common-blockchain) APIs, that throttles and stores results of cacheable calls

Helps be a better user of blockchain APIs, and avoid getting throttled

# Motivation

Fetching a raw block from blockr requires upwards of (1 + block.transactions.length) calls, which had me hitting the rate limit almost immediately. This module does basic throttling and stores cacheable results in a local database, to avoid hitting blockr.io more than necessary.

# Support

cb-blockr

# Usage

```bash
# specify port
node app 54545
```

```js
var Blockchain = require('cb-blockr')
var blockchain = new Blockchain('testnet', 'http://localhost:54545/?url=')
```

# Cached paths

blocks/info  
blocks/raw  
tx/info  
tx/raw  
