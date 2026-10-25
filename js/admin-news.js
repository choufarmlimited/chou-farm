/* ==========================================================
   Chou Farm Limited - dashboard: News
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

  window.ChouCrud.register({
    route: "news",
    table: "news_items",
    title: "News",
    intro: "Write and publish news items. The publication date is set when you first publish.",
    singular: "news item",
    plural: "news items",
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
      { key: "summary", label: "Short summary", type: "textarea", max: 500,
        hint: "One or two sentences shown in the news list. Optional." },
      { key: "content_html", label: "Full article", type: "richtext" }
    ],

    /* The news image appears below the form once the item has been saved */
    afterForm: window.ChouImages
      ? window.ChouImages.single({
          table: "news_items",
          bucket: "news",
          column: "image_path",
          altColumn: "image_alt",
          title: "News image",
          hint: "A landscape picture works best. Describe it in the alternative text so everyone can understand it."
        })
      : undefined
  });
})();