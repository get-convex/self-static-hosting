#!/usr/bin/env node
"use strict";
/**
 * Output integration instructions for LLMs.
 *
 * Usage:
 *   npx @get-convex/self-static-hosting init
 */
const instructions = `
# Convex Self Static Hosting - Integration Instructions

You are integrating the @get-convex/self-static-hosting component into a Convex app.
This component enables hosting static files (React/Vite apps) directly on Convex.

## What This Component Does

- Stores static files in Convex storage
- Serves files via HTTP actions with proper MIME types
- Supports SPA routing (fallback to index.html)
- Smart caching: hashed assets cached forever, HTML revalidates
- ETag support for efficient cache revalidation
- Live reload notifications when new deployments happen
- Optional Cloudflare CDN integration

## Files to Create/Modify

### 1. convex/convex.config.ts (create or modify)

\`\`\`typescript
import { defineApp } from "convex/server";
import selfStaticHosting from "@get-convex/self-static-hosting/convex.config";

const app = defineApp();
app.use(selfStaticHosting);

export default app;
\`\`\`

### 2. convex/staticHosting.ts (create)

\`\`\`typescript
import { components } from "./_generated/api";
import {
  exposeUploadApi,
  exposeDeploymentQuery,
  exposeCachePurgeAction,
} from "@get-convex/self-static-hosting";

// Internal functions for secure uploads (only callable via CLI)
export const { generateUploadUrl, recordAsset, gcOldAssets, listAssets } =
  exposeUploadApi(components.selfStaticHosting);

// Public query for live reload notifications
export const { getCurrentDeployment } =
  exposeDeploymentQuery(components.selfStaticHosting);

// Optional: Cloudflare cache purge (for CI/CD)
export const { purgeCloudflareCache } = exposeCachePurgeAction();
\`\`\`

### 3. convex/http.ts (create or modify)

\`\`\`typescript
import { httpRouter } from "convex/server";
import { registerStaticRoutes } from "@get-convex/self-static-hosting";
import { components } from "./_generated/api";

const http = httpRouter();

// Option A: Serve at root (if no other HTTP routes)
registerStaticRoutes(http, components.selfStaticHosting);

// Option B: Serve at /app/ prefix (recommended if you have API routes)
// registerStaticRoutes(http, components.selfStaticHosting, {
//   pathPrefix: "/app",
// });

// Add other HTTP routes here if needed
// http.route({ path: "/api/webhook", method: "POST", handler: ... });

export default http;
\`\`\`

### 4. package.json scripts (add)

\`\`\`json
{
  "scripts": {
    "build": "vite build",
    "deploy:static": "npx @get-convex/self-static-hosting upload --build --prod"
  }
}
\`\`\`

IMPORTANT: Use \`--build\` flag instead of running \`npm run build\` separately.
The \`--build\` flag ensures \`VITE_CONVEX_URL\` is set correctly for the target
environment (production or dev). Running build separately uses .env.local which
has the dev URL.

For custom domains with Cloudflare:
\`\`\`json
{
  "scripts": {
    "deploy:static": "npx @get-convex/self-static-hosting upload --build --prod --domain yourdomain.com"
  }
}
\`\`\`

### 5. src/App.tsx (optional: add live reload banner)

\`\`\`typescript
import { UpdateBanner } from "@get-convex/self-static-hosting/react";
import { api } from "../convex/_generated/api";

function App() {
  return (
    <div>
      {/* Shows banner when new deployment is available */}
      <UpdateBanner
        getCurrentDeployment={api.staticHosting.getCurrentDeployment}
        message="New version available!"
        buttonText="Refresh"
      />
      
      {/* Rest of your app */}
    </div>
  );
}
\`\`\`

Or use the hook for custom UI:
\`\`\`typescript
import { useDeploymentUpdates } from "@get-convex/self-static-hosting/react";
import { api } from "../convex/_generated/api";

function App() {
  const { updateAvailable, reload, dismiss } = useDeploymentUpdates(
    api.staticHosting.getCurrentDeployment
  );
  
  // Custom update notification UI
}
\`\`\`

## Deployment

\`\`\`bash
# Login to Convex (first time)
npx convex login

# Deploy Convex backend to production FIRST
npx convex deploy

# Deploy static files to production
npm run deploy:static

# Your app is now live at:
# https://your-deployment.convex.site
# (or https://your-deployment.convex.site/app/ if using path prefix)
\`\`\`

For development/testing:
\`\`\`bash
# Push to dev environment
npx convex dev --once

# Deploy static files to dev (omit --prod)
npx @get-convex/self-static-hosting upload --build
\`\`\`

## Optional: Cloudflare CDN with Custom Domain

For production with a custom domain, edge caching, and DDoS protection.

### Quick Setup (Recommended)

Run the interactive wizard:

\`\`\`bash
npx @get-convex/self-static-hosting setup-cloudflare
\`\`\`

This wizard will:
1. Login to Cloudflare (via wrangler)
2. Let you select or add a domain
3. Detect your production Convex deployment URL
4. Configure DNS (CNAME pointing to your Convex site)
5. Deploy a Cloudflare Worker to handle Host header rewriting
6. Set SSL/TLS mode to "Full" (prevents redirect loops)
7. Set up cache purge credentials
8. Offer to deploy your Convex backend and static files

After setup, deploy with:
\`\`\`bash
npm run deploy:static
\`\`\`

The Cloudflare cache is automatically purged on each deploy.

### Manual Cloudflare Setup

If you prefer manual setup:

1. Add your domain to Cloudflare
2. Create a CNAME record pointing to your-deployment.convex.site
3. Deploy a Cloudflare Worker to rewrite the Host header (required!)
4. Set SSL/TLS mode to "Full" (not "Flexible")

For CI/CD, set environment variables:
\`\`\`bash
export CLOUDFLARE_ZONE_ID="your-zone-id"
export CLOUDFLARE_API_TOKEN="your-api-token"
npm run deploy:static
\`\`\`

## CLI Reference

\`\`\`bash
npx @get-convex/self-static-hosting upload [options]

Options:
  -d, --dist <path>        Path to dist directory (default: ./dist)
  -c, --component <name>   Convex component name (default: staticHosting)
      --prod               Deploy to production Convex deployment
      --dev                Deploy to dev deployment (default)
  -b, --build              Run 'npm run build' with correct VITE_CONVEX_URL
      --domain <name>      Custom domain for URL output and cache purge
  -h, --help               Show help
\`\`\`

## Important Notes

1. The upload functions are INTERNAL - they can only be called via \`npx convex run\`, not from the public internet
2. Static files are stored in the app's storage (not the component's) for proper isolation
3. Hashed assets (e.g., main-abc123.js) get immutable caching; HTML files always revalidate
4. The component supports SPA routing - routes without file extensions serve index.html
5. Always use \`--build\` flag to ensure VITE_CONVEX_URL is set correctly for the target environment
6. Deploy Convex backend (\`npx convex deploy\`) BEFORE deploying static files to production
`;
console.log(instructions);
//# sourceMappingURL=init.js.map