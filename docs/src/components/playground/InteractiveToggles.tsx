import { useState } from "react";
import { motion } from "framer-motion";
import { Bell, Flame, Shield, Zap } from "lucide-react";

export function InteractiveToggles() {
  const [toggleA, setToggleA] = useState(true);
  const [toggleB, setToggleB] = useState(false);
  const [toggleC, setToggleC] = useState(true);

  return (
    <div className="flex flex-wrap items-center justify-center gap-8">
      {/* 1. Toggle.supply spring switch with icon */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold text-foreground">Auto-Yield</span>
        <button
          role="switch"
          aria-checked={toggleA}
          onClick={() => setToggleA(!toggleA)}
          className={`relative inline-flex h-7 w-13 cursor-pointer rounded-full p-1 transition-colors duration-200 ease-in-out focus:outline-hidden ${
            toggleA ? "bg-primary shadow-inner" : "bg-muted shadow-inner"
          }`}
        >
          <motion.span
            layout
            transition={{ type: "spring", stiffness: 600, damping: 30 }}
            className={`pointer-events-none flex size-5 items-center justify-center rounded-full bg-white shadow-md ${
              toggleA ? "translate-x-6 text-primary" : "translate-x-0 text-muted-foreground"
            }`}
          >
            <Zap className="size-2.5 fill-current" />
          </motion.span>
        </button>
      </div>

      {/* 2. Tactile Pill Switch */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold text-foreground">Sponsor Pool</span>
        <button
          role="switch"
          aria-checked={toggleB}
          onClick={() => setToggleB(!toggleB)}
          className={`relative inline-flex h-8 w-16 cursor-pointer rounded-xl border border-border p-1 transition-colors ${
            toggleB ? "bg-emerald-500/10 border-emerald-500/40" : "bg-muted/40"
          }`}
        >
          <motion.span
            layout
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
            className={`pointer-events-none flex h-full w-7 items-center justify-center rounded-lg text-[10px] font-bold shadow-xs ${
              toggleB ? "translate-x-7 bg-emerald-500 text-white" : "translate-x-0 bg-background text-foreground"
            }`}
          >
            {toggleB ? "ON" : "OFF"}
          </motion.span>
        </button>
      </div>

      {/* 3. Physical Haptic Push Switch */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold text-foreground">Hardware Enclave</span>
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => setToggleC(!toggleC)}
          className={`flex size-8 items-center justify-center rounded-xl border transition-all ${
            toggleC
              ? "border-primary bg-primary text-white shadow-md shadow-primary/30"
              : "border-border bg-muted/50 text-muted-foreground hover:bg-muted"
          }`}
        >
          <Shield className="size-4" />
        </motion.button>
      </div>
    </div>
  );
}

export const TOGGLE_CODE = `import { useState } from "react";
import { motion } from "framer-motion";
import { Zap } from "lucide-react";

export function SpringSwitch() {
  const [enabled, setEnabled] = useState(true);

  return (
    <button
      role="switch"
      aria-checked={enabled}
      onClick={() => setEnabled(!enabled)}
      className={\`relative inline-flex h-7 w-13 cursor-pointer rounded-full p-1 transition-colors \${
        enabled ? "bg-[#f15a24]" : "bg-zinc-700"
      }\`}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 600, damping: 30 }}
        className={\`pointer-events-none flex size-5 items-center justify-center rounded-full bg-white shadow-md \${
          enabled ? "translate-x-6" : "translate-x-0"
        }\`}
      >
        <Zap className="size-2.5 fill-current text-[#f15a24]" />
      </motion.span>
    </button>
  );
}`;
