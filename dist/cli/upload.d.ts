#!/usr/bin/env node
/**
 * CLI tool to upload static files to Convex storage or Cloudflare Workers.
 *
 * Usage:
 *   npx @get-convex/self-static-hosting upload [options]
 *
 * Options:
 *   --dist <path>            Path to dist directory (default: ./dist)
 *   --component <name>       Convex component with upload functions (default: staticHosting)
 *   --prod                   Deploy to production deployment
 *   --domain <domain>        Domain for Cloudflare cache purge (auto-detects zone ID)
 *   --cloudflare-workers     Deploy to Cloudflare Workers instead of Convex storage
 *   --worker-name <name>     Worker name for deployment (required with --cloudflare-workers)
 *   --help                   Show help
 */
export {};
//# sourceMappingURL=upload.d.ts.map