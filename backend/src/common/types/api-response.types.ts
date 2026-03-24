// Utility types for standardized API responses
export interface ApiResponse<T> {
  data: T;
  meta: {
    timestamp: string;
    path: string;
    statusCode: number;
    duration?: number;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: ApiResponse<T[]>['meta'] & {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// Helper function to create paginated responses
export function createPaginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
  path: string,
  statusCode: number = 200,
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / limit);
  
  return {
    data: items,
    meta: {
      timestamp: new Date().toISOString(),
      path,
      statusCode,
      total,
      page,
      limit,
      totalPages,
    },
  };
}
