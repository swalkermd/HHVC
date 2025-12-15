import React from "react";
import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/AppNavigator";
import * as ImagePicker from "expo-image-picker";
import { useHomeworkStore } from "../state/homeworkStore";
import { responsiveTypography, responsiveSpacing, responsiveElements } from "../utils/responsive";

type HomeScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Home">;
};

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const setCurrentImage = useHomeworkStore((s) => s.setCurrentImage);
  const reset = useHomeworkStore((s) => s.reset);

  React.useEffect(() => {
    // Reset state when returning to home
    reset();
  }, [reset]);

  const handleTakePhoto = () => {
    navigation.navigate("Camera");
  };

  const handleTypeQuestion = () => {
    navigation.navigate("TextInput");
  };

  const handleChooseFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled && result.assets[0]) {
      const image = result.assets[0];
      setCurrentImage({
        uri: image.uri,
        width: image.width,
        height: image.height,
      });
      navigation.navigate("ProblemSelection", {
        image: {
          uri: image.uri,
          width: image.width,
          height: image.height,
        },
      });
    }
  };

  const iconSize = responsiveElements.iconSize;
  const iconSizeLarge = responsiveElements.iconSizeLarge;
  const buttonPadding = responsiveElements.buttonPadding;
  const borderRadius = responsiveElements.borderRadius;

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top", "bottom"]}>
      <View
        className="flex-1 justify-between"
        style={{
          paddingHorizontal: responsiveSpacing.xl,
          paddingVertical: responsiveSpacing.lg
        }}
      >
        {/* Header */}
        <View className="items-center" style={{ marginTop: responsiveSpacing.xxl }}>
          <View
            className="rounded-full items-center justify-center"
            style={{ marginBottom: responsiveSpacing.xl }}
          >
            <LinearGradient
              colors={["#6366f1", "#9333ea"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: iconSizeLarge * 2,
                height: iconSizeLarge * 2,
                borderRadius: iconSizeLarge,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="school" size={iconSizeLarge} color="white" />
            </LinearGradient>
          </View>

          <Text
            className="font-bold text-gray-900"
            style={{
              fontSize: responsiveTypography.displayLarge.fontSize,
              lineHeight: responsiveTypography.displayLarge.lineHeight,
              marginBottom: responsiveSpacing.sm
            }}
          >
            Homework Helper
          </Text>
          <Text
            className="text-center text-gray-600"
            style={{
              fontSize: responsiveTypography.bodyMedium.fontSize,
              lineHeight: responsiveTypography.bodyMedium.lineHeight,
              paddingHorizontal: responsiveSpacing.xl
            }}
          >
            Your dedicated AI teacher for all subjects
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={{ gap: responsiveSpacing.md }}>
          {/* Type Question - Primary Action */}
          <Pressable onPress={handleTypeQuestion}>
            {({ pressed }) => (
              <LinearGradient
                colors={["#6366f1", "#8b5cf6"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  borderRadius: borderRadius,
                  paddingVertical: buttonPadding.vertical,
                  paddingHorizontal: buttonPadding.horizontal,
                  opacity: pressed ? 0.85 : 1,
                  shadowColor: "#6366f1",
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.25,
                  shadowRadius: 12,
                  elevation: 6,
                }}
              >
                <View
                  className="flex-row items-center justify-center"
                  style={{ gap: responsiveSpacing.md }}
                >
                  <View
                    className="bg-white/20 rounded-full items-center justify-center"
                    style={{
                      width: iconSize * 1.8,
                      height: iconSize * 1.8
                    }}
                  >
                    <Ionicons name="create" size={iconSize} color="white" />
                  </View>
                  <Text
                    className="text-white font-bold"
                    style={{ fontSize: responsiveTypography.titleMedium.fontSize }}
                  >
                    Type Question
                  </Text>
                </View>
              </LinearGradient>
            )}
          </Pressable>

          {/* Take Photo - Secondary Action */}
          <Pressable onPress={handleTakePhoto}>
            {({ pressed }) => (
              <LinearGradient
                colors={["#ec4899", "#f97316"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  borderRadius: borderRadius,
                  paddingVertical: buttonPadding.vertical,
                  paddingHorizontal: buttonPadding.horizontal,
                  opacity: pressed ? 0.85 : 1,
                  shadowColor: "#ec4899",
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.25,
                  shadowRadius: 12,
                  elevation: 6,
                }}
              >
                <View
                  className="flex-row items-center justify-center"
                  style={{ gap: responsiveSpacing.md }}
                >
                  <View
                    className="bg-white/20 rounded-full items-center justify-center"
                    style={{
                      width: iconSize * 1.8,
                      height: iconSize * 1.8
                    }}
                  >
                    <Ionicons name="camera" size={iconSize} color="white" />
                  </View>
                  <Text
                    className="text-white font-bold"
                    style={{ fontSize: responsiveTypography.titleMedium.fontSize }}
                  >
                    Take Photo
                  </Text>
                </View>
              </LinearGradient>
            )}
          </Pressable>

          {/* Choose from Gallery - Tertiary Action */}
          <Pressable onPress={handleChooseFromGallery}>
            {({ pressed }) => (
              <LinearGradient
                colors={["#10b981", "#06b6d4"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  borderRadius: borderRadius,
                  paddingVertical: buttonPadding.vertical,
                  paddingHorizontal: buttonPadding.horizontal,
                  opacity: pressed ? 0.85 : 1,
                  shadowColor: "#10b981",
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.25,
                  shadowRadius: 12,
                  elevation: 6,
                }}
              >
                <View
                  className="flex-row items-center justify-center"
                  style={{ gap: responsiveSpacing.md }}
                >
                  <View
                    className="bg-white/20 rounded-full items-center justify-center"
                    style={{
                      width: iconSize * 1.8,
                      height: iconSize * 1.8
                    }}
                  >
                    <Ionicons name="images" size={iconSize} color="white" />
                  </View>
                  <Text
                    className="text-white font-bold"
                    style={{ fontSize: responsiveTypography.titleMedium.fontSize }}
                  >
                    Choose from Gallery
                  </Text>
                </View>
              </LinearGradient>
            )}
          </Pressable>
        </View>

        {/* Footer */}
        <View className="items-center">
          <Text
            className="text-gray-400"
            style={{ fontSize: responsiveTypography.bodySmall.fontSize }}
          >
            Supports Math, Science, English & More
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
