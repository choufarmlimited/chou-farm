/* ==========================================================
   Chou Farm Limited - public news
   Fills the News page and "Latest news" on the Home page.
   Needs, loaded before it: Supabase library, DOMPurify,
   config.js, supabase.js, sanitize.js
   ========================================================== */
(function () {
  "use strict";

  var onNewsPage = document.body.getAttribute("data-page") === "news";
  var list = document.getElementById(onNewsPage ? "news-list" : "news-latest");

  if (!list || !window.sb) { return; }

  var limit = onNewsPage ? 50 : 3;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) { node.className = className; }
    if (text !== undefined) { node.textContent = text; }
    return node;
  }

  function formatDate(value) {
    if (!value) { return ""; }
    var date = new Date(value);
    if (isNaN(date.getTime())) { return ""; }
    return new Intl.DateTimeFormat("en-KE", {
      timeZone: "Africa/Nairobi", day: "numeric", month: "long", year: "numeric"
    }).format(date);
  }

  function imageUrl(path) {
    if (!path || !/^[A-Za-z0-9\/_.\-]+$/.test(path) || path.indexOf("..") !== -1) { return ""; }
    return window.sb.storage.from("news").getPublicUrl(path).data.publicUrl;
  }

  function buildCard(item) {
    var card = el("article", "card item-card");
    card.id = "news-" + item.id;

    var url = imageUrl(item.image_path);
    if (url) {
      var picture = el("img", "item-cover");
      picture.src = url;
      picture.alt = item.image_alt || "";
      picture.width = 800;
      picture.height = 600;
      picture.loading = "lazy";
      card.appendChild(picture);
    }

    card.appendChild(el("h3", "", item.title));

    var date = formatDate(item.published_at);
    if (date) { card.appendChild(el("p", "item-meta", date)); }

    if (item.summary && item.summary.trim() !== "") {
      card.appendChild(el("p", "", item.summary));
    }

    var cleaned = window.ChouSanitize ? window.ChouSanitize.clean(item.content_html) : "";

    if (onNewsPage) {
      if (cleaned) {
        var more = el("details", "item-more");
        more.appendChild(el("summary", "", "Read the full article"));
        var body = el("div", "rich-text");
        body.innerHTML = cleaned;
        more.appendChild(body);
        card.appendChild(more);

        /* Opened from a "Read more" link on the Home page */
        if (window.location.hash === "#news-" + item.id) { more.open = true; }
      }
    } else {
      var link = el("a", "", "Read more");
      link.href = "news.html#news-" + item.id;
      card.appendChild(link);
    }

    return card;
  }

  var emptyContent = list.innerHTML;     // the friendly message already on the page
  list.innerHTML = "";
  list.appendChild(el("p", "field-hint", "Loading news..."));

  function showFailure() {
    list.innerHTML = "";
    var failed = el("div", "empty-state");
    failed.appendChild(el("p", "", "The news could not be loaded right now. Please try again later."));
    list.appendChild(failed);
  }

  window.sb.from("news_items")
    .select("id, title, summary, content_html, published_at, image_path, image_alt")
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit)
    .then(function (result) {
      if (result.error) { showFailure(); return; }

      var items = result.data || [];
      list.innerHTML = "";

      if (items.length === 0) {
        list.innerHTML = emptyContent;
        if (window.lucide) { window.lucide.createIcons(); }
        return;
      }

      items.forEach(function (item) { list.appendChild(buildCard(item)); });

      var target = window.location.hash ? document.getElementById(window.location.hash.slice(1)) : null;
      if (target) { target.scrollIntoView(); }
    })
    .catch(showFailure);
})();