/* ==========================================================
   Chou Farm Limited - rich-text editor (Quill)
   Needs, loaded before it: Quill, DOMPurify, js/sanitize.js
   Used by every dashboard manager that has a long text box.
   ========================================================== */
(function() {
  "use strict";
  
  if (!window.Quill || !window.ChouSanitize) {
    window.ChouEditor = null;
    return;
  }
  
  var Quill = window.Quill;
  
  /* Save colours, sizes and alignment as inline styles, so public pages
     show them without needing the editor's stylesheet */
  var Align = Quill.import("attributors/style/align");
  var Color = Quill.import("attributors/style/color");
  var Size = Quill.import("attributors/style/size");
  Size.whitelist = ["14px", "18px", "24px"];
  Quill.register(Align, true);
  Quill.register(Color, true);
  Quill.register(Size, true);
  
  /* A "caps" button: makes the selected text UPPERCASE */
  var Parchment = Quill.import("parchment");
  var Caps = new Parchment.Attributor.Style("caps", "text-transform", {
    scope: Parchment.Scope.INLINE,
    whitelist: ["uppercase"]
  });
  Quill.register(Caps, true);
  
  var FORMATS = ["header", "bold", "italic", "underline", "caps", "color", "size", "list", "align", "link"];
  
  var TOOLBAR = {
    container: [
      [{ header: [2, 3, false] }],
      ["bold", "italic", "underline", "caps"],
      [{ color: [] }, { size: ["14px", "18px", "24px"] }],
      [{ list: "ordered" }, { list: "bullet" }],
      [{ align: [] }],
      ["link"],
      ["clean"]
    ],
    handlers: {
      caps: function() {
        var active = this.quill.getFormat().caps;
        this.quill.format("caps", active ? false : "uppercase");
      }
    }
  };
  
  var ChouEditor = {};
  
  /* Turn a <div> into an editor. Returns an object with simple methods. */
  ChouEditor.create = function(container, options) {
    options = options || {};
    
    var quill = new Quill(container, {
      theme: "snow",
      formats: FORMATS,
      placeholder: options.placeholder || "",
      modules: { toolbar: TOOLBAR }
    });
    
    var area = container.querySelector(".ql-editor");
    if (area && options.label) { area.setAttribute("aria-label", options.label); }
    
    var toolbarElement = quill.getModule("toolbar").container;
    
    var api = {
      quill: quill,
      
      /* Put saved HTML into the editor (cleaned first) */
      setHTML: function(html) {
        quill.setContents([]);
        var cleaned = window.ChouSanitize.clean(html);
        if (cleaned) { quill.clipboard.dangerouslyPasteHTML(0, cleaned, "silent"); }
      },
      
      /* Get cleaned HTML out of the editor, or "" when it is empty */
      getHTML: function() {
        if (quill.getText().trim().length === 0) { return ""; }
        return window.ChouSanitize.clean(quill.root.innerHTML);
      },
      
      /* Lock or unlock the editor (for read-only roles) */
      setReadOnly: function(readOnly) {
        quill.enable(!readOnly);
        toolbarElement.style.display = readOnly ? "none" : "";
      },
      
      onChange: function(callback) {
        quill.on("text-change", function(delta, oldDelta, source) {
          if (source === "user") { callback(); }
        });
      },
      
      focus: function() { quill.focus(); }
    };
    
    return api;
  };
  
  window.ChouEditor = ChouEditor;
})();