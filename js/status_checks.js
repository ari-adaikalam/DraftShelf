/* Shared between the main app (js/06_app.js, run in the background after sign-in) and
   status.html (a separate static page, not part of this app's own <script> chain -- see
   CLAUDE.md's "Static pages" section) -- one place for what each check does and where its
   result is cached, so the two callers can't drift out of sync with each other over time.

   The whole point: by the time someone actually opens status.html, the real app has usually
   already run these checks itself during ordinary use (sign-in) and left a real result in
   this shared, device-local cache -- so opening status.html can show that immediately instead
   of a bare "Checking" placeholder every single time. status.html still re-runs every check
   itself too (silently, in the background) so the page is never showing something that's
   gone stale since the app last checked -- it just doesn't visibly reset to "Checking" first.

   Only checks that can actually be confirmed from a plain browser request are listed here --
   a check that can only fail with "can't tell" (blocked by CORS, no way to distinguish that
   from the service being down) is left out entirely rather than shown as a permanent, useless
   "unknown" row. "ok" for most of these just means "the server responded at all" -- a
   genuinely down service doesn't return a real HTTP status, it fails to connect. */
var STATUS_CHECKS_CACHE_KEY = 'rf:ui:statusChecksCache';
var STATUS_CHECKS_SUPABASE_URL = 'https://aenpxggiazgwoidjikii.supabase.co';
var STATUS_CHECKS_SUPABASE_ANON_KEY = 'sb_publishable_Zlvw6QuEhRLqmN4EXXgeKg_fneHO7sM'; // same public, safe-to-embed key js/00_supabase.js already ships client-side

var STATUS_CHECKS = [
  { name: 'Sign-in & data', run: function(){
      return fetch(STATUS_CHECKS_SUPABASE_URL + '/auth/v1/settings', { headers: { apikey: STATUS_CHECKS_SUPABASE_ANON_KEY } }).then(function(r){ return r.ok; });
  }},
  // One row, not two -- PDF export itself works as long as EITHER host answers (that's the
  // whole point of the fallback host existing). Primary is checked first, alone, so the
  // common case (primary healthy) resolves without waiting on the backup at all; the backup
  // is only awaited, and only gates the result, when primary itself fails -- see "Deployment"
  // in CLAUDE.md for why the two hosts exist and why primary is checked alone first.
  { name: 'PDF export', run: function(){
      var PRIMARY = 'https://ariadaikalam-swat-plant-sender.hf.space/health';
      var BACKUP = 'https://resume-forge-k0qt.onrender.com/health';
      function pingBackup(){
        return fetch(BACKUP).then(function(r){ return r.ok; }).catch(function(){ return false; });
      }
      return fetch(PRIMARY).then(function(r){ return r.ok; }).catch(function(){ return false; }).then(function(primaryOk){
        if(primaryOk){
          pingBackup(); // fire-and-forget -- doesn't block or change this check's own result
          return true;
        }
        return pingBackup();
      });
  }},
  { name: 'AI assistant integration', run: function(){
      return fetch(STATUS_CHECKS_SUPABASE_URL + '/functions/v1/mcp-api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(function(r){ return r.status===401; });
  }},
  { name: 'GitHub backup', run: function(){
      return fetch(STATUS_CHECKS_SUPABASE_URL + '/functions/v1/github-backup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(function(r){ return r.status===401; });
  }}
];

function loadStatusChecksCache(){
  try{ return JSON.parse(localStorage.getItem(STATUS_CHECKS_CACHE_KEY)) || {}; }catch(e){ return {}; }
}
function saveStatusChecksCache(cache){
  try{ localStorage.setItem(STATUS_CHECKS_CACHE_KEY, JSON.stringify(cache)); }catch(e){ /* best effort only */ }
}

// Runs every check and writes each real result into the shared cache as it resolves --
// deliberately not awaited by any caller and each check's own errors are already swallowed
// inside its own run() (see above), so one failing check can never stop the others from
// still updating the cache. Call this from anywhere that wants these checks to have already
// run by the time someone might open status.html -- currently just loadAuthedAppState()
// (js/06_app.js), alongside its own warmPdfServices() call.
function runStatusChecksInBackground(){
  var cache = loadStatusChecksCache();
  STATUS_CHECKS.forEach(function(check){
    Promise.resolve().then(check.run).catch(function(){ return false; }).then(function(ok){
      cache[check.name] = ok;
      saveStatusChecksCache(cache);
    });
  });
}
