import assert from "node:assert/strict";
import test from "node:test";

import { SelectInputBinding } from "../selectInput";
import {
  selectizeCompatClasses,
  selectizeHiddenSuffix,
  tomSelectBundledPlugins,
  tsControlSuffix,
} from "../tomSelectConstants";

// The constant tests below pin the migration invariants by asserting against the
// same constants the production bindings use, so renaming a suffix or class in
// the binding breaks the test rather than silently passing.
//
// The plugin-filtering and remove-button tests exercise the real binding
// methods directly: both are pure transforms (no DOM), so we reach them through
// a typed cast rather than reimplementing their logic in the test. Only the
// genuinely DOM-bound paths -- find(), getLabelNode()'s -ts-control remap, and
// the onInitialize compat-class shim -- need a jsdom harness, which this
// project's node:test runner does not currently set up.

// tom-select accepts plugins as an array of names, an array of `{ name, options }`
// items, or an object keyed by plugin name. Mirror those shapes so the cast below
// stays type-safe.
type PluginItem = { name: string; options?: unknown };
type Plugins = Array<string | PluginItem> | { [name: string]: unknown };

// _filterUnknownPlugins and _addShinyRemoveButton are private, but they are
// DOM-free and carry the migration's branchiest logic, so we test them directly
// through a structurally-typed view rather than via a strawman reimplementation.
/* eslint-disable @typescript-eslint/naming-convention -- these mirror the
   binding's private method names verbatim so the cast stays in sync. */
type BindingInternals = {
  _filterUnknownPlugins(
    plugins: Plugins | undefined,
    inputId: string,
  ): Plugins | undefined;
  _addShinyRemoveButton(
    options: {
      shinyRemoveButton?: "none" | "true" | "false" | "both";
      plugins?: Plugins;
      [key: string]: unknown;
    },
    multiple: boolean,
  ): { plugins?: Plugins; [key: string]: unknown };
};
/* eslint-enable @typescript-eslint/naming-convention */

function bindingInternals(): BindingInternals {
  return new SelectInputBinding() as unknown as BindingInternals;
}

// _filterUnknownPlugins warns via console.warn on each dropped name. Capture the
// warnings so the test output stays clean and we can assert they fired.
function captureWarnings(fn: () => void): string[] {
  const warnings: string[] = [];
  const original = console.warn;
  console.warn = (msg?: unknown): void => {
    warnings.push(String(msg));
  };
  try {
    fn();
  } finally {
    console.warn = original;
  }
  return warnings;
}

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

void test("bundled-plugins list includes the remove/clear buttons shinyRemoveButton wires up", () => {
  // _addShinyRemoveButton injects these names; if they ever drop out of the
  // bundled build, _filterUnknownPlugins would silently strip them back out and
  // the remove button would vanish. Pin them so that regression is caught here.
  assert.ok(tomSelectBundledPlugins.includes("remove_button"));
  assert.ok(tomSelectBundledPlugins.includes("clear_button"));
  // The obsolete a11y plugin is NOT a tom-select plugin, so a client-side
  // request for it must be filtered (mirrors the R-side strip + deprecation).
  assert.equal(
    (tomSelectBundledPlugins as readonly string[]).includes(
      "selectize-plugin-a11y",
    ),
    false,
  );
});

void test("_filterUnknownPlugins passes null/undefined through untouched", () => {
  const binding = bindingInternals();
  // null/undefined means "no plugins requested"; the binding must not coerce
  // either into an empty array, which would change tom-select's behaviour.
  assert.equal(binding._filterUnknownPlugins(undefined, "x"), undefined);
  assert.equal(
    binding._filterUnknownPlugins(null as unknown as undefined, "x"),
    null,
  );
});

void test("_filterUnknownPlugins (string array) drops unknown names, keeps known and empties", () => {
  const binding = bindingInternals();
  const warnings = captureWarnings(() => {
    assert.deepEqual(
      binding._filterUnknownPlugins(
        ["remove_button", "selectize-plugin-a11y", "drag_drop", "bogus"],
        "x",
      ),
      ["remove_button", "drag_drop"],
    );
    assert.deepEqual(binding._filterUnknownPlugins([], "x"), []);
  });
  // One warning per dropped name, naming each unknown plugin.
  assert.equal(warnings.length, 2);
  assert.ok(warnings.some((w) => w.includes("selectize-plugin-a11y")));
  assert.ok(warnings.some((w) => w.includes("bogus")));
});

void test("_filterUnknownPlugins ({name, options} array) filters by name and preserves options", () => {
  const binding = bindingInternals();
  const warnings = captureWarnings(() => {
    assert.deepEqual(
      binding._filterUnknownPlugins(
        [
          { name: "drag_drop", options: { foo: 1 } },
          { name: "bogus", options: { bar: 2 } },
        ],
        "x",
      ),
      [{ name: "drag_drop", options: { foo: 1 } }],
    );
  });
  assert.equal(warnings.length, 1);
  assert.ok(warnings[0].includes("bogus"));
});

void test("_filterUnknownPlugins (object form) keeps known keys with options, drops unknown keys", () => {
  const binding = bindingInternals();
  const warnings = captureWarnings(() => {
    assert.deepEqual(
      binding._filterUnknownPlugins(
        // eslint-disable-next-line @typescript-eslint/naming-convention -- tom-select plugin name
        { remove_button: { title: "x" }, bogus: {} },
        "x",
      ),
      // eslint-disable-next-line @typescript-eslint/naming-convention -- tom-select plugin name
      { remove_button: { title: "x" } },
    );
  });
  assert.equal(warnings.length, 1);
  assert.ok(warnings[0].includes("bogus"));
});

void test("_addShinyRemoveButton leaves options untouched when the option is absent or false", () => {
  const binding = bindingInternals();
  // No shinyRemoveButton: no plugins key is added at all.
  assert.equal(binding._addShinyRemoveButton({}, true).plugins, undefined);
  // Explicit "false": untouched, regardless of multiple.
  assert.equal(
    binding._addShinyRemoveButton({ shinyRemoveButton: "false" }, true).plugins,
    undefined,
  );
  // "none" on a single-select resolves to "false" -> untouched.
  assert.equal(
    binding._addShinyRemoveButton({ shinyRemoveButton: "none" }, false).plugins,
    undefined,
  );
});

void test("_addShinyRemoveButton picks remove_button for multiple, clear_button for single", () => {
  const binding = bindingInternals();
  // "none" on a multiple-select resolves to "true".
  assert.deepEqual(
    binding._addShinyRemoveButton({ shinyRemoveButton: "none" }, true).plugins,
    ["remove_button"],
  );
  assert.deepEqual(
    binding._addShinyRemoveButton({ shinyRemoveButton: "true" }, true).plugins,
    ["remove_button"],
  );
  assert.deepEqual(
    binding._addShinyRemoveButton({ shinyRemoveButton: "true" }, false).plugins,
    ["clear_button"],
  );
});

void test("_addShinyRemoveButton adds both buttons for 'both'", () => {
  const binding = bindingInternals();
  assert.deepEqual(
    binding._addShinyRemoveButton({ shinyRemoveButton: "both" }, false).plugins,
    ["remove_button", "clear_button"],
  );
});

void test("_addShinyRemoveButton merges with existing plugins without duplicating", () => {
  const binding = bindingInternals();
  const result = binding._addShinyRemoveButton(
    { shinyRemoveButton: "true", plugins: ["drag_drop", "remove_button"] },
    true,
  );
  // remove_button is requested but already present -> no duplicate.
  assert.deepEqual(result.plugins, ["drag_drop", "remove_button"]);
});

void test("_addShinyRemoveButton preserves {name, options} plugins while adding the button", () => {
  const binding = bindingInternals();
  // Existing plugins in item form must not be discarded when the button is
  // injected; the button is appended by name.
  const result = binding._addShinyRemoveButton(
    {
      shinyRemoveButton: "true",
      plugins: [{ name: "drag_drop", options: { foo: 1 } }],
    },
    true,
  );
  assert.deepEqual(result.plugins, [
    { name: "drag_drop", options: { foo: 1 } },
    "remove_button",
  ]);
});

void test("_addShinyRemoveButton preserves {name, options} plugins and does not duplicate the button", () => {
  const binding = bindingInternals();
  // The button is already present as an item -> no duplicate appended.
  const result = binding._addShinyRemoveButton(
    {
      shinyRemoveButton: "true",
      plugins: [{ name: "remove_button", options: { title: "x" } }],
    },
    true,
  );
  assert.deepEqual(result.plugins, [
    { name: "remove_button", options: { title: "x" } },
  ]);
});

void test("_addShinyRemoveButton preserves object-form plugins while adding the button", () => {
  const binding = bindingInternals();
  // Object-form plugins (`{ name: options }`) must survive; the button is added
  // as a new key rather than replacing the whole object.
  const result = binding._addShinyRemoveButton(
    // eslint-disable-next-line @typescript-eslint/naming-convention -- tom-select plugin name
    { shinyRemoveButton: "true", plugins: { drag_drop: { foo: 1 } } },
    true,
  );
  assert.deepEqual(result.plugins, {
    // eslint-disable-next-line @typescript-eslint/naming-convention -- tom-select plugin name
    drag_drop: { foo: 1 },
    // eslint-disable-next-line @typescript-eslint/naming-convention -- tom-select plugin name
    remove_button: {},
  });
});

void test("_addShinyRemoveButton does not clobber an object-form button already present", () => {
  const binding = bindingInternals();
  // The button key already exists with options -> keep its options, no reset.
  const result = binding._addShinyRemoveButton(
    // eslint-disable-next-line @typescript-eslint/naming-convention -- tom-select plugin name
    { shinyRemoveButton: "true", plugins: { remove_button: { title: "x" } } },
    true,
  );
  assert.deepEqual(result.plugins, {
    // eslint-disable-next-line @typescript-eslint/naming-convention -- tom-select plugin name
    remove_button: { title: "x" },
  });
});
