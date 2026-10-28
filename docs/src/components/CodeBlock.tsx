import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { motion } from "framer-motion";

interface CodeBlockProps {
  code: string;
  language?: string;
  title?: string;
  tabs?: { label: string; code: string; language: string }[];
}

export function CodeBlock({ code, language = "clarity", title, tabs }: CodeBlockProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [copied, setCopied] = useState(false);

  const currentCode = tabs ? tabs[activeTab].code : code;
  const currentLang = tabs ? tabs[activeTab].language : language;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // fallback
    }
  };

  return (
    <div className="relative my-4 overflow-hidden rounded-xl border border-border bg-[#0d1117] text-white shadow-md">
      {/* Top bar */}
      <div className="flex h-10 items-center justify-between border-b border-white/10 px-4 text-xs">
        <div className="flex items-center gap-2">
          {tabs ? (
            <div className="flex gap-1">
              {tabs.map((tab, idx) => (
                <button
                  key={tab.label}
                  onClick={() => setActiveTab(idx)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                    activeTab === idx
                      ? "bg-white/15 text-white shadow-xs"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          ) : (
            <span className="font-mono text-zinc-400">{title || currentLang}</span>
          )}
        </div>

        <motion.button
          onClick={handleCopy}
          whileTap={{ scale: 0.92 }}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="size-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="size-3.5" />
              <span>Copy</span>
            </>
          )}
        </motion.button>
      </div>

      {/* Code contents */}
      <div className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-zinc-200">
        <pre className="m-0">
          <code>{currentCode}</code>
        </pre>
      </div>
    </div>
  );
}
