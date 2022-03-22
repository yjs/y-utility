import * as Y from 'yjs'
import * as t from 'lib0/testing'
import { MultiDocUndoManager } from './y-multidoc-undomanager.js'

/**
 * @param {t.TestCase} tc
 */
export const testUndo = tc => {
  const um = new MultiDocUndoManager()
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
 * @param {t.TestCase} tc
 */
export const testUndoMap = tc => {
  const ydoc1 = new Y.Doc()
  const ymap = ydoc1.getMap()
  const um = new MultiDocUndoManager([ymap], {
    trackedOrigins: new Set(['this-client'])
  })

  ydoc1.transact(tr => {
    ymap.set('a', 1)
  }, 'this-client')

  t.assert(ymap.get('a') === 1)
  um.undo()
  t.assert(ymap.get('a') === undefined)
  um.redo()
  t.assert(ymap.get('a') === 1)
}

/**
 * @param {t.TestCase} tc
 */
export const testUndoEvents = tc => {
  const undoManager = new MultiDocUndoManager()
  const ydoc1 = new Y.Doc()
  const text0 = ydoc1.getText()
  undoManager.addToScope([text0])
  let counter = 0
  let receivedMetadata = -1
  undoManager.on('stack-item-added', /** @param {any} event */ event => {
    t.assert(event.type != null)
    t.assert(event.changedParentTypes != null && event.changedParentTypes.has(text0))
    event.stackItem.meta.set('test', counter++)
  })
  undoManager.on('stack-item-popped', /** @param {any} event */ event => {
    t.assert(event.type != null)
    t.assert(event.changedParentTypes != null && event.changedParentTypes.has(text0))
    receivedMetadata = event.stackItem.meta.get('test')
  })
  text0.insert(0, 'abc')
  undoManager.undo()
  t.assert(receivedMetadata === 0)
  undoManager.redo()
  t.assert(receivedMetadata === 1)
}
