/* ==========================================================
   Chou Farm Limited - upload toolkit
   Checks, resizes and uploads images. Used by the dashboard.
   Needs, loaded before it: Supabase library, config.js, supabase.js
   ========================================================== */
(function () {
  "use strict";

  var MAX_PICK_BYTES = 25 * 1024 * 1024;     // biggest photo we will accept to resize
  var MAX_OUTPUT_BYTES = 5 * 1024 * 1024;    // the storage limit after resizing
  var EXTENSIONS = ["jpg", "jpeg", "png", "webp"];

  var Uploads = { MAX_OUTPUT_BYTES: MAX_OUTPUT_BYTES };

  function extensionOf(name) {
    var dot = String(name).lastIndexOf(".");
    return dot < 0 ? "" : String(name).slice(dot + 1).toLowerCase();
  }

  /* A random, safe file name part */
  Uploads.uuid = function () {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    var bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    var hex = Array.prototype.map.call(bytes, function (b) {
      return ("0" + b.toString(16)).slice(-2);
    }).join("");
    return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" +
           hex.slice(16, 20) + "-" + hex.slice(20);
  };

  Uploads.humanSize = function (bytes) {
    if (bytes < 1024) { return bytes + " B"; }
    if (bytes < 1024 * 1024) { return Math.round(bytes / 1024) + " KB"; }
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  /* Only paths made of safe characters are ever turned into links */
  Uploads.publicUrl = function (bucket, path) {
    if (!path || !/^[A-Za-z0-9\/_.\-]+$/.test(path) || path.indexOf("..") !== -1) { return ""; }
    return window.sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  };

  /* Look at the first bytes of the file to find out what it really is */
  Uploads.sniffImageType = function (file) {
    return new Promise(function (resolve) {
      var reader = new FileReader();
      reader.onload = function () {
        var b = new Uint8Array(reader.result);
        if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) { resolve("image/jpeg"); return; }
        if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) { resolve("image/png"); return; }
        if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
            b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) { resolve("image/webp"); return; }
        resolve(null);
      };
      reader.onerror = function () { resolve(null); };
      reader.readAsArrayBuffer(file.slice(0, 12));
    });
  };

  /* Resolves to { ok: true } or { ok: false, message } */
  Uploads.validateImage = function (file) {
    if (!file || file.size === 0) { return Promise.resolve({ ok: false, message: "is empty." }); }
    if (file.size > MAX_PICK_BYTES) { return Promise.resolve({ ok: false, message: "is too large (over 25 MB)." }); }
    if (EXTENSIONS.indexOf(extensionOf(file.name)) === -1) {
      return Promise.resolve({ ok: false, message: "must be a JPG, PNG or WebP picture." });
    }
    return Uploads.sniffImageType(file).then(function (type) {
      return type ? { ok: true } : { ok: false, message: "is not a real JPG, PNG or WebP picture." };
    });
  };

  /* ----- Resizing and compressing ----- */
  function loadViaImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var image = new Image();
      image.onload = function () { URL.revokeObjectURL(url); resolve(image); };
      image.onerror = function () { URL.revokeObjectURL(url); reject(new Error("The picture could not be read.")); };
      image.src = url;
    });
  }

  function loadBitmap(file) {
    if (window.createImageBitmap) {
      return window.createImageBitmap(file, { imageOrientation: "from-image" })
        .catch(function () { return loadViaImage(file); });
    }
    return loadViaImage(file);
  }

  function encode(canvas, type, quality) {
    return new Promise(function (resolve) {
      if (!canvas.toBlob) { resolve(null); return; }
      canvas.toBlob(function (blob) { resolve(blob); }, type, quality);
    });
  }

  /* Resolves to { blob, ext, mime, width, height } */
  Uploads.compressImage = function (file, options) {
    options = options || {};
    var maxWidth = options.maxWidth || 1600;
    var quality = options.quality || 0.8;

    return loadBitmap(file).then(function (bitmap) {
      var sourceWidth = bitmap.naturalWidth || bitmap.width;
      var sourceHeight = bitmap.naturalHeight || bitmap.height;
      var scale = sourceWidth > maxWidth ? maxWidth / sourceWidth : 1;
      var width = Math.max(1, Math.round(sourceWidth * scale));
      var height = Math.max(1, Math.round(sourceHeight * scale));

      var canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      var context = canvas.getContext("2d");
      context.drawImage(bitmap, 0, 0, width, height);
      if (typeof bitmap.close === "function") { bitmap.close(); }

      return encode(canvas, "image/webp", quality).then(function (blob) {
        if (blob && blob.type === "image/webp") {
          return { blob: blob, ext: "webp", mime: "image/webp", width: width, height: height };
        }
        /* Older browsers cannot make WebP: use JPEG on a white background */
        context.globalCompositeOperation = "destination-over";
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, width, height);
        return encode(canvas, "image/jpeg", quality).then(function (jpeg) {
          if (!jpeg) { throw new Error("The picture could not be resized."); }
          return { blob: jpeg, ext: "jpg", mime: "image/jpeg", width: width, height: height };
        });
      });
    });
  };

  /* ----- Uploading with a progress percentage ----- */
  Uploads.upload = function (bucket, path, blob, onProgress) {
    var config = window.CHOU_CONFIG;

    return window.sb.auth.getSession().then(function (result) {
      var session = result.data && result.data.session;
      if (!session) { throw new Error("You are not signed in."); }

      return new Promise(function (resolve, reject) {
        var xhr = new XMLHttpRequest();
        var url = config.SUPABASE_URL + "/storage/v1/object/" + encodeURIComponent(bucket) + "/" +
                  path.split("/").map(encodeURIComponent).join("/");

        xhr.open("POST", url);
        xhr.setRequestHeader("Authorization", "Bearer " + session.access_token);
        xhr.setRequestHeader("apikey", config.SUPABASE_ANON_KEY);
        xhr.setRequestHeader("x-upsert", "false");

        xhr.upload.onprogress = function (event) {
          if (event.lengthComputable && onProgress) {
            onProgress(Math.round((event.loaded / event.total) * 100));
          }
        };
        xhr.onload = function () {
          if (xhr.status >= 200 && xhr.status < 300) { resolve(); }
          else { reject(new Error("The upload was refused (code " + xhr.status + ").")); }
        };
        xhr.onerror = function () { reject(new Error("The connection was lost during the upload.")); };

        var form = new FormData();
        form.append("cacheControl", "31536000");
        form.append("", blob, path.split("/").pop());
        xhr.send(form);
      });
    });
  };

  /* Delete files from storage. Resolves to true or false, never throws. */
  Uploads.removeFiles = function (bucket, paths) {
    var list = (paths || []).filter(function (p) { return !!p; });
    if (!list.length) { return Promise.resolve(true); }
    return window.sb.storage.from(bucket).remove(list).then(
      function (result) { return !result.error; },
      function () { return false; }
    );
  };

  window.ChouUploads = Uploads;
})();