// Sato palette + spacing tokens, mirrored from the web client's :root. Brand
// rule: black/white first, orange only on small accents (active tab dot, tip
// bullets, the little rule on the pay card, links).
export const C = {
  ink: "#0d1117",
  inkHover: "#20293a",
  paper: "#f5f4ef",
  white: "#ffffff",
  orange: "#f15a24",
  line: "#e6e4dd",
  hairline: "#eceae3",
  muted: "#9a958a",
  textMuted: "#6e7784",
  // status
  ok: "#2f7d54",
  okBg: "#eef6f1",
  miss: "#b4341f",
  missBg: "#fbeae7",
  warn: "#b56a1f",
  warnBg: "#fdf0e4",
  pending: "#b56a1f",
  pendingBg: "#fdf0e4",
  // testnet badge
  badgeBg: "#e7f3ec",
  badgeText: "#1b3a2a",
} as const;

export const R = { sm: 9, md: 12, lg: 16, xl: 18, pill: 999 } as const;
export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
