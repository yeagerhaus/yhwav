# Performance Testing Guide

This app includes comprehensive performance monitoring and testing tools to help identify bottlenecks and optimize performance.

## 🎯 Quick Start

### In Development Mode

1. **Performance Debugger UI**: A floating button appears in the top-right corner. Tap it to see real-time performance metrics.

2. **Console Logging**: Performance metrics are automatically logged to the console for operations taking >50ms.

3. **Global Functions**: Open the React Native debugger console and use:
   ```javascript
   // Run all performance tests
   runPerformanceTests()
   
   // Test specific operations
   testLibraryLoading(10000)  // Test with 10k tracks
   testTrackSwitching(100)    // Test 100 rapid track switches
   testSearchPerformance('test')
   ```

## 📊 Performance Monitor

The `performanceMonitor` tracks all major operations automatically:

- **Track Switching**: `playSound`, `skipToNext`, `skipToPrevious`
- **Library Processing**: `library-indexing`
- **Search Operations**: Tracked in search hook

### View Metrics

```javascript
// In console
performanceMonitor.logReport()           // Print full report
performanceMonitor.getSlowestOperations(10)  // Get top 10 slowest
performanceMonitor.getAverageDuration('playSound')  // Get average for operation
```

## 🧪 Performance Tests

### Test Library Loading

```javascript
testLibraryLoading(5000)  // Test loading 5,000 tracks
```

This tests:
- Track processing time
- Index creation (albums, artists)
- Memory usage
- UI responsiveness during load

### Test Track Switching

```javascript
testTrackSwitching(100)  // Test 100 rapid switches
```

This tests:
- Average switch time
- Maximum switch time
- Queue management performance
- Artwork color extraction impact

### Test Search Performance

```javascript
testSearchPerformance('query')
```

This tests:
- Search execution time
- Result count
- String matching performance

## 📈 Interpreting Results

### Good Performance
- `playSound`: < 200ms
- `skipToNext`: < 100ms (same queue)
- `library-indexing`: < 5000ms for 10k tracks
- Search: < 100ms for 1000 tracks

### Warning Signs
- Operations > 100ms logged with ⚠️
- Operations > 50ms logged with ⏱️
- Slow renders > 16ms (below 60fps)

## 🔍 Identifying Issues

### High `playSound` Times
- Check network latency
- Verify artwork color extraction isn't blocking
- Check queue comparison logic

### High `skipToNext` Times
- Ensure fast path is being used (same queue)
- Check TrackPlayer state synchronization
- Verify no unnecessary state updates

### Slow Library Indexing
- Check batch size (currently 500)
- Verify InteractionManager is working
- Check for memory leaks in processing

### Slow Search
- Verify search is using optimized string matching
- Check if search index could be pre-built
- Consider limiting search scope further

## 🛠️ Custom Performance Tracking

Add custom tracking to any operation:

```typescript
import { performanceMonitor } from '@/utils/performance';

// Track async operation
await performanceMonitor.trackAsync('myOperation', async () => {
  // Your code here
}, { metadata: 'value' });

// Track sync operation
performanceMonitor.track('myOperation', () => {
  // Your code here
});

// Manual timer
const endTimer = performanceMonitor.startTimer('myOperation');
// ... do work ...
endTimer({ result: 'success' });
```

## 📱 Performance Debugger UI

The floating performance debugger shows:
- Key metrics (averages for critical operations)
- Slowest operations (top 5)
- Total metrics collected
- Buttons to log full report or clear metrics

## 🎨 Best Practices

1. **Run tests regularly**: Especially after major changes
2. **Test on real devices**: Simulators can be misleading
3. **Test with realistic data**: Use your actual library size
4. **Monitor in production**: Consider adding production monitoring
5. **Profile memory**: Use React DevTools Profiler for deep analysis

## 🚀 Next Steps

For deeper analysis:
1. Use React DevTools Profiler for component-level analysis
2. Use Flipper for network and memory profiling
3. Use native profilers (Instruments/Android Studio) for native performance
4. Set up automated performance regression tests

