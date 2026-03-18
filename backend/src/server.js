import app from "./app.js";
import { env } from "./config/env.js";
import dotenv from "dotenv";
dotenv.config();

app.listen(env.port, () => {
  console.log(`Backend running on http://localhost:${env.port}`);

  if (env.vapi.enabled && env.vapi.publicAppUrl.includes("localhost")) {
    console.warn("\n⚠️  WARNING: PUBLIC_APP_URL is set to localhost.");
    console.warn("   VAPI cannot reach your tool endpoint from the cloud.");
    console.warn("   Voice call booking will fail with a technical error.");
    console.warn("   Run  npm run dev:tunnel  instead of  npm run dev\n");
  }
});
