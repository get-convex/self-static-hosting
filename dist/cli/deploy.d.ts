#!/usr/bin/env node
/**
 * One-shot deployment command that deploys both Convex backend and static files.
 *
 * Usage:
 *   npx @get-convex/self-static-hosting deploy [options]
 *
 * This command:
 * 1. Builds the frontend with the correct VITE_CONVEX_URL
 * 2. Deploys the Convex backend (npx convex deploy)
 * 3. Deploys static files to Cloudflare Pages or Convex storage
 *
 * The goal is to minimize the inconsistency window between backend and frontend.
 */
export {};
//# sourceMappingURL=deploy.d.ts.map