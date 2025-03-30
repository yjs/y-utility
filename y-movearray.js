
import * as Y from 'yjs' // eslint-disable-line
import { ObservableV2 } from 'lib0/observable'

/**
 * @param {Y.Transaction} tr
 * @param {Y.ID} id
 */
const deleteContentById = (tr, id) => {
  Y.getItemCleanStart(tr, id)
  const item = Y.getItemCleanEnd(tr, tr.doc.store, id)
  item.delete(tr)
}

/**
 * @param {YMoveArray<any>} ymove 
 * @param {number} index
 * @return {number} the actual index in the type
 */
const findYMoveArrayIndex = (ymove, index) => {
  let item = ymove.yarray._start
  let actualIndex = 0
  if (item?.deleted) item = item?.next
  for (; item != null && index >= 0; item = item.next, actualIndex++) {
    if (!(item.content instanceof Y.ContentType) || !ymove.movedBy.has(item.content.type)) {
      index--
    }
  }
  return actualIndex
}

/**
 * Yjs currently doesn't have a move feature. However, it is fairly easy to build your own list
 * implementation that supports moving of elements.
 *
 * The below wrapper maintains a Y.Array<Type | { client: number, clock: number }> and
 * exposes a Y.MoveArray<Type>, where `Type extends Y.AbstractType`. 
 *
 * Rough concept: The primitive types ({ client: number, clock: number }) are used as markers that indicate that a
 * Yjs type with the mentioned lamport timestamp should be moved to this position. In case of
 * multiple markers referring to the same Yjs type, the first marker will be used. The other marker
 * will be removed automatically.
 *
 * @template {Y.AbstractType<any>} Type
 * @extends ObservableV2<{ change: (delta: Array<{ insert: Array<Type> } | { delete: number } | { retain: number }>, tr: Y.Transaction) => void }>
 *
 */
export class YMoveArray extends ObservableV2 {
  /**
   * @param {Y.Array<Type | { client: number, clock: number }>} yarray
   */
  constructor (yarray) {
    super()
    this.yarray = yarray
    this.doc = /** @type {Y.Doc} */ (yarray.doc)

    /**
     * @type {Map<Type, Y.ID>}
     */
    this.movedBy = new Map()

    /**
     * Ensures that the move items are de-duplicated. Should be called whenever new content is
     * added.
     *
     * @param {Y.Transaction} tr
     * @param {Y.Item} item
     * @param {Y.YArrayEvent<any> | null} event the event that caused this call
     * @param {Set<Type> | null} movedTypes if provided, this fucnion will update the set of types that have been moved for the first time
     */
    const handleItemAddition = (tr, item, event, movedTypes) => {
      if (item.content instanceof Y.ContentAny) {
        const content = item.content.arr
        for (let clockInc = 0; clockInc < content.length; clockInc++) {
          const c = content[clockInc]
          if (c.client == null || c.clock == null) continue
          const targetTypeItem = Y.getItem(tr.doc.store, c)
          const itemContentId = { client: item.id.client, clock: item.id.clock + clockInc }
          if (targetTypeItem.deleted) {
            // target is already deleted
            deleteContentById(tr, itemContentId)
          }
          /**
           * @type {Type}
           */
          const movedType = /** @type {any} */ (targetTypeItem.content).type
          const movedBy = this.movedBy.get(movedType)
          if (movedBy != null) {
            if (movedBy.client < item.id.client) {
              // The client id of the current move item is higher than the one that is currently
              // marked.
              // Delete the previous move item
              deleteContentById(tr, movedBy)
              // use the new move item instead
              this.movedBy.set(movedType, itemContentId)
            } else {
              // the client id of the currently used move item is higher. Delete the found move
              // item.
              deleteContentById(tr, itemContentId)
            }
          } else {
            this.movedBy.set(movedType, itemContentId)
            if (event?.changes.added.has(/** @type {Y.Item} */ (movedType._item)) && movedTypes != null) {
              // this item is moved for the first time
              movedTypes.add(movedType)
            }
          }
        }
      }
    }
    {
      // Initialize above types with existing content.
      // Cleanup if necessary.
      this.doc.transact(tr => {
        let item = this.yarray._start
        if (item?.deleted) { item = item?.next }
        while (item != null) {
          handleItemAddition(tr, item, null, null)
          item = item.next
        }
      })
    }
    yarray.observe(event => {
      this.doc.transact(tr => {
        /**
         * Set of items that are moved for the first time.
         *
         * @type {Set<Type>}
         */
        const movedTypes = new Set()
        event.changes.added.forEach(item => {
          handleItemAddition(tr, item, event, movedTypes)
        })
        event.changes.deleted.forEach(item => {
          if (item.content instanceof Y.ContentType) {
            // type was deleted. remove related move item.
            const movedType = /** @type {Type} */ (item.content.type)
            const movedBy = this.movedBy.get(movedType)
            if (movedBy != null) deleteContentById(tr, movedBy)
          }
        })
        /**
         * @type {any}
         */
        const delta = event.changes.delta.map(d => {
          if (d.insert != null && d.insert instanceof Array) {
            for (let i = d.insert.length - 1; i >= 0; i--) {
              if (this.movedBy.has(d.insert[i])) {
                // inserted item has been moved
                d.insert.splice(i, 1)
              }
            }
          }
          return d
        })

        if(movedTypes.size > 0) {
          // find all the indexes and remove them @todo

        }
        this.emit('change', [delta, tr])
      })

    })
  }

  /**
   * @return {Array<Type>}
   */
  toArray () {
    /**
     * @type {Array<Type>} 
     */
    const res = []
    const yarr = this.yarray.toArray()
    for (let i = 0; i < yarr.length; i++) {
      const r = yarr[i]
      if (r instanceof Y.AbstractType) {
        if (!this.movedBy.has(r)) {
          res.push(r)
        }
      } else if (r.client != null && r.clock != null) {
        const item = Y.getItem(this.doc.store, r)
        if (item && !item.deleted) {
          res.push(/** @type {any} */ (item).content.type)
        }
      }
    }
    return res
  }

  /**
   * @param {number} index
   * @param {Array<Type>} content
   */
  insert (index, content) {
    this.yarray.insert()
  }

  /**
   * @param {string} key
   * @param {T} val
   */
  set (key, val) {
    this.doc.transact(_tr => {
      // if this value existed before, we will delete it first
      if (this.map.has(key)) {
        this.delete(key)
      }
      this.yarray.push([{ key, val }])
    })
  }

  /**
   * @param {string} key
   */
  delete (key) {
    let i = 0
    // eslint-disable-next-line no-unused-vars
    for (const val of this.yarray) {
      if (val.key === key) {
        this.yarray.delete(i)
        break
      }
      i++
    }
  }

  /**
   * @param {string} key
   * @return {T | undefined}
   */
  get (key) {
    const v = this.map.get(key)
    return v && v.val
  }

  /**
   * @param {string} key
   */
  has (key) {
    return this.map.has(key)
  }
}
