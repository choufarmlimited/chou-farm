/* ==========================================================
   Chou Farm Limited - site search
   A search window opened from the magnifying-glass button in the
   header. Shows only published content (the database enforces this).
   Loaded by js/layout.js once the database connection is ready.
   ========================================================== */
(function () {
  "use strict";

  if (!window.sb) { return; }

  var sb = window.sb;

  var PAGES = [
    ["Home", "index.html"], ["About Us", "about.html"], ["Our Farm", "farm.html"],
    ["Crop Production", "crop-production.html"], ["Livestock Production", "livestock-production.html"],
    ["Sales", "sales.html"], ["Farm Gallery", "gallery.html"], ["Farming Guides", "guides.html"],
    ["Learning Materials", "learning.html"], ["News", "news.html"], ["Contact Us", "contact.html"],
    ["Privacy policy", "privacy.html"], ["Terms of use", "terms.html"],
    ["Accessibility statement", "accessibility.html"]
  ];

  var dialog = null;
  var parts = {};
  var opener = null;
  var timer = null;
  var ticket = 0;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) { node.className = className; }
    if (text !== undefined) { node.textContent = text; }
    return node;
  }

  function clean(text) {
    return text.replace(/[,()*%\\"']/g, " ").replace(/\s+/g, " ").trim();
  }

  function safe(request) {
    return request.then(function (result) {
      return result.error ? [] : (result.data || []);
    }, function () { return []; });
  }

  function like(columns, q) {
    return columns.map(function (column) { return column + ".ilike.*" + q + "*"; }).join(",");
  }

  /* Each group: heading, the request, and how to turn a row into a link */
  function groups(q) {
    return [
      ["Products",
        safe(sb.from("products").select("id, name").eq("status", "published").or(like(["name"], q)).limit(5)),
        function (r) { return [r.name, "product.html?id=" + encodeURIComponent(r.id)]; }],
      ["Farming guides",
        safe(sb.from("farming_guides").select("id, title").eq("status", "published").or(like(["title", "summary"], q)).limit(5)),
        function (r) { return [r.title, "guide.html?id=" + encodeURIComponent(r.id)]; }],
      ["Crops",
        safe(sb.from("crops").select("id, name").eq("status", "published").or(like(["name", "category"], q)).limit(5)),
        function (r) { return [r.name, "crop-production.html"]; }],
      ["Livestock",
        safe(sb.from("livestock").select("id, species, breed").eq("status", "published").or(like(["species", "breed"], q)).limit(5)),
        function (r) { return [r.species + (r.breed ? " (" + r.breed + ")" : ""), "livestock-production.html"]; }],
      ["News",
        safe(sb.from("news_items").select("id, title").eq("status", "published").or(like(["title", "summary"], q)).limit(5)),
        function (r) { return [r.title, "news.html#news-" + encodeURIComponent(r.id)]; }],
      ["Learning materials",
        safe(sb.from("learning_materials").select("id, title").eq("status", "published").or(like(["title", "description"], q)).limit(5)),
        function (r) { return [r.title, "learning.html"]; }],
      ["Farm gallery",
        safe(sb.from("gallery_items").select("id, title").eq("status", "published").or(like(["title"], q)).limit(5)),
        function (r) { return [r.title, "gallery.html"]; }]
    ];
  }

  function build() {
    dialog = el("dialog", "search-dialog");
    dialog.setAttribute("aria-labelledby", "search-title");

    var top = el("div", "search-top");
    var title = el("h2", "", "Search the website");
    title.id = "search-title";
    parts.close = el("button", "btn btn-secondary", "Close");
    parts.close.type = "button";
    top.appendChild(title);
    top.appendChild(parts.close);

    var form = el("form", "search-form");
    form.setAttribute("role", "search");
    var label = el("label", "visually-hidden", "Search words");
    label.setAttribute("for", "site-search-input");
    parts.input = el("input", "input");
    parts.input.id = "site-search-input";
    parts.input.type = "search";
    parts.input.maxLength = 60;
    parts.input.placeholder = "Search products, guides, news and more";
    parts.input.setAttribute("autocomplete", "off");
    form.appendChild(label);
    form.appendChild(parts.input);

    parts.status = el("p", "field-hint", "Type at least two letters.");
    parts.status.setAttribute("aria-live", "polite");
    parts.results = el("div", "search-results");

    dialog.appendChild(top);
    dialog.appendChild(form);
    dialog.appendChild(parts.status);
    dialog.appendChild(parts.results);
    document.body.appendChild(dialog);

    form.addEventListener("submit", function (event) { event.preventDefault(); run(); });
    parts.input.addEventListener("input", function () {
      window.clearTimeout(timer);
      timer = window.setTimeout(run, 250);
    });
    parts.close.addEventListener("click", function () { dialog.close(); });
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) { dialog.close(); }
    });
    dialog.addEventListener("close", function () {
      if (opener && opener.focus) { opener.focus(); }
    });
  }

  function addGroup(heading, links) {
    var section = el("section", "search-group");
    section.appendChild(el("h3", "", heading));
    var list = el("ul", "search-list");
    links.forEach(function (pair) {
      var item = el("li");
      var anchor = el("a", "", pair[0]);
      anchor.href = pair[1];
      item.appendChild(anchor);
      list.appendChild(item);
    });
    section.appendChild(list);
    parts.results.appendChild(section);
  }

  function run() {
    var q = clean(parts.input.value);
    parts.results.innerHTML = "";

    if (q.length < 2) {
      parts.status.textContent = "Type at least two letters.";
      return;
    }

    ticket += 1;
    var mine = ticket;
    parts.status.textContent = "Searching...";

    var wanted = groups(q);
    Promise.all(wanted.map(function (group) { return group[1]; })).then(function (lists) {
      if (mine !== ticket) { return; }          // a newer search has started

      parts.results.innerHTML = "";
      var total = 0;

      var pageMatches = PAGES.filter(function (page) {
        return page[0].toLowerCase().indexOf(q.toLowerCase()) !== -1;
      }).map(function (page) { return [page[0], page[1]]; });
      if (pageMatches.length) { addGroup("Pages", pageMatches); total += pageMatches.length; }

      wanted.forEach(function (group, index) {
        var rows = lists[index];
        if (!rows.length) { return; }
        addGroup(group[0], rows.map(group[2]));
        total += rows.length;
      });

      parts.status.textContent = total === 0
        ? "No results for \"" + q + "\". Try a different word."
        : total + (total === 1 ? " result" : " results") + " for \"" + q + "\".";
    });
  }

  function open(openerButton) {
    opener = openerButton || null;
    if (typeof HTMLDialogElement === "undefined") {
      window.location.href = "sales.html";
      return;
    }
    if (!dialog) { build(); }
    dialog.showModal();
    parts.input.focus();
  }

  window.ChouSearch = { open: open };
})();