import * as Y from 'yjs' // eslint-disable-line
import { Observable } from 'lib0/observable'

/**
 * @template T
 * @extends Observable<'change'>
 *
 * Yjs maps don't perform well when there are a lot of entries that are frequently updated in alternating order.
 * This is a more efficient key-value store that allows frequently updating alternating entries.
 *
 * Note that this implementation does not support any nested Yjs types.
 *
 * Rough concept: We store { key, val } pairs in an Y.Array. When you write a new entry,
 * we append the { key, val } pair to the yarray and remove all existing entries with the same key.
 * Items that are more to the right have precedence.
 *
 * This type fires events similarly to Y.Map
 *
 * ```js
 * yefficientmap.on('change', changes => {
 *   changes // => Map<string, { action: 'delete', oldValue: T } | { action: 'update', oldValue: T, newValue: T } | { action: 'add', newValue: T }>
 * })
 * ```
 */
export class YKeyValue extends Observable {
  /**
   * @param {Y.Array<{ key: string, val: T }>} yarray
   * @param {Object} [options] - Configuration options
   * @param {number} [options.cleanupThreshold=1000] - Array size threshold for cleanup
   * @param {number} [options.autoCleanupInterval=500] - Interval for automatic cleanup checks
   * @param {number} [options.fragmentationRatio=1.5] - Ratio of array size to unique keys that triggers cleanup
   * @param {number} [options.minCleanupSize=100] - Minimum array size before cleanup is considered
   */
  constructor (yarray, options = {}) {
    super()
    this.yarray = yarray
    this.doc = /** @type {Y.Doc} */ (yarray.doc)
    
    // Configuration options with default values
    const {
      cleanupThreshold = 1000,
      autoCleanupInterval = 500,
      fragmentationRatio = 1.5,
      minCleanupSize = 100
    } = options
    
    /**
     * Store the key-val pair so we can do identity-based comparisons.
     *
     * @type {Map<string, { key: string, val: T }>}
     */
    this.map = new Map()
    
    /**
     * Performance optimization: Track array size for cleanup decisions
     * @type {number}
     */
    this._lastCleanupSize = 0
    
    /**
     * Configuration: Cleanup threshold
     * @type {number}
     */
    this._cleanupThreshold = cleanupThreshold
    
    /**
     * Configuration: Auto cleanup interval
     * @type {number}
     */
    this._autoCleanupInterval = autoCleanupInterval
    
    /**
     * Configuration: Fragmentation ratio for cleanup
     * @type {number}
     */
    this._fragmentationRatio = fragmentationRatio
    
    /**
     * Configuration: Minimum size for cleanup consideration
     * @type {number}
     */
    this._minCleanupSize = minCleanupSize

    {
      // initialize the map and cleanup duplicate items
      const arr = yarray.toArray()
      this.doc.transact(() => {
        for (let i = arr.length - 1; i >= 0; i--) {
          const v = arr[i]
          if (this.map.has(v.key)) {
            // entry already exists, remove the current item
            yarray.delete(i)
          } else {
            this.map.set(v.key, v)
          }
        }
      })
    }
    // track when new items are added/removed and update this.map
    yarray.observe((event, tr) => {
      /**
       * This is the change-event we calculate. It works similarly to Y.MapEvent.keys (I added support for newValue)
       *
       * https://docs.yjs.dev/api/shared-types/y.map
       *
       * @type {Map<string, { action: 'delete', oldValue: T } | { action: 'update', oldValue: T, newValue: T } | { action: 'add', newValue: T }>}
       */
      const changes = new Map()
      /**
       * @type {Array<Y.Item>}
       */
      const addedItems = Array.from(event.changes.added)
      event.changes.deleted.forEach(ditem => {
        ditem.content.getContent().forEach(c => {
          // deleted item was the current value
          if (this.map.get(c.key) === c) {
            this.map.delete(c.key)
            changes.set(c.key, { action: 'delete', oldValue: c.val })
          }
        })
      })
      /**
       * @type {Map<string, { key: string, val: T }>}
       */
      const addedVals = new Map()
      addedItems.map(item => item.content.getContent()).flat().forEach(v => {
        addedVals.set(v.key, v)
      })

      /**
       * A set of ids to remove.
       *
       * If an item was added, but it doesn't overwrite something
       * (because an older item is more to the right),
       * we will remove it in the cleanup process.
       *
       * We don't know the index, so we have to cache it here.
       *
       * @type {Set<string>}
       */
      const itemsToRemove = new Set()
      const vals = yarray.toArray()
      this.doc.transact(_tr => {
        /**
         * Iterate from right to left and update the map while we find the items in addedVals
         */
        for (let i = vals.length - 1; i >= 0 && (addedVals.size > 0 || itemsToRemove.size > 0); i--) {
          const currVal = vals[i]
          if (itemsToRemove.has(currVal.key)) {
            itemsToRemove.delete(currVal.key)
            yarray.delete(i, 1)
          } else if (addedVals.get(currVal.key) === currVal) {
            // a new item was inserted that is the latest value
            const prevValue = this.map.get(currVal.key)
            if (prevValue) {
              // There was an entry that existed before.
              // We just have to delete the previous item
              itemsToRemove.add(currVal.key)
              // and fire an "update" event
              changes.set(currVal.key, { action: 'update', oldValue: prevValue.val, newValue: currVal.val })
            } else {
              // if the item was properly updated, there should already be a 'delete' event
              const delEvent = changes.get(currVal.key)
              if (delEvent && delEvent.action === 'delete') {
                changes.set(currVal.key, { action: 'update', newValue: currVal.val, oldValue: delEvent.oldValue })
              } else {
                // fire an "add" event
                changes.set(currVal.key, { action: 'add', newValue: currVal.val })
              }
            }
            addedVals.delete(currVal.key)
            this.map.set(currVal.key, currVal)
          } else if (addedVals.has(currVal.key)) {
            // The entry didn't change, we have to remove the added value
            itemsToRemove.add(currVal.key)
            addedVals.delete(currVal.key)
          }
        }
      })
      if (changes.size > 0) {
        this.emit('change', [changes, tr])
      }
    })
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
    // Only cleanup occasionally to avoid overhead
    if (this.yarray.length % this._autoCleanupInterval === 0) {
      this._maybeCleanup()
    }
  }

  /**
   * Batch set multiple key-value pairs in a single transaction for better performance
   * @param {Array<{key: string, val: T}>} entries
   */
  setBatch (entries) {
    if (entries.length === 0) return
    
    // Optimize: deduplicate entries in batch (keep last occurrence of each key)
    const deduped = new Map()
    entries.forEach(({ key, val }) => {
      deduped.set(key, { key, val })
    })
    const optimizedEntries = Array.from(deduped.values())
    
    this.doc.transact(_tr => {
      // For batch operations, just append - let the observe handler deal with duplicates
      this.yarray.push(optimizedEntries)
    })
  }

  /**
   * @param {string} key
   */
  delete (key) {
    // Traverse and delete from the end to the front, because items on the right have priority.
    for (let i = this.yarray.length - 1; i >= 0; i--) {
      const val = this.yarray.get(i)
      if (val.key === key) {
        this.yarray.delete(i)
        break
      }
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

  /**
   * Performance optimization: Clean up fragmented array when it grows too large
   * This method removes gaps and consolidates the array for better performance
   */
  cleanup () {
    if (this.yarray.length <= this._cleanupThreshold) return
    
    this.doc.transact(_tr => {
      const currentEntries = Array.from(this.map.values())
      // Clear the array and rebuild with only current values
      this.yarray.delete(0, this.yarray.length)
      this.yarray.push(currentEntries)
      this._lastCleanupSize = this.yarray.length
    })
  }

  /**
   * Performance optimization: Auto cleanup when array becomes fragmented
   * @private
   */
  _maybeCleanup () {
    // If array is significantly larger than the number of unique keys, cleanup
    // Use a lower threshold to ensure cleanup happens more frequently
    if (this.yarray.length > this.map.size * this._fragmentationRatio && 
        this.yarray.length > this._minCleanupSize) {
      this.cleanup()
    }
  }

  /**
   * Get the current size of unique keys
   * @return {number}
   */
  get size () {
    return this.map.size
  }

  /**
   * Get all keys
   * @return {Array<string>}
   */
  keys () {
    return Array.from(this.map.keys())
  }

  /**
   * Get all values
   * @return {Array<T>}
   */
  values () {
    return Array.from(this.map.values()).map(entry => entry.val)
  }

  /**
   * Get all entries as [key, value] pairs
   * @return {Array<[string, T]>}
   */
  entries () {
    return Array.from(this.map.entries()).map(([key, entry]) => [key, entry.val])
  }

  /**
   * Clear all entries
   */
  clear () {
    if (this.map.size === 0) return
    
    this.doc.transact(_tr => {
      this.yarray.delete(0, this.yarray.length)
    })
  }
}
