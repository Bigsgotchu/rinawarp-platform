import { AIBaseCommand } from './ai-base';
import { CommandContext } from '../command';
import { CommandResult } from '../types';
import { AIFunction, AIMessage } from '../../ai/types';
import AIService from '../../ai/service';

export class ExplainCommand extends AIBaseCommand {
  protected systemPrompt = `You are an expert at explaining technical concepts, code, commands, and error messages. Your explanations should be:
- Clear and concise
- Beginner-friendly while remaining technically accurate
- Include relevant examples when helpful
- Point out common pitfalls or gotchas
- Suggest best practices or improvements

Focus on practical understanding rather than theory unless specifically asked.`;

  protected functions: AIFunction[] = [
    {
      name: 'analyze_code',
      description: 'Analyze code or error message in detail',
      parameters: {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            description: 'The code or error message to analyze',
          },
          language: {
            type: 'string',
            description: 'The programming language or context',
          },
          type: {
            type: 'string',
            enum: ['code', 'error', 'command', 'output'],
            description: 'The type of content being analyzed',
          },
        },
        required: ['content', 'type'],
      },
    },
    {
      name: 'show_documentation',
      description: 'Show relevant documentation',
      parameters: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            description: 'The topic to show documentation for',
          },
          format: {
            type: 'string',
            enum: ['brief', 'detailed'],
            description: 'The level of detail to show',
          },
        },
        required: ['topic'],
      },
    },
  ];

  constructor(context: CommandContext) {
    super(
      {
        name: 'explain',
        description:
          'Get AI-powered explanations for code, errors, or concepts',
        category: 'ai',
        usage: 'explain <code|error|command|concept>',
        examples: [
          'explain git rebase -i HEAD~3',
          'explain "Error: ENOENT: no such file or directory"',
          'explain what is dependency injection',
        ],
      },
      context
    );
  }

  protected async handleFunctionCall(
    functionCall: AIMessage['functionCall']
  ): Promise<CommandResult> {
    if (!functionCall) return { output: '', exitCode: 1 };

    const { name, arguments: args } = functionCall;
    const parsedArgs = JSON.parse(args);

    switch (name) {
      case 'analyze_code': {
        // Get more detailed analysis
        const analysis = await AIService.getInstance().chat(
          `Analyze this ${parsedArgs.type}:\n${parsedArgs.content}`,
          [],
          {
            messages: [
              {
                role: 'system',
                content: `You are analyzing ${parsedArgs.type}. Focus on:
- Main points and key concepts
- Common issues and solutions
- Best practices and improvements
- Relevant examples`,
              },
            ],
          }
        );

        return {
          output: analysis.message.content,
          exitCode: 0,
          metadata: {
            type: parsedArgs.type,
            language: parsedArgs.language,
          },
        };
      }

      case 'show_documentation': {
        // Get documentation
        const docs = await AIService.getInstance().chat(
          `Show ${parsedArgs.format || 'brief'} documentation for: ${parsedArgs.topic}`,
          [],
          {
            messages: [
              {
                role: 'system',
                content: `You are providing ${
                  parsedArgs.format || 'brief'
                } documentation. Focus on:
- Key concepts and usage
- Common use cases
- Important options or parameters
- Related topics`,
              },
            ],
          }
        );

        return {
          output: docs.message.content,
          exitCode: 0,
          metadata: {
            topic: parsedArgs.topic,
            format: parsedArgs.format,
          },
        };
      }

      default:
        return {
          output: `Unknown function: ${name}`,
          exitCode: 1,
        };
    }
  }
}
