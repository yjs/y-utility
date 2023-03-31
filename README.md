
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
```

### Benchmarks
> `npm test`

The benchmarking suite operates on N different keys. We generate X set operations on
the keys.

The benchmarks show that `Y.Map` creates documents that depend on the number of operations created. While `YKeyValue`'s size only depends on the size of the map.

We measure the size of the `Y.Doc` using the different approaches (`Y.Map` vs `YKeyValue`).

| operations | keys | `YKeyValue` doc size (bytes) | `Y.Map` doc size (bytes) | *JSON* size (bytes) |
|-- |-- | -- | -- | -- |
| 100k | 10 | 271 | 524985 | 121 |
| 100k | 100 | 2817 | 578231 | 1291 |
| 100k | 1000 | 30017 | 593834 | 13891 |
| 500k | 10 | 329 | 2684482 | 131 |
| 500k | 100 | 3013 | 2954249 | 1391 |
| 500k | 1000 | 31005 | 2992244 | 14891 |

### Potential optimization

We call `yarray.toArray()` every time something changes. This does make key-value store unsuitable for huge collections (>1 million objects). Furthermore, the benchmarks take quite some time. However, each operation individually still takes less than 1 millisecond when operating on datasets with less than 1 million objects.

We can work directly with Yjs' `Item` objects without calling `yarray.toArray()` every time something changes. This requires us to expose some internal features of Yjs which I don't want to do until the Move feature lands in Yjs.
