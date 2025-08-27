import { CorsOptions } from 'cors';

export interface APIOptions {
  port: number;
  host: string;
  enableDocs: boolean;
  enableMetrics: boolean;
  cors: CorsOptions;
}
