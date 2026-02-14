import { generateText } from 'ai';

export interface UserProgress {
  userId: string;
  labId: string;
  currentStep: number;
  commandsAttempted: string[];
  mistakesMade: string[];
  hintRequests: number;
  completedSteps: number[];
}

export interface SmartHint {
  level: 'subtle' | 'moderate' | 'solution';
  hint: string;
  explanation: string;
  commandToTry?: string;
}

export class SmartHintsEngine {
  async generateSmartHint(
    progress: UserProgress,
    stepDescription: string,
    expectedCommand: string,
    labContext: string
  ): Promise<SmartHint> {
    try {
      // Subtle hint
      const subtleResponse = await generateText({
        model: 'openai/gpt-4o-mini',
        prompt: `Given this AWS lab step: "${stepDescription}"
        
The user is trying to complete this step. Generate a subtle hint that guides them without giving the answer.
Keep it concise (1-2 sentences) and encouraging.`,
      });

      // Moderate hint
      const moderateResponse = await generateText({
        model: 'openai/gpt-4o-mini',
        prompt: `For AWS lab step: "${stepDescription}"
Expected command pattern: ${expectedCommand}

User attempts so far: ${progress.commandsAttempted.slice(-3).join(', ')}
User mistakes: ${progress.mistakesMade.join(', ')}

Generate a helpful hint that points toward the solution without giving it away completely.
Include what parameter or flag might be needed.`,
      });

      // Solution
      const solutionResponse = await generateText({
        model: 'openai/gpt-4o-mini',
        prompt: `For AWS lab step: "${stepDescription}"
Expected command: ${expectedCommand}

Generate an explanation of why this command works and what each part does.`,
      });

      // Determine which hint level to return based on progress
      let level: 'subtle' | 'moderate' | 'solution' = 'subtle';
      if (progress.hintRequests > 2) level = 'moderate';
      if (progress.hintRequests > 4) level = 'solution';

      const hints = {
        subtle: {
          level: 'subtle' as const,
          hint: subtleResponse.text,
          explanation: 'Think about what AWS service needs to be accessed.',
          commandToTry: undefined,
        },
        moderate: {
          level: 'moderate' as const,
          hint: moderateResponse.text,
          explanation: 'Focus on the flags and parameters needed.',
          commandToTry: undefined,
        },
        solution: {
          level: 'solution' as const,
          hint: solutionResponse.text,
          explanation: 'Here is how to complete this step',
          commandToTry: expectedCommand,
        },
      };

      return hints[level];
    } catch (error) {
      // Fallback hints if API fails
      return {
        level: 'subtle',
        hint: 'Try using the AWS CLI command related to this step.',
        explanation: 'Focus on the service and action you need to perform.',
      };
    }
  }

  async generateContextualHelp(
    labId: string,
    stepDescription: string,
    userError: string,
    labContext: string
  ): Promise<string> {
    try {
      const response = await generateText({
        model: 'openai/gpt-4o-mini',
        prompt: `AWS Lab: ${labContext}
Step: ${stepDescription}
User Error: ${userError}

Provide a helpful explanation of what went wrong and how to fix it.
Keep it concise and educational.`,
      });

      return response.text;
    } catch (error) {
      return 'Try reviewing the step description and ensure all required parameters are included.';
    }
  }

  calculateDifficultyAdjustment(progress: UserProgress): number {
    // Adjust difficulty based on performance
    const mistakeRatio = progress.mistakesMade.length / Math.max(progress.commandsAttempted.length, 1);
    const hintUsageRatio = progress.hintRequests / Math.max(progress.completedSteps.length, 1);

    if (mistakeRatio > 0.5 || hintUsageRatio > 2) return -1; // Decrease difficulty
    if (mistakeRatio < 0.1 && hintUsageRatio < 0.5) return 1; // Increase difficulty
    return 0; // Keep same difficulty
  }
}

export const smartHintsEngine = new SmartHintsEngine();
