test_that("performance warning works", {
  pattern <- "consider using server-side selectize"

  expect_no_warning(selectInput("x", "x", as.character(1:999)))
  expect_no_warning(selectInput("x", "x", as.character(1:999), selectize = TRUE))
  expect_no_warning(selectInput("x", "x", as.character(1:999), selectize = FALSE))
  expect_no_warning(selectizeInput("x", "x", as.character(1:999)))

  expect_warning(selectInput("x", "x", as.character(1:1000)), pattern)
  expect_warning(selectInput("x", "x", as.character(1:1000), selectize = TRUE), pattern)
  expect_warning(selectInput("x", "x", as.character(1:1000), selectize = FALSE), pattern)
  expect_warning(selectizeInput("x", "x", as.character(1:1000)), pattern)
  expect_warning(selectInput("x", "x", as.character(1:2000)), pattern)
  expect_warning(selectInput("x", "x", as.character(1:2000), selectize = TRUE), pattern)
  expect_warning(selectInput("x", "x", as.character(1:2000), selectize = FALSE), pattern)
  expect_warning(selectizeInput("x", "x", as.character(1:2000)), pattern)

  session <- MockShinySession$new()

  expect_no_warning(updateSelectInput(session, "x", choices = as.character(1:999)))
  expect_no_warning(updateSelectizeInput(session, "x", choices = as.character(1:999)))
  expect_no_warning(updateSelectizeInput(session, "x", choices = as.character(1:999), server = FALSE))

  expect_warning(updateSelectInput(session, "x", choices = as.character(1:1000)), pattern)
  expect_warning(updateSelectizeInput(session, "x", choices = as.character(1:1000)), pattern)
  expect_warning(updateSelectizeInput(session, "x", choices = as.character(1:1000), server = FALSE), pattern)
  expect_warning(updateSelectInput(session, "x", choices = as.character(1:2000)), pattern)
  expect_warning(updateSelectizeInput(session, "x", choices = as.character(1:2000)), pattern)
  expect_warning(updateSelectizeInput(session, "x", choices = as.character(1:2000), server = FALSE), pattern)

  expect_no_warning(updateSelectizeInput(session, "x", choices = as.character(1:999), server = TRUE))
  expect_no_warning(updateSelectizeInput(session, "x", choices = as.character(1:1000), server = TRUE))
  expect_no_warning(updateSelectizeInput(session, "x", choices = as.character(1:2000), server = TRUE))
})


test_that("jqueryui is NOT attached when drag_drop plugin is present (tom-select uses native DnD)", {
  x <- selectizeInput("test", "test", choices = 1:3, multiple = TRUE, options = list(plugins = "drag_drop"))
  deps <- htmltools::resolveDependencies(htmltools::htmlDependencies(x))
  dep_names <- vapply(deps, `[[`, character(1), "name")
  expect_length(deps, 1)
  expect_false("jqueryui" %in% dep_names)
  expect_true("tom-select" %in% dep_names)
})

test_that("the selectize dependency is named 'tom-select' so it coexists with DT/crosstalk selectize.js", {
  # htmltools de-duplicates by name and keeps the highest version. If Shiny's
  # tom-select dependency were named "selectize" (as DT/crosstalk's selectize.js
  # dependency is), Shiny's newer version would clobber theirs and break e.g.
  # DT's column filters. A distinct name lets both load on the same page.
  static_dep <- selectizeStaticDependency(version_selectize)
  expect_identical(static_dep$name, "tom-select")

  # Simulate a page using both Shiny's selectInput and DT's selectize.js.
  fake_dt <- htmltools::htmlDependency(
    "selectize", "0.12.0", src = system.file(package = "shiny"),
    all_files = FALSE
  )
  resolved <- htmltools::resolveDependencies(list(fake_dt, static_dep))
  resolved_names <- vapply(resolved, `[[`, character(1), "name")
  expect_true("selectize" %in% resolved_names)   # DT's selectize.js survives
  expect_true("tom-select" %in% resolved_names)  # Shiny's tom-select survives
})

test_that("non-a11y plugins do not trigger the deprecation warning", {
  # A real tom-select plugin passes through untouched and silently.
  expect_no_warning(
    selectizeInput(
      "test", "test", choices = 1:3, multiple = TRUE,
      options = list(plugins = "drag_drop")
    )
  )
  # No plugins at all: no warning.
  expect_no_warning(selectizeInput("test", "test", choices = 1:3))
})


test_that("selectInput options are properly escaped", {
  si <- selectInput("quote", "Quote", list(
    "\"Separators\"" = list(
      "None" = "",
      "Double quote" = "\"",
      "Single quote" = "'"
    )
  ))

  si_str <- as.character(si)
  expect_match(si_str, "<option value=\"&quot;\">", fixed = TRUE, all = FALSE)
  expect_match(si_str, "<option value=\"&#39;\">", fixed = TRUE, all = FALSE)
  expect_match(si_str, "<optgroup label=\"&quot;Separators&quot;\">", fixed = TRUE, all = FALSE)
})


test_that("selectInputUI has a select at an expected location", {
  for (multiple in c(TRUE, FALSE)) {
    for (selected in list(NULL, "", "A")) {
      for (selectize in c(TRUE, FALSE)) {
        selectInputVal <- selectInput(
          inputId = "testId",
          label = "test label",
          choices = c("A", "B", "C"),
          selected = selected,
          multiple = multiple,
          selectize = selectize
        )
        # if this getter is changed, varSelectInput getter needs to be changed
        selectHtml <- selectInputVal$children[[2]]$children[[1]]
        expect_s3_class(selectHtml, "shiny.tag")
        expect_equal(selectHtml$name, "select")
        if (!is.null(selectHtml$attribs$class)) {
          expect_no_match(selectHtml$attribs$class, "symbol")
        }

        varSelectInputVal <- varSelectInput(
          inputId = "testId",
          label = "test label",
          data = data.frame(A = 1:2, B = 3:4, C = 5:6),
          selected = selected,
          multiple = multiple,
          selectize = selectize
        )
        # if this getter is changed, varSelectInput getter needs to be changed
        varSelectHtml <- varSelectInputVal$children[[2]]$children[[1]]
        expect_s3_class(varSelectHtml, "shiny.tag")
        expect_equal(varSelectHtml$name, "select")
        expect_match(varSelectHtml$attribs$class, "symbol", fixed = TRUE)
      }
    }
  }
})

# --- tom-select migration tests ---

test_that("selectize-plugin-a11y is stripped (with a warning) but co-listed plugins survive", {
  # The warning uses .frequency = "once", so reset rlang's per-session cache to
  # keep this assertion deterministic regardless of whether an earlier test (or
  # test run) already triggered it.
  rlang::reset_warning_verbosity("shiny_deprecated_a11y_plugin")
  expect_warning(
    x <- selectizeInput("test", "test", choices = 1:3,
                        options = list(plugins = list("selectize-plugin-a11y", "remove_button"))),
    class = "shiny_deprecated_a11y_plugin"
  )
  # The script tag is the second child of the inner div (after the select element)
  script_tag <- x$children[[2]]$children[[2]]
  json <- jsonlite::fromJSON(as.character(script_tag$children[[1]]))
  plugins <- unlist(json$plugins)
  expect_false("selectize-plugin-a11y" %in% plugins)
  expect_true("remove_button" %in% plugins)
})

test_that("selectizeScripts() returns a single path (no a11y plugin script)", {
  scripts <- selectizeScripts()
  expect_length(scripts, 1)
  expect_match(scripts, "tom-select")
})

test_that("version_selectize is the tom-select version (2.x)", {
  expect_match(version_selectize, "^2\\.")
})

test_that("static Bootstrap 3 fallback CSS is fully compiled (no uncompiled Sass)", {
  # css/selectize.bootstrap3.css is served *raw* to apps without a bslib theme
  # (selectizeStaticDependency()), so it must be valid, fully-compiled CSS.
  # Guard against a regression where the .scss source ships minified but
  # uncompiled. Uppercase RGB()/RGBA() are LibSass passthroughs of Dart-Sass-only
  # idioms; lowercase rgba() is legitimate compiled output and is allowed.
  css_path <- system.file(
    "www/shared/selectize/css/selectize.bootstrap3.css", package = "shiny"
  )
  expect_true(file.exists(css_path))
  css <- paste(readLines(css_path, warn = FALSE), collapse = "\n")
  expect_false(
    grepl("@use|@import|\\bmath\\.|color-contrast\\(|\\bRGBA?\\(", css),
    info = "selectize.bootstrap3.css contains uncompiled Sass tokens"
  )
})

test_that("non-bslib (theme = NULL) apps resolve to the static fallback CSS", {
  dep <- selectizeDependencyFunc(NULL)
  expect_identical(dep$stylesheet, "css/selectize.bootstrap3.css")
})
