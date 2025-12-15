// Typography System
// Consistent, professional font sizes and styles

export const typography = {
  // Display sizes
  displayLarge: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: "700" as const,
  },
  displayMedium: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "700" as const,
  },

  // Title sizes
  titleLarge: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600" as const,
  },
  titleMedium: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "600" as const,
  },

  // Body sizes
  bodyLarge: {
    fontSize: 18,
    lineHeight: 28,
    fontWeight: "500" as const,
  },
  bodyMedium: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500" as const,
  },
  bodySmall: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400" as const,
  },

  // Math notation sizes
  mathLarge: {
    fontSize: 20,
    lineHeight: 30,
    fontWeight: "600" as const,
  },
  mathMedium: {
    fontSize: 17,
    lineHeight: 26,
    fontWeight: "600" as const,
  },
  mathSmall: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "500" as const,
  },
};

// Spacing System
// Consistent spacing throughout the app
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

// Color System
export const colors = {
  primary: "#6366f1", // indigo
  primaryDark: "#4f46e5",
  secondary: "#10b981", // emerald
  secondaryDark: "#059669",

  // Backgrounds
  background: "#f8fafc",
  surface: "#ffffff",
  surfaceAlt: "#f1f5f9",

  // Text
  textPrimary: "#0f172a",
  textSecondary: "#475569",
  textTertiary: "#94a3b8",

  // Borders
  border: "#e2e8f0",
  borderStrong: "#cbd5e1",

  // Highlights
  highlightRed: "#ef4444",
  highlightBlue: "#3b82f6",
  highlightGreen: "#10b981",
  highlightPurple: "#a855f7",
  highlightOrange: "#f97316",
  highlightPink: "#ec4899",
  highlightYellow: "#eab308",
  highlightTeal: "#14b8a6",
};
