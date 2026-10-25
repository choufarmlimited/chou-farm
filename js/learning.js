/* ==========================================================
   Chou Farm Limited - public Learning Materials
   Search, filters, PDF preview and downloads.
   Private materials are never returned to visitors by the database.
   Needs, loaded before it: Supabase library, DOMPurify,
   config.js, supabase.js, sanitize.js
   ========================================================== */
(function () {
  "use strict";

  if (document.body.getAttribute("data-page") !== "learning" || !window.sb) { return; }

  var sb = window.sb;
  var PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
  var PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  var TYPE_INFO = {
    pdf:   ["PDF document", "file-text"],
    docx:  ["Word document", "file-text"],
    xlsx:  ["Excel spreadsheet", "file-spreadsheet"],
    pptx:  ["PowerPoint presentation", "presentation"],
    video: ["Video", "video"],
    link:  ["Web link", "link"],
    other: ["File", "file"]
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

  function safe(request, fallback) {
    return request.then(function (result) {
      return result.error ? fallback : (result.data || fallback);
    }, function () { return fallback; });
  }

  function safePath(path) {
    return hasText(path) && /^[A-Za-z0-9\/_.\-]+$/.test(path) && path.indexOf("..") === -1;
  }

  function fileUrl(item) {
    if (item.storage_bucket !== "learning-public" || !safePath(item.storage_path)) { return ""; }
    return sb.storage.from("learning-public").getPublicUrl(item.storage_path).data.publicUrl;
  }

  function downloadUrl(item) {
    var name = String(item.title).replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "download";
    var extension = item.storage_path.split(".").pop();
    return sb.storage.from("learning-public")
      .getPublicUrl(item.storage_path, { download: name + "." + extension }).data.publicUrl;
  }

  function coverUrl(path) {
    if (!safePath(path)) { return ""; }
    return sb.storage.from("learning-public").getPublicUrl(path).data.publicUrl;
  }

  /* ==========================================================
     PDF preview (PDF.js)
     ========================================================== */
  var viewer = { dialog: null, doc: null, page: 1, busy: false, parts: {} };
  var pdfLibrary = null;

  function loadPdfLibrary() {
    if (window.pdfjsLib) { return Promise.resolve(window.pdfjsLib); }
    if (pdfLibrary) { return pdfLibrary; }
    pdfLibrary = new Promise(function (resolve, reject) {
      var tag = document.createElement("script");
      tag.src = PDFJS;
      tag.onload = function () {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
        resolve(window.pdfjsLib);
      };
      tag.onerror = function () { pdfLibrary = null; reject(new Error("The viewer could not be loaded.")); };
      document.head.appendChild(tag);
    });
    return pdfLibrary;
  }

  function renderPage() {
    var parts = viewer.parts;
    if (!viewer.doc || viewer.busy) { return; }
    viewer.busy = true;

    viewer.doc.getPage(viewer.page).then(function (page) {
      var width = parts.wrap.clientWidth || 600;
      var base = page.getViewport({ scale: 1 });
      var ratio = Math.min(window.devicePixelRatio || 1, 2);
      var viewport = page.getViewport({ scale: (width / base.width) * ratio });

      parts.canvas.width = Math.floor(viewport.width);
      parts.canvas.height = Math.floor(viewport.height);
      parts.canvas.style.width = Math.floor(viewport.width / ratio) + "px";
      parts.canvas.style.height = Math.floor(viewport.height / ratio) + "px";

      return page.render({ canvasContext: parts.canvas.getContext("2d"), viewport: viewport }).promise;
    }).then(function () {
      parts.counter.textContent = "Page " + viewer.page + " of " + viewer.doc.numPages;
      parts.previous.disabled = viewer.page <= 1;
      parts.next.disabled = viewer.page >= viewer.doc.numPages;
      parts.wrap.scrollTop = 0;
    }).catch(function () {
      parts.counter.textContent = "This page could not be shown.";
    }).then(function () { viewer.busy = false; });
  }

  function buildViewer() {
    var parts = viewer.parts;
    viewer.dialog = el("dialog", "lightbox");
    viewer.dialog.setAttribute("aria-labelledby", "pdf-title");

    var top = el("div", "lightbox-top");
    parts.title = el("strong", "", "");
    parts.title.id = "pdf-title";
    parts.close = el("button", "btn btn-light", "Close");
    parts.close.type = "button";
    top.appendChild(parts.title);
    top.appendChild(parts.close);

    parts.wrap = el("div", "pdf-wrap");
    parts.canvas = el("canvas");
    parts.canvas.setAttribute("role", "img");
    parts.canvas.setAttribute("aria-label", "Page of the document");
    parts.message = el("p", "pdf-message", "");
    parts.wrap.appendChild(parts.message);
    parts.wrap.appendChild(parts.canvas);

    var controls = el("div", "lightbox-controls");
    parts.previous = el("button", "btn btn-light", "Previous page");
    parts.previous.type = "button";
    parts.counter = el("span", "lightbox-counter", "");
    parts.next = el("button", "btn btn-light", "Next page");
    parts.next.type = "button";
    parts.download = el("a", "btn btn-light", "Download");
    parts.download.hidden = true;
    controls.appendChild(parts.previous);
    controls.appendChild(parts.counter);
    controls.appendChild(parts.next);
    controls.appendChild(parts.download);

    viewer.dialog.appendChild(top);
    viewer.dialog.appendChild(parts.wrap);
    viewer.dialog.appendChild(controls);
    document.body.appendChild(viewer.dialog);

    parts.close.addEventListener("click", function () { viewer.dialog.close(); });
    parts.previous.addEventListener("click", function () { if (viewer.page > 1) { viewer.page -= 1; renderPage(); } });
    parts.next.addEventListener("click", function () {
      if (viewer.doc && viewer.page < viewer.doc.numPages) { viewer.page += 1; renderPage(); }
    });
    viewer.dialog.addEventListener("keydown", function (event) {
      if (event.key === "ArrowLeft") { parts.previous.click(); }
      if (event.key === "ArrowRight") { parts.next.click(); }
    });
    viewer.dialog.addEventListener("close", function () {
      if (viewer.doc) { viewer.doc.destroy(); viewer.doc = null; }
      parts.canvas.width = 0;
      if (viewer.opener && viewer.opener.focus) { viewer.opener.focus(); }
    });
  }

  function openPdf(item, opener) {
    var url = fileUrl(item);
    if (!url) { return; }

    if (typeof HTMLDialogElement === "undefined") {
      window.open(url, "_blank", "noopener");
      return;
    }

    if (!viewer.dialog) { buildViewer(); }
    var parts = viewer.parts;
    viewer.opener = opener;
    viewer.page = 1;
    viewer.busy = false;

    parts.title.textContent = item.title;
    parts.message.textContent = "Loading the document...";
    parts.message.hidden = false;
    parts.canvas.hidden = true;
    parts.counter.textContent = "";
    parts.previous.disabled = true;
    parts.next.disabled = true;

    if (item.access_level === "public_download") {
      parts.download.href = downloadUrl(item);
      parts.download.hidden = false;
    } else {
      parts.download.hidden = true;
    }

    viewer.dialog.showModal();
    parts.close.focus();

    loadPdfLibrary().then(function (lib) {
      return lib.getDocument({ url: url }).promise;
    }).then(function (doc) {
      viewer.doc = doc;
      parts.message.hidden = true;
      parts.canvas.hidden = false;
      renderPage();
    }).catch(function () {
      parts.message.textContent = item.access_level === "public_download"
        ? "The preview could not be loaded. You can still download the document."
        : "The preview could not be loaded right now. Please try again later.";
    });
  }

  /* ==========================================================
     The list
     ========================================================== */
  var list = document.getElementById("learning-list");
  var searchInput = document.getElementById("learning-search");
  var categorySelect = document.getElementById("learning-category");
  var typeSelect = document.getElementById("learning-type");
  var count = document.getElementById("learning-count");
  if (!list) { return; }

  var emptyContent = list.innerHTML;     // the friendly message already on the page
  list.innerHTML = "";
  list.appendChild(el("p", "field-hint", "Loading learning materials..."));

  Promise.all([
    safe(sb.from("learning_categories").select("id, name").order("sort_order", { ascending: true }).order("name", { ascending: true }), []),
    safe(
      sb.from("learning_materials")
        .select("id, title, description, file_type, storage_bucket, storage_path, external_url, cover_path, access_level, category_id")
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(200),
      null
    )
  ]).then(function (results) {
    var categories = results[0];
    var materials = results[1];

    if (materials === null) {
      list.innerHTML = "";
      var failed = el("div", "empty-state");
      failed.appendChild(el("p", "", "The learning materials could not be loaded right now. Please try again later."));
      list.appendChild(failed);
      return;
    }

    if (materials.length === 0) {
      list.innerHTML = emptyContent;
      if (window.lucide) { window.lucide.createIcons(); }
      return;
    }

    var categoryNames = {};
    categories.forEach(function (category) {
      categoryNames[category.id] = category.name;
      var used = materials.some(function (m) { return m.category_id === category.id; });
      if (used && categorySelect) {
        var option = el("option", "", category.name);
        option.value = category.id;
        categorySelect.appendChild(option);
      }
    });

    if (typeSelect) {
      var seen = {};
      materials.forEach(function (m) {
        if (seen[m.file_type] || !TYPE_INFO[m.file_type]) { return; }
        seen[m.file_type] = true;
        var option = el("option", "", TYPE_INFO[m.file_type][0]);
        option.value = m.file_type;
        typeSelect.appendChild(option);
      });
    }

    function buildActions(item) {
      var actions = el("div", "record-actions");
      var link = hasText(item.external_url) && /^https:\/\//i.test(item.external_url) ? item.external_url : "";
      var url = fileUrl(item);

      if (link) {
        var open = el("a", "btn btn-primary", item.file_type === "video" ? "Watch video" : "Open link");
        open.href = link;
        open.target = "_blank";
        open.rel = "noopener noreferrer";
        actions.appendChild(open);
      }

      if (url) {
        if (item.file_type === "pdf") {
          var preview = el("button", "btn btn-primary", "Preview");
          preview.type = "button";
          preview.addEventListener("click", function () { openPdf(item, preview); });
          actions.appendChild(preview);
        }
        if (item.access_level === "public_download") {
          var download = el("a", "btn btn-secondary", "Download");
          download.href = downloadUrl(item);
          actions.appendChild(download);
        } else if (item.file_type !== "pdf") {
          actions.appendChild(el("span", "field-hint", "View only. A preview is not available for this file type."));
        }
      }
      return actions;
    }

    function buildCard(item) {
      var card = el("article", "card item-card");
      var info = TYPE_INFO[item.file_type] || TYPE_INFO.other;

      var cover = coverUrl(item.cover_path);
      if (cover) {
        var picture = el("img", "item-cover");
        picture.src = cover;
        picture.alt = "";
        picture.width = 800;
        picture.height = 600;
        picture.loading = "lazy";
        card.appendChild(picture);
      } else {
        var iconBox = el("span", "card-icon");
        iconBox.innerHTML = '<i data-lucide="' + info[1] + '"></i>';
        card.appendChild(iconBox);
      }

      var tags = el("div", "item-tags");
      tags.appendChild(el("span", "badge badge-in", info[0]));
      if (categoryNames[item.category_id]) { tags.appendChild(el("span", "badge badge-limited", categoryNames[item.category_id])); }
      card.appendChild(tags);

      card.appendChild(el("h3", "", item.title));
      if (hasText(item.description)) { card.appendChild(el("p", "", item.description)); }
      card.appendChild(buildActions(item));
      return card;
    }

    function render() {
      var words = searchInput ? searchInput.value.trim().toLowerCase() : "";
      var category = categorySelect ? categorySelect.value : "";
      var type = typeSelect ? typeSelect.value : "";

      var shown = materials.filter(function (m) {
        if (category && m.category_id !== category) { return false; }
        if (type && m.file_type !== type) { return false; }
        if (!words) { return true; }
        return (m.title + " " + (m.description || "")).toLowerCase().indexOf(words) !== -1;
      });

      list.innerHTML = "";
      if (shown.length === 0) {
        var none = el("div", "empty-state");
        none.appendChild(el("p", "", "No learning materials match your search."));
        list.appendChild(none);
      } else {
        shown.forEach(function (m) { list.appendChild(buildCard(m)); });
      }
      if (count) { count.textContent = shown.length + (shown.length === 1 ? " resource" : " resources") + " shown"; }
      if (window.lucide) { window.lucide.createIcons(); }
    }

    [searchInput, categorySelect, typeSelect].forEach(function (control) {
      if (!control) { return; }
      control.disabled = false;
      control.addEventListener(control === searchInput ? "input" : "change", render);
    });
    render();
  });
})();