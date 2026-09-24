// Earn: deposit spendable sBTC into sato-yield-v2 and watch yield accrue per
// block, or withdraw principal + earned back to your wallet. Both actions are
// gasless. Figures (deposited, earned, available, pool) are live contract reads
// from the shared store — nothing here is estimated.

import React from "react";
import { Text, View } from "react-native";
import { Btn, Field, Panel, Screen, StatTile, PageHead, Tips } from "@/components/ui";
import { useWallet } from "@/state/wallet-store";
import { earnDeposit, earnWithdraw } from "@/lib/sato";
import { fmtBtc, fmtUsd } from "@/lib/format";
import { C, S } from "@/theme";

function toSats(btc: string): bigint {
  const n = Number(btc);
  if (!isFinite(n) || n <= 0) return 0n;
  return BigInt(Math.round(n * 1e8));
}

export default function EarnScreen() {
  const w = useWallet();
  const [dep, setDep] = React.useState("");
  const [wd, setWd] = React.useState("");
  const [busy, setBusy] = React.useState<"dep" | "wd" | null>(null);

  const depSats = toSats(dep);
  const wdSats = toSats(wd);
  const withdrawable = w.earn.deposited + w.earn.earned;
  const depOver = depSats > w.earn.available;
  const wdOver = wdSats > withdrawable;

  const onDeposit = async () => {
    if (depSats <= 0n || depOver || busy) return;
    setBusy("dep");
    const id = await w.submit("Deposited to Earn", () => earnDeposit(depSats));
    setBusy(null);
    if (id) setDep("");
  };

  const onWithdraw = async () => {
    if (wdSats <= 0n || wdOver || busy) return;
    setBusy("wd");
    const id = await w.submit("Withdrew from Earn", () => earnWithdraw(wdSats));
    setBusy(null);
    if (id) setWd("");
  };

  const usd = (sats: bigint) => (w.prices.btc != null ? fmtUsd(sats, w.prices.btc) : undefined);

  return (
    <Screen refreshing={w.loading} onRefresh={w.refresh}>
      <PageHead
        eyebrow="Earn"
        title="Grow your sBTC"
        sub="Deposit to earn yield that accrues every block. Deposit and withdraw are gasless."
      />

      <View style={{ flexDirection: "row", gap: S.sm }}>
        <StatTile label="Deposited" value={`${fmtBtc(w.earn.deposited)}`} sub={usd(w.earn.deposited)} />
        <StatTile
          label="Yield earned"
          value={`${fmtBtc(w.earn.earned)}`}
          accent={w.earn.earned > 0n}
          sub={usd(w.earn.earned)}
        />
      </View>

      <Panel>
        <Text style={{ color: C.ink, fontSize: 16, fontWeight: "800" }}>Deposit</Text>
        <Field
          label="Amount (BTC)"
          value={dep}
          onChangeText={setDep}
          placeholder="0.001"
          keyboardType="decimal-pad"
          hint={
            depOver
              ? `Over balance — ${fmtBtc(w.earn.available)} BTC available`
              : `Available to deposit ${fmtBtc(w.earn.available)} BTC`
          }
        />
        <Btn
          label="Deposit to Earn"
          icon="trending-up"
          loading={busy === "dep"}
          disabled={depSats <= 0n || depOver || !!busy}
          onPress={onDeposit}
        />
      </Panel>

      <Panel>
        <Text style={{ color: C.ink, fontSize: 16, fontWeight: "800" }}>Withdraw</Text>
        <Field
          label="Amount (BTC)"
          value={wd}
          onChangeText={setWd}
          placeholder="0.001"
          keyboardType="decimal-pad"
          hint={
            wdOver
              ? `Max ${fmtBtc(withdrawable)} BTC (principal + yield)`
              : `Withdrawable ${fmtBtc(withdrawable)} BTC (principal + yield)`
          }
        />
        <Btn
          label="Withdraw to wallet"
          icon="download"
          variant="ghost"
          loading={busy === "wd"}
          disabled={wdSats <= 0n || wdOver || !!busy}
          onPress={onWithdraw}
        />
      </Panel>

      <Tips
        title="How it works"
        items={[
          "Yield accrues per block on your deposited principal — no lockups.",
          "Need test sBTC first? Use the faucet on Home, then deposit here.",
        ]}
      />
    </Screen>
  );
}
