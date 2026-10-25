/* ==========================================================
   Chou Farm Limited - public Home page
   Fills the Home page from published database records.
   Anything not published keeps its placeholder.
   Needs, loaded before it: Supabase library, DOMPurify,
   config.js, supabase.js, sanitize.js, main.js
   ========================================================== */
(function() {
  "use strict";
  
  if (document.body.getAttribute("data-page") !== "home" || !window.sb) { return; }
  
  var sb = window.sb;
  var Sanitize = window.ChouSanitize;
  
  var AVAILABILITY = {
    in_stock: ["In stock", "badge-in"],
    limited: ["Limited", "badge-limited"],
    out_of_stock: ["Out of stock", "badge-out"]
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
  
  function productImageUrl(path) {
    if (!hasText(path) || !/^[A-Za-z0-9\/_.\-]+$/.test(path) || path.indexOf("..") !== -1) { return ""; }
    return sb.storage.from("products").getPublicUrl(path).data.publicUrl;
  }
  
  /* Runs a database request and returns the fallback if anything goes wrong */
  function safe(request, fallback) {
    return request.then(function(result) {
      return result.error ? fallback : (result.data || fallback);
    }, function() { return fallback; });
  }
  
  /* ----- The banner picture behind the company name and buttons ----- */
  safe(sb.from("site_settings").select("hero_image_path").eq("id", 1).maybeSingle(), null)
    .then(function(row) {
      var hero = document.querySelector(".hero");
      var path = row && row.hero_image_path;
      if (!hero || !hasText(path) || !/^[A-Za-z0-9\/_.\-]+$/.test(path) || path.indexOf("..") !== -1) { return; }
      
      var url = sb.storage.from("about").getPublicUrl(path).data.publicUrl;
      var picture = new Image();
      picture.onload = function() {
        /* Shown only once it has downloaded, so the page never flashes an empty box */
        hero.style.setProperty("--hero-image", 'url("' + url + '")');
        hero.classList.add("has-image");
      };
      picture.src = url;
    });
  
  /* ----- Introduction, mission and vision ----- */
  safe(
    sb.from("about_content")
    .select("section_key, title, body_html")
    .eq("status", "published")
    .in("section_key", ["background", "mission", "vision"]),
    []
  ).then(function(rows) {
    var byKey = {};
    rows.forEach(function(row) { byKey[row.section_key] = row; });
    
    var intro = document.getElementById("home-intro");
    var background = byKey.background;
    if (intro && background && Sanitize) {
      var introText = Sanitize.toText(background.body_html, 420);
      if (introText) {
        intro.textContent = introText;
        var more = document.getElementById("home-intro-more");
        if (more) { more.hidden = false; }
      }
    }
    
    var blocks = document.querySelectorAll("[data-home-section]");
    Array.prototype.forEach.call(blocks, function(block) {
      var row = byKey[block.getAttribute("data-home-section")];
      if (!row) { return; }
      
      var title = block.querySelector("[data-home-title]");
      if (title && hasText(row.title)) { title.textContent = row.title; }
      
      var text = block.querySelector("[data-home-text]");
      var excerpt = Sanitize ? Sanitize.toText(row.body_html, 260) : "";
      if (text && excerpt) {
        text.textContent = excerpt;
        var link = block.querySelector("[data-home-more]");
        if (link) { link.hidden = false; }
      }
    });
  });
  
  /* ----- Featured crops and livestock ----- */
  function featureCard(iconName, title, subtitle, href) {
    var card = el("a", "card card-link");
    card.href = href;
    var iconBox = el("span", "card-icon");
    iconBox.innerHTML = '<i data-lucide="' + iconName + '"></i>';
    card.appendChild(iconBox);
    card.appendChild(el("h3", "", title));
    if (hasText(subtitle)) { card.appendChild(el("p", "", subtitle)); }
    return card;
  }
  
  Promise.all([
    safe(
      sb.from("crops").select("id, name, category")
      .eq("status", "published").eq("is_featured", true)
      .order("sort_order", { ascending: true }).order("name", { ascending: true }).limit(6),
      []
    ),
    safe(
      sb.from("livestock").select("id, species, breed")
      .eq("status", "published").eq("is_featured", true)
      .order("sort_order", { ascending: true }).order("species", { ascending: true }).limit(6),
      []
    )
  ]).then(function(results) {
    var grid = document.getElementById("featured-items");
    if (!grid) { return; }
    
    results[0].forEach(function(crop) {
      grid.appendChild(featureCard("wheat", crop.name, crop.category, "crop-production.html"));
    });
    results[1].forEach(function(animal) {
      grid.appendChild(featureCard("cow-head", animal.species, animal.breed ? "Breed: " + animal.breed : "", "livestock-production.html"));
    });
    
    if (grid.children.length) { grid.hidden = false; }
    if (window.lucide) { window.lucide.createIcons(); }
  });
  
  /* ----- Featured products (with their first photo) ----- */
  safe(
    sb.from("products").select("id, name, unit, price_kes, availability")
    .eq("status", "published").eq("is_featured", true)
    .order("name", { ascending: true }).limit(4),
    []
  ).then(function(products) {
    var grid = document.getElementById("featured-products");
    if (!grid || products.length === 0) { return; }
    
    var ids = products.map(function(product) { return product.id; });
    return safe(
      sb.from("product_images").select("product_id, storage_path, alt_text, sort_order")
      .in("product_id", ids).order("sort_order", { ascending: true }),
      []
    ).then(function(images) {
      var firstPhoto = {};
      images.forEach(function(image) {
        if (!firstPhoto[image.product_id]) { firstPhoto[image.product_id] = image; }
      });
      
      grid.innerHTML = "";
      products.forEach(function(product) {
        var card = el("article", "card item-card");
        
        var photo = firstPhoto[product.id];
        var url = photo ? productImageUrl(photo.storage_path) : "";
        if (url) {
          var picture = el("img", "item-cover");
          picture.src = url;
          picture.alt = photo.alt_text || product.name;
          picture.width = 800;
          picture.height = 600;
          picture.loading = "lazy";
          card.appendChild(picture);
        }
        
        card.appendChild(el("h3", "", product.name));
        
        var availability = AVAILABILITY[product.availability];
        if (availability) {
          var tags = el("div", "item-tags");
          tags.appendChild(el("span", "badge " + availability[1], availability[0]));
          card.appendChild(tags);
        }
        
        var price = (product.price_kes === null || product.price_kes === undefined) ?
          "Price on request" :
          formatKES(product.price_kes) + " per " + product.unit;
        card.appendChild(el("p", "price-line", price));
        
        var link = el("a", "", "View details");
        link.href = "product.html?id=" + encodeURIComponent(product.id);
        card.appendChild(link);
        grid.appendChild(card);
      });
    });
  });
  
  /* ----- Farm statistics (hidden unless real figures are published) ----- */
  safe(
    sb.from("farm_stats").select("label, value")
    .eq("status", "published")
    .order("sort_order", { ascending: true }).order("label", { ascending: true }),
    []
  ).then(function(rows) {
    if (window.ChouFarm && typeof window.ChouFarm.renderStats === "function") {
      window.ChouFarm.renderStats(rows);
    }
  });
})();