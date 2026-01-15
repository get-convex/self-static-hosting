#!/usr/bin/env node
/**
 * Upload static files to Cloudflare Pages via Direct Upload.
 *
 * This module uses wrangler CLI to deploy files directly to Cloudflare Pages,
 * bypassing Convex storage for a pure edge deployment.
 */
import { existsSync, readFileSync, readdirSync } from "fs";
import { resolve, join } from "path";
import { execSync, spawnSync } from "child_process";
import { randomUUID } from "crypto";
import { homedir } from "os";
/**
 * Get Cloudflare API token from various sources
 */
export function getCloudflareApiToken() {
    // Check environment variable first
    if (process.env.CLOUDFLARE_API_TOKEN) {
        return process.env.CLOUDFLARE_API_TOKEN;
    }
    // Try to read from wrangler config
    const configPaths = [
        join(homedir(), "Library", "Preferences", ".wrangler", "config", "default.toml"),
        join(homedir(), ".wrangler", "config", "default.toml"),
        join(homedir(), ".wrangler", "config.toml"),
        join(homedir(), ".config", ".wrangler", "config", "default.toml"),
    ];
    const tokenPatterns = [
        /oauth_token\s*=\s*"([^"]+)"/,
        /access_token\s*=\s*"([^"]+)"/,
        /token\s*=\s*"([^"]+)"/,
    ];
    for (const configPath of configPaths) {
        if (existsSync(configPath)) {
            try {
                const content = readFileSync(configPath, "utf-8");
                for (const pattern of tokenPatterns) {
                    const match = content.match(pattern);
                    if (match) {
                        return match[1];
                    }
                }
            }
            catch {
                // Ignore read errors
            }
        }
    }
    return null;
}
/**
 * Get Cloudflare account ID from API
 */
export async function getCloudflareAccountId(apiToken) {
    try {
        const response = await fetch("https://api.cloudflare.com/client/v4/accounts?per_page=1", {
            headers: {
                Authorization: `Bearer ${apiToken}`,
                "Content-Type": "application/json",
            },
        });
        const data = (await response.json());
        if (data.success && data.result.length > 0) {
            return data.result[0].id;
        }
    }
    catch {
        // Ignore errors
    }
    return null;
}
/**
 * Check if a Cloudflare Pages project exists
 */
export async function pagesProjectExists(accountId, projectName, apiToken) {
    try {
        const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}`, {
            headers: {
                Authorization: `Bearer ${apiToken}`,
                "Content-Type": "application/json",
            },
        });
        const data = (await response.json());
        return data.success;
    }
    catch {
        return false;
    }
}
/**
 * Create a Cloudflare Pages project
 */
export async function createPagesProject(accountId, projectName, apiToken) {
    try {
        const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                name: projectName,
                production_branch: "main",
            }),
        });
        const data = (await response.json());
        return data.success;
    }
    catch {
        return false;
    }
}
/**
 * Get Pages project info including domains
 */
export async function getPagesProjectInfo(accountId, projectName, apiToken) {
    try {
        const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}`, {
            headers: {
                Authorization: `Bearer ${apiToken}`,
                "Content-Type": "application/json",
            },
        });
        const data = (await response.json());
        if (data.success && data.result) {
            return {
                subdomain: data.result.subdomain,
                domains: data.result.domains || [],
            };
        }
    }
    catch {
        // Ignore errors
    }
    return null;
}
/**
 * Count files in a directory recursively
 */
function countFiles(dir) {
    let count = 0;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
            count += countFiles(fullPath);
        }
        else if (entry.isFile()) {
            count++;
        }
    }
    return count;
}
/**
 * Update Convex deployment info for live reload
 */
function updateConvexDeployment(componentName, deploymentId, prod) {
    const prodFlag = prod ? "--prod" : "";
    const args = JSON.stringify({ deploymentId });
    try {
        execSync(`npx convex run "${componentName}:setCurrentDeployment" '${args}' ${prodFlag} --typecheck=disable --codegen=disable`, {
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "pipe"],
        });
    }
    catch {
        // Non-fatal - live reload won't work but deployment succeeded
        console.warn("⚠️  Could not update Convex deployment info (live reload may not work)");
    }
}
/**
 * Deploy to Cloudflare Pages using wrangler CLI
 */
export async function deployToCloudflarePages(options) {
    const { distDir, projectName, branch = "main", convexComponent = "staticHosting", prod = false, } = options;
    // Resolve dist directory
    const resolvedDistDir = resolve(distDir);
    if (!existsSync(resolvedDistDir)) {
        return {
            success: false,
            error: `Dist directory not found: ${resolvedDistDir}`,
        };
    }
    const fileCount = countFiles(resolvedDistDir);
    console.log(`📁 Found ${fileCount} files in ${distDir}`);
    // Get API token
    const apiToken = options.apiToken || getCloudflareApiToken();
    if (!apiToken) {
        return {
            success: false,
            error: "No Cloudflare API token found. Run 'npx wrangler login' or set CLOUDFLARE_API_TOKEN",
        };
    }
    // Get account ID
    let accountId = options.accountId || process.env.CLOUDFLARE_ACCOUNT_ID || null;
    if (!accountId) {
        console.log("🔍 Looking up Cloudflare account ID...");
        accountId = await getCloudflareAccountId(apiToken);
        if (!accountId) {
            return {
                success: false,
                error: "Could not determine Cloudflare account ID. Set CLOUDFLARE_ACCOUNT_ID or check your API token permissions.",
            };
        }
    }
    // Check if project exists, create if not
    const exists = await pagesProjectExists(accountId, projectName, apiToken);
    if (!exists) {
        console.log(`📝 Creating Cloudflare Pages project: ${projectName}...`);
        const created = await createPagesProject(accountId, projectName, apiToken);
        if (!created) {
            console.log("");
            console.log("Could not create project automatically.");
            console.log("Please create it manually:");
            console.log("  1. Go to https://dash.cloudflare.com → Workers & Pages");
            console.log("  2. Click 'Create' → 'Pages' → 'Upload assets'");
            console.log(`  3. Name it: ${projectName}`);
            console.log("  4. Run this command again");
            return {
                success: false,
                error: `Could not create Pages project: ${projectName}`,
            };
        }
        console.log(`✅ Created project: ${projectName}`);
    }
    // Generate deployment ID for tracking
    const deploymentId = randomUUID();
    // Deploy using wrangler
    console.log("");
    console.log(`🚀 Deploying to Cloudflare Pages: ${projectName}...`);
    console.log(`   Branch: ${branch}`);
    console.log("");
    const wranglerArgs = [
        "wrangler",
        "pages",
        "deploy",
        resolvedDistDir,
        "--project-name",
        projectName,
        "--branch",
        branch,
    ];
    const result = spawnSync("npx", wranglerArgs, {
        stdio: "inherit",
        env: {
            ...process.env,
            CLOUDFLARE_API_TOKEN: apiToken,
            CLOUDFLARE_ACCOUNT_ID: accountId,
        },
    });
    if (result.status !== 0) {
        return {
            success: false,
            error: "Wrangler deployment failed. Check the output above for details.",
        };
    }
    // Update Convex deployment info for live reload
    console.log("");
    console.log("📡 Updating Convex deployment info...");
    updateConvexDeployment(convexComponent, deploymentId, prod);
    // Get project info for URL
    const projectInfo = await getPagesProjectInfo(accountId, projectName, apiToken);
    const url = projectInfo
        ? `https://${projectInfo.subdomain}`
        : `https://${projectName}.pages.dev`;
    return {
        success: true,
        url,
    };
}
/**
 * Main entry point for CLI
 */
export async function main(args) {
    console.log("");
    console.log("☁️  Cloudflare Pages Deployment");
    console.log("═══════════════════════════════════════════════════════════");
    console.log("");
    const result = await deployToCloudflarePages({
        distDir: args.dist,
        projectName: args.projectName,
        branch: args.branch,
        convexComponent: args.component,
        prod: args.prod,
    });
    if (!result.success) {
        console.error(`❌ ${result.error}`);
        process.exit(1);
    }
    console.log("");
    console.log("═══════════════════════════════════════════════════════════");
    console.log("✨ Deployment complete!");
    console.log("");
    console.log(`Your site is live at: ${result.url}`);
    console.log("");
}
//# sourceMappingURL=upload-cloudflare-pages.js.map