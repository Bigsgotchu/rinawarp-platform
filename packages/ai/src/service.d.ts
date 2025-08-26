import { AIContext, AIOptions, AIResponse } from './types';
export declare class AIService {
    private static instance;
    private readonly apiKey;
    private readonly endpoint;
    private cache;
    private constructor();
    static getInstance(): AIService;
    generateResponse(prompt: string, options?: AIOptions, context?: AIContext): Promise<AIResponse>;
    analyzeCommand(command: string, context?: {
        previousCommands?: string[];
        currentDirectory?: string;
    }): Promise<{
        suggestion: string;
        nextCommands?: string[];
    }>;
}
export default AIService;
