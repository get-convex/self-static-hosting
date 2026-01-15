# Convex Self Static Hosting

[![npm version](https://badge.fury.io/js/@get-convex%2Fself-static-hosting.svg)](https://badge.fury.io/js/@get-convex/self-static-hosting)

A Convex component that enables self-hosting static React/Vite apps using Convex HTTP actions and file storage. No external hosting provider required!

## Features

- 🚀 **Simple deployment** - Upload your built files directly to Convex storage
- 🔄 **SPA support** - Automatic fallback to index.html for client-side routing
- ⚡ **Smart caching** - Hashed assets get long-term caching, HTML is always fresh
- 🧹 **Auto cleanup** - Old deployment files are automatically garbage collected
- 📦 **Zero config** - Works out of the box with Vite, Create React App, and other bundlers

## Installation

Install the component:

```bash
npm install @get-convex/self-static-hosting
```

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

### 2. Expose upload API

Create a file like `convex/staticHosting.ts` to expose the upload mutations:

```ts
import { exposeUploadApi } from "@get-convex/self-static-hosting";
import { components } from "./_generated/api";

// Expose upload functions for the deployment script
export const { generateUploadUrl, recordAsset, gcOldAssets, listAssets } =
  exposeUploadApi(components.selfStaticHosting);
```

For production, add authentication:

```ts
export const { generateUploadUrl, recordAsset, gcOldAssets, listAssets } =
  exposeUploadApi(components.selfStaticHosting, {
    auth: async (ctx) => {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        throw new Error("Unauthorized");
      }
    },
  });
```

### 3. Create upload script

Create `scripts/upload-static.ts`:

```ts
import { readFileSync, readdirSync, existsSync } from "fs";
import { join, relative, dirname, extname } from "path";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, "../dist");

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function getMimeType(path: string): string {
  return MIME_TYPES[extname(path).toLowerCase()] || "application/octet-stream";
}

function collectFiles(dir: string, baseDir: string) {
  const files: Array<{ path: string; localPath: string; contentType: string }> = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath, baseDir));
    } else if (entry.isFile()) {
      files.push({
        path: "/" + relative(baseDir, fullPath).replace(/\\/g, "/"),
        localPath: fullPath,
        contentType: getMimeType(fullPath),
      });
    }
  }
  return files;
}

async function main() {
  const convexUrl = process.env.CONVEX_URL;
  if (!convexUrl) {
    console.error("CONVEX_URL environment variable required");
    process.exit(1);
  }

  if (!existsSync(distDir)) {
    console.error("dist/ not found. Run 'npm run build' first.");
    process.exit(1);
  }

  const client = new ConvexHttpClient(convexUrl);
  const deploymentId = randomUUID();
  const files = collectFiles(distDir, distDir);

  console.log(`Uploading ${files.length} files...`);

  for (const file of files) {
    const content = readFileSync(file.localPath);
    const uploadUrl = await client.mutation(api.staticHosting.generateUploadUrl);
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": file.contentType },
      body: content,
    });
    const { storageId } = await response.json();
    await client.mutation(api.staticHosting.recordAsset, {
      path: file.path,
      storageId,
      contentType: file.contentType,
      deploymentId,
    });
    console.log(`  ✓ ${file.path}`);
  }

  const deleted = await client.mutation(api.staticHosting.gcOldAssets, {
    currentDeploymentId: deploymentId,
  });
  console.log(`Cleaned up ${deleted} old files`);
  console.log(`\nApp available at: ${convexUrl.replace(".convex.cloud", ".convex.site")}`);
}

main().catch(console.error);
```

### 4. Add scripts to package.json

```json
{
  "scripts": {
    "build": "vite build",
    "upload:static": "npx tsx scripts/upload-static.ts",
    "deploy:static": "npm run build && npm run upload:static"
  }
}
```

### 5. Update your app's entry point

In your `main.tsx`, use the helper to auto-detect the Convex URL when deployed:

```tsx
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { getConvexUrlWithFallback } from "@get-convex/self-static-hosting";

// Works both in development (uses VITE_CONVEX_URL) and production (auto-detects)
const convexUrl = getConvexUrlWithFallback(import.meta.env.VITE_CONVEX_URL);
const convex = new ConvexReactClient(convexUrl);

// ... rest of your app
```

## Deployment

```bash
# Deploy to Convex
CONVEX_URL=https://your-deployment.convex.cloud npm run deploy:static

# Your app is now live at:
# https://your-deployment.convex.site
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

### `exposeUploadApi`

```ts
exposeUploadApi(components.selfStaticHosting, {
  // Optional authentication function
  auth: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
  },
});
```

## How It Works

1. **Build Phase**: Your bundler (Vite, etc.) creates optimized files in `dist/`
2. **Upload Phase**: The upload script:
   - Generates a unique deployment ID
   - Uploads each file to Convex storage
   - Records file metadata in the database
   - Garbage collects files from previous deployments
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
