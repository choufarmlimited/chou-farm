/* ==========================================================
   Chou Farm Limited - public Crop and Livestock pages
   Shows published records, with their photographs.
   Needs, loaded before it: Supabase library, DOMPurify,
   config.js, supabase.js, sanitize.js
   ========================================================== */
(function () {
  "use strict";

  var page = document.body.getAttribute("data-page");

  /* What to show on each page */
  var PAGES = {
    "crop-production": {
      table: "crops",
      listId: "crop-list",
      select: "id, name, category, varieties, planting_season, harvest_season, description_html",
      order: [["sort_order", true], ["name", true]],
      noun: "crops",
      imagesTable: "crop_images",
      imagesFk: "crop_id",
      bucket: "crops",
      title: function (item) { return item.name; },
      tags: function (item) { return [item.category]; },
      details: function (item) {
        return [
          ["Varieties", item.varieties],
          ["Planting season", item.planting_season],
          ["Harvest season", item.harvest_season]
        ];
      }
    },
    "livestock-production": {
      table: "livestock",
      listId: "livestock-list",
      select: "id, species, breed, description_html",
      order: [["sort_order", true], ["species", true]],
      noun: "livestock",
      imagesTable: "livestock_images",
      imagesFk: "livestock_id",
      bucket: "livestock",
      title: function (item) { return item.species; },
      tags: function () { return []; },
      details: function (item) { return [["Breed", item.breed]]; }
    }
  };

  var config = PAGES[page];
  if (!config) { return; }

  var list = document.getElementById(config.listId);
  if (!list) { return; }

  /* If the connection is not set up, leave the page's friendly empty message */
  if (!window.sb) { return; }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) { node.className = className; }
    if (text !== undefined) { node.textContent = text; }
    return node;
  }

  function hasText(value) {
    return value !== null && value !== undefined && String(value).trim() !== "";
  }

  function photoUrl(path) {
    if (!hasText(path) || !/^[A-Za-z0-9\/_.\-]+$/.test(path) || path.indexOf("..") !== -1) { return ""; }
    return window.sb.storage.from(config.bucket).getPublicUrl(path).data.publicUrl;
  }

  function buildPhoto(image, className) {
    var url = photoUrl(image.storage_path);
    if (!url) { return null; }
    var picture = el("img", className);
    picture.src = url;
    picture.alt = image.alt_text || "";
    picture.width = 800;
    picture.height = 600;
    picture.loading = "lazy";
    return picture;
  }

  function buildCard(item, images) {
    var card = el("article", "card item-card");

    /* The first photograph is the cover */
    if (images.length) {
      var cover = buildPhoto(images[0], "item-cover");
      if (cover) { card.appendChild(cover); }
    }

    card.appendChild(el("h3", "", config.title(item)));

    /* Small labels such as the category */
    var tags = config.tags(item).filter(hasText);
    if (tags.length) {
      var tagRow = el("div", "item-tags");
      tags.forEach(function (tag) { tagRow.appendChild(el("span", "badge badge-in", tag)); });
      card.appendChild(tagRow);
    }

    /* Facts such as varieties and seasons */
    config.details(item).forEach(function (pair) {
      if (!hasText(pair[1])) { return; }
      var line = el("p", "item-meta");
      line.appendChild(el("strong", "", pair[0] + ": "));
      line.appendChild(document.createTextNode(pair[1]));
      card.appendChild(line);
    });

    /* The long description, cleaned before it is shown */
    var cleaned = window.ChouSanitize ? window.ChouSanitize.clean(item.description_html) : "";
    if (cleaned) {
      var excerpt = window.ChouSanitize.toText(cleaned, 140);
      if (excerpt) { card.appendChild(el("p", "item-excerpt", excerpt)); }

      var more = el("details", "item-more");
      more.appendChild(el("summary", "", "Read the full description"));
      var body = el("div", "rich-text");
      body.innerHTML = cleaned;
      more.appendChild(body);
      card.appendChild(more);
    }

    /* All the photographs */
    if (images.length > 1) {
      var photos = el("details", "item-more");
      photos.appendChild(el("summary", "", "See all " + images.length + " photos"));
      var grid = el("div", "item-photo-grid");
      images.forEach(function (image) {
        var figure = el("figure");
        var picture = buildPhoto(image, "");
        if (!picture) { return; }
        figure.appendChild(picture);
        if (hasText(image.caption)) { figure.appendChild(el("figcaption", "", image.caption)); }
        grid.appendChild(figure);
      });
      photos.appendChild(grid);
      card.appendChild(photos);
    }

    return card;
  }

  function showFailure() {
    list.innerHTML = "";
    var failed = el("div", "empty-state");
    failed.appendChild(el("p", "", "The " + config.noun + " could not be loaded right now. Please try again later."));
    list.appendChild(failed);
  }

  var query = window.sb.from(config.table)
    .select(config.select)
    .eq("status", "published");

  config.order.forEach(function (rule) {
    query = query.order(rule[0], { ascending: rule[1] });
  });

  var emptyContent = list.innerHTML;     // the friendly message already on the page
  list.innerHTML = "";
  list.appendChild(el("p", "field-hint", "Loading " + config.noun + "..."));

  query.limit(100).then(function (result) {
    if (result.error) { showFailure(); return; }

    var items = result.data || [];
    if (items.length === 0) {
      list.innerHTML = emptyContent;
      if (window.lucide) { window.lucide.createIcons(); }
      return;
    }

    /* Fetch all the photographs for these records in one request */
    var ids = items.map(function (item) { return item.id; });
    return window.sb.from(config.imagesTable)
      .select("*")
      .in(config.imagesFk, ids)
      .order("sort_order", { ascending: true })
      .then(function (imageResult) {
        var byRecord = {};
        (imageResult.data || []).forEach(function (image) {
          var key = image[config.imagesFk];
          if (!byRecord[key]) { byRecord[key] = []; }
          byRecord[key].push(image);
        });

        list.innerHTML = "";
        items.forEach(function (item) { list.appendChild(buildCard(item, byRecord[item.id] || [])); });
      });
  }).catch(showFailure);
})();