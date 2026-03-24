import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  data: T;
  meta: {
    timestamp: string;
    path: string;
    statusCode: number;
    duration?: number;
  };
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    const startTime = Date.now();
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    return next.handle().pipe(
      map((data) => {
        const endTime = Date.now();
        const duration = endTime - startTime;

        // Don't wrap if the response is already in the standard format
        if (data && typeof data === 'object' && 'data' in data && 'meta' in data) {
          return data;
        }

        // Don't wrap certain response types (like file downloads, streams, etc.)
        if (data instanceof Buffer || data instanceof ReadableStream) {
          return data;
        }

        // Don't wrap health check responses to maintain terminus format
        if (request.path.startsWith('/health')) {
          return data;
        }

        return {
          data,
          meta: {
            timestamp: new Date().toISOString(),
            path: request.path,
            statusCode: response.statusCode,
            duration,
          },
        };
      }),
    );
  }
}
