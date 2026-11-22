import { useRef, useState } from "react";
import { toast } from "sonner";
import { Copy, Download, ExternalLink, Send } from "lucide-react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import { explorerAddr, loadImage, roundRect, short } from "./helpers";

// --- Receive view --------------------------------------------------------
// Completes the payments loop: your @username / address as a scannable code
// and a shareable link (…/app?to=<handle>) that drops the payer on a prefilled
// Send screen. Everything is derived from the connected wallet — no invented
// data. Falls back to the raw principal when no name is claimed.
export function ReceiveView(props: {
  address: string;
  myName: string | null;
  goClaim: () => void;
}) {
  const { address, myName, goClaim } = props;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  // Prefer the @username in the link — cleaner, and it outlives any one wallet.
  const handle = myName ?? address;
  const payLink = `${origin}/app?to=${encodeURIComponent(handle)}`;

  const copy = (text: string, label: string) => {
    navigator.clipboard?.writeText(text);
    toast.success(`${label} copied`);
  };

  const qrWrapRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [mountHighResQr, setMountHighResQr] = useState(false);

  // Rasterize a shareable "pay me" card to PNG and download it. Pure canvas —
  // no extra dependency, and nothing taints the export (logo + QR are
  // same-origin). Dark card keeps black primary; orange stays a tiny accent.
  const downloadCard = async () => {
    if (!mountHighResQr) {
      setMountHighResQr(true);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    }
    const src = qrWrapRef.current?.querySelector("canvas");
    if (!src) return;
    setSaving(true);
    try {
      try {
        await Promise.all([
          document.fonts.load("800 88px Manrope"),
          document.fonts.load("600 34px Manrope"),
          document.fonts.load("500 28px Manrope"),
        ]);
        await document.fonts.ready;
      } catch {
        /* fall back to sans-serif — still legible */
      }
      const logo = await loadImage("/assets/sato-logo.png").catch(() => null);
      const W = 1080;
      const H = 1350;
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      const g = c.getContext("2d");
      if (!g) return;
      const cx = W / 2;
      // Paper backdrop + inset rounded ink card with a soft drop shadow.
      g.fillStyle = "#f5f4ef";
      g.fillRect(0, 0, W, H);
      const m = 48;
      g.save();
      g.shadowColor = "rgba(13,17,23,0.22)";
      g.shadowBlur = 48;
      g.shadowOffsetY = 22;
      roundRect(g, m, m, W - 2 * m, H - 2 * m, 56);
      g.fillStyle = "#0d1117";
      g.fill();
      g.restore();
      roundRect(g, m, m, W - 2 * m, H - 2 * m, 56);
      g.strokeStyle = "rgba(255,255,255,0.06)";
      g.lineWidth = 2;
      g.stroke();

      // Logo mark near the top.
      if (logo) {
        const lh = 82;
        const lw = (logo.naturalWidth / logo.naturalHeight) * lh || lh;
        g.drawImage(logo, cx - lw / 2, 118, lw, lh);
      }

      // White QR tile with the QR centered inside.
      const tile = 560;
      const tileY = 248;
      g.save();
      g.shadowColor = "rgba(0,0,0,0.30)";
      g.shadowBlur = 40;
      g.shadowOffsetY = 16;
      roundRect(g, cx - tile / 2, tileY, tile, tile, 44);
      g.fillStyle = "#ffffff";
      g.fill();
      g.restore();
      const q = 452;
      g.drawImage(src, cx - q / 2, tileY + (tile - q) / 2, q, q);
      // Handle (@username or short address), auto-fit to width.
      const handleText = myName ? `@${myName}` : short(address);
      let hs = 88;
      g.textAlign = "center";
      const maxW = W - 260;
      do {
        g.font = `800 ${hs}px Manrope, sans-serif`;
        if (g.measureText(handleText).width <= maxW) break;
        hs -= 4;
      } while (hs > 40);
      g.fillStyle = "#ffffff";
      g.fillText(handleText, cx, 946);

      // Subtitle.
      g.font = "600 34px Manrope, sans-serif";
      g.fillStyle = "#8791a0";
      g.fillText("Scan to pay me on Sato", cx, 1000);

      // Address — shown only when a @username already headlines the card.
      if (myName) {
        g.font = "500 28px Manrope, sans-serif";
        g.fillStyle = "#6e7784";
        g.fillText(short(address), cx, 1086);
      }

      // Small orange accent rule (brand: orange only on little things).
      roundRect(g, cx - 34, 1128, 68, 5, 3);
      g.fillStyle = "#f15a24";
      g.fill();

      // Footer tagline.
      g.font = "600 27px Manrope, sans-serif";
      g.fillStyle = "#8791a0";
      g.fillText("sato · send bitcoin like a text", cx, 1188);
      const blob = await new Promise<Blob | null>((res) =>
        c.toBlob(res, "image/png"),
      );
      if (!blob) throw new Error("no blob");
      const fname =
        (myName ?? "wallet").replace(/[^a-z0-9_-]/gi, "") || "wallet";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sato-${fname}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Card saved to your downloads");
    } catch {
      toast.error("Couldn't create the card");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Offscreen high-res QR, mounted on demand when downloading the card. */}
      {mountHighResQr && (
        <div
          ref={qrWrapRef}
          aria-hidden
          style={{
            position: "absolute",
            left: -99999,
            top: 0,
            pointerEvents: "none",
          }}
        >
          <QRCodeCanvas
            value={payLink}
            size={520}
            level="H"
            bgColor="#ffffff"
            fgColor="#0d1117"
            marginSize={0}
            imageSettings={{
              src: "/assets/sato-logo.png",
              height: 104,
              width: 104,
              excavate: true,
            }}
          />
        </div>
      )}
      <header className="page-head">
        <div>
          <span className="page-kicker">Payments</span>
          <h1>Receive sBTC</h1>
          <p>Share your code or link to get paid.</p>
        </div>
      </header>

      <div className="send-grid">
        <section className="panel receive-hero">
          <div className="qr-frame">
            <QRCodeSVG
              value={payLink}
              size={252}
              level="H"
              bgColor="#ffffff"
              fgColor="#0d1117"
              marginSize={0}
              imageSettings={{
                src: "/assets/sato-logo.png",
                height: 48,
                width: 48,
                excavate: true,
              }}
            />
          </div>

          <div className="receive-info">
            <div className="receive-handle">
              {myName ? (
                <>
                  <span className="receive-at">@</span>
                  <span className="receive-name">{myName}</span>
                </>
              ) : (
                <span className="receive-name unnamed">{short(address)}</span>
              )}
            </div>
            {myName ? (
              <p className="receive-note">
                Scan the code or open the link — anyone can pay you at{" "}
                <b>@{myName}</b>.
              </p>
            ) : (
              <p className="receive-note">
                You can still receive to your address. Claim a{" "}
                <button className="link-btn" onClick={goClaim}>
                  @username
                </button>{" "}
                for a cleaner code and link.
              </p>
            )}

            <div className="receive-actions">
              <button
                className="btn primary"
                onClick={downloadCard}
                disabled={saving}
              >
                <Download size={16} /> {saving ? "Creating…" : "Download card"}
              </button>
              <button
                className="btn soft"
                onClick={() => copy(payLink, "Payment link")}
              >
                <Copy size={15} /> Copy link
              </button>
            </div>

            <div className="receive-addr">
              <span className="panel-eyebrow">Your address</span>
              <span className="mono receive-addr-val">{address}</span>
              <div className="receive-addr-row">
                <button
                  className="btn soft sm"
                  onClick={() => copy(address, "Address")}
                >
                  <Copy size={14} /> Copy
                </button>
                <a
                  className="btn soft sm"
                  href={explorerAddr(address)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink size={14} /> Explorer
                </a>
              </div>
            </div>
          </div>
        </section>
        <aside className="panel send-aside">
          <span className="panel-eyebrow">Good to know</span>
          <ul className="tips">
            <li>
              <span className="tip-dot" /> Anyone can pay you by scanning your{" "}
              <b>code</b> or opening your <b>link</b> — it prefills their Send.
            </li>
            <li>
              <span className="tip-dot" /> Payments settle on-chain straight to
              your wallet — nothing is custodial.
            </li>
          </ul>
        </aside>
      </div>
    </>
  );
}
