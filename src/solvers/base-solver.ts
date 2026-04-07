import type { ChallengeType, ChallengeData, SolveResult } from "../types";
import { AIClient } from "../ai/ai-client";
import type { Logger } from "../utils/logger";

export abstract class BaseSolver {
  constructor(
    protected ai: AIClient,
    protected model: string,
    protected log: Logger,
  ) {}

  abstract canSolve(type: ChallengeType): boolean;
  abstract solve(data: ChallengeData): Promise<SolveResult>;
}
