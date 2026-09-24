// Gas: the shared sponsor pool that makes every Sato action gasless. All the
// figures are live reads from sato-sponsor — pool balance, your remaining
// sponsored allowance this window, the per-user cap, and how many you've used.
// You can top the pool up with testnet STX (the one action that needs STX on
// hand — the co-signer still covers the fee, but the contribution is yours).

import React from "react";
import { Linking, Text, View } from "react-native";
import { Btn, Field, Panel, Screen, StatTile, PageHead, Tips } from "@/components/ui";
import { useWallet } from "@/state/wallet-store";
import { sponsorTopUp } from "@/lib/sato";
import { fmt, fmtStx } from "@/lib/format";
import { C, S } from "@/theme";

const STX_FAUCET = "https://explorer.hiro.so/sandbox/faucet?chain=testnet";

function toMicroStx(stx: string): bigint {
  const n = Number(stx);
  if (!isFinite(n) || n <= 0) return 0n;
  return BigInt(Math.round(n * 1e6));
}

export default function GasScreen() {
  const w = useWallet();
  const [amt, setAmt] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const micro = toMicroStx(amt);

  const onTopUp = async () => {
    if (micro <= 0n || busy) return;
    setBusy(true);
    const id = await w.submit("Funded gas pool", () => sponsorTopUp(micro));
    setBusy(false);
    if (id) setAmt("");
  };

  const s = w.sponsor;
  return (
    <Screen refreshing={w.loading} onRefresh={w.refresh}>
      <PageHead
        eyebrow="Gas"
        title="Sponsored fees"
        sub="Sends, deposits and claims are free to you — fees come from this shared pool."
      />

      <View style={{ flexDirection: "row", gap: S.sm }}>
        <StatTile label="Pool balance" value={`${fmtStx(s.poolBalance)} STX`} />
        <StatTile
          label="Your allowance"
          value={`${fmt(s.remaining)} left`}
          sub={`cap ${fmt(s.cap)} / window`}
        />
      </View>
      <View style={{ flexDirection: "row", gap: S.sm }}>
        <StatTile label="You've used" value={`${fmt(s.sponsoredCount)}`} sub="sponsored txs" />
        <StatTile label="Window" value={`${fmt(s.windowLength)}`} sub="blocks" />
      </View>

      <Panel>
        <Text style={{ color: C.ink, fontSize: 16, fontWeight: "800" }}>Top up the pool</Text>
        <Text style={{ color: C.textMuted, fontSize: 14, lineHeight: 20 }}>
          Contribute testnet STX so everyone's actions stay gasless. This is the one
          action that needs STX in your wallet — the fee is still sponsored.
        </Text>
        <Field
          label="Amount (STX)"
          value={amt}
          onChangeText={setAmt}
          placeholder="1"
          keyboardType="decimal-pad"
        />
        <Btn
          label={micro > 0n ? `Contribute ${fmtStx(micro)} STX` : "Contribute STX"}
          icon="zap"
          loading={busy}
          disabled={micro <= 0n || busy}
          onPress={onTopUp}
        />
        <Text
          onPress={() => void Linking.openURL(STX_FAUCET)}
          style={{ color: C.orange, fontWeight: "700", textAlign: "center" }}
        >
          Get testnet STX ↗
        </Text>
      </Panel>

      <Tips
        title="Why gasless"
        items={[
          "A fresh wallet holds no STX, so Sato sponsors the fee for onboarding actions.",
          "The pool is bounded by a fixed fee and a per-wallet rate limit each window.",
        ]}
      />
    </Screen>
  );
}
