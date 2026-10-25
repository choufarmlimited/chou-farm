/* ==========================================================
   Chou Farm Limited - dashboard: Learning materials
   Two tabs: Materials and Categories
   ========================================================== */
(function () {
  "use strict";

  if (!window.ChouCrud) { return; }

  var ACCESS_LABELS = {
    public_download: "Public download",
    view_only: "View only",
    private: "Private"
  };
  var TYPE_LABELS = {
    pdf: "PDF", docx: "Word", xlsx: "Excel", pptx: "PowerPoint",
    video: "Video", link: "Link", other: "File"
  };

  var documentPanel = window.ChouFiles
    ? window.ChouFiles.document({ title: "Document file" })
    : null;

  var coverPanel = window.ChouImages
    ? window.ChouImages.single({
        table: "learning_materials",
        bucket: "learning-public",
        column: "cover_path",
        title: "Cover image (optional)",
        hint: "A picture shown on the learning page. It is public even if the material itself is private, so do not use a picture of private content. Without one, a file-type icon is shown."
      })
    : null;

  var materials = {
    table: "learning_materials",
    singular: "material",
    plural: "materials",
    titleField: "title",
    searchColumns: ["title", "description"],
    searchHint: "Search by title or description",
    orderBy: [{ column: "created_at", ascending: false }],
    subtitle: function (record) {
      return (ACCESS_LABELS[record.access_level] || record.access_level) +
        " | " + (TYPE_LABELS[record.file_type] || record.file_type);
    },
    defaults: { access_level: "private", status: "draft" },
    fields: [
      { key: "title", label: "Title", type: "text", required: true, max: 200 },
      { key: "category_id", label: "Category", type: "relation",
        table: "learning_categories", labelKey: "name",
        hint: "Manage categories on the Categories tab. Optional." },
      { key: "description", label: "Description", type: "textarea", max: 1000 },
      { key: "access_level", label: "Who can open it", type: "select", required: true,
        options: [
          ["public_download", "Public download"],
          ["view_only", "View only (PDFs, videos and links)"],
          ["private", "Private (administrators only)"]
        ],
        hint: "To change this after a file is uploaded: remove the file, change this and save, then upload the file again." },
      { key: "external_url", label: "Link to a video or web page", type: "text", inputType: "url",
        max: 500, nullable: true,
        hint: "Optional. Must start with https://. Use this instead of uploading a file." }
    ],

    /* The file and cover image appear below the form once the material has been saved */
    afterForm: function (panel, record, context) {
      if (documentPanel) { documentPanel(panel, record, context); }
      if (coverPanel) {
        var second = document.createElement("div");
        second.style.marginTop = "16px";
        panel.appendChild(second);
        coverPanel(second, record, context);
      }
    }
  };

  var categories = {
    table: "learning_categories",
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
    route: "learning",
    title: "Learning materials",
    intro: "Upload documents, or add links, and choose who may open them.",
    tabs: [
      { label: "Materials", config: materials },
      { label: "Categories", config: categories }
    ]
  });
})();