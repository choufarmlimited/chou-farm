/* ==========================================================
   Chou Farm Limited - dashboard: Users and roles
   Plugs into js/admin.js (super administrator only)
   ========================================================== */
(function () {
  "use strict";

  var Admin = window.ChouAdmin;
  if (!Admin) { return; }

  var ui = Admin.ui;
  var sb = Admin.sb;
  var ROLE_ORDER = ["viewer", "editor", "admin", "super_admin"];

  function personLabel(person) {
    return person.full_name || person.email || "This user";
  }

  function friendlyError(error) {
    var text = ((error && error.message) || "").toLowerCase();
    if (text.indexOf("last active super administrator") !== -1) {
      return "At least one active super administrator must always remain.";
    }
    if (text.indexOf("your own role") !== -1) {
      return "You cannot change your own role or status.";
    }
    return "The changes could not be saved. Please try again.";
  }

  function makeField(labelText, control, id) {
    var wrap = ui.el("div", "field");
    var label = ui.el("label", "", labelText);
    control.id = id;
    label.setAttribute("for", id);
    wrap.appendChild(label);
    wrap.appendChild(control);
    return wrap;
  }

  function makeSelect(options, value) {
    var select = ui.el("select", "input");
    options.forEach(function (option) {
      var node = ui.el("option", "", option[1]);
      node.value = option[0];
      select.appendChild(node);
    });
    select.value = value;
    return select;
  }

  function buildCard(person, onSaved) {
    var isSelf = person.id === Admin.profile.id;
    var card = ui.el("article", "card");

    /* Top: name and status badge */
    var head = ui.el("div", "user-card-head");
    var title = ui.el("h2", "", personLabel(person));
    var badge = ui.el("span", "badge");
    head.appendChild(title);
    head.appendChild(badge);
    card.appendChild(head);
    card.appendChild(ui.el("p", "user-email", person.email || ""));

    function refreshBadge() {
      badge.textContent = person.is_active ? "Active" : "Not active";
      badge.className = "badge " + (person.is_active ? "badge-in" : "badge-limited");
    }
    refreshBadge();

    /* Fields */
    var form = ui.el("div", "stack");

    var nameInput = ui.el("input", "input");
    nameInput.type = "text";
    nameInput.maxLength = 100;
    nameInput.value = person.full_name || "";
    form.appendChild(makeField("Display name", nameInput, "u-name-" + person.id));

    var roleOptions = ROLE_ORDER.map(function (role) { return [role, Admin.ROLE_LABELS[role]]; });
    var roleSelect = makeSelect(roleOptions, person.role);
    form.appendChild(makeField("Role", roleSelect, "u-role-" + person.id));

    var statusSelect = makeSelect(
      [["active", "Active"], ["inactive", "Not active"]],
      person.is_active ? "active" : "inactive"
    );
    form.appendChild(makeField("Account status", statusSelect, "u-status-" + person.id));

    if (isSelf) {
      roleSelect.disabled = true;
      statusSelect.disabled = true;
      form.appendChild(ui.el("p", "field-hint",
        "This is your own account. You cannot change your own role or status."));
    }

    var saveButton = ui.el("button", "btn btn-primary", "Save changes");
    saveButton.type = "button";
    saveButton.disabled = true;
    form.appendChild(saveButton);
    card.appendChild(form);

    /* Enable Save only when something changed */
    function current() {
      return {
        full_name: nameInput.value.trim(),
        role: roleSelect.value,
        is_active: statusSelect.value === "active"
      };
    }
    function hasChanges() {
      var now = current();
      return now.full_name !== (person.full_name || "") ||
             now.role !== person.role ||
             now.is_active !== person.is_active;
    }
    function updateSaveState() { saveButton.disabled = !hasChanges(); }
    nameInput.addEventListener("input", updateSaveState);
    roleSelect.addEventListener("change", updateSaveState);
    statusSelect.addEventListener("change", updateSaveState);

    /* Save */
    saveButton.addEventListener("click", function () {
      var now = current();
      var roleChanged = now.role !== person.role;
      var statusChanged = now.is_active !== person.is_active;

      var lines = [];
      if (roleChanged) {
        lines.push("Role: " + Admin.ROLE_LABELS[person.role] + " to " + Admin.ROLE_LABELS[now.role] + ".");
      }
      if (statusChanged) {
        lines.push("Status: " + (person.is_active ? "Active" : "Not active") + " to " +
                   (now.is_active ? "Active" : "Not active") + ".");
      }

      var needsConfirm = roleChanged || statusChanged;
      var lowersAccess = (statusChanged && !now.is_active) ||
                         (roleChanged && ROLE_ORDER.indexOf(now.role) < ROLE_ORDER.indexOf(person.role));

      var ask = needsConfirm
        ? ui.confirm({
            title: "Change access for " + personLabel(person) + "?",
            message: lines.join(" "),
            confirmLabel: "Save changes",
            danger: lowersAccess
          })
        : Promise.resolve(true);

      ask.then(function (agreed) {
        if (!agreed) { return; }

        saveButton.disabled = true;
        saveButton.textContent = "Saving...";

        return sb.from("profiles")
          .update({ full_name: now.full_name, role: now.role, is_active: now.is_active })
          .eq("id", person.id)
          .select("id")
          .then(function (result) {
            saveButton.textContent = "Save changes";

            if (result.error) {
              ui.toast(friendlyError(result.error), "error");
              updateSaveState();
              return;
            }
            if (!result.data || result.data.length === 0) {
              ui.toast("The changes could not be saved. Please try again.", "error");
              updateSaveState();
              return;
            }

            var before = { role: person.role, is_active: person.is_active };
            person.full_name = now.full_name;
            person.role = now.role;
            person.is_active = now.is_active;

            title.textContent = personLabel(person);
            refreshBadge();
            updateSaveState();
            ui.toast("Changes saved for " + personLabel(person) + ".", "success");

            if (roleChanged || statusChanged) {
              Admin.logAudit("user_access_changed", "profiles", person.id, {
                email: person.email,
                from: before,
                to: { role: person.role, is_active: person.is_active }
              });
            }
            if (onSaved) { onSaved(); }
          });
      }).catch(function () {
        saveButton.textContent = "Save changes";
        updateSaveState();
        ui.toast("Could not reach the server. Check your internet connection.", "error");
      });
    });

    return card;
  }

  Admin.register("users", function (view) {
    ui.heading(view, "Users and roles", "Decide who can sign in and what each person can do.");

    /* What each role can do */
    var legend = ui.el("div", "card");
    legend.appendChild(ui.el("h2", "", "What each role can do"));
    var list = ui.el("ul", "prose");
    [
      ["Viewer", "Sees everything in the dashboard, including drafts, but cannot change anything."],
      ["Editor", "Creates and edits content and photos. Cannot delete records."],
      ["Administrator", "Everything an editor can do, plus deleting and site settings."],
      ["Super administrator", "Everything an administrator can do, plus this Users and roles manager."]
    ].forEach(function (item) {
      var li = ui.el("li");
      var strong = ui.el("strong", "", item[0] + ": ");
      li.appendChild(strong);
      li.appendChild(document.createTextNode(item[1]));
      list.appendChild(li);
    });
    legend.appendChild(list);
    view.appendChild(legend);

    /* How to add someone new */
    var howTo = ui.el("div", "card");
    howTo.style.marginTop = "16px";
    howTo.appendChild(ui.el("h2", "", "Adding a new staff member"));
    var steps = ui.el("ol", "prose");
    [
      "In Supabase, open Authentication, then Users, then Add user, then Create new user.",
      "Enter their email address and a temporary password, and tick Auto Confirm User.",
      "They appear below as Not active with the role Viewer. Choose their role, set them to Active and save.",
      "Give them the temporary password and ask them to change it on the Account page."
    ].forEach(function (text) { steps.appendChild(ui.el("li", "", text)); });
    howTo.appendChild(steps);
    view.appendChild(howTo);

    /* The people */
    var summary = ui.el("p", "admin-subtitle", "Loading users...");
    summary.style.marginTop = "24px";
    view.appendChild(summary);

    var grid = ui.el("div", "grid grid-2");
    view.appendChild(grid);

    return sb.from("profiles")
      .select("id, email, full_name, role, is_active, created_at")
      .order("created_at", { ascending: true })
      .then(function (result) {
        if (result.error) {
          summary.textContent = "The list of users could not be loaded.";
          return;
        }

        var people = result.data || [];

        function updateSummary() {
          var active = people.filter(function (p) { return p.is_active; }).length;
          var waiting = people.length - active;
          summary.textContent = people.length + (people.length === 1 ? " user" : " users") +
            ": " + active + " active, " + waiting + " not active.";
        }

        updateSummary();
        people.forEach(function (person) {
          grid.appendChild(buildCard(person, updateSummary));
        });
      });
  });
})();