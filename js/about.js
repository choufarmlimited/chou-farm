/* ==========================================================
   Chou Farm Limited - public About Us page
   Fills the page from published database records. Anything
   not published yet keeps its placeholder.
   Needs, loaded before it: Supabase library, DOMPurify,
   config.js, supabase.js, sanitize.js
   ========================================================== */
(function() {
  "use strict";
  
  if (document.body.getAttribute("data-page") !== "about" || !window.sb) { return; }
  
  var sb = window.sb;
  var Sanitize = window.ChouSanitize;
  
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) { node.className = className; }
    if (text !== undefined) { node.textContent = text; }
    return node;
  }
  
  function hasText(value) {
    return value !== null && value !== undefined && String(value).trim() !== "";
  }
  
  function fetchPublished(table, columns, order) {
    var query = sb.from(table).select(columns).eq("status", "published");
    order.forEach(function(column) { query = query.order(column, { ascending: true }); });
    return query.limit(100).then(function(result) {
      return result.error ? [] : (result.data || []);
    }).catch(function() { return []; });
  }
  
  function photoUrl(path) {
    if (!hasText(path) || !/^[A-Za-z0-9\/_.\-]+$/.test(path) || path.indexOf("..") !== -1) { return ""; }
    return sb.storage.from("about").getPublicUrl(path).data.publicUrl;
  }
  
  /* ----- Text sections (background, mission, vision, and so on) ----- */
  function fillSections(records) {
    var byKey = {};
    records.forEach(function(record) { byKey[record.section_key] = record; });
    
    var blocks = document.querySelectorAll("[data-about-section]");
    Array.prototype.forEach.call(blocks, function(block) {
      var record = byKey[block.getAttribute("data-about-section")];
      if (!record) { return; }
      
      var titleNode = block.querySelector("[data-about-title]");
      if (titleNode && hasText(record.title)) { titleNode.textContent = record.title; }
      
      var bodyNode = block.querySelector("[data-about-body]");
      var cleaned = Sanitize ? Sanitize.clean(record.body_html) : "";
      if (bodyNode && cleaned) {
        bodyNode.className = "rich-text";
        bodyNode.innerHTML = cleaned;
      }
    });
  }
  
  /* ----- Core values ----- */
  function fillValues(values) {
    var grid = document.getElementById("values-grid");
    if (!grid || values.length === 0) { return; }
    grid.innerHTML = "";
    
    values.forEach(function(value) {
      var card = el("article", "card");
      var icon = el("span", "card-icon");
      icon.innerHTML = '<i data-lucide="shield-check"></i>';
      card.appendChild(icon);
      card.appendChild(el("h3", "", value.title));
      if (hasText(value.description)) { card.appendChild(el("p", "", value.description)); }
      grid.appendChild(card);
    });
  }
  
  /* ----- Team ----- */
  function fillTeam(members) {
    var grid = document.getElementById("team-grid");
    if (!grid || members.length === 0) { return; }
    grid.innerHTML = "";
    
    members.forEach(function(member) {
      var card = el("article", "card team-card");
      var photo = el("span", "team-photo");
      var url = photoUrl(member.photo_path);
      
      if (url) {
        var image = el("img");
        image.src = url;
        image.alt = member.full_name;
        image.width = 96;
        image.height = 96;
        image.loading = "lazy";
        photo.appendChild(image);
      } else {
        photo.innerHTML = '<i data-lucide="user-round"></i>';
      }
      
      card.appendChild(photo);
      card.appendChild(el("h3", "", member.full_name));
      if (hasText(member.role_title)) { card.appendChild(el("p", "team-role", member.role_title)); }
      if (hasText(member.bio)) { card.appendChild(el("p", "", member.bio)); }
      grid.appendChild(card);
    });
  }
  
  /* ----- Milestones ----- */
  function fillMilestones(items) {
    var list = document.getElementById("milestones-list");
    if (!list || items.length === 0) { return; }
    list.innerHTML = "";
    
    items.forEach(function(item) {
      var entry = el("li");
      entry.appendChild(el("p", "timeline-date", item.year_label));
      entry.appendChild(el("p", "", item.title));
      if (hasText(item.description)) { entry.appendChild(el("p", "item-excerpt", item.description)); }
      list.appendChild(entry);
    });
  }
  
  Promise.all([
    fetchPublished("about_content", "section_key, title, body_html", ["sort_order"]),
    fetchPublished("core_values", "title, description", ["sort_order", "title"]),
    fetchPublished("team_members", "full_name, role_title, bio, photo_path", ["sort_order", "full_name"]),
    fetchPublished("milestones", "year_label, title, description", ["sort_order", "year_label"])
  ]).then(function(results) {
    fillSections(results[0]);
    fillValues(results[1]);
    fillTeam(results[2]);
    fillMilestones(results[3]);
    if (window.lucide) { window.lucide.createIcons(); }
  });
})();