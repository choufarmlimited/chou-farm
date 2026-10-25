/* ==========================================================
   Chou Farm Limited - dashboard: Product catalogue
   Two tabs: Products and Categories
   ========================================================== */
(function () {
  "use strict";

  if (!window.ChouCrud) { return; }

  var AVAILABILITY_LABELS = {
    in_stock: "In stock",
    limited: "Limited",
    out_of_stock: "Out of stock"
  };

  function formatKES(value) {
    var number = Number(value);
    if (value === null || value === undefined || isNaN(number)) { return ""; }
    return "KES " + number.toLocaleString("en-KE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  var products = {
    table: "products",
    singular: "product",
    plural: "products",
    titleField: "name",
    searchColumns: ["name"],
    searchHint: "Search by product name",
    orderBy: [{ column: "name", ascending: true }],
    subtitle: function (record) {
      var price = record.price_kes === null || record.price_kes === undefined
        ? "Price on request"
        : formatKES(record.price_kes) + " per " + record.unit;
      return price + " | " + (AVAILABILITY_LABELS[record.availability] || record.availability);
    },
    defaults: { unit: "kg", availability: "in_stock", status: "draft" },
    fields: [
      { key: "name", label: "Product name", type: "text", required: true, max: 200 },
      { key: "category_id", label: "Category", type: "relation",
        table: "product_categories", labelKey: "name",
        hint: "Add categories on the Categories tab first. Optional." },
      { key: "description_html", label: "Description", type: "richtext" },
      { key: "unit", label: "Unit of sale", type: "text", required: true, max: 50,
        hint: "For example kg, bag, crate, litre or piece." },
      { key: "price_kes", label: "Price in KES", type: "number", min: 0, max: 100000000,
        step: "0.01", nullable: true,
        hint: "Price for one unit, in Kenyan Shillings. Leave empty for \"price on request\"." },
      { key: "availability", label: "Availability", type: "select", required: true,
        options: [["in_stock", "In stock"], ["limited", "Limited"], ["out_of_stock", "Out of stock"]] },
      { key: "is_featured", label: "Show this product as featured on the home page", type: "checkbox" }
    ],

    /* Photos appear below the form once the product has been saved */
    afterForm: window.ChouImages
      ? window.ChouImages.gallery({
          table: "product_images",
          fk: "product_id",
          bucket: "products",
          title: "Product photographs"
        })
      : undefined
  };

  var categories = {
    table: "product_categories",
    singular: "category",
    plural: "categories",
    titleField: "name",
    searchColumns: ["name"],
    searchHint: "Search by category name",
    orderBy: [
      { column: "sort_order", ascending: true },
      { column: "name", ascending: true }
    ],
    subtitle: function (record) { return record.description || ""; },
    defaults: { sort_order: 0, status: "published" },
    fields: [
      { key: "name", label: "Category name", type: "text", required: true, max: 100 },
      { key: "description", label: "Description", type: "textarea", max: 500, hint: "Optional." },
      { key: "sort_order", label: "Display order", type: "number", min: 0, max: 9999,
        hint: "Lower numbers appear first." }
    ]
  };

  window.ChouCrud.registerTabs({
    route: "products",
    title: "Product catalogue",
    intro: "Manage the products you sell, their categories, prices and availability.",
    tabs: [
      { label: "Products", config: products },
      { label: "Categories", config: categories }
    ]
  });
})();