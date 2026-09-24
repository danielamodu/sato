// Activity: the full on-chain history for this wallet, straight from Hiro. Tap
// any row to open it on the explorer. Pull to refresh.

import React from "react";
import { Screen, PageHead } from "@/components/ui";
import { TxList } from "@/components/tx";
import { useWallet } from "@/state/wallet-store";

export default function ActivityScreen() {
  const w = useWallet();
  return (
    <Screen refreshing={w.loading} onRefresh={w.refresh}>
      <PageHead
        eyebrow="Activity"
        title="Your history"
        sub="Every sBTC action, straight from the chain. Tap a row to open it on the explorer."
      />
      <TxList txs={w.txs} loading={w.loading} />
    </Screen>
  );
}
