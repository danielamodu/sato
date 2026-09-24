// Receive: your QR + shareable pay link, and (if you haven't got one yet) a
// gasless @username claim. The QR encodes the same universal pay link the web
// client uses — ${WEB_APP}/app?to=<@handle|address> — so scanning it opens a
// prefilled Send. Names are checked for availability live before you claim.

import React from "react";
import { Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import * as Clipboard from "expo-clipboard";
import { Btn, Field, Panel, Screen, PageHead, Pill } from "@/components/ui";
import { useWallet } from "@/state/wallet-store";
import { isNameAvailable, registerName } from "@/lib/sato";
import { short } from "@/lib/format";
import { WEB_APP } from "@/config/network";
import { C, S } from "@/theme";

export default function ReceiveScreen() {
  const w = useWallet();
  const [claim, setClaim] = React.useState("");
  const [avail, setAvail] = React.useState<boolean | null>(null);
  const [checking, setChecking] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  // Live availability check for the claim field (debounced), mirroring the web.
  React.useEffect(() => {
    const name = claim.trim();
    setAvail(null);
    if (name.length < 3) return;
    let live = true;
    setChecking(true);
    const id = setTimeout(async () => {
      try {
        const ok = await isNameAvailable(name);
        if (live) setAvail(ok);
      } catch {
        if (live) setAvail(null);
      } finally {
        if (live) setChecking(false);
      }
    }, 350);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [claim]);

  const handle = w.name ? `@${w.name}` : w.address;
  const payLink = w.address ? `${WEB_APP}/app?to=${encodeURIComponent(handle)}` : "";

  const copy = async (value: string, what: string) => {
    await Clipboard.setStringAsync(value);
    w.notify(`${what} copied`, { tone: "ok" });
  };

  const onClaim = async () => {
    const name = claim.trim();
    if (!name || avail !== true) return;
    setBusy(true);
    const id = await w.submit(`Claimed @${name}`, () => registerName(name));
    setBusy(false);
    if (id) setClaim("");
  };

  const availTone = avail === true ? "ok" : avail === false ? "err" : "info";
  const availText = checking
    ? "Checking…"
    : avail === true
      ? "Available"
      : avail === false
        ? "Taken"
        : claim.trim().length > 0 && claim.trim().length < 3
          ? "3+ characters"
          : "";

  return (
    <Screen refreshing={w.loading} onRefresh={w.refresh}>
      <PageHead
        eyebrow="Receive"
        title={w.name ? handle : "Your wallet"}
        sub={
          w.name
            ? "Share your QR or link — anyone can pay you by name."
            : "Share your QR or address to get paid. Claim a @username below to be paid by name."
        }
      />

      <Panel style={{ alignItems: "center", gap: S.lg }}>
        <View style={{ padding: S.md, backgroundColor: C.white, borderRadius: 12 }}>
          {payLink ? <QRCode value={payLink} size={196} color={C.ink} backgroundColor={C.white} /> : null}
        </View>
        <View style={{ alignItems: "center", gap: 2 }}>
          <Text style={{ color: C.ink, fontSize: 18, fontWeight: "800" }}>{w.name ? handle : "Address"}</Text>
          <Text style={{ color: C.textMuted, fontSize: 13 }}>{short(w.address)}</Text>
        </View>
        <View style={{ flexDirection: "row", gap: S.sm, alignSelf: "stretch" }}>
          <View style={{ flex: 1 }}>
            <Btn label="Copy link" icon="link" variant="ghost" onPress={() => copy(payLink, "Pay link")} />
          </View>
          <View style={{ flex: 1 }}>
            <Btn label="Copy address" icon="copy" variant="ghost" onPress={() => copy(w.address, "Address")} />
          </View>
        </View>
      </Panel>

      {!w.name ? (
        <Panel>
          <Text style={{ color: C.ink, fontSize: 16, fontWeight: "800" }}>Claim a @username</Text>
          <Text style={{ color: C.textMuted, fontSize: 14, lineHeight: 20 }}>
            Free, gasless, and yours. People can then pay you at @{claim.trim() || "you"} instead
            of a long address.
          </Text>
          <Field
            label="Username"
            value={claim}
            onChangeText={(t) => setClaim(t.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
            placeholder="satoshi"
            autoCapitalize="none"
            autoCorrect={false}
            right={availText ? <Pill tone={availTone}>{availText}</Pill> : undefined}
          />
          <Btn
            label={claim.trim() ? `Claim @${claim.trim()}` : "Claim username"}
            icon="at-sign"
            loading={busy}
            disabled={busy || avail !== true}
            onPress={onClaim}
          />
        </Panel>
      ) : null}
    </Screen>
  );
}
