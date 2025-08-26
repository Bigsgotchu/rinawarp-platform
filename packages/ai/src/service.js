"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIService = void 0;
const shared_1 = require("@rinawarp/shared");
const core_1 = require("@rinawarp/core");
const axios_1 = __importDefault(require("axios"));
class AIService {
    constructor() {
        this.apiKey = process.env.AI_MODEL_API_KEY || '';
        this.endpoint = process.env.AI_MODEL_ENDPOINT || 'https://api.example.com/v1';
        this.cache = core_1.CacheService.getInstance();
    }
    static getInstance() {
        if (!AIService.instance) {
            AIService.instance = new AIService();
        }
        return AIService.instance;
    }
    async generateResponse(prompt, options = {}, context) {
        try {
            const cacheKey = `ai_response:${Buffer.from(prompt + JSON.stringify(context || {})).toString('base64')}`;
            const cached = await this.cache.get(cacheKey);
            if (cached)
                return cached;
            const response = await axios_1.default.post(this.endpoint, {
                prompt,
                context,
                ...options,
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${this.apiKey}`,
                },
            });
            const result = {
                text: response.data.choices[0].text,
                tokens: {
                    prompt: response.data.usage.prompt_tokens,
                    completion: response.data.usage.completion_tokens,
                    total: response.data.usage.total_tokens,
                },
            };
            await this.cache.set(cacheKey, result, 3600); // Cache for 1 hour
            return result;
        }
        catch (error) {
            shared_1.logger.error('Error generating AI response:', error);
            throw error;
        }
    }
    async analyzeCommand(command, context) {
        try {
            const cacheKey = `command_analysis:${Buffer.from(command + JSON.stringify(context || {})).toString('base64')}`;
            const cached = await this.cache.get(cacheKey);
            if (cached)
                return cached;
            const response = await this.generateResponse(command, {
                temperature: 0.7,
                maxTokens: 200,
            }, {
                previousCommands: context?.previousCommands,
                currentDirectory: context?.currentDirectory,
            });
            const result = {
                suggestion: response.text,
                nextCommands: response.text
                    .split('\n')
                    .filter((line) => line.trim().startsWith('$'))
                    .map((line) => line.trim().slice(2)),
            };
            await this.cache.set(cacheKey, result, 3600); // Cache for 1 hour
            return result;
        }
        catch (error) {
            shared_1.logger.error('Error analyzing command:', error);
            throw error;
        }
    }
}
exports.AIService = AIService;
exports.default = AIService;
//# sourceMappingURL=service.js.map