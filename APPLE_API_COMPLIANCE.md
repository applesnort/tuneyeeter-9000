# Apple iTunes Search API Compliance

## Official Rate Limits (per Apple Documentation)

- **20 calls per minute maximum**
- Heavy usage should use Enterprise Partner Feed (EPF)
- Proper caching recommended for large websites

## Our Implementation Changes

### 1. Rate Limiting Compliance
**Before**: 1 second between requests = 60 calls/minute (3x over limit)
**After**: 3 seconds between requests = 20 calls/minute (at limit)

```typescript
// 3 seconds between requests to stay under 20 calls/minute
await new Promise(resolve => setTimeout(resolve, 3000));
```

### 2. Required Parameters Added
- Added `country=US` parameter (required per documentation)
- Reduced `limit=25` (was 50) to minimize response size
- Proper URL encoding already implemented

### 3. Search Strategy Optimized
- Start searches with artist names (more reliable)
- Avoid generic single-word searches that trigger 403s
- Use artist + album combinations for better results

### 4. Expected Performance Impact
**Per Track**: 5-6 searches × 3 seconds = 15-18 seconds per track
**For 11-track playlist**: ~3-4 minutes total processing time

This is slower but compliant with Apple's official rate limits.

## Future Optimizations

### 1. Caching Strategy
```typescript
const searchCache = new Map<string, AppleTrack[]>();
// Cache results to avoid repeat searches
```

### 2. Smarter Search Ordering
- Use successful search patterns first
- Skip searches likely to get 403s
- Early termination on high-confidence matches

### 3. Enterprise Partner Feed (EPF)
For production use with high volume:
- Direct access to Apple's catalog data
- No rate limits
- Requires Apple partnership

## Compliance Notes

### Content Usage Restrictions
- Previews must be streamed, not downloaded
- Must include iTunes attribution
- Promotional use only for store content

### Technical Requirements
- JSON parsing (already implemented)
- Proper URL encoding (already implemented)
- Dynamic script tags for cross-site requests (N/A - server-side)

## Current Status

✅ **Rate limiting compliant** (20 calls/minute)
✅ **Required parameters** (country, entity, limit)
✅ **Proper URL encoding**
✅ **Search strategy optimized**
✅ **Error handling** for 403s

The 403 errors should now be eliminated, but processing will be significantly slower due to proper rate limiting compliance.