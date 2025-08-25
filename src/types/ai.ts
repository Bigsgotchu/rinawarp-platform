export interface AIMessage {
  messageId: string;
  role: string;
  content: string;
  timestamp?: number;
  metadata?: Record<string, any>;
}

export interface AIResponse {
  text: string;
  metadata?: Record<string, any>;
  functionCall?: {
    name: string;
    arguments: Record<string, any>;
  };
}

export type Command = {
  command: string;
  args?: string[];
  options?: Record<string, any>;
};
