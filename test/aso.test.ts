import { test } from "node:test";
import assert from "node:assert/strict";
import {
  auditMetadata,
  buildKeywordField,
  generateKeywordIdeas,
  optimizeTitle,
  LIMITS,
} from "../src/aso.ts";

test("audit flags over-limit App Store title", () => {
  const r = auditMetadata({ store: "appstore", title: "A".repeat(40), subtitle: "x", keywords: "a,b,c" });
  assert.ok(r.fields.title.over);
  assert.ok(r.issues.some((i) => i.field === "title" && i.severity === "error"));
  assert.ok(r.score < 100);
});

test("audit flags spaces after commas in keyword field", () => {
  const r = auditMetadata({ store: "appstore", title: "Brand", keywords: "run, jog, sprint" });
  assert.ok(r.issues.some((i) => i.field === "keywords" && /spaces after commas/.test(i.message)));
});

test("audit flags keyword stuffing on Play long description", () => {
  const long = ("budget ".repeat(50) + "x ".repeat(100)).trim();
  const r = auditMetadata({ store: "playstore", title: "Budgeter", shortDescription: "Track spending", longDescription: long });
  assert.ok(r.issues.some((i) => i.field === "longDescription" && /density|stuffing/.test(i.message)));
});

test("keyword field builder dedupes, stems, drops title words, stays under 100", () => {
  const r = buildKeywordField(["runs", "run", "running", "jog", "fitness tracker", "fitness"], "Run Tracker");
  assert.ok(r.length <= LIMITS.appstore.keywords);
  assert.ok(!r.field.includes(" ")); // packed, no spaces
  // "run"/"runs"/"running" collapse and "run" is in the title → none should survive
  assert.ok(!r.used.includes("run") && !r.used.includes("runs"));
  assert.ok(r.dropped.some((d) => /title/.test(d.reason)));
});

test("keyword ideas expand a seed without duplicates", () => {
  const ideas = generateKeywordIdeas("meditation", "health");
  const set = new Set(ideas.map((i) => i.keyword));
  assert.equal(set.size, ideas.length);
  assert.ok(ideas.length > 5);
});

test("title optimizer respects 30-char limits", () => {
  const s = optimizeTitle("Calm", ["sleep meditation", "relax", "focus timer"]);
  for (const x of s) {
    assert.ok(x.titleLength <= LIMITS.appstore.title);
    assert.ok(x.subtitleLength <= LIMITS.appstore.subtitle);
  }
});
