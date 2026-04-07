import type { Frame } from "puppeteer";
import { SELECTORS } from "../config";
import { AIClient } from "../ai/ai-client";
import type { Logger } from "../utils/logger";

export class PromptExtractor {
  constructor(
    private ai: AIClient,
    private model: string,
    private log: Logger,
  ) {}

  async extract(frame: Frame, screenshot?: Buffer): Promise<string> {
    // Try DOM extraction first
    try {
      const text = await frame.$eval(
        SELECTORS.promptText,
        (el) => el.textContent?.trim() ?? "",
      );
      if (text.length > 0) {
        this.log.info("Prompt from DOM:", text);
        return text;
      }
    } catch {}

    // Fallback: broader selectors
    for (const sel of ["h2", ".challenge-header", "[class*=prompt]"]) {
      try {
        const text = await frame.$eval(sel, (el) => el.textContent?.trim() ?? "");
        if (text.length > 5) {
          this.log.info("Prompt from fallback selector:", text);
          return text;
        }
      } catch {}
    }

    // Last resort: OCR via Claude
    if (screenshot) {
      this.log.info("Extracting prompt via Claude OCR");
      const text = await this.ai.analyzeImage({
        images: [screenshot],
        prompt:
          "Read the text instruction at the top of this CAPTCHA challenge. Return ONLY the instruction text, nothing else.",
        systemPrompt: "You extract text from CAPTCHA screenshots. Return only the text.",
        model: this.model,
        maxTokens: 100,
      });
      if (text.length > 0) return text.trim();
    }

    return "unknown task";
  }
}
