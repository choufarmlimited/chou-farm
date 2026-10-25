/* ==========================================================
   Chou Farm Limited - dashboard: Crop management
   ========================================================== */
(function () {
  "use strict";

  if (!window.ChouCrud) { return; }

  window.ChouCrud.register({
    route: "crops",
    table: "crops",
    title: "Crop management",
    intro: "Add, edit, publish and delete the crops shown on the Crop Production page.",
    singular: "crop",
    plural: "crops",
    titleField: "name",
    searchColumns: ["name", "category"],
    searchHint: "Search by name or category",
    orderBy: [
      { column: "sort_order", ascending: true },
      { column: "name", ascending: true }
    ],
    subtitle: function (record) {
      return [
        record.category,
        record.planting_season ? "Planting: " + record.planting_season : ""
      ].filter(function (part) { return part; }).join(" | ");
    },
    defaults: { sort_order: 0, status: "draft" },
    fields: [
      { key: "name", label: "Crop name", type: "text", required: true, max: 150 },
      { key: "category", label: "Category", type: "text", max: 100,
        hint: "For example cereal, vegetable, fruit or legume. Optional." },
      { key: "varieties", label: "Varieties", type: "text", max: 300, hint: "Optional." },
      { key: "planting_season", label: "Planting season", type: "text", max: 100, hint: "Optional." },
      { key: "harvest_season", label: "Harvest season", type: "text", max: 100, hint: "Optional." },
      { key: "description_html", label: "Description", type: "richtext" },
      { key: "is_featured", label: "Show this crop as featured on the home page", type: "checkbox" },
      { key: "sort_order", label: "Display order", type: "number", min: 0, max: 9999,
        hint: "Lower numbers appear first." }
    ],

    /* Photos appear below the form once the crop has been saved */
    afterForm: window.ChouImages
      ? window.ChouImages.gallery({
          table: "crop_images",
          fk: "crop_id",
          bucket: "crops",
          title: "Crop photographs"
        })
      : undefined
  });
})();