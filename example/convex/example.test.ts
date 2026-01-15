import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { initConvexTest } from "./setup.test";
import { api } from "./_generated/api";

describe("static hosting example", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
  });

  afterEach(async () => {
    vi.useRealTimers();
  });

  test("generateUploadUrl returns a URL", async () => {
    const t = initConvexTest();
    const uploadUrl = await t.mutation(api.example.generateUploadUrl, {});
    expect(uploadUrl).toBeDefined();
    expect(typeof uploadUrl).toBe("string");
  });

  test("listAssets returns empty array initially", async () => {
    const t = initConvexTest();
    const assets = await t.query(api.example.listAssets, {});
    expect(assets).toHaveLength(0);
  });

  test("gcOldAssets returns 0 with no assets", async () => {
    const t = initConvexTest();
    const deleted = await t.mutation(api.example.gcOldAssets, {
      currentDeploymentId: "test-deployment",
    });
    expect(deleted).toBe(0);
  });
});
