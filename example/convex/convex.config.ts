import { defineApp } from "convex/server";
import selfStaticHosting from "@convex-dev/self-static-hosting/convex.config.js";

const app = defineApp();
app.use(selfStaticHosting);

export default app;
