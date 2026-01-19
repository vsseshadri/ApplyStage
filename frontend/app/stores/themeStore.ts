import { create } from 'zustand';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeMode = 'light' | 'dark' | 'auto';

interface ThemeState {
  mode: ThemeMode;
  actualTheme: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
  initTheme: () => Promise<void>;
}

const getActualTheme = (mode: ThemeMode): 'light' | 'dark' => {
  if (mode === 'auto') {
    return Appearance.getColorScheme() || 'light';
  }
  return mode;
};

export const useThemeStore = create<ThemeState>((set) => ({
  mode: 'auto',
  actualTheme: getActualTheme('auto'),
  setMode: async (mode: ThemeMode) => {
    await AsyncStorage.setItem('theme_mode', mode);
    set({ mode, actualTheme: getActualTheme(mode) });
  },
  initTheme: async () => {
    const savedMode = await AsyncStorage.getItem('theme_mode') as ThemeMode;
    const mode = savedMode || 'auto';
    set({ mode, actualTheme: getActualTheme(mode) });

    // Listen for system theme changes
    Appearance.addChangeListener(({ colorScheme }) => {
      set((state) => ({
        actualTheme: state.mode === 'auto' ? (colorScheme || 'light') : state.actualTheme,
      }));
    });
  },
}));
