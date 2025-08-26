import { Request } from 'express';
import { AuthPayload } from '@rinawarp/shared';

export interface AuthRequest extends Request {
  user?: AuthPayload;
}

export interface APIOptions {
  port: number;
  host: string;
  enableMetrics?: boolean;
  enableDocs?: boolean;
  cors?: {
    origin: string | string[];
    credentials: boolean;
  };
}
