import { Test, TestingModule } from '@nestjs/testing';
import { ResponseInterceptor } from './response.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';

describe('ResponseInterceptor', () => {
  let interceptor: ResponseInterceptor<any>;

  beforeEach(async () => {
    interceptor = new ResponseInterceptor();
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should wrap normal responses in standard format', (done) => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({ path: '/test' }),
        getResponse: () => ({ statusCode: 200 }),
      }),
    } as ExecutionContext;

    const mockCallHandler: CallHandler = {
      handle: () => of({ message: 'test data' }),
    };

    interceptor.intercept(mockContext, mockCallHandler).subscribe({
      next: (result) => {
        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('meta');
        expect(result.data).toEqual({ message: 'test data' });
        expect(result.meta).toHaveProperty('timestamp');
        expect(result.meta).toHaveProperty('path', '/test');
        expect(result.meta).toHaveProperty('statusCode', 200);
        expect(result.meta).toHaveProperty('duration');
        done();
      },
    });
  });

  it('should not wrap responses that are already in standard format', (done) => {
    const standardResponse = {
      data: { message: 'already wrapped' },
      meta: { timestamp: '2023-01-01T00:00:00.000Z', path: '/test', statusCode: 200 },
    };

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({ path: '/test' }),
        getResponse: () => ({ statusCode: 200 }),
      }),
    } as ExecutionContext;

    const mockCallHandler: CallHandler = {
      handle: () => of(standardResponse),
    };

    interceptor.intercept(mockContext, mockCallHandler).subscribe({
      next: (result) => {
        expect(result).toEqual(standardResponse);
        done();
      },
    });
  });

  it('should not wrap health check responses', (done) => {
    const healthResponse = { status: 'ok', uptime: 1000 };

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({ path: '/health' }),
        getResponse: () => ({ statusCode: 200 }),
      }),
    } as ExecutionContext;

    const mockCallHandler: CallHandler = {
      handle: () => of(healthResponse),
    };

    interceptor.intercept(mockContext, mockCallHandler).subscribe({
      next: (result) => {
        expect(result).toEqual(healthResponse);
        done();
      },
    });
  });

  it('should not wrap Buffer responses', (done) => {
    const bufferResponse = Buffer.from('file content');

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({ path: '/download' }),
        getResponse: () => ({ statusCode: 200 }),
      }),
    } as ExecutionContext;

    const mockCallHandler: CallHandler = {
      handle: () => of(bufferResponse),
    };

    interceptor.intercept(mockContext, mockCallHandler).subscribe({
      next: (result) => {
        expect(result).toEqual(bufferResponse);
        done();
      },
    });
  });

  it('should include duration in meta', (done) => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({ path: '/test' }),
        getResponse: () => ({ statusCode: 200 }),
      }),
    } as ExecutionContext;

    const mockCallHandler: CallHandler = {
      handle: () => of({ message: 'test data' }),
    };

    interceptor.intercept(mockContext, mockCallHandler).subscribe({
      next: (result) => {
        expect(result.meta.duration).toBeDefined();
        expect(typeof result.meta.duration).toBe('number');
        expect(result.meta.duration).toBeGreaterThanOrEqual(0);
        done();
      },
    });
  });
});
