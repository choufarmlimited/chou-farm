/* ==========================================================
   Chou Farm Limited - dashboard photo panels
   ChouImages.gallery({...})  many photos for one record
   ChouImages.single({...})   one image stored in a column
   Each returns a function that a manager uses as its "afterForm".
   Loaded after js/admin.js and js/uploads.js
   ========================================================== */
(function () {
  "use strict";

  var Admin = window.ChouAdmin;
  var Uploads = window.ChouUploads;
  if (!Admin || !Uploads) { window.ChouImages = null; return; }

  var ui = Admin.ui;
  var sb = Admin.sb;
  var ACCEPT = "image/jpeg,image/png,image/webp";
  var MAX_QUEUE = 20;
  var counter = 0;

  function nextId(prefix) { counter += 1; return prefix + "-" + counter; }

  function field(labelText, input) {
    var wrap = ui.el("div", "field");
    var id = nextId("img-field");
    input.id = id;
    var label = ui.el("label", "", labelText);
    label.setAttribute("for", id);
    wrap.appendChild(label);
    wrap.appendChild(input);
    return wrap;
  }

  function textInput(value, maxLength) {
    var input = ui.el("input", "input");
    input.type = "text";
    input.maxLength = maxLength;
    input.value = value || "";
    return input;
  }

  function small(label, className, onClick) {
    var node = ui.el("button", "btn " + className, label);
    node.type = "button";
    node.addEventListener("click", onClick);
    return node;
  }

  /* "Choose photos" and "Take a photo" buttons */
  function pickButtons(multiple, onPick) {
    var row = ui.el("div", "upload-actions");

    function make(labelText, capture, allowMany) {
      var input = document.createElement("input");
      input.type = "file";
      input.accept = ACCEPT;
      input.className = "file-input-hidden";
      if (allowMany) { input.multiple = true; }
      if (capture) { input.setAttribute("capture", "environment"); }
      input.id = nextId("file-input");

      var label = ui.el("label", "btn btn-secondary", labelText);
      label.setAttribute("for", input.id);

      input.addEventListener("change", function () {
        var files = Array.prototype.slice.call(input.files || []);
        input.value = "";
        if (files.length) { onPick(files); }
      });

      row.appendChild(input);
      row.appendChild(label);
    }

    make(multiple ? "Choose photos" : "Choose a photo", false, multiple);
    make("Take a photo", true, false);
    return row;
  }

  function validateAll(files, handle) {
    return files.reduce(function (chain, file) {
      return chain.then(function () {
        return Uploads.validateImage(file).then(function (check) {
          if (check.ok) { handle(file); }
          else { ui.toast("\"" + file.name + "\" " + check.message, "error"); }
        });
      });
    }, Promise.resolve());
  }

  /* Resize, check the size and upload. Resolves to { path } */
  function resizeAndUpload(file, bucket, folder, options, onStatus, onProgress) {
    onStatus("Resizing...");
    return Uploads.compressImage(file, options).then(function (result) {
      if (result.blob.size > Uploads.MAX_OUTPUT_BYTES) {
        throw new Error("The picture is still over 5 MB after resizing.");
      }
      var path = folder + "/" + Uploads.uuid() + "." + result.ext;
      onStatus("Uploading...");
      return Uploads.upload(bucket, path, result.blob, onProgress).then(function () {
        return { path: path, size: result.blob.size };
      });
    });
  }

  function failureText(error) {
    var text = (error && error.message) ? error.message : "";
    return text && text.length < 120 ? text : "The upload failed. Please try again.";
  }

  /* ==========================================================
     Many photos for one record
     options: table, fk, bucket, title
     ========================================================== */
  function gallery(options) {
    return function (panel, record, context) {
      var readOnly = !!(context && context.readOnly);
      var items = [];

      var card = ui.el("div", "card form-card");
      card.appendChild(ui.el("h2", "", options.title || "Photographs"));
      card.appendChild(ui.el("p", "field-hint",
        "JPG, PNG or WebP. Photos are resized and compressed before they are uploaded. " +
        "Describe each photo in the alternative text so that everyone can understand it."));

      var list = ui.el("div", "photo-grid");
      list.setAttribute("aria-live", "polite");
      card.appendChild(list);
      panel.appendChild(card);

      function loadItems() {
        list.innerHTML = "";
        list.appendChild(ui.el("p", "field-hint", "Loading photographs..."));
        return sb.from(options.table).select("*").eq(options.fk, record.id)
          .order("sort_order", { ascending: true }).order("created_at", { ascending: true })
          .then(function (r) {
            if (r.error) {
              list.innerHTML = "";
              list.appendChild(ui.el("p", "form-message is-error", "The photographs could not be loaded."));
              return;
            }
            items = r.data || [];
            renderList();
          });
      }

      function nextOrder() {
        return items.reduce(function (max, item) { return Math.max(max, item.sort_order); }, -1) + 1;
      }

      function move(index, delta) {
        var target = index + delta;
        if (target < 0 || target >= items.length) { return; }
        var moved = items.splice(index, 1)[0];
        items.splice(target, 0, moved);

        var updates = [];
        items.forEach(function (item, position) {
          if (item.sort_order !== position) {
            item.sort_order = position;
            updates.push(sb.from(options.table).update({ sort_order: position }).eq("id", item.id));
          }
        });
        renderList();
        Promise.all(updates).then(function (results) {
          if (results.some(function (r) { return r.error; })) {
            ui.toast("The new order could not be saved. Please reload and try again.", "error");
          }
        });
      }

      function saveDetails(item, captionInput, altInput, button) {
        var alt = altInput.value.trim() || captionInput.value.trim();
        if (!alt) {
          ui.toast("Describe the photo in the alternative text.", "error");
          altInput.focus();
          return;
        }
        button.disabled = true;
        sb.from(options.table)
          .update({ caption: captionInput.value.trim(), alt_text: alt })
          .eq("id", item.id).select("id").then(function (r) {
            button.disabled = false;
            if (r.error || !r.data || !r.data.length) {
              ui.toast("The details could not be saved.", "error");
              return;
            }
            item.caption = captionInput.value.trim();
            item.alt_text = alt;
            altInput.value = alt;
            ui.toast("Photo details saved.", "success");
          });
      }

      function removeItem(item) {
        ui.confirm({
          title: "Remove this photo?",
          message: "The photo will be removed from the website and deleted. This cannot be undone.",
          confirmLabel: "Remove",
          danger: true
        }).then(function (agreed) {
          if (!agreed) { return; }
          return sb.from(options.table).delete().eq("id", item.id).select("id").then(function (r) {
            if (r.error || !r.data || !r.data.length) {
              ui.toast("The photo could not be removed.", "error");
              return;
            }
            items = items.filter(function (other) { return other.id !== item.id; });
            renderList();
            Admin.logAudit(options.table + "_removed", options.table, item.id, { record: record.id });
            return Uploads.removeFiles(options.bucket, [item.storage_path]).then(function (deleted) {
              ui.toast(deleted ? "Photo removed."
                : "Photo removed from the website. The file will be cleaned up later.", deleted ? "success" : "info");
            });
          });
        });
      }

      function replaceItem(item, file, button) {
        Uploads.validateImage(file).then(function (check) {
          if (!check.ok) { ui.toast("\"" + file.name + "\" " + check.message, "error"); return; }

          button.disabled = true;
          var oldPath = item.storage_path;
          return resizeAndUpload(file, options.bucket, String(record.id), {}, function (text) {
            button.textContent = text;
          }, function (percent) {
            button.textContent = "Uploading " + percent + "%";
          }).then(function (uploaded) {
            return sb.from(options.table).update({ storage_path: uploaded.path })
              .eq("id", item.id).select("id").then(function (r) {
                if (r.error || !r.data || !r.data.length) {
                  return Uploads.removeFiles(options.bucket, [uploaded.path]).then(function () {
                    throw new Error("The new photo could not be saved.");
                  });
                }
                item.storage_path = uploaded.path;
                renderList();
                ui.toast("Photo replaced.", "success");
                Admin.logAudit(options.table + "_replaced", options.table, item.id, { record: record.id });
                return Uploads.removeFiles(options.bucket, [oldPath]);   // delete the old file only now
              });
          }).catch(function (error) {
            ui.toast(failureText(error), "error");
          }).then(function () {
            button.disabled = false;
            button.textContent = "Replace";
          });
        });
      }

      function renderList() {
        list.innerHTML = "";
        if (!items.length) {
          list.appendChild(ui.el("p", "field-hint", "No photographs yet."));
          return;
        }

        items.forEach(function (item, index) {
          var box = ui.el("div", "photo-item");
          var image = ui.el("img", "photo-thumb");
          image.src = Uploads.publicUrl(options.bucket, item.storage_path);
          image.alt = item.alt_text || "";
          image.width = 400;
          image.height = 300;
          image.loading = "lazy";
          box.appendChild(image);

          if (readOnly) {
            if (item.caption) { box.appendChild(ui.el("p", "", item.caption)); }
            list.appendChild(box);
            return;
          }

          var captionInput = textInput(item.caption, 200);
          var altInput = textInput(item.alt_text, 300);
          box.appendChild(field("Caption (optional)", captionInput));
          box.appendChild(field("Alternative text (describes the photo)", altInput));

          var buttons = ui.el("div", "photo-buttons");
          var save = small("Save details", "btn-primary", function () { saveDetails(item, captionInput, altInput, save); });
          buttons.appendChild(save);

          var earlier = small("Move earlier", "btn-secondary", function () { move(index, -1); });
          earlier.disabled = index === 0;
          var later = small("Move later", "btn-secondary", function () { move(index, 1); });
          later.disabled = index === items.length - 1;
          buttons.appendChild(earlier);
          buttons.appendChild(later);

          var replaceInput = document.createElement("input");
          replaceInput.type = "file";
          replaceInput.accept = ACCEPT;
          replaceInput.className = "file-input-hidden";
          replaceInput.id = nextId("replace");
          var replaceLabel = ui.el("label", "btn btn-secondary", "Replace");
          replaceLabel.setAttribute("for", replaceInput.id);
          replaceInput.addEventListener("change", function () {
            var file = replaceInput.files && replaceInput.files[0];
            replaceInput.value = "";
            if (file) { replaceItem(item, file, replaceLabel); }
          });
          buttons.appendChild(replaceInput);
          buttons.appendChild(replaceLabel);

          buttons.appendChild(small("Remove", "btn-danger-outline", function () { removeItem(item); }));
          box.appendChild(buttons);
          list.appendChild(box);
        });
      }

      /* ----- Adding new photos ----- */
      if (!readOnly) {
        var queue = [];
        var queueBox = ui.el("div", "upload-queue");
        var queueMessage = ui.el("p", "form-message", "");
        queueMessage.setAttribute("role", "alert");
        queueMessage.hidden = true;
        var queueActions = ui.el("div", "form-actions");
        var uploadButton = ui.el("button", "btn btn-primary", "Upload photos");
        uploadButton.type = "button";
        var cancelButton = ui.el("button", "btn btn-secondary", "Cancel selection");
        cancelButton.type = "button";
        queueActions.appendChild(uploadButton);
        queueActions.appendChild(cancelButton);
        queueActions.hidden = true;
        var busy = false;

        function showQueueMessage(text) {
          if (!text) { queueMessage.hidden = true; queueMessage.textContent = ""; return; }
          queueMessage.textContent = text;
          queueMessage.className = "form-message is-error";
          queueMessage.hidden = false;
        }

        function refreshQueueUi() {
          queueActions.hidden = queue.length === 0;
          uploadButton.textContent = "Upload " + queue.length + (queue.length === 1 ? " photo" : " photos");
        }

        function dropFromQueue(entry) {
          URL.revokeObjectURL(entry.previewUrl);
          if (entry.node.parentNode) { entry.node.parentNode.removeChild(entry.node); }
          queue = queue.filter(function (other) { return other !== entry; });
          refreshQueueUi();
        }

        function addToQueue(file) {
          if (queue.length >= MAX_QUEUE) {
            ui.toast("You can upload up to " + MAX_QUEUE + " photos at a time.", "error");
            return;
          }
          var entry = { file: file, previewUrl: URL.createObjectURL(file) };

          var node = ui.el("div", "queue-item");
          var preview = ui.el("img", "photo-thumb");
          preview.src = entry.previewUrl;
          preview.alt = "Preview of " + file.name;
          node.appendChild(preview);

          var details = ui.el("div", "stack");
          details.appendChild(ui.el("p", "item-meta", file.name + " (" + Uploads.humanSize(file.size) + ")"));
          entry.caption = textInput("", 200);
          entry.alt = textInput("", 300);
          details.appendChild(field("Caption (optional)", entry.caption));
          details.appendChild(field("Alternative text (describes the photo)", entry.alt));

          entry.progress = document.createElement("progress");
          entry.progress.className = "upload-progress";
          entry.progress.max = 100;
          entry.progress.value = 0;
          entry.progress.hidden = true;
          details.appendChild(entry.progress);

          entry.status = ui.el("p", "queue-status", "Ready to upload.");
          details.appendChild(entry.status);

          entry.removeButton = small("Remove from selection", "btn-secondary", function () { dropFromQueue(entry); });
          details.appendChild(entry.removeButton);

          node.appendChild(details);
          entry.node = node;
          queue.push(entry);
          queueBox.appendChild(node);
          refreshQueueUi();
        }

        function uploadOne(entry) {
          var alt = entry.alt.value.trim() || entry.caption.value.trim();
          entry.progress.hidden = false;
          entry.progress.value = 0;
          entry.status.className = "queue-status";

          return resizeAndUpload(entry.file, options.bucket, String(record.id), {}, function (text) {
            entry.status.textContent = text;
          }, function (percent) {
            entry.progress.value = percent;
            entry.status.textContent = "Uploading " + percent + "%";
          }).then(function (uploaded) {
            var row = {
              storage_path: uploaded.path,
              caption: entry.caption.value.trim(),
              alt_text: alt,
              sort_order: nextOrder()
            };
            row[options.fk] = record.id;

            return sb.from(options.table).insert(row).select().single().then(function (r) {
              if (r.error || !r.data) {
                return Uploads.removeFiles(options.bucket, [uploaded.path]).then(function () {
                  throw new Error("The photo could not be saved.");
                });
              }
              items.push(r.data);
              dropFromQueue(entry);
              renderList();
              return true;
            });
          }).catch(function (error) {
            entry.status.textContent = "Failed: " + failureText(error);
            entry.status.className = "queue-status is-error";
            return false;
          });
        }

        function setBusy(state) {
          busy = state;
          uploadButton.disabled = state;
          cancelButton.disabled = state;
          queue.forEach(function (entry) { entry.removeButton.disabled = state; });
        }

        uploadButton.addEventListener("click", function () {
          if (busy || !queue.length) { return; }
          showQueueMessage("");

          for (var i = 0; i < queue.length; i += 1) {
            if (!queue[i].alt.value.trim() && !queue[i].caption.value.trim()) {
              showQueueMessage("Please describe each photo in the alternative text before uploading.");
              queue[i].alt.focus();
              return;
            }
          }

          setBusy(true);
          var pending = queue.slice();
          var done = 0;

          pending.reduce(function (chain, entry) {
            return chain.then(function () {
              return uploadOne(entry).then(function (ok) { if (ok) { done += 1; } });
            });
          }, Promise.resolve()).then(function () {
            setBusy(false);
            refreshQueueUi();
            if (done) {
              ui.toast(done + (done === 1 ? " photo" : " photos") + " uploaded.", "success");
              Admin.logAudit(options.table + "_added", options.table, record.id, { count: done });
            }
            if (done < pending.length) {
              showQueueMessage("Some photos could not be uploaded. Check the messages below each one and try again.");
            }
          });
        });

        cancelButton.addEventListener("click", function () {
          queue.slice().forEach(dropFromQueue);
          showQueueMessage("");
        });

        card.appendChild(pickButtons(true, function (files) {
          validateAll(files, addToQueue);
        }));
        card.appendChild(queueMessage);
        card.appendChild(queueBox);
        card.appendChild(queueActions);
      }

      loadItems();
    };
  }

  /* ==========================================================
     One image stored in a column of the record
     options: table, bucket, column, title, hint,
              altColumn (optional), maxWidth, quality
     ========================================================== */
  function single(options) {
    return function (panel, record, context) {
      var readOnly = !!(context && context.readOnly);
      var currentPath = record[options.column] || "";
      var currentAlt = options.altColumn ? (record[options.altColumn] || "") : "";
      var chosen = null;

      var card = ui.el("div", "card form-card");
      card.appendChild(ui.el("h2", "", options.title));
      card.appendChild(ui.el("p", "field-hint", options.hint ||
        "JPG, PNG or WebP. The picture is resized and compressed before it is uploaded."));
      panel.appendChild(card);

      var currentBox = ui.el("div", "photo-item");
      card.appendChild(currentBox);

      function renderCurrent() {
        currentBox.innerHTML = "";
        if (!currentPath) {
          currentBox.appendChild(ui.el("p", "field-hint", "No image yet."));
          return;
        }
        var image = ui.el("img", "photo-thumb");
        image.src = Uploads.publicUrl(options.bucket, currentPath);
        image.alt = currentAlt;
        image.width = 400;
        image.height = 300;
        currentBox.appendChild(image);
        if (currentAlt) { currentBox.appendChild(ui.el("p", "item-meta", "Alternative text: " + currentAlt)); }

        if (!readOnly) {
          var buttons = ui.el("div", "photo-buttons");
          buttons.appendChild(small("Remove", "btn-danger-outline", removeCurrent));
          currentBox.appendChild(buttons);
        }
      }

      function removeCurrent() {
        ui.confirm({
          title: "Remove this image?",
          message: "The image will be removed from the website and deleted.",
          confirmLabel: "Remove",
          danger: true
        }).then(function (agreed) {
          if (!agreed) { return; }
          var payload = {};
          payload[options.column] = null;
          if (options.altColumn) { payload[options.altColumn] = ""; }
          return sb.from(options.table).update(payload).eq("id", record.id).select("id").then(function (r) {
            if (r.error || !r.data || !r.data.length) {
              ui.toast("The image could not be removed.", "error");
              return;
            }
            var oldPath = currentPath;
            currentPath = "";
            currentAlt = "";
            renderCurrent();
            Admin.logAudit(options.table + "_image_removed", options.table, record.id, { column: options.column });
            return Uploads.removeFiles(options.bucket, [oldPath]).then(function () {
              ui.toast("Image removed.", "success");
            });
          });
        });
      }

      renderCurrent();
      if (readOnly) { return; }

      /* The selected picture, waiting to be uploaded */
      var pending = ui.el("div", "queue-item");
      pending.hidden = true;
      var pendingPreview = ui.el("img", "photo-thumb");
      pending.appendChild(pendingPreview);
      var pendingDetails = ui.el("div", "stack");
      var pendingName = ui.el("p", "item-meta", "");
      pendingDetails.appendChild(pendingName);

      var altInput = null;
      if (options.altColumn) {
        altInput = textInput("", 300);
        pendingDetails.appendChild(field("Alternative text (describes the picture)", altInput));
      }
      var progress = document.createElement("progress");
      progress.className = "upload-progress";
      progress.max = 100;
      progress.hidden = true;
      pendingDetails.appendChild(progress);
      var status = ui.el("p", "queue-status", "");
      pendingDetails.appendChild(status);

      var actions = ui.el("div", "form-actions");
      var useButton = ui.el("button", "btn btn-primary", currentPath ? "Upload and replace" : "Upload");
      useButton.type = "button";
      var cancelButton = ui.el("button", "btn btn-secondary", "Cancel");
      cancelButton.type = "button";
      actions.appendChild(useButton);
      actions.appendChild(cancelButton);
      pendingDetails.appendChild(actions);
      pending.appendChild(pendingDetails);

      function clearChosen() {
        if (chosen) { URL.revokeObjectURL(chosen.previewUrl); }
        chosen = null;
        pending.hidden = true;
        progress.hidden = true;
        status.textContent = "";
      }

      cancelButton.addEventListener("click", clearChosen);

      useButton.addEventListener("click", function () {
        if (!chosen) { return; }
        var alt = altInput ? altInput.value.trim() : "";
        if (options.altColumn && !alt) {
          status.textContent = "Please describe the picture in the alternative text.";
          status.className = "queue-status is-error";
          altInput.focus();
          return;
        }

        useButton.disabled = true;
        cancelButton.disabled = true;
        progress.hidden = false;
        progress.value = 0;
        status.className = "queue-status";
        var oldPath = currentPath;

        resizeAndUpload(chosen.file, options.bucket, String(record.id),
          { maxWidth: options.maxWidth || 1600, quality: options.quality || 0.8 },
          function (text) { status.textContent = text; },
          function (percent) { progress.value = percent; status.textContent = "Uploading " + percent + "%"; }
        ).then(function (uploaded) {
          var payload = {};
          payload[options.column] = uploaded.path;
          if (options.altColumn) { payload[options.altColumn] = alt; }

          return sb.from(options.table).update(payload).eq("id", record.id).select("id").then(function (r) {
            if (r.error || !r.data || !r.data.length) {
              return Uploads.removeFiles(options.bucket, [uploaded.path]).then(function () {
                throw new Error("The image could not be saved.");
              });
            }
            currentPath = uploaded.path;
            currentAlt = alt;
            clearChosen();
            renderCurrent();
            useButton.textContent = "Upload and replace";
            ui.toast("Image saved.", "success");
            Admin.logAudit(options.table + "_image_changed", options.table, record.id, { column: options.column });
            return Uploads.removeFiles(options.bucket, [oldPath]);   // delete the old file only now
          });
        }).catch(function (error) {
          status.textContent = "Failed: " + failureText(error);
          status.className = "queue-status is-error";
        }).then(function () {
          useButton.disabled = false;
          cancelButton.disabled = false;
        });
      });

      card.appendChild(pickButtons(false, function (files) {
        validateAll(files.slice(0, 1), function (file) {
          clearChosen();
          chosen = { file: file, previewUrl: URL.createObjectURL(file) };
          pendingPreview.src = chosen.previewUrl;
          pendingPreview.alt = "Preview of " + file.name;
          pendingName.textContent = file.name + " (" + Uploads.humanSize(file.size) + ")";
          if (altInput) { altInput.value = ""; }
          pending.hidden = false;
        });
      }));
      card.appendChild(pending);
    };
  }

  window.ChouImages = { gallery: gallery, single: single };
})();