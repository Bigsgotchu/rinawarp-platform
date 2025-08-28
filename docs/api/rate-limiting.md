# Rate Limiting

The API implements rate limiting to ensure fair usage and protect against abuse. This document describes how rate limiting works and how to handle rate limit responses.

## Rate Limit Rules

- **Limit**: 100 requests per minute per IP address
- **Window**: Rolling 60-second window
- **Block Duration**: 60 seconds when limit is exceeded
- **Fallback Limit**: 50 requests per minute when Redis is unavailable

## Response Headers

The API includes rate limit information in response headers:

| Header | Description | Example |
|--------|-------------|---------|
| `X-RateLimit-Limit` | Maximum requests allowed per window | `100` |
| `X-RateLimit-Remaining` | Remaining requests in current window | `99` |
| `X-RateLimit-Reset` | Time when the rate limit window resets (ISO 8601) | `2025-08-28T23:00:00Z` |
| `Retry-After` | Seconds to wait before retrying (only on 429 response) | `30` |

## Rate Limit Exceeded Response

When the rate limit is exceeded, the API responds with:

```json
{
  "error": {
    "message": "Too many requests",
    "retryAfter": 30
  }
}
```

- **Status Code**: 429 Too Many Requests
- **Headers**: All standard rate limit headers plus `Retry-After`

## Exemptions

The following endpoints are exempt from rate limiting:

- `/health` - Health check endpoint

## Best Practices

1. **Monitor Headers**: Track `X-RateLimit-Remaining` to avoid hitting limits
2. **Implement Backoff**: When receiving 429, respect the `Retry-After` header
3. **Handle Errors**: Implement proper error handling for rate limit responses

## Example Code

### JavaScript/TypeScript
```typescript
async function makeRequest() {
  try {
    const response = await fetch('https://api.example.com/endpoint');
    
    // Check remaining rate limit
    const remaining = response.headers.get('X-RateLimit-Remaining');
    console.log(`Remaining requests: ${remaining}`);
    
    return await response.json();
  } catch (error) {
    if (error.status === 429) {
      const retryAfter = error.headers.get('Retry-After');
      console.log(`Rate limit exceeded. Retry after ${retryAfter} seconds`);
      // Implement retry logic here
    }
    throw error;
  }
}
```

## Infrastructure Notes

Rate limiting is implemented using:
- Redis for distributed rate limiting
- Automatic failover to local rate limiting if Redis is unavailable
- Robust Redis connection handling with automatic reconnection
- Configurable through environment variables:
  - `REDIS_URL`: Redis connection string
  - `RATE_LIMIT_POINTS`: Requests per window (default: 100)
  - `RATE_LIMIT_DURATION`: Window duration in seconds (default: 60)
