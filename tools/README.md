Updating web libraries
======================

This directory contains build tools for Shiny.

For TypeScript / JavaScript build tool descriptions, see the [`./srcts`](../srcts) folder.

## Updating and patching `bootstrap-datepicker`

### Updating

[bootstrap-datepicker](https://github.com/uxsolutions/bootstrap-datepicker) can be updated with the script `updateBootstrapDatepicker.R`.

### Making a new patch

To create a new patch:

1. Make any necessary changes to files in `inst/www/shared/datepicker`
1. **Do not commit your changes.**
1. Instead, create a patch with a command like `git diff > tools/datepicker-patches/012-a-description.patch`. Patches are applied in alphabetic order (per `list.files`), so you should name your patch based on the last one in `tools/datepicker-patches` so that it's applied last.
2. Source `updateBootstrapDatepicker.R` to download the library and apply patches.
3. Test your changes
4. `git add` the new `.patch` and any resulting changes


## Updating and patching ion.rangeSlider

### Updating

[ion.rangeSlider](https://github.com/IonDen/ion.rangeSlider) can be updated with the script `updateIonRangeSlider.R`. That script downloads a specific version of ion.rangeSlider and applies our patches in tools/ion.rangeSlider-patches.


### Making a new patch

To create a new patch:

1. Make any necessary changes to files in `inst/www/shared/ion.rangeSlider`
1. **Do not commit your changes.**
1. Instead, create a patch with a command like `git diff > tools/ion.rangeSlider-patches/0004-a-description.patch`. Patches are applied in alphabetic order (per `list.files`), so you should name your patch based on the last one in `tools/ion.rangeSlider-patches` so that it's applied last.
1. Run `updateIonRangeSlider.R` to download the library and apply patches.
1. Test your changes
1. Run `devtools::document()`.
1. `git add` the new `.patch` and any resulting changes


## Updating Font-Awesome

1. Edit `updateFontAwesome.R` to use the new version, and then run it. This will download and copy the files to the relevant locations.
1. Update the "font-awesome" htmlDependency in `R/bootstrap.R` to reflect the new version.
1. Update the documentation for the `icon()` function in `R/bootstrap.R` to reflect the new version.
1. Run `devtools::document()`.
1. Commit the changes.

## Updating jQuery

1. Edit `updatejQuery.R` to use the new version, and then run it. This will download and copy the files to the relevant locations.
1. Update the "jquery" htmlDependency in `R/shinyui.R` to reflect the new version.
1. Update the documentation for the `shiny.jquery.version` option in `R/shiny-options.R` to reflect the new version.
1. Run `devtools::document()`.
1. Commit the changes.


## Updating Bootstrap-Accessibility-Plugin

1. [bootstrap-accessibility-plugin](https://github.com/paypal/bootstrap-accessibility-plugin) can be updated with the script `updateBootstrapAccessibilityPlugin.R`.
1. Edit `updateBootstrapAccessibilityPlugin.R` to use the new version, and then run it. This will download and copy the files to the relevant locations.
1. Update the documentation for the `bootstrapLib()` function in `R/bootstrap.R` to reflect the new version.
1. Run `devtools::document()`.
1. Commit the changes.


## Updating tom-select

Shiny's `selectInput()` / `selectizeInput()` are powered by
[tom-select](https://tom-select.js.org/), a jQuery-free fork of the now
unmaintained selectize.js. The bundled library lives in
`inst/www/shared/selectize/`. That directory keeps its legacy `selectize` name
(and the htmltools dependency is still named `"selectize"`) so it continues to
de-duplicate with DT, crosstalk, and other packages that bundle selectize.js.

### Updating

1. Bump the `tom-select` version in `package.json`.
1. Run `Rscript tools/updateTomSelect.R` from the repo root. The script:
   - runs `npm install`,
   - copies `tom-select.complete.js` (the build with all bundled plugins) into
     `inst/www/shared/selectize/js/`,
   - writes the detected version to `R/version_selectize.R`,
   - minifies the JS via `npm run bundle_external_libs`, and
   - regenerates the precompiled Bootstrap 3 fallback
     `css/selectize.bootstrap3.css`.
1. Commit the files the script lists when it finishes.

### Customizing the styles

There are no binary patches anymore (the selectize.js integration used to apply
patches from `tools/selectize-patches`). The styles are maintained directly as
Sass sources in `inst/www/shared/selectize/scss/`. Edit those `.scss` files,
then re-run `tools/updateTomSelect.R` to regenerate the precompiled Bootstrap 3
fallback CSS; the bslib-themed Bootstrap 4/5 styles are compiled at runtime.

Keep the sources LibSass-compatible: the `sass` R package does not support Dart
Sass features such as `@use` or case-insensitive `RGBA()`, so prefer plain
`rgba()` and avoid module syntax.

## Updating Shiny's [S]CSS

1. Make any desired changes to source files in `inst/www/shared/shiny_scss`
1. Run `npm run build` to generate a built `shiny.min.css` file
1. Commit any changes
