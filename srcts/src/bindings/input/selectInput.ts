import $ from "jquery";
import { $escape, hasDefinedProperty, updateLabel } from "../../utils";
import { indirectEval } from "../../utils/eval";
import { InputBinding } from "./inputBinding";

// tom-select stores the instance on the element after initialisation
type SelectHTMLElement = HTMLSelectElement & {
  nonempty: boolean;
  tomselect?: TomSelectInstance;
};

// tom-select ships its own TypeScript declarations (tom-select devDependency).
// The runtime value is window.TomSelect injected by the separately loaded JS.
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
  plugins?: string[];
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
  addOptionGroup(id: string, data: Record<string, string>): void;
  load(value: string): void;
  wrapper: HTMLElement;
  control: HTMLElement;
  dropdown: HTMLElement;
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
    escapedId += "-ts-control";
  }
  return $(el).parent().parent().find('label[for="' + escapedId + '"]');
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
            success: function (res: Array<Record<string, string>>) {
              res.forEach(function (elem) {
                const optgroupId =
                  elem[settings.optgroupField ?? "optgroup"];
                if (optgroupId) {
                  const optgroup: Record<string, string> = {};

                  optgroup[settings.optgroupLabelField ?? "label"] =
                    optgroupId;
                  optgroup[settings.optgroupValueField ?? "value"] =
                    optgroupId;
                  ts.addOptionGroup(optgroupId, optgroup);
                }
              });
              callback(res);
              if (hasDefinedProperty(data, "value")) {
                ts.setValue(data.value as string);
              } else if (settings.maxItems === 1 && res.length > 0) {
                ts.setValue(res[0][settings.valueField]);
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
    $(el).on(
      "change.selectInputBinding",
      () => {
        // https://github.com/rstudio/shiny/issues/2162
        if (el.nonempty && this.getValue(el) === "") {
          return;
        }
        callback(false);
      },
    );
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
    const win = window as unknown as {
      TomSelect?: new (
        el: HTMLSelectElement,
        opts: TomSelectSettings,
      ) => TomSelectInstance;
    };

    if (typeof win.TomSelect === "undefined") return undefined;

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

      options.onItemRemove = function (
        this: TomSelectInstance,
        value: string,
      ) {
        if (existingOnItemRemove) existingOnItemRemove.call(this, value);
        if ((this as TomSelectInstance).getValue() === "") {
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
        if ((this as TomSelectInstance).getValue() === "") {
          (this as TomSelectInstance).setValue(
            $("select#" + $escape(el.id)).val() as string,
          );
        }
      };
    } else {
      el.nonempty = false;
    }

    // eval-able options (e.g. render functions, onChange callbacks set via I())
    if (config.data("eval") instanceof Array)
      (config.data("eval") as string[]).forEach((x: string) => {
        (options as Record<string, unknown>)[x] = indirectEval(
          "(" + (options as Record<string, unknown>)[x] + ")",
        );
      });

    // Backwards-compat shim: mirror old .selectize-* class names alongside new
    // .ts-* names so existing app CSS continues to work. Will be removed in a
    // future major version.
    const existingOnInit = options.onInitialize;

    options.onInitialize = function (this: TomSelectInstance) {
      if (existingOnInit) existingOnInit.call(this);
      this.wrapper.classList.add("selectize-control");
      this.control.classList.add("selectize-input");
      this.dropdown.classList.add("selectize-dropdown");
      this.dropdown_content.classList.add("selectize-dropdown-content");
    };

    const ts = new win.TomSelect(el, options);

    return ts;
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
      plugins: Array.from(
        new Set([
          ...(Array.isArray(options.plugins) ? options.plugins : []),
          ...plugins,
        ]),
      ),
    };
  }
}

export { SelectInputBinding };
export type { SelectInputReceiveMessageData };
