# API Response Standardization

This project uses a global response interceptor to standardize all API responses in a consistent format.

## Response Format

All successful API responses are automatically wrapped in the following structure:

```typescript
{
  data: T,           // The original response data
  meta: {
    timestamp: string,  // ISO timestamp of the response
    path: string,       // Request path
    statusCode: number, // HTTP status code
    duration: number    // Request processing time in milliseconds
  }
}
```

## Examples

### Before Interceptor
```json
{
  "id": "123",
  "name": "Test Guild",
  "description": "A test guild"
}
```

### After Interceptor
```json
{
  "data": {
    "id": "123",
    "name": "Test Guild", 
    "description": "A test guild"
  },
  "meta": {
    "timestamp": "2023-03-24T13:45:00.000Z",
    "path": "/guilds/123",
    "statusCode": 200,
    "duration": 45
  }
}
```

### Array Response Example
```json
{
  "data": [
    { "id": "1", "name": "Guild 1" },
    { "id": "2", "name": "Guild 2" }
  ],
  "meta": {
    "timestamp": "2023-03-24T13:45:00.000Z",
    "path": "/guilds/list",
    "statusCode": 200,
    "duration": 32
  }
}
```

## Exceptions

The interceptor automatically excludes certain response types from wrapping:

1. **Health Check Endpoints** (`/health/*`) - Maintains terminus format
2. **Already Formatted Responses** - Responses that already have `{ data, meta }` structure
3. **Binary Data** - Buffers and streams for file downloads
4. **Error Responses** - Handled by the exception filter

## Implementation

The interceptor is applied globally in `main.ts`:

```typescript
app.useGlobalInterceptors(new ResponseInterceptor());
```

## TypeScript Support

Use the provided types for better TypeScript integration:

```typescript
import { ApiResponse, PaginatedResponse } from '@/common/types/api-response.types';

// For single items
@Get(':id')
async getGuild(@Param('id') id: string): Promise<ApiResponse<GuildDto>> {
  return this.guildService.getGuild(id);
}

// For paginated responses
@Get('list')
async listGuilds(): Promise<PaginatedResponse<GuildDto>> {
  return this.guildService.getActiveGuilds(page, limit);
}
```

## Benefits

1. **Consistency** - All responses follow the same structure
2. **Metadata** - Automatic inclusion of timing and request information
3. **Type Safety** - Better TypeScript support with provided types
4. **Monitoring** - Built-in performance tracking with duration
5. **Debugging** - Request path and timestamp for easier troubleshooting
