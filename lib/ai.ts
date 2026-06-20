import { House, NoGoFilters, UserProfile } from "./types";

export async function compareHouses(
  houses: House[],
  isPaid: boolean,
  weights: Record<string, number>,
  userProfile?: UserProfile | null,
  noGoFilters?: NoGoFilters | null
) {
  const model = "~google/gemini-flash-latest";
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY!}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: `You are a real-estate analyst and financial advisor. Compare the homes objectively, weighting analysis by the user's stated priorities (criterion → weight 1-5).

IMPORTANT — Red Flag Detection:
For each property, scan the listing data and flag ANY of these warning signs as "redFlags" in the output:
- "as-is" sale (suggests hidden problems)
- Short sale or foreclosure
- Foundation issues, cracks, settling
- Water damage, leaks, flooding, mold
- Termite or pest damage
- Roof in need of replacement
- HVAC/furnace near end of life
- "TLC needed", "handyman special", "fixer upper"
- Days on market > 90 (stale listing — may have issues)
- Price reduced multiple times (desperation or hidden problems)
- Mention of structural or major repairs needed

IMPORTANT — Construction Quality & System Ages:
Note the year built and assess likely maintenance needs. Homes built before 1978 may have lead paint; before 1960 may have outdated electrical; before 1990 may have original HVAC/roof approaching end of life.

IMPORTANT — Major System Replacement Estimates:
Each property has a "systemAges" object with age-based estimates for roof, HVAC, and water heater. This data is conservative (assumes original systems unless proven otherwise). Use these estimates to:
1. Flag any system with "past-end" or "near-end" condition as a HIGH-PRIORITY red flag
2. Include estimated replacement costs in the firstYearCostEstimate calculation (add the totalEstimatedBigRepairs if within 5-year window)
3. Factor the bigTicketRisk level into the score — houses with "critical" or "high" risk should score lower on financial/condition grounds
4. Mention specific system concerns in the "cons" for each affected property

System Age Estimates Legend:
- Condition: "good" (>10yr remaining), "fair" (5-10yr), "near-end" (0-5yr), "past-end" (overdue)
- Risk: "low" (<$3k upcoming repairs), "moderate" ($3k-$8k), "high" ($8k-$15k), "critical" (>$15k)

IMPORTANT — Resale Value Factors:
Consider long-term resale value when scoring:
- School district quality (even if the user has no children — it affects resale)
- Location desirability, neighborhood trends
- Lot size and usability
- Floor plan functionality and flow
- Curb appeal and street presence
- HOA restrictions and fees (high HOA can deter future buyers)

${
  userProfile
    ? `IMPORTANT: The user's financial profile is:
- Annual income: $${userProfile.income.toLocaleString()}
- Credit score: ${userProfile.creditScore}
${userProfile.workAddress ? `- Work address: ${userProfile.workAddress} (consider commute times as a factor)` : ""}
${userProfile.renovationBudget ? `- Renovation budget: $${userProfile.renovationBudget.immediateRepairs.toLocaleString()} for immediate repairs, $${userProfile.renovationBudget.desiredRenovations.toLocaleString()} for desired renovations` : ""}

Incorporate an affordability and financial health assessment into your analysis. Consider:
1. Whether the user can comfortably afford each property (monthly payment vs income)
2. How the credit score might affect mortgage rates they'd qualify for
3. Property tax and HOA impact on total monthly cost
4. Overall financial fit for each property
${userProfile.renovationBudget ? `5. Estimate a "firstYearCostEstimate" for each property: purchase price + immediate repairs + desired renovations. Factor annual maintenance (~${((userProfile.renovationBudget.annualMaintenancePercent || 1) * 100).toFixed(1)}% of home value).` : ""}

A rough monthly payment estimate: (price * 0.0065) + (propertyTaxRate * price / 12) + (hoaMonthly if present). Adjust the rate based on credit score tier (720+ = best rates, 660-719 = moderate, below 660 = higher rates).`
    : ""
}

${
  noGoFilters && Object.values(noGoFilters).some(v => v != null && v !== false && v !== 0)
    ? `The user has set these ABSOLUTE DEALBREAKERS. If any property violates these, its score should be significantly penalized and the violation must be noted in the cons:
${Object.entries(noGoFilters)
  .filter(([, v]) => v != null && v !== false && v !== 0 && v !== "")
  .map(([k, v]) => `- ${k}: ${typeof v === "boolean" ? "MUST NOT be present" : `minimum/maximum ${v}`}`)
  .join("\n")}`
    : ""
}

Return JSON: { summary, perHouse:[{address,pros,cons,score,monthlyEstimate,affordabilityRating,redFlags,firstYearCostEstimate}], recommendation, financialSummary }.`,
        },
        {
          role: "user",
          content: JSON.stringify({
            priorities: weights,
            houses,
            userProfile: userProfile ?? null,
            noGoFilters: noGoFilters ?? null,
          }),
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 16384,
    }),
  });
  const data = await res.json();

  let content = data.choices[0].message.content;

  // Log the raw response for debugging (more context for truncation issues)
  console.log("AI raw response (first 500 chars):", content.slice(0, 500));
  console.log("AI raw response length:", content.length);
  if (data.choices[0]?.finish_reason) {
    console.log("AI finish reason:", data.choices[0].finish_reason);
  }

  // Try to parse as-is first (response_format: json_object should give clean JSON)
  try {
    return sanitizeAiResult(JSON.parse(content));
  } catch {
    // Fall through to extraction
  }

  // Strip markdown fences if present
  content = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

  // Try parsing after stripping fences
  try {
    return sanitizeAiResult(JSON.parse(content));
  } catch {
    // Fall through to balanced-brace extraction
  }

  // Extract JSON object using balanced-brace matching
  const start = content.indexOf("{");
  if (start === -1) {
    throw new Error(`No JSON object found in model response: ${content.slice(0, 200)}`);
  }

  let depth = 0;
  let end = -1;
  for (let i = start; i < content.length; i++) {
    if (content[i] === "{") depth++;
    if (content[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  if (end === -1) {
    throw new Error(`Unbalanced JSON braces in model response: ${content.slice(0, 200)}`);
  }

  const extracted = content.slice(start, end + 1);

  // Try to parse the extracted JSON
  try {
    return sanitizeAiResult(JSON.parse(extracted));
  } catch (parseErr: any) {
    // Attempt to repair common AI JSON issues before giving up
    console.error("JSON parse error:", parseErr.message);
    console.error("Failing JSON (last 300 chars):", extracted.slice(-300));
    const repaired = repairJson(extracted);
    console.log("Repaired JSON (last 300 chars):", repaired.slice(-300));
    return sanitizeAiResult(JSON.parse(repaired));
  }
}

/**
 * Convert an object value into a human-readable string, since the AI sometimes
 * returns structured JSON objects for fields that should be plain-text prose.
 */
function stringifyObjectField(val: unknown): string {
  if (typeof val === "string") return val;
  if (val == null || typeof val !== "object") return JSON.stringify(val);

  const obj = val as Record<string, unknown>;

  // Collect all prose-worthy parts from the object into a readable text
  const parts: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string" && value.length > 0) {
      // For long strings, just use them directly as prose paragraphs
      if (value.length > 40) {
        parts.push(value);
      } else {
        // Short strings get labeled
        parts.push(`${key}: ${value}`);
      }
    } else if (typeof value === "number") {
      parts.push(`${formatKey(key)}: ${formatValue(key, value)}`);
    } else if (typeof value === "object" && value != null && !Array.isArray(value)) {
      // Recurse into nested objects
      const nested = stringifyObjectField(value);
      if (nested && nested !== "{}") {
        parts.push(nested);
      }
    }
  }

  // If we found prose parts, join them naturally
  if (parts.length > 0) {
    return parts.join(". ");
  }

  // Last resort: compact stringify
  return JSON.stringify(obj);
}

/** Convert camelCase keys to human-readable labels */
function formatKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, s => s.toUpperCase())
    .trim();
}

/** Format numeric values with appropriate units based on key name */
function formatValue(key: string, value: number): string {
  const lower = key.toLowerCase();
  if (lower.includes("income") || lower.includes("monthly") || lower.includes("payment") ||
      lower.includes("cost") || lower.includes("price") || lower.includes("repair") ||
      lower.includes("budget") || lower.includes("down")) {
    return `$${value.toLocaleString()}`;
  }
  if (lower.includes("percent") || lower.includes("rate") && value < 100) {
    return `${value}%`;
  }
  return String(value);
}

/**
 * Coerce AI result fields that should be strings but may arrive as objects.
 */
function sanitizeAiResult(result: Record<string, unknown>): Record<string, unknown> {
  const stringFields = ["summary", "recommendation", "financialSummary"] as const;
  const out = { ...result };

  for (const field of stringFields) {
    const val = out[field];
    if (val != null && typeof val === "object") {
      out[field] = stringifyObjectField(val);
    }
  }

  // Also sanitize perHouse entries
  if (Array.isArray(out.perHouse)) {
    out.perHouse = out.perHouse.map((p: Record<string, unknown>) => {
      const sanitized = { ...p };
      // coerce any string fields that might be objects inside perHouse items
      for (const field of ["affordabilityRating"]) {
        const v = sanitized[field];
        if (v != null && typeof v === "object") {
          sanitized[field] = stringifyObjectField(v);
        }
      }
      return sanitized;
    });
  }

  return out;
}

/**
 * Repair common JSON formatting issues from LLM output:
 * - Trailing commas before } or ]
 * - Consecutive commas
 * - Orphaned string literals without property names
 * - Truncated output with "..."
 * - Unterminated string values (close them before closing brackets)
 */
function repairJson(json: string): string {
  let repaired = json;
  
  // CRITICAL FIX: Remove orphaned string literals that appear after properly closed strings
  // The AI sometimes generates fragments like: "proper text"\n"orphan text"\n"another orphan"\n}
  
  // Strategy: Find orphaned quoted strings (strings not preceded by a colon or comma)
  // and remove them if they appear before closing brackets
  
  // First pass: Remove sequences of orphaned strings before closing brackets
  // Pattern: closing quote, newlines, then one or more orphaned quoted strings, then closing bracket
  repaired = repaired.replace(/("\s*)\n+(?:\s*"[^"]*"\s*\n*)+(\s*[}\]])/g, '$1\n$2');
  
  // Second pass: Catch any remaining orphaned strings (not preceded by : or ,)
  // This handles cases where orphans appear without newlines
  repaired = repaired.replace(/([^:,\[])\s*"[^"]*"\s*(?=\s*[}\]])/g, '$1');
  
  // Now handle simpler repairs
  repaired = repaired
    // Remove trailing commas before } or ]
    .replace(/,(\s*[}\]])/g, "$1")
    // Remove consecutive commas
    .replace(/,\s*,/g, ",")
    // Fix "..." truncation from AI
    .replace(/"\.\.\.",?/g, '""')
    .replace(/\.\.\.\s*$/, "");

  // If the JSON ends abruptly (missing closing brackets), close them
  // First, detect unterminated string (odd number of quotes before the end)
  let inString = false;
  let escaped = false;
  let lastStringQuotePos = -1;

  for (let i = 0; i < repaired.length; i++) {
    const ch = repaired[i];
    if (escaped) { escaped = false; continue; }
    if (ch === "\\") { escaped = true; continue; }
    if (ch === '"') {
      inString = !inString;
      if (!inString) lastStringQuotePos = i; // closed a string
    }
  }

  // If we're still inside a string at EOF, close it
  let needsStringClosure = inString;
  if (needsStringClosure) {
    // Find the last comma before the unterminated string to remove any trailing partial content
    const lastComma = repaired.lastIndexOf(",");
    const lastBracket = Math.max(
      repaired.lastIndexOf("}"),
      repaired.lastIndexOf("]")
    );
    const lastColon = repaired.lastIndexOf(":");
    // The unterminated string started after the last structural character
    const clipPos = Math.max(lastComma, lastBracket, lastColon);
    if (clipPos > lastStringQuotePos) {
      // Remove the partial/incomplete value and replace it with an empty string
      repaired = repaired.slice(0, clipPos + 1) + '""';
      needsStringClosure = false; // we patched it
    } else {
      // No safe clipping point — just close the string with an empty value
      repaired += '": ""';
      needsStringClosure = false;
    }
  }

  // Now count bracket depth
  let openBraces = 0;
  let openBrackets = 0;
  inString = false;
  escaped = false;

  for (const ch of repaired) {
    if (escaped) { escaped = false; continue; }
    if (ch === "\\") { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") openBraces++;
    if (ch === "}") openBraces--;
    if (ch === "[") openBrackets++;
    if (ch === "]") openBrackets--;
  }

  if (openBrackets > 0) repaired += "]".repeat(openBrackets);
  if (openBraces > 0) repaired += "}".repeat(openBraces);

  return repaired;
}
