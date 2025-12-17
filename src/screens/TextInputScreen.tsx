import React, { useState } from "react";
import { View, Text, Pressable, TextInput, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/AppNavigator";
import * as Haptics from "expo-haptics";
import { responsiveTypography, responsiveSpacing, responsiveElements } from "../utils/responsive";

type TextInputScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, "TextInput">;
};

export default function TextInputScreen({ navigation }: TextInputScreenProps) {
  const [question, setQuestion] = useState("");

  const iconSize = responsiveElements.iconSize;
  const borderRadius = responsiveElements.borderRadius;
  const cardPadding = responsiveElements.cardPadding;

  const handleSubmit = () => {
    if (question.trim()) {
      Keyboard.dismiss();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Navigate directly to solution with text question
      navigation.navigate("Solution", {
        problem: { imageUri: "" },
        textQuestion: question.trim(),
      });
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1"
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <SafeAreaView className="flex-1 bg-indigo-50" edges={["top"]}>
          {/* Header */}
          <View
            className="bg-white border-b border-gray-100"
            style={{
              paddingHorizontal: responsiveSpacing.xl,
              paddingVertical: responsiveSpacing.lg
            }}
          >
            <View className="flex-row items-center justify-between">
              <Pressable onPress={() => navigation.goBack()}>
                {({ pressed }) => (
                  <View
                    className="rounded-full bg-gray-100 items-center justify-center"
                    style={{
                      width: responsiveElements.iconButtonSize,
                      height: responsiveElements.iconButtonSize,
                      opacity: pressed ? 0.5 : 1
                    }}
                  >
                    <Ionicons name="arrow-back" size={iconSize} color="#1f2937" />
                  </View>
                )}
              </Pressable>
              <Text
                className="font-bold text-gray-900"
                style={{ fontSize: responsiveTypography.titleLarge.fontSize }}
              >
                Type Your Question
              </Text>
              <View style={{ width: responsiveElements.iconButtonSize }} />
            </View>
          </View>

          {/* Content */}
          <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }}>
            <View
              className="flex-1"
              style={{ padding: responsiveSpacing.xl }}
            >

              {/* Text Input */}
              <View className="flex-1">
                <TextInput
                  className="bg-white text-gray-900"
                  style={{
                    borderRadius: borderRadius + 4,
                    padding: cardPadding,
                    fontSize: responsiveTypography.bodyMedium.fontSize,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.06,
                    shadowRadius: 6,
                    elevation: 2,
                    minHeight: 160,
                    textAlignVertical: "top",
                    fontWeight: "500",
                  }}
                  placeholder="Type or paste your question below..."
                  placeholderTextColor="#9ca3af"
                  value={question}
                  onChangeText={setQuestion}
                  multiline
                  returnKeyType="default"
                  autoFocus
                />
              </View>
            </View>
          </ScrollView>

          {/* Bottom Submit Button */}
          <View
            className="bg-white"
            style={{
              paddingHorizontal: responsiveSpacing.xl,
              paddingVertical: responsiveSpacing.lg,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: -3 },
              shadowOpacity: 0.08,
              shadowRadius: 10,
              elevation: 8,
            }}
          >
            <Pressable
              onPress={handleSubmit}
              disabled={!question.trim()}
            >
              {({ pressed }) => (
                <View
                  style={{
                    borderRadius: borderRadius,
                    paddingVertical: responsiveSpacing.lg,
                    paddingHorizontal: responsiveSpacing.xl,
                    backgroundColor: question.trim() ? "#6366f1" : "#d1d5db",
                    opacity: pressed ? 0.8 : 1
                  }}
                >
                  <View
                    className="flex-row items-center justify-center"
                    style={{ gap: responsiveSpacing.md }}
                  >
                    <Ionicons name="sparkles" size={iconSize} color="white" />
                    <Text
                      className="text-white font-bold"
                      style={{ fontSize: responsiveTypography.titleMedium.fontSize }}
                    >
                      Solve
                    </Text>
                  </View>
                </View>
              )}
            </Pressable>
          </View>
        </SafeAreaView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}
