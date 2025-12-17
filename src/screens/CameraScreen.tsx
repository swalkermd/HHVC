import React, { useState, useRef } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/AppNavigator";
import { useHomeworkStore } from "../state/homeworkStore";
import * as Haptics from "expo-haptics";

type CameraScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Camera">;
};

export default function CameraScreen({ navigation }: CameraScreenProps) {
  const [facing, setFacing] = useState<CameraType>("back");
  const [flash, setFlash] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const setCurrentImage = useHomeworkStore((s) => s.setCurrentImage);

  if (!permission) {
    return (
      <View className="flex-1 bg-gray-900 items-center justify-center">
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 bg-gray-900 items-center justify-center px-6">
        <Ionicons name="camera-outline" size={64} color="#9ca3af" />
        <Text className="text-white text-xl font-semibold mt-6 mb-3 text-center">
          Camera Permission Required
        </Text>
        <Text className="text-gray-400 text-center mb-8">
          We need access to your camera to capture homework photos
        </Text>
        <Pressable onPress={requestPermission}>
          {({ pressed }) => (
            <View
              className="bg-indigo-600 rounded-2xl px-8 py-4"
              style={{ opacity: pressed ? 0.8 : 1 }}
            >
              <Text className="text-white text-lg font-semibold">
                Grant Permission
              </Text>
            </View>
          )}
        </Pressable>
      </View>
    );
  }

  const toggleCameraFacing = () => {
    setFacing((current) => (current === "back" ? "front" : "back"));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const toggleFlash = () => {
    setFlash((current) => !current);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const takePicture = async () => {
    if (!cameraRef.current || isCapturing) return;

    try {
      setIsCapturing(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
      });

      if (photo) {
        setCurrentImage({
          uri: photo.uri,
          width: photo.width,
          height: photo.height,
        });

        navigation.replace("ProblemSelection", {
          image: {
            uri: photo.uri,
            width: photo.width,
            height: photo.height,
          },
        });
      }
    } catch (error) {
      console.error("Error taking picture:", error);
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <View className="flex-1 bg-black">
      <CameraView
        ref={cameraRef}
        style={{ flex: 1 }}
        facing={facing}
        enableTorch={flash}
      >
        {/* Overlay UI */}
        <View className="absolute top-0 left-0 right-0 bottom-0 z-10">
          {/* Top Controls */}
          <View className="flex-row justify-between items-center px-6 pt-16 pb-8">
            <Pressable onPress={() => navigation.goBack()}>
              {({ pressed }) => (
                <View
                  className="w-12 h-12 rounded-full bg-black/40 items-center justify-center"
                  style={{ opacity: pressed ? 0.6 : 1 }}
                >
                  <Ionicons name="close" size={28} color="white" />
                </View>
              )}
            </Pressable>

            <Pressable onPress={toggleFlash}>
              {({ pressed }) => (
                <View
                  className="w-12 h-12 rounded-full bg-black/40 items-center justify-center"
                  style={{ opacity: pressed ? 0.6 : 1 }}
                >
                  <Ionicons
                    name={flash ? "flash" : "flash-off"}
                    size={24}
                    color="white"
                  />
                </View>
              )}
            </Pressable>
          </View>

          {/* Bottom Controls */}
          <View className="absolute bottom-0 left-0 right-0 pb-12">
            <View className="flex-row justify-center items-center px-6">
              <View className="flex-1" />

              {/* Capture Button */}
              <Pressable onPress={takePicture} disabled={isCapturing}>
                {({ pressed }) => (
                  <View
                    className="w-20 h-20 rounded-full bg-white items-center justify-center"
                    style={{
                      opacity: pressed || isCapturing ? 0.7 : 1,
                      borderWidth: 4,
                      borderColor: "rgba(255,255,255,0.3)",
                    }}
                  >
                    {isCapturing ? (
                      <ActivityIndicator size="large" color="#6366f1" />
                    ) : (
                      <View className="w-16 h-16 rounded-full bg-indigo-600" />
                    )}
                  </View>
                )}
              </Pressable>

              {/* Flip Camera */}
              <View className="flex-1 items-end">
                <Pressable onPress={toggleCameraFacing}>
                  {({ pressed }) => (
                    <View
                      className="w-12 h-12 rounded-full bg-black/40 items-center justify-center"
                      style={{ opacity: pressed ? 0.6 : 1 }}
                    >
                      <Ionicons name="camera-reverse" size={28} color="white" />
                    </View>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </CameraView>
    </View>
  );
}
