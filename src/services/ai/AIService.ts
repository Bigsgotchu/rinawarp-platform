import OpenAI from 'openai';
import {
  AIResponse,
  Command,
  CommandContext,
  CommandExplanation,
  CommandSuggestion,
  ErrorResolution,
} from '../types';
import { UserProfile } from './types/UserProfile';
import logger from '../utils/logger';
import CommandLearningService from './CommandLearningService';
import UserProfileService from './UserProfileService';

class AIService {
  private openai: OpenAI;
  private readonly BASE_SYSTEM_PROMPT = `You are an AI terminal assistant. Your role is to:
1. Suggest improvements to commands
2. Explain what commands do in detail
3. Provide safer alternatives when necessary
4. Detect potentially dangerous commands
5. Suggest command combinations and pipelines
6. Help resolve command errors
Be concise and focus on practical, security-conscious suggestions.`;

  private readonly ERROR_SYSTEM_PROMPT = `You are a command-line error resolution expert. Analyze the error output and:
1. Identify the root cause
2. List possible solutions
3. Provide example commands to fix the issue
4. Warn about potential pitfalls
Be specific and security-conscious in your suggestions.`;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  private buildSystemPrompt(profile?: UserProfile): string {
    if (!profile) return this.BASE_SYSTEM_PROMPT;

    const skillLevel = profile.skillLevel.overall;
    const verbosity = profile.preferences.verbosityLevel;

    let prompt = this.BASE_SYSTEM_PROMPT + '\n\nUser Profile:';
    prompt += `\n- Skill Level: ${skillLevel}/100`;
    prompt += `\n- Preferred Detail Level: ${verbosity}`;
    prompt += `\n- Risk Tolerance: ${profile.preferences.riskTolerance}`;

    if (profile.preferences.favoriteCommands.length > 0) {
      prompt +=
        '\n- Frequently Used Commands: ' +
        profile.preferences.favoriteCommands.slice(0, 5).join(', ');
    }

    prompt += '\n\nAdjust your responses accordingly:';
    prompt += `\n- ${skillLevel < 30 ? 'Focus on basic explanations and safe commands' : ''}`;
    prompt += `\n- ${skillLevel > 70 ? 'Include advanced techniques and optimizations' : ''}`;
    prompt += `\n- ${verbosity === 'expert' ? 'Provide detailed technical explanations' : ''}`;
    prompt += `\n- ${profile.preferences.riskTolerance === 'low' ? 'Prioritize safe alternatives' : ''}`;

    return prompt;
  }

  async analyzeCommand(
    command: Command,
    context?: CommandContext,
    userId?: string
  ): Promise<AIResponse> {
    try {
      const fullCommand =
        `${command.command} ${command.args?.join(' ') || ''}`.trim();

      // Get user profile and contextual suggestions
      let userProfile: UserProfile | undefined;
      let contextualPatterns: string[] = [];

      if (userId) {
        userProfile = await UserProfileService.getProfile(userId);
      }

      if (context) {
        contextualPatterns =
          await CommandLearningService.getContextualSuggestions(
            command,
            context
          );
      }

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: this.buildSystemPrompt(userProfile) },
          context && {
            role: 'user',
            content: `Context: Working directory: ${context.currentDirectory}, Previous commands: ${context.previousCommands?.join(', ')}`,
          },
          contextualPatterns.length > 0 && {
            role: 'user',
            content: `Similar successful commands: ${contextualPatterns.join(', ')}`,
          },
          { role: 'user', content: `Analyze this command: ${fullCommand}` },
        ].filter(Boolean),
        temperature: 0.7,
        max_tokens: 500,
      });

      const response = completion.choices[0]?.message?.content || '';

      // Parse the structured response
      const explanation: CommandExplanation = {
        description: this.extractSection(response, 'Description'),
        examples: this.extractSection(response, 'Examples')
          .split('\n')
          .map(e => e.trim())
          .filter(Boolean),
        warnings: this.extractSection(response, 'Warnings')
          .split('\n')
          .map(w => w.trim())
          .filter(Boolean),
        seeAlso: this.extractSection(response, 'See Also')
          .split(',')
          .map(s => s.trim())
          .filter(Boolean),
      };

      const alternatives: CommandSuggestion[] = this.extractSection(
        response,
        'Alternatives'
      )
        .split('\n')
        .map(alt => {
          const [cmd, ...desc] = alt.split('-').map(s => s.trim());
          return {
            command: cmd,
            explanation: desc.join('-').trim(),
            risk: this.assessRisk(cmd),
          };
        })
        .filter(alt => alt.command);

      const commandChains: CommandSuggestion[] = this.extractSection(
        response,
        'Command Chains'
      )
        .split('\n')
        .map(chain => {
          const [cmd, ...desc] = chain.split('-').map(s => s.trim());
          return {
            command: cmd,
            explanation: desc.join('-').trim(),
            risk: this.assessRisk(cmd),
          };
        })
        .filter(chain => chain.command);

      return {
        suggestion: this.extractSection(response, 'Suggestion'),
        explanation,
        alternatives,
        commandChains,
      };
    } catch (error) {
      logger.error('AI command analysis failed:', error);
      return {
        suggestion: 'Unable to analyze command at this time.',
        alternatives: [],
      };
    }
  }

  private extractSection(text: string, section: string): string {
    const regex = new RegExp(`${section}:\s*([\\s\\S]*?)(?:(?:^\\w+:|$))`, 'm');
    return (text.match(regex)?.[1] || '').trim();
  }

  private assessRisk(command: string): 'low' | 'medium' | 'high' {
    const highRiskPatterns = [/rm\s+-rf/, /mkfs/, /dd/, /chmod\s+777/];

    const mediumRiskPatterns = [/sudo/, /chmod/, /chown/, /mv/];

    if (highRiskPatterns.some(p => p.test(command))) return 'high';
    if (mediumRiskPatterns.some(p => p.test(command))) return 'medium';
    return 'low';
  }

  async validateCommandSafety(command: Command): Promise<boolean> {
    try {
      const fullCommand =
        `${command.command} ${command.args?.join(' ') || ''}`.trim();

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content:
              "You are a security expert. Respond with 'SAFE' or 'UNSAFE' followed by a brief reason. Consider rm -rf, curl | bash, and similar dangerous patterns.",
          },
          { role: 'user', content: `Is this command safe: ${fullCommand}` },
        ],
        temperature: 0.3,
        max_tokens: 50,
      });

      const response = completion.choices[0]?.message?.content || '';
      return response.toUpperCase().startsWith('SAFE');
    } catch (error) {
      logger.error('AI safety validation failed:', error);
      return false; // Fail closed - treat as unsafe if validation fails
    }
  }

  async analyzeError(
    command: Command,
    errorOutput: string,
    context?: CommandContext,
    userId?: string
  ): Promise<ErrorResolution> {
    try {
      // Get user profile if available
      let userProfile: UserProfile | undefined;
      if (userId) {
        userProfile = await UserProfileService.getProfile(userId);
      }

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: this.ERROR_SYSTEM_PROMPT },
          context && {
            role: 'user',
            content: `Context: Working directory: ${context.currentDirectory}, OS: ${context.operatingSystem}`,
          },
          {
            role: 'user',
            content: `Command: ${command.command} ${command.args?.join(' ') || ''}
Error: ${errorOutput}`,
          },
        ].filter(Boolean),
        temperature: 0.5,
        max_tokens: 300,
      });

      const response = completion.choices[0]?.message?.content || '';

      const possibleCauses = this.extractSection(response, 'Causes')
        .split('\n')
        .map(c => c.trim())
        .filter(Boolean);

      const suggestedFixes: CommandSuggestion[] = this.extractSection(
        response,
        'Fixes'
      )
        .split('\n')
        .map(fix => {
          const [cmd, ...desc] = fix.split('-').map(s => s.trim());
          return {
            command: cmd,
            explanation: desc.join('-').trim(),
            risk: this.assessRisk(cmd),
          };
        })
        .filter(fix => fix.command);

      return {
        error: errorOutput,
        possibleCauses,
        suggestedFixes,
      };
    } catch (error) {
      logger.error('Error analysis failed:', error);
      return {
        error: errorOutput,
        possibleCauses: ['Unable to analyze error'],
        suggestedFixes: [],
      };
    }
  }
}

export default new AIService();
