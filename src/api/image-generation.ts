/*
IMPORTANT NOTICE: DO NOT REMOVE
This service generates images using OpenAI's gpt-image-1 API directly.
It bypasses Vibecode's rate-limited proxy for better performance.
Does not support video and audio generation.
*/

import * as FileSystem from 'expo-file-system';

/**
 * Generate an image using OpenAI's gpt-image-1 API directly
 * @param prompt The text prompt to generate an image from
 * @param options Optional parameters for image generation
 * @returns URL of the generated image (local file URI), usable to render in the app directly.
 */
export async function generateImage(
  prompt: string,
  options?: {
    size?: "1024x1024" | "1536x1024" | "1024x1536" | "auto";
    quality?: "low" | "medium" | "high" | "auto";
    format?: "png" | "jpeg" | "webp";
    background?: undefined | "transparent";
  },
): Promise<string> {
  try {
    const apiKey = process.env.EXPO_PUBLIC_VIBECODE_OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OpenAI API key not found in environment variables");
    }

    // Make API request to OpenAI directly
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt,
        size: options?.size || '1024x1024',
        quality: options?.quality || 'high',
        n: 1,
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      // Rate limit errors are expected and handled gracefully - don't spam console.error
      if (response.status === 429 || errorData.error?.message?.includes('rate limit')) {
        console.log("[ImageGeneration] Rate limited, will retry later");
      } else {
        console.error("[ImageGeneration] Error response:", errorData);
      }

      throw new Error(`Image generation API error: ${response.status} ${JSON.stringify(errorData)}`);
    }

    const result = await response.json();
    const base64Image = result.data?.[0]?.b64_json;

    if (!base64Image) {
      throw new Error("No image data in response");
    }

    // Save to local file system
    const timestamp = Date.now();
    const fileName = `generated_${timestamp}.png`;
    const fileUri = FileSystem.documentDirectory + fileName;

    await FileSystem.writeAsStringAsync(fileUri, base64Image, {
      encoding: FileSystem.EncodingType.Base64
    });

    console.log("[ImageGeneration] Image generated successfully:", fileUri);
    return fileUri;

  } catch (error) {
    // Check if this is a rate limit error - if so, just log it quietly
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
      console.log("[ImageGeneration] Rate limit reached");
    } else {
      console.error("Image Generation Error:", error);
    }
    throw error;
  }
}

/**
 * Convert aspect ratio to size format
 * @param aspectRatio The aspect ratio to convert
 * @returns The corresponding size format
 */
export function convertAspectRatioToSize(aspectRatio: string): "1024x1024" | "1536x1024" | "1024x1536" | "auto" {
  switch (aspectRatio) {
    case "1:1":
      return "1024x1024";
    case "3:2":
      return "1536x1024";
    case "2:3":
      return "1024x1536";
    default:
      return "auto";
  }
}
