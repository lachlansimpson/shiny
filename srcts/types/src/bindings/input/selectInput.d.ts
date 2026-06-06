import { InputBinding } from "./inputBinding";
type SelectHTMLElement = HTMLSelectElement & {
    nonempty: boolean;
    tomselect?: TomSelectInstance;
};
type TomSelectPluginItem = {
    name: string;
    options?: unknown;
};
type TomSelectPlugins = Array<string | TomSelectPluginItem> | {
    [name: string]: unknown;
};
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
type TomSelectInstance = {
    settings: TomSelectSettings;
    getValue(): string | string[];
    setValue(value: string | string[]): void;
    destroy(): void;
    clear(): void;
    clearOptions(): void;
    addOptionGroup(id: string, data: {
        [key: string]: string;
    }): void;
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
declare class SelectInputBinding extends InputBinding {
    find(scope: HTMLElement): JQuery<HTMLElement>;
    getType(el: HTMLElement): string | null;
    getId(el: SelectHTMLElement): string;
    getValue(el: SelectHTMLElement): unknown;
    setValue(el: SelectHTMLElement, value: string): void;
    getState(el: SelectHTMLElement): {
        label: JQuery<HTMLElement>;
        value: ReturnType<SelectInputBinding["getValue"]>;
        options: Array<{
            value: string;
            label: string;
        }>;
    };
    receiveMessage(el: SelectHTMLElement, data: SelectInputReceiveMessageData): Promise<void>;
    subscribe(el: SelectHTMLElement, callback: (x: boolean) => void): void;
    unsubscribe(el: HTMLElement): void;
    initialize(el: SelectHTMLElement): void;
    protected _initTomSelect(el: SelectHTMLElement, update?: boolean): TomSelectInstance | undefined;
    private _filterUnknownPlugins;
    private _addShinyRemoveButton;
    private _mergePluginNames;
}
export { SelectInputBinding };
export type { SelectInputReceiveMessageData };
