/* ==========================================================
   Chou Farm Limited - dashboard document panel
   ChouFiles.document({...}) uploads one document (PDF, Word,
   Excel or PowerPoint) for a learning material.
   Loaded after js/admin.js and js/uploads.js
   ========================================================== */
(function() {
  "use strict";
  
  var Admin = window.ChouAdmin;
  var Uploads = window.ChouUploads;
  if (!Admin || !Uploads) { window.ChouFiles = null; return; }
  
  var ui = Admin.ui;
  var sb = Admin.sb;
  var MAX_BYTES = 20 * 1024 * 1024;
  var counter = 0;
  
  var MIME = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  };
  var LABELS = { pdf: "PDF document", docx: "Word document", xlsx: "Excel spreadsheet", pptx: "PowerPoint presentation" };
  
  function extensionOf(name) {
    var dot = String(name).lastIndexOf(".");
    return dot < 0 ? "" : String(name).slice(dot + 1).toLowerCase();
  }
  
  function bucketFor(access) {
    return access === "private" ? "learning-private" : "learning-public";
  }
  
  /* Look at the first bytes: PDFs start with %PDF-, Office files are ZIP files */
  function sniff(file) {
    return new Promise(function(resolve) {
      var reader = new FileReader();
      reader.onload = function() {
        var b = new Uint8Array(reader.result);
        if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2D) { resolve("pdf"); return; }
        if (b[0] === 0x50 && b[1] === 0x4B && b[2] === 0x03 && b[3] === 0x04) { resolve("zip"); return; }
        resolve(null);
      };
      reader.onerror = function() { resolve(null); };
      reader.readAsArrayBuffer(file.slice(0, 5));
    });
  }
  
  function validate(file) {
    var ext = extensionOf(file.name);
    if (!file.size) { return Promise.resolve({ ok: false, message: "is empty." }); }
    if (file.size > MAX_BYTES) { return Promise.resolve({ ok: false, message: "is too large (over 20 MB)." }); }
    if (!MIME[ext]) { return Promise.resolve({ ok: false, message: "must be a PDF, Word, Excel or PowerPoint file." }); }
    return sniff(file).then(function(kind) {
      var good = ext === "pdf" ? kind === "pdf" : kind === "zip";
      return good ? { ok: true, ext: ext } : { ok: false, message: "does not look like a real " + LABELS[ext] + "." };
    });
  }
  
  function documentPanel(options) {
    return function(panel, record, context) {
      var readOnly = !!(context && context.readOnly);
      var row = { storage_bucket: null, storage_path: null, file_type: null, access_level: "private" };
      var chosen = null;
      
      var card = ui.el("div", "card form-card");
      card.appendChild(ui.el("h2", "", options.title || "Document file"));
      card.appendChild(ui.el("p", "field-hint",
        "PDF, Word (.docx), Excel (.xlsx) or PowerPoint (.pptx), up to 20 MB. " +
        "For a video or web page, use the link box above instead. Only upload material that Chou Farm Limited is allowed to share."));
      panel.appendChild(card);
      
      var currentBox = ui.el("div", "photo-item");
      card.appendChild(currentBox);
      
      function openFile() {
        if (row.storage_bucket === "learning-private") {
          sb.storage.from("learning-private").createSignedUrl(row.storage_path, 300).then(function(r) {
            if (r.error || !r.data) { ui.toast("The file could not be opened.", "error"); return; }
            window.open(r.data.signedUrl, "_blank", "noopener");
          });
        } else {
          var url = Uploads.publicUrl("learning-public", row.storage_path);
          if (url) { window.open(url, "_blank", "noopener"); }
        }
      }
      
      function renderCurrent() {
        currentBox.innerHTML = "";
        if (!row.storage_path) {
          currentBox.appendChild(ui.el("p", "field-hint", "No file uploaded yet."));
          return;
        }
        var label = LABELS[row.file_type] || "File";
        var where = row.storage_bucket === "learning-private" ? "private" : "public";
        currentBox.appendChild(ui.el("p", "item-meta", "Current file: " + label + " (stored in the " + where + " area)."));
        
        if (!readOnly) {
          var buttons = ui.el("div", "photo-buttons");
          var open = ui.el("button", "btn btn-secondary", "Open file");
          open.type = "button";
          open.addEventListener("click", openFile);
          var remove = ui.el("button", "btn btn-danger-outline", "Remove file");
          remove.type = "button";
          remove.addEventListener("click", removeFile);
          buttons.appendChild(open);
          buttons.appendChild(remove);
          currentBox.appendChild(buttons);
        }
      }
      
      function loadRow() {
        return sb.from("learning_materials")
          .select("storage_bucket, storage_path, file_type, access_level")
          .eq("id", record.id).maybeSingle().then(function(r) {
            if (r.data) { row = r.data; }
            renderCurrent();
          });
      }
      
      function removeFile() {
        ui.confirm({
          title: "Remove this file?",
          message: "The file will be deleted. The material stays, but it needs a new file or a link before it can be published.",
          confirmLabel: "Remove file",
          danger: true
        }).then(function(agreed) {
          if (!agreed) { return; }
          var oldBucket = row.storage_bucket;
          var oldPath = row.storage_path;
          return sb.from("learning_materials").update({ storage_bucket: null, storage_path: null })
            .eq("id", record.id).select("id").then(function(r) {
              if (r.error && r.error.code === "23514") {
                ui.toast("A published material needs a file or a link. Unpublish it first, or add a link, then remove the file.", "error");
                return;
              }
              if (r.error || !r.data || !r.data.length) { ui.toast("The file could not be removed.", "error"); return; }
              Admin.logAudit("learning_file_removed", "learning_materials", record.id, null);
              return Uploads.removeFiles(oldBucket, [oldPath]).then(function() {
                ui.toast("File removed.", "success");
                return loadRow();
              });
            });
        });
      }
      
      renderCurrent();
      loadRow();
      if (readOnly) { return; }
      
      /* The chosen file, waiting to be uploaded */
      var pending = ui.el("div", "queue-item");
      pending.hidden = true;
      var pendingInfo = ui.el("p", "item-meta", "");
      var progress = document.createElement("progress");
      progress.className = "upload-progress";
      progress.max = 100;
      progress.hidden = true;
      var status = ui.el("p", "queue-status", "");
      var actions = ui.el("div", "form-actions");
      var uploadButton = ui.el("button", "btn btn-primary", "Upload file");
      uploadButton.type = "button";
      var cancelButton = ui.el("button", "btn btn-secondary", "Cancel");
      cancelButton.type = "button";
      actions.appendChild(uploadButton);
      actions.appendChild(cancelButton);
      
      var pendingBody = ui.el("div", "stack");
      pendingBody.appendChild(pendingInfo);
      pendingBody.appendChild(progress);
      pendingBody.appendChild(status);
      pendingBody.appendChild(actions);
      pending.appendChild(pendingBody);
      
      function clearChosen() {
        chosen = null;
        pending.hidden = true;
        progress.hidden = true;
        status.textContent = "";
      }
      cancelButton.addEventListener("click", clearChosen);
      
      uploadButton.addEventListener("click", function() {
        if (!chosen) { return; }
        uploadButton.disabled = true;
        cancelButton.disabled = true;
        progress.hidden = false;
        progress.value = 0;
        status.className = "queue-status";
        status.textContent = "Checking...";
        
        /* Use the access level as saved right now */
        loadRow().then(function() {
          var bucket = bucketFor(row.access_level);
          var oldBucket = row.storage_bucket;
          var oldPath = row.storage_path;
          var path = record.id + "/" + Uploads.uuid() + "." + chosen.ext;
          var typed = chosen.file.slice(0, chosen.file.size, MIME[chosen.ext]);
          
          status.textContent = "Uploading...";
          return Uploads.upload(bucket, path, typed, function(percent) {
            progress.value = percent;
            status.textContent = "Uploading " + percent + "%";
          }).then(function() {
            return sb.from("learning_materials").update({ storage_bucket: bucket, storage_path: path })
              .eq("id", record.id).select("id").then(function(r) {
                if (r.error || !r.data || !r.data.length) {
                  return Uploads.removeFiles(bucket, [path]).then(function() {
                    throw new Error("The file could not be saved.");
                  });
                }
                Admin.logAudit("learning_file_added", "learning_materials", record.id, { type: chosen.ext });
                clearChosen();
                ui.toast("File uploaded.", "success");
                var cleanup = oldPath ? Uploads.removeFiles(oldBucket, [oldPath]) : Promise.resolve(true); // old file deleted only now
                return cleanup.then(loadRow);
              });
          });
        }).catch(function(error) {
          var text = error && error.message && error.message.length < 120 ? error.message : "The upload failed. Please try again.";
          status.textContent = "Failed: " + text;
          status.className = "queue-status is-error";
        }).then(function() {
          uploadButton.disabled = false;
          cancelButton.disabled = false;
        });
      });
      
      /* Choose a file */
      counter += 1;
      var input = document.createElement("input");
      input.type = "file";
      input.accept = ".pdf,.docx,.xlsx,.pptx,application/pdf";
      input.className = "file-input-hidden";
      input.id = "doc-input-" + counter;
      var label = ui.el("label", "btn btn-secondary", "Choose a file");
      label.setAttribute("for", input.id);
      
      input.addEventListener("change", function() {
        var file = input.files && input.files[0];
        input.value = "";
        if (!file) { return; }
        validate(file).then(function(check) {
          if (!check.ok) { ui.toast("\"" + file.name + "\" " + check.message, "error"); return; }
          chosen = { file: file, ext: check.ext };
          pendingInfo.textContent = file.name + " (" + Uploads.humanSize(file.size) + ", " + LABELS[check.ext] + ")";
          status.textContent = "";
          pending.hidden = false;
        });
      });
      
      var pickRow = ui.el("div", "upload-actions");
      pickRow.appendChild(input);
      pickRow.appendChild(label);
      card.appendChild(pickRow);
      card.appendChild(pending);
    };
  }
  
  window.ChouFiles = { document: documentPanel };
})();