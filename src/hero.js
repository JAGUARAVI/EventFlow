// hero.ts
import { heroui } from "@heroui/react";

export default heroui({
  themes: {
    dark: {
      colors: {
        background: "#0a0a0a", // Slightly lighter than #000000
        content1: "#171717", // Dark gray for cards
        content2: "#262626", // Lighter gray for secondary content
        content3: "#404040",
        content4: "#525252",
        
        default: {
          50: "#171717",
          100: "#262626",
          200: "#404040",
          300: "#525252",
          400: "#737373",
          500: "#a3a3a3",
          600: "#d4d4d4",
          700: "#e5e5e5",
          800: "#f5f5f5",
          900: "#fafafa",
          DEFAULT: "#525252",
        },
      },
      layout: {
        dividerWeight: "1px",
        disabledOpacity: 0.3,
        radius: {
          small: "8px",
          medium: "12px",
          large: "14px",
        },
        borderWidth: {
          small: "1px",
          medium: "2px",
          large: "3px",
        },
      },
    },
  },
});