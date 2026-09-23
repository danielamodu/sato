import { Toaster as Sonner, type ToasterProps } from "sonner";

// Sato is a light-surface product. This shipped as the stock shadcn toaster,
// which colored toasts from `--popover`/`--popover-foreground`/`--border` —
// tokens this app never defines, so `--normal-bg` resolved to nothing and every
// toast rendered with a transparent, unreadable background. Point the colors at
// our real tokens (index.css :root) and give each toast a solid surface, ink
// text, a hairline border, and a lift shadow so it reads over any content.
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--white)",
          "--normal-text": "var(--ink)",
          "--normal-border": "var(--line)",
        } as React.CSSProperties
      }
      toastOptions={{
        style: {
          background: "var(--white)",
          color: "var(--ink)",
          border: "1px solid var(--line)",
          boxShadow: "0 10px 30px rgba(13, 17, 23, 0.12)",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
