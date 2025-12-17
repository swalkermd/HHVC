/**
 * Educational Image Generation Helper
 * Specialized functions for generating educational visual aids
 */

import { generateImage } from '../api/image-generation';

/**
 * Generate a map or geographic visual aid
 * @param description Description of the geographic concept or location
 * @returns URL of the generated map image
 */
export async function generateGeographyMap(description: string): Promise<string> {
  // Craft a detailed prompt for accurate map generation
  const mapPrompt = `Create a clear, educational map showing ${description}.
Style: Clean, professional cartographic style with clear labels and borders.
Include: Country/region names, major cities, bodies of water, and geographic features as relevant.
Color scheme: Use distinct colors for land, water, and borders. Make it easy to read and understand.`;

  return await generateImage(mapPrompt, {
    size: '1536x1024', // Wide aspect ratio works well for maps
    quality: 'high',
    format: 'png'
  });
}

/**
 * Generate a Bible-related visual aid (timeline, diagram, map of biblical locations)
 * @param description Description of what to visualize
 * @returns URL of the generated image
 */
export async function generateBibleVisual(description: string): Promise<string> {
  const biblePrompt = `Create an educational illustration showing ${description}.
Style: Clear, respectful, historically appropriate.
Include: Labels, dates/references where relevant, clear visual hierarchy.
Make it informative and easy to understand for students.`;

  return await generateImage(biblePrompt, {
    size: '1024x1024',
    quality: 'high',
    format: 'png'
  });
}

/**
 * Generate a Language Arts visual aid (character relationships, plot diagram, literary device example)
 * @param description Description of the literary concept
 * @returns URL of the generated image
 */
export async function generateLanguageArtsVisual(description: string): Promise<string> {
  const literaryPrompt = `Create an educational diagram showing ${description}.
Style: Clean, academic, easy to follow.
Include: Clear labels, connections, examples as relevant.
Use colors and visual hierarchy to make concepts clear.`;

  return await generateImage(literaryPrompt, {
    size: '1024x1024',
    quality: 'medium',
    format: 'png'
  });
}

/**
 * Generate a general educational diagram or illustration
 * @param description Description of what to visualize
 * @param subject Subject area (for styling context)
 * @returns URL of the generated image
 */
export async function generateEducationalVisual(
  description: string,
  subject: string = 'general'
): Promise<string> {
  const educationalPrompt = `Create a clear educational illustration for ${subject} showing ${description}.
Style: Professional, academic, easy to understand.
Include: Clear labels, logical organization, appropriate visual elements.
Make it helpful for student learning.`;

  return await generateImage(educationalPrompt, {
    size: '1024x1024',
    quality: 'medium',
    format: 'png'
  });
}

/**
 * Parse solution content for image generation requests
 * Looks for [IMAGE NEEDED: description] markers
 * @param content The solution content to parse
 * @returns Array of image descriptions that need to be generated
 */
export function parseImageRequests(content: string): string[] {
  const imagePattern = /\[IMAGE NEEDED:\s*([^\]]+)\]/gi;
  const matches: string[] = [];
  let match;

  while ((match = imagePattern.exec(content)) !== null) {
    matches.push(match[1].trim());
  }

  return matches;
}

/**
 * Replace image request markers with actual image references
 * @param content The original content with markers
 * @param imageUrls Map of descriptions to generated image URLs
 * @returns Content with image markers replaced by image references
 */
export function replaceImageMarkers(
  content: string,
  imageUrls: Map<string, string>
): string {
  let updatedContent = content;

  imageUrls.forEach((url, description) => {
    const marker = `[IMAGE NEEDED: ${description}]`;
    const replacement = `[IMAGE: ${description}](${url})`;
    updatedContent = updatedContent.replace(marker, replacement);
  });

  return updatedContent;
}
