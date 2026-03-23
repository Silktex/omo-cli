import type { Command } from "commander";
import kleur from "kleur";
import { createReadStream, existsSync, watchFile } from "node:fs";
import { PROXY_LOG_PATH, PROXY_URL } from "../constants.js";

export function registerProxy(program: Command): void {
  const proxyCmd = program.command("proxy").description("Manage the fallback proxy");

  proxyCmd
    .command("status")
    .description("Print proxy health")
    .option("--json", "Output JSON")
    .action(async (opts: { json?: boolean }) => {
      try {
        const res = await fetch(`${PROXY_URL}/health`, { signal: AbortSignal.timeout(3000) });
        const data = await res.json();
        if (opts.json) {
          console.log(JSON.stringify(data, null, 2));
        } else {
          console.log(kleur.bold("\nProxy Status\n"));
          console.log(`Status: ${res.ok ? kleur.green("✓ online") : kleur.red("✗ error")}`);
          console.log(`URL:    ${PROXY_URL}`);
          console.log(JSON.stringify(data, null, 2));
        }
      } catch {
        if (opts.json) {
          console.log(JSON.stringify({ status: "offline", error: "Connection refused" }));
        } else {
          console.log(kleur.yellow(`⚠ Proxy unreachable at ${PROXY_URL}`));
          console.log(kleur.gray("  Start it with: omoctl proxy start"));
        }
      }
    });

  proxyCmd
    .command("log")
    .description("Tail the proxy log live")
    .option("-n <lines>", "Number of historical lines to show", "20")
    .action((opts: { n?: string }) => {
      if (!existsSync(PROXY_LOG_PATH)) {
        console.log(kleur.gray(`Proxy log not found: ${PROXY_LOG_PATH}`));
        console.log(kleur.gray("The proxy may not be running."));
        return;
      }

      console.log(kleur.gray(`Tailing ${PROXY_LOG_PATH} — Ctrl+C to stop\n`));

      // Simple tail implementation
      watchFile(PROXY_LOG_PATH, { interval: 500 }, () => {
        // New content notification — read new lines
      });

      const stream = createReadStream(PROXY_LOG_PATH, { encoding: "utf8" });
      stream.on("data", (chunk: string) => {
        const lines = chunk.split("\n").filter(Boolean);
        for (const line of lines) {
          try {
            const entry = JSON.parse(line) as Record<string, unknown>;
            const ts = (entry.timestamp ?? entry.time ?? "") as string;
            const provider = (entry.provider ?? "") as string;
            const method = (entry.method ?? "POST") as string;
            const status = (entry.status ?? entry.statusCode ?? "") as number | string;
            const latency = entry.latency ?? entry.duration;
            const statusColor = Number(status) >= 400 ? kleur.red : kleur.green;
            console.log(
              `${kleur.gray(String(ts).slice(11, 19))} ${provider.padEnd(10)} ${method} ${statusColor(String(status))}${latency ? kleur.gray(` ${latency}ms`) : ""}`,
            );
          } catch {
            console.log(kleur.gray(line));
          }
        }
      });

      process.on("SIGINT", () => {
        console.log(kleur.gray("\nStopped."));
        process.exit(0);
      });
    });

  proxyCmd
    .command("start")
    .description("Start the fallback proxy (if not running)")
    .action(() => {
      const proxyPath = `${process.env.HOME}/.config/opencode/fallback-proxy.js`;
      if (!existsSync(proxyPath)) {
        console.error(kleur.red(`✗ Proxy script not found: ${proxyPath}`));
        process.exit(1);
      }
      const proc = Bun.spawn(["bun", proxyPath], {
        stdout: "inherit",
        stderr: "inherit",
        detached: true,
      });
      console.log(kleur.green(`✓ Proxy started (pid ${proc.pid})`));
    });

  proxyCmd
    .command("stop")
    .description("Stop the fallback proxy")
    .action(() => {
      Bun.spawnSync(["pkill", "-f", "fallback-proxy"], { stdout: "ignore", stderr: "ignore" });
      console.log(kleur.green("✓ Proxy stop signal sent"));
    });
}
