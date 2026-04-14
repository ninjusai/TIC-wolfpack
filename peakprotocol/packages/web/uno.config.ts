import { defineConfig } from "unocss";
import presetWind3 from "@unocss/preset-wind3";

export default defineConfig({
  presets: [
    presetWind3({
      dark: "class",
    }),
  ],
  theme: {
    breakpoints: {
      sm: "480px",
      md: "768px",
      lg: "1024px",
    },
  },
  shortcuts: {
    "btn": "inline-flex items-center justify-center rounded-lg px-4 py-2 font-medium transition-colors duration-200 cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-offset-2",
    "btn-primary": "btn bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 focus-visible:outline-blue-600",
    "btn-secondary": "btn bg-gray-200 text-gray-900 hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600",
    "touch-target": "min-h-[44px] min-w-[44px] flex items-center justify-center",
  },
});
