// Pay bills: spend sBTC on Nigerian airtime. Quote a naira amount in sats at the
// live rate (server-signed), pay the treasury gaslessly, then the web backend
// verifies that payment on-chain and tops up the phone via VTPass. Airtime first;
// data/electricity/cable slot into the same flow. Mirror of the web BillsView.

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Btn, Field, Panel, Screen, PageHead, Tips } from "@/components/ui";
import { useWallet } from "@/state/wallet-store";
import { quoteAirtime, payAirtime, type Network, type BillQuote } from "@/lib/bills";
import { fmt, fmtBtc, fmtUsd } from "@/lib/format";
import { C, R, S } from "@/theme";

const NETWORKS: { id: Network; label: string }[] = [
  { id: "mtn", label: "MTN" },
  { id: "glo", label: "Glo" },
  { id: "airtel", label: "Airtel" },
  { id: "9mobile", label: "9mobile" },
];
const NGN_CHIPS = ["100", "200", "500", "1000", "2000"];
const MIN_NGN = 50;
const MAX_NGN = 50_000;

const phoneOkFn = (p: string) => /^(0\d{10}|234\d{10})$/.test(p.trim());

export default function BillsScreen() {
  const w = useWallet();
  const btc = w.prices.btc;

  const [net, setNet] = React.useState<Network>("mtn");
  const [phone, setPhone] = React.useState("");
  const [ngn, setNgn] = React.useState("");
  const [quote, setQuote] = React.useState<BillQuote | null>(null);
  const [quoting, setQuoting] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [stage, setStage] = React.useState<string | null>(null);

  const amountNgn = Math.floor(Number(ngn));
  const ngnValid = Number.isFinite(amountNgn) && amountNgn >= MIN_NGN && amountNgn <= MAX_NGN;

  // Debounced quote: whenever the network or amount changes, drop any stale quote
  // and (if the amount is in range) fetch a fresh server-signed one. Degrades to
  // no quote if the backend is unreachable, so the screen still renders.
  React.useEffect(() => {
    setQuote(null);
    if (!ngnValid) {
      setQuoting(false);
      return;
    }
    let live = true;
    setQuoting(true);
    const id = setTimeout(async () => {
      try {
        const q = await quoteAirtime(net, amountNgn);
        if (live) setQuote(q);
      } catch {
        if (live) setQuote(null);
      } finally {
        if (live) setQuoting(false);
      }
    }, 450);
    return () => {
      live = false;
      clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [net, ngn]);

  const phoneOk = phoneOkFn(phone);
  const sats = quote ? BigInt(quote.sats) : 0n;
  const over = quote != null && sats > w.balance;
  const payDisabled = busy || !quote || !phoneOk || over || quoting;

  const onPay = async () => {
    if (!quote || !phoneOk || over || busy) return;
    setBusy(true);
    let paidTxid: string | undefined;
    try {
      const r = await payAirtime(quote, phone.trim(), (s, txid) => {
        setStage(s === "paying" ? "Paying…" : "Confirming on-chain…");
        if (txid) paidTxid = txid;
      });
      const txid = r.txid ?? paidTxid;
      if (r.status === "delivered") {
        w.notify(`₦${amountNgn} ${labelFor(net)} airtime delivered`, { tone: "ok", txId: txid });
        setNgn("");
        setPhone("");
      } else if (r.status === "processing") {
        w.notify("Paid — the network is delivering your airtime", { tone: "ok", txId: txid });
        setNgn("");
        setPhone("");
      } else if (r.status === "pending") {
        w.notify(r.detail || "Payment confirming — check Activity shortly", { tone: "info", txId: txid });
      } else {
        w.notify(r.detail || r.error || "The biller rejected this", { tone: "err", txId: txid });
      }
      if (r.status === "delivered" || r.status === "processing") {
        setTimeout(() => void w.refresh(), 4000);
      }
    } catch (e: any) {
      w.notify(e?.message || "Couldn't complete the payment", { tone: "err" });
    } finally {
      setBusy(false);
      setStage(null);
    }
  };

  return (
    <Screen refreshing={w.loading} onRefresh={w.refresh}>
      <PageHead
        eyebrow="Pay bills"
        title="Buy airtime"
        sub="Top up any Nigerian line with your sBTC. Priced live, paid gaslessly — the network delivers in seconds."
      />

      <Panel>
        {/* network */}
        <View style={{ gap: S.xs }}>
          <Text style={styles.fieldLabel}>Network</Text>
          <View style={styles.presets}>
            {NETWORKS.map((n) => {
              const active = net === n.id;
              return (
                <Pressable
                  key={n.id}
                  onPress={() => setNet(n.id)}
                  style={[styles.preset, active && styles.presetActive]}
                >
                  <Text style={[styles.presetText, active && styles.presetTextActive]}>
                    {n.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Field
          label="Phone number"
          value={phone}
          onChangeText={setPhone}
          placeholder="080… or 234…"
          keyboardType="phone-pad"
          autoCorrect={false}
          hint={phone.length > 0 && !phoneOk ? "Enter a valid Nigerian number." : undefined}
        />

        <Field
          label="Amount (₦)"
          value={ngn}
          onChangeText={setNgn}
          placeholder="500"
          keyboardType="number-pad"
          hint={
            ngn.length > 0 && !ngnValid
              ? `Enter ₦${MIN_NGN}–₦${MAX_NGN.toLocaleString()}.`
              : over
                ? `Over balance — you have ${fmtBtc(w.balance)} BTC`
                : undefined
          }
        />

        <View style={styles.chips}>
          {NGN_CHIPS.map((c) => {
            const active = ngn === c;
            return (
              <Pressable
                key={c}
                onPress={() => setNgn(c)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  ₦{Number(c).toLocaleString()}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* price line */}
        <View style={styles.rowBetween}>
          <Text style={styles.fieldLabel}>You pay</Text>
          <View style={{ alignItems: "flex-end" }}>
            {quote ? (
              <>
                <Text style={styles.payValue}>≈ {fmt(sats)} sats</Text>
                <Text style={styles.paySub}>
                  {btc != null ? `${fmtUsd(sats, btc)} · ` : ""}₦{quote.amountNgn.toLocaleString()} airtime
                </Text>
              </>
            ) : (
              <Text style={styles.paySub}>
                {quoting ? "Pricing…" : ngnValid ? "Couldn't price this — try again." : "Enter an amount"}
              </Text>
            )}
          </View>
        </View>

        <Btn
          label={quote ? `Pay ₦${quote.amountNgn.toLocaleString()} airtime` : "Pay airtime"}
          icon="smartphone"
          loading={busy}
          disabled={payDisabled}
          onPress={onPay}
        />
        <Text style={styles.note}>
          {busy && stage ? stage : "Gas covered by the Sato pool · signed on this device"}
        </Text>
      </Panel>

      <Tips
        title="How pay bills works"
        items={[
          "We price your naira bill in sats at the live BTC/NGN rate, with a small spread for the settlement window.",
          "You pay that in sBTC to Sato — gaslessly. Once the payment confirms on-chain, we top up the line via VTPass.",
          "Airtime today; data, electricity and cable TV are next on the same flow.",
        ]}
      />
    </Screen>
  );
}
function labelFor(id: Network): string {
  return NETWORKS.find((n) => n.id === id)?.label ?? id;
}

const styles = StyleSheet.create({
  fieldLabel: { color: C.textMuted, fontSize: 13, fontWeight: "600" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
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
  presetText: { color: C.ink, fontSize: 14, fontWeight: "700" },
  presetTextActive: { color: C.white },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: S.sm },
  chip: {
    paddingVertical: S.sm,
    paddingHorizontal: S.md,
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.paper,
  },
  chipActive: { backgroundColor: C.ink, borderColor: C.ink },
  chipText: { color: C.ink, fontSize: 13, fontWeight: "700" },
  chipTextActive: { color: C.white },
  payValue: { color: C.ink, fontSize: 16, fontWeight: "800" },
  paySub: { color: C.muted, fontSize: 12 },
  note: { color: C.muted, fontSize: 12, textAlign: "center" },
});
