import React from "react";
import { Box, Text } from "ink";
import type { Provider, ProviderSnapshot } from "../../types.js";
import { PROVIDER_INFO } from "../../constants.js";

function gaugeBar(used: number, limit: number, width = 16): { bar: string; pct: number; color: "green" | "yellow" | "red" } {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const filled = Math.round(pct / 100 * width);
  const bar = "█".repeat(filled) + "░".repeat(width - filled);
  const color = pct >= 90 ? "red" : pct >= 75 ? "yellow" : "green";
  return { bar, pct, color };
}

export function ProviderCard({ provider, snapshot }: { provider: Provider; snapshot: ProviderSnapshot | null }) {
  const info = PROVIDER_INFO[provider];
  const shortName = provider.toUpperCase();

  if (!snapshot || snapshot.error) {
    return (
      <Box flexDirection="column" borderStyle="single" borderColor="gray" padding={1} width={20}>
        <Text bold color="gray">{shortName}</Text>
        <Text color="gray" dimColor>{snapshot?.error ? "API error" : "No data"}</Text>
        <Text color="gray" dimColor>run plans to fetch</Text>
      </Box>
    );
  }

  const tpdGauge = snapshot.tpdUsed != null && snapshot.tpdLimit != null
    ? gaugeBar(snapshot.tpdUsed, snapshot.tpdLimit)
    : null;

  const rpdGauge = snapshot.rpdUsed != null && snapshot.rpdLimit != null
    ? gaugeBar(snapshot.rpdUsed, snapshot.rpdLimit)
    : null;

  const estimated = snapshot.isEstimated ? <Text color="yellow"> ~</Text> : null;

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="cyan" padding={1} width={22}>
      <Text bold color="cyan">{shortName}{estimated}</Text>
      {snapshot.planName && <Text color="gray" dimColor>{snapshot.planName.slice(0, 18)}</Text>}

      {tpdGauge && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={tpdGauge.color}>{tpdGauge.bar} {tpdGauge.pct}%</Text>
          <Text color="gray" dimColor>TPD quota</Text>
        </Box>
      )}

      {rpdGauge && (
        <Box flexDirection="column">
          <Text color={rpdGauge.color}>{rpdGauge.bar} {rpdGauge.pct}%</Text>
          <Text color="gray" dimColor>RPD quota</Text>
        </Box>
      )}

      {snapshot.spendToday != null && (
        <Text color="white">${snapshot.spendToday.toFixed(2)} today</Text>
      )}

      {snapshot.quotaResetsAt && (
        <Text color="gray" dimColor>
          Resets: {formatResetTime(snapshot.quotaResetsAt)}
        </Text>
      )}
    </Box>
  );
}

function formatResetTime(isoStr: string): string {
  const ms = new Date(isoStr).getTime() - Date.now();
  if (ms <= 0) return "soon";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h${m}m`;
}
