/* ==========================================================
   Chou Farm Limited - dashboard shell
   Other dashboard files plug in with ChouAdmin.register(...)
   Needs, loaded before it: Supabase library, config.js,
   supabase.js, auth.js
   ========================================================== */
(function () {
  "use strict";

  var Auth = window.ChouAuth;
  var sb = window.sb;
  var app = document.getElementById("admin-app");

  if (!Auth || !Auth.available) {
    app.textContent = "The connection to the backend is not set up. Check js/config.js.";
    return;
  }

  var RANK = { viewer: 1, editor: 2, admin: 3, super_admin: 4 };
  var ROLE_LABELS = {
    viewer: "Viewer",
    editor: "Editor",
    admin: "Administrator",
    super_admin: "Super administrator"
  };

  var profile = null;
  var company = {
    name: "Chou Farm Limited",
    slogan: "Fresh Produce. Premium Quality.",
    logo: ""
  };
  var renderers = {};

  /* The 12 dashboard sections. minRole only hides the link for convenience;
     the database rules are what really protect the data. */
  var ROUTES = [
    { id: "overview",  label: "Overview",                       icon: "layout-dashboard" },
    { id: "website",   label: "Website content",                icon: "panel-top",   phase: "Phase 5",
      text: "Edit the home page, mission and vision, About Us content, team and milestones." },
    { id: "farm",      label: "Farm profile and location",      icon: "map-pin",     phase: "Phase 5",
      text: "Edit the farm description, address, GPS coordinates and map." },
    { id: "crops",     label: "Crop management",                icon: "wheat",       phase: "Phase 5",
      text: "Add, edit, publish and delete crops." },
    { id: "livestock", label: "Livestock management",           icon: "cow-head",        phase: "Phase 5",
      text: "Add, edit, publish and delete livestock species and breeds." },
    { id: "products",  label: "Product catalogue",              icon: "shopping-bag", phase: "Phase 5",
      text: "Manage products, categories, prices and availability." },
    { id: "gallery",   label: "Farm gallery",                   icon: "images",      phase: "Phase 6",
      text: "Upload, organise and publish crop and livestock photographs." },
    { id: "guides",    label: "Farming guides",                 icon: "book-open",   phase: "Phase 6",
      text: "Write, review and publish farming guides." },
    { id: "learning",  label: "Learning materials",             icon: "graduation-cap", phase: "Phase 6",
      text: "Upload documents and set who may view or download them." },
    { id: "news",      label: "News",                           icon: "newspaper",   phase: "Phase 5",
      text: "Write and publish news items." },
    { id: "users",     label: "Users and roles",                icon: "users",       phase: "step 4d", minRole: "super_admin",
      text: "Manage who can sign in and what they can do." },
    { id: "account",   label: "Account and security settings",  icon: "settings" }
  ];

  /* ---------- Small helpers ---------- */
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) { node.className = className; }
    if (text !== undefined) { node.textContent = text; }
    return node;
  }

  function icon(name) {
    return '<i data-lucide="' + name + '" aria-hidden="true"></i>';
  }

  function setText(id, text) {
    var node = document.getElementById(id);
    if (node) { node.textContent = text; }
  }

  function canSee(route) {
    return (RANK[profile.role] || 0) >= (RANK[route.minRole || "viewer"] || 1);
  }

  function findRoute(id) {
    for (var i = 0; i < ROUTES.length; i += 1) {
      if (ROUTES[i].id === id) { return ROUTES[i]; }
    }
    return null;
  }

  function drawIcons() {
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }
  }

  function heading(view, title, subtitle) {
    view.appendChild(el("h1", "admin-title", title));
    if (subtitle) { view.appendChild(el("p", "admin-subtitle", subtitle)); }
  }

  /* ---------- Tool: toast messages ---------- */
  function toast(message, type) {
    var region = document.getElementById("toast-region");
    if (!region) {
      region = el("div", "toast-region");
      region.id = "toast-region";
      region.setAttribute("role", "status");
      region.setAttribute("aria-live", "polite");
      document.body.appendChild(region);
    }

    var node = el("div", "toast is-" + (type || "success"), message);
    region.appendChild(node);

    var timer = window.setTimeout(remove, type === "error" ? 8000 : 5000);
    function remove() {
      window.clearTimeout(timer);
      if (node.parentNode) { node.parentNode.removeChild(node); }
    }
    node.addEventListener("click", remove);
  }

  /* ---------- Tool: "Are you sure?" dialog (returns a promise of true or false) ---------- */
  function confirmDialog(options) {
    options = options || {};

    return new Promise(function (resolve) {
      if (typeof HTMLDialogElement === "undefined") {
        resolve(window.confirm(options.message || "Are you sure?"));
        return;
      }

      var dialog = document.createElement("dialog");
      dialog.className = "dialog";
      dialog.setAttribute("aria-labelledby", "dialog-title");

      var title = el("h2", "", options.title || "Are you sure?");
      title.id = "dialog-title";
      var text = el("p", "", options.message || "");
      var actions = el("div", "dialog-actions");

      var cancel = el("button", "btn btn-secondary", options.cancelLabel || "Cancel");
      cancel.type = "button";
      var ok = el("button", "btn " + (options.danger ? "btn-danger" : "btn-primary"),
                  options.confirmLabel || "Confirm");
      ok.type = "button";

      actions.appendChild(cancel);
      actions.appendChild(ok);
      dialog.appendChild(title);
      dialog.appendChild(text);
      dialog.appendChild(actions);
      document.body.appendChild(dialog);

      var result = false;
      cancel.addEventListener("click", function () { result = false; dialog.close(); });
      ok.addEventListener("click", function () { result = true; dialog.close(); });
      dialog.addEventListener("close", function () {
        if (dialog.parentNode) { dialog.parentNode.removeChild(dialog); }
        resolve(result);
      });

      dialog.showModal();
      cancel.focus();          // the safe choice is focused first
    });
  }

  /* ---------- Tool: write an entry in the audit log ---------- */
  function logAudit(action, tableName, recordId, details) {
    return sb.from("audit_logs").insert({
      user_id: profile.id,
      user_email: profile.email,
      action: action,
      table_name: tableName || null,
      record_id: recordId ? String(recordId) : null,
      details: details || null
    }).then(function (r) { return !r.error; }, function () { return false; });
  }

  /* ---------- What other dashboard files can use ---------- */
  var Admin = {
    sb: sb,
    RANK: RANK,
    ROLE_LABELS: ROLE_LABELS,
    routes: ROUTES,
    profile: null,
    register: function (routeId, renderFunction) { renderers[routeId] = renderFunction; },
    refresh: function () { renderRoute(); },
    logAudit: logAudit,
    ui: { el: el, icon: icon, heading: heading, toast: toast, confirm: confirmDialog, drawIcons: drawIcons }
  };
  window.ChouAdmin = Admin;

  /* ---------- Company name, slogan and logo (public settings) ---------- */
  function loadCompany() {
    return sb.from("site_settings")
      .select("company_name, slogan, logo_path")
      .eq("id", 1)
      .maybeSingle()
      .then(function (r) {
        if (r.error || !r.data) { return; }
        if (r.data.company_name) { company.name = r.data.company_name; }
        if (r.data.slogan) { company.slogan = r.data.slogan; }
        if (r.data.logo_path && /^[A-Za-z0-9\/_.\-]+$/.test(r.data.logo_path) &&
            r.data.logo_path.indexOf("..") === -1) {
          company.logo = sb.storage.from("logo").getPublicUrl(r.data.logo_path).data.publicUrl;
        }
      })
      .catch(function () { /* keep the defaults */ });
  }

  /* ---------- Page shell ---------- */
  function renderShell() {
    var items = ROUTES.filter(canSee).map(function (r) {
      return '<li><a class="nav-link" href="#' + r.id + '" data-route="' + r.id + '">' +
        icon(r.icon) + "<span>" + r.label + "</span></a></li>";
    }).join("");

    app.innerHTML =
      '<a class="skip-link" href="#main">Skip to main content</a>' +

      '<header class="site-header">' +
        '<button class="icon-btn" id="menu-btn" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="sidebar">' + icon("menu") + "</button>" +
        '<a class="brand" href="admin.html">' +
          '<span class="brand-mark" id="brand-mark">' + icon("sprout") + "</span>" +
          '<span class="brand-text"><span class="brand-name" id="brand-name"></span><span class="brand-slogan" id="brand-slogan"></span></span>' +
        "</a>" +
        '<div class="header-admin">' +
          '<div class="user-chip"><span id="chip-name"></span><span class="role-badge" id="chip-role"></span></div>' +
          '<button class="signout-btn" id="signout-btn" type="button" aria-label="Sign out">' + icon("log-out") + '<span class="label">Sign out</span></button>' +
        "</div>" +
      "</header>" +

      '<aside class="sidebar" id="sidebar" aria-label="Dashboard navigation">' +
        '<div class="sidebar-top"><span class="sidebar-title">Dashboard</span>' +
          '<button class="icon-btn" id="close-btn" type="button" aria-label="Close menu">' + icon("x") + "</button></div>" +
        '<nav class="sidebar-nav" aria-label="Dashboard sections"><ul>' + items + "</ul></nav>" +
        '<div class="sidebar-bottom">' +
          '<div class="brand"><span class="brand-text"><span class="brand-name" id="side-name"></span><span class="brand-slogan" id="side-slogan"></span></span></div>' +
          '<p class="field-hint"><a href="index.html">View the public website</a></p>' +
        "</div>" +
      "</aside>" +

      '<main id="main" class="page-main admin-main"><div class="container" id="admin-view" tabindex="-1"></div></main>' +

      '<footer class="site-footer admin-footer"><div class="footer-bottom"><div class="container">' +
        '<span id="footer-text"></span><span><a href="index.html">Public website</a></span>' +
      "</div></div></footer>";

    var overlay = el("div", "overlay");
    overlay.id = "overlay";
    document.body.appendChild(overlay);

    /* Text that comes from data is set as plain text, never as HTML */
    setText("brand-name", company.name);
    setText("brand-slogan", company.slogan);
    setText("side-name", company.name);
    setText("side-slogan", company.slogan);
    setText("chip-name", profile.full_name || profile.email || "");
    setText("chip-role", ROLE_LABELS[profile.role] || profile.role);
    setText("footer-text", "\u00A9 " + new Date().getFullYear() + " " + company.name + ". " + company.slogan);

    if (company.logo) {
      var mark = document.getElementById("brand-mark");
      var logo = el("img", "brand-logo");
      logo.src = company.logo;
      logo.alt = "";
      logo.width = 40;
      logo.height = 40;
      mark.replaceWith(logo);
    }

    drawIcons();
  }

  /* ---------- Sidebar open and close ---------- */
  function setupSidebar() {
    var sidebar = document.getElementById("sidebar");
    var overlay = document.getElementById("overlay");
    var menuBtn = document.getElementById("menu-btn");
    var closeBtn = document.getElementById("close-btn");
    var desktop = window.matchMedia("(min-width: 1024px)");

    function open(focusClose) {
      sidebar.classList.add("open");
      overlay.classList.add("show");
      document.body.classList.add("sidebar-open");
      menuBtn.setAttribute("aria-expanded", "true");
      menuBtn.setAttribute("aria-label", "Close menu");
      if (focusClose) { closeBtn.focus(); }
    }

    function close(returnFocus) {
      sidebar.classList.remove("open");
      overlay.classList.remove("show");
      document.body.classList.remove("sidebar-open");
      menuBtn.setAttribute("aria-expanded", "false");
      menuBtn.setAttribute("aria-label", "Open menu");
      if (returnFocus) { menuBtn.focus(); }
    }

    menuBtn.addEventListener("click", function () {
      if (sidebar.classList.contains("open")) { close(false); } else { open(true); }
    });
    closeBtn.addEventListener("click", function () { close(true); });
    overlay.addEventListener("click", function () { close(true); });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && sidebar.classList.contains("open")) { close(true); }
    });

    sidebar.addEventListener("click", function (event) {
      if (event.target.closest("a[data-route]") && !desktop.matches) { close(false); }
    });

    if (desktop.matches) { open(false); }   // open by default on large screens
  }

  /* ---------- Built-in pages ---------- */
  function countRows(table, status) {
    var query = sb.from(table).select("*", { count: "exact", head: true });
    if (status) { query = query.eq("status", status); }
    return query.then(function (r) { return r.error ? null : r.count; });
  }

  function statCard(label) {
    var card = el("div", "card stat-card");
    var value = el("p", "stat-value", "...");
    var note = el("p", "stat-note", "Loading");
    card.appendChild(el("p", "stat-label", label));
    card.appendChild(value);
    card.appendChild(note);
    return { card: card, value: value, note: note };
  }

  function renderOverview(view) {
    heading(view, "Overview",
      "Welcome, " + (profile.full_name || profile.email) + ". These figures come from your database.");

    var grid = el("div", "stat-grid");
    view.appendChild(grid);

    var content = [
      ["Crops", "crops"],
      ["Livestock", "livestock"],
      ["Products", "products"],
      ["Farming guides", "farming_guides"],
      ["Learning materials", "learning_materials"],
      ["Gallery items", "gallery_items"],
      ["News items", "news_items"]
    ];

    content.forEach(function (item) {
      var stat = statCard(item[0]);
      grid.appendChild(stat.card);

      Promise.all([countRows(item[1]), countRows(item[1], "published")]).then(function (counts) {
        if (counts[0] === null) {
          stat.value.textContent = "-";
          stat.note.textContent = "Could not load";
          return;
        }
        stat.value.textContent = String(counts[0]);
        stat.note.textContent = counts[0] === 0 ? "No records yet" : counts[1] + " published";
      });
    });
  }

  function infoRow(parent, label, value) {
    var row = el("div", "info-row");
    row.appendChild(el("p", "info-label", label));
    row.appendChild(el("p", "info-value", value));
    parent.appendChild(row);
  }

  function renderAccount(view) {
    heading(view, "Account and security settings", "Your sign-in details.");
    var card = el("div", "card");
    infoRow(card, "Name", profile.full_name || "Not set");
    infoRow(card, "Email", profile.email || "");
    infoRow(card, "Role", ROLE_LABELS[profile.role] || profile.role);
    infoRow(card, "Account status", profile.is_active ? "Active" : "Not active");
    view.appendChild(card);
  }

  function renderComingSoon(view, route) {
    heading(view, route.label);
    var card = el("div", "card");
    var badge = el("span", "card-icon");
    badge.innerHTML = icon(route.icon);
    card.appendChild(badge);
    card.appendChild(el("h2", "", "Coming in " + route.phase));
    card.appendChild(el("p", "", route.text));
    card.appendChild(el("p", "field-hint", "This manager has not been built yet."));
    view.appendChild(card);
  }

  function renderDenied(view) {
    heading(view, "No access");
    var card = el("div", "card");
    card.appendChild(el("p", "", "Your role does not include this section."));
    view.appendChild(card);
  }

  function renderLoadError(view, error) {
    if (window.console) { window.console.error(error); }
    view.appendChild(el("p", "form-message is-error",
      "This section could not be loaded. Please refresh the page and try again."));
  }

  /* ---------- Simple router (the part after # in the address) ---------- */
  var firstRender = true;

  function renderRoute() {
    var id = (window.location.hash || "#overview").slice(1);
    var route = findRoute(id) || findRoute("overview");
    var view = document.getElementById("admin-view");

    view.innerHTML = "";

    var links = document.querySelectorAll("#sidebar a[data-route]");
    Array.prototype.forEach.call(links, function (link) {
      var active = link.getAttribute("data-route") === route.id;
      link.classList.toggle("active", active);
      if (active) { link.setAttribute("aria-current", "page"); } else { link.removeAttribute("aria-current"); }
    });

    document.title = route.label + " | Admin | " + company.name;

    if (!canSee(route)) {
      renderDenied(view);
    } else if (renderers[route.id]) {
      try {
        var result = renderers[route.id](view);
        if (result && typeof result.catch === "function") {
          result.catch(function (error) { renderLoadError(view, error); });
        }
      } catch (error) {
        renderLoadError(view, error);
      }
    } else if (route.id === "overview") {
      renderOverview(view);
    } else if (route.id === "account") {
      renderAccount(view);
    } else {
      renderComingSoon(view, route);
    }

    drawIcons();
    if (!firstRender) { view.focus(); }
    firstRender = false;
  }

  /* ---------- Start ---------- */
  Auth.requireStaff().then(function (staffProfile) {
    if (!staffProfile) { return; }          // sent back to the sign-in page
    profile = staffProfile;
    Admin.profile = staffProfile;

    return loadCompany().then(function () {
      renderShell();
      setupSidebar();

      document.getElementById("signout-btn").addEventListener("click", function () {
        Auth.signOut();
      });

      window.addEventListener("hashchange", renderRoute);
      Auth.watchSession();
      renderRoute();
    });
  }).catch(function () {
    app.textContent = "Something went wrong while opening the dashboard. Please refresh the page.";
  });
})();