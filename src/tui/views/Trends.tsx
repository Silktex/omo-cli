import React from "react";
import { Box, Text } from "ink";
import type { AppState } from "../App.js";
import { getSnapshotHistory } from "../../db/queries.js";
import type { Provider } from "../../types.js";

export function TrendsView({ state }: { state: AppState }) {
  const providers: Provider[] = ["alibaba", "minimax", "zai"];

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan" underline>Cost & Token Trends</Text>
      <Text color="gray" dimColor>Historical data accumulates as omoctl polls providers.</Text>

      {providers.map(p => {
        const history = getSnapshotHistory(p, 24);
        const hasData = history.length > 0;
        const spendValues = history.map(s => s.spendToday ?? 0);
        const maxSpend = Math.max(...spendValues, 0.01);

        return (
          <Box key={p} flexDirection="column" marginTop={1} borderStyle="single" borderColor="gray" padding={1}>
            <Text bold color="cyan">{p.toUpperCase()}</Text>
            {!hasData ? (
              <Text color="gray" dimColor>No history yet — run `omoctl plans` to start collecting data</Text>
            ) : (
              <>
                <Text color="gray">Spend today (last 24h snapshots)</Text>
                <Box>
                  {spendValues.slice(-40).map((v, i) => {
                    const h = Math.max(1, Math.round((v / maxSpend) * 8));
                    const color = v / maxSpend > 0.9 ? "red" : v / maxSpend > 0.75 ? "yellow" : "green";
                    return (
                      <Box key={i} flexDirection="column" alignItems="center" width={2}>
                        {"█".repeat(h).split("").map((c, j) => (
                          <Text key={j} color={color}>{c}</Text>
                        ))}
                      </Box>
                    );
                  })}
                </Box>
                <Text color="gray" dimColor>
                  Max: ${maxSpend.toFixed(4)}  |  Points: {history.length}
                </Text>
              </>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
