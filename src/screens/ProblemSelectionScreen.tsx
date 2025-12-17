import React, { useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Dimensions, TextInput, KeyboardAvoidingView, Platform, ScrollView, Keyboard } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { RootStackParamList } from "../navigation/AppNavigator";
import { useHomeworkStore } from "../state/homeworkStore";
import * as Haptics from "expo-haptics";
import { colors } from "../utils/designSystem";
import { responsiveTypography, responsiveSpacing, responsiveElements, responsive } from "../utils/responsive";

type ProblemSelectionScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, "ProblemSelection">;
  route: RouteProp<RootStackParamList, "ProblemSelection">;
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function ProblemSelectionScreen({
  navigation,
  route,
}: ProblemSelectionScreenProps) {
  const { image } = route.params;
  const [isProcessing, setIsProcessing] = useState(false);
  const [problemNumber, setProblemNumber] = useState("");
  const setSelectedProblem = useHomeworkStore((s) => s.setSelectedProblem);

  const handleContinue = async () => {
    Keyboard.dismiss();
    setIsProcessing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Set the selected problem with the full image and problem number
    setSelectedProblem({
      imageUri: image.uri,
    });

    // Navigate to solution screen
    setTimeout(() => {
      navigation.navigate("Solution", {
        problem: {
          imageUri: image.uri,
        },
        problemNumber: problemNumber.trim() || undefined,
      });
      setIsProcessing(false);
    }, 300);
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }} edges={["top"]}>
      {/* Header */}
      <View className="bg-white px-6" style={{ paddingVertical: responsiveSpacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View className="flex-row items-center justify-between">
          <Pressable onPress={() => navigation.goBack()}>
            {({ pressed }) => (
              <View className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center" style={{ opacity: pressed ? 0.5 : 1 }}>
                <Ionicons name="arrow-back" size={responsiveElements.iconSize} color={colors.textPrimary} />
              </View>
            )}
          </Pressable>
          <Text style={{ ...responsiveTypography.displayMedium, color: colors.textPrimary }}>
            Review Photo
          </Text>
          <View style={{ width: 40 }} />
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
        keyboardVerticalOffset={0}
      >
        {/* Scrollable Content */}
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-1" style={{ paddingHorizontal: responsiveSpacing.xl, paddingTop: responsiveSpacing.lg, paddingBottom: responsiveSpacing.xl }}>
            {/* Image Preview - Smaller */}
            <View className="items-center">
              <View
                className="bg-white rounded-3xl overflow-hidden"
                style={{
                  width: SCREEN_WIDTH - 48,
                  aspectRatio: image.width / image.height,
                  maxHeight: 280, // Reduced from 400
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.1,
                  shadowRadius: 12,
                  elevation: 5,
                }}
              >
                <Image
                  source={{ uri: image.uri }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="contain"
                />
              </View>
            </View>

            {/* Problem Number Input - Compact */}
            <View style={{ marginTop: responsiveSpacing.lg }}>
              <View className="bg-white rounded-2xl border-2 border-indigo-200" style={{ padding: responsiveSpacing.md }}>
                <View className="flex-row items-center mb-2" style={{ gap: responsiveSpacing.xs }}>
                  <Ionicons name="list" size={responsiveElements.iconSize} color={colors.primary} />
                  <Text style={{ fontSize: responsiveTypography.bodyMedium.fontSize, fontWeight: '600', color: colors.primary }}>
                    Problem number (optional)
                  </Text>
                </View>
                <TextInput
                  className="bg-gray-50 rounded-xl border-2 border-gray-200"
                  style={{
                    paddingHorizontal: responsiveSpacing.md,
                    paddingVertical: responsiveSpacing.sm,
                    fontSize: responsiveTypography.bodyMedium.fontSize,
                    color: colors.textPrimary,
                  }}
                  placeholder="e.g., 11, 12, 13..."
                  placeholderTextColor={colors.textTertiary}
                  value={problemNumber}
                  onChangeText={setProblemNumber}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  onSubmitEditing={handleContinue}
                  blurOnSubmit={true}
                />
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Fixed Bottom Actions */}
        <View
          className="bg-white"
          style={{
            paddingHorizontal: responsiveSpacing.xl,
            paddingTop: responsiveSpacing.md,
            paddingBottom: responsiveSpacing.lg,
            gap: responsiveSpacing.sm,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.05,
            shadowRadius: 8,
            elevation: 5,
          }}
        >
          <Pressable onPress={handleContinue} disabled={isProcessing}>
            {({ pressed }) => (
              <View
                className="rounded-2xl"
                style={{
                  backgroundColor: colors.primary,
                  paddingVertical: responsiveSpacing.md,
                  paddingHorizontal: responsiveSpacing.lg,
                  opacity: pressed || isProcessing ? 0.8 : 1,
                }}
              >
                {isProcessing ? (
                  <View className="flex-row items-center justify-center" style={{ gap: responsiveSpacing.sm }}>
                    <ActivityIndicator size="small" color="white" />
                    <Text style={{ fontSize: responsiveTypography.titleMedium.fontSize, fontWeight: '600', color: "#ffffff" }}>
                      Analyzing...
                    </Text>
                  </View>
                ) : (
                  <View className="flex-row items-center justify-center" style={{ gap: responsiveSpacing.sm }}>
                    <Ionicons name="sparkles" size={responsiveElements.iconSize} color="white" />
                    <Text style={{ fontSize: responsiveTypography.titleMedium.fontSize, fontWeight: '600', color: "#ffffff" }}>
                      Solve
                    </Text>
                  </View>
                )}
              </View>
            )}
          </Pressable>

          <Pressable onPress={() => navigation.goBack()}>
            {({ pressed }) => (
              <View
                className="bg-white border-2 rounded-2xl"
                style={{
                  borderColor: colors.border,
                  paddingVertical: responsiveSpacing.md,
                  paddingHorizontal: responsiveSpacing.lg,
                  opacity: pressed ? 0.7 : 1,
                }}
              >
                <Text style={{ fontSize: responsiveTypography.titleMedium.fontSize, fontWeight: '600', color: colors.textSecondary, textAlign: "center" }}>
                  Retake Photo
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
