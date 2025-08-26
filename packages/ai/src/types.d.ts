export interface AIResponse {
    text: string;
    tokens: {
        prompt: number;
        completion: number;
        total: number;
    };
}
export interface AIOptions {
    temperature?: number;
    maxTokens?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
}
export interface AIContext {
    previousCommands?: string[];
    currentDirectory?: string;
    environment?: string;
    language?: string;
}
