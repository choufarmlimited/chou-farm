/* ==========================================================
   Chou Farm Limited - extra icons
   Adds the "cow-head" icon to Lucide. Use it like any other icon:
     <i data-lucide="cow-head"></i>
   Load this file straight after the Lucide script.
   ========================================================== */
(function () {
  "use strict";

  var COW_HEAD =
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M7 7C5 7 3.5 5.5 3 3.5"/><path d="M17 7c2 0 3.5-1.5 4-3.5"/>' +
    '<path d="M6.6 10 2 9.2c.2 2.4 1.5 3.6 4.7 3.6"/><path d="M17.4 10l4.6-.8c-.2 2.4-1.5 3.6-4.7 3.6"/>' +
    '<path d="M7 7c1.6-.8 3.2-1.2 5-1.2s3.4.4 5 1.2l.6 6.5c.2 4-2.2 7.5-5.6 7.5s-5.8-3.5-5.6-7.5z"/>' +
    '<path d="M9.6 10.5h.01M14.4 10.5h.01M10.5 17.5h.01M13.5 17.5h.01"/></svg>';

  function swapCowHeads() {
    var nodes = document.querySelectorAll('[data-lucide="cow-head"]');
    Array.prototype.forEach.call(nodes, function (node) {
      var holder = document.createElement("div");
      holder.innerHTML = COW_HEAD;
      var svg = holder.firstChild;
      svg.setAttribute("class", ("lucide lucide-cow-head " + (node.getAttribute("class") || "")).trim());
      if (node.parentNode) { node.parentNode.replaceChild(svg, node); }
    });
  }

  if (window.lucide && typeof window.lucide.createIcons === "function") {
    var original = window.lucide.createIcons;
    window.lucide.createIcons = function () {
      swapCowHeads();
      return original.apply(this, arguments);
    };
  }
})();
