// Standard API response envelope used across all endpoints
// Ensures consistent shape for the mobile app to parse

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: ApiError | null;
  meta: ResponseMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export interface ResponseMeta {
  timestamp: string;
  version: string;
  requestId?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: Pagination;
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// ── Builder helpers ───────────────────────────────────────────────

export function ok<T>(data: T, requestId?: string): ApiResponse<T> {
  return {
    success: true,
    data,
    error: null,
    meta: { timestamp: new Date().toISOString(), version: '1', requestId },
  };
}

export function fail(code: string, message: string, details?: Record<string, any>): ApiResponse<null> {
  return {
    success: false,
    data: null,
    error: { code, message, details },
    meta: { timestamp: new Date().toISOString(), version: '1' },
  };
}

export function paginated<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResponse<T> {
  return {
    success: true,
    data,
    error: null,
    meta: { timestamp: new Date().toISOString(), version: '1' },
    pagination: { total, page, limit, hasMore: page * limit < total },
  };
}
