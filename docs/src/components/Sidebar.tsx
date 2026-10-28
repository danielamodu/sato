import { useState } from "react";
import {
  BookOpen,
  Cpu,
  FileCode2,
  Layers,
  Shield,
  Zap,
  ChevronRight,
  ExternalLink,
  Code2,
  Sparkles,
} from "lucide-react";

export interface NavSection {
  title: string;
  items: { id: string; label: string; badge?: string }[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Getting Started",
    items: [
      { id: "overview", label: "Overview & Vision" },
      { id: "architecture", label: "System Architecture" },
      { id: "quickstart", label: "Local Development" },
    ],
  },
  {
    title: "Smart Contracts",
    items: [
      { id: "contracts-yield-v3", label: "sato-yield-v3", badge: "v3" },
      { id: "contracts-names", label: "sato-names" },
      { id: "contracts-sponsor", label: "sato-sponsor" },
      { id: "contracts-vault", label: "sato-vault", badge: "SIP-010" },
    ],
  },
  {
    title: "Infrastructure",
    items: [
      { id: "gasless", label: "Gasless Co-Signing" },
      { id: "wallet", label: "Mobile Embedded Wallet" },
    ],
  },
  {
    title: "Payments & APIs",
    items: [
      { id: "bills", label: "Nigerian Bill Payments" },
      { id: "offramp", label: "Naira Offramp Flow" },
      { id: "api-reference", label: "API Reference" },
    ],
  },
];

export function Sidebar({
  activeId,
  onSelect,
  isMobileOpen,
  onCloseMobile,
}: {
  activeId: string;
  onSelect: (id: string) => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}) {
  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-xs md:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-card/60 backdrop-blur-md transition-transform duration-200 md:static md:translate-x-0 ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center gap-2.5 border-b border-border px-5">
          <img src="/assets/sato-logo.png" alt="Sato" className="size-6 object-contain" />
          <div className="flex items-center gap-2">
            <span className="font-bold tracking-tight text-foreground">sato</span>
            <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
              docs
            </span>
          </div>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title}>
              <h4 className="px-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </h4>
              <div className="mt-2 space-y-0.5">
                {section.items.map((item) => {
                  const isActive = activeId === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onSelect(item.id);
                        if (onCloseMobile) onCloseMobile();
                      }}
                      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        isActive
                          ? "bg-primary text-white shadow-xs"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <span>{item.label}</span>
                      {item.badge && (
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-mono ${
                            isActive
                              ? "bg-white/20 text-white"
                              : "bg-secondary text-muted-foreground"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer info */}
        <div className="border-t border-border p-4 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Testnet Live</span>
            </span>
            <a
              href="https://github.com/danielamodu/sato"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <span>GitHub</span>
              <ExternalLink className="size-3" />
            </a>
          </div>
        </div>
      </aside>
    </>
  );
}
