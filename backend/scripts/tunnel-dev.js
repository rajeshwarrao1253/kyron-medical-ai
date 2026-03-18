/**
 * dev:tunnel — starts a Cloudflare Quick Tunnel (no account, no browser bypass page)
 * and injects the public URL as PUBLIC_APP_URL so VAPI can reach the voice tool endpoint.
 *
 * Usage: npm run dev:tunnel
 */
import { Tunnel, install, DEFAULT_CLOUDFLARED_BIN } from "cloudflared";
import { spawn }      from "child_process";
import { existsSync } from "fs";
import { config }     from "dotenv";

config(); // load .env so we have VAPI_API_KEY and VAPI_PHONE_NUMBER_ID

async function updateVapiServerUrl(publicUrl) {
  const apiKey       = process.env.VAPI_API_KEY;
  const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;

  if (!apiKey || !phoneNumberId) {
    console.log("  ⚠  VAPI_API_KEY or VAPI_PHONE_NUMBER_ID not set — skipping VAPI update.");
    return;
  }

  const serverUrl = `${publicUrl}/api/voice/assistant-request`;

  try {
    const res = await fetch(`https://api.vapi.ai/phone-number/${phoneNumberId}`, {
      method:  "PATCH",
      headers: {
        Authorization:  `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ serverUrl })
    });

    if (res.ok) {
      console.log(`  ✓ VAPI phone number updated → ${serverUrl}`);
    } else {
      const text = await res.text();
      console.warn(`  ⚠  VAPI update failed (${res.status}): ${text}`);
    }
  } catch (err) {
    console.warn(`  ⚠  Could not update VAPI: ${err.message}`);
  }
}

const PORT = Number(process.env.PORT || 4000);

async function start() {
  // Install the cloudflared binary if not already present
  if (!existsSync(DEFAULT_CLOUDFLARED_BIN)) {
    console.log("Installing cloudflared binary…");
    await install(DEFAULT_CLOUDFLARED_BIN);
  }

  console.log(`\nOpening Cloudflare tunnel to localhost:${PORT}…`);

  // Quick tunnel: cloudflared tunnel --url http://localhost:PORT
  const t = new Tunnel(["tunnel", "--url", `http://localhost:${PORT}`]);

  // Wait for the trycloudflare.com URL to appear in the output
  const publicUrl = await new Promise((resolve, reject) => {
    t.on("url", (url) => resolve(url));
    t.on("error", reject);
    setTimeout(() => reject(new Error("Timed out waiting for tunnel URL (30s)")), 30_000);
  });

  console.log(`\n✓ Public URL: ${publicUrl}`);
  console.log(`  VAPI tool calls will reach: ${publicUrl}/api/voice/tool/book`);
  console.log(`  VAPI assistant-request:     ${publicUrl}/api/voice/assistant-request`);

  // Auto-update VAPI phone number's Server URL so inbound call-back works
  // without having to manually update the VAPI dashboard every tunnel restart.
  await updateVapiServerUrl(publicUrl);

  console.log(`\nStarting backend server…\n`);

  // Spawn the Express server with PUBLIC_APP_URL injected
  const server = spawn(
    "node",
    ["--watch", "src/server.js"],
    {
      stdio: "inherit",
      env: { ...process.env, PUBLIC_APP_URL: publicUrl }
    }
  );

  t.on("error", (err) => console.error("\nTunnel error:", err.message));

  server.on("exit", (code) => {
    t.stop();
    process.exit(code ?? 0);
  });

  process.on("SIGINT", () => {
    console.log("\nShutting down…");
    t.stop();
    server.kill();
    process.exit(0);
  });
}

start().catch((err) => {
  console.error("Failed to start tunnel:", err.message);
  process.exit(1);
});
