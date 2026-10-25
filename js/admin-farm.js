/* ==========================================================
   Chou Farm Limited - dashboard: Farm profile and location
   Tabs: Farm profile, Location, Farm statistics
   ========================================================== */
(function () {
  "use strict";

  if (!window.ChouCrud) { return; }

  function rich(key, label, hint) {
    return { key: key, label: label, type: "richtext", hint: hint };
  }

  /* One record (row 1). Set the status to Published to show it on the Our Farm page. */
  var profile = {
    table: "farm_profile",
    single: true,
    rowId: 1,
    title: "Farm profile",
    titleField: "headline",
    defaults: { status: "draft" },
    fields: [
      { key: "headline", label: "Heading", type: "text", max: 200,
        hint: "Optional short heading above the farm description." },
      rich("description_html", "Farm profile and description"),
      rich("climate_html", "Climate"),
      rich("soil_html", "Soil"),
      rich("irrigation_html", "Irrigation and water resources"),
      rich("crop_areas_html", "Crop production areas"),
      rich("livestock_facilities_html", "Livestock facilities"),
      rich("machinery_html", "Farm machinery and infrastructure"),
      rich("calendar_html", "Seasonal activities and farming calendar"),
      rich("practices_html", "Sustainable farming practices"),
      rich("visiting_html", "Visiting information",
           "Only if visitors are welcome. Leave empty otherwise.")
    ]
  };

  var locations = {
    table: "farm_locations",
    singular: "location",
    plural: "locations",
    titleField: "name",
    searchColumns: ["name", "county", "nearest_town"],
    searchHint: "Search by name, county or town",
    orderBy: [{ column: "is_primary", ascending: false }, { column: "name", ascending: true }],
    subtitle: function (record) {
      return [record.nearest_town, record.county].filter(function (part) { return part; }).join(", ");
    },
    defaults: { status: "draft" },
    fields: [
      { key: "name", label: "Location name", type: "text", required: true, max: 150,
        hint: "For example \"Main farm\"." },
      { key: "physical_address", label: "Physical address", type: "text", max: 300 },
      { key: "county", label: "County", type: "text", max: 100 },
      { key: "sub_county", label: "Sub-county", type: "text", max: 100 },
      { key: "nearest_town", label: "Nearest town", type: "text", max: 100 },
      { key: "latitude", label: "Latitude", type: "number", min: -90, max: 90,
        step: "0.000001", nullable: true,
        hint: "GPS latitude in decimal degrees, for example -1.286389. Enter both latitude and longitude, or neither." },
      { key: "longitude", label: "Longitude", type: "number", min: -180, max: 180,
        step: "0.000001", nullable: true,
        hint: "GPS longitude in decimal degrees, for example 36.817223." },
      { key: "map_url", label: "Map link", type: "text", inputType: "url", max: 500, nullable: true,
        hint: "Optional link to a map. It must start with https://" },
      { key: "is_primary", label: "Main location (shown on the Our Farm page)", type: "checkbox" }
    ]
  };

  /* Figures shown on the Home page. Only published, verified values appear. */
  var stats = {
    table: "farm_stats",
    singular: "statistic",
    plural: "statistics",
    titleField: "label",
    searchColumns: ["label"],
    searchHint: "Search by label",
    orderBy: [{ column: "sort_order", ascending: true }, { column: "label", ascending: true }],
    subtitle: function (record) { return record.value ? "Shown as: " + record.value : ""; },
    defaults: { sort_order: 0, status: "draft" },
    fields: [
      { key: "label", label: "Label", type: "text", required: true, max: 80,
        hint: "For example \"Hectares under crops\"." },
      { key: "value", label: "Value", type: "text", required: true, max: 40,
        hint: "The figure as it should appear, for example 12 or 2,500. Only enter verified figures." },
      { key: "note", label: "Internal note", type: "textarea", max: 300,
        hint: "Where this figure comes from, for example \"farm records, 2026\". Never shown on the website." },
      { key: "sort_order", label: "Display order", type: "number", min: 0, max: 9999,
        hint: "Lower numbers appear first." }
    ]
  };

  window.ChouCrud.registerTabs({
    route: "farm",
    title: "Farm profile and location",
    intro: "Describe the farm, say where it is, and add verified farm figures. Set a record to Published to show it on the website.",
    tabs: [
      { label: "Farm profile", config: profile },
      { label: "Location", config: locations },
      { label: "Farm statistics", config: stats }
    ]
  });
})();