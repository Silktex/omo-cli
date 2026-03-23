import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { PROXY_LOG_PATH, PROXY_URL } from "../../constants.js";
import { existsSync, readFileSync } from "node:fs";

interface ProxyStatus {
  status: "online" | "offline" | "checking";
  data?: Record<string, unknown>;
}

export function ProxyView() {
  const [proxyStatus, setProxyStatus] = useState<ProxyStatus>({ status: "checking" });
  const [logLines, setLogLines] = useState<string[]>([]);

  useEffect(() => {
    // Poll proxy health
    const checkHealth = async () => {
      try {
        const res = await fetch(`${PROXY_URL}/health`, { signal: AbortSignal.timeout(2000) });
        const data = await res.json() as Record<string, unknown>;
        setProxyStatus({ status: "online", data });
      } catch {
        setProxyStatus({ status: "offline" });
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000);

    // Load last N lines of proxy log
    if (existsSync(PROXY_LOG_PATH)) {
      try {
        const raw = readFileSync(PROXY_LOG_PATH, "utf8");
        const lines = raw.split("\n").filter(Boolean).slice(-20);
        setLogLines(lines);
      } catch { /* ignore */ }
    }

    return () => clearInterval(interval);
  }, []);

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan" underline>Fallback Proxy</Text>

      {/* Status */}
      <Box borderStyle="single" borderColor="gray" padding={1} marginTop={1}>
        <Text bold>Status: </Text>
        {proxyStatus.status === "checking" && <Text color="yellow">checking…</Text>}
        {proxyStatus.status === "online" && <Text color="green">✓ online at {PROXY_URL}</Text>}
        {proxyStatus.status === "offline" && <Text color="red">✗ offline (not reachable at {PROXY_URL})</Text>}
      </Box>

      {proxyStatus.data && (
        <Box flexDirection="column" borderStyle="single" borderColor="gray" padding={1} marginTop={1}>
          <Text bold>Health Response</Text>
          <Text color="gray">{JSON.stringify(proxyStatus.data, null, 2).slice(0, 400)}</Text>
        </Box>
      )}

      {/* Log preview */}
      <Box flexDirection="column" borderStyle="single" borderColor="gray" padding={1} marginTop={1}>
        <Text bold>Proxy Log <Text color="gray" dimColor>({PROXY_LOG_PATH})</Text></Text>
        {logLines.length === 0 ? (
          <Text color="gray" dimColor>No log entries found. Run `omoctl proxy log` for live tail.</Text>
        ) : (
          logLines.slice(-10).map((line, i) => {
            try {
              const entry = JSON.parse(line) as Record<string, unknown>;
              const ts = String(entry.timestamp ?? entry.time ?? "").slice(11, 19);
              const provider = String(entry.provider ?? "");
              const status = entry.status ?? entry.statusCode ?? "";
              const statusColor = Number(status) >= 400 ? "red" : "green";
              return (
                <Box key={i}>
                  <Text color="gray">{ts} </Text>
                  <Text color="cyan">{provider.padEnd(12)}</Text>
                  <Text color={statusColor as "red" | "green"}>{String(status)}</Text>
                </Box>
              );
            } catch {
              return <Text key={i} color="gray" dimColor>{line.slice(0, 80)}</Text>;
            }
          })
        )}
      </Box>

      <Box marginTop={1}>
        <Text color="gray" dimColor>Run `omoctl proxy status` or `omoctl proxy log` for more detail.</Text>
      </Box>
    </Box>
  );
}
