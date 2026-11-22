// Account (modal): your address, your recovery phrase (revealed once, behind a
// device-auth gate), and the destructive "remove wallet" action. This is the
// self-custody surface the README calls out — embedded means the key lives on
// this device, so backup and wipe both matter.

import React from "react";
import { Alert, Linking, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as LocalAuthentication from "expo-local-authentication";
import { Btn, Panel, Screen, PageHead, Tips } from "@/components/ui";
import { useWallet } from "@/state/wallet-store";
import { importWallet, revealMnemonic, wipeWallet } from "@/lib/wallet";
import { explorerAddr } from "@/lib/format";
import { C, R, S } from "@/theme";

// Biometric/PIN gate before showing the seed. Fails closed if authentication
// fails or errors; if no device lock is enrolled at all, asks for an explicit
// confirmation rather than silently revealing the key.
async function authGate(): Promise<boolean> {
  try {
    const hw = await LocalAuthentication.hasHardwareAsync();
    const enrolled = hw && (await LocalAuthentication.isEnrolledAsync());
    if (enrolled) {
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock to reveal your recovery phrase",
        disableDeviceFallback: false,
      });
      return res.success;
    }
  } catch {
    return false;
  }

  return new Promise((resolve) => {
    Alert.alert(
      "No device lock detected",
      "Anyone looking at your screen can read your recovery phrase. Reveal it anyway?",
      [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        { text: "Reveal", style: "destructive", onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

export default function AccountScreen() {
  const w = useWallet();
  const [phrase, setPhrase] = React.useState<string | null>(null);
  const [restoreInput, setRestoreInput] = React.useState("");
  const [restoring, setRestoring] = React.useState(false);

  const onReveal = async () => {
    if (!(await authGate())) return;
    setPhrase(await revealMnemonic());
  };

  const onRestore = () => {
    const normalized = restoreInput.trim().toLowerCase().replace(/\s+/g, " ");
    const wordCount = normalized ? normalized.split(" ").length : 0;
    if (wordCount !== 12 && wordCount !== 24) {
      w.notify("Enter a valid 12- or 24-word recovery phrase", { tone: "err" });
      return;
    }
    Alert.alert(
      "Replace current wallet?",
      "Importing a recovery phrase replaces the current key on this device. Make sure you've backed up your existing phrase first.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restore",
          style: "destructive",
          onPress: async () => {
            setRestoring(true);
            try {
              await importWallet(normalized);
              setRestoreInput("");
              setPhrase(null);
              await w.reload();
              w.notify("Wallet restored from recovery phrase", { tone: "ok" });
              router.back();
            } catch (e: any) {
              w.notify(e?.message || "Invalid recovery phrase", { tone: "err" });
            } finally {
              setRestoring(false);
            }
          },
        },
      ],
    );
  };

  const onRemove = () => {
    Alert.alert(
      "Remove wallet?",
      "This deletes the key from this device. Without your 12-word backup it is gone — any funds become unrecoverable.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            await wipeWallet();
            await w.reload();
            w.notify("Wallet removed. A fresh one was created.", { tone: "info" });
            router.back();
          },
        },
      ],
    );
  };

  const words = phrase ? phrase.trim().split(/\s+/) : [];

  return (
    <Screen>
      <PageHead
        eyebrow="Account"
        title={w.name ? `@${w.name}` : "Your wallet"}
        sub="This key lives only on this device. Back it up before holding real value."
      />

      <Panel>
        <Text style={styles.rowLabel}>Address</Text>
        <Text style={styles.addr}>{w.address || "—"}</Text>
        <View style={{ flexDirection: "row", gap: S.sm }}>
          <View style={{ flex: 1 }}>
            <Btn
              label="Copy"
              icon="copy"
              variant="ghost"
              onPress={async () => {
                await Clipboard.setStringAsync(w.address);
                w.notify("Address copied", { tone: "ok" });
              }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Btn
              label="Explorer"
              icon="external-link"
              variant="ghost"
              onPress={() => void Linking.openURL(explorerAddr(w.address))}
            />
          </View>
        </View>
      </Panel>

      <Panel>
        <Text style={{ color: C.ink, fontSize: 16, fontWeight: "800" }}>Recovery phrase</Text>
        <Text style={{ color: C.textMuted, fontSize: 14, lineHeight: 20 }}>
          Your 12 words are the only way to restore this wallet. Write them down and
          keep them offline — never share them.
        </Text>
        {phrase ? (
          <>
            <View style={styles.grid}>
              {words.map((word, i) => (
                <View key={i} style={styles.chip}>
                  <Text style={styles.chipNum}>{i + 1}</Text>
                  <Text style={styles.chipWord}>{word}</Text>
                </View>
              ))}
            </View>
            <Btn label="Hide" icon="eye-off" variant="ghost" onPress={() => setPhrase(null)} />
          </>
        ) : (
          <Btn label="Reveal recovery phrase" icon="eye" onPress={onReveal} />
        )}
      </Panel>

      <Panel>
        <Text style={{ color: C.ink, fontSize: 16, fontWeight: "800" }}>Restore wallet</Text>
        <Text style={{ color: C.textMuted, fontSize: 14, lineHeight: 20 }}>
          Import an existing 12- or 24-word recovery phrase to replace the wallet on
          this device.
        </Text>
        <TextInput
          value={restoreInput}
          onChangeText={setRestoreInput}
          placeholder="word1 word2 word3 …"
          placeholderTextColor={C.muted}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.restoreInput}
        />
        <Btn
          label="Restore from phrase"
          icon="refresh-cw"
          variant="ghost"
          loading={restoring}
          disabled={!restoreInput.trim() || restoring}
          onPress={onRestore}
        />
      </Panel>

      <Tips
        items={[
          "Sato is testnet-only for now. The faucet mints test sBTC with no real value.",
          "Biometric or device-PIN unlock guards your recovery phrase.",
        ]}
      />

      <Panel style={{ borderColor: C.missBg }}>
        <Text style={{ color: C.miss, fontSize: 16, fontWeight: "800" }}>Danger zone</Text>
        <Text style={{ color: C.textMuted, fontSize: 14, lineHeight: 20 }}>
          Remove this wallet from the device. Make sure you've backed up your phrase first.
        </Text>
        <Btn label="Remove wallet" icon="trash-2" variant="danger" onPress={onRemove} />
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowLabel: {
    color: C.textMuted, fontSize: 11, fontWeight: "700",
    letterSpacing: 0.6, textTransform: "uppercase",
  },
  addr: { color: C.ink, fontSize: 14, fontWeight: "600" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: S.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    width: "47%",
    backgroundColor: C.paper,
    borderRadius: R.sm,
    borderWidth: 1,
    borderColor: C.line,
    paddingVertical: S.sm,
    paddingHorizontal: S.md,
  },
  chipNum: { color: C.muted, fontSize: 12, fontWeight: "700", width: 18 },
  chipWord: { color: C.ink, fontSize: 15, fontWeight: "700" },
  restoreInput: {
    backgroundColor: C.paper,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.line,
    color: C.ink,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 76,
    padding: S.md,
    textAlignVertical: "top",
  },
});
