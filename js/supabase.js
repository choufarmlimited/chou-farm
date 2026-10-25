/* ==========================================================
   Chou Farm Limited - Supabase connection

   Creates one shared connection called "sb" that every other
   file uses. Load order on a page:
     1. the Supabase library (from the CDN)
     2. js/config.js
     3. js/supabase.js  (this file)
   ========================================================== */
(function() {
  "use strict";
  
  var config = window.CHOU_CONFIG;
  
  if (!config || !config.SUPABASE_URL || !config.SUPABASE_ANON_KEY ||
    config.SUPABASE_URL.indexOf("PASTE_") === 0 ||
    config.SUPABASE_ANON_KEY.indexOf("PASTE_") === 0) {
    console.error("Supabase is not configured. Check js/config.js.");
    window.sb = null;
    return;
  }
  
  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    console.error("The Supabase library did not load. Check your internet connection.");
    window.sb = null;
    return;
  }
  
  window.sb = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true, // keeps administrators signed in after a refresh
      autoRefreshToken: true, // renews the session automatically
      detectSessionInUrl: true // needed for password-reset links
    }
  });
})();