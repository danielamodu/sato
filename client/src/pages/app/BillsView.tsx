import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Hash, Lightbulb, RefreshCw, Smartphone, Tv, Wifi, Zap } from "lucide-react";
import {
  listVariations,
  payBill,
  quoteBill,
  verifyBillersCode,
  type BillQuote,
  type Category,
  type Network,
  type Variation,
} from "@/lib/bills";
import { fmt, fmtUsd } from "./helpers";

// --- Pay bills view (sBTC -> airtime, data, electricity, cable via VTPass) -
const CATEGORIES = [
  { id: "airtime" as Category, label: "Airtime", Icon: Smartphone },
  { id: "data" as Category, label: "Data", Icon: Wifi },
  { id: "electricity" as Category, label: "Power", Icon: Lightbulb },
  { id: "cable" as Category, label: "Cable TV", Icon: Tv },
];
const NETWORKS: { id: Network; label: string }[] = [
  { id: "mtn", label: "MTN" },
  { id: "glo", label: "Glo" },
  { id: "airtel", label: "Airtel" },
  { id: "9mobile", label: "9mobile" },
];
const NGN_CHIPS = ["100", "200", "500", "1000", "2000"];
const DISCOS: { id: string; label: string }[] = [
  { id: "ikeja", label: "Ikeja Electric (IKEDC)" },
  { id: "eko", label: "Eko Electric (EKEDC)" },
  { id: "abuja", label: "Abuja (AEDC)" },
  { id: "ibadan", label: "Ibadan (IBEDC)" },
  { id: "enugu", label: "Enugu (EEDC)" },
  { id: "ph", label: "Port Harcourt (PHED)" },
  { id: "kano", label: "Kano (KEDCO)" },
  { id: "jos", label: "Jos (JED)" },
  { id: "kaduna", label: "Kaduna (KAEDCO)" },
  { id: "benin", label: "Benin (BEDC)" },
];
const CABLE: { id: string; label: string }[] = [
  { id: "dstv", label: "DStv" },
  { id: "gotv", label: "GOtv" },
  { id: "startimes", label: "StarTimes" },
];
// Noun shown on the pay button and in toasts, per category.
const CAT_NOUN: Record<Category, string> = {
  airtime: "airtime",
  data: "data",
  electricity: "electricity",
  cable: "TV",
};


export function BillsView(props: { balance: bigint; btcUsd: number | null; onPaid?: () => void }) {
  const { balance, btcUsd, onPaid } = props;

  const [category, setCategory] = useState<Category>("airtime");
  const [net, setNet] = useState<Network>("mtn"); // airtime + data
  const [disco, setDisco] = useState("ikeja"); // electricity
  const [provider, setProvider] = useState("dstv"); // cable
  const [phone, setPhone] = useState("");
  const [ngn, setNgn] = useState(""); // airtime + electricity
  const [variationCode, setVariationCode] = useState(""); // data + cable plan
  const [variations, setVariations] = useState<Variation[]>([]);
  const [loadingVars, setLoadingVars] = useState(false);
  const [billersCode, setBillersCode] = useState(""); // meter / smartcard
  const [meterType, setMeterType] = useState<"prepaid" | "postpaid">("prepaid");
  const [verified, setVerified] = useState<{ name: string; address?: string } | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [quote, setQuote] = useState<BillQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteStale, setQuoteStale] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isFixed = category === "data" || category === "cable";
  const isVerifiable = category === "electricity" || category === "cable";
  // Friendly biller token; the server maps it to a VTPass serviceID.
  const serviceID = category === "electricity" ? disco : category === "cable" ? provider : net;
  const phoneOk = /^(0\d{10}|234\d{10})$/.test(phone.trim());
  const codeOk = /^\d{5,20}$/.test(billersCode.trim());
  const sats = quote ? BigInt(quote.sats) : 0n;
  const over = sats > balance;
  // Reset the per-category inputs whenever the category changes.
  useEffect(() => {
    setQuote(null);
    setVariationCode("");
    setVariations([]);
    setBillersCode("");
    setVerified(null);
    setNgn("");
  }, [category]);

  // Load plans / bouquets for data & cable when the biller changes.
  useEffect(() => {
    if (!isFixed) return;
    let alive = true;
    setLoadingVars(true);
    setVariations([]);
    setVariationCode("");
    listVariations(category, serviceID)
      .then((vs) => alive && setVariations(vs))
      .catch(() => alive && setVariations([]))
      .finally(() => alive && setLoadingVars(false));
    return () => {
      alive = false;
    };
  }, [category, serviceID, isFixed]);

  // A verified name only applies to the exact code/type it was checked against.
  useEffect(() => {
    setVerified(null);
  }, [billersCode, meterType, serviceID]);
  // Debounced live quote. Fixed-price plans (data, cable) are priced from the
  // chosen variation server-side; airtime/electricity from the naira amount.
  // The last good quote stays on screen while a refresh is in flight so the
  // price never flashes away on every keystroke.
  useEffect(() => {
    const amount = Math.floor(Number(ngn));
    const ready = isFixed ? !!variationCode : amount >= 50;
    if (!ready) {
      setQuote(null);
      setQuoting(false);
      setQuoteStale(false);
      return;
    }
    let alive = true;
    setQuoting(true);
    const t = setTimeout(async () => {
      try {
        const q =
          category === "airtime"
            ? await quoteBill({ service: "airtime", serviceID: net, amountNgn: amount })
            : category === "data"
              ? await quoteBill({ service: "data", serviceID: net, variation_code: variationCode })
              : category === "electricity"
                ? await quoteBill({ service: "electricity", serviceID: disco, amountNgn: amount, variation_code: meterType })
                : await quoteBill({ service: "cable", serviceID: provider, variation_code: variationCode });
        if (alive) {
          setQuote(q);
          setQuoteStale(false);
        }
      } catch {
        // Keep the last good price up and say so, instead of blanking it.
        if (alive) setQuoteStale(true);
      } finally {
        if (alive) setQuoting(false);
      }
    }, 450);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [category, net, disco, provider, ngn, variationCode, meterType, isFixed]);
  const onVerify = async () => {
    if (!codeOk || verifying) return;
    setVerifying(true);
    try {
      const who = await verifyBillersCode(
        category,
        serviceID,
        billersCode.trim(),
        category === "electricity" ? meterType : undefined
      );
      setVerified(who);
      toast.success(`Verified: ${who.name}`, { description: who.address });
    } catch (e: any) {
      setVerified(null);
      toast.error("Couldn't verify that number", { description: e?.message });
    } finally {
      setVerifying(false);
    }
  };

  const billerLabel =
    category === "airtime" || category === "data"
      ? NETWORKS.find((n) => n.id === net)?.label || net
      : category === "electricity"
        ? DISCOS.find((d) => d.id === disco)?.label || disco
        : CABLE.find((c) => c.id === provider)?.label || provider;
  const payDisabled =
    busy || !quote || quoting || over || !phoneOk || (isVerifiable && (!codeOk || !verified));
  const onPay = async () => {
    if (payDisabled || !quote) return;
    const p = phone.trim();
    setBusy(true);
    try {
      const r = await payBill(quote, p, isVerifiable ? billersCode.trim() : undefined, (st) =>
        setStage(st === "paying" ? "Approve the payment…" : "Confirming on-chain…")
      );
      // Payment broadcast — refresh the balance whatever the biller says next.
      setTimeout(() => onPaid?.(), 4000);
      const label = `₦${quote.amountNgn.toLocaleString()} ${CAT_NOUN[category]}`;
      if (r.status === "delivered") toast.success(`${label} delivered`, { description: `to ${p}` });
      else if (r.status === "processing")
        toast.success(`${label} is on its way`, { description: "The biller will complete it shortly." });
      else if (r.status === "pending")
        toast.message("Payment still confirming", { description: r.detail || "It'll complete once mined." });
      else toast.error("Couldn't complete this bill", { description: r.error || r.detail });
      if (r.status === "delivered" || r.status === "processing") {
        setNgn("");
        setVariationCode("");
        setQuote(null);
      }
    } catch (e: any) {
      toast.error("Payment cancelled", { description: e?.message });
    } finally {
      setBusy(false);
      setStage(null);
    }
  };

  const payText = busy
    ? stage || "Paying…"
    : quote
      ? `Pay ₦${quote.amountNgn.toLocaleString()} ${CAT_NOUN[category]}`
      : `Pay ${CAT_NOUN[category]}`;
  return (
    <>
      <header className="page-head">
        <div>
          <span className="page-kicker">Spend</span>
          <h1>Pay bills</h1>
          <p>Turn sBTC into airtime, data, power and cable TV — priced live.</p>
        </div>
      </header>

      <div className="send-grid">
        <section className="panel send-panel">
          <label className="field-label">What are you paying?</label>
          <div className="cat-tabs" role="group" aria-label="Bill type">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`cat-tab${category === c.id ? " active" : ""}`}
                onClick={() => setCategory(c.id)}
              >
                <c.Icon size={18} />
                {c.label}
              </button>
            ))}
          </div>

          {(category === "airtime" || category === "data") && (
            <>
              <label className="field-label">Network</label>
              <div className="term-presets" role="group" aria-label="Mobile network">
                {NETWORKS.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    className={`term-preset${net === n.id ? " active" : ""}`}
                    onClick={() => setNet(n.id)}
                  >
                    {n.label}
                  </button>
                ))}
              </div>
            </>
          )}
          {category === "electricity" && (
            <>
              <label className="field-label">Disco</label>
              <div className="text-field block">
                <Lightbulb size={16} className="field-lead" />
                <select
                  className="field-select"
                  value={disco}
                  onChange={(e) => setDisco(e.target.value)}
                >
                  {DISCOS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
              <label className="field-label">Meter type</label>
              <div className="term-presets" role="group" aria-label="Meter type">
                {(["prepaid", "postpaid"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`term-preset${meterType === t ? " active" : ""}`}
                    onClick={() => setMeterType(t)}
                  >
                    {t === "prepaid" ? "Prepaid" : "Postpaid"}
                  </button>
                ))}
              </div>
            </>
          )}
          {category === "cable" && (
            <>
              <label className="field-label">Provider</label>
              <div className="term-presets" role="group" aria-label="Cable provider">
                {CABLE.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`term-preset${provider === c.id ? " active" : ""}`}
                    onClick={() => setProvider(c.id)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </>
          )}
          {isVerifiable && (
            <>
              <label className="field-label">
                {category === "electricity" ? "Meter number" : "Smartcard number"}
              </label>
              <div className="text-field block">
                <Hash size={16} className="field-lead" />
                <input
                  className="field-input"
                  inputMode="numeric"
                  placeholder={category === "electricity" ? "Meter number" : "IUC / smartcard"}
                  value={billersCode}
                  onChange={(e) => setBillersCode(e.target.value.replace(/\D/g, ""))}
                />
                <button
                  type="button"
                  className="field-verify"
                  onClick={onVerify}
                  disabled={!codeOk || verifying}
                >
                  {verifying ? "Checking…" : "Verify"}
                </button>
              </div>
              {verified ? (
                <span className="field-hint ok">
                  <Check size={13} /> {verified.name}
                  {verified.address ? ` · ${verified.address}` : ""}
                </span>
              ) : (
                <span className="field-hint muted">
                  Verify the {category === "electricity" ? "meter" : "smartcard"} before paying.
                </span>
              )}
            </>
          )}
          {isFixed && (
            <>
              <label className="field-label">
                {category === "data" ? "Data plan" : "Bouquet"}
              </label>
              <div className="text-field block">
                <Wifi size={16} className="field-lead" />
                <select
                  className="field-select"
                  value={variationCode}
                  onChange={(e) => setVariationCode(e.target.value)}
                  disabled={loadingVars || !variations.length}
                >
                  <option value="">
                    {loadingVars
                      ? "Loading plans…"
                      : variations.length
                        ? "Choose a plan"
                        : "No plans available"}
                  </option>
                  {variations.map((v) => (
                    <option key={v.variation_code} value={v.variation_code}>
                      {v.name} — ₦{v.amount.toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
          {!isFixed && (
            <>
              <label className="field-label">Amount</label>
              <div className="text-field block">
                <span className="field-at">₦</span>
                <input
                  className="field-input"
                  type="number"
                  min="50"
                  placeholder="500"
                  value={ngn}
                  onChange={(e) => setNgn(e.target.value)}
                />
                <span className="field-trail">NGN</span>
              </div>
              {category === "airtime" && (
                <div className="term-presets" style={{ marginTop: 8 }} role="group" aria-label="Quick amounts">
                  {NGN_CHIPS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`term-preset${ngn === c ? " active" : ""}`}
                      onClick={() => setNgn(c)}
                    >
                      ₦{Number(c).toLocaleString()}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          <label className="field-label">
            {category === "airtime" || category === "data"
              ? "Phone number"
              : "Phone (for the receipt)"}
          </label>
          <div className="text-field block">
            <Smartphone size={16} className="field-lead" />
            <input
              className="field-input"
              type="tel"
              inputMode="tel"
              placeholder="0803 000 0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          {phone.trim() && !phoneOk && (
            <span className="field-hint miss">Enter a valid 11-digit number</span>
          )}
          {quote ? (
            <>
              <span className="field-usd">
                ≈ {fmt(sats)} sats
                {btcUsd != null ? ` · ${fmtUsd(sats, btcUsd)}` : ""}
                {quoting ? " · updating…" : ""}
              </span>
              <span className={`field-hint ${over ? "miss" : quoteStale ? "warn" : "muted"}`}>
                {over
                  ? `Costs more than your balance of ${fmt(balance)} sats`
                  : quoteStale
                    ? "Couldn't refresh the price — last quote shown"
                    : `₦${quote.amountNgn.toLocaleString()} · rate ₦${Math.round(quote.rate).toLocaleString()}/BTC`}
              </span>
            </>
          ) : quoting ? (
            <span className="quote-skel" aria-hidden="true"><i /><i /></span>
          ) : (
            <span className="field-hint muted">
              {isFixed
                ? "Pick a plan to see the sBTC price"
                : Number(ngn) > 0
                  ? "Couldn't price this — try again in a moment"
                  : "Enter an amount to see the sBTC price"}
            </span>
          )}
          {!busy && isVerifiable && codeOk && !verified && quote && (
            <span className="field-hint warn" style={{ marginBottom: 10 }}>
              Verify the {category === "electricity" ? "meter" : "smartcard"} number above to unlock Pay
            </span>
          )}
          <button className="btn primary full" onClick={onPay} disabled={payDisabled}>
            {busy ? <RefreshCw size={16} className="spin" /> : <Zap size={16} />}
            {payText}
          </button>
          <span className="field-hint muted" style={{ marginTop: 10 }}>
            {busy ? (
              <>
                <RefreshCw size={13} className="spin" /> {stage || "Working…"}
              </>
            ) : (
              <>
                <Zap size={13} /> Gas covered by the Sato pool — you just approve
                the payment.
              </>
            )}
          </span>
        </section>
        <aside className="panel send-aside">
          <span className="panel-eyebrow">Order summary</span>
          <div className="sum-rows">
            <div className="sum-row">
              <span>Service</span>
              <strong>{billerLabel} · {CAT_NOUN[category]}</strong>
            </div>
            <div className="sum-row">
              <span>To</span>
              {(category === "airtime" || category === "data" ? phone.trim() : billersCode.trim()) ? (
                verified ? (
                  <strong className="ok-inline">
                    {category === "airtime" || category === "data" ? phone.trim() : billersCode.trim()} <Check size={13} />
                  </strong>
                ) : (
                  <strong>{category === "airtime" || category === "data" ? phone.trim() : billersCode.trim()}</strong>
                )
              ) : (
                <strong className="sum-empty">—</strong>
              )}
            </div>
            <div className="sum-row">
              <span>Amount</span>
              {quote ? (
                <strong>₦{quote.amountNgn.toLocaleString()} <small>· {fmt(sats)} sats</small></strong>
              ) : (
                <strong className="sum-empty">—</strong>
              )}
            </div>
            <div className="sum-row total">
              <span>You spend</span>
              {quote && !over ? (
                <strong>{fmt(sats)} <small>sats</small></strong>
              ) : (
                <strong className="sum-empty">—</strong>
              )}
            </div>
          </div>
          <div className="aside-balance">
            <span>Available</span>
            <strong>
              {fmt(balance)} <small>sats</small>
            </strong>
          </div>
        </aside>
      </div>
    </>
  );
}
