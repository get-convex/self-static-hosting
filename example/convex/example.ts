import { components } from "./_generated/api.js";
import { exposeUploadApi } from "@get-convex/self-static-hosting";

// Expose the upload API for deployment scripts.
// These functions can be called from a Node.js script to upload static files.
//
// For production use, you may want to add authentication:
// export const { generateUploadUrl, recordAsset, gcOldAssets, listAssets } =
//   exposeUploadApi(components.selfStaticHosting, {
//     auth: async (ctx) => {
//       const identity = await ctx.auth.getUserIdentity();
//       if (!identity || !isAdmin(identity)) {
//         throw new Error("Unauthorized: Admin access required for uploads");
//       }
//     },
//   });

export const { generateUploadUrl, recordAsset, gcOldAssets, listAssets } =
  exposeUploadApi(components.selfStaticHosting);
