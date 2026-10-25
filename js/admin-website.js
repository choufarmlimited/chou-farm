/* ==========================================================
   Chou Farm Limited - dashboard: Website content
   Tabs: Company and contact, About sections, Core values, Team, Milestones
   ========================================================== */
(function () {
  "use strict";

  if (!window.ChouCrud) { return; }

  /* The text blocks of the About Us page. The value on the left
     must match the key used by js/about.js and about.html. */
  var SECTIONS = [
    ["background",    "Company background and history"],
    ["mission",       "Mission"],
    ["vision",        "Vision"],
    ["food_security", "Food security and agricultural innovation"],
    ["soil",          "Soil health and biodiversity"],
    ["water",         "Water conservation"],
    ["climate",       "Climate-smart agriculture"],
    ["community",     "Community engagement and partnerships"]
  ];

  function sectionName(key) {
    for (var i = 0; i < SECTIONS.length; i += 1) {
      if (SECTIONS[i][0] === key) { return SECTIONS[i][1]; }
    }
    return key;
  }

  /* The company logo, and the Home page banner picture (administrators only) */
  var logoPanel = window.ChouImages
    ? window.ChouImages.single({
        table: "site_settings",
        bucket: "logo",
        column: "logo_path",
        title: "Company logo",
        hint: "A square or wide logo works best. JPG, PNG or WebP; a PNG with a transparent background stays transparent. It appears in the header, the sidebar and on the sign-in page.",
        maxWidth: 800,
        quality: 0.9
      })
    : null;

  var heroPanel = window.ChouImages
    ? window.ChouImages.single({
        table: "site_settings",
        bucket: "about",
        column: "hero_image_path",
        title: "Home page banner picture",
        hint: "The picture behind the company name, slogan and buttons at the top of the Home page. Use a landscape photo, at least 1200 pixels wide, with no text in it. A dark green tint is placed over it so the white text stays readable. Remove it to go back to plain green.",
        maxWidth: 1600,
        quality: 0.8
      })
    : null;

  /* One record (row 1). Only administrators may change it. */
  var company = {
    table: "site_settings",
    single: true,
    rowId: 1,
    hasStatus: false,
    minEditRole: "admin",
    title: "Company and contact",
    titleField: "company_name",
    fields: [
      { key: "company_name", label: "Company name", type: "text", required: true, max: 150 },
      { key: "slogan", label: "Slogan", type: "text", required: true, max: 200 },
      { key: "email", label: "Email address", type: "text", inputType: "email", max: 150, nullable: true },
      { key: "phone", label: "Telephone", type: "text", inputType: "tel", max: 20, nullable: true,
        hint: "For example +254712345678." },
      { key: "whatsapp", label: "WhatsApp number", type: "text", inputType: "tel", max: 20, nullable: true,
        hint: "With the country code and digits only, for example +254712345678. A \"Chat on WhatsApp\" link is made from it." },
      { key: "address", label: "Physical address", type: "textarea", max: 300, nullable: true },
      { key: "facebook_url", label: "Facebook link", type: "text", inputType: "url", max: 300, nullable: true,
        hint: "Must start with https://" },
      { key: "instagram_url", label: "Instagram link", type: "text", inputType: "url", max: 300, nullable: true },
      { key: "x_url", label: "X (Twitter) link", type: "text", inputType: "url", max: 300, nullable: true },
      { key: "youtube_url", label: "YouTube link", type: "text", inputType: "url", max: 300, nullable: true },
      { key: "linkedin_url", label: "LinkedIn link", type: "text", inputType: "url", max: 300, nullable: true },
      { key: "tiktok_url", label: "TikTok link", type: "text", inputType: "url", max: 300, nullable: true }
    ],

    afterForm: function (panel, record, context) {
      if (logoPanel) { logoPanel(panel, record, context); }
      if (heroPanel) {
        var second = document.createElement("div");
        second.style.marginTop = "16px";
        panel.appendChild(second);
        heroPanel(second, record, context);
      }
    }
  };

  var aboutSections = {
    table: "about_content",
    singular: "section",
    plural: "sections",
    titleField: "title",
    searchColumns: ["title"],
    searchHint: "Search by title",
    orderBy: [{ column: "sort_order", ascending: true }, { column: "title", ascending: true }],
    subtitle: function (record) { return "Appears as: " + sectionName(record.section_key); },
    defaults: { section_key: "background", sort_order: 0, status: "draft" },
    fields: [
      { key: "section_key", label: "Where it appears on the About Us page", type: "select", required: true,
        options: SECTIONS,
        hint: "Each place can be used once. To change a section, edit the existing one." },
      { key: "title", label: "Heading", type: "text", required: true, max: 200 },
      { key: "body_html", label: "Text", type: "richtext" },
      { key: "sort_order", label: "Display order", type: "number", min: 0, max: 9999,
        hint: "Lower numbers appear first." }
    ]
  };

  var coreValues = {
    table: "core_values",
    singular: "core value",
    plural: "core values",
    titleField: "title",
    searchColumns: ["title"],
    searchHint: "Search by name",
    orderBy: [{ column: "sort_order", ascending: true }, { column: "title", ascending: true }],
    subtitle: function (record) { return record.description || ""; },
    defaults: { sort_order: 0, status: "draft" },
    fields: [
      { key: "title", label: "Value", type: "text", required: true, max: 100 },
      { key: "description", label: "Short description", type: "textarea", max: 500 },
      { key: "sort_order", label: "Display order", type: "number", min: 0, max: 9999,
        hint: "Lower numbers appear first." }
    ]
  };

  var team = {
    table: "team_members",
    singular: "team member",
    plural: "team members",
    titleField: "full_name",
    searchColumns: ["full_name", "role_title"],
    searchHint: "Search by name or role",
    orderBy: [{ column: "sort_order", ascending: true }, { column: "full_name", ascending: true }],
    subtitle: function (record) { return record.role_title || ""; },
    defaults: { sort_order: 0, status: "draft" },
    fields: [
      { key: "full_name", label: "Full name", type: "text", required: true, max: 100 },
      { key: "role_title", label: "Role or job title", type: "text", max: 100 },
      { key: "bio", label: "Short biography", type: "textarea", max: 1000 },
      { key: "sort_order", label: "Display order", type: "number", min: 0, max: 9999,
        hint: "Lower numbers appear first." }
    ],

    /* The photo appears below the form once the team member has been saved */
    afterForm: window.ChouImages
      ? window.ChouImages.single({
          table: "team_members",
          bucket: "about",
          column: "photo_path",
          title: "Photo",
          hint: "A clear head-and-shoulders photo works best. The person's name is used as its alternative text.",
          maxWidth: 800,
          quality: 0.85
        })
      : undefined
  };

  var milestones = {
    table: "milestones",
    singular: "milestone",
    plural: "milestones",
    titleField: "title",
    searchColumns: ["title", "year_label"],
    searchHint: "Search by year or title",
    orderBy: [{ column: "sort_order", ascending: true }, { column: "year_label", ascending: true }],
    subtitle: function (record) { return record.year_label || ""; },
    defaults: { sort_order: 0, status: "draft" },
    fields: [
      { key: "year_label", label: "Year or date", type: "text", required: true, max: 30,
        hint: "For example 2019 or March 2021." },
      { key: "title", label: "Milestone", type: "text", required: true, max: 200 },
      { key: "description", label: "Description", type: "textarea", max: 1000, hint: "Optional." },
      { key: "sort_order", label: "Display order", type: "number", min: 0, max: 9999,
        hint: "Lower numbers appear first. Number them in time order, oldest first." }
    ]
  };

  window.ChouCrud.registerTabs({
    route: "website",
    title: "Website content",
    intro: "Company details, logo and Home page banner, and the About Us page: its text sections, core values, team and milestones.",
    tabs: [
      { label: "Company and contact", config: company },
      { label: "About sections", config: aboutSections },
      { label: "Core values", config: coreValues },
      { label: "Team", config: team },
      { label: "Milestones", config: milestones }
    ]
  });
})();