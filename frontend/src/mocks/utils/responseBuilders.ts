import { HttpResponse } from 'msw';
import { now } from './mockHelpers';

// Common error response builders
export const createAuthError = () => {
  return HttpResponse.json(
    {
      error: 'Authentication required',
      message: 'You must be logged in to perform this action',
      code: 'AUTH_REQUIRED',
      timestamp: now(),
    },
    { status: 401 }
  );
};

export const createValidationError = (message: string = 'Invalid request body') => {
  return HttpResponse.json(
    {
      error: 'Validation error',
      message,
      code: 'VALIDATION_ERROR',
      timestamp: now(),
    },
    { status: 400 }
  );
};

export const createNotFoundError = (message: string = 'Resource not found') => {
  return HttpResponse.json(
    {
      error: 'Not found',
      message,
      code: 'NOT_FOUND',
      timestamp: now(),
    },
    { status: 404 }
  );
};

export const createConflictError = (message: string) => {
  return HttpResponse.json(
    {
      error: 'Conflict',
      message,
      code: 'CONFLICT',
      timestamp: now(),
    },
    { status: 409 }
  );
};

export const createServerError = (message: string = 'Internal server error') => {
  return HttpResponse.json(
    {
      error: 'Server error',
      message,
      code: 'SERVER_ERROR',
      timestamp: now(),
    },
    { status: 500 }
  );
};

// Common success response builders
export const createSuccessResponse = <T>(data: T, status: number = 200) => {
  return HttpResponse.json(data, { status });
};

export const createPaginatedResponse = <T>(
  data: T[],
  total: number,
  limit: number,
  offset: number,
  status: number = 200
) => {
  return HttpResponse.json(
    {
      data,
      pagination: {
        total,
        limit,
        offset,
        has_more: offset + limit < total,
        total_pages: Math.ceil(total / limit),
      },
    },
    { status }
  );
};
