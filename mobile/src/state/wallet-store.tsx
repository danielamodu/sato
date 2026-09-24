// The shared wallet store: one place that derives the embedded-wallet address,
// pulls all on-chain state in parallel, and hands it to every screen. Mirrors
// the web App.tsx `refresh()` (name, balance, earn, sponsor, history, txs) so
// the two clients show identical figures. Also hosts a tiny toast so gasless
// actions can report "submitted" with an explorer link, then auto-refresh.

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { getAddress } from "@/lib/wallet";
import {
  getBalance,
  getName,
  getEarnStats,
  getSponsorStats,
  getRecentTransactions,
  getBalanceHistory,
  type EarnStats,
  type SponsorStats,
  type SatoTx,
  type BalanceEvent,
} from "@/lib/sato";
import { explorerTx, fetchPrices } from "@/lib/format";
import { C, R, S } from "@/theme";

const EMPTY_EARN: EarnStats = { deposited: 0n, earned: 0n, available: 0n, poolTotal: 0n };
const EMPTY_SPONSOR: SponsorStats = {
  poolBalance: 0n, remaining: 0n, cap: 0n, sponsoredCount: 0n, windowLength: 0n,
};

type Toast = { id: number; msg: string; tone: "ok" | "err" | "info"; txId?: string };

type Ctx = {
  ready: boolean; // wallet derived, first refresh attempted
  address: string;
  name: string | null;
  balance: bigint;
  earn: EarnStats;
  sponsor: SponsorStats;
  events: BalanceEvent[];
  txs: SatoTx[];
  prices: { btc: number | null; stx: number | null };
  loading: boolean;
  refresh: () => Promise<void>;
  submit: (label: string, action: () => Promise<string>) => Promise<string | null>;
  notify: (msg: string, opts?: { tone?: Toast["tone"]; txId?: string }) => void;
  reload: () => Promise<void>; // re-derive the address (after a wipe)
};

const WalletContext = createContext<Ctx | null>(null);

export function useWallet(): Ctx {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside <WalletProvider>");
  return ctx;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [address, setAddress] = useState("");
  const [name, setName] = useState<string | null>(null);
  const [balance, setBalance] = useState(0n);
  const [earn, setEarn] = useState<EarnStats>(EMPTY_EARN);
  const [sponsor, setSponsor] = useState<SponsorStats>(EMPTY_SPONSOR);
  const [events, setEvents] = useState<BalanceEvent[]>([]);
  const [txs, setTxs] = useState<SatoTx[]>([]);
  const [prices, setPrices] = useState<{ btc: number | null; stx: number | null }>({
    btc: null, stx: null,
  });
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const addrRef = useRef("");

  const notify = useCallback((msg: string, opts?: { tone?: Toast["tone"]; txId?: string }) => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, msg, tone: opts?.tone ?? "info", txId: opts?.txId }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6500);
  }, []);

  const refresh = useCallback(async () => {
    const addr = addrRef.current;
    if (!addr) return;
    setLoading(true);
    try {
      const [nm, bal, ea, sp, hist, pr] = await Promise.all([
        getName(addr).catch(() => null),
        getBalance(addr).catch(() => 0n),
        getEarnStats(addr).catch(() => EMPTY_EARN),
        getSponsorStats(addr).catch(() => EMPTY_SPONSOR),
        getBalanceHistory(addr).catch(() => ({ events: [] as BalanceEvent[], complete: false })),
        fetchPrices().catch(() => ({ btc: null, stx: null })),
      ]);
      setName(nm);
      setBalance(bal);
      setEarn(ea);
      setSponsor(sp);
      setEvents(hist.events);
      setPrices(pr);
      setTxs(await getRecentTransactions(addr, 25).catch(() => []));
    } finally {
      setLoading(false);
    }
  }, []);

  const boot = useCallback(async () => {
    try {
      const addr = await getAddress(); // mints a wallet on first launch
      addrRef.current = addr;
      setAddress(addr);
    } catch (e: any) {
      notify(e?.message || "Couldn't open your wallet", { tone: "err" });
    } finally {
      setReady(true);
    }
    void refresh();
  }, [notify, refresh]);

  useEffect(() => {
    void boot();
  }, [boot]);

  // After a wipe: forget everything, then re-derive (mints a fresh wallet).
  const reload = useCallback(async () => {
    addrRef.current = "";
    setAddress("");
    setName(null);
    setBalance(0n);
    setEarn(EMPTY_EARN);
    setSponsor(EMPTY_SPONSOR);
    setEvents([]);
    setTxs([]);
    setReady(false);
    await boot();
  }, [boot]);

  // Run one gasless write: report "submitted" with an explorer link, then give
  // the node a few seconds and refresh. Errors surface as a red toast.
  const submit = useCallback(
    async (label: string, action: () => Promise<string>): Promise<string | null> => {
      try {
        const txId = await action();
        notify(`${label} — submitted`, { tone: "ok", txId });
        setTimeout(() => {
          void refresh();
        }, 4000);
        return txId;
      } catch (e: any) {
        notify(e?.message || "Something went wrong", { tone: "err" });
        return null;
      }
    },
    [notify, refresh],
  );

  const value: Ctx = {
    ready, address, name, balance, earn, sponsor, events, txs, prices, loading,
    refresh, submit, notify, reload,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
      <ToastHost toasts={toasts} onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
    </WalletContext.Provider>
  );
}

function ToastHost({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      {toasts.map((t) => {
        const tone = t.tone === "ok" ? C.ok : t.tone === "err" ? C.miss : C.ink;
        return (
          <Pressable
            key={t.id}
            onPress={() => (t.txId ? void Linking.openURL(explorerTx(t.txId)) : onDismiss(t.id))}
            style={[styles.toast, { borderLeftColor: tone }]}
          >
            <Text style={styles.msg}>{t.msg}</Text>
            {t.txId ? <Text style={styles.link}>View on explorer ↗</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: S.md,
    right: S.md,
    bottom: 96, // clear of the tab bar
    gap: S.sm,
  },
  toast: {
    backgroundColor: C.white,
    borderRadius: R.md,
    borderLeftWidth: 3,
    paddingVertical: S.md,
    paddingHorizontal: S.md,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  msg: { color: C.ink, fontSize: 14, fontWeight: "600" },
  link: { color: C.orange, fontSize: 12, fontWeight: "700", marginTop: 2 },
});
