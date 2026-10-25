/* ==========================================================
   Chou Farm Limited - dashboard: Farming guides
   Two tabs: Guides and Categories
   ========================================================== */
(function () {
  "use strict";

  if (!window.ChouCrud) { return; }

  function formatDate(value) {
    var date = new Date(value);
    if (isNaN(date.getTime())) { return ""; }
    return new Intl.DateTimeFormat("en-KE", {
      timeZone: "Africa/Nairobi", day: "numeric", month: "short", year: "numeric"
    }).format(date);
  }

  var guides = {
    table: "farming_guides",
    singular: "guide",
    plural: "guides",
    titleField: "title",
    publishDate: true,
    searchColumns: ["title", "summary"],
    searchHint: "Search by title or summary",
    orderBy: [{ column: "created_at", ascending: false }],
    subtitle: function (record) {
      return record.published_at ? "Published " + formatDate(record.published_at) : "";
    },
    defaults: { status: "draft" },
    fields: [
      { key: "title", label: "Title", type: "text", required: true, max: 200 },
      { key: "category_id", label: "Category", type: "relation",
        table: "guide_categories", labelKey: "name",
        hint: "Manage categories on the Categories tab. Optional." },
      { key: "summary", label: "Short summary", type: "textarea", max: 500,
        hint: "One or two sentences shown in the guide list." },
      { key: "content_html", label: "Full guide", type: "richtext",
        hint: "Only publish advice that has been checked by someone qualified. Every guide page reminds readers to consult an extension officer or veterinarian." },
      { key: "is_featured", label: "Show this guide as featured on the home page", type: "checkbox" }
    ],

    /* The cover image appears below the form once the guide has been saved */
    afterForm: window.ChouImages
      ? window.ChouImages.single({
          table: "farming_guides",
          bucket: "guides",
          column: "cover_path",
          altColumn: "cover_alt",
          title: "Cover image",
          hint: "A landscape picture works best. Describe it in the alternative text so everyone can understand it."
        })
      : undefined
  };

  var categories = {
    table: "guide_categories",
    hasStatus: false,
    singular: "category",
    plural: "categories",
    titleField: "name",
    searchColumns: ["name"],
    searchHint: "Search by category name",
    orderBy: [
      { column: "sort_order", ascending: true },
      { column: "name", ascending: true }
    ],
    defaults: { sort_order: 0 },
    fields: [
      { key: "name", label: "Category name", type: "text", required: true, max: 100 },
      { key: "sort_order", label: "Display order", type: "number", min: 0, max: 9999,
        hint: "Lower numbers appear first." }
    ]
  };

  window.ChouCrud.registerTabs({
    route: "guides",
    title: "Farming guides",
    intro: "Write and publish farming guides, and manage their categories.",
    tabs: [
      { label: "Guides", config: guides },
      { label: "Categories", config: categories }
    ]
  });
})();