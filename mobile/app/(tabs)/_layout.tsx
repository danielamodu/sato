// Bottom-tab shell for the six-view wallet (Home, Send, Receive, Earn, Gas,
// Activity). Custom tab bar so the active tab reads as Sato-brand: an ink icon
// with a small orange dot under it, muted when inactive. The header carries the
// wordmark + testnet badge on the left and an account button on the right.

import React from "react";
import { Tabs, router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { C, R, S } from "@/theme";

type IconName = React.ComponentProps<typeof Feather>["name"];

const TABS: { name: string; icon: IconName }[] = [
  { name: "index", icon: "home" },
  { name: "send", icon: "arrow-up-right" },
  { name: "receive", icon: "download" },
  { name: "earn", icon: "trending-up" },
  { name: "gas", icon: "zap" },
  { name: "activity", icon: "list" },
];

function Wordmark() {
  return (
    <View style={styles.brand}>
      <Text style={styles.word}>Sato</Text>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>TESTNET</Text>
      </View>
    </View>
  );
}

function HeaderRight() {
  return (
    <Pressable
      onPress={() => router.push("/account")}
      hitSlop={10}
      style={({ pressed }) => [styles.acct, pressed && { opacity: 0.7 }]}
    >
      <Feather name="user" size={18} color={C.ink} />
    </Pressable>
  );
}

function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: (insets.bottom || S.sm) + S.xs }]}>
      {state.routes.map((route, i) => {
        const focused = state.index === i;
        const tab = TABS.find((t) => t.name === route.name);
        if (!tab) return null;
        return (
          <Pressable
            key={route.key}
            style={styles.tab}
            hitSlop={6}
            onPress={() => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            }}
          >
            <Feather name={tab.icon} size={22} color={focused ? C.ink : C.muted} />
            <View style={[styles.dot, !focused && { opacity: 0 }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: C.paper },
        headerShadowVisible: false,
        headerTitleAlign: "left",
        headerTitle: () => <Wordmark />,
        headerRight: () => <HeaderRight />,
        headerRightContainerStyle: { paddingRight: S.lg },
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="send" />
      <Tabs.Screen name="receive" />
      <Tabs.Screen name="earn" />
      <Tabs.Screen name="gas" />
      <Tabs.Screen name="activity" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: "row", alignItems: "center", gap: S.sm },
  word: { color: C.ink, fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },
  badge: {
    backgroundColor: C.badgeBg,
    borderRadius: R.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: { color: C.badgeText, fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  acct: {
    width: 36,
    height: 36,
    borderRadius: R.pill,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: "center",
    justifyContent: "center",
  },
  bar: {
    flexDirection: "row",
    backgroundColor: C.white,
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingTop: S.sm,
    paddingHorizontal: S.sm,
  },
  tab: { flex: 1, alignItems: "center", gap: 5, paddingVertical: 2 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.orange },
});
