#!/usr/bin/env node
/**
 * CLI for Convex Self Static Hosting
 *
 * Commands:
 *   deploy              One-shot deployment (Convex backend + static files)
 *   upload              Upload static files to Convex or Cloudflare Pages
 *   setup-cloudflare    Interactive Cloudflare CDN setup
 *   init                Print setup instructions
 */
declare const command: string;
declare function main(): Promise<void>;
declare function printHelp(): void;
declare function printInitInstructions(): void;
//# sourceMappingURL=index.d.ts.map