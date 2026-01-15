import { httpActionGeneric, mutationGeneric, queryGeneric } from "convex/server";
import type { Auth, HttpRouter } from "convex/server";
import { v } from "convex/values";
import type { ComponentApi } from "../component/_generated/component.js";

// MIME type mapping for common file types
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

/**
 * Get MIME type for a file path based on its extension.
 */
export function getMimeType(path: string): string {
  const ext = path.substring(path.lastIndexOf(".")).toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}

/**
 * Check if a path has a file extension.
 */
function hasFileExtension(path: string): boolean {
  const lastSegment = path.split("/").pop() || "";
  return lastSegment.includes(".") && !lastSegment.startsWith(".");
}

/**
 * Check if asset is a hashed asset (for cache control).
 * Vite produces: index-lj_vq_aF.js, style-B71cUw87.css
 */
function isHashedAsset(path: string): boolean {
  return /[-.][\dA-Za-z_]{6,12}\.[a-z]+$/.test(path);
}

/**
 * Register HTTP routes for serving static files.
 * This creates a catch-all route that serves files from Convex storage
 * with SPA fallback support.
 *
 * @param http - The HTTP router to register routes on
 * @param component - The component API reference
 * @param options - Configuration options
 * @param options.pathPrefix - URL prefix for static files (default: "/")
 * @param options.spaFallback - Enable SPA fallback to index.html (default: true)
 *
 * @example
 * ```typescript
 * // In your convex/http.ts
 * import { httpRouter } from "convex/server";
 * import { registerStaticRoutes } from "@get-convex/self-static-hosting";
 * import { components } from "./_generated/api";
 *
 * const http = httpRouter();
 *
 * // Serve static files at root
 * registerStaticRoutes(http, components.selfStaticHosting);
 *
 * // Or serve at a specific path prefix
 * registerStaticRoutes(http, components.selfStaticHosting, {
 *   pathPrefix: "/app",
 * });
 *
 * export default http;
 * ```
 */
export function registerStaticRoutes(
  http: HttpRouter,
  component: ComponentApi,
  {
    pathPrefix = "/",
    spaFallback = true,
  }: { pathPrefix?: string; spaFallback?: boolean } = {},
) {
  // Normalize pathPrefix - ensure it starts with / and doesn't end with /
  const normalizedPrefix =
    pathPrefix === "/" ? "" : pathPrefix.replace(/\/$/, "");

  const serveStaticFile = httpActionGeneric(async (ctx, request) => {
    const url = new URL(request.url);
    let path = url.pathname;

    // Remove prefix if present
    if (normalizedPrefix && path.startsWith(normalizedPrefix)) {
      path = path.slice(normalizedPrefix.length) || "/";
    }

    // Normalize: serve index.html for root
    if (path === "" || path === "/") {
      path = "/index.html";
    }

    // Look up the asset
    type AssetDoc = {
      _id: string;
      _creationTime: number;
      path: string;
      storageId: string;
      contentType: string;
      deploymentId: string;
    } | null;

    let asset: AssetDoc = await ctx.runQuery(component.lib.getByPath, { path });

    // SPA fallback: if not found and no file extension, serve index.html
    if (!asset && spaFallback && !hasFileExtension(path)) {
      asset = await ctx.runQuery(component.lib.getByPath, {
        path: "/index.html",
      });
    }

    // 404 if still not found
    if (!asset) {
      return new Response("Not Found", {
        status: 404,
        headers: { "Content-Type": "text/plain" },
      });
    }

    // Get file from storage
    const blob = await ctx.storage.get(asset.storageId);
    if (!blob) {
      return new Response("Storage error", {
        status: 500,
        headers: { "Content-Type": "text/plain" },
      });
    }

    // Cache control: hashed assets can be cached forever
    const cacheControl = isHashedAsset(path)
      ? "public, max-age=31536000, immutable"
      : "public, max-age=0, must-revalidate";

    return new Response(blob, {
      status: 200,
      headers: {
        "Content-Type": asset.contentType,
        "Cache-Control": cacheControl,
        "X-Content-Type-Options": "nosniff",
      },
    });
  });

  // Use pathPrefix routing
  http.route({
    pathPrefix: pathPrefix === "/" ? "/" : `${normalizedPrefix}/`,
    method: "GET",
    handler: serveStaticFile,
  });

  // Also handle exact prefix without trailing slash
  if (normalizedPrefix) {
    http.route({
      path: normalizedPrefix,
      method: "GET",
      handler: serveStaticFile,
    });
  }
}

/**
 * Expose the upload API for use in deployment scripts.
 * This creates mutations that can be called from a Node.js upload script.
 *
 * @param component - The component API reference
 * @param options - Configuration options
 * @param options.auth - Optional authentication function to restrict uploads
 *
 * @example
 * ```typescript
 * // In your convex/staticHosting.ts
 * import { exposeUploadApi } from "@get-convex/self-static-hosting";
 * import { components } from "./_generated/api";
 *
 * export const { generateUploadUrl, recordAsset, gcOldAssets, listAssets } =
 *   exposeUploadApi(components.selfStaticHosting);
 * ```
 */
export function exposeUploadApi(
  component: ComponentApi,
  options?: {
    /**
     * Optional authentication function.
     * If provided, will be called before each operation.
     * Throw an error to deny access.
     */
    auth?: (ctx: { auth: Auth }) => Promise<void>;
  },
) {
  const authCheck = options?.auth ?? (async () => {});

  return {
    /**
     * Generate a signed URL for uploading a file.
     * Files are stored in the app's storage (not the component's) so the
     * HTTP handler can access them directly.
     */
    generateUploadUrl: mutationGeneric({
      args: {},
      handler: async (ctx) => {
        await authCheck(ctx);
        // Use app's storage directly, not the component's storage
        // This ensures the HTTP handler can access the files
        return await ctx.storage.generateUploadUrl();
      },
    }),

    /**
     * Record an uploaded asset in the database.
     * Automatically cleans up old storage files when replacing.
     */
    recordAsset: mutationGeneric({
      args: {
        path: v.string(),
        storageId: v.string(),
        contentType: v.string(),
        deploymentId: v.string(),
      },
      handler: async (ctx, args) => {
        await authCheck(ctx);
        // Record the asset and get back any old storageId to clean up
        const oldStorageId = await ctx.runMutation(component.lib.recordAsset, {
          path: args.path,
          storageId: args.storageId,
          contentType: args.contentType,
          deploymentId: args.deploymentId,
        });
        // Delete old file from app storage if one was replaced
        // Note: May fail if old file was in component storage (migration case)
        if (oldStorageId) {
          try {
            await ctx.storage.delete(oldStorageId);
          } catch {
            // Ignore errors - old file may have been in component storage
          }
        }
        return null;
      },
    }),

    /**
     * Garbage collect old assets that don't match the current deployment.
     * Returns the count of deleted assets.
     */
    gcOldAssets: mutationGeneric({
      args: {
        currentDeploymentId: v.string(),
      },
      handler: async (ctx, args) => {
        await authCheck(ctx);
        // Get storageIds of old assets to delete
        const storageIdsToDelete = await ctx.runMutation(
          component.lib.gcOldAssets,
          {
            currentDeploymentId: args.currentDeploymentId,
          },
        );
        // Delete files from app storage
        // Note: May fail for files in component storage (migration case)
        for (const storageId of storageIdsToDelete) {
          try {
            await ctx.storage.delete(storageId);
          } catch {
            // Ignore errors - old file may have been in component storage
          }
        }
        return storageIdsToDelete.length;
      },
    }),

    /**
     * List all static assets (for debugging).
     */
    listAssets: queryGeneric({
      args: {
        limit: v.optional(v.number()),
      },
      handler: async (ctx, args) => {
        return await ctx.runQuery(component.lib.listAssets, {
          limit: args.limit,
        });
      },
    }),
  };
}

/**
 * Derive the Convex cloud URL from a .convex.site hostname.
 * Useful for client-side code that needs to connect to the Convex backend
 * when hosted on Convex static hosting.
 *
 * @example
 * ```typescript
 * // In your React app's main.tsx
 * import { getConvexUrl } from "@get-convex/self-static-hosting";
 *
 * const convexUrl = import.meta.env.VITE_CONVEX_URL ?? getConvexUrl();
 * const convex = new ConvexReactClient(convexUrl);
 * ```
 */
export function getConvexUrl(): string {
  if (typeof window === "undefined") {
    throw new Error("getConvexUrl() can only be called in a browser context");
  }

  // If hosted on Convex (.convex.site), derive API URL (.convex.cloud)
  if (window.location.hostname.endsWith(".convex.site")) {
    return `https://${window.location.hostname.replace(".convex.site", ".convex.cloud")}`;
  }

  throw new Error(
    "Unable to derive Convex URL. Please set VITE_CONVEX_URL environment variable.",
  );
}

/**
 * Get the Convex URL, with fallback to environment variable.
 * Safe to call in both browser and non-browser contexts when env var is set.
 *
 * @param envUrl - The environment variable value (e.g., import.meta.env.VITE_CONVEX_URL)
 *
 * @example
 * ```typescript
 * const convexUrl = getConvexUrlWithFallback(import.meta.env.VITE_CONVEX_URL);
 * ```
 */
export function getConvexUrlWithFallback(envUrl?: string): string {
  if (envUrl) {
    return envUrl;
  }

  return getConvexUrl();
}
