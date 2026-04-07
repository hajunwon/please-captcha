export class Logger {
  constructor(private verbose: boolean) {}

  info(msg: string, ...args: unknown[]) {
    if (this.verbose) console.log(`[please-captcha] ${msg}`, ...args);
  }

  warn(msg: string, ...args: unknown[]) {
    console.warn(`[please-captcha] ⚠ ${msg}`, ...args);
  }

  error(msg: string, ...args: unknown[]) {
    console.error(`[please-captcha] ✗ ${msg}`, ...args);
  }
}
