import { useState, useRef } from "react";
import { ArrowRight, Sparkles, Check, Zap, Flame, Loader2 } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

export function InteractiveButtons() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const [particles, setParticles] = useState<{ id: number; x: number; y: number }[]>([]);

  const handleSparkClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newParticles = Array.from({ length: 8 }, (_, i) => ({
      id: Date.now() + i,
      x: x + (Math.random() - 0.5) * 60,
      y: y + (Math.random() - 0.5) * 60,
    }));

    setParticles((prev) => [...prev.slice(-16), ...newParticles]);
    setClickCount((c) => c + 1);
  };

  const handleAsyncClick = () => {
    if (loading || success) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2200);
    }, 1400);
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-5">
      {/* 1. Spring-Weighted Evil Button */}
      <motion.button
        whileHover={{ scale: 1.04, y: -2 }}
        whileTap={{ scale: 0.92, y: 1 }}
        transition={{ type: "spring", stiffness: 450, damping: 18 }}
        className="group relative inline-flex items-center gap-2.5 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-primary/25 transition-colors hover:bg-primary/90"
      >
        <span>Send sBTC Gasless</span>
        <motion.span
          className="inline-block"
          initial={{ x: 0 }}
          whileHover={{ x: 3 }}
          transition={{ type: "spring", stiffness: 400 }}
        >
          <ArrowRight className="size-3.5" />
        </motion.span>
      </motion.button>

      {/* 2. Particle Burst Haptic Button */}
      <div className="relative">
        <motion.button
          onClick={handleSparkClick}
          whileTap={{ scale: 0.9 }}
          className="relative overflow-hidden rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-bold text-foreground shadow-sm hover:border-primary/50 hover:bg-muted/50 transition-all"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="size-3.5 text-amber-500 animate-pulse" />
            <span>Click for Haptics</span>
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
              {clickCount}
            </span>
          </div>
        </motion.button>

        {/* Flying Particles */}
        {particles.map((p) => (
          <motion.span
            key={p.id}
            initial={{ opacity: 1, scale: 1, x: 0, y: 0 }}
            animate={{ opacity: 0, scale: 0, x: p.x - 40, y: p.y - 40 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="pointer-events-none absolute left-1/2 top-1/2 size-2 rounded-full bg-amber-400"
          />
        ))}
      </div>

      {/* 3. Async State Morphing Button */}
      <motion.button
        onClick={handleAsyncClick}
        whileTap={{ scale: 0.94 }}
        disabled={loading}
        className={`relative inline-flex min-w-[130px] items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all duration-300 ${
          success
            ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25"
            : loading
            ? "bg-muted text-muted-foreground cursor-wait"
            : "bg-foreground text-background shadow-md hover:bg-foreground/90"
        }`}
      >
        {loading ? (
          <>
            <Loader2 className="size-3.5 animate-spin" />
            <span>Co-signing...</span>
          </>
        ) : success ? (
          <>
            <Check className="size-3.5" />
            <span>Confirmed!</span>
          </>
        ) : (
          <>
            <Zap className="size-3.5 text-primary" />
            <span>Test Sponsor</span>
          </>
        )}
      </motion.button>
    </div>
  );
}

export const BUTTONS_CODE = `import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

// Tactile Spring Button
export function SpringButton() {
  return (
    <motion.button
      whileHover={{ scale: 1.04, y: -2 }}
      whileTap={{ scale: 0.92, y: 1 }}
      transition={{ type: "spring", stiffness: 450, damping: 18 }}
      className="inline-flex items-center gap-2 rounded-xl bg-[#f15a24] px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-orange-500/25"
    >
      <span>Send sBTC Gasless</span>
      <ArrowRight className="size-3.5" />
    </motion.button>
  );
}`;
