# please-captcha

> **WIP** — Development was paused due to personal reasons. This project is currently not functional.

hCaptcha solver powered by AI vision. Pass a Puppeteer page and it automatically detects and solves hCaptcha challenges.

## Supported Providers

| Provider | Model | API Key Required |
|----------|-------|-----------------|
| `gemini` (default) | Gemini 2.5 Flash | `GEMINI_API_KEY` |
| `claude` | Claude Sonnet 4.5 | `ANTHROPIC_API_KEY` |
| `claude-code` | Claude Code CLI | Not required |

## Supported Challenge Types

- Grid Select (3x3, 4x4 image selection)
- Multi Choice
- Area Select (click a specific region in the image)
- Puzzle / Drag-drop (partial support)

## Installation

```bash
git clone https://github.com/hajunwon/please-captcha.git
cd please-captcha
npm install
```

## Quick Start

```typescript
import puppeteer from "puppeteer";
import { solveCaptcha } from "please-captcha";

const browser = await puppeteer.launch({ headless: false });
const page = await browser.newPage();

await page.goto("https://example.com/page-with-hcaptcha");

const success = await solveCaptcha(page, {
  provider: "gemini",   // "gemini" | "claude" | "claude-code"
  verbose: true,
  maxRetries: 5,
});

console.log(success ? "Solved!" : "Failed");
await browser.close();
```

## Configuration

```typescript
interface SolveCaptchaOptions {
  provider?: "gemini" | "claude" | "claude-code";
  apiKey?: string;        // overrides env variable
  model?: string;         // override default model
  maxRetries?: number;    // default: 10
  timeout?: number;       // default: 300000 (5min)
  verbose?: boolean;      // debug logging
}
```

## Environment Variables

```bash
cp .env.example .env
```

```
GEMINI_API_KEY=your-gemini-key
ANTHROPIC_API_KEY=your-anthropic-key   # optional
```

## Development

```bash
npm install
npm run build     # build with tsup
npm run dev       # watch mode
npm run demo      # run example against hcaptcha demo page
```

## License

MIT
