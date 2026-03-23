import { handleApiRequest, serveWebUi } from "./api.js";
import { WEB_PORT } from "../constants.js";
import { loadConfig } from "../core/config.js";

export function startWebServer(portOverride?: number): { port: number; stop: () => void } {
  const config = loadConfig();
  const port = portOverride ?? config.web?.port ?? WEB_PORT;
  const host = config.web?.host ?? "127.0.0.1";

  const server = Bun.serve({
    port,
    hostname: host,
    async fetch(req) {
      const url = new URL(req.url);

      // CORS preflight
      if (req.method === "OPTIONS") {
        return new Response(null, {
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        });
      }

      // API routes
      if (url.pathname.startsWith("/api/")) {
        const res = await handleApiRequest(req);
        if (res) return res;
      }

      // All other routes → serve the SPA
      return serveWebUi(req);
    },
    error(err) {
      return new Response(`Server error: ${err.message}`, { status: 500 });
    },
  });

  console.log(`🌐 Web UI: http://${host}:${port}`);

  if (config.web?.openBrowser) {
    Bun.spawnSync(["xdg-open", `http://${host}:${port}`], { stderr: "ignore", stdout: "ignore" });
  }

  return {
    port,
    stop: () => server.stop(),
  };
}
