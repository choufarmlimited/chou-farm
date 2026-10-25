/* ==========================================================
   Chou Farm Limited - dashboard manager engine
   Lists, forms, publishing and deleting for any database table.
   Each manager is a small settings file that calls
   ChouCrud.register({...}) or ChouCrud.registerTabs({...}).
   Loaded after js/admin.js
   ========================================================== */
(function () {
  "use strict";

  var Admin = window.ChouAdmin;
  if (!Admin) { return; }

  var ui = Admin.ui;
  var sb = Admin.sb;
  var Editor = window.ChouEditor;
  var Sanitize = window.ChouSanitize;
  var PAGE_SIZE = 10;

  var STATUS_LABELS = { draft: "Draft", published: "Published", archived: "Archived" };
  var STATUS_BADGES = { draft: "badge-limited", published: "badge-in", archived: "badge-out" };

  /* ---------- Helpers ---------- */
  function roleAtLeast(role) {
    return (Admin.RANK[Admin.profile.role] || 0) >= (Admin.RANK[role] || 0);
  }
  function canEdit(cfg) { return roleAtLeast(cfg.minEditRole || "editor"); }
  function canDelete(cfg) { return roleAtLeast(cfg.minDeleteRole || "admin"); }
  function hasStatus(cfg) { return cfg.hasStatus !== false; }

  function formatDate(value) {
    if (!value) { return ""; }
    var date = new Date(value);
    if (isNaN(date.getTime())) { return ""; }
    return new Intl.DateTimeFormat("en-KE", {
      timeZone: "Africa/Nairobi", day: "numeric", month: "short", year: "numeric"
    }).format(date);
  }

  function recordTitle(cfg, record) {
    var value = record && record[cfg.titleField];
    return value ? String(value) : "(no title)";
  }

  function friendlyError(error) {
    var code = error && error.code;
    var text = ((error && error.message) || "").toLowerCase();
    if (code === "23505") { return "That value is already used. Please choose a different one."; }
    if (code === "23514") { return "One of the values is not allowed. Please check the form."; }
    if (code === "23503") { return "This record is linked to other records, so the change was refused."; }
    if (code === "42501" || text.indexOf("row-level security") !== -1) {
      return "Your role does not allow this action.";
    }
    return "The action could not be completed. Please try again.";
  }

  function safeSearch(text) {
    return text.replace(/[,()*%\\"']/g, " ").replace(/\s+/g, " ").trim();
  }

  function button(label, className, onClick) {
    var node = ui.el("button", "btn " + className, label);
    node.type = "button";
    if (onClick) { node.addEventListener("click", onClick); }
    return node;
  }

  /* ==========================================================
     The list
     ========================================================== */
  function showList(host, cfg, goForm) {
    var state = { page: 0, q: "", status: "" };
    var editable = canEdit(cfg);
    host.innerHTML = "";

    /* Search, filter and Add */
    var bar = document.createElement("form");
    bar.className = "crud-toolbar";
    bar.setAttribute("role", "search");

    var searchInput = null;
    if (cfg.searchColumns && cfg.searchColumns.length) {
      var searchField = ui.el("div", "field");
      var searchLabel = ui.el("label", "", "Search");
      searchLabel.setAttribute("for", "crud-search-" + cfg.table);
      searchInput = ui.el("input", "input");
      searchInput.id = "crud-search-" + cfg.table;
      searchInput.type = "search";
      searchInput.maxLength = 100;
      searchInput.placeholder = cfg.searchHint || "Search";
      var searchRow = ui.el("div", "search-row");
      var searchButton = ui.el("button", "btn btn-secondary", "Search");
      searchButton.type = "submit";
      searchRow.appendChild(searchInput);
      searchRow.appendChild(searchButton);
      searchField.appendChild(searchLabel);
      searchField.appendChild(searchRow);
      bar.appendChild(searchField);
    }

    var statusSelect = null;
    if (hasStatus(cfg)) {
      var statusField = ui.el("div", "field");
      var statusLabel = ui.el("label", "", "Status");
      statusLabel.setAttribute("for", "crud-status-" + cfg.table);
      statusSelect = ui.el("select", "input");
      statusSelect.id = "crud-status-" + cfg.table;
      [["", "All"], ["draft", "Draft"], ["published", "Published"], ["archived", "Archived"]].forEach(function (o) {
        var option = ui.el("option", "", o[1]);
        option.value = o[0];
        statusSelect.appendChild(option);
      });
      statusField.appendChild(statusLabel);
      statusField.appendChild(statusSelect);
      bar.appendChild(statusField);
    }

    if (editable) {
      bar.appendChild(button("Add " + cfg.singular, "btn-primary", function () { goForm(null); }));
    }
    host.appendChild(bar);

    var results = ui.el("div", "record-list");
    results.setAttribute("aria-live", "polite");
    var pager = ui.el("div", "pager");
    host.appendChild(results);
    host.appendChild(pager);

    bar.addEventListener("submit", function (event) {
      event.preventDefault();
      state.q = searchInput ? safeSearch(searchInput.value) : "";
      state.page = 0;
      load();
    });
    if (statusSelect) {
      statusSelect.addEventListener("change", function () {
        state.status = statusSelect.value;
        state.page = 0;
        load();
      });
    }

    /* Status changes and deleting */
    function changeStatus(record, newStatus) {
      var payload = { status: newStatus };
      if (cfg.publishDate && newStatus === "published" && !record.published_at) {
        payload.published_at = new Date().toISOString();
      }
      return sb.from(cfg.table).update(payload).eq("id", record.id).select("id").then(function (r) {
        if (r.error || !r.data || r.data.length === 0) {
          ui.toast(r.error ? friendlyError(r.error) : "Your role does not allow this action.", "error");
          return;
        }
        ui.toast("Marked as " + STATUS_LABELS[newStatus].toLowerCase() + ".", "success");
        Admin.logAudit(cfg.table + "_status_changed", cfg.table, record.id,
          { title: recordTitle(cfg, record), from: record.status, to: newStatus });
      }).then(load);
    }

    function removeRecord(record) {
      return ui.confirm({
        title: "Delete this " + cfg.singular + "?",
        message: "\"" + recordTitle(cfg, record) + "\" will be deleted permanently. This cannot be undone.",
        confirmLabel: "Delete",
        danger: true
      }).then(function (agreed) {
        if (!agreed) { return; }
        return sb.from(cfg.table).delete().eq("id", record.id).select("id").then(function (r) {
          if (r.error || !r.data || r.data.length === 0) {
            ui.toast(r.error ? friendlyError(r.error) : "Your role does not allow this action.", "error");
            return;
          }
          ui.toast("Deleted.", "success");
          Admin.logAudit(cfg.table + "_deleted", cfg.table, record.id, { title: recordTitle(cfg, record) });
        }).then(load);
      });
    }

    /* One record */
    function recordCard(record) {
      var card = ui.el("article", "card record-card");

      var top = ui.el("div", "record-top");
      top.appendChild(ui.el("h3", "", recordTitle(cfg, record)));
      if (hasStatus(cfg)) {
        top.appendChild(ui.el("span", "badge " + (STATUS_BADGES[record.status] || ""),
                              STATUS_LABELS[record.status] || record.status));
      }
      card.appendChild(top);

      var details = [];
      if (cfg.subtitle) { details.push(cfg.subtitle(record)); }
      if (record.updated_at) { details.push("Updated " + formatDate(record.updated_at)); }
      details = details.filter(function (d) { return d; });
      if (details.length) { card.appendChild(ui.el("p", "record-meta", details.join(" | "))); }

      var actions = ui.el("div", "record-actions");
      actions.appendChild(button(editable ? "Edit" : "View", "btn-secondary", function () { goForm(record); }));

      if (editable && hasStatus(cfg)) {
        if (record.status === "published") {
          actions.appendChild(button("Unpublish", "btn-secondary", function () { changeStatus(record, "draft"); }));
        } else {
          actions.appendChild(button("Publish", "btn-primary", function () { changeStatus(record, "published"); }));
        }
        if (record.status !== "archived") {
          actions.appendChild(button("Archive", "btn-secondary", function () { changeStatus(record, "archived"); }));
        }
      }
      if (canDelete(cfg)) {
        actions.appendChild(button("Delete", "btn-danger-outline", function () { removeRecord(record); }));
      }
      card.appendChild(actions);
      return card;
    }

    /* Load one page */
    function load() {
      results.innerHTML = "";
      results.appendChild(ui.el("p", "field-hint", "Loading..."));
      pager.innerHTML = "";

      var query = sb.from(cfg.table).select(cfg.listSelect || "*", { count: "exact" });
      if (hasStatus(cfg) && state.status) { query = query.eq("status", state.status); }
      if (state.q && cfg.searchColumns) {
        query = query.or(cfg.searchColumns.map(function (c) { return c + ".ilike.*" + state.q + "*"; }).join(","));
      }
      (cfg.orderBy || [{ column: "created_at", ascending: false }]).forEach(function (o) {
        query = query.order(o.column, { ascending: o.ascending !== false });
      });

      var from = state.page * PAGE_SIZE;
      return query.range(from, from + PAGE_SIZE - 1).then(function (r) {
        results.innerHTML = "";

        if (r.error) {
          results.appendChild(ui.el("p", "form-message is-error", "The list could not be loaded. Please try again."));
          return;
        }

        var rows = r.data || [];
        var total = r.count || 0;

        if (rows.length === 0 && state.page > 0) { state.page = 0; return load(); }

        if (rows.length === 0) {
          var empty = ui.el("div", "empty-state");
          var filtered = state.q || state.status;
          empty.appendChild(ui.el("p", "", filtered
            ? "No " + cfg.plural + " match your search."
            : "No " + cfg.plural + " yet." + (editable ? " Tap \"Add " + cfg.singular + "\" to create the first one." : "")));
          results.appendChild(empty);
          return;
        }

        rows.forEach(function (row) { results.appendChild(recordCard(row)); });

        var pages = Math.ceil(total / PAGE_SIZE);
        pager.appendChild(ui.el("span", "field-hint",
          "Showing " + (from + 1) + " to " + (from + rows.length) + " of " + total));
        if (pages > 1) {
          var prev = button("Previous", "btn-secondary", function () { state.page -= 1; load(); });
          var next = button("Next", "btn-secondary", function () { state.page += 1; load(); });
          prev.disabled = state.page === 0;
          next.disabled = state.page >= pages - 1;
          pager.appendChild(prev);
          pager.appendChild(next);
        }
      });
    }

    load();
  }

  /* ==========================================================
     The form (add, edit, or view)
     ========================================================== */
  function buildField(cfg, field, record, readOnly, readers, loads) {
    var id = "f-" + cfg.table + "-" + field.key;
    var wrap = ui.el("div", "field");
    var value;
    if (record) { value = record[field.key]; }
    else if (cfg.defaults && cfg.defaults[field.key] !== undefined) { value = cfg.defaults[field.key]; }
    else { value = field.default; }
    if (value === null || value === undefined) { value = ""; }

    function addHint() {
      if (field.hint) { wrap.appendChild(ui.el("p", "field-hint", field.hint)); }
    }
    function labelText() {
      return field.label + (field.required ? " (required)" : "");
    }
    function addLabel() {
      var label = ui.el("label", "", labelText());
      label.setAttribute("for", id);
      wrap.appendChild(label);
    }

    /* Checkbox */
    if (field.type === "checkbox") {
      var row = ui.el("label", "check-row");
      var box = document.createElement("input");
      box.type = "checkbox";
      box.id = id;
      box.checked = !!(record ? record[field.key] : (cfg.defaults && cfg.defaults[field.key]));
      box.disabled = readOnly;
      row.appendChild(box);
      row.appendChild(document.createTextNode(field.label));
      wrap.appendChild(row);
      addHint();
      readers.push({ key: field.key, control: box, read: function () { return { value: box.checked }; } });
      return wrap;
    }

    /* Rich text */
    if (field.type === "richtext") {
      var caption = ui.el("label", "", labelText());
      wrap.appendChild(caption);
      var editorBox = ui.el("div", "rt-editor");
      var editorHost = ui.el("div");
      editorBox.appendChild(editorHost);
      wrap.appendChild(editorBox);
      addHint();

      if (Editor) {
        var editor = Editor.create(editorHost, { label: field.label, placeholder: field.placeholder || "" });
        editor.setHTML(value);
        if (readOnly) { editor.setReadOnly(true); }
        readers.push({
          key: field.key,
          control: { focus: function () { editor.focus(); } },
          read: function () {
            var html = editor.getHTML();
            if (field.required && html === "") { return { error: field.label + " is required." }; }
            return { value: html };
          }
        });
      } else {
        /* Fallback if the editor could not load: a plain box, still cleaned on save */
        var fallback = ui.el("textarea", "input");
        fallback.value = Sanitize ? Sanitize.toText(value) : "";
        fallback.disabled = readOnly;
        editorHost.appendChild(fallback);
        readers.push({
          key: field.key,
          control: fallback,
          read: function () {
            var html = Sanitize ? Sanitize.clean(fallback.value) : "";
            if (field.required && html === "") { return { error: field.label + " is required." }; }
            return { value: html };
          }
        });
      }
      return wrap;
    }

    addLabel();
    var control;

    if (field.type === "textarea") {
      control = ui.el("textarea", "input");
      control.rows = 4;
      control.maxLength = field.max || 2000;
      control.value = value;
    } else if (field.type === "select" || field.type === "relation") {
      control = ui.el("select", "input");
      if (field.type === "relation" || !field.required) {
        var none = ui.el("option", "", field.type === "relation" ? "None" : "Choose...");
        none.value = "";
        control.appendChild(none);
      }
      if (field.type === "select") {
        field.options.forEach(function (o) {
          var option = ui.el("option", "", o[1]);
          option.value = o[0];
          control.appendChild(option);
        });
        control.value = value;
      } else {
        var valueKey = field.valueKey || "id";
        var labelKey = field.labelKey || "name";
        loads.push(
          sb.from(field.table).select(valueKey + ", " + labelKey).order(labelKey).then(function (r) {
            (r.data || []).forEach(function (item) {
              var option = ui.el("option", "", item[labelKey]);
              option.value = item[valueKey];
              control.appendChild(option);
            });
            control.value = value;
          })
        );
      }
    } else if (field.type === "number") {
      control = ui.el("input", "input");
      control.type = "number";
      control.inputMode = "decimal";
      control.step = field.step || "1";
      if (field.min !== undefined) { control.min = field.min; }
      if (field.max !== undefined) { control.max = field.max; }
      control.value = value;
    } else {
      control = ui.el("input", "input");
      control.type = field.inputType || "text";
      control.maxLength = field.max || 200;
      control.value = value;
    }

    control.id = id;
    control.disabled = readOnly;
    wrap.appendChild(control);
    addHint();

    readers.push({
      key: field.key,
      control: control,
      read: function () {
        var raw = control.value;

        if (field.type === "number") {
          raw = raw.trim();
          if (raw === "") {
            if (field.required) { return { error: field.label + " is required." }; }
            return { value: field.nullable ? null : (field.default || 0) };
          }
          var number = Number(raw);
          if (isNaN(number)) { return { error: field.label + " must be a number." }; }
          if (field.min !== undefined && number < field.min) { return { error: field.label + " must be at least " + field.min + "." }; }
          if (field.max !== undefined && number > field.max) { return { error: field.label + " must be at most " + field.max + "." }; }
          return { value: number };
        }

        if (field.type === "select" || field.type === "relation") {
          if (raw === "") {
            if (field.required) { return { error: "Choose a value for " + field.label + "." }; }
            return { value: field.type === "relation" || field.nullable ? null : "" };
          }
          return { value: raw };
        }

        var text = raw.trim();
        if (field.required && text === "") { return { error: field.label + " is required." }; }
        if (text === "" && field.nullable) { return { value: null }; }
        return { value: text };
      }
    });
    return wrap;
  }

  function showForm(host, cfg, record, goList, goForm) {
    host.innerHTML = "";

    var readOnly = !canEdit(cfg);
    var readers = [];
    var loads = [];
    var card = ui.el("div", "card form-card");

    /* Heading and back link */
    var head = ui.el("div", "user-card-head");
    var headingText = function () {
      if (cfg.single) { return cfg.title; }
      if (readOnly) { return "View " + cfg.singular; }
      return record ? "Edit " + cfg.singular : "Add " + cfg.singular;
    };
    var heading = ui.el("h2", "", headingText());
    head.appendChild(heading);
    if (goList) {
      var back = ui.el("button", "link-button", "Back to the list");
      back.type = "button";
      back.addEventListener("click", goList);
      head.appendChild(back);
    }
    card.appendChild(head);

    var meta = ui.el("p", "record-meta", "");
    function updateMeta() {
      meta.textContent = record && record.updated_at ? "Last saved " + formatDate(record.updated_at) : "";
    }
    updateMeta();
    card.appendChild(meta);

    var message = ui.el("p", "form-message", "");
    message.setAttribute("role", "alert");
    message.hidden = true;
    card.appendChild(message);

    function showMessage(text) {
      if (!text) { message.hidden = true; message.textContent = ""; return; }
      message.textContent = text;
      message.className = "form-message is-error";
      message.hidden = false;
      message.scrollIntoView({ block: "center" });
    }

    /* Fields */
    var form = document.createElement("form");
    form.className = "stack";
    form.noValidate = true;

    cfg.fields.forEach(function (field) {
      form.appendChild(buildField(cfg, field, record, readOnly, readers, loads));
    });

    /* Publication status */
    if (hasStatus(cfg)) {
      var statusWrap = ui.el("div", "field");
      var statusLabel = ui.el("label", "", "Publication status");
      statusLabel.setAttribute("for", "f-" + cfg.table + "-status");
      var statusSelect = ui.el("select", "input");
      statusSelect.id = "f-" + cfg.table + "-status";
      ["draft", "published", "archived"].forEach(function (s) {
        var option = ui.el("option", "", STATUS_LABELS[s]);
        option.value = s;
        statusSelect.appendChild(option);
      });
      statusSelect.value = record ? record.status : (cfg.defaults && cfg.defaults.status) || "draft";
      statusSelect.disabled = readOnly;
      statusWrap.appendChild(statusLabel);
      statusWrap.appendChild(statusSelect);
      statusWrap.appendChild(ui.el("p", "field-hint",
        "Draft: only staff can see it. Published: visible on the website. Archived: hidden but kept."));
      form.appendChild(statusWrap);
      readers.push({
        key: "status",
        control: statusSelect,
        read: function () { return { value: statusSelect.value }; }
      });
    }

    /* Buttons */
    var saveButton = null;
    if (!readOnly) {
      var actions = ui.el("div", "form-actions");
      saveButton = ui.el("button", "btn btn-primary", "Save");
      saveButton.type = "submit";
      actions.appendChild(saveButton);
      if (goList) { actions.appendChild(button("Cancel", "btn-secondary", goList)); }
      form.appendChild(actions);
    }

    card.appendChild(form);
    host.appendChild(card);

    /* Extra panels (photos are added here in Phase 6) */
    if (record && cfg.afterForm) {
      var extra = ui.el("div", "extra-panel");
      host.appendChild(extra);
      cfg.afterForm(extra, record, { readOnly: readOnly });
    }

    /* Save */
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (readOnly) { return; }

      var values = {};
      var firstError = null;
      readers.forEach(function (reader) {
        var out = reader.read();
        if (out.error) {
          if (!firstError) { firstError = { text: out.error, control: reader.control }; }
        } else {
          values[reader.key] = out.value;
        }
      });

      if (firstError) {
        showMessage(firstError.text);
        if (firstError.control && firstError.control.focus) { firstError.control.focus(); }
        return;
      }

      if (cfg.publishDate && values.status === "published" && !(record && record.published_at)) {
        values.published_at = new Date().toISOString();
      }

      showMessage("");
      saveButton.disabled = true;
      saveButton.textContent = "Saving...";
      saveButton.setAttribute("aria-busy", "true");

      var wasNew = !record;
      var request;
      if (cfg.single) {
        values.id = cfg.rowId;
        request = sb.from(cfg.table).upsert(values).select().single();
      } else if (wasNew) {
        request = sb.from(cfg.table).insert(values).select().single();
      } else {
        request = sb.from(cfg.table).update(values).eq("id", record.id).select().single();
      }

      request.then(function (r) {
        saveButton.disabled = false;
        saveButton.textContent = "Save";
        saveButton.removeAttribute("aria-busy");

        if (r.error || !r.data) {
          showMessage(r.error ? friendlyError(r.error) : "Your role does not allow this action.");
          return;
        }

        ui.toast("Saved.", "success");
        Admin.logAudit(cfg.table + (wasNew ? "_created" : "_updated"), cfg.table,
          r.data.id, { title: recordTitle(cfg, r.data) });

        if (wasNew && !cfg.single) {
          goForm(r.data);               // reopen in edit mode (photos can be added from here)
        } else {
          record = r.data;
          heading.textContent = headingText();
          updateMeta();
        }
      }).catch(function () {
        saveButton.disabled = false;
        saveButton.textContent = "Save";
        saveButton.removeAttribute("aria-busy");
        showMessage("Could not reach the server. Check your internet connection and try again.");
      });
    });
  }

  /* ==========================================================
     Put a manager on the page
     ========================================================== */
  function mount(host, cfg) {
    function listView() { showList(host, cfg, formView); }
    function formView(record) { showForm(host, cfg, record, listView, formView); }

    if (cfg.single) {
      host.appendChild(ui.el("p", "field-hint", "Loading..."));
      sb.from(cfg.table).select("*").eq("id", cfg.rowId).maybeSingle().then(function (r) {
        host.innerHTML = "";
        if (r.error) {
          host.appendChild(ui.el("p", "form-message is-error", "This section could not be loaded. Please try again."));
          return;
        }
        showForm(host, cfg, r.data, null, null);
      });
    } else {
      listView();
    }
  }

  /* One manager on its own dashboard page */
  function register(cfg) {
    Admin.register(cfg.route, function (view) {
      ui.heading(view, cfg.title, cfg.intro);
      var host = ui.el("div");
      view.appendChild(host);
      mount(host, cfg);
    });
  }

  /* Several managers on one dashboard page, as tabs */
  function registerTabs(options) {
    Admin.register(options.route, function (view) {
      ui.heading(view, options.title, options.intro);

      var tabBar = ui.el("div", "tabs");
      tabBar.setAttribute("role", "tablist");
      var panel = ui.el("div", "tab-panel");
      panel.setAttribute("role", "tabpanel");
      view.appendChild(tabBar);
      view.appendChild(panel);

      var buttons = [];
      function select(index) {
        buttons.forEach(function (b, i) {
          b.className = "tab" + (i === index ? " is-active" : "");
          b.setAttribute("aria-selected", i === index ? "true" : "false");
        });
        mount(panel, options.tabs[index].config);
      }

      options.tabs.forEach(function (tab, index) {
        var tabButton = ui.el("button", "tab", tab.label);
        tabButton.type = "button";
        tabButton.setAttribute("role", "tab");
        tabButton.addEventListener("click", function () { select(index); });
        buttons.push(tabButton);
        tabBar.appendChild(tabButton);
      });
      select(0);
    });
  }

  window.ChouCrud = { register: register, registerTabs: registerTabs };
})();