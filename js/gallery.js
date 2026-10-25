/* ==========================================================
   Chou Farm Limited - public Farm Gallery and lightbox
   Also fills "Latest farm photographs" on the Home page when
   that page has a #latest-photos box.
   Needs, loaded before it: Supabase library, DOMPurify,
   config.js, supabase.js, sanitize.js
   ========================================================== */
(function () {
  "use strict";

  var page = document.body.getAttribute("data-page");
  var onGallery = page === "gallery";
  var onHome = page === "home";
  if ((!onGallery && !onHome) || !window.sb) { return; }

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

  function photoUrl(path) {
    if (!hasText(path) || !/^[A-Za-z0-9\/_.\-]+$/.test(path) || path.indexOf("..") !== -1) { return ""; }
    return sb.storage.from("gallery").getPublicUrl(path).data.publicUrl;
  }

  /* ==========================================================
     The lightbox (photo viewer)
     ========================================================== */
  var lightbox = null;
  var viewer = { images: [], index: 0, opener: null };
  var parts = {};

  function showPhoto() {
    var image = viewer.images[viewer.index];
    parts.picture.src = photoUrl(image.storage_path);
    parts.picture.alt = image.alt_text || "";
    parts.caption.textContent = image.caption || "";
    parts.counter.textContent = (viewer.index + 1) + " of " + viewer.images.length;
    parts.previous.disabled = viewer.images.length < 2;
    parts.next.disabled = viewer.images.length < 2;
  }

  function step(direction) {
    var total = viewer.images.length;
    if (total < 2) { return; }
    viewer.index = (viewer.index + direction + total) % total;
    showPhoto();
  }

  function buildLightbox() {
    lightbox = el("dialog", "lightbox");
    lightbox.setAttribute("aria-label", "Photo viewer");

    var top = el("div", "lightbox-top");
    parts.counter = el("span", "lightbox-counter", "");
    parts.close = el("button", "btn btn-light", "Close");
    parts.close.type = "button";
    top.appendChild(parts.counter);
    top.appendChild(parts.close);

    var figure = el("figure", "lightbox-figure");
    parts.picture = el("img", "lightbox-img");
    parts.caption = el("figcaption", "lightbox-caption", "");
    figure.appendChild(parts.picture);
    figure.appendChild(parts.caption);

    var controls = el("div", "lightbox-controls");
    parts.previous = el("button", "btn btn-light", "Previous");
    parts.previous.type = "button";
    parts.next = el("button", "btn btn-light", "Next");
    parts.next.type = "button";
    controls.appendChild(parts.previous);
    controls.appendChild(parts.next);

    lightbox.appendChild(top);
    lightbox.appendChild(figure);
    lightbox.appendChild(controls);
    document.body.appendChild(lightbox);

    parts.close.addEventListener("click", function () { lightbox.close(); });
    parts.previous.addEventListener("click", function () { step(-1); });
    parts.next.addEventListener("click", function () { step(1); });

    /* Arrow keys (Esc is handled by the dialog itself) */
    lightbox.addEventListener("keydown", function (event) {
      if (event.key === "ArrowLeft") { event.preventDefault(); step(-1); }
      if (event.key === "ArrowRight") { event.preventDefault(); step(1); }
    });

    /* Tapping the dark area outside the photo closes the viewer */
    lightbox.addEventListener("click", function (event) {
      if (event.target === lightbox) { lightbox.close(); }
    });

    /* Swipe left or right on a phone */
    var startX = null;
    lightbox.addEventListener("touchstart", function (event) {
      startX = event.changedTouches[0].clientX;
    }, { passive: true });
    lightbox.addEventListener("touchend", function (event) {
      if (startX === null) { return; }
      var distance = event.changedTouches[0].clientX - startX;
      startX = null;
      if (Math.abs(distance) > 50) { step(distance > 0 ? -1 : 1); }
    }, { passive: true });

    /* Put focus back on the thumbnail that was opened */
    lightbox.addEventListener("close", function () {
      parts.picture.removeAttribute("src");
      if (viewer.opener && viewer.opener.focus) { viewer.opener.focus(); }
    });
  }

  function openLightbox(images, index, opener) {
    if (typeof HTMLDialogElement === "undefined") {
      var url = photoUrl(images[index].storage_path);
      if (url) { window.open(url, "_blank", "noopener"); }
      return;
    }
    if (!lightbox) { buildLightbox(); }
    viewer.images = images;
    viewer.index = index;
    viewer.opener = opener;
    showPhoto();
    lightbox.showModal();
    parts.close.focus();
  }

  /* ==========================================================
     The Farm Gallery page
     ========================================================== */
  function buildItem(item, images) {
    var card = el("article", "card gallery-card");
    card.appendChild(el("h3", "", item.title));

    var cleaned = window.ChouSanitize ? window.ChouSanitize.clean(item.description_html) : "";
    if (cleaned) {
      var description = el("div", "rich-text");
      description.innerHTML = cleaned;
      card.appendChild(description);
    }

    var usable = images.filter(function (image) { return photoUrl(image.storage_path); });
    if (usable.length === 0) {
      card.appendChild(el("p", "field-hint", "Photographs for this item will be added soon."));
      return card;
    }

    var thumbs = el("div", "gallery-thumbs");
    usable.forEach(function (image, index) {
      var button = el("button", "thumb-button");
      button.type = "button";
      button.setAttribute("aria-label", "Open photo " + (index + 1) + " of " + usable.length +
        (image.alt_text ? ": " + image.alt_text : ""));

      var picture = el("img");
      picture.src = photoUrl(image.storage_path);
      picture.alt = image.alt_text || "";
      picture.width = 400;
      picture.height = 300;
      picture.loading = "lazy";
      button.appendChild(picture);

      button.addEventListener("click", function () { openLightbox(usable, index, button); });
      thumbs.appendChild(button);

      if (hasText(image.caption)) { button.title = image.caption; }
    });
    card.appendChild(thumbs);
    return card;
  }

  function showGalleryFailure(grid) {
    grid.innerHTML = "";
    var failed = el("div", "empty-state");
    failed.appendChild(el("p", "", "The gallery could not be loaded right now. Please try again later."));
    grid.appendChild(failed);
  }

  function loadGalleryPage() {
    var grids = {
      crop: document.getElementById("crop-gallery-grid"),
      livestock: document.getElementById("livestock-gallery-grid")
    };
    if (!grids.crop && !grids.livestock) { return; }

    sb.from("gallery_items")
      .select("id, gallery_type, title, description_html")
      .eq("status", "published")
      .order("sort_order", { ascending: true })
      .order("title", { ascending: true })
      .limit(100)
      .then(function (result) {
        if (result.error) { showGalleryFailure(grids.crop || grids.livestock); return; }

        var items = result.data || [];
        if (items.length === 0) { return; }          // keep the friendly empty messages

        var ids = items.map(function (item) { return item.id; });
        return sb.from("gallery_images")
          .select("*")
          .in("gallery_item_id", ids)
          .order("sort_order", { ascending: true })
          .then(function (imageResult) {
            var byItem = {};
            (imageResult.data || []).forEach(function (image) {
              if (!byItem[image.gallery_item_id]) { byItem[image.gallery_item_id] = []; }
              byItem[image.gallery_item_id].push(image);
            });

            ["crop", "livestock"].forEach(function (type) {
              var grid = grids[type];
              var ofType = items.filter(function (item) { return item.gallery_type === type; });
              if (!grid || ofType.length === 0) { return; }
              grid.innerHTML = "";
              ofType.forEach(function (item) { grid.appendChild(buildItem(item, byItem[item.id] || [])); });
            });
          });
      })
      .catch(function () { showGalleryFailure(grids.crop || grids.livestock); });
  }

  /* ==========================================================
     "Latest farm photographs" on the Home page
     ========================================================== */
  function loadLatestPhotos() {
    var box = document.getElementById("latest-photos");
    if (!box) { return; }

    sb.from("gallery_images")
      .select("storage_path, alt_text")
      .order("created_at", { ascending: false })
      .limit(6)
      .then(function (result) {
        var images = (result.data || []).filter(function (image) { return photoUrl(image.storage_path); });
        if (result.error || images.length === 0) { return; }

        box.innerHTML = "";
        images.forEach(function (image) {
          var link = el("a", "thumb-button");
          link.href = "gallery.html";
          link.setAttribute("aria-label", "Open the farm gallery" + (image.alt_text ? ": " + image.alt_text : ""));
          var picture = el("img");
          picture.src = photoUrl(image.storage_path);
          picture.alt = image.alt_text || "";
          picture.width = 400;
          picture.height = 300;
          picture.loading = "lazy";
          link.appendChild(picture);
          box.appendChild(link);
        });
      });
  }

  if (onGallery) { loadGalleryPage(); }
  if (onHome) { loadLatestPhotos(); }
})();