// Send: pay an @username or a raw address, gaslessly. Honors the shared
// deep-link schema (?to=<@name|addr>&amount=<sats>) so a Receive/pay link opens
// straight into a prefilled transfer. Resolves @names on-chain for confirmation
// before sending, and blocks amounts over the spendable balance.

import React from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Btn, Field, Panel, Screen, PageHead } from "@/components/ui";
import { useWallet } from "@/state/wallet-store";
import { resolveName, send } from "@/lib/sato";
import { fmtBtc, short } from "@/lib/format";
import { C, S } from "@/theme";

// BTC string → integer sats. Returns 0n on anything unparseable.
function toSats(btc: string): bigint {
  const n = Number(btc);
  if (!isFinite(n) || n <= 0) return 0n;
  return BigInt(Math.round(n * 1e8));
}

export default function SendScreen() {
  const w = useWallet();
  const params = useLocalSearchParams<{ to?: string; amount?: string }>();

  const [to, setTo] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [resolved, setResolved] = React.useState<string | null>(null);
  const [resolving, setResolving] = React.useState(false);
  const [notFound, setNotFound] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  // Prefill from a pay link once on mount.
  React.useEffect(() => {
    if (params.to) setTo(String(params.to));
    if (params.amount) {
      const sats = Number(params.amount);
      if (isFinite(sats) && sats > 0) setAmount(String(sats / 1e8));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resolve @names (or bare names) to a principal for on-screen confirmation.
  // A raw address (starts with S) is taken as-is. Debounced.
  React.useEffect(() => {
    const raw = to.trim().replace(/^@/, "");
    setNotFound(false);
    setResolved(null);
    if (!raw) return;
    if (raw.startsWith("S")) {
      setResolved(raw);
      return;
    }
    let live = true;
    setResolving(true);
    const id = setTimeout(async () => {
      try {
        const principal = await resolveName(raw);
        if (!live) return;
        setResolved(principal);
        setNotFound(!principal);
      } finally {
        if (live) setResolving(false);
      }
    }, 350);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [to]);

  const sats = toSats(amount);
  const over = sats > w.balance;
  const canSend =
    !busy && !!resolved && sats > 0n && !over && !resolving && to.trim().length > 0;

  const onSend = async () => {
    if (!canSend) return;
    setBusy(true);
    const id = await w.submit("Sent sBTC", () => send(to, sats));
    setBusy(false);
    if (id) {
      setAmount("");
      setTo("");
      router.push("/");
    }
  };

  const recipientHint = resolving
    ? "Resolving…"
    : notFound
      ? "That @username isn't registered."
      : resolved && !resolved.startsWith(to.trim())
        ? `→ ${short(resolved)}`
        : undefined;

  return (
    <Screen>
      <PageHead
        eyebrow="Transfer"
        title="Send sBTC"
        sub="Pay by @username or address. No network fee — sends are sponsored."
      />
      <Panel>
        <Field
          label="To"
          value={to}
          onChangeText={setTo}
          placeholder="@name or ST… address"
          autoCapitalize="none"
          autoCorrect={false}
          hint={recipientHint}
        />
        <Field
          label="Amount (BTC)"
          value={amount}
          onChangeText={setAmount}
          placeholder="0.001"
          keyboardType="decimal-pad"
          hint={
            over
              ? `Over balance — you have ${fmtBtc(w.balance)} BTC`
              : `Available ${fmtBtc(w.balance)} BTC`
          }
        />
        <Btn
          label={sats > 0n ? `Send ${fmtBtc(sats)} BTC` : "Send"}
          icon="arrow-up-right"
          loading={busy}
          disabled={!canSend}
          onPress={onSend}
        />
        <Text style={{ color: C.muted, fontSize: 12, textAlign: "center" }}>
          Gasless · signed on this device
        </Text>
      </Panel>
    </Screen>
  );
}
