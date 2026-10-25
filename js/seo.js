/* ==========================================================
   Chou Farm Limited - search engine and sharing details
   Adds the canonical address, sharing tags and structured data.
   Structured data is added ONLY from real values. Nothing is invented.
   Loaded by js/layout.js once the company settings are ready.
   ========================================================== */
(function () {
  "use strict";

  var page = document.body.getAttribute("data-page");
  if (["404", "admin", "admin-login"].indexOf(page) !== -1) { return; }

  var secure = window.location.protocol === "https:";
  var origin = window.location.origin;
  var settings = (window.ChouSite && window.ChouSite.settings) || {};
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  function hasText(value) {
    return value !== null && value !== undefined && String(value).trim() !== "";
  }

  function ensureLink(rel, href) {
    var link = document.querySelector('link[rel="' + rel + '"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = rel;
      document.head.appendChild(link);
    }
    link.href = href;
  }

  function ensureMeta(attribute, key, content) {
    var meta = document.querySelector("meta[" + attribute + '="' + key + '"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute(attribute, key);
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", content);
  }

  function addJsonLd(key, data) {
    var old = document.querySelector('script[data-seo="' + key + '"]');
    if (old) { old.parentNode.removeChild(old); }
    var tag = document.createElement("script");
    tag.type = "application/ld+json";
    tag.setAttribute("data-seo", key);
    tag.textContent = JSON.stringify(data).replace(/</g, "\\u003c");
    document.head.appendChild(tag);
  }

  function logoUrl() {
    var path = settings.logo_path;
    if (!hasText(path) || !/^[A-Za-z0-9\/_.\-]+$/.test(path) || path.indexOf("..") !== -1 || !window.sb) { return ""; }
    return window.sb.storage.from("logo").getPublicUrl(path).data.publicUrl;
  }

  /* ----- Canonical address ----- */
  function canonicalUrl() {
    var path = window.location.pathname.replace(/\/index\.html$/, "/").replace(/\.html$/, "");
    var url = origin + path;
    var id = new URLSearchParams(window.location.search).get("id");
    if ((page === "product" || page === "guide") && id && UUID.test(id)) { url += "?id=" + id; }
    return url;
  }

  if (secure) {
    var canonical = canonicalUrl();
    ensureLink("canonical", canonical);
    ensureMeta("property", "og:url", canonical);
  }

  if (hasText(settings.company_name)) { ensureMeta("property", "og:site_name", settings.company_name); }

  var shareImage = logoUrl();
  if (shareImage) { ensureMeta("property", "og:image", shareImage); }

  /* ----- Keep the sharing title and description in step with the page ----- */
  function syncSharing() {
    ensureMeta("property", "og:title", document.title);
    var description = document.querySelector('meta[name="description"]');
    if (description) { ensureMeta("property", "og:description", description.getAttribute("content") || ""); }
  }
  syncSharing();

  if (window.MutationObserver) {
    var observer = new MutationObserver(syncSharing);
    var title = document.querySelector("title");
    if (title) { observer.observe(title, { childList: true }); }
    var description = document.querySelector('meta[name="description"]');
    if (description) { observer.observe(description, { attributes: true, attributeFilter: ["content"] }); }
    window.setTimeout(function () { observer.disconnect(); }, 15000);
  }

  /* ----- The company (Home, About and Contact pages only) ----- */
  if (secure && ["home", "about", "contact"].indexOf(page) !== -1 && hasText(settings.company_name)) {
    var company = {
      "@context": "https://schema.org",
      "@type": hasText(settings.address) ? "LocalBusiness" : "Organization",
      "name": settings.company_name,
      "url": origin + "/"
    };
    if (hasText(settings.slogan)) { company.slogan = settings.slogan; }
    if (logoUrl()) { company.logo = logoUrl(); }
    if (hasText(settings.email)) { company.email = settings.email; }
    if (hasText(settings.phone)) { company.telephone = settings.phone; }
    if (hasText(settings.address)) {
      company.address = { "@type": "PostalAddress", "streetAddress": settings.address };
    }
    var links = [settings.facebook_url, settings.instagram_url, settings.x_url,
                 settings.youtube_url, settings.linkedin_url, settings.tiktok_url]
      .filter(function (url) { return hasText(url) && /^https:\/\//i.test(url); });
    if (links.length) { company.sameAs = links; }
    addJsonLd("company", company);
  }

  /* ----- One product (Product page only) ----- */
  if (secure && page === "product" && window.sb) {
    var id = new URLSearchParams(window.location.search).get("id");
    if (id && UUID.test(id)) {
      window.sb.from("products")
        .select("id, name, description_html, unit, price_kes, availability")
        .eq("id", id).eq("status", "published").maybeSingle()
        .then(function (result) {
          var product = result.data;
          if (result.error || !product) { return; }

          return window.sb.from("product_images").select("storage_path")
            .eq("product_id", product.id).order("sort_order", { ascending: true }).limit(1)
            .then(function (images) {
              var data = {
                "@context": "https://schema.org",
                "@type": "Product",
                "name": product.name
              };

              if (window.ChouSanitize) {
                var text = window.ChouSanitize.toText(window.ChouSanitize.clean(product.description_html), 300);
                if (text) { data.description = text; }
              }

              var first = images.data && images.data[0];
              if (first && /^[A-Za-z0-9\/_.\-]+$/.test(first.storage_path) && first.storage_path.indexOf("..") === -1) {
                var url = window.sb.storage.from("products").getPublicUrl(first.storage_path).data.publicUrl;
                data.image = url;
                ensureMeta("property", "og:image", url);
              }

              /* An offer only when the product really has a price */
              if (product.price_kes !== null && product.price_kes !== undefined) {
                var availability = {
                  in_stock: "https://schema.org/InStock",
                  limited: "https://schema.org/LimitedAvailability",
                  out_of_stock: "https://schema.org/OutOfStock"
                }[product.availability];

                data.offers = {
                  "@type": "Offer",
                  "priceCurrency": "KES",
                  "price": Number(product.price_kes).toFixed(2),
                  "url": canonicalUrl()
                };
                if (availability) { data.offers.availability = availability; }
              }
              addJsonLd("product", data);
            });
        });
    }
  }
})();