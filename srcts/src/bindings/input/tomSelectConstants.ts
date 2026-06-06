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

// The plugins registered by the bundled `tom-select.complete.js` build (via
// `TomSelect.define(...)`). Requesting a name outside this set makes tom-select
// throw "Unable to find plugin" at construction, which surfaces as an opaque
// error. The select binding filters against this list before `new TomSelect()`
// as defense in depth: the R side strips the obsolete `selectize-plugin-a11y`,
// but plugins can also be injected client-side, so we guard here too. Keep this
// in sync with `inst/www/shared/tom-select/js/tom-select.complete.js`.
const tomSelectBundledPlugins = [
  "caret_position",
  "change_listener",
  "checkbox_options",
  "clear_button",
  "drag_drop",
  "dropdown_header",
  "dropdown_input",
  "input_autogrow",
  "no_active_items",
  "no_backspace_delete",
  "optgroup_columns",
  "remove_button",
  "restore_on_backspace",
  "virtual_scroll",
] as const;

export {
  selectizeCompatClasses,
  selectizeHiddenSuffix,
  tomSelectBundledPlugins,
  tsControlSuffix,
};
