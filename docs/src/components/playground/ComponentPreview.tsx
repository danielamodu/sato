import { useState, type ReactNode } from "react";
import { Eye, Code2, Copy, Check, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function ComponentPreview({
  title,
  description,
  code,
  language = "tsx",
  children,
  onReset,
}: {
  title: string;
  description?: string;
  code: string;
  language?: string;
  children: ReactNode;
  onReset?: () => void;
}) {
  const [tab, setTab] = useState<"preview" | "code">("preview");
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  return (
    <div className="my-8 overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:shadow-md">
      {/* Top Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/40 px-4 py-3">
        <div>
          <h3 className="text-sm font-bold tracking-tight text-foreground">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>

        <div className="flex items-center gap-2">
          {/* Tab Switcher: Preview | Code */}
          <div className="flex rounded-lg border border-border bg-background/80 p-0.5 text-xs font-semibold">
            <button
              onClick={() => setTab("preview")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1 transition-all ${
                tab === "preview"
                  ? "bg-primary text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Eye className="size-3.5" />
              <span>Preview</span>
            </button>
            <button
              onClick={() => setTab("code")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1 transition-all ${
                tab === "code"
                  ? "bg-primary text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Code2 className="size-3.5" />
              <span>Code</span>
            </button>
          </div>

          {/* Reset Button */}
          {onReset && tab === "preview" && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onReset}
              className="flex size-7 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Reset state"
            >
              <RotateCcw className="size-3" />
            </motion.button>
          )}

          {/* Copy Code Button */}
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={handleCopy}
            className="flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Copy code"
          >
            {copied ? (
              <>
                <Check className="size-3.5 text-emerald-500" />
                <span className="text-emerald-500">Copied</span>
              </>
            ) : (
              <>
                <Copy className="size-3.5" />
                <span>Copy</span>
              </>
            )}
          </motion.button>
        </div>
      </div>

      {/* Canvas / Code Area */}
      <AnimatePresence mode="wait">
        {tab === "preview" ? (
          <motion.div
            key="preview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="relative flex min-h-[220px] items-center justify-center p-6 md:p-10 bg-[radial-gradient(ellipse_at_center,var(--muted)_1px,transparent_1px)] [background-size:16px_16px]"
          >
            {children}
          </motion.div>
        ) : (
          <motion.div
            key="code"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-x-auto bg-[#0d1117] p-5 font-mono text-xs leading-relaxed text-zinc-200"
          >
            <pre className="m-0">
              <code>{code}</code>
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
