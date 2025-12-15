import { Dimensions, Platform } from "react-native";

/**
 * Responsive Design Utility
 * Provides orientation-aware sizing and spacing
 */

export const getOrientation = () => {
  const { width, height } = Dimensions.get("window");
  return width > height ? "landscape" : "portrait";
};

export const isPortrait = () => getOrientation() === "portrait";
export const isLandscape = () => getOrientation() === "landscape";

// Get responsive value based on orientation
export const responsive = <T,>(portraitValue: T, landscapeValue: T): T => {
  return isPortrait() ? portraitValue : landscapeValue;
};

// Typography scales for different orientations
// Portrait sizes are significantly reduced to prevent text overflow and excessive scrolling
export const responsiveTypography = {
  // Display sizes
  displayLarge: {
    fontSize: responsive(20, 32),
    lineHeight: responsive(26, 40),
    fontWeight: "700" as const,
  },
  displayMedium: {
    fontSize: responsive(15, 24),
    lineHeight: responsive(20, 32),
    fontWeight: "700" as const,
  },

  // Title sizes
  titleLarge: {
    fontSize: responsive(14, 20),
    lineHeight: responsive(19, 28),
    fontWeight: "600" as const,
  },
  titleMedium: {
    fontSize: responsive(13, 18),
    lineHeight: responsive(17, 24),
    fontWeight: "600" as const,
  },

  // Body sizes
  bodyLarge: {
    fontSize: responsive(13, 18),
    lineHeight: responsive(19, 28),
    fontWeight: "500" as const,
  },
  bodyMedium: {
    fontSize: responsive(12, 16),
    lineHeight: responsive(17, 24),
    fontWeight: "500" as const,
  },
  bodySmall: {
    fontSize: responsive(11, 14),
    lineHeight: responsive(16, 20),
    fontWeight: "400" as const,
  },

  // Math notation sizes
  mathLarge: {
    fontSize: responsive(10, 24),
    lineHeight: responsive(15, 36),
    fontWeight: "600" as const,
  },
  mathMedium: {
    fontSize: responsive(9.5, 20),
    lineHeight: responsive(14, 30),
    fontWeight: "600" as const,
  },
  mathSmall: {
    fontSize: responsive(9, 16),
    lineHeight: responsive(13, 24),
    fontWeight: "500" as const,
  },
};

// Spacing scales for different orientations
// Portrait spacing is significantly reduced for more compact layouts
export const responsiveSpacing = {
  xs: responsive(2, 4),
  sm: responsive(4, 8),
  md: responsive(6, 12),
  lg: responsive(8, 16),
  xl: responsive(10, 20),
  xxl: responsive(12, 24),
  xxxl: responsive(16, 32),
};

// Button/Interactive element sizing
export const responsiveElements = {
  buttonPadding: {
    vertical: responsive(10, 20),
    horizontal: responsive(12, 24),
  },
  iconButtonSize: responsive(32, 48),
  iconSize: responsive(16, 24),
  iconSizeLarge: responsive(32, 48),
  borderRadius: responsive(12, 20),
  cardPadding: responsive(10, 20),
};

// Screen padding
export const screenPadding = {
  horizontal: responsive(12, 24),
  vertical: responsive(8, 20),
};
