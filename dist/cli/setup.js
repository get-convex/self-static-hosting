#!/usr/bin/env node
/**
 * Interactive setup wizard for Convex Self Static Hosting.
 *
 * Usage:
 *   npx @get-convex/self-static-hosting setup
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { createInterface } from "readline";
import { join } from "path";
const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
});
function prompt(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => resolve(answer.trim()));
    });
}
function success(msg) {
    console.log(`✓ ${msg}`);
}
function skip(msg) {
    console.log(`· ${msg}`);
}
/**
 * Create convex/convex.config.ts
 */
function createConvexConfig() {
    const configPath = join(process.cwd(), "convex", "convex.config.ts");
    if (existsSync(configPath)) {
        const existing = readFileSync(configPath, "utf-8");
        if (existing.includes("selfStaticHosting")) {
            skip("convex/convex.config.ts (already configured)");
            return false;
        }
        // File exists but doesn't have our component - tell user to add manually
        console.log("\n⚠️  convex/convex.config.ts exists. Please add manually:");
        console.log('   import selfStaticHosting from "@get-convex/self-static-hosting/convex.config";');
        console.log("   app.use(selfStaticHosting);\n");
        return false;
    }
    writeFileSync(configPath, `import { defineApp } from "convex/server";
import selfStaticHosting from "@get-convex/self-static-hosting/convex.config";

const app = defineApp();
app.use(selfStaticHosting);

export default app;
`);
    success("Created convex/convex.config.ts");
    return true;
}
/**
 * Create convex/staticHosting.ts
 */
function createStaticHostingFile() {
    const filePath = join(process.cwd(), "convex", "staticHosting.ts");
    if (existsSync(filePath)) {
        skip("convex/staticHosting.ts (already exists)");
        return false;
    }
    writeFileSync(filePath, `import { components } from "./_generated/api";
import {
  exposeUploadApi,
  exposeDeploymentQuery,
} from "@get-convex/self-static-hosting";

// Internal functions for secure uploads (CLI only)
export const { generateUploadUrl, recordAsset, gcOldAssets, listAssets } =
  exposeUploadApi(components.selfStaticHosting);

// Public query for live reload notifications
export const { getCurrentDeployment } =
  exposeDeploymentQuery(components.selfStaticHosting);
`);
    success("Created convex/staticHosting.ts");
    return true;
}
/**
 * Create convex/http.ts
 */
function createHttpFile() {
    const filePath = join(process.cwd(), "convex", "http.ts");
    if (existsSync(filePath)) {
        const existing = readFileSync(filePath, "utf-8");
        if (existing.includes("registerStaticRoutes")) {
            skip("convex/http.ts (already configured)");
            return false;
        }
        console.log("\n⚠️  convex/http.ts exists. Please add manually:");
        console.log('   import { registerStaticRoutes } from "@get-convex/self-static-hosting";');
        console.log("   registerStaticRoutes(http, components.selfStaticHosting);\n");
        return false;
    }
    writeFileSync(filePath, `import { httpRouter } from "convex/server";
import { registerStaticRoutes } from "@get-convex/self-static-hosting";
import { components } from "./_generated/api";

const http = httpRouter();

// Serve static files at root with SPA fallback
registerStaticRoutes(http, components.selfStaticHosting);

export default http;
`);
    success("Created convex/http.ts");
    return true;
}
/**
 * Update package.json with deploy script
 */
function updatePackageJson() {
    const pkgPath = join(process.cwd(), "package.json");
    if (!existsSync(pkgPath)) {
        console.log("⚠️  No package.json found");
        return false;
    }
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    if (!pkg.scripts)
        pkg.scripts = {};
    if (pkg.scripts.deploy) {
        skip("package.json deploy script (already exists)");
        return false;
    }
    pkg.scripts.deploy = "npx @get-convex/self-static-hosting deploy";
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
    success("Added deploy script to package.json");
    return true;
}
async function main() {
    console.log("\n🚀 Convex Self Static Hosting Setup\n");
    // Check for convex directory
    if (!existsSync("convex")) {
        mkdirSync("convex");
        success("Created convex/ directory");
    }
    console.log("Creating files...\n");
    // Create the Convex files
    createConvexConfig();
    createStaticHostingFile();
    createHttpFile();
    updatePackageJson();
    // Next steps
    console.log("\n✨ Setup complete!\n");
    console.log("Next steps:\n");
    console.log("  1. npx convex dev          # Generate types");
    console.log("  2. npm run deploy          # Deploy everything\n");
    console.log("Your app will be at: https://<deployment>.convex.site\n");
    rl.close();
}
main().catch((err) => {
    console.error("Setup failed:", err);
    rl.close();
    process.exit(1);
});
//# sourceMappingURL=setup.js.map