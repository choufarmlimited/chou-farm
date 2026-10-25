/* ==========================================================
   Chou Farm Limited - dashboard: Livestock management
   Species and breeds
   ========================================================== */
(function () {
  "use strict";

  if (!window.ChouCrud) { return; }

  window.ChouCrud.register({
    route: "livestock",
    table: "livestock",
    title: "Livestock management",
    intro: "Add, edit, publish and delete the livestock species and breeds shown on the Livestock Production page.",
    singular: "livestock record",
    plural: "livestock records",
    titleField: "species",
    searchColumns: ["species", "breed"],
    searchHint: "Search by species or breed",
    orderBy: [
      { column: "sort_order", ascending: true },
      { column: "species", ascending: true }
    ],
    subtitle: function (record) {
      return record.breed ? "Breed: " + record.breed : "";
    },
    defaults: { sort_order: 0, status: "draft" },
    fields: [
      { key: "species", label: "Animal species", type: "text", required: true, max: 150,
        hint: "For example cattle, goats, sheep or poultry." },
      { key: "breed", label: "Breed", type: "text", max: 150, hint: "Optional." },
      { key: "description_html", label: "Description", type: "richtext" },
      { key: "is_featured", label: "Show this record as featured on the home page", type: "checkbox" },
      { key: "sort_order", label: "Display order", type: "number", min: 0, max: 9999,
        hint: "Lower numbers appear first." }
    ],

    /* Photos appear below the form once the record has been saved */
    afterForm: window.ChouImages
      ? window.ChouImages.gallery({
          table: "livestock_images",
          fk: "livestock_id",
          bucket: "livestock",
          title: "Livestock photographs"
        })
      : undefined
  });
})();