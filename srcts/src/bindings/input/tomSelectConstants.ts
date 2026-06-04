// Shared constants for the tom-select integration. Kept in one place so that
// the input bindings and their tests reference the same source of truth.

// tom-select renames the focus <input>'s id to `${inputId}-ts-control`.
// Both the select binding (label lookup) and the text binding (exclusion
// filter) depend on this suffix, so it lives here to stay in sync.
const tsControlSuffix = "-ts-control";

// selectize.js, which Shiny previously used, also inserts a hidden text input
// whose id ends in `-selectized`. Other packages (e.g. DT, crosstalk) still
// bundle selectize.js, so the text binding keeps excluding this suffix too.
const selectizeHiddenSuffix = "-selectized";

// Backwards-compat: the select binding mirrors these legacy selectize.js class
// names onto the new tom-select DOM elements so existing app CSS keeps working.
// Keys correspond to the tom-select instance elements the shim touches.
const selectizeCompatClasses = {
  wrapper: "selectize-control",
  control: "selectize-input",
  dropdown: "selectize-dropdown",
  dropdownContent: "selectize-dropdown-content",
} as const;

export { selectizeCompatClasses, selectizeHiddenSuffix, tsControlSuffix };
