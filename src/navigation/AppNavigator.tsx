import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { HomeworkImage, SelectedProblem } from "../types/homework";

// Screen imports (will create these next)
import HomeScreen from "../screens/HomeScreen";
import CameraScreen from "../screens/CameraScreen";
import TextInputScreen from "../screens/TextInputScreen";
import ProblemSelectionScreen from "../screens/ProblemSelectionScreen";
import SolutionScreen from "../screens/SolutionScreen";
import QuestionScreen from "../screens/QuestionScreen";

export type RootStackParamList = {
  Home: undefined;
  Camera: undefined;
  TextInput: undefined;
  ProblemSelection: {
    image: HomeworkImage;
  };
  Solution: {
    problem: SelectedProblem;
    problemNumber?: string;
    textQuestion?: string;
  };
  Question: {
    previousSolution: string;
  };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        contentStyle: { backgroundColor: "#f9fafb" },
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Camera" component={CameraScreen} />
      <Stack.Screen name="TextInput" component={TextInputScreen} />
      <Stack.Screen name="ProblemSelection" component={ProblemSelectionScreen} />
      <Stack.Screen name="Solution" component={SolutionScreen} />
      <Stack.Screen
        name="Question"
        component={QuestionScreen}
        options={{
          presentation: "modal",
          animation: "slide_from_bottom",
        }}
      />
    </Stack.Navigator>
  );
}
