/* ==========================================================
   Chou Farm Limited - public Farming Guides
   Fills the guides list (with search and category filter)
   and the single guide page.
   Needs, loaded before it: Supabase library, DOMPurify,
   config.js, supabase.js, sanitize.js
   ========================================================== */
(function () {
  "use strict";

  var page = document.body.getAttribute("data-page");
  if ((page !== "guides" && page !== "guide") || !window.sb) { return; }

  var sb = window.sb;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) { node.className = className; }
    if (text !== undefined) { node.textContent = text; }
    return node;
  }

  function hasText(value) {
    return value !== null && value !== undefined && String(value).trim() !== "";
  }

  function formatDate(value) {
    if (!value) { return ""; }
    var date = new Date(value);
    if (isNaN(date.getTime())) { return ""; }
    return new Intl.DateTimeFormat("en-KE", {
      timeZone: "Africa/Nairobi", day: "numeric", month: "long", year: "numeric"
    }).format(date);
  }

  function coverUrl(path) {
    if (!hasText(path) || !/^[A-Za-z0-9\/_.\-]+$/.test(path) || path.indexOf("..") !== -1) { return ""; }
    return sb.storage.from("guides").getPublicUrl(path).data.publicUrl;
  }

  /* Runs a database request and returns the fallback if anything goes wrong */
  function safe(request, fallback) {
    return request.then(function (result) {
      return result.error ? fallback : (result.data || fallback);
    }, function () { return fallback; });
  }

  /* ==========================================================
     The guides list
     ========================================================== */
  function initList() {
    var list = document.getElementById("guide-list");
    var searchInput = document.getElementById("guide-search");
    var categorySelect = document.getElementById("guide-category");
    var count = document.getElementById("guide-count");
    if (!list) { return; }

    var emptyContent = list.innerHTML;     // the friendly message already on the page
    list.innerHTML = "";
    list.appendChild(el("p", "field-hint", "Loading guides..."));

    Promise.all([
      safe(sb.from("guide_categories").select("id, name").order("sort_order", { ascending: true }).order("name", { ascending: true }), []),
      safe(
        sb.from("farming_guides")
          .select("id, title, summary, cover_path, cover_alt, published_at, category_id")
          .eq("status", "published")
          .order("published_at", { ascending: false, nullsFirst: false })
          .limit(200),
        null
      )
    ]).then(function (results) {
      var categories = results[0];
      var guides = results[1];

      if (guides === null) {
        list.innerHTML = "";
        var failed = el("div", "empty-state");
        failed.appendChild(el("p", "", "The guides could not be loaded right now. Please try again later."));
        list.appendChild(failed);
        return;
      }

      if (guides.length === 0) {
        list.innerHTML = emptyContent;
        if (window.lucide) { window.lucide.createIcons(); }
        return;
      }

      var categoryNames = {};
      categories.forEach(function (category) {
        categoryNames[category.id] = category.name;

        /* Only offer categories that have at least one published guide */
        var used = guides.some(function (guide) { return guide.category_id === category.id; });
        if (used && categorySelect) {
          var option = el("option", "", category.name);
          option.value = category.id;
          categorySelect.appendChild(option);
        }
      });

      function buildCard(guide) {
        var card = el("article", "card item-card");

        var url = coverUrl(guide.cover_path);
        if (url) {
          var picture = el("img", "item-cover");
          picture.src = url;
          picture.alt = guide.cover_alt || "";
          picture.width = 800;
          picture.height = 600;
          picture.loading = "lazy";
          card.appendChild(picture);
        }

        if (categoryNames[guide.category_id]) {
          var tags = el("div", "item-tags");
          tags.appendChild(el("span", "badge badge-in", categoryNames[guide.category_id]));
          card.appendChild(tags);
        }

        card.appendChild(el("h3", "", guide.title));

        var date = formatDate(guide.published_at);
        if (date) { card.appendChild(el("p", "item-meta", date)); }
        if (hasText(guide.summary)) { card.appendChild(el("p", "", guide.summary)); }

        var link = el("a", "", "Read the guide");
        link.href = "guide.html?id=" + encodeURIComponent(guide.id);
        card.appendChild(link);
        return card;
      }

      function render() {
        var words = searchInput ? searchInput.value.trim().toLowerCase() : "";
        var category = categorySelect ? categorySelect.value : "";

        var shown = guides.filter(function (guide) {
          if (category && guide.category_id !== category) { return false; }
          if (!words) { return true; }
          var text = (guide.title + " " + (guide.summary || "")).toLowerCase();
          return text.indexOf(words) !== -1;
        });

        list.innerHTML = "";
        if (shown.length === 0) {
          var none = el("div", "empty-state");
          none.appendChild(el("p", "", "No guides match your search."));
          list.appendChild(none);
        } else {
          shown.forEach(function (guide) { list.appendChild(buildCard(guide)); });
        }

        if (count) {
          count.textContent = shown.length + (shown.length === 1 ? " guide" : " guides") + " shown";
        }
      }

      if (searchInput) { searchInput.disabled = false; searchInput.addEventListener("input", render); }
      if (categorySelect) { categorySelect.disabled = false; categorySelect.addEventListener("change", render); }
      render();
    });
  }

  /* ==========================================================
     One guide
     ========================================================== */
  function initDetail() {
    var host = document.getElementById("guide-detail");
    var heading = document.getElementById("guide-heading");
    var meta = document.getElementById("guide-meta");
    if (!host || !heading) { return; }

    function showNotFound() {
      heading.textContent = "Guide not found";
      if (meta) { meta.textContent = "This guide does not exist or is no longer published."; }
      host.innerHTML = "";
      var link = el("a", "btn btn-primary", "See all guides");
      link.href = "guides.html";
      host.appendChild(link);
    }

    var id = new URLSearchParams(window.location.search).get("id");
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      showNotFound();
      return;
    }

    heading.textContent = "Loading guide...";

    sb.from("farming_guides")
      .select("id, title, summary, content_html, cover_path, cover_alt, published_at, category_id")
      .eq("id", id)
      .eq("status", "published")
      .maybeSingle()
      .then(function (result) {
        if (result.error || !result.data) { showNotFound(); return; }
        var guide = result.data;

        var categoryRequest = guide.category_id
          ? safe(sb.from("guide_categories").select("name").eq("id", guide.category_id).maybeSingle(), null)
          : Promise.resolve(null);

        return categoryRequest.then(function (category) {
          heading.textContent = guide.title;
          document.title = guide.title + " | Chou Farm Limited";

          var description = document.querySelector('meta[name="description"]');
          if (description && hasText(guide.summary)) { description.setAttribute("content", guide.summary); }

          if (meta) {
            meta.textContent = [category && category.name, formatDate(guide.published_at)]
              .filter(function (part) { return hasText(part); }).join(" | ");
          }

          host.innerHTML = "";

          var url = coverUrl(guide.cover_path);
          if (url) {
            var picture = el("img", "guide-cover");
            picture.src = url;
            picture.alt = guide.cover_alt || "";
            picture.width = 1200;
            picture.height = 675;
            host.appendChild(picture);
          }

          if (hasText(guide.summary)) { host.appendChild(el("p", "lead", guide.summary)); }

          var cleaned = window.ChouSanitize ? window.ChouSanitize.clean(guide.content_html) : "";
          if (cleaned) {
            var body = el("div", "rich-text");
            body.innerHTML = cleaned;
            host.appendChild(body);
          }
        });
      })
      .catch(showNotFound);
  }

  if (page === "guides") { initList(); } else { initDetail(); }
})();