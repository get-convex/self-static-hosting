#!/usr/bin/env node
/**
 * Upload static files to Cloudflare Pages via Direct Upload.
 *
 * This module uses wrangler CLI to deploy files directly to Cloudflare Pages,
 * bypassing Convex storage for a pure edge deployment.
 */
export interface CloudflarePagesOptions {
    distDir: string;
    projectName: string;
    accountId?: string;
    apiToken?: string;
    branch?: string;
    convexComponent?: string;
    prod?: boolean;
}
/**
 * Get Cloudflare API token from various sources
 */
export declare function getCloudflareApiToken(): string | null;
/**
 * Get Cloudflare account ID from API
 */
export declare function getCloudflareAccountId(apiToken: string): Promise<string | null>;
/**
 * Check if a Cloudflare Pages project exists
 */
export declare function pagesProjectExists(accountId: string, projectName: string, apiToken: string): Promise<boolean>;
/**
 * Create a Cloudflare Pages project
 */
export declare function createPagesProject(accountId: string, projectName: string, apiToken: string): Promise<boolean>;
/**
 * Get Pages project info including domains
 */
export declare function getPagesProjectInfo(accountId: string, projectName: string, apiToken: string): Promise<{
    subdomain: string;
    domains: string[];
} | null>;
/**
 * Deploy to Cloudflare Pages using wrangler CLI
 */
export declare function deployToCloudflarePages(options: CloudflarePagesOptions): Promise<{
    success: boolean;
    url?: string;
    error?: string;
}>;
/**
 * Main entry point for CLI
 */
export declare function main(args: {
    dist: string;
    projectName: string;
    branch?: string;
    component?: string;
    prod?: boolean;
}): Promise<void>;
//# sourceMappingURL=upload-cloudflare-pages.d.ts.map