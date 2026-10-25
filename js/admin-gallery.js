/* ==========================================================
   Chou Farm Limited - dashboard: Farm gallery
   ========================================================== */
(function () {
  "use strict";

  if (!window.ChouCrud) { return; }

  window.ChouCrud.register({
    route: "gallery",
    table: "gallery_items",
    title: "Farm gallery",
    intro: "Create gallery items with a title, a description and photographs. Published items appear on the Farm Gallery page.",
    singular: "gallery item",
    plural: "gallery items",
    titleField: "title",
    searchColumns: ["title"],
    searchHint: "Search by title",
    orderBy: [
      { column: "sort_order", ascending: true },
      { column: "title", ascending: true }
    ],
    subtitle: function (record) {
      return record.gallery_type === "livestock"
        ? "Livestock Production gallery"
        : "Crop Production gallery";
    },
    defaults: { gallery_type: "crop", sort_order: 0, status: "draft" },
    fields: [
      { key: "gallery_type", label: "Which gallery", type: "select", required: true,
        options: [
          ["crop", "Crop Production gallery"],
          ["livestock", "Livestock Production gallery"]
        ] },
      { key: "title", label: "Title", type: "text", required: true, max: 200 },
      { key: "description_html", label: "Long description", type: "richtext" },
      { key: "sort_order", label: "Display order", type: "number", min: 0, max: 9999,
        hint: "Lower numbers appear first." }
    ],

    /* Photos appear below the form once the item has been saved */
    afterForm: window.ChouImages
      ? window.ChouImages.gallery({
          table: "gallery_images",
          fk: "gallery_item_id",
          bucket: "gallery",
          title: "Gallery photographs"
        })
      : undefined
  });
})();