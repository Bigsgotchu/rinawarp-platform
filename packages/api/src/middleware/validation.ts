import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, z } from 'zod';
import { APIError } from './error-handler';

export interface ValidateRequestSchema {
  body?: AnyZodObject;
  query?: AnyZodObject;
  params?: AnyZodObject;
}

export const validateRequest = (schema: ValidateRequestSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body);
      }
      if (schema.query) {
        req.query = await schema.query.parseAsync(req.query);
      }
      if (schema.params) {
        req.params = await schema.params.parseAsync(req.params);
      }
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        next(
          new APIError(400, 'Validation error', {
            errors: error.errors.map((e) => ({
              path: e.path.join('.'),
              message: e.message,
            })),
          })
        );
      } else {
        next(error);
      }
    }
  };
};
