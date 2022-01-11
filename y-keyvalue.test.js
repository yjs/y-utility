
import * as Y from 'yjs'
import { YKeyValue } from './y-keyvalue.js'
import * as t from 'lib0/testing'
import * as prng from 'lib0/prng'

export const testLogging = () => {
  const ydoc = new Y.Doc()
  ydoc.clientID = 0 // forces the other client to have a higher clientid
  const yarr = ydoc.getArray()
  const ykv = new YKeyValue(yarr)

  /**
   * @type {any}
   */
  let lastEvent = null
  // @ts-ignore
  ykv.on('change', changes => {
    console.log(changes)
    lastEvent = changes.get('key1')
  })

  ykv.set('key1', 'val1')
  t.compare(lastEvent, { action: 'add', newValue: 'val1' })
  ykv.set('key1', 'updated')
  t.compare(lastEvent, { action: 'update', newValue: 'updated', oldValue: 'val1' })
  ykv.delete('key1')
  t.compare(lastEvent, { action: 'delete', oldValue: 'updated' })
  ykv.set('key1', 'new')
  t.compare(lastEvent, { action: 'add', newValue: 'new' })

  const ydoc2 = new Y.Doc()
  const yarr2 = ydoc2.getArray()
  const ykv2 = new YKeyValue(yarr2)
  ykv2.set('key1', 'overwritten')
  Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(ydoc2))
  t.compare(lastEvent, { action: 'update', oldValue: 'new', newValue: 'overwritten' })

  t.assert(ykv.get('key1') === 'overwritten')
  t.assert(ykv.yarray.length === 1)
}

const numOfUpdates = 100000
const numOfKeys = 100

/**
 * @param {t.TestCase} tc
 */
export const testPerfYMap = tc => {
  const ydoc = new Y.Doc()
  const ykv = ydoc.getMap()
  const time = t.measureTime(`writing ${numOfUpdates / 1000}k updates on ${numOfKeys} keys`, () => {
    for (let i = 0; i < numOfUpdates; i++) {
      const key = prng.uint32(tc.prng, 0, numOfKeys - 1) + ''
      const val = i + ''
      ykv.set(key, val)
    }
  })
  t.assert(ykv.size === numOfKeys)
  t.info(`Size of the encoded document: ${Y.encodeStateAsUpdate(ydoc).length}`)
  t.info(`Time per op: ${Math.round(time / numOfUpdates)}`)
}

/**
 * @param {t.TestCase} tc
 */
export const testPerfKv = tc => {
  const ydoc = new Y.Doc()
  const yarr = ydoc.getArray()
  const ykv = new YKeyValue(yarr)
  const time = t.measureTime(`writing ${numOfUpdates / 1000}k updates on ${numOfKeys} keys`, () => {
    for (let i = 0; i < numOfUpdates; i++) {
      const key = prng.uint32(tc.prng, 0, numOfKeys - 1) + ''
      const val = i + ''
      ykv.set(key, val)
    }
  })
  t.assert(ykv.yarray.length === numOfKeys)
  t.assert(ykv.map.size === numOfKeys)
  t.info(`Size of the encoded document: ${Y.encodeStateAsUpdate(ydoc).length}`)
  t.info(`Time per op: ${Math.round(time / numOfUpdates)}`)
}
