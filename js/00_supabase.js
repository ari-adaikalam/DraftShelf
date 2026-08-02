/* ===== Supabase client bootstrap =====
   Loaded first (before 01_core.js) so window.__sbReady exists before anything else runs.
   No bundler: dynamic import() works from a classic <script> in modern browsers, so this
   doesn't need <script type="module">. SUPABASE_URL/SUPABASE_ANON_KEY are plain constants
   -- the anon key is meant to be public, RLS is the real security boundary, so there's no
   env-var injection step despite the app having no build step.

   Project: resume-forge (ref aenpxggiazgwoidjikii, ap-southeast-2). Anon/publishable
   key is safe to be public here -- it's designed for exactly this, RLS is the real
   boundary (see supabase/migrations/20260728190100_enable_rls.sql). */
const SUPABASE_URL = 'https://aenpxggiazgwoidjikii.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Zlvw6QuEhRLqmN4EXXgeKg_fneHO7sM';

// The headless-Chromium PDF-rendering service (see pdf-service/ and CLAUDE.md's "PDF
// export" section) -- public, safe to hardcode same as the URL/anon key above; the service
// itself enforces auth via the caller's Supabase session (downloadPdf() in 06_app.js).
// Merged into the swat-plant-sender Hugging Face Space (an unrelated project sharing this
// account) rather than a dedicated Space -- see pdf-service/README.md's "Sharing a Space
// with another project" section for why.
// `var` (not `const`) specifically so it's a window property -- 06_app.js reads it as
// window.PDF_SERVICE_URL, and this file is excluded from the jsdom test bundle entirely
// (see tests/_helpers.js), so tests seed window.PDF_SERVICE_URL directly instead.
var PDF_SERVICE_URL = 'https://ariadaikalam-swat-plant-sender.hf.space/render';

// Two independent deployments on two different free hosts (see CLAUDE.md's "PDF export"
// section) -- swat-plant-sender's own Hugging Face Space (host of the primary URL above) has
// a real, observed history of multi-hour platform-side outages affecting every service
// sharing that account, unrelated to this app's own code. Unlike the primary, this fallback
// is deliberately left to sleep between uses -- nothing pings its /health to keep it warm.
// If the primary fails, downloadPdf() shows a dialog and polls this host's /health until it
// wakes (cold start ~20-30s) before retrying the render, rather than either silently eating
// the cold-start delay with no explanation or keeping a second host running 24/7 just in
// case the first one fails.
var PDF_SERVICE_URL_FALLBACK = 'https://resume-forge-k0qt.onrender.com/render';

window.__sbReady = import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm')
  .then(({ createClient }) => {
    window.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  })
  .catch(e => {
    console.error('Failed to load Supabase client:', e);
  });
