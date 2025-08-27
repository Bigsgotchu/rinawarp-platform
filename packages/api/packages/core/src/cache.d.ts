export declare class CacheService {
    private static instance;
    private client;
    private constructor();
    static getInstance(): CacheService;
    get<T>(key: string): Promise<T | null>;
    set(key: string, value: unknown, ttl?: number): Promise<void>;
    del(key: string): Promise<void>;
    flushAll(): Promise<void>;
}
export default CacheService;
