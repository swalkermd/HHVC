import React, { useState, useRef } from "react";
import { View, Text, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { RootStackParamList } from "../navigation/AppNavigator";
import { getOpenAITextResponse } from "../api/chat-service";
import { detectSubject } from "../utils/subjectDetection";
import { detectDifficultyLevel, getGradeAppropriateInstructions } from "../utils/difficultyDetection";
import * as Haptics from "expo-haptics";
import { MathText } from "../components/MathText";
import { typography, spacing, colors } from "../utils/designSystem";

type QuestionScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Question">;
  route: RouteProp<RootStackParamList, "Question">;
};

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

// Component to render assistant messages with markdown-like formatting
function AssistantMessage({ content }: { content: string }) {
  // Clean up the content - remove markdown and normalize
  let cleanContent = content
    .replace(/^#+\s+/gm, '')  // Remove markdown headers
    .replace(/\*\*/g, '')      // Remove bold markers
    .replace(/\*/g, '')        // Remove italic markers
    .replace(/^-\s+/gm, '• ')  // Convert markdown bullets to proper bullets
    .replace(/\s+/g, ' ')      // Normalize whitespace to single spaces
    .trim();

  // Split into sentences for natural paragraph breaks (only on double newlines if present)
  const paragraphs = cleanContent
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  return (
    <View style={{ gap: spacing.sm }}>
      {paragraphs.map((paragraph, index) => (
        <View key={index}>
          <MathText size="medium">{paragraph}</MathText>
        </View>
      ))}
    </View>
  );
}

export default function QuestionScreen({
  navigation,
  route,
}: QuestionScreenProps) {
  const { previousSolution } = route.params;
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputText.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      // Detect subject from previous solution and current question
      const combinedText = `${previousSolution} ${inputText.trim()}`;
      const { subject } = detectSubject(combinedText);

      // Detect difficulty/grade level
      const { gradeLevel, vocabularyGuidance } = detectDifficultyLevel(
        combinedText,
        subject
      );
      const gradeInstructions = getGradeAppropriateInstructions(gradeLevel);

      // Build subject-specific formatting instructions
      let subjectInstructions = "";
      let responseStyleGuidance = "";

      if (subject === 'chemistry') {
        responseStyleGuidance = "- Use detailed explanations with color-coded terms when showing chemical reactions or calculations";
        subjectInstructions = `
- Use subscripts for chemical formulas: H_2_O, CO_2_, Fe_2_O_3_
- Use superscripts for charges: Ca^2+^, SO_4_^2-^
- Use → for reactions
- CRITICAL: Keep chemical equations on ONE LINE - write "2H_2_ + O_2_ → 2H_2_O" as continuous expression, never break across lines`;
      } else if (subject === 'physics') {
        responseStyleGuidance = "- Use detailed explanations with color-coded terms when showing calculations or formulas";
        subjectInstructions = `
- Include units with all values: "15 m/s", "9.8 m/s^2^", "50 N"
- Use subscripts for variables: v_i_ (initial velocity), F_net_`;
      } else if (subject === 'bible') {
        responseStyleGuidance = "- Prioritize CLARITY over color highlighting. Keep responses direct and meaningful. Use colors VERY sparingly.";
        subjectInstructions = `
- Use proper verse format: John 3:16, Genesis 1:1-3
- Capitalize names and places properly
- MINIMIZE color highlighting - only for truly important theological terms`;
      } else if (subject === 'languageArts') {
        responseStyleGuidance = "- Prioritize CLARITY over color highlighting. Keep responses focused. Use colors VERY sparingly.";
        subjectInstructions = `
- Identify literary devices with minimal highlighting: [blue:metaphor]
- Use proper quotations with attribution
- Keep color usage to a minimum - only for key literary elements`;
      } else if (subject === 'geography') {
        responseStyleGuidance = "- Prioritize DIRECT, FACTUAL answers. MINIMIZE or AVOID color highlighting. Keep responses BRIEF and to the point.";
        subjectInstructions = `
- Capitalize locations properly (Paris, France; Amazon River)
- Use coordinates when relevant (40.7128°N, 74.0060°W)
- CRITICAL: Avoid excessive highlighting - simple questions deserve simple, direct answers
- Do NOT add unnecessary context or wordy explanations`;
      } else if (subject === 'math') {
        responseStyleGuidance = "- Use step-by-step explanations with color-coded terms when showing calculations";
        subjectInstructions = "";
      }

      // Build conversation context
      const conversationMessages = [
        {
          role: "system" as const,
          content: `You are a helpful tutor answering student questions about this homework solution: ${previousSolution}

**CRITICAL: MATCH THE STUDENT'S LEVEL**
${vocabularyGuidance}

${gradeInstructions}

**RESPONSE STYLE FOR THIS SUBJECT (${subject.toUpperCase()})**:
${responseStyleGuidance}

**CRITICAL TEXT FORMATTING - NO MID-SENTENCE LINE BREAKS**:
- Write in CONTINUOUS FLOWING TEXT - no line breaks (\\n) within sentences or expressions
- Each sentence flows naturally from start to finish without breaks
- Chemical equations, math expressions, and all text MUST stay on single continuous lines
- Use proper punctuation (periods, commas) to separate ideas, NOT line breaks

CRITICAL RULES:
1. Keep answers SHORT and SIMPLE (2-4 sentences max)
2. Answer ONLY what the student asked - don't over-explain
3. Use PLAIN language - explain like you're talking to a friend
4. Write in CONTINUOUS PARAGRAPHS - don't break sentences across multiple lines
5. NO markdown formatting (no **, no ###, no bullets, no line breaks mid-sentence)
6. Format notation properly:
   - Fractions: {numerator/denominator} like {3/4}
   - Keep fraction with its variable: write "{-4/3}y" not "{-4/3} y"
   - When multiplying by a fraction: write "24 × {2y/12}" NOT "24 × (2y" with separate denominator
   - Keep entire fraction together: {numerator/denominator} as ONE unit
   - For improper fractions in final answers: ALWAYS show both forms using "or"
     Example: "{-4/3} or -1{1/3}", "{7/2} or 3{1/2}"
   - Mixed numbers format: whole{numerator/denominator} like "2{1/3}" means 2 and 1/3
   - Multiply: use × not *
   - Arrows: use → to show steps
   - Colors for emphasis: [blue:term], [red:term], [green:answer]${subjectInstructions}

EXAMPLE GOOD RESPONSES:

Q: "Why did we add 5 to both sides?"
A: "We add 5 to both sides to keep the equation balanced. Whatever you do to one side, you must do to the other. This eliminates the -5 on the left, leaving just [blue:3x]."

Q: "What does {2/3} mean?"
A: "The fraction {2/3} means 2 divided by 3, which equals 0.667. You can think of it as 2 parts out of 3 total parts."

Q: "I don't understand step 2"
A: "In step 2, we combine [red:14.2t] - [red:3.8t] → [green:10.4t]. We're subtracting the coefficients: 14.2 - 3.8 = 10.4."

Q: "How do I multiply 24 by that fraction?"
A: "Multiply 24 × {2y/12} to get {48y/12}, which simplifies to [green:4y]. You multiply the whole number by the numerator."

Q: "What is the final answer?"
A: "The final answer is [green:y = {-4/3} or -1{1/3}]. This is the value that makes the equation true."

Keep it conversational, clear, and concise! Write naturally in flowing sentences.`,
        },
        ...messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        {
          role: "user" as const,
          content: inputText.trim(),
        },
      ];

      const response = await getOpenAITextResponse(conversationMessages);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response.content,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Scroll to bottom
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }} edges={["top"]}>
      {/* Header */}
      <View className="bg-white px-6" style={{ paddingVertical: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View className="flex-row items-center justify-between">
          <Pressable onPress={() => navigation.goBack()}>
            {({ pressed }) => (
              <View className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center" style={{ opacity: pressed ? 0.5 : 1 }}>
                <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
              </View>
            )}
          </Pressable>
          <Text style={{ ...typography.displayMedium, color: colors.textPrimary }}>
            Ask Questions
          </Text>
          <View style={{ width: 40 }} />
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
        keyboardVerticalOffset={0}
      >
        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          className="flex-1 px-6"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: 20 }}
        >
          {messages.length === 0 ? (
            <View className="flex-1 items-center justify-center py-20">
              <View className="w-20 h-20 rounded-full items-center justify-center mb-6" style={{ backgroundColor: "#eef2ff" }}>
                <Ionicons name="chatbubbles" size={40} color={colors.primary} />
              </View>
              <Text style={{ ...typography.titleLarge, color: colors.textPrimary, marginBottom: spacing.sm }}>
                Ask me anything!
              </Text>
            </View>
          ) : (
            <View className="gap-4">
              {messages.map((message, index) => (
                <Animated.View
                  key={message.id}
                  entering={FadeInUp.duration(400)}
                  className={`${
                    message.role === "user"
                      ? "items-end"
                      : "items-start"
                  }`}
                >
                  <View
                    className={`max-w-[80%] rounded-3xl ${
                      message.role === "user"
                        ? "bg-indigo-600 px-5 py-4"
                        : "bg-white border border-gray-200"
                    }`}
                    style={
                      message.role === "assistant"
                        ? {
                            paddingHorizontal: spacing.lg,
                            paddingVertical: spacing.lg,
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.06,
                            shadowRadius: 8,
                            elevation: 2,
                          }
                        : undefined
                    }
                  >
                    {message.role === "user" ? (
                      <Text
                        style={{
                          fontSize: 16,
                          lineHeight: 24,
                          color: "#ffffff",
                          fontWeight: "500",
                        }}
                      >
                        {message.content}
                      </Text>
                    ) : (
                      <AssistantMessage content={message.content} />
                    )}
                  </View>
                </Animated.View>
              ))}
              {isLoading && (
                <View className="items-start">
                  <View className="bg-white border border-gray-200 rounded-3xl px-5 py-4">
                    <ActivityIndicator size="small" color="#6366f1" />
                  </View>
                </View>
              )}
            </View>
          )}
        </ScrollView>

        {/* Input Area */}
        <View
          className="bg-white px-6"
          style={{
            paddingVertical: spacing.lg,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.05,
            shadowRadius: 8,
            elevation: 5,
          }}
        >
          <View className="flex-row items-end" style={{ gap: spacing.md }}>
            <View className="flex-1 bg-gray-100 rounded-3xl" style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
              <TextInput
                value={inputText}
                onChangeText={setInputText}
                placeholder="Type your question..."
                placeholderTextColor={colors.textTertiary}
                multiline
                maxLength={500}
                style={{
                  fontSize: 16,
                  lineHeight: 24,
                  color: colors.textPrimary,
                  maxHeight: 128,
                  minHeight: 24,
                }}
              />
            </View>
            <Pressable
              onPress={handleSendMessage}
              disabled={!inputText.trim() || isLoading}
            >
              {({ pressed }) => (
                <View
                  className="w-12 h-12 rounded-full items-center justify-center"
                  style={{
                    backgroundColor: inputText.trim() && !isLoading ? colors.primary : colors.border,
                    opacity: pressed ? 0.7 : 1,
                  }}
                >
                  <Ionicons
                    name="send"
                    size={20}
                    color="white"
                  />
                </View>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
