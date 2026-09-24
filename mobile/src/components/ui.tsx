// Shared UI primitives, tuned to Sato's brand: ink/paper first, orange only on
// small accents (button-less links, tip bullets, a single stat highlight). RN
// analogues of the web client's panels, buttons, fields, stat tiles and pills.

import React from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { C, R, S } from "@/theme";

type IconName = React.ComponentProps<typeof Feather>["name"];

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <Text style={styles.eyebrow}>{children}</Text>;
}

export function PageHead({ eyebrow, title, sub }: { eyebrow?: string; title: string; sub?: string }) {
  return (
    <View style={styles.head}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <Text style={styles.title}>{title}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </View>
  );
}

export function Panel({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

export function Screen({
  children,
  refreshing,
  onRefresh,
}: {
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + S.md, paddingBottom: S.xxl + 96 },
      ]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={C.ink} />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

export function Btn({
  label,
  onPress,
  variant = "primary",
  disabled,
  loading,
  icon,
}: {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
}) {
  const onDark = variant === "primary" || variant === "danger";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        variant === "primary" && styles.btnPrimary,
        variant === "ghost" && styles.btnGhost,
        variant === "danger" && styles.btnDanger,
        (disabled || loading) && styles.btnDisabled,
        pressed && !disabled && !loading && { opacity: 0.85 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={onDark ? C.white : C.ink} />
      ) : (
        <>
          {icon ? <Feather name={icon} size={16} color={onDark ? C.white : C.ink} /> : null}
          <Text style={[styles.btnText, !onDark && { color: C.ink }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

type FieldProps = TextInputProps & { label?: string; hint?: string; right?: React.ReactNode };

export function Field({ label, hint, right, style, ...input }: FieldProps) {
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <View style={styles.inputRow}>
        <TextInput placeholderTextColor={C.muted} style={[styles.input, style]} {...input} />
        {right}
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function StatTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={[styles.tileValue, accent && { color: C.orange }]} numberOfLines={1}>
        {value}
      </Text>
      {sub ? <Text style={styles.tileSub}>{sub}</Text> : null}
    </View>
  );
}

export type Tone = "ok" | "err" | "warn" | "pending" | "info";

export function Pill({ tone = "info", children }: { tone?: Tone; children: React.ReactNode }) {
  const map: Record<Tone, [string, string]> = {
    ok: [C.okBg, C.ok],
    err: [C.missBg, C.miss],
    warn: [C.warnBg, C.warn],
    pending: [C.pendingBg, C.pending],
    info: [C.hairline, C.textMuted],
  };
  const [bg, fg] = map[tone];
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color: fg }]}>{children}</Text>
    </View>
  );
}

export function Tips({ items, title }: { items: string[]; title?: string }) {
  return (
    <View style={styles.tips}>
      {title ? <Text style={styles.tipsTitle}>{title}</Text> : null}
      {items.map((t, i) => (
        <View key={i} style={styles.tipRow}>
          <View style={styles.tipBullet} />
          <Text style={styles.tipText}>{t}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.paper },
  content: { paddingHorizontal: S.lg, gap: S.lg },

  head: { gap: S.xs },
  eyebrow: {
    color: C.orange, fontSize: 12, fontWeight: "800",
    letterSpacing: 1.5, textTransform: "uppercase",
  },
  title: { color: C.ink, fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  sub: { color: C.textMuted, fontSize: 14, lineHeight: 20 },

  panel: {
    backgroundColor: C.white,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.line,
    padding: S.lg,
    gap: S.md,
  },

  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: S.sm,
    height: 50,
    borderRadius: R.md,
    paddingHorizontal: S.lg,
  },
  btnPrimary: { backgroundColor: C.ink },
  btnGhost: { backgroundColor: C.white, borderWidth: 1, borderColor: C.line },
  btnDanger: { backgroundColor: C.miss },
  btnDisabled: { opacity: 0.45 },
  btnText: { color: C.white, fontSize: 15, fontWeight: "700" },

  field: { gap: S.xs },
  fieldLabel: { color: C.textMuted, fontSize: 13, fontWeight: "600" },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: S.sm,
    backgroundColor: C.paper,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.line,
    paddingHorizontal: S.md,
  },
  input: { flex: 1, color: C.ink, fontSize: 16, paddingVertical: S.md },
  hint: { color: C.muted, fontSize: 12 },
  tile: {
    flex: 1,
    minWidth: 140,
    backgroundColor: C.white,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.line,
    padding: S.md,
    gap: 2,
  },
  tileLabel: {
    color: C.textMuted, fontSize: 11, fontWeight: "700",
    letterSpacing: 0.6, textTransform: "uppercase",
  },
  tileValue: { color: C.ink, fontSize: 20, fontWeight: "800", letterSpacing: -0.4 },
  tileSub: { color: C.muted, fontSize: 12 },

  pill: {
    alignSelf: "flex-start",
    paddingVertical: 3,
    paddingHorizontal: S.sm,
    borderRadius: R.pill,
  },
  pillText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.4, textTransform: "uppercase" },

  tips: {
    backgroundColor: C.white,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.line,
    padding: S.md,
    gap: S.sm,
  },
  tipsTitle: {
    color: C.textMuted, fontSize: 11, fontWeight: "700",
    letterSpacing: 0.6, textTransform: "uppercase",
  },
  tipRow: { flexDirection: "row", alignItems: "flex-start", gap: S.sm },
  tipBullet: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: C.orange, marginTop: 6,
  },
  tipText: { flex: 1, color: C.ink, fontSize: 13, lineHeight: 19 },
});
