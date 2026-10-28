import { useEffect, useState } from "react";
import { Search, FileCode2, Layers, Cpu, Shield, Zap, BookOpen, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface SearchItem {
  id: string;
  title: string;
  category: "Contracts" | "Architecture" | "APIs" | "Guides";
  icon: any;
  targetId: string;
}

const SEARCH_ITEMS: SearchItem[] = [
  { id: "overview", title: "Overview & Vision", category: "Architecture", icon: Layers, targetId: "overview" },
  { id: "architecture", title: "System Architecture Flow", category: "Architecture", icon: Cpu, targetId: "architecture" },
  { id: "yield-v3", title: "sato-yield-v3 (Yield Ledger)", category: "Contracts", icon: FileCode2, targetId: "contracts-yield-v3" },
  { id: "names", title: "sato-names (@username Registry)", category: "Contracts", icon: FileCode2, targetId: "contracts-names" },
  { id: "sponsor-contract", title: "sato-sponsor (Gas Pool)", category: "Contracts", icon: FileCode2, targetId: "contracts-sponsor" },
  { id: "vault", title: "sato-vault (SIP-010 Real sBTC)", category: "Contracts", icon: FileCode2, targetId: "contracts-vault" },
  { id: "gasless", title: "Two-Phase Gasless Co-Signing", category: "APIs", icon: Zap, targetId: "gasless" },
  { id: "embedded-wallet", title: "Mobile Embedded Wallet", category: "Architecture", icon: Shield, targetId: "wallet" },
  { id: "bills", title: "VTPass Nigerian Utility Bills", category: "APIs", icon: BookOpen, targetId: "bills" },
  { id: "offramp", title: "Naira Offramp Specs", category: "APIs", icon: BookOpen, targetId: "offramp" },
];

export function CommandPalette({
  isOpen,
  onClose,
  onSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (targetId: string) => void;
}) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          setQuery("");
          // Open handled by parent
        }
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const filtered = SEARCH_ITEMS.filter((item) =>
    item.title.toLowerCase().includes(query.toLowerCase()) ||
    item.category.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm"
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.16 }}
            className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl"
          >
            {/* Input */}
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search contracts, APIs, architecture..."
                className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-hidden"
              />
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                ESC
              </kbd>
            </div>

            {/* Results list */}
            <div className="max-h-80 overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  No matching documentation topics found.
                </div>
              ) : (
                filtered.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onSelect(item.targetId);
                        onClose();
                      }}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex size-7 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                          <Icon className="size-3.5" />
                        </div>
                        <span className="font-medium text-foreground">{item.title}</span>
                      </div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {item.category}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
