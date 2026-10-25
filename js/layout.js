/* ==========================================================
   Chou Farm Limited - shared header, sidebar and footer
   Defined once here and inserted into every page.
   After the page loads, the company name, slogan, logo and
   contact details are fetched from the database settings, and
   the search and search-engine helpers are loaded.
   ========================================================== */
(function () {
  "use strict";

  /* ---------- Starting values (placeholders) ----------
     These show until an administrator saves real values
     in Dashboard > Website content > Company and contact. */
  var SITE = {
    name: "Chou Farm Limited",
    slogan: "Fresh Produce. Premium Quality.",
    email: "[Email to be added]",
    phone: "[Telephone to be added]",
    address: "[Physical address to be added]"
  };

  /* ---------- The nine sidebar items, in the required order ---------- */
  var NAV = [
    { label: "Home",               href: "index.html",      icon: "house",          pages: ["index.html"] },
    { label: "About Us",           href: "about.html",      icon: "building-2",     pages: ["about.html"] },
    { label: "Our Farm",           href: "farm.html",       icon: "sprout",         pages: ["farm.html"] },
    { label: "Production",         icon: "package",
      pages: ["production.html", "crop-production.html", "livestock-production.html"],
      children: [
        { label: "Crop Production",      href: "crop-production.html",      icon: "wheat", pages: ["crop-production.html"] },
        { label: "Livestock Production", href: "livestock-production.html", icon: "cow-head",  pages: ["livestock-production.html"] }
      ] },
    { label: "Sales",              href: "sales.html",      icon: "shopping-cart",  pages: ["sales.html", "product.html"] },
    { label: "Farm Gallery",       href: "gallery.html",    icon: "images",         pages: ["gallery.html"] },
    { label: "Farming Guides",     href: "guides.html",     icon: "book-open",      pages: ["guides.html", "guide.html"] },
    { label: "Learning Materials", href: "learning.html",   icon: "graduation-cap", pages: ["learning.html"] },
    { label: "Contact Us",         href: "contact.html",    icon: "mail",           pages: ["contact.html"] }
  ];

  /* Shortcuts shown in the header on large screens */
  var SHORTCUTS = [
    { label: "Home",  href: "index.html" },
    { label: "Our Farm", href: "farm.html" },
    { label: "Sales", href: "sales.html" },
    { label: "Contact", href: "contact.html" }
  ];

  /* ---------- Helpers ---------- */
  function currentPage() {
    var file = window.location.pathname.split("/").pop();
    return file === "" ? "index.html" : file;
  }

  function icon(name) {
    return '<i data-lucide="' + name + '" aria-hidden="true"></i>';
  }

  function brandMark() {
    return '<span class="brand-mark">' + icon("sprout") + "</span>";
  }

  function brandBlock() {
    return brandMark() +
      '<span class="brand-text">' +
        '<span class="brand-name">' + SITE.name + "</span>" +
        '<span class="brand-slogan">' + SITE.slogan + "</span>" +
      "</span>";
  }

  /* ---------- Header ---------- */
  function buildHeader() {
    var links = SHORTCUTS.map(function (s) {
      return '<a href="' + s.href + '">' + s.label + "</a>";
    }).join("");

    return '<header class="site-header">' +
      '<button class="icon-btn" id="menu-btn" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="sidebar">' +
        icon("menu") +
      "</button>" +
      '<a class="brand" href="index.html" aria-label="' + SITE.name + ' home">' + brandBlock() + "</a>" +
      '<nav class="header-nav" aria-label="Quick links">' + links + "</nav>" +
      '<div class="header-admin">' +
        '<button class="icon-btn" id="search-btn" type="button" aria-label="Search the website">' + icon("search") + "</button>" +
      "</div>" +
    "</header>";
  }

  /* ---------- Sidebar ---------- */
  function buildSidebar(page) {
    var items = NAV.map(function (item, i) {
      var active = item.pages.indexOf(page) !== -1;

      if (item.children) {
        var subId = "submenu-" + i;
        var subs = item.children.map(function (c) {
          var cActive = c.pages.indexOf(page) !== -1;
          return "<li>" +
            '<a class="nav-link' + (cActive ? " active" : "") + '" href="' + c.href + '"' + (cActive ? ' aria-current="page"' : "") + ">" +
              icon(c.icon) + "<span>" + c.label + "</span></a></li>";
        }).join("");

        return "<li>" +
          '<button class="nav-link' + (active ? " active" : "") + '" type="button" aria-expanded="' + (active ? "true" : "false") + '" aria-controls="' + subId + '" data-toggle-submenu>' +
            icon(item.icon) + "<span>" + item.label + "</span>" + icon("chevron-down").replace("<i ", '<i class="chevron" ') +
          "</button>" +
          '<ul class="submenu' + (active ? " open" : "") + '" id="' + subId + '">' + subs + "</ul>" +
        "</li>";
      }

      return "<li>" +
        '<a class="nav-link' + (active ? " active" : "") + '" href="' + item.href + '"' + (active ? ' aria-current="page"' : "") + ">" +
          icon(item.icon) + "<span>" + item.label + "</span></a></li>";
    }).join("");

    return '<aside class="sidebar" id="sidebar" aria-label="Main navigation">' +
      '<div class="sidebar-top">' +
        '<span class="sidebar-title">Menu</span>' +
        '<button class="icon-btn" id="close-btn" type="button" aria-label="Close menu">' + icon("x") + "</button>" +
      "</div>" +
      '<nav class="sidebar-nav" aria-label="Sections"><ul>' + items + "</ul></nav>" +
      '<div class="sidebar-bottom">' +
        '<div class="brand">' + brandBlock() + "</div>" +
      "</div>" +
    "</aside>";
  }

  /* ---------- Footer ---------- */
  function buildFooter() {
    var year = new Date().getFullYear();

    var sectionLinks = NAV.map(function (item) {
      var href = item.href || "production.html";
      return '<li><a href="' + href + '">' + item.label + "</a></li>";
    }).join("");

    return '<footer class="site-footer">' +
      '<div class="container footer-grid">' +
        "<div>" +
          '<div class="footer-brand">' + brandMark() + '<h2 data-site="name">' + SITE.name + "</h2></div>" +
          '<p data-site="slogan">' + SITE.slogan + "</p>" +
          "<p>Crop production, livestock production, agricultural products and farmer education.</p>" +
        "</div>" +
        "<div>" +
          "<h3>Explore</h3>" +
          '<ul class="footer-list">' + sectionLinks + "</ul>" +
        "</div>" +
        "<div>" +
          "<h3>Contact</h3>" +
          '<ul class="footer-list">' +
            '<li data-site="email">' + SITE.email + "</li>" +
            '<li data-site="phone">' + SITE.phone + "</li>" +
            '<li data-site-whatsapp-row hidden><span data-site="whatsapp"></span></li>' +
            '<li data-site="address">' + SITE.address + "</li>" +
          "</ul>" +
        "</div>" +
        "<div>" +
          "<h3>Follow us</h3>" +
          '<div data-site-social><p>[Social media links to be added]</p></div>' +
        "</div>" +
      "</div>" +
      '<div class="footer-bottom"><div class="container">' +
        '<span>&copy; ' + year + ' <span data-site="name">' + SITE.name + "</span>. All rights reserved.</span>" +
        "<span>" +
          '<a href="privacy.html">Privacy policy</a> &nbsp;|&nbsp; ' +
          '<a href="terms.html">Terms of use</a> &nbsp;|&nbsp; ' +
          '<a href="accessibility.html">Accessibility</a> &nbsp;|&nbsp; ' +
          '<a href="#" id="cookie-settings">Cookie settings</a>' +
        "</span>" +
      "</div></div>" +
    "</footer>";
  }

  /* ---------- Cookie notice ---------- */
  function buildCookieNotice() {
    return '<div class="cookie-notice" id="cookie-notice" role="region" aria-label="Cookie notice">' +
      "<p>This website uses only essential browser storage to work properly. " +
      'See our <a href="privacy.html">privacy policy</a>.</p>' +
      '<button class="btn btn-primary" id="cookie-accept" type="button">Got it</button>' +
    "</div>";
  }

  function getCookieChoice() {
    try { return window.localStorage.getItem("chou_cookie_notice"); } catch (e) { return null; }
  }
  function setCookieChoice() {
    try { window.localStorage.setItem("chou_cookie_notice", "seen"); } catch (e) { /* ignore */ }
  }

  /* ---------- Insert everything into the page ---------- */
  var page = currentPage();

  var headerSlot = document.getElementById("site-header");
  var sidebarSlot = document.getElementById("site-sidebar");
  var footerSlot = document.getElementById("site-footer");

  if (headerSlot) headerSlot.innerHTML = buildHeader();
  if (sidebarSlot) sidebarSlot.innerHTML = buildSidebar(page);
  if (footerSlot) footerSlot.innerHTML = buildFooter();

  /* The skip link needs the main area to be able to take focus */
  var mainArea = document.getElementById("main");
  if (mainArea) { mainArea.setAttribute("tabindex", "-1"); }

  var overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.id = "overlay";
  document.body.appendChild(overlay);

  var cookieWrap = document.createElement("div");
  cookieWrap.innerHTML = buildCookieNotice();
  document.body.appendChild(cookieWrap.firstChild);

  /* ---------- Behaviour: open and close the sidebar ---------- */
  var menuBtn = document.getElementById("menu-btn");
  var closeBtn = document.getElementById("close-btn");
  var sidebar = document.getElementById("sidebar");
  var desktopQuery = window.matchMedia("(min-width: 1024px)");

  /* While the menu covers the page on a phone, the page behind it
     cannot be reached with a keyboard or a screen reader */
  function setPageInert(on) {
    ["site-header", "main", "site-footer"].forEach(function (id) {
      var node = document.getElementById(id);
      if (!node) { return; }
      if (on) { node.setAttribute("inert", ""); } else { node.removeAttribute("inert"); }
    });
  }

  function openSidebar() {
    if (!sidebar) return;
    sidebar.classList.add("open");
    overlay.classList.add("show");
    document.body.classList.add("sidebar-open");
    menuBtn.setAttribute("aria-expanded", "true");
    menuBtn.setAttribute("aria-label", "Close menu");
    if (!desktopQuery.matches) { setPageInert(true); }
    closeBtn.focus();
  }

  function closeSidebar(returnFocus) {
    if (!sidebar) return;
    sidebar.classList.remove("open");
    overlay.classList.remove("show");
    document.body.classList.remove("sidebar-open");
    menuBtn.setAttribute("aria-expanded", "false");
    menuBtn.setAttribute("aria-label", "Open menu");
    setPageInert(false);
    if (returnFocus) menuBtn.focus();
  }

  if (menuBtn) {
    menuBtn.addEventListener("click", function () {
      if (sidebar.classList.contains("open")) { closeSidebar(false); } else { openSidebar(); }
    });
  }
  if (closeBtn) closeBtn.addEventListener("click", function () { closeSidebar(true); });
  overlay.addEventListener("click", function () { closeSidebar(true); });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && sidebar && sidebar.classList.contains("open")) {
      closeSidebar(true);
    }
  });

  /* Turning a tablet sideways: stop locking the page if the menu now sits beside it */
  function onScreenChange() {
    if (desktopQuery.matches) { setPageInert(false); }
    else if (sidebar && sidebar.classList.contains("open")) { setPageInert(true); }
  }
  if (desktopQuery.addEventListener) { desktopQuery.addEventListener("change", onScreenChange); }
  else if (desktopQuery.addListener) { desktopQuery.addListener(onScreenChange); }

  /* ---------- Behaviour: Production submenu ---------- */
  var toggles = document.querySelectorAll("[data-toggle-submenu]");
  Array.prototype.forEach.call(toggles, function (btn) {
    btn.addEventListener("click", function () {
      var menu = document.getElementById(btn.getAttribute("aria-controls"));
      var isOpen = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", isOpen ? "false" : "true");
      if (menu) menu.classList.toggle("open", !isOpen);
    });
  });

  /* ---------- Behaviour: cookie notice ---------- */
  var notice = document.getElementById("cookie-notice");
  var acceptBtn = document.getElementById("cookie-accept");
  var settingsLink = document.getElementById("cookie-settings");

  if (notice && !getCookieChoice()) notice.classList.add("show");
  if (acceptBtn) {
    acceptBtn.addEventListener("click", function () {
      setCookieChoice();
      notice.classList.remove("show");
    });
  }
  if (settingsLink) {
    settingsLink.addEventListener("click", function (e) {
      e.preventDefault();
      notice.classList.add("show");
    });
  }

  /* ---------- Behaviour: the search button ---------- */
  var searchBtn = document.getElementById("search-btn");
  var searchWanted = false;

  if (searchBtn) {
    searchBtn.addEventListener("click", function () {
      if (window.ChouSearch) {
        window.ChouSearch.open(searchBtn);
      } else {
        searchWanted = true;                 // opens as soon as search has loaded
        searchBtn.setAttribute("aria-busy", "true");
      }
    });
  }

  /* ---------- Draw the Lucide icons ---------- */
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }

  /* ==========================================================
     Company settings from the database
     Runs after the page has loaded. If the page does not already
     have the database scripts, they are loaded here.
     ========================================================== */
  function hasText(value) {
    return value !== null && value !== undefined && String(value).trim() !== "";
  }

  function each(selector, action) {
    Array.prototype.forEach.call(document.querySelectorAll(selector), action);
  }

  function makeLink(text, href, newTab) {
    var anchor = document.createElement("a");
    anchor.textContent = text;
    anchor.href = href;
    if (newTab) {
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
    }
    return anchor;
  }

  function applySettings(settings) {
    if (!settings) { return; }

    /* Name and slogan */
    if (hasText(settings.company_name)) {
      each('[data-site="name"], .brand-name', function (node) { node.textContent = settings.company_name; });
    }
    if (hasText(settings.slogan)) {
      each('[data-site="slogan"], .brand-slogan', function (node) { node.textContent = settings.slogan; });
    }

    /* Logo (header, sidebar and footer) */
    var logoPath = settings.logo_path;
    if (hasText(logoPath) && /^[A-Za-z0-9\/_.\-]+$/.test(logoPath) && logoPath.indexOf("..") === -1) {
      var logoUrl = window.sb.storage.from("logo").getPublicUrl(logoPath).data.publicUrl;
      each(".brand-mark", function (node) {
        var image = document.createElement("img");
        image.className = "brand-logo";
        image.src = logoUrl;
        image.alt = "";
        image.width = 40;
        image.height = 40;
        node.replaceWith(image);
      });
    }

    /* Email */
    if (hasText(settings.email) && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(settings.email)) {
      each('[data-site="email"]', function (node) {
        node.textContent = "";
        node.appendChild(makeLink(settings.email, "mailto:" + settings.email, false));
      });
    }

    /* Telephone */
    if (hasText(settings.phone)) {
      var dial = settings.phone.replace(/[^0-9+]/g, "");
      each('[data-site="phone"]', function (node) {
        node.textContent = "";
        node.appendChild(dial.length >= 7 ? makeLink(settings.phone, "tel:" + dial, false)
                                          : document.createTextNode(settings.phone));
      });
    }

    /* WhatsApp */
    if (hasText(settings.whatsapp)) {
      var digits = settings.whatsapp.replace(/[^0-9]/g, "");
      if (digits.length >= 9) {
        each('[data-site="whatsapp"]', function (node) {
          node.textContent = "";
          node.appendChild(makeLink("Chat on WhatsApp", "https://wa.me/" + digits, true));
        });
        each("[data-site-whatsapp-row]", function (node) { node.hidden = false; });
      }
    }

    /* Address */
    if (hasText(settings.address)) {
      each('[data-site="address"]', function (node) { node.textContent = settings.address; });
    }

    /* Social media */
    var socials = [
      ["Facebook", settings.facebook_url],
      ["Instagram", settings.instagram_url],
      ["X", settings.x_url],
      ["YouTube", settings.youtube_url],
      ["LinkedIn", settings.linkedin_url],
      ["TikTok", settings.tiktok_url]
    ].filter(function (pair) { return hasText(pair[1]) && /^https:\/\//i.test(pair[1]); });

    if (socials.length) {
      each("[data-site-social]", function (node) {
        node.textContent = "";
        socials.forEach(function (pair, index) {
          if (index > 0) { node.appendChild(document.createTextNode(" | ")); }
          node.appendChild(makeLink(pair[0], pair[1], true));
        });
      });
    }
  }

  function loadScript(source) {
    return new Promise(function (resolve, reject) {
      var tag = document.createElement("script");
      tag.src = source;
      tag.onload = resolve;
      tag.onerror = reject;
      document.head.appendChild(tag);
    });
  }

  function ensureBackend() {
    if (window.sb) { return Promise.resolve(true); }

    var chain = Promise.resolve();
    if (!window.supabase) {
      chain = chain.then(function () {
        return loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js");
      });
    }
    if (!window.CHOU_CONFIG) {
      chain = chain.then(function () { return loadScript("js/config.js"); });
    }
    chain = chain.then(function () { return loadScript("js/supabase.js"); });

    return chain.then(function () { return !!window.sb; }).catch(function () { return false; });
  }

  /* The helpers that need the database: search and search-engine details */
  function loadHelpers() {
    var sanitize = window.ChouSanitize || !window.DOMPurify
      ? Promise.resolve()
      : loadScript("js/sanitize.js");

    return sanitize.catch(function () { /* optional */ })
      .then(function () { return loadScript("js/seo.js").catch(function () { /* optional */ }); })
      .then(function () { return loadScript("js/search.js"); })
      .then(function () {
        if (searchBtn) { searchBtn.removeAttribute("aria-busy"); }
        if (searchWanted && window.ChouSearch) { searchWanted = false; window.ChouSearch.open(searchBtn); }
      })
      .catch(function () { /* search stays unavailable */ });
  }

  window.addEventListener("load", function () {
    ensureBackend().then(function (ready) {
      if (!ready) {
        if (searchBtn) { searchBtn.disabled = true; searchBtn.title = "Search is not available right now"; }
        return;
      }
      return window.sb.from("site_settings")
        .select("company_name, slogan, logo_path, email, phone, whatsapp, address, facebook_url, instagram_url, x_url, youtube_url, linkedin_url, tiktok_url")
        .eq("id", 1)
        .maybeSingle()
        .then(function (result) {
          if (!result.error) {
            applySettings(result.data);
            window.ChouSite = { settings: result.data || {} };
          }
        })
        .then(loadHelpers);
    }).catch(function () { /* keep the placeholders */ });
  });
})();