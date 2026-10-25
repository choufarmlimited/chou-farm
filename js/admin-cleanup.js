/* ==========================================================
   Chou Farm Limited - dashboard: storage clean-up
   Finds files in storage that no record points to, and
   deletes them after you confirm. Administrators only.
   Loaded after js/admin.js
   ========================================================== */
(function () {
  "use strict";

  var Admin = window.ChouAdmin;
  if (!Admin) { window.ChouCleanup = null; return; }

  var ui = Admin.ui;
  var sb = Admin.sb;
  var RECENT_MS = 60 * 60 * 1000;      // files newer than one hour are skipped
  var SHOW_LIMIT = 100;

  /* Every place a file in each bucket can be used:
     [table, column, optional filter column, optional filter value] */
  var SOURCES = {
    "crops":            [["crop_images", "storage_path"]],
    "livestock":        [["livestock_images", "storage_path"]],
    "products":         [["product_images", "storage_path"]],
    "gallery":          [["gallery_images", "storage_path"]],
    "guides":           [["farming_guides", "cover_path"]],
    "news":             [["news_items", "image_path"]],
    "about":            [["team_members", "photo_path"], ["site_settings", "hero_image_path"]],
    "logo":             [["site_settings", "logo_path"]],
    "learning-public":  [["learning_materials", "storage_path", "storage_bucket", "learning-public"],
                         ["learning_materials", "cover_path"]],
    "learning-private": [["learning_materials", "storage_path", "storage_bucket", "learning-private"]]
  };
  var BUCKETS = Object.keys(SOURCES);

  function humanSize(bytes) {
    if (window.ChouUploads) { return window.ChouUploads.humanSize(bytes); }
    return Math.round(bytes / 1024) + " KB";
  }

  /* All the paths one table column points to */
  function fetchPaths(source) {
    var paths = [];

    function page(from) {
      var query = sb.from(source[0]).select(source[1]).not(source[1], "is", null).range(from, from + 999);
      if (source[2]) { query = query.eq(source[2], source[3]); }
      return query.then(function (result) {
        if (result.error) { throw result.error; }
        var rows = result.data || [];
        rows.forEach(function (row) { paths.push(row[source[1]]); });
        return rows.length === 1000 ? page(from + 1000) : paths;
      });
    }
    return page(0);
  }

  function referencedPaths(bucket) {
    return Promise.all(SOURCES[bucket].map(fetchPaths)).then(function (lists) {
      var map = {};
      lists.forEach(function (list) { list.forEach(function (path) { map[path] = true; }); });
      return map;
    });
  }

  /* Everything inside one folder of a bucket */
  function listFolder(bucket, prefix) {
    var all = [];

    function page(offset) {
      return sb.storage.from(bucket).list(prefix, {
        limit: 100,
        offset: offset,
        sortBy: { column: "name", order: "asc" }
      }).then(function (result) {
        if (result.error) { throw result.error; }
        var items = result.data || [];
        all = all.concat(items);
        return items.length === 100 ? page(offset + 100) : all;
      });
    }
    return page(0);
  }

  function toFile(prefix, entry) {
    return {
      path: prefix ? prefix + "/" + entry.name : entry.name,
      size: entry.metadata && entry.metadata.size ? entry.metadata.size : 0,
      created: entry.created_at || entry.updated_at || null
    };
  }

  /* Our files sit one folder deep: <record id>/<file> */
  function listBucketFiles(bucket) {
    return listFolder(bucket, "").then(function (entries) {
      var files = [];
      var folders = [];

      entries.forEach(function (entry) {
        if (entry.name.charAt(0) === ".") { return; }
        if (entry.id === null || entry.id === undefined) { folders.push(entry.name); }
        else { files.push(toFile("", entry)); }
      });

      return folders.reduce(function (chain, folder) {
        return chain.then(function () {
          return listFolder(bucket, folder).then(function (items) {
            items.forEach(function (item) {
              if (item.id && item.name.charAt(0) !== ".") { files.push(toFile(folder, item)); }
            });
          });
        });
      }, Promise.resolve()).then(function () { return files; });
    });
  }

  function scanBucket(bucket, includeRecent) {
    return Promise.all([referencedPaths(bucket), listBucketFiles(bucket)]).then(function (results) {
      var referenced = results[0];
      var files = results[1];
      var orphans = [];
      var skipped = 0;

      files.forEach(function (file) {
        if (referenced[file.path]) { return; }
        var age = file.created ? Date.now() - new Date(file.created).getTime() : RECENT_MS;
        if (!includeRecent && age < RECENT_MS) { skipped += 1; return; }
        orphans.push({ bucket: bucket, path: file.path, size: file.size });
      });
      return { total: files.length, orphans: orphans, skipped: skipped };
    });
  }

  function removeInChunks(bucket, paths) {
    var removed = 0;
    var chunks = [];
    for (var i = 0; i < paths.length; i += 50) { chunks.push(paths.slice(i, i + 50)); }

    return chunks.reduce(function (chain, chunk) {
      return chain.then(function () {
        return sb.storage.from(bucket).remove(chunk).then(function (result) {
          if (!result.error && result.data) { removed += result.data.length; }
        });
      });
    }, Promise.resolve()).then(function () { return removed; });
  }

  /* ==========================================================
     The card on the Account page
     ========================================================== */
  function panel(parent) {
    var card = ui.el("div", "card");
    card.appendChild(ui.el("h2", "", "Storage clean-up"));
    card.appendChild(ui.el("p", "field-hint",
      "Finds photos and files in storage that no record uses any more, for example after a whole record was deleted. " +
      "Nothing is deleted until you review the list and confirm."));

    var recentRow = ui.el("label", "check-row");
    var recentBox = document.createElement("input");
    recentBox.type = "checkbox";
    recentRow.appendChild(recentBox);
    recentRow.appendChild(document.createTextNode("Also include files uploaded in the last hour (only if nobody is uploading right now)"));
    card.appendChild(recentRow);

    var scanButton = ui.el("button", "btn btn-secondary", "Scan for unused files");
    scanButton.type = "button";
    card.appendChild(scanButton);

    var status = ui.el("p", "queue-status", "");
    status.setAttribute("aria-live", "polite");
    card.appendChild(status);
    var results = ui.el("div", "");
    card.appendChild(results);
    parent.appendChild(card);

    function scan() {
      results.innerHTML = "";
      scanButton.disabled = true;
      status.className = "queue-status";

      var orphans = [];
      var skipped = 0;
      var total = 0;

      BUCKETS.reduce(function (chain, bucket) {
        return chain.then(function () {
          status.textContent = "Scanning " + bucket + "...";
          return scanBucket(bucket, recentBox.checked).then(function (found) {
            total += found.total;
            skipped += found.skipped;
            orphans = orphans.concat(found.orphans);
          });
        });
      }, Promise.resolve()).then(function () {
        status.textContent = "";
        showResults(orphans, skipped, total);
      }).catch(function (error) {
        if (window.console) { window.console.error(error); }
        status.textContent = "The scan could not be completed. Please try again.";
        status.className = "queue-status is-error";
      }).then(function () { scanButton.disabled = false; });
    }

    function showResults(orphans, skipped, total) {
      results.innerHTML = "";

      var summary = total + (total === 1 ? " file" : " files") + " checked.";
      if (skipped) {
        summary += " " + skipped + (skipped === 1 ? " unused file was" : " unused files were") +
          " skipped because " + (skipped === 1 ? "it was" : "they were") + " uploaded in the last hour.";
      }
      results.appendChild(ui.el("p", "item-meta", summary));

      if (orphans.length === 0) {
        results.appendChild(ui.el("p", "form-message is-success", "No unused files found. Storage is tidy."));
        return;
      }

      var totalSize = orphans.reduce(function (sum, file) { return sum + file.size; }, 0);
      results.appendChild(ui.el("p", "form-message is-info",
        orphans.length + (orphans.length === 1 ? " unused file" : " unused files") +
        " found (" + humanSize(totalSize) + "). Review the list, then delete."));

      var list = ui.el("ul", "prose");
      orphans.slice(0, SHOW_LIMIT).forEach(function (file) {
        list.appendChild(ui.el("li", "", file.bucket + "/" + file.path + " (" + humanSize(file.size) + ")"));
      });
      if (orphans.length > SHOW_LIMIT) {
        list.appendChild(ui.el("li", "", "...and " + (orphans.length - SHOW_LIMIT) + " more."));
      }
      results.appendChild(list);

      var deleteButton = ui.el("button", "btn btn-danger-outline", "Delete " + orphans.length +
        (orphans.length === 1 ? " unused file" : " unused files"));
      deleteButton.type = "button";
      results.appendChild(deleteButton);

      deleteButton.addEventListener("click", function () {
        ui.confirm({
          title: "Delete unused files?",
          message: orphans.length + " unused " + (orphans.length === 1 ? "file" : "files") +
            " (" + humanSize(totalSize) + ") will be deleted permanently. Files that records still use are not affected.",
          confirmLabel: "Delete",
          danger: true
        }).then(function (agreed) {
          if (!agreed) { return; }
          deleteButton.disabled = true;
          scanButton.disabled = true;

          var byBucket = {};
          orphans.forEach(function (file) {
            if (!byBucket[file.bucket]) { byBucket[file.bucket] = []; }
            byBucket[file.bucket].push(file.path);
          });

          var removed = 0;
          return Object.keys(byBucket).reduce(function (chain, bucket) {
            return chain.then(function () {
              return removeInChunks(bucket, byBucket[bucket]).then(function (count) { removed += count; });
            });
          }, Promise.resolve()).then(function () {
            results.innerHTML = "";
            var done = removed + (removed === 1 ? " file" : " files") + " deleted.";
            var allDone = removed === orphans.length;
            results.appendChild(ui.el("p", allDone ? "form-message is-success" : "form-message is-error",
              allDone ? done : done + " Some files could not be deleted. Scan again to see what is left."));
            ui.toast(done, allDone ? "success" : "info");
            Admin.logAudit("storage_cleanup", "storage", null, { found: orphans.length, deleted: removed });
          }).catch(function () {
            ui.toast("The clean-up could not be completed. Please try again.", "error");
          }).then(function () { scanButton.disabled = false; });
        });
      });
    }

    scanButton.addEventListener("click", scan);
  }

  window.ChouCleanup = { panel: panel };
})();