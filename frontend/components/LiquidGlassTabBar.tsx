import React, { useEffect, useCallback, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Tab Configuration ───────────────────────────────────────
const TABS = [
  { name: 'dashboard', title: 'Dashboard', icon: 'stats-chart', iconOutline: 'stats-chart-outline' },
  { name: 'my-jobs', title: 'My Jobs', icon: 'briefcase', iconOutline: 'briefcase-outline' },
  { name: 'notifications', title: 'Alerts', icon: 'notifications', iconOutline: 'notifications-outline' },
  { name: 'analytics', title: 'Analytics', icon: 'analytics', iconOutline: 'analytics-outline' },
  { name: 'settings', title: 'Settings', icon: 'settings', iconOutline: 'settings-outline' },
];

// ─── Design Constants ────────────────────────────────────────
const TAB_BAR_HORIZONTAL_MARGIN = 12;
const TAB_BAR_HEIGHT = 60;
const OUTER_RADIUS = 30;
const INNER_CAPSULE_RADIUS = 20;
const TAB_COUNT = TABS.length;
const TAB_BAR_INNER_WIDTH = SCREEN_WIDTH - TAB_BAR_HORIZONTAL_MARGIN * 2;
const TAB_WIDTH = TAB_BAR_INNER_WIDTH / TAB_COUNT;
const CAPSULE_H_INSET = 5;
const CAPSULE_V_INSET = 6;

// ─── Spring Configs (Apple-style physics) ────────────────────
const SLIDE_SPRING = {
  damping: 20,
  stiffness: 200,
  mass: 0.8,
  overshootClamping: false,
  restDisplacementThreshold: 0.01,
  restSpeedThreshold: 0.01,
};

const BOUNCE_SPRING = {
  damping: 12,
  stiffness: 350,
  mass: 0.5,
};

const ICON_SPRING = {
  damping: 14,
  stiffness: 220,
  mass: 0.6,
};

// ─── Individual Tab Item (proper hook usage) ─────────────────
interface TabItemProps {
  tab: typeof TABS[number];
  index: number;
  isSelected: boolean;
  notificationCount: number;
  onPress: () => void;
  onLongPress: () => void;
  isDark: boolean;
  primaryColor: string;
}

const TabItem = memo(function TabItem({
  tab,
  index,
  isSelected,
  notificationCount,
  onPress,
  onLongPress,
  isDark,
  primaryColor,
}: TabItemProps) {
  const scale = useSharedValue(1);
  const iconScale = useSharedValue(isSelected ? 1 : 0.92);

  useEffect(() => {
    iconScale.value = withSpring(isSelected ? 1 : 0.92, ICON_SPRING);
  }, [isSelected]);

  const handlePress = useCallback(() => {
    scale.value = withSequence(
      withTiming(0.9, { duration: 60 }),
      withSpring(1, BOUNCE_SPRING),
    );
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  }, [onPress]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const iconContainerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  const selectedColor = primaryColor;
  const unselectedColor = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(60,60,67,0.5)';
  const iconColor = isSelected ? selectedColor : unselectedColor;
  const labelColor = isSelected ? selectedColor : unselectedColor;
  const iconName = isSelected ? tab.icon : tab.iconOutline;
  const showBadge = tab.name === 'notifications' && notificationCount > 0;

  return (
    <Animated.View style={[styles.tabTouchArea, containerStyle]}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={isSelected ? { selected: true } : {}}
        accessibilityLabel={tab.title}
        onPress={handlePress}
        onLongPress={onLongPress}
        activeOpacity={1}
        style={styles.tabTouchInner}
      >
        <Animated.View style={[styles.iconWrap, iconContainerStyle]}>
          <Ionicons
            name={iconName as any}
            size={22}
            color={iconColor}
          />
          {showBadge && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {notificationCount > 99 ? '99+' : String(notificationCount)}
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Labels always visible */}
        <Text
          style={[
            styles.tabLabel,
            {
              color: labelColor,
              fontWeight: isSelected ? '600' : '500',
            },
          ]}
          numberOfLines={1}
        >
          {tab.title}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
});

// ─── Main Liquid Glass Tab Bar ───────────────────────────────
interface LiquidGlassTabBarProps {
  state: any;
  descriptors: any;
  navigation: any;
  notificationCount?: number;
}

export default function LiquidGlassTabBar({
  state,
  descriptors,
  navigation,
  notificationCount = 0,
}: LiquidGlassTabBarProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const capsuleX = useSharedValue(0);
  const capsuleScaleX = useSharedValue(1);

  const currentTabIndex = (() => {
    const activeRouteName = state.routes[state.index]?.name;
    return TABS.findIndex((t) => t.name === activeRouteName);
  })();

  useEffect(() => {
    if (currentTabIndex < 0) return;
    const targetX = currentTabIndex * TAB_WIDTH + CAPSULE_H_INSET;
    capsuleScaleX.value = withSequence(
      withTiming(1.1, { duration: 80, easing: Easing.out(Easing.quad) }),
      withSpring(1, SLIDE_SPRING),
    );
    capsuleX.value = withSpring(targetX, SLIDE_SPRING);
  }, [currentTabIndex]);

  const capsuleStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: capsuleX.value },
      { scaleX: capsuleScaleX.value },
    ],
  }));

  const visibleRoutes = state.routes.filter((route: any) =>
    TABS.some((t) => t.name === route.name),
  );

  const bottomPadding = insets.bottom > 0 ? Math.max(insets.bottom - 20, 4) : 4;

  // Glass colors
  const glassBackground = isDark
    ? 'rgba(28, 28, 30, 0.75)'
    : 'rgba(248, 248, 250, 0.85)';

  const glassBorder = isDark
    ? 'rgba(255, 255, 255, 0.1)'
    : 'rgba(0, 0, 0, 0.08)';

  const capsuleBackground = isDark
    ? 'rgba(255, 255, 255, 0.12)'
    : 'rgba(0, 0, 0, 0.06)';

  const capsuleHighlightColor = isDark
    ? 'rgba(255, 255, 255, 0.06)'
    : 'rgba(255, 255, 255, 0.8)';

  const topBorderColor = isDark
    ? 'rgba(255, 255, 255, 0.08)'
    : 'rgba(0, 0, 0, 0.06)';

  return (
    <View
      style={[
        styles.wrapper,
        {
          paddingBottom: bottomPadding,
          backgroundColor: isDark ? 'rgba(0, 0, 0, 0.9)' : 'rgba(242, 242, 247, 0.95)',
          borderTopColor: topBorderColor,
        },
      ]}
    >
      {/* Glass bar container */}
      <View style={[styles.barContainer]}>
        <View
          style={[
            styles.glassOuter,
            {
              backgroundColor: glassBackground,
              borderColor: glassBorder,
            },
          ]}
        >
          {/* Blur layer */}
          {Platform.OS !== 'web' ? (
            <BlurView
              intensity={isDark ? 40 : 60}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: isDark
                    ? 'rgba(28, 28, 30, 0.92)'
                    : 'rgba(248, 248, 250, 0.92)',
                } as any,
              ]}
            />
          )}

          {/* Sliding selection capsule */}
          <Animated.View
            style={[
              styles.capsule,
              {
                width: TAB_WIDTH - CAPSULE_H_INSET * 2,
                top: CAPSULE_V_INSET,
                bottom: CAPSULE_V_INSET,
              },
              capsuleStyle,
            ]}
          >
            <View
              style={[
                styles.capsuleBody,
                { backgroundColor: capsuleBackground },
              ]}
            >
              <View
                style={[
                  styles.capsuleHighlight,
                  { backgroundColor: capsuleHighlightColor },
                ]}
              />
            </View>
          </Animated.View>

          {/* Tab buttons */}
          <View style={styles.tabRow}>
            {visibleRoutes.map((route: any, idx: number) => {
              const tabConfig = TABS.find((t) => t.name === route.name);
              if (!tabConfig) return null;

              const tabIndex = TABS.findIndex((t) => t.name === route.name);
              const isSelected = tabIndex === currentTabIndex;

              return (
                <TabItem
                  key={route.key}
                  tab={tabConfig}
                  index={tabIndex}
                  isSelected={isSelected}
                  notificationCount={notificationCount}
                  isDark={isDark}
                  primaryColor={colors.primary}
                  onPress={() => {
                    const event = navigation.emit({
                      type: 'tabPress',
                      target: route.key,
                      canPreventDefault: true,
                    });
                    if (!isSelected && !event.defaultPrevented) {
                      navigation.navigate(route.name);
                    }
                  }}
                  onLongPress={() => {
                    navigation.emit({
                      type: 'tabLongPress',
                      target: route.key,
                    });
                  }}
                />
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Static wrapper - NOT absolute, sits in layout flow
  wrapper: {
    borderTopWidth: 0.5,
  },

  barContainer: {
    paddingHorizontal: TAB_BAR_HORIZONTAL_MARGIN,
    paddingTop: 4,
  },

  glassOuter: {
    height: TAB_BAR_HEIGHT,
    borderRadius: OUTER_RADIUS,
    overflow: 'hidden',
    borderWidth: Platform.OS === 'ios' ? 0.5 : 0,
  },

  capsule: {
    position: 'absolute',
    borderRadius: INNER_CAPSULE_RADIUS,
    overflow: 'hidden',
    zIndex: 0,
  },

  capsuleBody: {
    flex: 1,
    borderRadius: INNER_CAPSULE_RADIUS,
    overflow: 'hidden',
  },

  capsuleHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '45%',
    borderTopLeftRadius: INNER_CAPSULE_RADIUS,
    borderTopRightRadius: INNER_CAPSULE_RADIUS,
  },

  tabRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1,
  },

  tabTouchArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  tabTouchInner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    width: '100%',
    minHeight: 48,
  },

  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 26,
  },

  tabLabel: {
    fontSize: 10,
    marginTop: 2,
    letterSpacing: 0.1,
  },

  badge: {
    position: 'absolute',
    right: -9,
    top: -5,
    minWidth: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.1)',
  },

  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    textAlign: 'center',
  },
});
