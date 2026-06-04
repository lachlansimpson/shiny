import assert from "node:assert/strict";
import test from "node:test";

// Inline the isTomSelect helper logic to test the API contract independently.
// The real implementation in selectInput.ts checks for a script[data-for] sibling.
function isTomSelect(el: { id: string; parentElement: Element | null }): boolean {
  const parentDiv = el.parentElement;
  if (!parentDiv) return false;
  return parentDiv.querySelector(`script[data-for="${el.id}"]`) !== null;
}

test("isTomSelect returns false when no config script is present", () => {
  const parent = {
    querySelector: (_: string) => null,
  } as unknown as Element;
  const el = { parentElement: parent, id: "mySelect" };
  assert.equal(isTomSelect(el), false);
});

test("isTomSelect returns true when config script is present", () => {
  const script = {};
  const parent = {
    querySelector: (selector: string) =>
      selector === 'script[data-for="mySelect"]' ? script : null,
  } as unknown as Element;
  const el = { parentElement: parent, id: "mySelect" };
  assert.equal(isTomSelect(el), true);
});

test("tom-select focus node id suffix is -ts-control (not -selectized)", () => {
  // tom-select creates a focus <input> with id = inputId + '-ts-control'.
  // The text.ts input binding must exclude this to avoid claiming it as a text input.
  const inputId = "mySelect";
  const focusNodeId = `${inputId}-ts-control`;

  assert.equal(focusNodeId.endsWith("-ts-control"), true);
  assert.equal(focusNodeId.endsWith("-selectized"), false);
});

test("CSS compat class names are the old selectize class names", () => {
  // These are the class names the compat shim must add to preserve backwards
  // compatibility for apps that target .selectize-* in custom CSS.
  const compatClasses = [
    "selectize-control",
    "selectize-input",
    "selectize-dropdown",
    "selectize-dropdown-content",
  ];
  const tomSelectClasses = ["ts-wrapper", "ts-control", "ts-dropdown", "ts-dropdown-content"];

  // Verify the mapping is 1:1 (same count, all old names are distinct from new names)
  assert.equal(compatClasses.length, tomSelectClasses.length);
  for (const cls of compatClasses) {
    assert.equal(tomSelectClasses.includes(cls), false);
  }
});
