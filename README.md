# Convex Self Static Hosting

[![npm version](https://badge.fury.io/js/@get-convex%2Fself-static-hosting.svg)](https://badge.fury.io/js/@get-convex/self-static-hosting)

A Convex component that enables self-hosting static React/Vite apps using Convex
HTTP actions and file storage. No external hosting provider required!

## Features

- 🚀 **Simple deployment** - Upload your built files directly to Convex storage
- 🔒 **Secure by default** - Upload API uses internal functions (not publicly
  accessible)
- 🔄 **SPA support** - Automatic fallback to index.html for client-side routing
- ⚡ **Smart caching** - Hashed assets get long-term caching, HTML is always
  fresh with ETag support
- 🧹 **Auto cleanup** - Old deployment files are automatically garbage collected
- ☁️ **Cloudflare ready** - One-command CDN setup with automatic cache purging
- 📦 **Zero config** - Works out of the box with Vite, Create React App, and
  other bundlers

## Installation

Install the component:

```bash
npm install github:get-convex/self-static-hosting#main
```

### Quick Start with LLM

Get comprehensive integration instructions to paste into your AI assistant:

```bash
npx @get-convex/self-static-hosting init
```

This outputs all the code you need to integrate the component.

### Manual Setup

Add to your `convex/convex.config.ts`:

```ts
import { defineApp } from "convex/server";
import selfStaticHosting from "@get-convex/self-static-hosting/convex.config.js";

const app = defineApp();
app.use(selfStaticHosting);

export default app;
```

## Setup

### 1. Register HTTP routes

Create or update `convex/http.ts` to serve static files:

```ts
import { httpRouter } from "convex/server";
import { registerStaticRoutes } from "@get-convex/self-static-hosting";
import { components } from "./_generated/api";

const http = httpRouter();

// Serve static files at the root path with SPA fallback
registerStaticRoutes(http, components.selfStaticHosting);

export default http;
```

### 2. Expose upload API (internal functions)

Create a file like `convex/staticHosting.ts`:

```ts
import { exposeUploadApi } from "@get-convex/self-static-hosting";
import { components } from "./_generated/api";

// These are INTERNAL functions - only callable via `npx convex run`
// NOT accessible from the public internet
export const { generateUploadUrl, recordAsset, gcOldAssets, listAssets } =
  exposeUploadApi(components.selfStaticHosting);
```

### 3. Add deploy script to package.json

```json
{
  "scripts": {
    "build": "vite build",
    "deploy:static": "npx @get-convex/self-static-hosting upload --build --prod"
  }
}
```

**Important:** Use `--build` to ensure `VITE_CONVEX_URL` is set correctly for
production. Don't run `npm run build` separately before the upload command, as
that would use the dev URL from `.env.local`.

**CLI Options:**

```bash
npx @get-convex/self-static-hosting upload [options]

Options:
  -d, --dist <path>        Path to dist directory (default: ./dist)
  -c, --component <name>   Convex component name (default: staticHosting)
      --prod               Deploy to production Convex deployment
      --dev                Deploy to dev deployment (default)
  -b, --build              Run 'npm run build' with correct VITE_CONVEX_URL
      --domain <name>      Custom domain for URL output and Cloudflare cache purge
  -h, --help               Show help
```

**Examples:**

```bash
# Deploy to production with automatic build
npx @get-convex/self-static-hosting upload --build --prod

# Deploy to production with custom domain (also purges Cloudflare cache)
npx @get-convex/self-static-hosting upload --build --prod --domain mysite.com

# Deploy to dev (for testing)
npx @get-convex/self-static-hosting upload --build
```

## Deployment

```bash
# Make sure you're logged in to Convex
npx convex login

# Deploy your Convex backend to production first
npx convex deploy

# Deploy static files to production
npm run deploy:static
```

Your app is now live at `https://your-deployment.convex.site`

If you have a custom domain set up via Cloudflare, add `--domain`:

```json
{
  "scripts": {
    "deploy:static": "npx @get-convex/self-static-hosting upload --build --prod --domain mysite.com"
  }
}
```

This will show your custom domain in the output and automatically purge the
Cloudflare cache.

## Security

The upload API uses **internal functions** that can only be called via:

- `npx convex run` (requires Convex CLI authentication)
- Other Convex functions (server-side only)

This means unauthorized users **cannot** upload files to your site, even if they
know your Convex URL.

## CDN Setup (Cloudflare)

For production deployments, put Cloudflare in front of your Convex static site
for edge caching, compression, DDoS protection, and custom domains.

### Quick Setup (Recommended)

```bash
npx @get-convex/self-static-hosting setup-cloudflare
```

This interactive wizard will:

1. Login to Cloudflare (via wrangler)
2. Let you select or add a domain
3. Detect your production Convex deployment URL
4. Configure DNS (CNAME pointing to your Convex site)
5. Deploy a Cloudflare Worker to handle Host header rewriting
6. Ensure SSL/TLS mode is set to "Full" (prevents redirect loops)
7. Set up cache purge credentials
8. Offer to deploy your Convex backend and static files

Then just deploy - cache is automatically purged!

### What You Get

### Cache Behavior

| File Type                | Cache-Control            | ETag | CDN Behavior                       |
| ------------------------ | ------------------------ | ---- | ---------------------------------- |
| `*.js`, `*.css` (hashed) | `max-age=1yr, immutable` | ✓    | Cached forever, new hash = new URL |
| `index.html`             | `must-revalidate`        | ✓    | Revalidates with 304 support       |
| Images, fonts            | `max-age=1yr, immutable` | ✓    | Cached long-term                   |

### Recommended: Use a Path Prefix

When using Cloudflare, serve static files from a dedicated path (e.g., `/app/`)
so your API routes remain unaffected:

```ts
// convex/http.ts
import { httpRouter } from "convex/server";
import { registerStaticRoutes } from "@get-convex/self-static-hosting";
import { components } from "./_generated/api";

const http = httpRouter();

// Static files at /app/ - cached aggressively by Cloudflare
registerStaticRoutes(http, components.selfStaticHosting, {
  pathPrefix: "/app",
});

// Your API routes - different cache rules or no caching
http.route({
  path: "/api/webhook",
  method: "POST",
  handler: webhookHandler,
});

export default http;
```

This lets you configure Cloudflare Page Rules separately:

- `/app/*` → Cache Everything, Edge TTL: 1 month
- `/api/*` → Bypass Cache

Your app will be available at `https://yourdomain.com/app/`

### Setting Up Cloudflare (Manual)

If you prefer to set up manually instead of using the wizard:

1. **Add your site to Cloudflare** and update your domain's nameservers

2. **Create a CNAME record** pointing to your Convex site:

   ```
   Type: CNAME
   Name: @ (or subdomain)
   Target: your-deployment.convex.site
   Proxy: Enabled (orange cloud)
   ```

3. **Deploy a Cloudflare Worker** to rewrite the Host header (required because
   Convex validates the Host header matches `*.convex.site`):

   ```js
   export default {
     async fetch(request) {
       const url = new URL(request.url);
       const convexUrl = new URL(
         url.pathname + url.search,
         "https://your-deployment.convex.site",
       );
       const headers = new Headers(request.headers);
       headers.set("Host", "your-deployment.convex.site");
       return fetch(convexUrl.toString(), {
         method: request.method,
         headers,
         body: request.body,
       });
     },
   };
   ```

   Then add a route: `yourdomain.com/*` → your worker

4. **Set SSL/TLS mode to "Full"** - This is critical! "Flexible" mode will cause
   redirect loops because Cloudflare sends HTTP to Convex, which redirects to
   HTTPS.

5. **(Optional) Add Page Rules** for fine-grained cache control:
   - `/app/assets/*` → Cache Level: Cache Everything, Edge TTL: 1 year
   - `/app/*` → Cache Level: Cache Everything, Edge TTL: 1 day

### Cache Purging

The CLI can automatically purge Cloudflare cache after deploying.

**Option 1: Use `--domain` flag (recommended)**

```bash
# First, login to Cloudflare via wrangler
npx wrangler login

# Then deploy with your domain
npx @get-convex/self-static-hosting upload --build --prod --domain mysite.com
```

The CLI will auto-detect your zone ID and purge the cache.

**Option 2: Environment variables (for CI/CD)**

If you ran `setup-cloudflare`, the credentials are saved in `.env.local`.
Otherwise, set them manually:

```bash
export CLOUDFLARE_ZONE_ID="your-zone-id"
export CLOUDFLARE_API_TOKEN="your-api-token"
npx @get-convex/self-static-hosting upload --build --prod
```

To get these values:

- Zone ID: Found on your domain's overview page in Cloudflare
- API Token: Create at dash.cloudflare.com/profile/api-tokens with "Cache Purge"
  permission

**Option 3: Via Convex function (for advanced CI/CD)**

Expose the cache purge action in your `convex/staticHosting.ts`:

```ts
import { exposeCachePurgeAction } from "@get-convex/self-static-hosting";

export const { purgeCloudflareCache } = exposeCachePurgeAction();
```

Then call it from your CI/CD pipeline:

```bash
npx convex run staticHosting:purgeCloudflareCache \
  '{"zoneId": "...", "apiToken": "...", "purgeAll": true}'
```

## Live Reload on Deploy

Connected clients can be notified when a new deployment is available:

1. **Expose the deployment query**:

   ```ts
   import { exposeDeploymentQuery } from "@get-convex/self-static-hosting";
   import { components } from "./_generated/api";

   export const { getCurrentDeployment } = exposeDeploymentQuery(
     components.selfStaticHosting,
   );
   ```

2. **Add the update banner to your app**:

   ```tsx
   import { UpdateBanner } from "@get-convex/self-static-hosting/react";
   import { api } from "../convex/_generated/api";

   function App() {
     return (
       <div>
         <UpdateBanner
           getCurrentDeployment={api.staticHosting.getCurrentDeployment}
           message="New version available!"
           buttonText="Refresh"
         />
         {/* rest of your app */}
       </div>
     );
   }
   ```

Or use the hook for custom UI:

```tsx
import { useDeploymentUpdates } from "@get-convex/self-static-hosting/react";

const { updateAvailable, reload, dismiss } = useDeploymentUpdates(
  api.staticHosting.getCurrentDeployment,
);
```

## Configuration Options

### `registerStaticRoutes`

```ts
registerStaticRoutes(http, components.selfStaticHosting, {
  // URL prefix for static files (default: "/")
  pathPrefix: "/app",

  // Enable SPA fallback to index.html (default: true)
  spaFallback: true,
});
```

## How It Works

1. **Build Phase**: Your bundler (Vite, etc.) creates optimized files in `dist/`
2. **Upload Phase**: The upload script uses `npx convex run` to:
   - Generate signed upload URLs
   - Upload each file to Convex storage
   - Record file metadata in the component's database
   - Garbage collect files from previous deployments
3. **Serve Phase**: HTTP actions serve files from storage with:
   - Correct Content-Type headers
   - Smart cache control (immutable for hashed assets)
   - SPA fallback for client-side routing

## Example

Check out the [example](./example) directory for a complete working example.

```bash
npm install
npm run dev
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and guidelines.

## License

Apache-2.0
