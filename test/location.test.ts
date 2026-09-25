import test from "node:test";
import assert from "node:assert/strict";
import { normalizeText, resolveLocation } from "../src/location.js";

test("normalizes accents and punctuation", () => {
  assert.equal(normalizeText("Gómez Palacio, Dgo."), "GOMEZ PALACIO DGO");
});

test("resolves a messy Vicente Guerrero input", () => {
  const result = resolveLocation("col centro vicente guerrero dgo");
  assert.equal(result.state, "Durango");
  assert.equal(result.stateCode, "10");
  assert.equal(result.municipality, "Vicente Guerrero");
  assert.ok(result.confidence >= 0.8);
});

test("detects a five-digit postal code without claiming validation", () => {
  const result = resolveLocation("34000 Durango Dgo");
  assert.equal(result.postalCode, "34000");
  assert.equal(result.state, "Durango");
  assert.ok(result.warnings.some(x => x.includes("cross-validated")));
});
