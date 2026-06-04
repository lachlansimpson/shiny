import assert from "node:assert/strict";
import test from "node:test";

import {
  selectizeCompatClasses,
  selectizeHiddenSuffix,
  tsControlSuffix,
} from "../tomSelectConstants";

// These tests pin the migration invariants by asserting against the same
// constants the production bindings use, so renaming a suffix or class in the
// binding breaks the test rather than silently passing. DOM-level tests of the
// jQuery-based find()/init() paths would need a jsdom harness, which this
// project's node:test runner does not currently set up.

void test("tom-select focus node suffix is shared between bindings", () => {
  // selectInput.ts (label lookup) and text.ts (exclusion filter) both import
  // this constant; if it changes, the label-for lookup and the text-binding
  // exclusion must change together.
  assert.equal(tsControlSuffix, "-ts-control");
});

void test("legacy selectize hidden-input suffix is still excluded", () => {
  // text.ts keeps excluding this so third-party selectize.js inputs (DT,
  // crosstalk) are not mistaken for Shiny text inputs.
  assert.equal(selectizeHiddenSuffix, "-selectized");
  assert.notEqual(selectizeHiddenSuffix, tsControlSuffix);
});

void test("compat shim maps each tom-select element to a legacy selectize class", () => {
  // Values are the legacy class names existing app CSS may target.
  assert.deepEqual(selectizeCompatClasses, {
    wrapper: "selectize-control",
    control: "selectize-input",
    dropdown: "selectize-dropdown",
    dropdownContent: "selectize-dropdown-content",
  });
  // Every legacy class is distinct from its tom-select counterpart.
  const tomSelectClasses = [
    "ts-wrapper",
    "ts-control",
    "ts-dropdown",
    "ts-dropdown-content",
  ];
  for (const legacy of Object.values(selectizeCompatClasses)) {
    assert.equal(tomSelectClasses.includes(legacy), false);
  }
});
