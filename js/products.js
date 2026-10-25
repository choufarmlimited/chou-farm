/* ==========================================================
   Chou Farm Limited - public Sales page and product page
   Needs, loaded before it: Supabase library, DOMPurify,
   config.js, supabase.js, sanitize.js
   ========================================================== */
(function () {
  "use strict";

  var page = document.body.getAttribute("data-page");
  if ((page !== "sales" && page !== "product") || !window.sb) { return; }

  var sb = window.sb;

  var AVAILABILITY = {
    in_stock:     { label: "In stock",     badge: "badge-in",      rank: 0 },
    limited:      { label: "Limited",      badge: "badge-limited", rank: 1 },
    out_of_stock: { label: "Out of stock", badge: "badge-out",     rank: 2 }
  };

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) { node.className = className; }
    if (text !== undefined) { node.textContent = text; }
    return node;
  }

  function hasText(value) {
    return value !== null && value !== undefined && String(value).trim() !== "";
  }

  function formatKES(value) {
    var number = Number(value);
    if (value === null || value === undefined || isNaN(number)) { return ""; }
    return "KES " + number.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function priceText(product) {
    return (product.price_kes === null || product.price_kes === undefined)
      ? "Price on request"
      : formatKES(product.price_kes) + " per " + product.unit;
  }

  function imageUrl(path) {
    if (!hasText(path) || !/^[A-Za-z0-9\/_.\-]+$/.test(path) || path.indexOf("..") !== -1) { return ""; }
    return sb.storage.from("products").getPublicUrl(path).data.publicUrl;
  }

  function safe(request, fallback) {
    return request.then(function (result) {
      return result.error ? fallback : (result.data || fallback);
    }, function () { return fallback; });
  }

  /* Photos for many products, fetched in small groups to keep the address short */
  function fetchImages(ids) {
    var groups = [];
    for (var i = 0; i < ids.length; i += 50) { groups.push(ids.slice(i, i + 50)); }

    return Promise.all(groups.map(function (group) {
      return safe(
        sb.from("product_images")
          .select("product_id, storage_path, alt_text, caption, sort_order")
          .in("product_id", group)
          .order("sort_order", { ascending: true }),
        []
      );
    })).then(function (lists) {
      var byProduct = {};
      lists.forEach(function (list) {
        list.forEach(function (image) {
          if (!byProduct[image.product_id]) { byProduct[image.product_id] = []; }
          byProduct[image.product_id].push(image);
        });
      });
      return byProduct;
    });
  }

  function availabilityBadge(product) {
    var info = AVAILABILITY[product.availability];
    return info ? el("span", "badge " + info.badge, info.label) : null;
  }

  /* ==========================================================
     The catalogue
     ========================================================== */
  function sortProducts(products, mode) {
    return products.slice().sort(function (a, b) {
      var byName = a.name.localeCompare(b.name);

      if (mode === "price-asc" || mode === "price-desc") {
        var priceA = (a.price_kes === null || a.price_kes === undefined) ? null : Number(a.price_kes);
        var priceB = (b.price_kes === null || b.price_kes === undefined) ? null : Number(b.price_kes);
        if (priceA === null && priceB === null) { return byName; }
        if (priceA === null) { return 1; }       // products without a price go last
        if (priceB === null) { return -1; }
        return (mode === "price-asc" ? priceA - priceB : priceB - priceA) || byName;
      }
      if (mode === "availability") {
        var rankA = AVAILABILITY[a.availability] ? AVAILABILITY[a.availability].rank : 9;
        var rankB = AVAILABILITY[b.availability] ? AVAILABILITY[b.availability].rank : 9;
        return (rankA - rankB) || byName;
      }
      return byName;
    });
  }

  function initList() {
    var list = document.getElementById("product-list");
    var searchInput = document.getElementById("product-search");
    var categorySelect = document.getElementById("product-category");
    var sortSelect = document.getElementById("product-sort");
    var count = document.getElementById("product-count");
    if (!list) { return; }

    var emptyContent = list.innerHTML;     // the friendly message already on the page
    list.innerHTML = "";
    list.appendChild(el("p", "field-hint", "Loading products..."));

    Promise.all([
      safe(sb.from("product_categories").select("id, name")
        .order("sort_order", { ascending: true }).order("name", { ascending: true }), []),
      safe(
        sb.from("products")
          .select("id, name, unit, price_kes, availability, category_id")
          .eq("status", "published")
          .order("name", { ascending: true })
          .limit(300),
        null
      )
    ]).then(function (results) {
      var categories = results[0];
      var products = results[1];

      if (products === null) {
        list.innerHTML = "";
        var failed = el("div", "empty-state");
        failed.appendChild(el("p", "", "The products could not be loaded right now. Please try again later."));
        list.appendChild(failed);
        return;
      }

      if (products.length === 0) {
        list.innerHTML = emptyContent;
        if (window.lucide) { window.lucide.createIcons(); }
        return;
      }

      var categoryNames = {};
      categories.forEach(function (category) {
        categoryNames[category.id] = category.name;
        var used = products.some(function (p) { return p.category_id === category.id; });
        if (used && categorySelect) {
          var option = el("option", "", category.name);
          option.value = category.id;
          categorySelect.appendChild(option);
        }
      });

      return fetchImages(products.map(function (p) { return p.id; })).then(function (images) {
        function buildCard(product) {
          var card = el("article", "card item-card");
          var photos = images[product.id] || [];

          if (photos.length) {
            var url = imageUrl(photos[0].storage_path);
            if (url) {
              var picture = el("img", "item-cover");
              picture.src = url;
              picture.alt = photos[0].alt_text || product.name;
              picture.width = 800;
              picture.height = 600;
              picture.loading = "lazy";
              card.appendChild(picture);
            }
          }

          var tags = el("div", "item-tags");
          var badge = availabilityBadge(product);
          if (badge) { tags.appendChild(badge); }
          if (categoryNames[product.category_id]) {
            tags.appendChild(el("span", "badge badge-limited", categoryNames[product.category_id]));
          }
          card.appendChild(tags);

          card.appendChild(el("h3", "", product.name));
          card.appendChild(el("p", "price-line", priceText(product)));

          var actions = el("div", "record-actions");
          var details = el("a", "btn btn-primary", "View details");
          details.href = "product.html?id=" + encodeURIComponent(product.id);
          actions.appendChild(details);
          card.appendChild(actions);
          return card;
        }

        function render() {
          var words = searchInput ? searchInput.value.trim().toLowerCase() : "";
          var category = categorySelect ? categorySelect.value : "";
          var mode = sortSelect ? sortSelect.value : "name";

          var shown = products.filter(function (product) {
            if (category && product.category_id !== category) { return false; }
            return !words || product.name.toLowerCase().indexOf(words) !== -1;
          });
          shown = sortProducts(shown, mode);

          list.innerHTML = "";
          if (shown.length === 0) {
            var none = el("div", "empty-state");
            none.appendChild(el("p", "", "No products match your search."));
            list.appendChild(none);
          } else {
            shown.forEach(function (product) { list.appendChild(buildCard(product)); });
          }
          if (count) { count.textContent = shown.length + (shown.length === 1 ? " product" : " products") + " shown"; }
        }

        [searchInput, categorySelect, sortSelect].forEach(function (control) {
          if (!control) { return; }
          control.disabled = false;
          control.addEventListener(control === searchInput ? "input" : "change", render);
        });
        render();
      });
    });
  }

  /* ==========================================================
     One product
     ========================================================== */
  function initDetail() {
    var host = document.getElementById("product-detail");
    var heading = document.getElementById("product-heading");
    var meta = document.getElementById("product-meta");
    if (!host || !heading) { return; }

    function showNotFound() {
      heading.textContent = "Product not found";
      if (meta) { meta.textContent = "This product does not exist or is no longer available."; }
      host.className = "";
      host.innerHTML = "";
      var link = el("a", "btn btn-primary", "See all products");
      link.href = "sales.html";
      host.appendChild(link);
    }

    var id = new URLSearchParams(window.location.search).get("id");
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      showNotFound();
      return;
    }

    heading.textContent = "Loading product...";

    sb.from("products")
      .select("id, name, description_html, unit, price_kes, availability, category_id")
      .eq("id", id).eq("status", "published").maybeSingle()
      .then(function (result) {
        if (result.error || !result.data) { showNotFound(); return; }
        var product = result.data;

        return Promise.all([
          fetchImages([product.id]),
          product.category_id
            ? safe(sb.from("product_categories").select("name").eq("id", product.category_id).maybeSingle(), null)
            : Promise.resolve(null)
        ]).then(function (parts) {
          var photos = (parts[0][product.id] || []).filter(function (p) { return imageUrl(p.storage_path); });
          var category = parts[1];

          heading.textContent = product.name;
          document.title = product.name + " | Chou Farm Limited";
          if (meta) { meta.textContent = category && category.name ? category.name : "Product details"; }

          var cleaned = window.ChouSanitize ? window.ChouSanitize.clean(product.description_html) : "";
          var description = document.querySelector('meta[name="description"]');
          if (description && window.ChouSanitize) {
            var excerpt = window.ChouSanitize.toText(cleaned, 150);
            if (excerpt) { description.setAttribute("content", excerpt); }
          }

          host.innerHTML = "";

          /* Photographs */
          var left = el("div");
          if (photos.length) {
            var main = el("img", "product-main");
            main.src = imageUrl(photos[0].storage_path);
            main.alt = photos[0].alt_text || product.name;
            main.width = 1200;
            main.height = 900;
            left.appendChild(main);

            if (photos.length > 1) {
              var thumbs = el("div", "product-thumbs");
              photos.forEach(function (photo, index) {
                var button = el("button", "thumb-button");
                button.type = "button";
                button.setAttribute("aria-label", "Show photo " + (index + 1) + " of " + photos.length);
                button.setAttribute("aria-pressed", index === 0 ? "true" : "false");
                var small = el("img");
                small.src = imageUrl(photo.storage_path);
                small.alt = "";
                small.width = 200;
                small.height = 150;
                small.loading = "lazy";
                button.appendChild(small);
                button.addEventListener("click", function () {
                  main.src = imageUrl(photo.storage_path);
                  main.alt = photo.alt_text || product.name;
                  Array.prototype.forEach.call(thumbs.children, function (other) {
                    other.setAttribute("aria-pressed", other === button ? "true" : "false");
                  });
                });
                thumbs.appendChild(button);
              });
              left.appendChild(thumbs);
            }
          } else {
            var none = el("div", "empty-state");
            none.appendChild(el("p", "", "No photographs of this product yet."));
            left.appendChild(none);
          }
          host.appendChild(left);

          /* Details */
          var card = el("article", "card");
          card.appendChild(el("h2", "", product.name));
          var tags = el("div", "item-tags");
          var badge = availabilityBadge(product);
          if (badge) { tags.appendChild(badge); }
          card.appendChild(tags);
          card.appendChild(el("p", "price-line", priceText(product)));

          if (cleaned) {
            var body = el("div", "rich-text");
            body.innerHTML = cleaned;
            card.appendChild(body);
          }

          host.appendChild(card);
        });
      })
      .catch(showNotFound);
  }

  if (page === "sales") { initList(); } else { initDetail(); }
})();