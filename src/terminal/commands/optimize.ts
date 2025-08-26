import { AIBaseCommand } from './ai-base';
import { CommandContext } from '../command';
import { CommandResult } from '../types';
import { AIFunction, AIMessage } from '../../ai/types';
import AIService from '../../ai/service';

export class OptimizeCommand extends AIBaseCommand {
  protected systemPrompt = `You are an expert at optimizing code, commands, and processes. Your optimizations should:
- Improve performance, readability, or both
- Explain the benefits and tradeoffs
- Consider best practices and modern techniques
- Preserve functionality while enhancing efficiency
- Include benchmarks or metrics when relevant

Focus on practical, real-world optimizations that provide measurable benefits.`;

  protected functions: AIFunction[] = [
    {
      name: 'analyze_performance',
      description: 'Analyze performance characteristics',
      parameters: {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            description: 'The code or command to analyze',
          },
          type: {
            type: 'string',
            enum: ['code', 'command', 'query', 'config'],
            description: 'The type of content being analyzed',
          },
          metrics: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                value: { type: 'number' },
                unit: { type: 'string' },
              },
            },
            description: 'Performance metrics if available',
          },
        },
        required: ['content', 'type'],
      },
    },
    {
      name: 'suggest_improvements',
      description: 'Suggest specific improvements',
      parameters: {
        type: 'object',
        properties: {
          original: {
            type: 'string',
            description: 'The original code or command',
          },
          optimized: {
            type: 'string',
            description: 'The optimized version',
          },
          improvements: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                description: { type: 'string' },
                benefit: { type: 'string' },
                tradeoff: { type: 'string' },
              },
            },
            description: 'List of specific improvements',
          },
        },
        required: ['original', 'optimized'],
      },
    },
  ];

  constructor(context: CommandContext) {
    super(
      {
        name: 'optimize',
        description: 'Get AI-powered optimization suggestions',
        category: 'ai',
        usage: 'optimize <code|command|query>',
        examples: [
          'optimize "SELECT * FROM users WHERE name LIKE \'%john%\'"',
          'optimize "for i in $(ls); do echo $i; done"',
          'optimize myFunction()',
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
      case 'analyze_performance': {
        // Get performance analysis
        const analysis = await AIService.getInstance().chat(
          `Analyze performance of this ${parsedArgs.type}:\n${parsedArgs.content}`,
          [],
          {
            messages: [
              {
                role: 'system',
                content: `You are analyzing performance. Focus on:
- Time complexity
- Space complexity
- Resource usage
- Bottlenecks
- Scalability concerns`,
              },
            ],
          }
        );

        let output = analysis.message.content;

        // Add metrics if available
        if (parsedArgs.metrics?.length) {
          output += '\n\nPerformance Metrics:\n';
          output += parsedArgs.metrics
            .map((m: any) => `${m.name}: ${m.value} ${m.unit}`)
            .join('\n');
        }

        return {
          output,
          exitCode: 0,
          metadata: {
            type: parsedArgs.type,
            hasMetrics: !!parsedArgs.metrics?.length,
          },
        };
      }

      case 'suggest_improvements': {
        let output = '## Optimized Version\n\n';
        output += `\`\`\`\n${parsedArgs.optimized}\n\`\`\`\n\n`;

        output += '## Improvements\n\n';
        if (parsedArgs.improvements?.length) {
          parsedArgs.improvements.forEach((imp: any, i: number) => {
            output += `${i + 1}. ${imp.description}\n`;
            output += `   - Benefit: ${imp.benefit}\n`;
            if (imp.tradeoff) {
              output += `   - Tradeoff: ${imp.tradeoff}\n`;
            }
            output += '\n';
          });
        }

        return {
          output,
          exitCode: 0,
          metadata: {
            hasImprovements: !!parsedArgs.improvements?.length,
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
