# Performance Analysis Guide

## How to Share Performance Data with AI

Yes! I can analyze performance results. Here's how to share them:

### Method 1: Console Export (Easiest)

1. **Run your tests or use the app normally**
2. **In React Native Debugger console, run:**
   ```javascript
   exportPerformanceData()
   ```
3. **Copy the JSON output** and paste it in our conversation
4. I'll analyze it and provide recommendations

### Method 2: Performance Debugger UI

1. Tap the **"Perf"** button in the app
2. Tap **"Export for Analysis"**
3. Copy the console output
4. Share it with me

### Method 3: Manual Summary

1. Run:
   ```javascript
   getPerformanceSummary()
   ```
2. Copy the summary text
3. Share it with me

## What I Can Analyze

I can analyze:

✅ **Operation Timing**
- Average durations for all operations
- Slowest operations identification
- Performance trends over time

✅ **Bottleneck Detection**
- Operations exceeding thresholds
- Patterns in slow operations
- Correlation between operations

✅ **Optimization Recommendations**
- Specific code improvements
- Architecture suggestions
- Configuration tweaks

✅ **Regression Detection**
- Compare before/after metrics
- Identify performance regressions
- Track improvements

## Example Analysis Request

Just paste something like:

```
Here are my performance results:
[Paste the JSON or summary here]

I'm experiencing slow track switching and library loading.
```

I'll analyze and provide:
- What's causing the slowness
- Specific optimizations to apply
- Code changes needed
- Expected improvements

## Performance Thresholds

I use these benchmarks:

| Operation | Good | Warning | Critical |
|-----------|------|---------|----------|
| `playSound` | < 200ms | 200-500ms | > 500ms |
| `skipToNext` | < 100ms | 100-200ms | > 200ms |
| `library-indexing` | < 5s (10k tracks) | 5-10s | > 10s |
| Search | < 100ms | 100-300ms | > 300ms |
| Component Render | < 16ms | 16-50ms | > 50ms |

## Automated Analysis

You can also set up automated analysis:

```javascript
// Check if performance is acceptable
const checkPerformance = () => {
  const avgPlaySound = performanceMonitor.getAverageDuration('playSound');
  const avgSkip = performanceMonitor.getAverageDuration('skipToNext');
  
  if (avgPlaySound > 200) {
    console.warn('⚠️ playSound is slow:', avgPlaySound);
  }
  if (avgSkip > 100) {
    console.warn('⚠️ skipToNext is slow:', avgSkip);
  }
};
```

## Sharing Tips

1. **Include context**: What were you doing when the metrics were collected?
2. **Library size**: How many tracks/albums/artists?
3. **Device info**: iOS/Android, device model
4. **Specific issues**: What feels slow to you?
5. **Before/after**: If testing optimizations, share both sets

## Quick Analysis Commands

```javascript
// Get quick summary
getPerformanceSummary()

// Export full data
exportPerformanceData()

// Check specific operation
performanceMonitor.getAverageDuration('playSound')

// See slowest operations
performanceMonitor.getSlowestOperations(10)

// Full report
performanceMonitor.logReport()
```

