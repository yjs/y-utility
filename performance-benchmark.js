#!/usr/bin/env node

import * as Y from 'yjs'
import { YKeyValue } from './y-keyvalue.js'
import * as prng from 'lib0/prng'

const gen = prng.create(1337)
const numOfUpdates = 10000
const numOfKeys = 10000

console.log('🚀 Y-Utility Performance Benchmark')
console.log('========================================')

/**
 * Test single operation performance with YKeyValue
 */
function testYKeyValueSingleOperations() {
  console.log('\n📊 YKeyValue Single Operation Performance Test:')
  
  const ydoc = new Y.Doc()
  ydoc.clientID = 0
  const yarr = ydoc.getArray()
  const ykv = new YKeyValue(yarr)
  
  const startTime = Date.now()
  
  for (let i = 0; i < numOfUpdates; i++) {
    const key = prng.uint32(gen, 0, numOfKeys - 1) + ''
    const val = i + ''
    ykv.set(key, val)
  }
  
  const endTime = Date.now()
  const totalTime = endTime - startTime
  
  console.log(`  ✅ Completed ${(numOfUpdates / 1000).toFixed(1)}k operations on ${numOfKeys} keys`)
  console.log(`  ⏱️  Total time: ${totalTime}ms`)
  console.log(`  ⚡ Time per operation: ${(totalTime / numOfUpdates).toFixed(3)}ms`)
  console.log(`  📦 Encoded document size: ${Y.encodeStateAsUpdate(ydoc).length} bytes`)
  console.log(`  🗃️  Array length: ${ykv.yarray.length}`)
  console.log(`  📋 Unique keys count: ${ykv.size}`)
  
  return { totalTime, arrayLength: ykv.yarray.length, uniqueKeys: ykv.size, docSize: Y.encodeStateAsUpdate(ydoc).length }
}

/**
 * Test single operation performance with YMap
 */
function testYMapSingleOperations() {
  console.log('\n📊 YMap Single Operation Performance Test:')
  
  const ydoc = new Y.Doc()
  ydoc.clientID = 0
  const ymap = ydoc.getMap()
  
  // Reset PRNG to ensure same key sequence
  const mapGen = prng.create(1337)
  const startTime = Date.now()
  
  for (let i = 0; i < numOfUpdates; i++) {
    const key = prng.uint32(mapGen, 0, numOfKeys - 1) + ''
    const val = i + ''
    ymap.set(key, val)
  }
  
  const endTime = Date.now()
  const totalTime = endTime - startTime
  
  console.log(`  ✅ Completed ${(numOfUpdates / 1000).toFixed(1)}k operations on ${numOfKeys} keys`)
  console.log(`  ⏱️  Total time: ${totalTime}ms`)
  console.log(`  ⚡ Time per operation: ${(totalTime / numOfUpdates).toFixed(3)}ms`)
  console.log(`  📦 Encoded document size: ${Y.encodeStateAsUpdate(ydoc).length} bytes`)
  console.log(`  📋 Unique keys count: ${ymap.size}`)
  
  return { totalTime, uniqueKeys: ymap.size, docSize: Y.encodeStateAsUpdate(ydoc).length }
}

/**
 * Test batch operation performance with YKeyValue
 */
function testYKeyValueBatchOperations() {
  console.log('\n📊 YKeyValue Batch Operation Performance Test:')
  
  const ydoc = new Y.Doc()
  ydoc.clientID = 0
  const yarr = ydoc.getArray()
  const ykv = new YKeyValue(yarr)
  
  // Prepare batch data
  const batchSize = 100
  const numBatches = numOfUpdates / batchSize
  const batches = []
  
  for (let i = 0; i < numBatches; i++) {
    const batch = []
    for (let j = 0; j < batchSize; j++) {
      const key = prng.uint32(gen, 0, numOfKeys - 1) + ''
      const val = (i * batchSize + j) + ''
      batch.push({ key, val })
    }
    batches.push(batch)
  }
  
  const startTime = Date.now()
  
  batches.forEach(batch => {
    ykv.setBatch(batch)
  })
  
  const endTime = Date.now()
  const totalTime = endTime - startTime
  
  console.log(`  ✅ Completed ${(numOfUpdates / 1000).toFixed(1)}k batch operations on ${numOfKeys} keys`)
  console.log(`  📦 Batch size: ${batchSize}`)
  console.log(`  ⏱️  Total time: ${totalTime}ms`)
  console.log(`  ⚡ Time per operation: ${(totalTime / numOfUpdates).toFixed(3)}ms`)
  console.log(`  📦 Encoded document size: ${Y.encodeStateAsUpdate(ydoc).length} bytes`)
  console.log(`  🗃️  Array length: ${ykv.yarray.length}`)
  console.log(`  📋 Unique keys count: ${ykv.size}`)
  
  return { totalTime, arrayLength: ykv.yarray.length, uniqueKeys: ykv.size, docSize: Y.encodeStateAsUpdate(ydoc).length }
}

/**
 * Test batch operation performance with YMap
 */
function testYMapBatchOperations() {
  console.log('\n📊 YMap Batch Operation Performance Test:')
  
  const ydoc = new Y.Doc()
  ydoc.clientID = 0
  const ymap = ydoc.getMap()
  
  // Prepare batch data
  const batchSize = 100
  const numBatches = numOfUpdates / batchSize
  const batches = []
  
  // Reset PRNG to ensure same key sequence
  const mapGen = prng.create(1337)
  for (let i = 0; i < numBatches; i++) {
    const batch = []
    for (let j = 0; j < batchSize; j++) {
      const key = prng.uint32(mapGen, 0, numOfKeys - 1) + ''
      const val = (i * batchSize + j) + ''
      batch.push({ key, val })
    }
    batches.push(batch)
  }
  
  const startTime = Date.now()
  
  batches.forEach(batch => {
    ydoc.transact(() => {
      batch.forEach(({ key, val }) => {
        ymap.set(key, val)
      })
    })
  })
  
  const endTime = Date.now()
  const totalTime = endTime - startTime
  
  console.log(`  ✅ Completed ${(numOfUpdates / 1000).toFixed(1)}k batch operations on ${numOfKeys} keys`)
  console.log(`  📦 Batch size: ${batchSize}`)
  console.log(`  ⏱️  Total time: ${totalTime}ms`)
  console.log(`  ⚡ Time per operation: ${(totalTime / numOfUpdates).toFixed(3)}ms`)
  console.log(`  📦 Encoded document size: ${Y.encodeStateAsUpdate(ydoc).length} bytes`)
  console.log(`  📋 Unique keys count: ${ymap.size}`)
  
  return { totalTime, uniqueKeys: ymap.size, docSize: Y.encodeStateAsUpdate(ydoc).length }
}

/**
 * Test cleanup functionality
 */
function testCleanupPerformance() {
  console.log('\n📊 YKeyValue Cleanup Functionality Performance Test:')
  
  const ydoc = new Y.Doc()
  const yarr = ydoc.getArray()
  const ykv = new YKeyValue(yarr)
  
  // Create fragmented data
  console.log('  🔧 Creating fragmented data...')
  for (let i = 0; i < 2000; i++) {
    ykv.set('key1', 'value' + i)
    ykv.set('key2', 'value' + i)
    ykv.set('key3', 'value' + i)
    ykv.set('key4', 'value' + i)
    ykv.set('key5', 'value' + i)
  }
  
  const beforeCleanup = {
    arrayLength: ykv.yarray.length,
    uniqueKeys: ykv.size,
    docSize: Y.encodeStateAsUpdate(ydoc).length
  }
  
  console.log(`  📊 Before cleanup - Array length: ${beforeCleanup.arrayLength}, Unique keys: ${beforeCleanup.uniqueKeys}`)
  
  const startTime = Date.now()
  ykv.cleanup()
  const endTime = Date.now()
  const cleanupTime = endTime - startTime
  
  const afterCleanup = {
    arrayLength: ykv.yarray.length,
    uniqueKeys: ykv.size,
    docSize: Y.encodeStateAsUpdate(ydoc).length
  }
  
  console.log(`  📊 After cleanup - Array length: ${afterCleanup.arrayLength}, Unique keys: ${afterCleanup.uniqueKeys}`)
  console.log(`  ⏱️  Cleanup time: ${cleanupTime}ms`)
  console.log(`  📉 Space saved: ${beforeCleanup.arrayLength - afterCleanup.arrayLength} entries`)
  console.log(`  💾 Document size change: ${beforeCleanup.docSize} → ${afterCleanup.docSize} bytes`)
  
  return { cleanupTime, spaceSaved: beforeCleanup.arrayLength - afterCleanup.arrayLength }
}

/**
 * Main test function
 */
async function runBenchmarks() {
  console.log(`📋 Test Configuration:`)
  console.log(`  • Number of operations: ${numOfUpdates.toLocaleString()}`)
  console.log(`  • Number of keys: ${numOfKeys.toLocaleString()}`)
  
  // Single operations comparison
  const ykvSingleResult = testYKeyValueSingleOperations()
  const ymapSingleResult = testYMapSingleOperations()
  
  // Batch operations comparison  
  const ykvBatchResult = testYKeyValueBatchOperations()
  const ymapBatchResult = testYMapBatchOperations()
  
  // Cleanup test (YKeyValue only)
  const cleanupResult = testCleanupPerformance()
  
  console.log('\n🎯 Performance Comparison Summary:')
  console.log('========================================')
  
  // Single operations comparison
  const singleTimeDiff = ((ykvSingleResult.totalTime / ymapSingleResult.totalTime) - 1) * 100
  const singleDocSizeDiff = ((ykvSingleResult.docSize / ymapSingleResult.docSize) - 1) * 100
  
  console.log('\n🔄 Single Operations Comparison:')
  console.log(`  ⚡ YKeyValue: ${ykvSingleResult.totalTime}ms | YMap: ${ymapSingleResult.totalTime}ms`)
  if (singleTimeDiff > 0) {
    console.log(`  📈 YKeyValue is ${singleTimeDiff.toFixed(1)}% slower than YMap`)
  } else {
    console.log(`  📈 YKeyValue is ${Math.abs(singleTimeDiff).toFixed(1)}% faster than YMap`)
  }
  console.log(`  💾 Document size - YKeyValue: ${ykvSingleResult.docSize} bytes | YMap: ${ymapSingleResult.docSize} bytes (${singleDocSizeDiff > 0 ? '+' : ''}${singleDocSizeDiff.toFixed(1)}%)`)
  
  // Batch operations comparison
  const batchTimeDiff = ((ykvBatchResult.totalTime / ymapBatchResult.totalTime) - 1) * 100
  const batchDocSizeDiff = ((ykvBatchResult.docSize / ymapBatchResult.docSize) - 1) * 100
  
  console.log('\n📦 Batch Operations Comparison:')
  console.log(`  ⚡ YKeyValue: ${ykvBatchResult.totalTime}ms | YMap: ${ymapBatchResult.totalTime}ms`)
  if (batchTimeDiff > 0) {
    console.log(`  📈 YKeyValue is ${batchTimeDiff.toFixed(1)}% slower than YMap`)
  } else {
    console.log(`  📈 YKeyValue is ${Math.abs(batchTimeDiff).toFixed(1)}% faster than YMap`)
  }
  console.log(`  💾 Document size - YKeyValue: ${ykvBatchResult.docSize} bytes | YMap: ${ymapBatchResult.docSize} bytes (${batchDocSizeDiff > 0 ? '+' : ''}${batchDocSizeDiff.toFixed(1)}%)`)
  
  // YKeyValue internal optimization
  const ykvBatchImprovement = ((ykvSingleResult.totalTime / ykvBatchResult.totalTime) - 1) * 100
  const ymapBatchImprovement = ((ymapSingleResult.totalTime / ymapBatchResult.totalTime) - 1) * 100
  
  console.log('\n⚡ Batch vs Single Operations Improvement:')
  console.log(`  🔧 YKeyValue batch improvement: ${ykvBatchImprovement.toFixed(1)}%`)
  console.log(`  🗃️  YMap batch improvement: ${ymapBatchImprovement.toFixed(1)}%`)
  
  console.log('\n🧹 YKeyValue Cleanup Benefits:')
  console.log(`  📉 Space saved: ${cleanupResult.spaceSaved} entries`)
  console.log(`  ⚡ Cleanup time: ${cleanupResult.cleanupTime}ms`)
  console.log(`  💡 Storage efficiency: ${((cleanupResult.spaceSaved / ykvSingleResult.arrayLength) * 100).toFixed(1)}% space reduction`)
  
  console.log('\n💡 Recommendations:')
  if (Math.abs(singleTimeDiff) < 10) {
    console.log(`  ⚖️  YKeyValue and YMap have similar single operation performance`)
  }
  if (Math.abs(batchTimeDiff) < 10) {
    console.log(`  ⚖️  YKeyValue and YMap have similar batch operation performance`)
  }
  if (ykvBatchImprovement > 10) {
    console.log(`  ✅ Use YKeyValue.setBatch() for better performance with large datasets`)
  }
  if (cleanupResult.spaceSaved > 0) {
    console.log(`  ✅ Regular YKeyValue.cleanup() calls recommended for memory optimization`)
  }
  console.log(`  🎯 Choose YKeyValue for: cleanup functionality, batch operations optimization`)
  console.log(`  🎯 Choose YMap for: standard Yjs integration, simple key-value operations`)
  
  console.log('\n🏆 Benchmark completed!')
}

// Run benchmark tests
runBenchmarks().catch(console.error) 