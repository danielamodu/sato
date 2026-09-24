// Overview: the balance staircase hero, the testnet faucet (gasless), quick
// actions, and a peek at recent activity. All figures come from the shared
// wallet store — real on-chain reads, never invented.

import React from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { Btn, Panel, Screen, StatTile, Tips } from "@/components/ui";
import { BalanceChart } from "@/components/chart";
import { TxList } from "@/components/tx";
import { useWallet } from "@/state/wallet-store";
import { fundSelf } from "@/lib/sato";
import { fmtBtc, fmtUsd } from "@/lib/format";
import { C, S } from "@/theme";

export default function Overview() {
  const w = useWallet();
  const [funding, setFunding] = React.useState(false);

  const onFaucet = async () => {
    setFunding(true);
    await w.submit("Added 0.01 test sBTC", () => fundSelf(1_000_000n));
    setFunding(false);
  };

  return (
    <Screen refreshing={w.loading} onRefresh={w.refresh}>
      <Panel>
        <BalanceChart balance={w.balance} events={w.events} btcUsd={w.prices.btc} />
        <View style={{ flexDirection: "row", gap: S.sm }}>
          <View style={{ flex: 1 }}>
            <Btn label="Send" icon="arrow-up-right" onPress={() => router.push("/send")} />
          </View>
          <View style={{ flex: 1 }}>
            <Btn
              label="Receive"
              icon="download"
              variant="ghost"
              onPress={() => router.push("/receive")}
            />
          </View>
        </View>
      </Panel>

      <Panel>
        <Text style={{ color: C.ink, fontSize: 16, fontWeight: "800" }}>Testnet faucet</Text>
        <Text style={{ color: C.textMuted, fontSize: 14, lineHeight: 20 }}>
          Mint yourself 0.01 test sBTC to try sends and Earn. Gasless — the fee is
          covered, so a brand-new wallet works with zero STX.
        </Text>
        <Btn label="Get 0.01 test sBTC" icon="download" loading={funding} onPress={onFaucet} />
      </Panel>

      <View style={{ flexDirection: "row", gap: S.sm }}>
        <StatTile
          label="In Earn"
          value={`${fmtBtc(w.earn.deposited)} BTC`}
          sub={w.prices.btc != null ? fmtUsd(w.earn.deposited, w.prices.btc) : undefined}
        />
        <StatTile
          label="Yield earned"
          value={`${fmtBtc(w.earn.earned)} BTC`}
          accent={w.earn.earned > 0n}
          sub={w.prices.btc != null ? fmtUsd(w.earn.earned, w.prices.btc) : undefined}
        />
      </View>

      <View style={{ gap: S.sm }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: C.ink, fontSize: 16, fontWeight: "800" }}>Recent activity</Text>
          <Text onPress={() => router.push("/activity")} style={{ color: C.orange, fontWeight: "700" }}>
            See all
          </Text>
        </View>
        <TxList txs={w.txs} loading={w.loading} limit={4} />
      </View>

      {!w.name ? (
        <Tips
          title="Tip"
          items={[
            "Claim a free @username on the Receive tab so people can pay you by name instead of a long address.",
          ]}
        />
      ) : null}
    </Screen>
  );
}
