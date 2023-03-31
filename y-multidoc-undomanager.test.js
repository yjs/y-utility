import * as Y from 'yjs'
import * as t from 'lib0/testing'
import { YMultiDocUndoManager } from './y-multidoc-undomanager.js'

/**
 * @param {t.TestCase} _tc
 */
export const testUndo = _tc => {
  const um = new YMultiDocUndoManager()
  const ydoc1 = new Y.Doc()
  const ydoc2 = new Y.Doc()
  const ytype1 = ydoc1.getText()
  const ytype2 = ydoc2.getText()
  um.addToScope([ytype1, ytype2])
  ytype1.insert(0, 'abc')
  ytype2.insert(0, 'xyz')
  t.assert(um.undoStack.length === 2)
  t.assert(um.canUndo())
  t.assert(!um.canRedo())
  um.undo()
  t.assert(um.canUndo())
  t.assert(um.canRedo())
  t.assert(ytype1.toString() === 'abc')
  t.assert(ytype2.toString() === '')
  um.undo()
  t.assert(!um.canUndo())
  t.assert(um.canRedo())
  t.assert(ytype1.toString() === '')
  t.assert(ytype2.toString() === '')
  // shouldn't have any effect
  um.undo()
  t.assert(!um.canUndo())
  t.assert(um.canRedo())
  t.assert(ytype1.toString() === '')
  t.assert(ytype2.toString() === '')
  um.redo()
  t.assert(um.canUndo())
  t.assert(um.canRedo())
  t.assert(ytype1.toString() === 'abc')
  t.assert(ytype2.toString() === '')
  um.redo()
  t.assert(um.canUndo())
  t.assert(!um.canRedo())
  t.assert(ytype1.toString() === 'abc')
  t.assert(ytype2.toString() === 'xyz')
  t.assert(um.undoStack.length === 2)
}

/**
 * @param {t.TestCase} _tc
 */
export const testUndoMap = _tc => {
  const ydoc1 = new Y.Doc()
  const ymap = ydoc1.getMap()
  const um = new YMultiDocUndoManager([ymap], {
    trackedOrigins: new Set(['this-client'])
  })

  ydoc1.transact(_tr => {
    ymap.set('a', 1)
  }, 'this-client')

  t.assert(ymap.get('a') === 1)
  um.undo()
  t.assert(ymap.get('a') === undefined)
  um.redo()
  t.assert(ymap.get('a') === 1)
}

/**
 * @param {t.TestCase} _tc
 */
export const testUndoEvents = _tc => {
  const undoManager = new YMultiDocUndoManager()
  const ydoc1 = new Y.Doc()
  const text0 = ydoc1.getText()
  undoManager.addToScope([text0])
  let counter = 0
  let receivedMetadata = -1
  let itemUpdated = false
  undoManager.on('stack-item-added', /** @param {any} event */ event => {
    t.assert(event.type != null)
    t.assert(event.changedParentTypes != null && event.changedParentTypes.has(text0))
    event.stackItem.meta.set('test', counter++)
  })
  undoManager.on('stack-item-updated', /** @param {any} _event */ _event => {
    itemUpdated = true
  })
  undoManager.on('stack-item-popped', /** @param {any} event */ event => {
    t.assert(event.type != null)
    t.assert(event.changedParentTypes != null && event.changedParentTypes.has(text0))
    receivedMetadata = event.stackItem.meta.get('test')
  })
  t.assert(!itemUpdated)
  text0.insert(0, 'abc')
  t.assert(!itemUpdated)
  text0.insert(0, 'abc')
  t.assert(itemUpdated)
  undoManager.undo()
  t.assert(receivedMetadata === 0)
  undoManager.redo()
  t.assert(receivedMetadata === 1)
}

/**
 * @param {t.TestCase} _tc
 */
export const testUndoAfterChangeAfterUndo = _tc => {
  const um = new YMultiDocUndoManager([], { captureTimeout: -1 })
  const ydoc1 = new Y.Doc()
  const ytype1 = ydoc1.getText()
  um.addToScope([ytype1])
  ytype1.insert(0, 'a')
  t.assert(ytype1.toString() === 'a')
  t.assert(um.undoStack.length === 1)
  ytype1.insert(1, 'b')
  t.assert(ytype1.toString() === 'ab')
  t.assert(um.undoStack.length === 2)
  ytype1.insert(2, 'c')
  t.assert(ytype1.toString() === 'abc')
  t.assert(um.undoStack.length === 3)
  um.undo()
  t.assert(ytype1.toString() === 'ab')
  t.assert(um.undoStack.length === 2)
  ytype1.insert(2, 'x')
  t.assert(ytype1.toString() === 'abx')
  t.assert(um.undoStack.length === 3)
  um.undo()
  t.assert(ytype1.toString() === 'ab')
  t.assert(um.undoStack.length === 2)
  um.undo()
  t.assert(ytype1.toString() === 'a')
  t.assert(um.undoStack.length === 1)
}

/**
 * @param {t.TestCase} _tc
 */
export const testAfterDestroy = _tc => {
  const um = new YMultiDocUndoManager([], { captureTimeout: -1 })
  const ydoc1 = new Y.Doc()
  const ytype1 = ydoc1.getText()
  const ydoc2 = new Y.Doc()
  const ytype2 = ydoc2.getText()
  um.addToScope([ytype1])
  um.addToScope([ytype2])
  um.addToScope(ytype1) // doing this twice for test-coverage
  ytype1.insert(0, 'a')
  ytype2.insert(0, 'b')
  t.assert(ytype1.toString() === 'a')
  ydoc2.destroy()
  t.assert(!um.docs.has(ydoc2))
  um.undo()
  t.assert(ytype1.toString() === '')
  um.destroy()
}
