# ASO Toolkit for OpenClaw

**App Store Optimization tools for your OpenClaw assistant.** Audit metadata, build keyword fields, generate keyword ideas, and optimize titles for the **App Store** and **Google Play** — all offline, no API key required.

Built and maintained by **[ASO Agency](https://asoagency.io)**, an App Store Optimization studio for funded app startups.

---

## Why

Most ASO mistakes are mechanical: titles over the 30-character limit, keyword fields padded with spaces, the same word repeated across title and keywords, plurals wasting space Apple already stems. This plugin lets your OpenClaw agent catch and fix all of that in seconds.

## Tools

| Tool | What it does |
|------|--------------|
| `aso_metadata_audit` | Scores App Store / Google Play metadata (0–100) against character limits and ASO best practices, with prioritized fixes. |
| `aso_keyword_field_builder` | Packs an optimal **100-character** App Store keyword field — dedupes, stems plurals, removes title/subtitle words and stop words. |
| `aso_keyword_ideas` | Expands a seed term into keyword ideas grouped by search intent. |
| `aso_title_optimizer` | Suggests title + subtitle combos within the 30-char limits, brand-first. |

## Install

```bash
openclaw plugins add openclaw-aso-toolkit
```

Or clone and link locally:

```bash
git clone https://github.com/MehdiSaad/openclaw-aso-toolkit
openclaw plugins add ./openclaw-aso-toolkit
```

No configuration needed — the plugin runs entirely offline.

## Example

> **You:** Audit my App Store metadata. Title "BudgetPal: Money & Expenses", subtitle "Track your spending easily", keywords "budget, money, expenses, spending, finance".

> **OpenClaw** (via `aso_metadata_audit`): Score 71/100. Errors: keyword field uses spaces after commas (wasting 4 characters). Warnings: "money" appears in both title and keywords — drop it from keywords; "spending" duplicates the subtitle.

## Development

```bash
npm test    # runs the offline logic test suite (node --test)
```

The core logic lives in [`src/aso.ts`](src/aso.ts) and is fully dependency-free and unit-tested.

## About ASO Agency

[ASO Agency](https://asoagency.io) helps funded app startups grow App Store and Google Play installs through keyword research, metadata optimization, and conversion-rate optimization. Read the [ASO blog](https://asoagency.io) or [book a call](https://asoagency.io).

## License

MIT © [ASO Agency](https://asoagency.io)
