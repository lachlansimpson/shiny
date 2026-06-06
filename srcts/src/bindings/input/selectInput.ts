import $ from "jquery";
import { $escape, hasDefinedProperty, updateLabel } from "../../utils";
import { indirectEval } from "../../utils/eval";
import { InputBinding } from "./inputBinding";
import {
  selectizeCompatClasses,
  tomSelectBundledPlugins,
  tsControlSuffix,
} from "./tomSelectConstants";

// tom-select stores the instance on the element after initialisation
type SelectHTMLElement = HTMLSelectElement & {
  nonempty: boolean;
  tomselect?: TomSelectInstance;
};

// tom-select ships its own TypeScript declarations (tom-select devDependency).
// The runtime value is window.TomSelect injected by the separately loaded JS.
// tom-select accepts plugins as an array of names, an array of
// `{ name, options }` items, or an object keyed by plugin name (see
// microplugin's `initializePlugins`). Model all three so the filter below can
// resolve names from each form rather than mishandling the object shapes.
type TomSelectPluginItem = { name: string; options?: unknown };
type TomSelectPlugins =
  | Array<string | TomSelectPluginItem>
  | { [name: string]: unknown };

type TomSelectSettings = {
  labelField: string;
  valueField: string;
  searchField: string[];
  optgroupField?: string;
  optgroupLabelField?: string;
  optgroupValueField?: string;
  searchConjunction?: string;
  maxOptions?: number;
  maxItems?: number | null;
  selectOnTab?: boolean;
  plugins?: TomSelectPlugins;
  load?: (query: string, callback: (results?: unknown[]) => void) => void;
  onInitialize?: (this: TomSelectInstance) => void;
  onItemRemove?: (this: TomSelectInstance, value: string) => void;
  onDropdownClose?: (this: TomSelectInstance, dropdown: HTMLElement) => void;
  [key: string]: unknown;
};

type TomSelectShinyOptions = TomSelectSettings & {
  shinyRemoveButton?: "none" | "true" | "false" | "both";
};

type TomSelectInstance = {
  settings: TomSelectSettings;
  getValue(): string | string[];
  setValue(value: string | string[]): void;
  destroy(): void;
  clear(): void;
  clearOptions(): void;
  addOptionGroup(id: string, data: { [key: string]: string }): void;
  load(value: string): void;
  wrapper: HTMLElement;
  control: HTMLElement;
  dropdown: HTMLElement;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  dropdown_content: HTMLElement;
};

type SelectInputReceiveMessageData = {
  label: string;
  options?: string;
  config?: string;
  url?: string;
  value?: string;
};

// Return true if this element is enhanced by tom-select (has a JSON config script sibling).
function isTomSelect(el: HTMLElement): boolean {
  const config = $(el)
    .parent()
    .find('script[data-for="' + $escape(el.id) + '"]');

  return config.length > 0;
}

function getLabelNode(el: SelectHTMLElement): JQuery<HTMLElement> {
  let escapedId = $escape(el.id);

  // tom-select remaps label[for="inputId"] → label[for="inputId-ts-control"]
  if (isTomSelect(el)) {
    escapedId += tsControlSuffix;
  }
  return $(el)
    .parent()
    .parent()
    .find('label[for="' + escapedId + '"]');
}

class SelectInputBinding extends InputBinding {
  find(scope: HTMLElement): JQuery<HTMLElement> {
    return $(scope).find("select");
  }

  getType(el: HTMLElement): string | null {
    const $el = $(el);

    if (!$el.hasClass("symbol")) {
      return null;
    }
    if ($el.attr("multiple") === "multiple") {
      return "shiny.symbolList";
    } else {
      return "shiny.symbol";
    }
  }

  getId(el: SelectHTMLElement): string {
    return InputBinding.prototype.getId.call(this, el) || el.name;
  }

  getValue(el: SelectHTMLElement): unknown {
    if (!isTomSelect(el)) {
      return $(el).val();
    } else {
      return el.tomselect?.getValue();
    }
  }

  setValue(el: SelectHTMLElement, value: string): void {
    if (!isTomSelect(el)) {
      $(el).val(value);
    } else {
      el.tomselect?.setValue(value);
    }
  }

  getState(el: SelectHTMLElement): {
    label: JQuery<HTMLElement>;
    value: ReturnType<SelectInputBinding["getValue"]>;
    options: Array<{ value: string; label: string }>;
  } {
    const options: Array<{ value: string; label: string }> = new Array(
      el.length,
    );

    for (let i = 0; i < el.length; i++) {
      options[i] = {
        value: (el[i] as HTMLOptionElement).value,
        label: el[i].label,
      };
    }

    return {
      label: getLabelNode(el),
      value: this.getValue(el),
      options: options,
    };
  }

  async receiveMessage(
    el: SelectHTMLElement,
    data: SelectInputReceiveMessageData,
  ): Promise<void> {
    const $el = $(el);

    // Replace all options: destroy, swap HTML, reinitialise
    if (hasDefinedProperty(data, "options")) {
      el.tomselect?.destroy();
      $el.empty().append(data.options!);
      this._initTomSelect(el);
    }

    // Re-initialise with a new config script
    if (hasDefinedProperty(data, "config")) {
      $el
        .parent()
        .find('script[data-for="' + $escape(el.id) + '"]')
        .replaceWith(data.config!);
      this._initTomSelect(el, true);
    }

    // Server-side selectize: wire up AJAX load function
    if (hasDefinedProperty(data, "url")) {
      const ts = this._initTomSelect(el);

      if (ts) {
        ts.clear();
        ts.clearOptions(); // resets loadedSearches cache
        let loaded = false;

        ts.settings.load = function (
          query: string,
          callback: (results?: unknown[]) => void,
        ) {
          const settings = ts.settings;

          $.ajax({
            url: data.url,
            data: {
              query: query,
              field: JSON.stringify([settings.searchField]),
              value: settings.valueField,
              conju: settings.searchConjunction,
              maxop: settings.maxOptions,
            },
            type: "GET",
            error: function () {
              callback();
            },
            success: function (res: Array<{ [key: string]: string }>) {
              res.forEach(function (elem) {
                const optgroupId = elem[settings.optgroupField ?? "optgroup"];
                if (optgroupId) {
                  const optgroup: { [key: string]: string } = {};

                  optgroup[settings.optgroupLabelField ?? "label"] = optgroupId;
                  optgroup[settings.optgroupValueField ?? "value"] = optgroupId;
                  ts.addOptionGroup(optgroupId, optgroup);
                }
              });
              callback(res);
              // Only set the initial value on the first load; otherwise every
              // user-initiated search would overwrite their selection (#2162).
              if (!loaded) {
                if (hasDefinedProperty(data, "value")) {
                  ts.setValue(data.value as string);
                } else if (settings.maxItems === 1 && res.length > 0) {
                  ts.setValue(res[0][settings.valueField]);
                }
                loaded = true;
              }
            },
          });
        };

        // clearOptions() reset loadedSearches, so this empty load will proceed
        ts.load("");
      }
    } else if (hasDefinedProperty(data, "value")) {
      // @ts-expect-error; data.value is currently a never type
      this.setValue(el, data.value);
    }

    await updateLabel(data.label, getLabelNode(el));

    $(el).trigger("change");
  }

  subscribe(el: SelectHTMLElement, callback: (x: boolean) => void): void {
    $(el).on("change.selectInputBinding", () => {
      // https://github.com/rstudio/shiny/issues/2162
      if (el.nonempty && this.getValue(el) === "") {
        return;
      }
      callback(false);
    });
  }

  unsubscribe(el: HTMLElement): void {
    $(el).off(".selectInputBinding");
  }

  initialize(el: SelectHTMLElement): void {
    this._initTomSelect(el);
  }

  protected _initTomSelect(
    el: SelectHTMLElement,
    update = false,
  ): TomSelectInstance | undefined {
    // Apps like 008-html that don't load the tom-select JS are safe-guarded here.
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const TomSelectCtor = (window as unknown as { [key: string]: unknown })[
      "TomSelect"
    ] as
      | (new (
          el: HTMLSelectElement,
          opts: TomSelectSettings,
        ) => TomSelectInstance)
      | undefined;

    if (typeof TomSelectCtor === "undefined") return undefined;

    const $el = $(el);
    const config = $el
      .parent()
      .find('script[data-for="' + $escape(el.id) + '"]');

    if (config.length === 0) return undefined;

    if (el.tomselect) {
      if (!update) return el.tomselect;
      el.tomselect.destroy();
    }

    let options: TomSelectShinyOptions = Object.assign(
      {
        labelField: "label",
        valueField: "value",
        searchField: ["label"],
        selectOnTab: false,
      },
      JSON.parse(config.html()),
    );

    options = this._addShinyRemoveButton(options, el.hasAttribute("multiple"));

    // nonempty: selectInput (not selectizeInput) prevents empty value for single-select
    if (typeof config.data("nonempty") !== "undefined") {
      el.nonempty = true;
      const existingOnItemRemove = options.onItemRemove;

      options.onItemRemove = function (this: TomSelectInstance, value: string) {
        if (existingOnItemRemove) existingOnItemRemove.call(this, value);
        if (this.getValue() === "") {
          $("select#" + $escape(el.id))
            .empty()
            .append(
              $("<option/>", {
                value: value,
                selected: true,
              }),
            )
            .trigger("change");
        }
      };

      const existingOnDropdownClose = options.onDropdownClose;

      options.onDropdownClose = function (
        this: TomSelectInstance,
        dropdown: HTMLElement,
      ) {
        if (existingOnDropdownClose)
          existingOnDropdownClose.call(this, dropdown);
        if (this.getValue() === "") {
          this.setValue($("select#" + $escape(el.id)).val() as string);
        }
      };
    } else {
      el.nonempty = false;
    }

    // eval-able options (e.g. render functions, onChange callbacks set via I())
    if (config.data("eval") instanceof Array)
      (config.data("eval") as string[]).forEach((x: string) => {
        (options as { [key: string]: unknown })[x] = indirectEval(
          "(" + (options as { [key: string]: unknown })[x] + ")",
        );
      });

    // Backwards-compat shim: mirror old .selectize-* class names alongside new
    // .ts-* names so existing app CSS continues to work. Will be removed in a
    // future major version.
    const existingOnInit = options.onInitialize;

    options.onInitialize = function (this: TomSelectInstance) {
      if (existingOnInit) existingOnInit.call(this);
      this.wrapper.classList.add(selectizeCompatClasses.wrapper);
      this.control.classList.add(selectizeCompatClasses.control);
      this.dropdown.classList.add(selectizeCompatClasses.dropdown);
      this.dropdown_content.classList.add(
        selectizeCompatClasses.dropdownContent,
      );
    };

    // Defense in depth: drop any plugin tom-select can't resolve before
    // construction. The R side already strips the obsolete
    // `selectize-plugin-a11y`, but plugins can be injected client-side too, and
    // an unknown name makes `new TomSelect()` throw an opaque error.
    options.plugins = this._filterUnknownPlugins(options.plugins, el.id);

    const ts = new TomSelectCtor(el, options);

    return ts;
  }

  // Remove plugin names not registered by the bundled tom-select build, warning
  // once per dropped name. Handles all three forms tom-select accepts: an array
  // of names, an array of `{ name, options }` items, and an object keyed by
  // plugin name. Anything else is passed through untouched.
  private _filterUnknownPlugins(
    plugins: TomSelectSettings["plugins"],
    inputId: string,
  ): TomSelectSettings["plugins"] {
    if (plugins == null) return plugins;

    const known = new Set<string>(tomSelectBundledPlugins);
    const warnUnknown = (name: string): void => {
      console.warn(
        `Shiny: ignoring unknown tom-select plugin "${name}" requested for ` +
          `input "${inputId}". The bundled tom-select build provides: ` +
          `${tomSelectBundledPlugins.join(", ")}.`,
      );
    };

    // Array form: each entry is either a name or a `{ name, options }` item.
    if (Array.isArray(plugins)) {
      return plugins.filter((plugin) => {
        const name = typeof plugin === "string" ? plugin : plugin.name;
        if (known.has(name)) return true;
        warnUnknown(name);
        return false;
      });
    }

    // Object form: `{ pluginName: options }`. Keep only known keys.
    const filtered: { [name: string]: unknown } = {};
    for (const name of Object.keys(plugins)) {
      if (known.has(name)) {
        filtered[name] = plugins[name];
      } else {
        warnUnknown(name);
      }
    }
    return filtered;
  }

  // Translate shinyRemoveButton option into tom-select plugin names
  private _addShinyRemoveButton(
    options: TomSelectShinyOptions,
    multiple: boolean,
  ): TomSelectSettings {
    let removeButton = options.shinyRemoveButton;

    if (removeButton === undefined) {
      return options;
    }

    // "none" means smart default based on multiple
    if (removeButton === "none") {
      removeButton = multiple ? "true" : "false";
    }

    if (removeButton === "false") {
      return options;
    }

    const plugins: string[] = [];

    if (removeButton === "both") {
      plugins.push("remove_button", "clear_button");
    } else if (removeButton === "true") {
      plugins.push(multiple ? "remove_button" : "clear_button");
    }

    return {
      ...options,
      plugins: this._mergePluginNames(options.plugins, plugins),
    };
  }

  // Merge the given plugin names into an existing plugins value, preserving its
  // shape (string array, `{ name, options }` array, or `{ name: options }`
  // object) and skipping any name already present. tom-select accepts all three
  // forms; the previous implementation only handled the string-array form and
  // discarded the other two, silently dropping a caller's plugins (and their
  // options) whenever shinyRemoveButton was also set.
  private _mergePluginNames(
    existing: TomSelectSettings["plugins"],
    names: string[],
  ): TomSelectSettings["plugins"] {
    // Object form: `{ pluginName: options }`. Add each missing name as a key.
    if (existing != null && !Array.isArray(existing)) {
      const merged: { [name: string]: unknown } = { ...existing };
      for (const name of names) {
        if (!(name in merged)) merged[name] = {};
      }
      return merged;
    }

    // Array form (names and/or `{ name, options }` items), or no plugins yet.
    // De-duplicate by name so an item-form button isn't doubled by a name-form
    // one.
    const arr = Array.isArray(existing) ? existing : [];
    const present = new Set(
      arr.map((plugin) => (typeof plugin === "string" ? plugin : plugin.name)),
    );
    return [...arr, ...names.filter((name) => !present.has(name))];
  }
}

export { SelectInputBinding };
export type { SelectInputReceiveMessageData };
