#!/usr/bin/env node
/**
 * Upload static files to Cloudflare Workers with Static Assets.
 *
 * This module uses wrangler CLI to deploy files directly to Cloudflare Workers,
 * bypassing Convex storage for a pure edge deployment.
 */
export interface CloudflareWorkersOptions {
    distDir: string;
    workerName: string;
    accountId?: string;
    apiToken?: string;
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
 * Get the workers.dev subdomain for an account
 */
export declare function getWorkerSubdomain(accountId: string, apiToken: string): Promise<string | null>;
/**
 * Deploy to Cloudflare Workers with Static Assets using wrangler CLI
 */
export declare function deployToCloudflareWorkers(options: CloudflareWorkersOptions): Promise<{
    success: boolean;
    url?: string;
    error?: string;
}>;
/**
 * Main entry point for CLI
 */
export declare function main(args: {
    dist: string;
    workerName: string;
    component?: string;
    prod?: boolean;
}): Promise<void>;
//# sourceMappingURL=upload-cloudflare-workers.d.ts.map