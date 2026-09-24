// The interactive balance staircase, ported from the web dashboard. Reconstructs
// balance-over-time from the current balance and the signed on-chain events
// (deposits/receives/sends), draws it as a step line, and lets you tap a node to
// inspect that change. All figures are real: no invented points, no price curve.

import React, { useMemo, useState } from "react";
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import type { BalanceEvent } from "@/lib/sato";
import { fmtBtc, fmtUsd, timeAgo, short } from "@/lib/format";
import { C, R, S } from "@/theme";

export type SeriesPoint = {
  time: number;
  sats: bigint;
  kind: BalanceEvent["kind"] | "anchor";
  delta: bigint;
  peer: string | null;
};

// Walk backwards from the known current balance so every plotted point is a real
// on-chain balance. The leading "anchor" is the balance just before the first
// event we can see (usually 0 — a fresh wallet's first deposit).
export function buildBalanceSeries(balance: bigint, events: BalanceEvent[]): SeriesPoint[] {
  if (events.length === 0) return [];
  const total = events.reduce((s, e) => s + e.delta, 0n);
  let running = balance - total;
  const pts: SeriesPoint[] = [
    { time: events[0].time, sats: running, kind: "anchor", delta: 0n, peer: null },
  ];
  for (const e of events) {
    running += e.delta;
    pts.push({ time: e.time, sats: running, kind: e.kind, delta: e.delta, peer: e.peer });
  }
  return pts;
}

function captionFor(p: SeriesPoint): string {
  if (p.kind === "anchor") return "Starting balance";
  const verb = p.kind === "sent" ? "Sent to" : p.kind === "received" ? "Received from" : "Deposited";
  const who = p.peer ? ` ${short(p.peer)}` : "";
  return `${verb}${p.kind === "deposit" ? "" : who} · ${timeAgo(p.time)}`;
}

export function BalanceChart({
  balance,
  events,
  btcUsd,
  height = 132,
}: {
  balance: bigint;
  events: BalanceEvent[];
  btcUsd: number | null;
  height?: number;
}) {
  const series = useMemo(() => buildBalanceSeries(balance, events), [balance, events]);
  const [w, setW] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);

  const active = sel != null ? series[sel] : null;
  const shownSats = active ? active.sats : balance;

  const PADX = 8;
  const PADY = 12;
  const n = series.length;
  const values = series.map((p) => Number(p.sats));
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const span = max - min || 1;
  const innerH = height - PADY * 2;
  const xOf = (i: number) => (n <= 1 ? PADX : PADX + (i * (w - PADX * 2)) / (n - 1));
  const yOf = (v: number) => PADY + innerH - ((v - min) / span) * innerH;

  let line = "";
  let area = "";
  if (n > 0 && w > 0) {
    line = `M ${xOf(0)} ${yOf(values[0])}`;
    for (let i = 1; i < n; i++) line += ` H ${xOf(i)} V ${yOf(values[i])}`;
    area = `${line} L ${xOf(n - 1)} ${yOf(min)} L ${xOf(0)} ${yOf(min)} Z`;
  }

  return (
    <View>
      <Text style={styles.heroLabel}>{active ? captionFor(active) : "Balance"}</Text>
      <Text style={styles.heroBtc}>{fmtBtc(shownSats)} BTC</Text>
      <Text style={styles.heroUsd}>
        {btcUsd != null ? fmtUsd(shownSats, btcUsd) : `${shownSats.toString()} sats`}
      </Text>

      <View style={[styles.chart, { height }]} onLayout={onLayout}>
        {n > 1 && w > 0 ? (
          <>
            <Svg width={w} height={height}>
              <Path d={area} fill={C.hairline} />
              <Path d={line} stroke={C.ink} strokeWidth={2} fill="none" />
              {active ? (
                <Line
                  x1={xOf(sel!)}
                  y1={PADY}
                  x2={xOf(sel!)}
                  y2={PADY + innerH}
                  stroke={C.orange}
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
              ) : null}
              {series.map((p, i) => (
                <Circle
                  key={i}
                  cx={xOf(i)}
                  cy={yOf(Number(p.sats))}
                  r={sel === i ? 5 : 3}
                  fill={sel === i ? C.orange : C.ink}
                />
              ))}
            </Svg>
            {/* transparent tap targets, one per node */}
            <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
              {series.map((_, i) => (
                <Pressable
                  key={i}
                  onPress={() => setSel(sel === i ? null : i)}
                  style={{
                    position: "absolute",
                    left: xOf(i) - (w / n) / 2,
                    width: w / n,
                    top: 0,
                    height,
                  }}
                />
              ))}
            </View>
          </>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Your balance history will chart here.</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heroLabel: {
    color: C.textMuted, fontSize: 12, fontWeight: "700",
    letterSpacing: 0.6, textTransform: "uppercase",
  },
  heroBtc: { color: C.ink, fontSize: 34, fontWeight: "800", letterSpacing: -1, marginTop: 2 },
  heroUsd: { color: C.textMuted, fontSize: 15, fontWeight: "600", marginTop: 2 },
  chart: { marginTop: S.md, justifyContent: "center" },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.hairline,
    borderStyle: "dashed",
  },
  emptyText: { color: C.muted, fontSize: 13 },
});
