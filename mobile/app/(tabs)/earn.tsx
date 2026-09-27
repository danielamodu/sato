// Earn: on sato-yield-v3 your liquid balance auto-earns the base rate the moment
// it lands — no deposit step. Optionally LOCK sats into the higher boost rate for
// a fixed term, then CLAIM principal + boost yield once it matures. Every action
// is gasless. All figures are live contract reads — nothing estimated except the
// projected payout, which is the contract's own accrual formula.

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Btn, Field, Panel, Pill, Screen, StatTile, PageHead, Tips } from "@/components/ui";
import { useWallet } from "@/state/wallet-store";
import { earnLock, earnClaim, fundEarn, YIELD_BLOCKS_PER_YEAR } from "@/lib/sato";
import { fmt, fmtBtc, fmtUsd } from "@/lib/format";
import { C, R, S } from "@/theme";

const TERMS = ["25", "100", "250"]; // lock terms, in blocks

function toSats(btc: string): bigint {
  const n = Number(btc);
  if (!isFinite(n) || n <= 0) return 0n;
  return BigInt(Math.round(n * 1e8));
}

const pctApr = (bps: bigint) => `${(Number(bps) / 100).toLocaleString("en-US")}% APR`;

export default function EarnScreen() {
  const w = useWallet();
  const e = w.earn;
  const [amount, setAmount] = React.useState("");
  const [term, setTerm] = React.useState("100");
  const [busy, setBusy] = React.useState<"lock" | "claim" | "fund" | null>(null);

  const hasLock = e.locked > 0n;
  const amountSats = toSats(amount);
  const termBlocks = (() => {
    try {
      return BigInt(term || "0");
    } catch {
      return 0n;
    }
  })();
  const over = amountSats > e.liquid;
  const boostYield = e.lockValue > e.locked ? e.lockValue - e.locked : 0n;
  const blocksLeft = e.lockUnlock > e.height ? e.lockUnlock - e.height : 0n;
  const matured = hasLock && e.height > 0n && blocksLeft === 0n;

  // The contract's own accrual formula: principal × rate(bps) × blocks / (year × 10000).
  const projYield =
    amountSats > 0n && termBlocks > 0n
      ? (amountSats * e.boostRateBps * termBlocks) / (BigInt(YIELD_BLOCKS_PER_YEAR) * 10000n)
      : 0n;

  const usd = (sats: bigint) => (w.prices.btc != null ? fmtUsd(sats, w.prices.btc) : undefined);

  const onLock = async () => {
    if (amountSats <= 0n || termBlocks <= 0n || over || busy) return;
    setBusy("lock");
    const id = await w.submit("Locked for boost", () => earnLock(amountSats, termBlocks));
    setBusy(null);
    if (id) setAmount("");
  };

  const onClaim = async () => {
    if (!matured || busy) return;
    setBusy("claim");
    await w.submit("Claimed lock", () => earnClaim());
    setBusy(null);
  };

  const onFaucet = async () => {
    if (busy) return;
    setBusy("fund");
    await w.submit("Added 0.01 test sBTC", () => fundEarn(1_000_000n));
    setBusy(null);
  };

  return (
    <Screen refreshing={w.loading} onRefresh={w.refresh}>
      <PageHead
        eyebrow="Earn"
        title="Grow your sBTC"
        sub="Your balance auto-earns the base rate the moment it lands. Lock sats for a fixed term to earn the higher boost rate. Everything's gasless."
      />

      <View style={{ flexDirection: "row", gap: S.sm }}>
        <StatTile label="Earning now" value={`${fmtBtc(e.liquid)}`} sub={usd(e.liquid)} />
        <StatTile label="Locked" value={`${fmtBtc(e.lockValue)}`} accent={hasLock} sub={usd(e.lockValue)} />
      </View>

      <View style={{ flexDirection: "row", gap: S.sm }}>
        <StatTile label="Base rate" value={pctApr(e.baseRateBps)} />
        <StatTile label="Boost rate" value={pctApr(e.boostRateBps)} accent />
      </View>
      {hasLock ? (
        <Panel>
          <View style={styles.rowBetween}>
            <Text style={styles.panelTitle}>Active lock</Text>
            <Pill tone={matured ? "ok" : "pending"}>
              {matured ? "Matured" : `${fmt(blocksLeft)} blocks left`}
            </Pill>
          </View>
          <LockRow label="Locked principal" value={`${fmtBtc(e.locked)} BTC`} sub={usd(e.locked)} />
          <LockRow label="Current value" value={`${fmtBtc(e.lockValue)} BTC`} sub={usd(e.lockValue)} />
          <LockRow label="Boost yield" value={`+${fmtBtc(boostYield)} BTC`} accent />
          <Btn
            label={matured ? "Claim principal + yield" : "Locked until maturity"}
            icon="unlock"
            loading={busy === "claim"}
            disabled={!matured || !!busy}
            onPress={onClaim}
          />
          <Text style={styles.note}>
            {matured
              ? "Your lock has matured — claim to return everything to your spendable balance."
              : `Claim unlocks at block ${fmt(e.lockUnlock)}. Boost yield keeps accruing until then.`}
          </Text>
        </Panel>
      ) : (
        <Panel>
          <Text style={styles.panelTitle}>Lock for boost</Text>
          <Field
            label="Amount (BTC)"
            value={amount}
            onChangeText={setAmount}
            placeholder="0.001"
            keyboardType="decimal-pad"
            right={
              <Pressable onPress={() => setAmount(fmtBtc(e.liquid))} hitSlop={8}>
                <Text style={styles.max}>MAX</Text>
              </Pressable>
            }
            hint={
              over
                ? `Over balance — ${fmtBtc(e.liquid)} BTC earning now`
                : `${fmtBtc(e.liquid)} BTC available to lock`
            }
          />

          <View style={{ gap: S.xs }}>
            <Text style={styles.fieldLabel}>Term (blocks)</Text>
            <View style={styles.presets}>
              {TERMS.map((t) => {
                const active = term === t;
                return (
                  <Pressable
                    key={t}
                    onPress={() => setTerm(t)}
                    style={[styles.preset, active && styles.presetActive]}
                  >
                    <Text style={[styles.presetText, active && styles.presetTextActive]}>{t}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.rowBetween}>
            <Text style={styles.fieldLabel}>Projected boost yield</Text>
            <Text style={styles.projValue}>+{fmtBtc(projYield)} BTC</Text>
          </View>
          <Text style={styles.note}>
            Locking {amountSats > 0n ? fmtBtc(amountSats) : "0"} BTC for {term} blocks pays back{" "}
            {fmtBtc(amountSats + projYield)} BTC at unlock, at the {pctApr(e.boostRateBps)} boost rate.
          </Text>

          <Btn
            label="Lock for boost"
            icon="lock"
            loading={busy === "lock"}
            disabled={amountSats <= 0n || termBlocks <= 0n || over || !!busy}
            onPress={onLock}
          />
          {e.liquid === 0n ? (
            <Btn
              label="Get 0.01 test sBTC"
              icon="download"
              variant="ghost"
              loading={busy === "fund"}
              disabled={!!busy}
              onPress={onFaucet}
            />
          ) : null}
        </Panel>
      )}

      <Tips
        title="How earning works"
        items={[
          `Just holding sBTC earns the base rate (${pctApr(e.baseRateBps)}) — credited every block, no action needed.`,
          `Locking moves sats into the boost rate (${pctApr(e.boostRateBps)}) until the term ends, then claim returns principal + yield.`,
          "One lock at a time — claim the current one before opening another.",
        ]}
      />
    </Screen>
  );
}

function LockRow({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <View style={styles.rowBetween}>
      <Text style={styles.lockLabel}>{label}</Text>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={[styles.lockValue, accent && { color: C.orange }]}>{value}</Text>
        {sub ? <Text style={styles.lockSub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panelTitle: { color: C.ink, fontSize: 16, fontWeight: "800" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  fieldLabel: { color: C.textMuted, fontSize: 13, fontWeight: "600" },
  max: { color: C.orange, fontSize: 12, fontWeight: "800", letterSpacing: 0.4 },
  presets: { flexDirection: "row", gap: S.sm },
  preset: {
    flex: 1,
    alignItems: "center",
    paddingVertical: S.sm,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.paper,
  },
  presetActive: { backgroundColor: C.ink, borderColor: C.ink },
  presetText: { color: C.ink, fontSize: 15, fontWeight: "700" },
  presetTextActive: { color: C.white },
  projValue: { color: C.orange, fontSize: 16, fontWeight: "800" },
  note: { color: C.muted, fontSize: 12, lineHeight: 18 },
  lockLabel: { color: C.textMuted, fontSize: 14 },
  lockValue: { color: C.ink, fontSize: 15, fontWeight: "700" },
  lockSub: { color: C.muted, fontSize: 12 },
});
