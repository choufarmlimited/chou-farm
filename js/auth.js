/* ==========================================================
   Chou Farm Limited - administrator authentication
   Helpers used by every admin page, plus the sign-in page logic.
   Needs, loaded before it: Supabase library, config.js, supabase.js
   ========================================================== */
(function () {
  "use strict";

  var sb = window.sb;
  var LOGIN_URL = "admin-login.html";
  var DASHBOARD_URL = "admin.html";
  var MIN_PASSWORD = 12;
  var intentionalSignOut = false;   // true when WE sign the person out

  var Auth = {
    available: !!sb,
    LOGIN_URL: LOGIN_URL,
    DASHBOARD_URL: DASHBOARD_URL,
    MIN_PASSWORD: MIN_PASSWORD
  };
  window.ChouAuth = Auth;

  /* ---------- Friendly messages (never show raw technical errors) ---------- */
  function friendlyError(error) {
    var text = ((error && error.message) || "").toLowerCase();
    if ((error && error.status === 429) || text.indexOf("rate limit") !== -1) {
      return "Too many attempts. Please wait a few minutes and try again.";
    }
    if (text.indexOf("invalid login") !== -1 || text.indexOf("invalid credentials") !== -1) {
      return "Incorrect email or password.";
    }
    if (text.indexOf("not confirmed") !== -1) {
      return "This email address has not been confirmed.";
    }
    return "Sign-in failed. Please try again.";
  }

  /* ---------- Who is signed in, and what is their role? ---------- */
  Auth.getProfile = function () {
    return sb.auth.getUser().then(function (res) {
      if (res.error || !res.data || !res.data.user) {
        return { profile: null, error: res.error || new Error("Not signed in") };
      }
      return sb.from("profiles")
        .select("id, email, full_name, role, is_active")
        .eq("id", res.data.user.id)
        .maybeSingle()
        .then(function (r) { return { profile: r.data || null, error: r.error }; });
    });
  };

  /* ---------- Sign in ---------- */
  Auth.signIn = function (email, password) {
    return sb.auth.signInWithPassword({ email: email, password: password })
      .then(function (res) {
        if (res.error) { return { ok: false, message: friendlyError(res.error) }; }

        return Auth.getProfile().then(function (p) {
          if (!p.profile || !p.profile.is_active) {
            intentionalSignOut = true;
            return sb.auth.signOut().then(function () {
              return { ok: false, message: "Your account is not active. Please contact the super administrator." };
            });
          }
          return { ok: true, profile: p.profile };
        });
      })
      .catch(function () {
        return { ok: false, message: "Could not reach the server. Check your internet connection and try again." };
      });
  };

  /* ---------- Sign out ---------- */
  Auth.signOut = function () {
    intentionalSignOut = true;
    return sb.auth.signOut().then(function () {
      window.location.href = LOGIN_URL + "?reason=signedout";
    });
  };

  /* ---------- Guard for dashboard pages (used from step 4b) ---------- */
  Auth.requireStaff = function () {
    return Auth.getProfile().then(function (result) {
      if (result.profile && result.profile.is_active) { return result.profile; }
      intentionalSignOut = true;
      var reason = result.profile ? "inactive" : "signin";
      return sb.auth.signOut().then(function () {
        window.location.replace(LOGIN_URL + "?reason=" + reason);
        return null;
      });
    });
  };

  /* ---------- Session expiry: send people back to sign in ---------- */
  Auth.watchSession = function () {
    sb.auth.onAuthStateChange(function (event) {
      if (event === "SIGNED_OUT" && !intentionalSignOut) {
        window.location.replace(LOGIN_URL + "?reason=expired");
      }
    });
  };

  /* ---------- Password reset and change ---------- */
  Auth.sendPasswordReset = function (email) {
    var redirectTo = new URL(LOGIN_URL, window.location.href).href;
    return sb.auth.resetPasswordForEmail(email, { redirectTo: redirectTo });
  };

  Auth.updatePassword = function (newPassword) {
    return sb.auth.updateUser({ password: newPassword });
  };

  /* ==========================================================
     Sign-in page (runs only on admin-login.html)
     ========================================================== */
  function initLoginPage() {
    var loginForm = document.getElementById("login-form");
    if (!loginForm) { return; }

    var resetForm = document.getElementById("reset-form");
    var newForm = document.getElementById("new-password-form");
    var message = document.getElementById("login-message");
    var heading = document.getElementById("auth-heading");
    var intro = document.getElementById("auth-intro");

    function showMessage(text, type) {
      if (!text) { message.hidden = true; message.textContent = ""; return; }
      message.textContent = text;
      message.className = "form-message is-" + type;
      message.hidden = false;
    }

    function showPanel(name) {
      loginForm.hidden = name !== "login";
      resetForm.hidden = name !== "reset";
      newForm.hidden = name !== "new";
      if (name === "reset") {
        heading.textContent = "Reset your password";
        intro.textContent = "Enter your email address and we will send you a reset link.";
      } else if (name === "new") {
        heading.textContent = "Choose a new password";
        intro.textContent = "Use at least " + MIN_PASSWORD + " characters.";
      } else {
        heading.textContent = "Administrator sign in";
        intro.textContent = "For authorised staff only.";
      }
    }

    function setBusy(button, busy, busyText) {
      if (busy) {
        button.dataset.label = button.textContent;
        button.textContent = busyText;
      } else if (button.dataset.label) {
        button.textContent = button.dataset.label;
      }
      button.disabled = busy;
      button.setAttribute("aria-busy", busy ? "true" : "false");
    }

    if (!Auth.available) {
      showMessage("The connection to the backend is not set up. Check js/config.js.", "error");
      Array.prototype.forEach.call(document.querySelectorAll("form button"), function (b) { b.disabled = true; });
      return;
    }

    /* Messages for people who were sent here */
    var reason = new URLSearchParams(window.location.search).get("reason");
    if (reason === "expired") {
      showMessage("Your session has expired. Please sign in again.", "info");
    } else if (reason === "inactive") {
      showMessage("Your account is not active. Please contact the super administrator.", "error");
    } else if (reason === "signin") {
      showMessage("Please sign in to open the dashboard.", "info");
    } else if (reason === "signedout") {
      showMessage("You have been signed out.", "success");
    }

    /* Show / hide the password */
    var toggle = document.getElementById("toggle-password");
    var passwordInput = document.getElementById("login-password");
    toggle.addEventListener("click", function () {
      var showing = passwordInput.type === "text";
      passwordInput.type = showing ? "password" : "text";
      toggle.textContent = showing ? "Show" : "Hide";
      toggle.setAttribute("aria-pressed", showing ? "false" : "true");
    });

    /* Sign in */
    var loginButton = document.getElementById("login-submit");
    loginForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var email = loginForm.elements.email.value.trim();
      var password = loginForm.elements.password.value;

      if (!email || !password) {
        showMessage("Enter your email address and password.", "error");
        return;
      }

      showMessage("");
      setBusy(loginButton, true, "Signing in...");

      Auth.signIn(email, password).then(function (result) {
        if (result.ok) {
          showMessage("Signed in. Opening the dashboard...", "success");
          window.location.href = DASHBOARD_URL;
        } else {
          setBusy(loginButton, false);
          loginForm.elements.password.value = "";
          showMessage(result.message, "error");
        }
      });
    });

    /* Forgot password */
    document.getElementById("forgot-link").addEventListener("click", function () {
      showMessage("");
      showPanel("reset");
    });
    document.getElementById("reset-back").addEventListener("click", function () {
      showMessage("");
      showPanel("login");
    });

    var resetButton = document.getElementById("reset-submit");
    resetForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var email = resetForm.elements.email.value.trim();
      if (!email) {
        showMessage("Enter your email address.", "error");
        return;
      }
      showMessage("");
      setBusy(resetButton, true, "Sending...");

      Auth.sendPasswordReset(email).then(function (res) {
        setBusy(resetButton, false);
        if (res.error && res.error.status === 429) {
          showMessage("Too many requests. Please wait a few minutes and try again.", "error");
          return;
        }
        // The same message whether or not the email has an account
        showMessage("If an account exists for that email, a reset link has been sent. Please check your inbox.", "success");
      }).catch(function () {
        setBusy(resetButton, false);
        showMessage("Could not reach the server. Check your internet connection and try again.", "error");
      });
    });

    /* Choose a new password (after opening the link from the reset email) */
    var newButton = document.getElementById("np-submit");
    newForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var first = newForm.elements.password.value;
      var second = newForm.elements.confirm.value;

      if (first.length < MIN_PASSWORD) {
        showMessage("The password must be at least " + MIN_PASSWORD + " characters long.", "error");
        return;
      }
      if (first !== second) {
        showMessage("The two passwords do not match.", "error");
        return;
      }

      showMessage("");
      setBusy(newButton, true, "Saving...");

      Auth.updatePassword(first).then(function (res) {
        if (res.error) {
          setBusy(newButton, false);
          showMessage("Could not save the new password. The link may have expired. Please request a new reset link.", "error");
          return;
        }
        intentionalSignOut = true;
        sb.auth.signOut().then(function () {
          window.location.replace(LOGIN_URL + "?reason=signedout");
        });
      }).catch(function () {
        setBusy(newButton, false);
        showMessage("Could not reach the server. Check your internet connection and try again.", "error");
      });
    });

    /* Arriving from a reset email: show the new-password form */
    sb.auth.onAuthStateChange(function (event) {
      if (event === "PASSWORD_RECOVERY") {
        showPanel("new");
        showMessage("Choose a new password to finish resetting.", "info");
      }
    });

    if (window.location.hash.indexOf("type=recovery") !== -1) {
      showPanel("new");
      showMessage("Choose a new password to finish resetting.", "info");
    } else if (!reason) {
      /* Already signed in? Go straight to the dashboard */
      Auth.getProfile().then(function (r) {
        if (r.profile && r.profile.is_active) { window.location.replace(DASHBOARD_URL); }
      }).catch(function () { /* not signed in, stay here */ });
    }
  }

  initLoginPage();
})();