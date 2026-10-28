import { Search, Sun, Moon, Menu, ExternalLink, ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";

export function Header({
  onOpenSearch,
  onToggleMobileMenu,
  theme,
  onToggleTheme,
}: {
  onOpenSearch: () => void;
  onToggleMobileMenu: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-md md:px-8">
      {/* Left: Mobile trigger & breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileMenu}
          className="rounded-lg p-2 text-muted-foreground hover:bg-muted md:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="size-5" />
        </button>

        <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <span>Sato</span>
          <span>/</span>
          <span className="text-foreground">Developer Docs</span>
        </div>
      </div>

      {/* Right: Search, Theme, Links */}
      <div className="flex items-center gap-2.5">
        {/* Command palette search trigger */}
        <button
          onClick={onOpenSearch}
          className="flex h-9 w-44 sm:w-64 items-center justify-between rounded-lg border border-border bg-muted/40 px-3 text-xs text-muted-foreground transition-all hover:border-border/80 hover:bg-muted"
        >
          <div className="flex items-center gap-2">
            <Search className="size-3.5" />
            <span>Search docs...</span>
          </div>
          <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span>⌘</span>K
          </kbd>
        </button>

        {/* Theme toggle */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onToggleTheme}
          className="flex size-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Toggle dark/light theme"
        >
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </motion.button>

        {/* Main Dapp Link */}
        <a
          href="https://satoxbt.com"
          target="_blank"
          rel="noreferrer"
          className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3.5 py-1.5 text-xs font-semibold text-background transition-all hover:bg-foreground/90"
        >
          <span>satoxbt.com</span>
          <ArrowUpRight className="size-3.5" />
        </a>
      </div>
    </header>
  );
}
