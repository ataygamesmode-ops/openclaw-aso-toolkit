/**
 * ASO Toolkit — App Store Optimization tools for OpenClaw.
 *
 * Four offline tools for App Store & Google Play growth:
 *   aso_metadata_audit       – score title/subtitle/keywords against store limits + ASO rules
 *   aso_keyword_field_builder – pack an optimal 100-char App Store keyword field
 *   aso_keyword_ideas         – expand a seed term into ranked keyword ideas
 *   aso_title_optimizer       – suggest title/subtitle combos within 30-char limits
 *
 * Built and maintained by ASO Agency — https://asoagency.io
 */
import { Type } from "typebox";
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import {
  auditMetadata,
  buildKeywordField,
  generateKeywordIdeas,
  optimizeTitle,
  type Store,
} from "./src/aso.js";

const text = (value: unknown) => ({
  content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
});

export default definePluginEntry({
  id: "aso-toolkit",
  register(api) {
    api.registerTool({
      name: "aso_metadata_audit",
      description:
        "Audit App Store or Google Play metadata (title, subtitle/keywords or descriptions) against character limits and ASO best practices. Returns a 0-100 score and prioritized fixes.",
      parameters: Type.Object({
        store: Type.Union([Type.Literal("appstore"), Type.Literal("playstore")], {
          description: "Which store the metadata is for.",
        }),
        title: Type.Optional(Type.String()),
        subtitle: Type.Optional(Type.String({ description: "App Store subtitle (30 chars)." })),
        keywords: Type.Optional(Type.String({ description: "App Store keyword field, comma-separated (100 chars)." })),
        shortDescription: Type.Optional(Type.String({ description: "Google Play short description (80 chars)." })),
        longDescription: Type.Optional(Type.String({ description: "Google Play long description (4000 chars)." })),
      }),
      async execute(_id, params) {
        return text(auditMetadata({ ...params, store: params.store as Store }));
      },
    });

    api.registerTool({
      name: "aso_keyword_field_builder",
      description:
        "Build an optimal 100-character App Store keyword field from a list of keyword ideas. Dedupes, stems plurals, removes title/subtitle words and stop words, and packs the highest-value terms.",
      parameters: Type.Object({
        keywords: Type.Array(Type.String(), { description: "Raw keyword ideas (single or multi-word)." }),
        titleAndSubtitle: Type.Optional(
          Type.String({ description: "Current title + subtitle, so already-indexed words are excluded." })
        ),
      }),
      async execute(_id, params) {
        return text(buildKeywordField(params.keywords, params.titleAndSubtitle ?? ""));
      },
    });

    api.registerTool({
      name: "aso_keyword_ideas",
      description:
        "Expand a seed term (and optional category) into App Store keyword ideas grouped by search intent. Pair with real volume data before shipping.",
      parameters: Type.Object({
        seed: Type.String({ description: "Core term, e.g. 'meditation' or 'expense tracker'." }),
        category: Type.Optional(Type.String({ description: "App category, e.g. 'health', 'finance'." })),
      }),
      async execute(_id, params) {
        return text(generateKeywordIdeas(params.seed, params.category ?? ""));
      },
    });

    api.registerTool({
      name: "aso_title_optimizer",
      description:
        "Suggest App Store title + subtitle combinations within the 30-char limits, leading with the brand and packing the highest-value keyword phrases.",
      parameters: Type.Object({
        brand: Type.String({ description: "App / brand name." }),
        keywords: Type.Array(Type.String(), { description: "Target keyword phrases, highest priority first." }),
      }),
      async execute(_id, params) {
        return text(optimizeTitle(params.brand, params.keywords));
      },
    });
  },
});
