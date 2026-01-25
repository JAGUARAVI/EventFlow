import { heroui } from "@heroui/react";

export default heroui({
    themes: {
        "sunset-dark": { // Renamed from "sunset"
             extend: "dark",
             colors: {
                background: "#0D1164", // Deep Blue Background
                foreground: "#ffffff",
                primary: {
                    50: "#ffe2ec",
                    100: "#ffb3c5",
                    200: "#fc839f",
                    300: "#f95278",
                    400: "#ea2264", // Hot Pink
                    500: "#d01155",
                    600: "#a30640",
                    700: "#75002d",
                    800: "#49001b",
                    900: "#20000a",
                    DEFAULT: "#ea2264",
                    foreground: "#ffffff",
                },
                secondary: {
                    50: "#fce9f7",
                    100: "#f7bde7",
                    200: "#f090d5",
                    300: "#e963c3",
                    400: "#640D5F", // Deep Purple
                    500: "#a03d7c",
                    600: "#7d2b5f",
                    700: "#5a1b43",
                    800: "#380d28",
                    900: "#18000e",
                    DEFAULT: "#640D5F",
                    foreground: "#ffffff",
                },
                warning: {
                    50: "#fff0e6",
                    100: "#ffd1b3",
                    200: "#ffb380",
                    300: "#ff944d",
                    400: "#F78D60", // Orange
                    500: "#e66a3d",
                    600: "#b34d2b",
                    700: "#80331a",
                    800: "#4d1d0d",
                    900: "#1a0800",
                    DEFAULT: "#F78D60",
                    foreground: "#000000",
                },
                focus: "#F78D60",
             },
             layout: {
                radius: {
                  small: "6px",
                  medium: "10px",
                  large: "14px",
                },
             }
        },
        "sunset-light": {
            extend: "light",
            colors: {
                background: "#fff0f5", // Light Pinkish White
                foreground: "#0D1164", // Deep Blue Text
                primary: {
                    50: "#ffe2ec",
                    100: "#ffb3c5",
                    200: "#fc839f",
                    300: "#f95278",
                    400: "#ea2264",
                    500: "#d01155",
                    600: "#a30640",
                    700: "#75002d",
                    800: "#49001b",
                    900: "#20000a",
                    DEFAULT: "#ea2264",
                    foreground: "#ffffff",
                },
                secondary: {
                    // Using Deep Blue as secondary in light mode for contrast
                    50: "#eef2ff",
                    100: "#e0e7ff",
                    200: "#c7d2fe",
                    300: "#a5b4fc",
                    400: "#818cf8",
                    500: "#6366f1",
                    600: "#4f46e5",
                    700: "#4338ca",
                    800: "#3730a3",
                    900: "#0D1164",
                    DEFAULT: "#0D1164",
                    foreground: "#ffffff",
                },
                warning: {
                    50: "#fff8ed",
                    100: "#ffedc2",
                    200: "#ffdb94",
                    300: "#ffc966",
                    400: "#F78D60",
                    500: "#db6b3d",
                    600: "#b04b24",
                    700: "#853115",
                    800: "#5c1e0a",
                    900: "#360d00",
                    DEFAULT: "#F78D60",
                    foreground: "#ffffff",
                }
            }
        },
    },
});
