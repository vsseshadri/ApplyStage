import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Tab configuration
const TABS = [
  { name: 'dashboard', title: 'Dashboard', icon: 'stats-chart' },
  { name: 'my-jobs', title: 'My Jobs', icon: 'briefcase' },
  { name: 'notifications', title: 'Notifications', icon: 'notifications' },
  { name: 'analytics', title: 'Analytics', icon: 'analytics' },
  { name: 'settings', title: 'Settings', icon: 'settings' },
];

// Constants for the liquid glass design
const TAB_BAR_HORIZONTAL_PADDING = 16;
const TAB_BAR_HEIGHT = 65;
const CAPSULE_CORNER_RADIUS = 32;
const SELECTION_CAPSULE_RADIUS = 24;
const TAB_COUNT = 5;

// Calculate dimensions
const TAB_BAR_WIDTH = SCREEN_WIDTH - (TAB_BAR_HORIZONTAL_PADDING * 2);
const TAB_WIDTH = TAB_BAR_WIDTH / TAB_COUNT;

// Spring animation config matching Apple's physics
const SPRING_CONFIG = {
  damping: 18,
  stiffness: 180,
  mass: 1,
};

interface LiquidGlassTabBarProps {
  state: any;
  descriptors: any;
  navigation: any;
  notificationCount?: number;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export default function LiquidGlassTabBar({
  state,
  descriptors,
  navigation,
  notificationCount = 0,
}: LiquidGlassTabBarProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  
  // Shared values for animations
  const capsulePosition = useSharedValue(0);
  const capsuleWidth = useSharedValue(TAB_WIDTH - 16);
  const pressScale = useSharedValue(1);
  
  // Track the active tab index
  const activeIndex = state.routes.findIndex(
    (route: any) => route.name === state.routes[state.index]?.name && 
    TABS.some(tab => tab.name === route.name)
  );
  
  // Get actual tab index from our TABS array
  const getTabIndex = (routeName: string) => {
    return TABS.findIndex(tab => tab.name === routeName);
  };
  
  const currentTabIndex = getTabIndex(state.routes[state.index]?.name);

  // Animate capsule position when tab changes
  useEffect(() => {
    if (currentTabIndex >= 0) {
      // Animate capsule sliding with stretch effect
      capsuleWidth.value = withTiming(TAB_WIDTH + 8, { duration: 100 });
      capsulePosition.value = withSpring(currentTabIndex * TAB_WIDTH, SPRING_CONFIG);
      
      // Settle width back
      setTimeout(() => {
        capsuleWidth.value = withSpring(TAB_WIDTH - 16, SPRING_CONFIG);
      }, 100);
    }
  }, [currentTabIndex]);

  // Animated style for the selection capsule
  const capsuleAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: capsulePosition.value + 8 },
      ],
      width: capsuleWidth.value,
    };
  });

  // Render individual tab
  const renderTab = (route: any, index: number) => {
    const tabConfig = TABS.find(tab => tab.name === route.name);
    if (!tabConfig) return null;

    const tabIndex = getTabIndex(route.name);
    const isSelected = currentTabIndex === tabIndex;
    const { options } = descriptors[route.key];

    // Animation values for each tab
    const tabScale = useSharedValue(1);
    const iconScale = useSharedValue(isSelected ? 1.08 : 1);

    useEffect(() => {
      iconScale.value = withSpring(isSelected ? 1.08 : 1, {
        damping: 12,
        stiffness: 200,
      });
    }, [isSelected]);

    const tabAnimatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: tabScale.value }],
    }));

    const iconAnimatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: iconScale.value }],
    }));

    const handlePress = () => {
      // Micro-bounce animation
      tabScale.value = withSpring(0.92, { damping: 10, stiffness: 400 });
      setTimeout(() => {
        tabScale.value = withSpring(1, { damping: 12, stiffness: 200 });
      }, 50);

      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });

      if (!isSelected && !event.defaultPrevented) {
        navigation.navigate(route.name);
      }
    };

    const handleLongPress = () => {
      navigation.emit({
        type: 'tabLongPress',
        target: route.key,
      });
    };

    return (
      <AnimatedTouchable
        key={route.key}
        accessibilityRole="button"
        accessibilityState={isSelected ? { selected: true } : {}}
        accessibilityLabel={options.tabBarAccessibilityLabel}
        onPress={handlePress}
        onLongPress={handleLongPress}
        style={[styles.tabButton, tabAnimatedStyle]}
        activeOpacity={0.8}
      >
        <Animated.View style={[styles.iconContainer, iconAnimatedStyle]}>
          <Ionicons
            name={tabConfig.icon as any}
            size={22}
            color={isSelected ? colors.primary : (isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)')}
          />
          {/* Notification badge */}
          {tabConfig.name === 'notifications' && notificationCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {notificationCount > 99 ? '99+' : notificationCount}
              </Text>
            </View>
          )}
        </Animated.View>
        <Text
          style={[
            styles.tabLabel,
            {
              color: isSelected ? colors.primary : (isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)'),
              opacity: isSelected ? 1 : 0.7,
              fontWeight: isSelected ? '600' : '500',
            },
          ]}
        >
          {tabConfig.title}
        </Text>
      </AnimatedTouchable>
    );
  };

  // Filter routes to only show our defined tabs
  const visibleRoutes = state.routes.filter((route: any) => 
    TABS.some(tab => tab.name === route.name)
  );

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom > 0 ? insets.bottom - 8 : 12 }]}>
      {/* Outer Glass Container */}
      <View style={[styles.glassContainer, { backgroundColor: isDark ? 'rgba(30, 30, 32, 0.65)' : 'rgba(255, 255, 255, 0.7)' }]}>
        {/* Blur Background */}
        <BlurView
          intensity={isDark ? 40 : 60}
          tint={isDark ? 'dark' : 'light'}
          style={styles.blurView}
        />
        
        {/* Frosted Glass Overlay - Top highlight gradient */}
        <View style={[styles.frostOverlay, { opacity: isDark ? 0.08 : 0.15 }]} />
        
        {/* Inner subtle border */}
        <View style={[styles.innerBorder, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.5)' }]} />
        
        {/* Liquid Selection Capsule */}
        <Animated.View style={[styles.selectionCapsule, capsuleAnimatedStyle]}>
          <View style={[
            styles.capsuleInner,
            { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)' }
          ]}>
            {/* Capsule highlight */}
            <View style={[styles.capsuleHighlight, { opacity: isDark ? 0.1 : 0.3 }]} />
          </View>
        </Animated.View>
        
        {/* Tab Buttons */}
        <View style={styles.tabsContainer}>
          {visibleRoutes.map((route: any, index: number) => renderTab(route, index))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: TAB_BAR_HORIZONTAL_PADDING,
    paddingBottom: 12,
  },
  glassContainer: {
    height: TAB_BAR_HEIGHT,
    borderRadius: CAPSULE_CORNER_RADIUS,
    overflow: 'hidden',
    // Shadow for floating effect
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  blurView: {
    ...StyleSheet.absoluteFillObject,
  },
  frostOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'white',
    borderRadius: CAPSULE_CORNER_RADIUS,
  },
  innerBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: CAPSULE_CORNER_RADIUS,
    borderWidth: 0.5,
  },
  selectionCapsule: {
    position: 'absolute',
    top: 8,
    bottom: 8,
    borderRadius: SELECTION_CAPSULE_RADIUS,
    overflow: 'hidden',
  },
  capsuleInner: {
    flex: 1,
    borderRadius: SELECTION_CAPSULE_RADIUS,
    overflow: 'hidden',
  },
  capsuleHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: 'white',
    borderTopLeftRadius: SELECTION_CAPSULE_RADIUS,
    borderTopRightRadius: SELECTION_CAPSULE_RADIUS,
  },
  tabsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 4,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 2,
  },
  badge: {
    position: 'absolute',
    right: -10,
    top: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '700',
  },
});
