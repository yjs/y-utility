import { runTests } from 'lib0/testing'
import * as kv from './y-keyvalue.test.js'
import * as log from 'lib0/logging'

import { isBrowser, isNode } from 'lib0/environment'

/* istanbul ignore if */
if (isBrowser) {
  log.createVConsole(document.body)
}

runTests({
  kv
}).then(success => {
  /* istanbul ignore next */
  if (isNode) {
    process.exit(success ? 0 : 1)
  }
})
