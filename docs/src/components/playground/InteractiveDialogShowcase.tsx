import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ShieldCheck, Key, Lock, Check } from "lucide-react";

export function InteractiveDialogShowcase() {
  const [isOpen, setIsOpen] = useState(false);
  const [backedUp, setBackedUp] = useState(false);

  return (
    <div className="flex flex-col items-center gap-3">
      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-bold text-foreground shadow-sm hover:border-primary/50 hover:bg-muted/40 transition-all"
      >
        <Key className="size-3.5 text-primary" />
        <span>Open Embedded Key Vault</span>
      </motion.button>

      {/* Modal Backdrop and Box */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", stiffness: 450, damping: 25 }}
              className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-emerald-500" />
                  <h3 className="text-sm font-bold text-foreground">Hardware Enclave Storage</h3>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="my-4 rounded-xl bg-muted/50 p-4 text-xs leading-relaxed text-muted-foreground">
                <p>
                  Sato generates your 12-word Bitcoin keypair on-device using <strong>@stacks/wallet-sdk</strong>. It is
                  stored encrypted in your phone's hardware keychain (iOS Secure Enclave / Android Keystore).
                </p>
                <div className="mt-3 flex items-center gap-2 font-mono text-[11px] text-foreground">
                  <Lock className="size-3 text-primary" />
                  <span>WHEN_UNLOCKED_THIS_DEVICE_ONLY</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-xl px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  Close
                </button>
                <motion.button
                  whileTap={{ scale: 0.94 }}
                  onClick={() => {
                    setBackedUp(true);
                    setTimeout(() => setIsOpen(false), 800);
                  }}
                  className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-bold text-white shadow-md shadow-primary/20 hover:bg-primary/90"
                >
                  {backedUp ? (
                    <>
                      <Check className="size-3.5" />
                      <span>Saved!</span>
                    </>
                  ) : (
                    <span>Test Backup</span>
                  )}
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export const DIALOG_CODE = `import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function KeyModal() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)}>Open Vault</button>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl"
            >
              <h3>Hardware Enclave Storage</h3>
              <button onClick={() => setOpen(false)}>Close</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}`;
