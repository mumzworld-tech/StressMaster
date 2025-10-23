import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ThemeState {
  isDark: boolean;

  // Actions
  toggleDarkMode: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      isDark: false,

      toggleDarkMode: () => {
        set((state) => ({ isDark: !state.isDark }));
        const root = document.documentElement;
        root.classList.toggle("dark");
      },
    }),
    {
      name: "stressmaster-theme-storage",
      partialize: (state) => ({
        isDark: state.isDark,
      }),
    }
  )
);
