/* ==========================================================
   Chou Farm Limited - dashboard: Account and security settings
   Plugs into js/admin.js
   ========================================================== */
(function () {
  "use strict";

  var Admin = window.ChouAdmin;
  var Auth = window.ChouAuth;
  if (!Admin || !Auth) { return; }

  var ui = Admin.ui;
  var sb = Admin.sb;

  function infoRow(parent, label, value) {
    var row = ui.el("div", "info-row");
    row.appendChild(ui.el("p", "info-label", label));
    row.appendChild(ui.el("p", "info-value", value));
    parent.appendChild(row);
  }

  Admin.register("account", function (view) {
    var profile = Admin.profile;

    ui.heading(view, "Account and security settings", "Your sign-in details and password.");

    /* ----- Who you are ----- */
    var details = ui.el("div", "card");
    details.appendChild(ui.el("h2", "", "Your account"));
    infoRow(details, "Name", profile.full_name || "Not set");
    infoRow(details, "Email", profile.email || "");
    infoRow(details, "Role", Admin.ROLE_LABELS[profile.role] || profile.role);
    infoRow(details, "Account status", profile.is_active ? "Active" : "Not active");
    view.appendChild(details);

    /* ----- Change password ----- */
    var card = ui.el("div", "card");
    card.style.marginTop = "16px";
    card.appendChild(ui.el("h2", "", "Change your password"));

    var form = document.createElement("form");
    form.className = "stack";
    form.noValidate = true;
    form.innerHTML =
      '<p id="pw-message" class="form-message" role="alert" hidden></p>' +

      '<div class="field">' +
        '<label for="pw-current">Current password</label>' +
        '<input class="input" id="pw-current" name="current" type="password" autocomplete="current-password" required maxlength="200">' +
      "</div>" +

      '<div class="field">' +
        '<label for="pw-new">New password</label>' +
        '<input class="input" id="pw-new" name="password" type="password" autocomplete="new-password" required maxlength="200">' +
        '<p class="field-hint">At least ' + Auth.MIN_PASSWORD + " characters. A short phrase you can remember works well.</p>" +
      "</div>" +

      '<div class="field">' +
        '<label for="pw-confirm">Confirm new password</label>' +
        '<input class="input" id="pw-confirm" name="confirm" type="password" autocomplete="new-password" required maxlength="200">' +
      "</div>" +

      '<label class="check-row"><input type="checkbox" id="pw-show"> Show passwords</label>' +

      '<button class="btn btn-primary" id="pw-submit" type="submit">Change password</button>';

    card.appendChild(form);
    view.appendChild(card);

    var message = form.querySelector("#pw-message");
    var button = form.querySelector("#pw-submit");
    var fields = [form.elements.current, form.elements.password, form.elements.confirm];

    function showMessage(text, type) {
      if (!text) { message.hidden = true; message.textContent = ""; return; }
      message.textContent = text;
      message.className = "form-message is-" + type;
      message.hidden = false;
    }

    function setBusy(busy) {
      button.disabled = busy;
      button.setAttribute("aria-busy", busy ? "true" : "false");
      button.textContent = busy ? "Saving..." : "Change password";
    }

    form.querySelector("#pw-show").addEventListener("change", function (event) {
      fields.forEach(function (field) {
        field.type = event.target.checked ? "text" : "password";
      });
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      var current = form.elements.current.value;
      var next = form.elements.password.value;
      var again = form.elements.confirm.value;

      if (!current) { showMessage("Enter your current password.", "error"); return; }
      if (next.length < Auth.MIN_PASSWORD) {
        showMessage("The new password must be at least " + Auth.MIN_PASSWORD + " characters long.", "error");
        return;
      }
      if (next !== again) { showMessage("The two new passwords do not match.", "error"); return; }
      if (next === current) { showMessage("The new password must be different from the current one.", "error"); return; }

      showMessage("");
      setBusy(true);

      /* Step 1: check the current password */
      sb.auth.signInWithPassword({ email: profile.email, password: current }).then(function (check) {
        if (check.error) {
          setBusy(false);
          if (check.error.status === 429) {
            showMessage("Too many attempts. Please wait a few minutes and try again.", "error");
          } else {
            showMessage("Your current password is not correct.", "error");
          }
          return null;
        }

        /* Step 2: save the new password */
        return Auth.updatePassword(next).then(function (result) {
          setBusy(false);
          if (result.error) {
            showMessage("The new password could not be saved. Try a longer or less common password.", "error");
            return;
          }
          form.reset();
          fields.forEach(function (field) { field.type = "password"; });
          form.querySelector("#pw-show").checked = false;
          ui.toast("Your password has been changed.", "success");
          Admin.logAudit("password_changed", "profiles", profile.id, null);
        });
      }).catch(function () {
        setBusy(false);
        showMessage("Could not reach the server. Check your internet connection and try again.", "error");
      });
    });

    /* ----- Storage clean-up (administrators only) ----- */
    if (window.ChouCleanup && Admin.RANK[profile.role] >= Admin.RANK.admin) {
      var cleanupHolder = ui.el("div");
      cleanupHolder.style.marginTop = "16px";
      view.appendChild(cleanupHolder);
      window.ChouCleanup.panel(cleanupHolder);
    }
  });
})();