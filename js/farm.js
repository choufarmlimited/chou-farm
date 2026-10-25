/* ==========================================================
   Chou Farm Limited - public Our Farm page
   Fills the page from the published farm profile and main location.
   Anything not published keeps its placeholder.
   Needs, loaded before it: Supabase library, DOMPurify,
   config.js, supabase.js, sanitize.js
   ========================================================== */
(function () {
  "use strict";

  if (document.body.getAttribute("data-page") !== "farm" || !window.sb) { return; }

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

  function setText(id, value) {
    var node = document.getElementById(id);
    if (node && hasText(value)) { node.textContent = value; }
  }

  /* ----- The farm profile ----- */
  function fillProfile(row) {
    if (!row) { return; }

    var heading = document.querySelector("[data-farm-headline]");
    if (heading && hasText(row.headline)) { heading.textContent = row.headline; }

    var blocks = document.querySelectorAll("[data-farm-body]");
    Array.prototype.forEach.call(blocks, function (block) {
      var html = Sanitize ? Sanitize.clean(row[block.getAttribute("data-farm-body")]) : "";
      if (html) {
        block.className = "rich-text";
        block.innerHTML = html;
      }
    });
  }

  /* ----- The main location and map ----- */
  function fillLocation(location) {
    if (!location) { return; }

    setText("loc-address", location.physical_address);
    setText("loc-county", location.county);
    setText("loc-subcounty", location.sub_county);
    setText("loc-town", location.nearest_town);

    var lat = Number(location.latitude);
    var lon = Number(location.longitude);
    var hasCoordinates = location.latitude !== null && location.longitude !== null &&
      isFinite(lat) && isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;

    if (hasCoordinates) { setText("loc-gps", lat.toFixed(6) + ", " + lon.toFixed(6)); }

    var mapLink = hasText(location.map_url) && /^https:\/\//i.test(location.map_url) ? location.map_url : "";
    var box = document.getElementById("map-box");
    if (!box || (!hasCoordinates && !mapLink)) { return; }

    box.innerHTML = "";
    box.className = "";

    if (hasCoordinates) {
      var delta = 0.01;
      var bbox = [lon - delta, lat - delta, lon + delta, lat + delta].map(function (n) { return n.toFixed(6); }).join(",");
      var frame = el("iframe", "map-frame");
      frame.title = "Map showing the farm location";
      frame.loading = "lazy";
      frame.setAttribute("referrerpolicy", "no-referrer");
      frame.src = "https://www.openstreetmap.org/export/embed.html?bbox=" + encodeURIComponent(bbox) +
                  "&layer=mapnik&marker=" + encodeURIComponent(lat.toFixed(6) + "," + lon.toFixed(6));
      box.appendChild(frame);
    }

    var links = el("p", "item-meta");
    function addLink(label, url) {
      if (links.childNodes.length) { links.appendChild(document.createTextNode(" | ")); }
      var anchor = el("a", "", label);
      anchor.href = url;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      links.appendChild(anchor);
    }

    if (hasCoordinates) {
      addLink("Open in OpenStreetMap",
        "https://www.openstreetmap.org/?mlat=" + lat.toFixed(6) + "&mlon=" + lon.toFixed(6) +
        "#map=15/" + lat.toFixed(6) + "/" + lon.toFixed(6));
      addLink("Open in Google Maps",
        "https://www.google.com/maps?q=" + lat.toFixed(6) + "," + lon.toFixed(6));
    }
    if (mapLink) { addLink("Open the farm's map link", mapLink); }
    box.appendChild(links);
  }

  Promise.all([
    sb.from("farm_profile")
      .select("headline, description_html, climate_html, soil_html, irrigation_html, crop_areas_html, livestock_facilities_html, machinery_html, calendar_html, practices_html, visiting_html")
      .eq("id", 1).eq("status", "published").maybeSingle()
      .then(function (r) { return r.error ? null : r.data; }, function () { return null; }),

    sb.from("farm_locations")
      .select("physical_address, county, sub_county, nearest_town, latitude, longitude, map_url")
      .eq("status", "published")
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1)
      .then(function (r) { return r.error || !r.data || !r.data.length ? null : r.data[0]; }, function () { return null; })
  ]).then(function (results) {
    fillProfile(results[0]);
    fillLocation(results[1]);
  });
})();