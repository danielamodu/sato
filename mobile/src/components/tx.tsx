// The activity feed row + list, ported from the web TxRow/TxTable: an icon per
// action kind, a human label, relative time, and an honest status pill. Tapping
// a row opens it on the Hiro explorer. Loading shows skeletons; empty says so
// plainly rather than faking rows.

import React from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { SatoTx } from "@/lib/sato";
import { explorerTx, timeAgo } from "@/lib/format";
import { Pill, type Tone } from "@/components/ui";
import { C, R, S } from "@/theme";

type IconName = React.ComponentProps<typeof Feather>["name"];

const ICON: Record<SatoTx["kind"], IconName> = {
  sent: "arrow-up-right",
  added: "download",
  earn: "trending-up",
  gas: "zap",
  username: "at-sign",
  other: "activity",
};

function statusTone(s: SatoTx["status"]): Tone {
  return s === "success" ? "ok" : s === "pending" ? "pending" : "err";
}

function statusLabel(s: SatoTx["status"]): string {
  return s === "success"
    ? "Confirmed"
    : s === "pending"
      ? "Pending"
      : s === "abort"
        ? "Reverted"
        : "Failed";
}

export function TxRow({ tx }: { tx: SatoTx }) {
  return (
    <Pressable
      onPress={() => void Linking.openURL(explorerTx(tx.txId))}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.icon}>
        <Feather name={ICON[tx.kind]} size={16} color={C.ink} />
      </View>
      <View style={styles.body}>
        <Text style={styles.label}>{tx.label}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {timeAgo(tx.time)} · {tx.contract}
        </Text>
      </View>
      <Pill tone={statusTone(tx.status)}>{statusLabel(tx.status)}</Pill>
    </Pressable>
  );
}

export function TxList({
  txs,
  loading,
  limit,
}: {
  txs: SatoTx[];
  loading?: boolean;
  limit?: number;
}) {
  if (loading && txs.length === 0) {
    return (
      <View style={styles.list}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.skel} />
        ))}
      </View>
    );
  }
  if (txs.length === 0) {
    return (
      <View style={styles.emptyBox}>
        <Feather name="inbox" size={20} color={C.muted} />
        <Text style={styles.emptyText}>
          No activity yet. Your sends, deposits and claims will show up here.
        </Text>
      </View>
    );
  }
  const rows = limit ? txs.slice(0, limit) : txs;
  return (
    <View style={styles.list}>
      {rows.map((t) => (
        <TxRow key={t.txId} tx={t} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: S.xs },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: S.md,
    backgroundColor: C.white,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.line,
    padding: S.md,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: R.sm,
    backgroundColor: C.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, gap: 1 },
  label: { color: C.ink, fontSize: 15, fontWeight: "700" },
  meta: { color: C.muted, fontSize: 12 },
  skel: { height: 62, borderRadius: R.md, backgroundColor: C.hairline },
  emptyBox: {
    alignItems: "center",
    gap: S.sm,
    padding: S.xl,
    backgroundColor: C.white,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.line,
    borderStyle: "dashed",
  },
  emptyText: { color: C.muted, fontSize: 13, textAlign: "center", lineHeight: 19, maxWidth: 260 },
});
