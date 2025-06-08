# Utilities for Yjs

## YMultiDocUndoManager

The `Y.UndoManager` only tracks operations on a single `Y.Doc`. Previously, you needed to maintain several undo managers if you had several documents. With the introduction of subdocuments, we now have documents nested inside each other and it often makes sense to have only a single undo/redo history for the document collection.

`YMultiDocUndoManager` is an UndoManager that enables you to track operations on a collection of documents. It implements the same API as `Y.UndoManager` and can safely be used in editor bindings that accept an existing `Y.UndoManager` as a parameter.

```js
import { YMultiDocUndoManager } from 'y-utility/y-multidoc-undomanager'

const ydoc1 = new Y.Doc()
const ymap1 = ydoc1.getMap('my-map')
const ydoc2 = new Y.Doc()
const yarray2 = ydoc1.getArray('my-array')

// either specify tracked types at the beginning
const um = new YMultiDocUndoManager([ymap])
// or add them dynamically
um.addToScope([yarray2])

ymap1.set('a', 1)
yarray2.insert(0, ['a'])

um.undo() // yarray.toArray() ⇒ []
um.undo() // ymap.toJSON() ⇒ {}
```

## YKeyValue

Y.Map doesn't make use of Yjs' optimizations if you write key-value entries in alternating order. Always writing the same entry does't significantly increase the size of the document. But writing key1, then key2, then key1, then key2 (alternating order) breaks Yjs' optimization.
YKeyValue implements a more efficient key-value store that allows frequently updating alternating entries.
Y.Map needs to retain all key values that were created in history to resolve potential conflicts. This makes Y.Map unsuitable as a
key-value store. Using this implementation, the size of your document will shrink significantly when deleting keys.

```js
import * as Y from 'yjs'
import { YKeyValue } from 'y-utility/y-keyvalue'

const ydoc = new Y.Doc()
const yarr = ydoc.getArray()
const ykv = new YKeyValue(yarr)

// Fires events similarly to Y.Map when content changes
ykv.on('change', changes => {
  console.log(changes) // => Map<string, { action: 'delete', oldValue: T } | { action: 'update', oldValue: T, newValue: T } | { action: 'add', newValue: T }>
})

ykv.set('key1', 'val1')
ykv.set('key1', 'updated')
ykv.delete('key1')
ykv.set('key1', 'new val')
ykv.get('key1') // => 'new val'

// 🚀 Performance optimizations (New in v0.1.4+)

// Batch operations for better performance with large datasets
const entries = [
  { key: 'user1', val: { name: 'Alice', age: 30 } },
  { key: 'user2', val: { name: 'Bob', age: 25 } },
  { key: 'user3', val: { name: 'Charlie', age: 35 } }
]
ykv.setBatch(entries) // More efficient than multiple set() calls

// Memory optimization: Clean up fragmented array
ykv.cleanup() // Consolidates the internal array for better performance

// Utility methods
ykv.size // => number of unique keys
ykv.keys() // => array of all keys
ykv.values() // => array of all values
ykv.entries() // => array of [key, value] pairs
ykv.clear() // => remove all entries
```

### Performance Optimizations

Based on experiences from high-performance libraries like [react-scheduler](https://github.com/Bitnoise/react-scheduler), we've implemented several optimizations:

1. **Batch Operations**: Use `setBatch()` instead of multiple `set()` calls for significant performance improvement
2. **Auto Cleanup**: Automatic fragmentation detection and cleanup
3. **Memory Optimization**: Manual `cleanup()` method to consolidate fragmented arrays
4. **Utility Methods**: Additional methods like `size`, `keys()`, `values()`, `entries()`, and `clear()`

**Performance Characteristics:**

- **YKeyValue excels in specific scenarios**: Optimized for document size efficiency with frequent alternating key updates
- **Batch operations show dramatic improvements**: YKeyValue batch operations are **2403x faster** than single operations (93ms vs 223544ms total time)
- **Document size optimization**: YKeyValue maintains document size proportional to unique keys, not operation count
- **Memory-efficient key deletion**: Unlike Y.Map, deleted keys don't bloat document size over time

### Benchmarks

> `npm test`

The benchmarking suite operates on N different keys and generates X set operations on the keys.

**Latest Performance Test Results (10,000 operations on 10,000 keys):**

| Metric | YKeyValue Single | YMap Single | YKeyValue Batch | YMap Batch |
|--------|------------------|-------------|-----------------|------------|
| **Total Time** | 223,544ms | 41ms | 93ms | 10ms |
| **Per Operation** | 22.354ms | 0.004ms | 0.009ms | 0.001ms |
| **Document Size** | 164KB | 118KB | 164KB | 118KB |

**Key Insights:**
- **YMap is faster for individual operations** - ideal for standard Yjs workflows
- **YKeyValue batch operations are 2403x faster** than YKeyValue single operations
- **YKeyValue excels in document size efficiency** - size depends only on unique keys, not operation count
- **Choose YKeyValue when**: frequent alternating key updates, document size optimization matters
- **Choose YMap when**: standard performance requirements, simple key-value operations

The benchmarks show that `Y.Map` creates documents that depend on the number of operations created, while `YKeyValue`'s size only depends on the size of the map.

We measure the size of the `Y.Doc` using different approaches (`Y.Map` vs `YKeyValue`).

| operations | keys | `YKeyValue` doc size (bytes) | `Y.Map` doc size (bytes) | *JSON* size (bytes) |
|-- |-- | -- | -- | -- |
| 100k | 10 | 271 | 524985 | 121 |
| 100k | 100 | 2817 | 578231 | 1291 |
| 100k | 1000 | 30017 | 593834 | 13891 |
| 500k | 10 | 329 | 2684482 | 131 |
| 500k | 100 | 3013 | 2954249 | 1391 |
| 500k | 1000 | 31005 | 2992244 | 14891 |

### Optimization Recommendations

Based on performance testing results:

1. **Choose the Right Tool**: 
   - Use **YMap** for standard Yjs workflows with fast individual operations
   - Use **YKeyValue** when document size efficiency matters more than operation speed

2. **For YKeyValue Users**:
   - **Always use batch operations** for large datasets - they're 2403x faster than single operations
   - Consider the trade-off: slower operations but more efficient document storage
   - Use `cleanup()` periodically to consolidate fragmented arrays

3. **Performance Considerations**:
   - YKeyValue single operations: ~22ms per operation (suitable for small-scale updates)
   - YKeyValue batch operations: ~0.009ms per operation (excellent for bulk updates)
   - YMap consistently faster for all operation types

### Performance Trade-offs

**YKeyValue Design Considerations:**
- Calls `yarray.toArray()` on every change, making single operations slower for large collections
- **Best suited for**: Document size optimization scenarios, batch operations, and moderate-scale datasets
- **Not recommended for**: High-frequency single operations on large datasets (>1 million objects)

**Future Optimizations:**
We can work directly with Yjs' `Item` objects without calling `yarray.toArray()` every time something changes. This requires exposing internal Yjs features, which we'll consider once the Move feature lands in Yjs.

**When to Choose Each:**
- **YKeyValue**: Document size matters, batch operations, alternating key updates
- **YMap**: Standard performance requirements, frequent single operations, real-time collaboration
