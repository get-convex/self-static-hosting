/**
 * Upload static files from the dist/ directory to Convex storage.
 *
 * Usage:
 *   npx tsx scripts/upload-static.ts
 *
 * The script automatically reads CONVEX_URL from:
 *   1. Environment variable CONVEX_URL
 *   2. .env.local file in the project root
 */

import { readFileSync, readdirSync, existsSync } from "fs";
import { join, relative, dirname, extname } from "path";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import type { Id } from "../convex/_generated/dataModel.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
const distDir = join(projectRoot, "dist");

// MIME type mapping
const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json",
  ".webmanifest": "application/manifest+json",
  ".xml": "application/xml",
};

function getMimeType(path: string): string {
  return MIME_TYPES[extname(path).toLowerCase()] || "application/octet-stream";
}

/**
 * Read CONVEX_URL from .env.local file
 */
function readEnvLocal(): string | undefined {
  // Check multiple possible locations for .env.local
  const possiblePaths = [
    join(projectRoot, ".env.local"),
    join(projectRoot, "..", ".env.local"), // Root of monorepo
  ];

  for (const envPath of possiblePaths) {
    if (existsSync(envPath)) {
      const content = readFileSync(envPath, "utf-8");
      // Check for CONVEX_URL or VITE_CONVEX_URL
      const patterns = [
        /^CONVEX_URL=(.+)$/m,
        /^VITE_CONVEX_URL=(.+)$/m,
      ];
      for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match) {
          // Remove quotes if present
          return match[1].replace(/^["']|["']$/g, "").trim();
        }
      }
    }
  }
  return undefined;
}

/**
 * Get Convex URL from environment or .env.local
 */
function getConvexUrl(): string {
  // First check environment variables
  if (process.env.CONVEX_URL) {
    return process.env.CONVEX_URL;
  }
  if (process.env.VITE_CONVEX_URL) {
    return process.env.VITE_CONVEX_URL;
  }

  // Then check .env.local
  const envLocalUrl = readEnvLocal();
  if (envLocalUrl) {
    console.log("Using CONVEX_URL from .env.local");
    return envLocalUrl;
  }

  console.error("Error: CONVEX_URL not found");
  console.error("");
  console.error("Please either:");
  console.error("  1. Set CONVEX_URL environment variable:");
  console.error(
    "     CONVEX_URL=https://your-deployment.convex.cloud npx tsx scripts/upload-static.ts",
  );
  console.error("");
  console.error("  2. Or ensure .env.local exists with CONVEX_URL defined");
  console.error("     (Run 'npx convex dev' first to create it)");
  process.exit(1);
}

// Recursively collect files
function collectFiles(
  dir: string,
  baseDir: string,
): Array<{ path: string; localPath: string; contentType: string }> {
  const files: Array<{
    path: string;
    localPath: string;
    contentType: string;
  }> = [];

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
  const convexUrl = getConvexUrl();

  if (!existsSync(distDir)) {
    console.error(
      "Error: dist directory not found. Run 'npm run build' first.",
    );
    process.exit(1);
  }

  const client = new ConvexHttpClient(convexUrl);
  const deploymentId = randomUUID();
  const files = collectFiles(distDir, distDir);

  console.log(`Deploying to: ${convexUrl}`);
  console.log(
    `Uploading ${files.length} files with deployment ID: ${deploymentId}`,
  );
  console.log("");

  for (const file of files) {
    const content = readFileSync(file.localPath);

    // Get upload URL
    const uploadUrl = await client.mutation(api.example.generateUploadUrl);

    // Upload to storage
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": file.contentType },
      body: content,
    });

    const { storageId } = (await response.json()) as {
      storageId: Id<"_storage">;
    };

    // Record in database
    await client.mutation(api.example.recordAsset, {
      path: file.path,
      storageId,
      contentType: file.contentType,
      deploymentId,
    });

    console.log(`  ✓ ${file.path} (${file.contentType})`);
  }

  console.log("");

  // Garbage collect old files
  const deleted = await client.mutation(api.example.gcOldAssets, {
    currentDeploymentId: deploymentId,
  });

  if (deleted > 0) {
    console.log(`Cleaned up ${deleted} old file(s) from previous deployments`);
  }

  console.log("");
  console.log("✨ Upload complete!");
  console.log("");
  console.log(
    `Your app is now available at: ${convexUrl.replace(".convex.cloud", ".convex.site")}`,
  );
}

main().catch((error) => {
  console.error("Upload failed:", error);
  process.exit(1);
});
