import { useState } from "react";
import { motion } from "framer-motion";

const TABS = [
  { id: "sbtc", label: "sBTC (1:1)" },
  { id: "stacks", label: "Stacks Testnet" },
  { id: "fiat", label: "Naira Rails" },
  { id: "gas", label: "Zero Gas" },
];

export function InteractiveMorphTabs() {
  const [activeTab, setActiveTab] = useState("sbtc");

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex rounded-2xl border border-border bg-muted/50 p-1.5 shadow-inner">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative z-10 px-4 py-2 text-xs font-bold transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              {isActive && (
                <motion.div
                  layoutId="activeTabPill"
                  transition={{ type: "spring", stiffness: 500, damping: 32 }}
                  className="absolute inset-0 z-[-1] rounded-xl bg-card shadow-sm border border-border/80"
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="text-center font-mono text-xs text-muted-foreground">
        Active Environment: <strong className="text-foreground">{activeTab}</strong>
      </div>
    </div>
  );
}

export const TABS_CODE = `import { useState } from "react";
import { motion } from "framer-motion";

const TABS = ["sBTC", "Stacks", "Naira", "Zero Gas"];

export function MorphTabs() {
  const [selected, setSelected] = useState(TABS[0]);

  return (
    <div className="flex rounded-2xl border bg-zinc-100 dark:bg-zinc-900 p-1.5">
      {TABS.map((tab) => (
        <button
          key={tab}
          onClick={() => setSelected(tab)}
          className={\`relative z-10 px-4 py-2 text-xs font-bold transition-colors \${
            selected === tab ? "text-orange-500" : "text-zinc-500"
          }\`}
        >
          {tab}
          {selected === tab && (
            <motion.div
              layoutId="tabPill"
              transition={{ type: "spring", stiffness: 500, damping: 32 }}
              className="absolute inset-0 z-[-1] rounded-xl bg-white dark:bg-zinc-800 shadow-sm"
            />
          )}
        </button>
      ))}
    </div>
  );
}`;
