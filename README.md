
# Utilities for Yjs

## YKeyValue

Y.Map doesn't make use of Yjs' optimizations if you write key-value entries alternating order. Always writing the same entry is very performant. But writing key1, then key2, then key1, then key2 (alternating order) is not, because it doesn't make use of Yjs' optimizations.
YKeyValue implements a more efficient key-value store that allows frequently updating alternating entries.
Y.Map needs to retain all key values that were created in history to resolve potential conflicts. This makes Y.Map unsuitable as a
key-value store. Using this implementation, the size of your document will shrink significantly when
deleting keys.

Rough concept: We store `{ key, val }` pairs in an Y.Array. When you write a new entry,
we append the `{ key, val }` pair to the yarray and remove all existing entries with the same key.
Items that are more to the right have precedence.

```js
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

| operations | keys | *YKeyValue* size | *Y.Map* size |
|-- |-- | -- | -- |
| 100k | 10 | 310 | 884176 |
| 100k | 100 | 3299 | 973857 |
| 100k | 1000 | 32653 | 989489 |
| 500k | 10 | 379 | 4484224 |
| 500k | 100 | 3373 | 4935138 |
| 500k | 1000 | 33463 | 4986641 |

### Potential optimization

We call `yarray.toArray()` every time something changes. This does make key-value store unsuitable for huge collections (>1 million objects). Furthermore, the benchmarks take quite some time. However, each operation individually still takes less than 1 millisecond when operating on datasets with less than 1 million objects.

We can work directly with Yjs' `Item` objects without calling `yarray.toArray()` every time something changes. This requires us to expose some internal features of Yjs which I don't want to do until the Move feature lands in Yjs.
