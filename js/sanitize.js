/* ==========================================================
   Chou Farm Limited - HTML cleaner
   Every piece of saved HTML passes through here before it is
   stored or shown. Needs the DOMPurify library loaded first.
   ========================================================== */
(function () {
  "use strict";

  var ALLOWED_TAGS = [
    "p", "br", "strong", "b", "em", "i", "u", "s",
    "h2", "h3", "h4", "ul", "ol", "li", "a", "span", "blockquote"
  ];
  var ALLOWED_ATTR = ["href", "target", "rel", "style"];

  /* Only these style rules survive, and only with safe values */
  var ALLOWED_STYLES = {
    "color": /^(#[0-9a-f]{3,8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)|[a-z]{3,20})$/i,
    "font-size": /^\d{1,2}(\.\d+)?(px|em|rem)$/i,
    "text-align": /^(left|right|center|justify)$/i,
    "text-transform": /^(uppercase|none)$/i
  };

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  var hookAdded = false;
  function addHook() {
    if (hookAdded || !window.DOMPurify) { return; }
    hookAdded = true;

    window.DOMPurify.addHook("afterSanitizeAttributes", function (node) {
      /* Keep only the safe style rules */
      if (node.hasAttribute && node.hasAttribute("style")) {
        var kept = [];
        node.getAttribute("style").split(";").forEach(function (rule) {
          var colon = rule.indexOf(":");
          if (colon < 0) { return; }
          var property = rule.slice(0, colon).trim().toLowerCase();
          var value = rule.slice(colon + 1).trim();
          if (ALLOWED_STYLES[property] && ALLOWED_STYLES[property].test(value)) {
            kept.push(property + ": " + value);
          }
        });
        if (kept.length) { node.setAttribute("style", kept.join("; ")); }
        else { node.removeAttribute("style"); }
      }

      /* Links: only web, email and phone addresses, and always open safely */
      if (node.tagName === "A") {
        var href = node.getAttribute("href") || "";
        if (!/^(https?:|mailto:|tel:)/i.test(href)) { node.removeAttribute("href"); }
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
      }
    });
  }

  var ChouSanitize = {};

  /* Returns safe HTML. If the cleaner is missing, returns plain escaped text, never raw HTML. */
  ChouSanitize.clean = function (html) {
    var text = String(html === null || html === undefined ? "" : html);
    if (!window.DOMPurify) { return escapeHtml(text); }

    addHook();
    var cleaned = window.DOMPurify.sanitize(text, {
      ALLOWED_TAGS: ALLOWED_TAGS,
      ALLOWED_ATTR: ALLOWED_ATTR,
      ALLOW_DATA_ATTR: false
    });

    /* An empty editor produces <p><br></p>; treat that as nothing */
    return cleaned.replace(/<p><br><\/p>/g, "").trim() === "" ? "" : cleaned;
  };

  /* Plain text version, for short previews in lists */
  ChouSanitize.toText = function (html, maxLength) {
    var doc = new DOMParser().parseFromString(String(html || ""), "text/html");
    var text = (doc.body.textContent || "").replace(/\s+/g, " ").trim();
    if (maxLength && text.length > maxLength) { text = text.slice(0, maxLength).trim() + "..."; }
    return text;
  };

  window.ChouSanitize = ChouSanitize;
})();