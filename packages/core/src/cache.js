"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheService = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const shared_1 = require("@rinawarp/shared");
class CacheService {
    constructor() {
        this.client = new ioredis_1.default({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379', 10),
            password: process.env.REDIS_PASSWORD,
        });
        this.client.on('error', (error) => {
            shared_1.logger.error('Redis error:', error);
        });
        this.client.on('connect', () => {
            shared_1.logger.info('Redis connected');
        });
    }
    static getInstance() {
        if (!CacheService.instance) {
            CacheService.instance = new CacheService();
        }
        return CacheService.instance;
    }
    async get(key) {
        try {
            const value = await this.client.get(key);
            if (!value)
                return null;
            return JSON.parse(value);
        }
        catch (error) {
            shared_1.logger.error('Error getting cache key:', error);
            return null;
        }
    }
    async set(key, value, ttl) {
        try {
            const stringValue = JSON.stringify(value);
            if (ttl) {
                await this.client.setex(key, ttl, stringValue);
            }
            else {
                await this.client.set(key, stringValue);
            }
        }
        catch (error) {
            shared_1.logger.error('Error setting cache key:', error);
        }
    }
    async del(key) {
        try {
            await this.client.del(key);
        }
        catch (error) {
            shared_1.logger.error('Error deleting cache key:', error);
        }
    }
    async flushAll() {
        try {
            await this.client.flushall();
        }
        catch (error) {
            shared_1.logger.error('Error flushing cache:', error);
        }
    }
}
exports.CacheService = CacheService;
exports.default = CacheService;
//# sourceMappingURL=cache.js.map