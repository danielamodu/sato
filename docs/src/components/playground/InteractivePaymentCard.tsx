import { useState, useMemo } from "react";
import { ArrowRight, Check, Send, Sparkles, RefreshCcw, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function InteractivePaymentCard() {
  const [recipient, setRecipient] = useState("amani");
  const [amount, setAmount] = useState(0.015);
  const [status, setStatus] = useState<"idle" | "signing" | "broadcasting" | "confirmed">("idle");

  const fiatUSD = useMemo(() => (amount * 65000).toFixed(2), [amount]);

  const handleSend = () => {
    if (status !== "idle") return;
    setStatus("signing");
    setTimeout(() => {
      setStatus("broadcasting");
      setTimeout(() => {
        setStatus("confirmed");
      }, 900);
    }, 700);
  };

  const handleReset = () => {
    setStatus("idle");
  };

  return (
    <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-lg">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Send className="size-3.5" />
          </div>
          <span className="font-mono text-xs font-bold text-foreground">SATO PAYMENT TERMINAL</span>
        </div>
        <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
          <ShieldCheck className="size-3" />
          <span>Zero Gas</span>
        </span>
      </div>

      <AnimatePresence mode="wait">
        {status === "confirmed" ? (
          <motion.div
            key="receipt"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="my-5 flex flex-col items-center rounded-xl bg-muted/40 p-5 text-center"
          >
            <div className="flex size-10 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md shadow-emerald-500/30">
              <Check className="size-5" />
            </div>
            <h4 className="mt-3 text-sm font-bold text-foreground">Transfer Confirmed!</h4>
            <p className="mt-1 text-xs text-muted-foreground">
              Sent <strong className="text-foreground">{amount.toFixed(3)} sBTC</strong> (≈ ${fiatUSD}) to{" "}
              <strong className="text-primary">@{recipient}</strong>
            </p>
            <span className="mt-2 text-[10px] font-mono text-muted-foreground">Gas fee: 0 STX (Sponsored)</span>

            <button
              onClick={handleReset}
              className="mt-4 flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
            >
              <RefreshCcw className="size-3" />
              <span>Send Another</span>
            </button>
          </motion.div>
        ) : (
          <motion.div key="form" className="mt-4 space-y-4">
            {/* Recipient */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Recipient</label>
              <div className="mt-1 flex items-center rounded-xl border border-border bg-background px-3 py-2 text-xs">
                <span className="font-bold text-primary mr-0.5">@</span>
                <input
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                  placeholder="username"
                  className="w-full bg-transparent font-medium text-foreground outline-hidden"
                />
              </div>
            </div>

            {/* Amount Slider */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <span>Amount</span>
                <span className="font-mono text-xs text-foreground font-bold">
                  {amount.toFixed(3)} sBTC <span className="text-muted-foreground font-normal">(≈ ${fiatUSD})</span>
                </span>
              </div>
              <input
                type="range"
                min="0.001"
                max="0.05"
                step="0.001"
                value={amount}
                onChange={(e) => setAmount(parseFloat(e.target.value))}
                className="mt-2 w-full accent-primary cursor-pointer"
              />
            </div>

            {/* Fee note */}
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
              <span>Sponsor Gas Fee</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">0.00 STX</span>
            </div>

            {/* Action button */}
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={handleSend}
              disabled={status !== "idle" || !recipient}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-xs font-bold text-white shadow-md shadow-primary/25 hover:bg-primary/90 disabled:opacity-50 transition-all"
            >
              {status === "signing" ? (
                <span>1/2 Signing on-device...</span>
              ) : status === "broadcasting" ? (
                <span>2/2 Co-signing & broadcasting...</span>
              ) : (
                <>
                  <span>Send @{recipient || "recipient"}</span>
                  <ArrowRight className="size-3.5" />
                </>
              )}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export const PAYMENT_CODE = `import { useState } from "react";
import { sendSbtcSponsored } from "@/lib/sato";

export function SendTerminal() {
  const [recipient, setRecipient] = useState("amani");
  const [sats, setSats] = useState(50000n);

  const handleSend = async () => {
    // 1. Resolve @username to Stacks principal
    // 2. Client partially signs AuthType.Sponsored
    // 3. Relays to /api/sponsor for co-signing
    const txid = await sendSbtcSponsored(recipient, sats);
    console.log("Transaction broadcasted:", txid);
  };

  return (
    <button onClick={handleSend} className="bg-[#f15a24] text-white px-4 py-2 rounded-xl">
      Send Gasless to @{recipient}
    </button>
  );
}`;
