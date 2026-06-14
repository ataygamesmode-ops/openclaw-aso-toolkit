/**
 * Core App Store Optimization (ASO) logic for the ASO Toolkit plugin.
 *
 * Pure, dependency-free functions so every tool works offline with no API key.
 * Rules encode App Store Connect / Google Play metadata constraints and common
 * ASO best practices used by https://asoagency.io.
 */

export type Store = "appstore" | "playstore";

/** Hard character limits enforced by each store's metadata fields. */
export const LIMITS = {
  appstore: { title: 30, subtitle: 30, keywords: 100 },
  playstore: { title: 30, shortDescription: 80, longDescription: 4000 },
} as const;

/** Words the App Store indexes automatically or that waste keyword space. */
const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "for", "with", "to", "of", "in", "on",
  "your", "you", "app", "apps", "free", "best", "top", "new", "get",
]);

const WORD_RE = /[a-z0-9]+/gi;

function words(text: string): string[] {
  return (text.toLowerCase().match(WORD_RE) ?? []);
}

/** Apple stems keywords, so a singular form already covers most plurals. */
function singularize(word: string): string {
  if (word.length > 4 && word.endsWith("ies")) return word.slice(0, -3) + "y";
  if (word.length > 3 && word.endsWith("es")) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

export interface Issue {
  severity: "error" | "warning" | "tip";
  field: string;
  message: string;
}

export interface AuditResult {
  store: Store;
  score: number; // 0-100
  fields: Record<string, { value: string; length: number; limit: number; over: boolean }>;
  issues: Issue[];
  summary: string;
}

export interface AuditInput {
  store: Store;
  title?: string;
  subtitle?: string; // App Store
  keywords?: string; // App Store keywords field (comma-separated)
  shortDescription?: string; // Play Store
  longDescription?: string; // Play Store
}

/**
 * Audit store metadata against length limits and ASO best practices.
 * Returns a 0-100 score plus prioritized, actionable issues.
 */
export function auditMetadata(input: AuditInput): AuditResult {
  const store = input.store;
  const limits = LIMITS[store];
  const issues: Issue[] = [];
  const fields: AuditResult["fields"] = {};

  const track = (name: string, value: string | undefined, limit: number) => {
    const v = value ?? "";
    const length = v.length;
    const over = length > limit;
    fields[name] = { value: v, length, limit, over };
    if (over) {
      issues.push({
        severity: "error",
        field: name,
        message: `${name} is ${length} chars — ${length - limit} over the ${limit}-char limit. It will be truncated or rejected.`,
      });
    } else if (limit - length > limit * 0.4 && length > 0) {
      issues.push({
        severity: "warning",
        field: name,
        message: `${name} uses only ${length}/${limit} chars. You're leaving ${limit - length} ranking characters unused.`,
      });
    } else if (length === 0) {
      issues.push({
        severity: "warning",
        field: name,
        message: `${name} is empty. This is prime ranking real estate — fill it.`,
      });
    }
  };

  const titleWords = new Set(words(input.title ?? "").map(singularize));

  if (store === "appstore") {
    track("title", input.title, limits.title);
    track("subtitle", input.subtitle, limits.subtitle);
    track("keywords", input.keywords, limits.keywords);

    const subtitleWords = words(input.subtitle ?? "").map(singularize);
    const kwTokens = (input.keywords ?? "")
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

    // Spaces after commas waste characters in the keyword field.
    if ((input.keywords ?? "").includes(", ")) {
      issues.push({
        severity: "error",
        field: "keywords",
        message: "Remove spaces after commas in the keyword field — each wasted space is one fewer ranking character.",
      });
    }

    // Keywords duplicated from title/subtitle are wasted (already indexed).
    const seen = new Set<string>();
    for (const token of kwTokens) {
      for (const w of words(token).map(singularize)) {
        if (titleWords.has(w)) {
          issues.push({
            severity: "warning",
            field: "keywords",
            message: `"${w}" is already in the title — it's indexed there, so repeating it in keywords wastes space.`,
          });
        } else if (subtitleWords.includes(w)) {
          issues.push({
            severity: "warning",
            field: "keywords",
            message: `"${w}" is already in the subtitle — drop it from the keyword field.`,
          });
        }
        if (seen.has(w)) {
          issues.push({
            severity: "warning",
            field: "keywords",
            message: `"${w}" appears more than once in the keyword field — Apple only needs it once.`,
          });
        }
        seen.add(w);
        if (STOP_WORDS.has(w)) {
          issues.push({
            severity: "tip",
            field: "keywords",
            message: `Drop the filler/auto-indexed word "${w}" from keywords to reclaim space.`,
          });
        }
      }
    }
  } else {
    track("title", input.title, limits.title);
    track("shortDescription", input.shortDescription, limits.shortDescription);
    track("longDescription", input.longDescription, limits.longDescription);

    // Google Play indexes the long description; check keyword density of the top term.
    const longWords = words(input.longDescription ?? "");
    if (longWords.length > 0) {
      const freq = new Map<string, number>();
      for (const w of longWords) if (!STOP_WORDS.has(w)) freq.set(w, (freq.get(w) ?? 0) + 1);
      const top = [...freq.entries()].sort((a, b) => b[1] - a[1])[0];
      if (top) {
        const density = top[1] / longWords.length;
        if (density > 0.03) {
          issues.push({
            severity: "warning",
            field: "longDescription",
            message: `"${top[0]}" appears ${top[1]}× (${(density * 100).toFixed(1)}% density). Over ~3% reads as keyword stuffing to Google Play.`,
          });
        }
      }
    }
  }

  // Score: start at 100, subtract per issue by severity.
  const penalty = { error: 18, warning: 7, tip: 2 };
  let score = 100;
  for (const i of issues) score -= penalty[i.severity];
  score = Math.max(0, Math.min(100, score));

  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  const summary =
    score >= 85
      ? `Strong metadata (${score}/100). ${errors} errors, ${warnings} warnings.`
      : score >= 60
      ? `Decent metadata with room to grow (${score}/100). Fix ${errors} errors and ${warnings} warnings.`
      : `Metadata needs work (${score}/100). ${errors} errors and ${warnings} warnings are costing you rankings.`;

  return { store, score, fields, issues, summary };
}

export interface KeywordFieldResult {
  field: string;
  length: number;
  limit: number;
  used: string[];
  dropped: { word: string; reason: string }[];
}

/**
 * Build an optimal 100-char App Store keyword field from raw keyword ideas.
 * Dedupes, stems plurals, removes title words and stop words, and packs the
 * highest-value terms comma-separated with no spaces.
 */
export function buildKeywordField(
  rawKeywords: string[],
  titleAndSubtitle = "",
  limit = LIMITS.appstore.keywords
): KeywordFieldResult {
  const indexed = new Set(words(titleAndSubtitle).map(singularize));
  const used: string[] = [];
  const dropped: { word: string; reason: string }[] = [];
  const seen = new Set<string>();
  let length = 0;

  // Split multi-word ideas into single tokens (Apple recombines them itself).
  const tokens: string[] = [];
  for (const raw of rawKeywords) {
    for (const w of words(raw)) tokens.push(w);
  }

  for (const token of tokens) {
    const stem = singularize(token);
    if (seen.has(stem)) {
      dropped.push({ word: token, reason: "duplicate / plural already covered" });
      continue;
    }
    if (indexed.has(stem)) {
      dropped.push({ word: token, reason: "already in title/subtitle (auto-indexed)" });
      continue;
    }
    if (STOP_WORDS.has(stem)) {
      dropped.push({ word: token, reason: "stop word / auto-indexed filler" });
      continue;
    }
    const addLen = (used.length === 0 ? 0 : 1) + token.length; // comma + word
    if (length + addLen > limit) {
      dropped.push({ word: token, reason: "no room left in 100-char field" });
      continue;
    }
    used.push(token);
    seen.add(stem);
    length += addLen;
  }

  return { field: used.join(","), length, limit, used, dropped };
}

export interface KeywordIdea {
  keyword: string;
  intent: "branded" | "category" | "feature" | "competitor" | "long-tail";
  note: string;
}

const MODIFIERS = ["free", "online", "pro", "tracker", "planner", "manager", "ai", "daily", "offline", "simple"];
const INTENT_SUFFIXES = ["app", "for iphone", "for android", "2026"];

/**
 * Generate keyword ideas from a seed term and optional category.
 * Heuristic expansion — pair these with real search-volume data before shipping.
 */
export function generateKeywordIdeas(seed: string, category = ""): KeywordIdea[] {
  const base = seed.trim().toLowerCase();
  const ideas: KeywordIdea[] = [];
  const push = (keyword: string, intent: KeywordIdea["intent"], note: string) =>
    ideas.push({ keyword, intent, note });

  push(base, "category", "Core term — high volume, high competition. Anchor your subtitle here.");
  for (const m of MODIFIERS) push(`${m} ${base}`, "feature", `Feature/qualifier combo around "${m}".`);
  for (const s of INTENT_SUFFIXES) push(`${base} ${s}`, "long-tail", "Lower volume, higher conversion intent.");
  if (category) {
    push(`${base} ${category}`, "category", "Ties the seed to its category for broader reach.");
    push(`best ${category} app`, "category", "Discovery query for category browsers.");
  }

  // De-duplicate while preserving order.
  const seen = new Set<string>();
  return ideas.filter((i) => (seen.has(i.keyword) ? false : (seen.add(i.keyword), true)));
}

export interface TitleSuggestion {
  title: string;
  subtitle: string;
  titleLength: number;
  subtitleLength: number;
  valid: boolean;
}

/**
 * Suggest App Store title + subtitle combinations within the 30-char limits,
 * leading with the brand and packing the highest-value keyword phrases.
 */
export function optimizeTitle(brand: string, keywords: string[]): TitleSuggestion[] {
  const limit = LIMITS.appstore.title;
  const b = brand.trim();
  const kws = keywords.map((k) => k.trim()).filter(Boolean);
  const suggestions: TitleSuggestion[] = [];

  const seps = [": ", " - ", " "];
  for (const kw of kws) {
    for (const sep of seps) {
      const title = `${b}${sep}${kw}`;
      if (title.length <= limit) {
        suggestions.push({
          title,
          subtitle: "",
          titleLength: title.length,
          subtitleLength: 0,
          valid: true,
        });
        break;
      }
    }
  }

  // Build a subtitle from keywords that didn't fit the title.
  const titleWords = new Set(words(suggestions[0]?.title ?? b).map(singularize));
  let subtitle = "";
  for (const kw of kws) {
    if (words(kw).map(singularize).some((w) => titleWords.has(w))) continue;
    const next = subtitle ? `${subtitle} ${kw}` : kw;
    if (next.length <= LIMITS.appstore.subtitle) subtitle = next;
  }
  if (subtitle) {
    for (const s of suggestions) {
      s.subtitle = subtitle;
      s.subtitleLength = subtitle.length;
    }
  }

  if (suggestions.length === 0) {
    suggestions.push({
      title: b.slice(0, limit),
      subtitle: subtitle.slice(0, LIMITS.appstore.subtitle),
      titleLength: Math.min(b.length, limit),
      subtitleLength: Math.min(subtitle.length, LIMITS.appstore.subtitle),
      valid: b.length <= limit,
    });
  }

  return suggestions;
}
