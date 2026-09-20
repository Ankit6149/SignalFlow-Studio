import { generateText } from "./generateText";
import { malformedProviderResponse, ProviderError } from "./providerErrors.mjs";

/**
 * Executes a prompt, requests JSON, and performs robust string-to-JSON repairs.
 */
export async function generateJSON({ provider, prompt, modelOverride = null, config = {} }) {
  const rawText = await generateText({ provider, prompt, modelOverride, config });
  
  if (!rawText || typeof rawText !== "string") {
    throw new ProviderError({
      code: "provider_empty_response",
      message: "The model provider returned no usable output.",
      provider,
      model: modelOverride || "",
      retryable: true,
      recoveryAction: "retry_destination",
    });
  }

  // Attempt standard parsing first
  try {
    return JSON.parse(rawText.trim());
  } catch (err) {
    // Continue to repair flow
  }

  // Repair Step 1: Remove markdown JSON blocks if present
  let cleanText = rawText.trim();
  if (cleanText.includes("```")) {
    // Matches ```json { ... } ``` or ``` { ... } ```
    const matches = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (matches && matches[1]) {
      cleanText = matches[1].trim();
      try {
        return JSON.parse(cleanText);
      } catch (err) {
        // continue
      }
    }
  }

  // Repair Step 2: Extract text between the first '{' and the last '}'
  const startIdx = cleanText.indexOf("{");
  const endIdx = cleanText.lastIndexOf("}");
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const jsonSubstring = cleanText.substring(startIdx, endIdx + 1);
    try {
      return JSON.parse(jsonSubstring);
    } catch (err) {
      // Clean up common JSON flaws: trailing commas in arrays/objects
      const relaxedJson = jsonSubstring
        .replace(/,\s*]/g, "]") // remove trailing commas before closing brackets
        .replace(/,\s*}/g, "}"); // remove trailing commas before closing braces
      try {
        return JSON.parse(relaxedJson);
      } catch (err2) {
        throw malformedProviderResponse({ provider, model: modelOverride || "" });
      }
    }
  }

  throw malformedProviderResponse({ provider, model: modelOverride || "" });
}
