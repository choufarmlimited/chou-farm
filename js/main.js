/* ==========================================================
   Chou Farm Limited - shared page helpers
   ========================================================== */
(function() {
  "use strict";
  
  /* ---------- Helpers other files can use: ChouFarm.xxx ---------- */
  var ChouFarm = {};
  
  // Format a number as Kenyan Shillings, for example KES 1,250.00
  ChouFarm.formatKES = function(amount) {
    var number = Number(amount);
    if (isNaN(number)) return "";
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES"
    }).format(number);
  };
  
  // Format a date in East Africa Time (UTC+03:00), for example 18 October 2026
  ChouFarm.formatDate = function(value) {
    var date = new Date(value);
    if (isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("en-KE", {
      timeZone: "Africa/Nairobi",
      day: "numeric",
      month: "long",
      year: "numeric"
    }).format(date);
  };
  
  // Show the farm statistics section only when real values are supplied.
  // items looks like: [{ label: "Hectares under crops", value: "12" }]
  // textContent is used so nothing typed by an administrator can run as code.
  ChouFarm.renderStats = function(items) {
    var section = document.getElementById("stats-section");
    var grid = document.getElementById("stats-grid");
    if (!section || !grid) return;
    
    grid.innerHTML = "";
    
    var valid = (items || []).filter(function(item) {
      return item && String(item.label || "").trim() !== "" && String(item.value || "").trim() !== "";
    });
    
    if (valid.length === 0) {
      section.hidden = true;
      return;
    }
    
    valid.forEach(function(item) {
      var card = document.createElement("div");
      card.className = "card center";
      
      var value = document.createElement("p");
      value.style.fontSize = "1.8rem";
      value.style.fontWeight = "700";
      value.style.margin = "0";
      value.textContent = item.value;
      
      var label = document.createElement("p");
      label.style.margin = "0";
      label.textContent = item.label;
      
      card.appendChild(value);
      card.appendChild(label);
      grid.appendChild(card);
    });
    
    section.hidden = false;
  };
  
  window.ChouFarm = ChouFarm;
  
  /* ---------- Page-wide tidying ---------- */
  
  // Lazy-load images that do not already say how to load
  Array.prototype.forEach.call(document.querySelectorAll("img:not([loading])"), function(img) {
    img.setAttribute("loading", "lazy");
  });
  
  // Links that open a new tab get safe settings
  Array.prototype.forEach.call(document.querySelectorAll('a[target="_blank"]'), function(link) {
    link.setAttribute("rel", "noopener noreferrer");
  });
  
  // Draw any Lucide icons that were not drawn yet
  // (safe to run again, it only touches icons not yet converted)
  function drawIcons() {
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }
  }
  drawIcons();
  window.addEventListener("load", drawIcons);
  
  // Statistics stay hidden until an administrator enters real values (Phase 5)
  ChouFarm.renderStats([]);
})();