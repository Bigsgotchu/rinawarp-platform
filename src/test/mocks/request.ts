import { Request } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';

export function createMockRequest(options: Partial<Request> = {}): Request {
  const mockReq = {
    body: {},
    cookies: {},
    query: {},
    params: {},
    headers: {},
    get: jest.fn((name: string) => mockReq.headers[name.toLowerCase()]),
    header: jest.fn((name: string) => mockReq.headers[name.toLowerCase()]),
    ...options,
  } as Request;

  return mockReq;
}

export function createAuthenticatedRequest(
  userId: string,
  role: string,
  additionalOptions: Partial<Request> = {}
): Request {
  return createMockRequest({
    user: {
      id: userId,
      role,
    },
    ...additionalOptions,
  });
}

export function createJsonRequest<T>(body: T, additionalOptions: Partial<Request> = {}): Request {
  return createMockRequest({
    headers: {
      'content-type': 'application/json',
      ...additionalOptions.headers,
    },
    body,
    ...additionalOptions,
  });
}

export function createMultipartRequest(
  files: Record<string, any>,
  additionalOptions: Partial<Request> = {}
): Request {
  return createMockRequest({
    headers: {
      'content-type': 'multipart/form-data',
      ...additionalOptions.headers,
    },
    files,
    ...additionalOptions,
  });
}
