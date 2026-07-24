import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API;

if (!apiKey) {
  console.warn("GEMINI_API environment variable is not set. AI features will not work.");
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const DEFAULT_MODEL = "gemini-3.6-flash";

/**
 * Generate a text response from Gemini.
 * Returns the trimmed text content from the first candidate.
 */
export async function generateText(
  systemPrompt: string,
  userContent: string,
  options?: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
  }
): Promise<string> {
  if (!genAI) {
    throw new Error("Gemini API is not configured. Set GEMINI_API in environment variables.");
  }

  const modelName = options?.model ?? DEFAULT_MODEL;
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: systemPrompt,
  });

  const generationConfig = {
    maxOutputTokens: options?.maxTokens ?? 4096,
    temperature: options?.temperature ?? 0.7,
  };

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: userContent }] }],
    generationConfig,
  });

  const response = result.response;
  const text = response.text().trim();

  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  return text;
}

/**
 * Generate a JSON response from Gemini.
 * Adds instructions to return only JSON and parses the result.
 */
export async function generateJson<T = Record<string, unknown>>(
  systemPrompt: string,
  userContent: string,
  options?: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
  }
): Promise<T> {
  const jsonSystemPrompt = `${systemPrompt}\n\nIMPORTANT: Return ONLY a valid JSON object. Do not wrap it in markdown code fences. Do not include any text outside the JSON object.`;
  const text = await generateText(jsonSystemPrompt, userContent, {
    ...options,
    temperature: options?.temperature ?? 0.2, // Lower temperature for structured output
  });

  // Strip any remaining markdown fences
  let cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

  // Try parsing directly
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Try balanced-brace extraction
    const start = cleaned.indexOf("{");
    if (start === -1) {
      throw new Error(`No JSON object found in Gemini response: ${cleaned.slice(0, 200)}`);
    }

    let depth = 0;
    let end = -1;
    for (let i = start; i < cleaned.length; i++) {
      if (cleaned[i] === "{") depth++;
      if (cleaned[i] === "}") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }

    if (end === -1) {
      throw new Error(`Unbalanced JSON braces in Gemini response: ${cleaned.slice(0, 200)}`);
    }

    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  }
}

export { genAI };