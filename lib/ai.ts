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
    }),
  });
  const data = await res.json();

  let content = data.choices[0].message.content;

  // Log the raw response for debugging
  console.log("AI raw response:", content.slice(0, 500));

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
    const repaired = repairJson(extracted);
    return sanitizeAiResult(JSON.parse(repaired));
  }
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
      out[field] = JSON.stringify(val, null, 2);
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
          sanitized[field] = JSON.stringify(v, null, 2);
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
 * - Missing commas between properties
 * - Truncated output with "..."
 */
function repairJson(json: string): string {
  let repaired = json
    // Remove trailing commas before } or ]
    .replace(/,(\s*[}\]])/g, "$1")
    // Remove consecutive commas
    .replace(/,\s*,/g, ",")
    // Fix "..." truncation from AI
    .replace(/"\.\.\.",?/g, '""')
    .replace(/\.\.\.\s*$/, "")
    // Fix unescaped newlines in string values (common in AI output)
    .replace(/(?<!\\)\n/g, "\\n");

  // If the JSON ends abruptly (missing closing brackets), close them
  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let escaped = false;

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
