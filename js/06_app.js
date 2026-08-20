const PT2PX = 96/72;

/* ===== URL-based routing (pushState) =====
   Added on request -- an audit of "navigation feels off" surfaced a real, separate gap: this
   app never touched window.location/history at all, so the browser's own back/forward buttons
   did nothing useful inside it, and no view was ever bookmarkable/shareable by URL. Path-based
   (real URL paths, e.g. /draftshelf/library), not hash-based, deliberately: this app's own auth
   flows already use location.hash for real, functionally critical purposes -- Supabase's
   password-reset/magic-link/OAuth callbacks all arrive as #access_token=...&type=recovery (see
   init()'s own recoveryRequested check) -- and layering app-level hash routing on top of that
   would risk colliding with it. Path-based routing shares no namespace with the hash at all.
   Requires a matching server-side rewrite so a direct load/reload at a deep path still serves
   this same index.html -- see vercel.json in the portfolio repo (this app's actual deployment,
   not this repo -- see scripts/push_to_portfolio.sh) and CLAUDE.md's own note on it.

   ROUTE_BASE is captured once, here, at real page-load time -- before this app's own routing
   code has ever called pushState, so it reliably reflects the true entry URL regardless of how
   many path segments deep a deep link went. '/draftshelf/' is this app's one real, documented
   deployment path (see CLAUDE.md's "Password reset" section, `site_url`); anything else (local
   dev via a plain static file server, a future different host) falls back to '/'. startsWith
   (not an exact-match check) is what makes a deep link landed on directly (e.g.
   /draftshelf/editor/abc123) still resolve the correct root, regardless of segment count --
   avoids needing to parse an arbitrary pathname apart to reverse-engineer where "the app" starts
   and "the route" begins. */
var ROUTE_BASE = (window.location.pathname==='/draftshelf' || window.location.pathname.startsWith('/draftshelf/')) ? '/draftshelf/' : '/';
// view <-> URL segment mapping -- kebab-case in the URL (nicer to read/type/share) even though
// the internal VIEW value stays camelCase everywhere else in this file, matching every other
// identifier here. 'dashboard' maps to '' (the bare root) since it's this app's home/default,
// not a sub-path of itself. 'importReview'/'auth' are deliberately absent -- see updateRoute().
var ROUTE_SEGMENTS = { dashboard:'', library:'library', preferences:'preferences', coverLetter:'cover-letter', editor:'editor' };
var ROUTE_SEGMENTS_REVERSE = { library:'library', preferences:'preferences', 'cover-letter':'coverLetter', editor:'editor' };
function routePathFor(view, versionId){
  if(view==='editor' && versionId) return ROUTE_BASE+'editor/'+encodeURIComponent(versionId);
  const seg = ROUTE_SEGMENTS[view];
  return seg ? ROUTE_BASE+seg : ROUTE_BASE;
}
// Reads the current URL and returns {view, versionId} for a real, routable view, or null if it
// doesn't encode one (the bare root, or anything unrecognized) -- callers fall back to the
// existing KV-based restore in that case, exactly the same as before this feature existed, so a
// URL this app doesn't recognize degrades to the pre-routing behavior rather than breaking.
function parseAppRoute(){
  let path = window.location.pathname;
  if(!path.startsWith(ROUTE_BASE)) return null;
  path = path.slice(ROUTE_BASE.length).replace(/^\/+|\/+$/g,'');
  if(!path) return null;
  const parts = path.split('/');
  if(parts[0]==='editor' && parts[1]) return { view:'editor', versionId: decodeURIComponent(parts[1]) };
  const view = ROUTE_SEGMENTS_REVERSE[parts[0]];
  return view ? { view, versionId:null } : null;
}
// The one function that actually touches window.history -- switchView()/openEditor() both call
// this at the end of their own view-swap sequence, never history.pushState()/replaceState()
// directly, so there's exactly one place that knows the URL<->view mapping.
//   navMode==='popstate': the browser already updated the URL itself (this is a back/forward
//     navigation) -- calling pushState/replaceState again here would be redundant at best and,
//     worse, could disturb the back-stack the browser just navigated through.
//   navMode==='replace': establishes the correct URL for the current state without adding a
//     new back-stack entry -- for the initial boot/restore path (loadAuthedAppState()), where
//     there's nothing meaningful to "go back" to from a page that just finished loading.
//   anything else (the default, every real user-triggered navigation): pushState, the normal
//     expected History API behavior -- but only if the resulting path actually differs from the
//     current one, so clicking the tab you're already on doesn't spam identical history entries.
// importReview/auth are excluded entirely -- importReview is transient/in-memory-only, with no
// real state to encode in a URL; auth's own sign-in/sign-up/reset screens are reached by
// AUTH_MODE, an in-memory flag with no persistence or deep-linking need of its own.
function updateRoute(view, versionId, navMode){
  if(view==='importReview' || view==='auth') return;
  if(navMode==='popstate') return;
  const path = routePathFor(view, versionId);
  if(navMode==='replace') history.replaceState({view,versionId}, '', path);
  else if(window.location.pathname!==path) history.pushState({view,versionId}, '', path);
}

/* ===== inline SVG icon set (replaces the old ad-hoc unicode glyphs) -- outline style,
   currentColor stroke so every icon inherits its button's text color automatically, no
   runtime dependency (fits the zero-build/CDN-or-inline convention). ===== */
const ICONS = {
  edit:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>',
  duplicate:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  star:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  starFilled:'<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  // Dashboard "Pin to top" -- see toggleMain()/renderDashboard() below. Replaces the old
  // star/"main" badge's icon on request ("the current, star + main, feels like a gimmick") --
  // the underlying data field is unchanged (still `main`/`is_main`, see that comment), only the
  // icon/label/behavior are new.
  pin:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6a1 1 0 0 1 1-1 1 1 0 0 0 0-2H8a1 1 0 0 0 0 2 1 1 0 0 1 1 1z"/></svg>',
  pinFilled:'<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6a1 1 0 0 1 1-1 1 1 0 0 0 0-2H8a1 1 0 0 0 0 2 1 1 0 0 1 1 1z"/></svg>',
  close:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  chevronUp:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m18 15-6-6-6 6"/></svg>',
  chevronDown:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
  sun:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>',
  moon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/></svg>',
  settings:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>',
  menu:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
  help:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>',
  // Real brand marks (Google's own 4-color "G", GitHub's own Octocat silhouette) -- an
  // explicit, deliberate exception to this file's otherwise-uniform stroke-icon style, since a
  // recolored/outline version of either would be unrecognizable as "sign in with Google/GitHub".
  google:'<svg viewBox="0 0 48 48" width="16" height="16" aria-hidden="true"><path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/></svg>',
  github:'<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>',
  // Homepage hero feature icons (authLandingHtml() below) -- same stroke-based style as every
  // other icon in this object, not a new icon library dependency (this app loads zero runtime
  // npm packages beyond jsPDF/docx.js -- see CLAUDE.md's "Architecture" section).
  layers:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
  trash:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>',
  fileDown:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M12 18v-6"/><path d="m9 15 3 3 3-3"/></svg>',
  unlock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>',
  sparkles:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.287 1.288L3 12l5.8 1.9a2 2 0 0 1 1.288 1.287L12 21l1.9-5.8a2 2 0 0 1 1.287-1.288L21 12l-5.8-1.9a2 2 0 0 1-1.288-1.287Z"/></svg>',
  // "Copy prompt" button, showImportResumeDialog() below -- same outline-stroke style as
  // every other icon in this object.
  copy:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
};

var LIBRARY = null;
var VERSIONS_INDEX = [];
var CURRENT_VERSION = null;
var VIEW = 'auth';
var LIB_TAB = 'experience';
// In-memory only, never persisted (see "Everything collapsed on a fresh load" below) -- the
// editor's <details> panels keep their open/closed state across an in-session re-render
// (renderEditor()'s own openState/isOpen(), keyed by data-block-key) and across in-app
// navigation (Editor -> Dashboard -> Editor, no reload) via this variable, but always start
// fresh (everything collapsed) on a genuine reload/reopen, on request -- "when I open the
// site after closing it, everything should be collapsed, not expanded." This used to be
// KV-backed (rf:ui:collapsedPanels, device-local localStorage) specifically so it survived a
// reload; that's the exact behavior being removed here, not a bug being fixed.
var PANEL_OPEN_STATE = {};
var ghPanelOpen = false;
var apiKeysPanelOpen = false;
var pendingRevokeKey = null; // same arm-then-confirm pattern as pendingDelete/pendingPurge
var justGeneratedKey = null; // { rawKey, id } -- shown once, in-memory only, never persisted
var pendingRevokeConnectedApp = null; // same arm-then-confirm pattern, for Connected Apps' own Revoke
var trashPanelOpen = false;
var TRASH_VERSIONS = [];
var TRASH_COUNT = 0; // kept in sync locally by every trash-count-changing action below, rather
// than a DB.listTrashedVersions() re-fetch on every Dashboard render just for the button label
var pendingPurge = null; // mirrors pendingDelete's own arm-then-confirm pattern, scoped to the Trash panel
var pendingDelete = null;
var LIBRARY_REVISION = null;
var VERSION_REVISIONS = {};
// "Used in N versions" -- see buildUsageIndex() (js/03_model.js) and refreshLibraryUsageIndex()
// below. null until the Library tab has been opened at least once this session (every usage
// count/label/save-gate treats null the same as "not used anywhere yet" -- see
// libraryUsageCount() -- so a field simply behaves exactly like today, frictionless autosave,
// until the index has actually loaded).
var LIBRARY_USAGE_INDEX = null;
// Text fields whose autosave is currently held back pending a deliberate Save click, because
// they're both dirty and used by at least one version -- keyed by the field's own data-path.
// Each entry remembers the value the field held *before* this edit started, so "Freeze old
// wording" has something real to freeze -- captured once, on the first keystroke of this
// edit, not re-captured on every subsequent keystroke (which would just capture the
// already-modified value and make freezing a no-op).
var LIBRARY_PENDING_SAVES = {}; // path -> { originalValue, kind, refId, bulletId }
var GITHUB_CONFIG = null;
var syncConflict = null;
var PREFERENCES = null; // account-level, synced via Supabase user_preferences -- see renderPreferences()
var AUTH_MODE = 'landing'; // 'landing' | 'signin' | 'signup' | 'forgot' | 'magic' | 'reset' | 'oauth-consent'
var AUTH_MESSAGE = null; // {kind:'error'|'info', text}

// Remote MCP (claude.ai/chatgpt.com) OAuth consent -- mcp-remote-auth's own /authorize (Edge
// Function) can't render an interactive HTML+JS page itself (a real, verified platform
// limitation: Supabase forces Content-Type:text/plain + X-Content-Type-Options:nosniff on
// every response from the shared *.supabase.co Edge Functions domain, regardless of what the
// function sets -- confirmed live, not assumed, by deploying a trivial text/html response and
// watching the browser receive text/plain instead). So /authorize instead 302-redirects here,
// to this app's own real origin, with the pending request's params as query params -- this app
// renders the actual sign-in/consent screen (AUTH_MODE='oauth-consent' below), reusing its own
// already-real Supabase session when one exists instead of asking to sign in twice.
// OAUTH_REQUEST is parsed once from the URL in init() (see recoveryRequested's own pattern) and
// kept in memory only -- never persisted, same as every other transient auth-flow state here.
var OAUTH_REQUEST = null; // {clientId, clientName, redirectUri, codeChallenge, state, consentToken, consentExpiresAt}
var OAUTH_SESSION = null; // the real, verified session used to complete the consent POST

// Real, reported gap: the consent screen never said how long this specific request/link stays
// valid, which read as if it might work indefinitely - it doesn't (mcp-remote-auth's own
// verifyConsentToken() rejects it past consentExpiresAt, 10 minutes after /authorize issued it).
// Only ever called for a request that's still valid (see the oauth-consent render branch below,
// which switches to a completely different, button-less expired screen once it isn't) - so this
// only ever needs to describe "still good for N more minutes," never the lapsed case.
function oauthConsentExpiryLabel(consentExpiresAt){
  if(!consentExpiresAt) return 'This request expires a few minutes after being opened.';
  const minsLeft = Math.max(1, Math.round((consentExpiresAt - Date.now())/60000));
  return `This request expires in about ${minsLeft} minute${minsLeft===1?'':'s'} if not confirmed.`;
}
// Fires renderAuthScreen() again the instant a still-valid consent request's own expiry passes,
// so a tab left open through that moment flips itself over to the expired screen live - without
// this, only a fresh page load (a new GET /authorize) would ever notice the request had lapsed.
var OAUTH_CONSENT_EXPIRY_TIMER = null;

/* ===== Standalone (import-as-separate-version) support =====
   "Import as separate version" (see showImportChoiceDialog()/showStandaloneImportDialog()
   below) is the one place this app lets a version carry its own private copy of library-shaped
   content (version.embeddedLibrary) instead of only ever referencing the shared LIBRARY -- see
   libraryFor()'s own comment in js/03_model.js for why. currentLibrary() is the thin wrapper
   every editor-context render/mutation call site in this file uses instead of assuming the
   global LIBRARY directly, so the checklist, summary/skill-set pickers, "Fill in with tag", the
   entry-edit modal, preview/pagination, and PDF/DOCX export all work unmodified for a
   standalone version -- none of them hardcode LIBRARY. */
function currentLibrary(){ return libraryFor(LIBRARY, CURRENT_VERSION); }
function isStandaloneVersion(){ return !!(CURRENT_VERSION && CURRENT_VERSION.standalone); }
// Applies a pure library reducer (libAddEntry, libAddBullet, etc.) to whichever library the
// open version actually resolves against, and persists+re-renders through the matching path --
// the account's shared LIBRARY (scheduleLibrarySave()) for a normal version, or
// CURRENT_VERSION.embeddedLibrary (scheduleVersionSave(), since embeddedLibrary lives ON the
// version) for a standalone one. Every editor-context "add/edit/remove library content" call
// site goes through this instead of assigning LIBRARY directly, so none of them need their own
// standalone/normal branch.
function mutateCurrentLibrary(fn){
  if(isStandaloneVersion()){
    CURRENT_VERSION.embeddedLibrary = fn(CURRENT_VERSION.embeddedLibrary);
    scheduleVersionSave();
  } else {
    LIBRARY = fn(LIBRARY);
    scheduleLibrarySave();
  }
}
// The matching history counterpart -- a standalone version's embedded content lives inside
// CURRENT_VERSION itself, so a mutation there is a VERSION_HISTORY snapshot (the same
// whole-object snapshot already covers embeddedLibrary for free, no third history stack
// needed), never a LIBRARY_HISTORY one.
function noteCurrentLibraryHistory(){ if(isStandaloneVersion()) noteVersionHistoryImmediate(); else noteLibraryHistoryImmediate(); }
// Debounced counterpart, for a live-bound (typing) field that mutates the current library
// directly rather than the entry-edit modal's buffered-until-Save pattern -- e.g. the Skill
// Set name field editable inline from the editor's own Skills section. Same 500ms-grouping
// reasoning as noteLibraryHistory()/noteVersionHistory() themselves: one undo step per typing
// burst, not one per keystroke.
function noteCurrentLibraryHistoryDebounced(){ if(isStandaloneVersion()) noteVersionHistory(); else noteLibraryHistory(); }

/* ===== save-status indicator (topbar) + unsaved-changes warning on tab close =====
   Library and version saves are independently debounced (scheduleLibrarySave/
   scheduleVersionSave), so each gets its own state: 'saved' (nothing pending, last attempt
   succeeded), 'dirty' (an edit happened, waiting out the debounce window before the actual
   save fires), 'saving' (the debounced save is in flight), 'error' (last save attempt
   failed -- a Supabase conflict or network error; the sync-conflict banner already covers
   the conflict case in detail, this is just the topbar-level signal that something didn't
   save). Deliberately two independent slots rather than one combined flag -- a user could
   have unsaved version edits while a library save from a moment ago is still settling, and
   collapsing them would hide whichever one actually failed. */
var SAVE_STATUS = { library:'saved', version:'saved' };
function updateSaveStatusUI(){
  const el = document.getElementById('saveStatusText');
  if(!el) return;
  const states = [SAVE_STATUS.library, SAVE_STATUS.version];
  let text, cls;
  if(states.includes('error')){ text='Save failed'; cls='err'; }
  else if(states.includes('saving')){ text='Saving…'; cls='saving'; }
  else if(states.includes('dirty')){ text='Unsaved changes'; cls='dirty'; }
  else { text='All changes saved'; cls='ok'; }
  el.title = 'Library and version edits autosave to your account a moment after you stop typing.';
  el.textContent = text;
  el.className = 'save-status-text '+cls;
}
// Native "leave site?" browser prompt -- the only way to actually warn on tab close/reload,
// since no other code runs after this point if the user proceeds. Only fires while an
// autosave is genuinely pending or in flight; 'error' does NOT block close (a failed save
// with no pending retry isn't "about to lose data by leaving", and blocking navigation on a
// state the user often can't immediately fix would just be an annoyance -- the topbar
// indicator + sync-conflict banner already surface that case).
function onBeforeUnload(ev){
  if(SAVE_STATUS.library==='dirty' || SAVE_STATUS.library==='saving' || SAVE_STATUS.version==='dirty' || SAVE_STATUS.version==='saving'){
    ev.preventDefault();
    ev.returnValue = '';
    return '';
  }
}

/* ===== theme (device-local, KV-backed rf:ui:theme -- see CLAUDE.md's Storage section).
   The actual data-theme attribute is already set pre-paint by the inline bootstrap script
   in index.html's <head> (avoids a flash of the wrong theme); THEME here just mirrors that
   so the toggle button and setTheme() have a source of truth to read/flip. ===== */
var THEME = document.documentElement.getAttribute('data-theme') || 'dark';
function renderThemeToggle(){
  // Two buttons share this now -- #btnThemeToggle (signed-in topbar) and #btnThemeToggleOut
  // (signed-out topbar, see index.html's #topbarSignedOut) -- both marked data-role so this
  // stays a single source of truth instead of two copies of the same icon-swap logic.
  document.querySelectorAll('[data-role="theme-toggle"]').forEach(btn=>{
    btn.innerHTML = THEME==='dark' ? ICONS.sun : ICONS.moon;
  });
}
function setTheme(t){
  THEME = t;
  document.documentElement.setAttribute('data-theme', t);
  KV.set('rf:ui:theme', t);
  renderThemeToggle();
}
// UI/UX audit finding: this button's own CSS already listed `transform` in its transition
// property list (css/style.css's .theme-toggle rule) but nothing ever actually changed its
// transform -- dead code, and a missed micro-interaction on one of the few icon buttons in the
// topbar that should feel satisfying to click. GSAP specifically (not a plain CSS transition)
// for the back.out overshoot -- the "settles past 180deg then eases back" feel a linear
// transition can't produce -- added on direct request, one of the few places in this app it
// genuinely earns its weight over the CSS-only alternative used everywhere else here.
// renderThemeToggle() only ever replaces this button's *children* (innerHTML, the SVG icon),
// never the button element itself, so the in-flight rotation this starts survives the icon
// swap that setTheme() triggers a moment later -- the icon visibly changes mid-flip instead of
// the animation getting reset or orphaned. Guarded for the (very unlikely, but real) case GSAP
// fails to load from its CDN -- falls through to the theme change with no animation rather
// than throwing and blocking the toggle from working at all.
function flipThemeToggleIcon(btn){
  if(typeof gsap==='undefined') return;
  gsap.to(btn, { rotate:'+=180', duration:0.35, ease:'back.out(1.7)' });
}

/* ===== undo/redo (runtime-only, never persisted/synced -- js/03b_history.js has the pure
   push/undo/redo/cap logic). Two independent stacks: Library and the open Version. A
   500ms debounce groups a burst of typing on the same field into one undo step; every
   structural action (add/remove, toggle, reorder, checkbox/select changes) pushes
   immediately, one step per action. ===== */
var LIBRARY_HISTORY = historyCreate();
var VERSION_HISTORY = historyCreate();
var libraryHistoryArmed = true, libraryHistoryTimer = null;
var versionHistoryArmed = true, versionHistoryTimer = null;
const HISTORY_LIMITS = { maxEntries:50, maxBytes:5000000 };
function pushLibraryHistorySnapshot(){
  const snap = JSON.parse(JSON.stringify(LIBRARY));
  if(JSON.stringify(LIBRARY_HISTORY.past[LIBRARY_HISTORY.past.length-1])===JSON.stringify(snap)) return;
  LIBRARY_HISTORY = historyCap(historyPush(LIBRARY_HISTORY, snap), HISTORY_LIMITS);
}
function noteLibraryHistory(){
  if(libraryHistoryArmed){ pushLibraryHistorySnapshot(); libraryHistoryArmed=false; }
  clearTimeout(libraryHistoryTimer);
  libraryHistoryTimer = setTimeout(()=>{ libraryHistoryArmed=true; }, 500);
}
function noteLibraryHistoryImmediate(){
  pushLibraryHistorySnapshot();
  libraryHistoryArmed=true;
  clearTimeout(libraryHistoryTimer);
}
function clearLibraryHistory(){ LIBRARY_HISTORY=historyCreate(); libraryHistoryArmed=true; clearTimeout(libraryHistoryTimer); }
function undoLibrary(){
  if(!LIBRARY_HISTORY.past.length || !LIBRARY) return;
  const r = historyUndo(LIBRARY_HISTORY, JSON.parse(JSON.stringify(LIBRARY)));
  LIBRARY_HISTORY = r.hist; LIBRARY = r.current;
  renderLibrary(); scheduleLibrarySave();
}
function redoLibrary(){
  if(!LIBRARY_HISTORY.future.length || !LIBRARY) return;
  const r = historyRedo(LIBRARY_HISTORY, JSON.parse(JSON.stringify(LIBRARY)));
  LIBRARY_HISTORY = r.hist; LIBRARY = r.current;
  renderLibrary(); scheduleLibrarySave();
}
function pushVersionHistorySnapshot(){
  const snap = JSON.parse(JSON.stringify(CURRENT_VERSION));
  if(JSON.stringify(VERSION_HISTORY.past[VERSION_HISTORY.past.length-1])===JSON.stringify(snap)) return;
  VERSION_HISTORY = historyCap(historyPush(VERSION_HISTORY, snap), HISTORY_LIMITS);
}
function noteVersionHistory(){
  if(versionHistoryArmed){ pushVersionHistorySnapshot(); versionHistoryArmed=false; }
  clearTimeout(versionHistoryTimer);
  versionHistoryTimer = setTimeout(()=>{ versionHistoryArmed=true; }, 500);
}
function noteVersionHistoryImmediate(){
  pushVersionHistorySnapshot();
  versionHistoryArmed=true;
  clearTimeout(versionHistoryTimer);
}
function clearVersionHistory(){ VERSION_HISTORY=historyCreate(); versionHistoryArmed=true; clearTimeout(versionHistoryTimer); }
function undoVersion(){
  if(!VERSION_HISTORY.past.length || !CURRENT_VERSION) return;
  const r = historyUndo(VERSION_HISTORY, JSON.parse(JSON.stringify(CURRENT_VERSION)));
  VERSION_HISTORY = r.hist; CURRENT_VERSION = r.current;
  renderEditor(); scheduleVersionSave();
}
function redoVersion(){
  if(!VERSION_HISTORY.future.length || !CURRENT_VERSION) return;
  const r = historyRedo(VERSION_HISTORY, JSON.parse(JSON.stringify(CURRENT_VERSION)));
  VERSION_HISTORY = r.hist; CURRENT_VERSION = r.current;
  renderEditor(); scheduleVersionSave();
}
// A third independent history stack, same shape/timing convention as LIBRARY_HISTORY/
// VERSION_HISTORY above, added on request -- the Import Review screen (js/03c_import_review.js
// + the rendering below) makes plenty of individual decisions per import (which entry merges
// where, which bullet is added/discarded/same-as, which header field to keep) with no way to
// step one back short of Cancelling the whole review. Snapshots {reviewState, includeMap,
// metaChoices} -- IMPORT_REVIEW.payload (the incoming file's parsed content) is never mutated
// by any decision, so it's deliberately excluded from the snapshot to keep every entry small.
var IMPORT_REVIEW_HISTORY = historyCreate();
var importReviewHistoryArmed = true, importReviewHistoryTimer = null;
function importReviewStateSnapshot(){
  return { reviewState: IMPORT_REVIEW.reviewState, includeMap: IMPORT_REVIEW.includeMap, metaChoices: IMPORT_REVIEW.metaChoices };
}
function pushImportReviewHistorySnapshot(){
  if(!IMPORT_REVIEW) return;
  const snap = JSON.parse(JSON.stringify(importReviewStateSnapshot()));
  if(JSON.stringify(IMPORT_REVIEW_HISTORY.past[IMPORT_REVIEW_HISTORY.past.length-1])===JSON.stringify(snap)) return;
  IMPORT_REVIEW_HISTORY = historyCap(historyPush(IMPORT_REVIEW_HISTORY, snap), HISTORY_LIMITS);
}
function noteImportReviewHistory(){
  if(importReviewHistoryArmed){ pushImportReviewHistorySnapshot(); importReviewHistoryArmed=false; }
  clearTimeout(importReviewHistoryTimer);
  importReviewHistoryTimer = setTimeout(()=>{ importReviewHistoryArmed=true; }, 500);
}
function noteImportReviewHistoryImmediate(){
  pushImportReviewHistorySnapshot();
  importReviewHistoryArmed=true;
  clearTimeout(importReviewHistoryTimer);
}
function clearImportReviewHistory(){ IMPORT_REVIEW_HISTORY=historyCreate(); importReviewHistoryArmed=true; clearTimeout(importReviewHistoryTimer); }
function undoImportReview(){
  if(!IMPORT_REVIEW_HISTORY.past.length || !IMPORT_REVIEW) return;
  const r = historyUndo(IMPORT_REVIEW_HISTORY, JSON.parse(JSON.stringify(importReviewStateSnapshot())));
  IMPORT_REVIEW_HISTORY = r.hist;
  IMPORT_REVIEW.reviewState = r.current.reviewState; IMPORT_REVIEW.includeMap = r.current.includeMap; IMPORT_REVIEW.metaChoices = r.current.metaChoices;
  renderImportReviewView();
}
function redoImportReview(){
  if(!IMPORT_REVIEW_HISTORY.future.length || !IMPORT_REVIEW) return;
  const r = historyRedo(IMPORT_REVIEW_HISTORY, JSON.parse(JSON.stringify(importReviewStateSnapshot())));
  IMPORT_REVIEW_HISTORY = r.hist;
  IMPORT_REVIEW.reviewState = r.current.reviewState; IMPORT_REVIEW.includeMap = r.current.includeMap; IMPORT_REVIEW.metaChoices = r.current.metaChoices;
  renderImportReviewView();
}

// A real, reported bug (UI/UX audit): --ink-soft/--brass/--text-light were never defined
// anywhere in css/style.css (the app's real tokens are --surface/--border/--text) -- every
// toast() call in the entire app (import/export confirmations, GitHub backup status, "Prompt
// copied," dozens of call sites) was rendering fully transparent with an invisible border,
// confirmed live: firing one in a real browser produced nothing visible on screen at all.
// Fixed with the app's real tokens, plus a fade+slight-rise on the way in and out
// (transform/opacity only -- compositor-only properties, matches this app's own established
// transition convention elsewhere) so a correctly-visible toast doesn't just correctly render
// but also doesn't hard-cut in/out the way the invisible version accidentally "avoided."
function toast(msg){
  const t=document.createElement('div');
  t.textContent=msg;
  t.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%) translateY(6px);background:var(--surface);border:1px solid var(--border);color:var(--text);padding:10px 18px;border-radius:8px;font-size:13px;z-index:9999;box-shadow:var(--shadow);opacity:0;transition:opacity 0.2s ease,transform 0.2s ease;';
  document.body.appendChild(t);
  // Read the pre-transition state before flipping it -- forces the browser to register the
  // "opacity:0, translateY(6px)" starting point as a real paint before the transition target
  // changes, which is what makes the fade/rise actually animate instead of snapping straight
  // to its end state (the same reflow-forcing trick this file's own animateModalIn-style
  // reasoning depends on elsewhere).
  void t.offsetHeight;
  t.style.opacity='1';
  t.style.transform='translateX(-50%) translateY(0)';
  setTimeout(()=>{
    t.style.opacity='0';
    t.style.transform='translateX(-50%) translateY(6px)';
    setTimeout(()=>t.remove(),200);
  },3000);
}

/* ===== mandatory auth gate: sign-in/sign-up/forgot-password/reset-password.
   Signing in is required to use the app at all -- there is no local-only fallback. ===== */
function authFieldsHtml(){
  // Restructured to a deliberate layout, on request (a hand-drawn spec): Email; Password with
  // "Forgot password?" inline on the same row instead of stacked below as a fourth link; the
  // primary button; one small, centered "alternate sign-in" link right under it. Everything
  // else that used to live in this per-mode block (Create account / Already have an account /
  // Back to sign in) moved into authFooterHtml() below -- a single shared footer (divider +
  // cross-link) instead of duplicating that markup per mode.
  // Shared by both signin and signup -- signInWithOAuth() (onAuthClick()) is a single unified
  // flow on Supabase's side: whether the resulting account already exists or gets created on
  // the spot is entirely up to Supabase, this app never distinguishes "OAuth sign-in" from
  // "OAuth sign-up" itself, so both screens can offer the exact same two buttons.
  const socialRow = `
    <div class="auth-social-row">
      <button class="btn btn-ghost auth-social-btn" data-action="oauth-google">${ICONS.google} Google</button>
      <button class="btn btn-ghost auth-social-btn" data-action="oauth-github">${ICONS.github} GitHub</button>
    </div>
    <div class="auth-divider-or"><span>or</span></div>`;
  if(AUTH_MODE==='signin') return `
    ${socialRow}
    <div class="field"><label>Email</label><input type="email" id="authEmail" autocomplete="email"></div>
    <div class="field">
      <div class="field-label-row"><label>Password</label><a href="#" class="field-inline-link" data-action="switch-forgot">Forgot password?</a></div>
      <input type="password" id="authPassword" autocomplete="current-password">
    </div>
    <button class="btn btn-brass auth-submit" data-action="submit-signin">Sign in</button>
    <div class="auth-links auth-links-center"><a href="#" data-action="switch-magic">Sign in with a link instead</a></div>`;
  if(AUTH_MODE==='signup') return `
    ${socialRow}
    <div class="field"><label>Email</label><input type="email" id="authEmail" autocomplete="email"></div>
    <div class="field"><label>Password</label><input type="password" id="authPassword" autocomplete="new-password"></div>
    <button class="btn btn-brass auth-submit" data-action="submit-signup">Sign up</button>`;
  if(AUTH_MODE==='forgot') return `
    <div class="field"><label>Email</label><input type="email" id="authEmail" autocomplete="email"></div>
    <button class="btn btn-brass auth-submit" data-action="submit-forgot">Send reset link</button>`;
  // Magic link / OTP sign-in -- an alternate, passwordless entry to the exact same sign-in
  // gate. Deliberately just an email field + one button: signInWithOtp() below emails a
  // one-time link, clicking it lands back here with a session already established (handled
  // by the same onAuthStateChange('SIGNED_IN', ...) branch every password sign-in already
  // goes through -- no separate "magic-link session" concept exists anywhere else in the
  // app, resolveVersion()/DB/etc. never know or care how the session was established).
  if(AUTH_MODE==='magic') return `
    <div class="field"><label>Email</label><input type="email" id="authEmail" autocomplete="email"></div>
    <button class="btn btn-brass auth-submit" data-action="submit-magic">Send sign-in link</button>`;
  if(AUTH_MODE==='reset') return `
    <div class="field"><label>New password</label><input type="password" id="authPassword" autocomplete="new-password"></div>
    <button class="btn btn-brass auth-submit" data-action="submit-reset">Set new password</button>`;
  return '';
}
// The shared footer below the fields/button -- a horizontal divider, then the mode's one
// cross-link ("Don't have an account? Create one" / "Already have an account? Sign in" /
// "Back to sign in"). Guest mode was removed on request (signing up is required to use the
// app now) -- this footer used to also carry a "Continue as Guest" secondary action on
// signin/signup/magic; if guest access is ever reconsidered, check git history here.
function authFooterHtml(){
  if(AUTH_MODE==='signin') return `
    <div class="auth-divider"></div>
    <div class="auth-footer">
      <div>Don't have an account? <a href="#" data-action="switch-signup">Create one</a></div>
    </div>`;
  if(AUTH_MODE==='signup') return `
    <div class="auth-divider"></div>
    <div class="auth-footer">
      <div>Already have an account? <a href="#" data-action="switch-signin">Sign in</a></div>
    </div>`;
  if(AUTH_MODE==='magic') return `
    <div class="auth-divider"></div>
    <div class="auth-footer">
      <div><a href="#" data-action="switch-signin">Back to sign in</a></div>
    </div>`;
  if(AUTH_MODE==='forgot') return `<div class="auth-links"><a href="#" data-action="switch-signin">Back to sign in</a></div>`;
  return '';
}
// A real homepage, not a form with some text glued above it -- on request ("create a new
// signin and signup button in the homepage, don't just show that [the form] in the homepage").
// AUTH_MODE='landing' is the default a signed-out visitor lands on (see its var declaration
// above): pure informational content plus two CTA buttons, zero form fields -- which is also
// what actually satisfies Google's OAuth branding verification ("Your home page is behind a
// login page... allow users to view information about your app without needing to login"),
// unambiguously this time, since there's no login form on-screen at all until a CTA is clicked.
// Structure (headline, short description, ≤3 benefit bullets, CTA, footer) follows the
// "Minimal Single Column" landing pattern -- kept DraftShelf's own existing gold/dark palette
// rather than a generic one, the app already has a cohesive brand identity.
// A UI/UX audit flagged an earlier version of this page (an eyebrow pill + bold headline + a
// 3-row icon/title/description feature card) as a templated-AI-landing-page pattern -- correct
// on the content, generic on the frame. This session went through a much larger scrollable,
// multi-section, personal-photo redesign and back out again -- kept simple on final direct
// request ("remove my image and msg, remove the scrollable and revert to the two column
// layout... but with no ai pattern"): back to a single, non-scrolling, two-column fold
// (copy + CTAs on the left, a real demonstration on the right), no eyebrow pill, no generic
// icon list. The demonstration itself -- a small "library" of tagged bullets next to the
// resume page they produce -- is what actually replaces the old generic feature card: it
// shows the Library -> Version mechanic using this app's own real concepts instead of an
// abstract claim about them, which is what keeps this from reading as a template despite
// being a plain two-column hero.
function authLandingHtml(){
  // 4 library bullets, the same 2 underlying achievements each written twice -- once in
  // data-analyst vocabulary, once in business-analyst vocabulary -- to make the point that
  // the *library* holds every phrasing you've ever written, tagged by which role it fits.
  // One job is picked (Data Analyst) to actually show tailored below: its 2 bullets are
  // marked included in the shelf, and are the only ones that make it onto the resume page --
  // the business-analyst pair stays visibly present but excluded, the same way an
  // untailored-for-this-job entry looks in the real app. Stacked vertically (library on top,
  // arrow down, resulting page below) rather than side by side.
  const demoHtml = `<div class="auth-hero-demo">
    <div class="hero-demo-shelf">
      <div class="hero-demo-shelf-company">Acme Corp <span class="hero-demo-job-badge">Tailoring for: Data Analyst</span></div>
      <div class="hero-demo-bullet on"><span class="hero-demo-dot"></span>Built dashboards that cut reporting time by 30%<span class="bullet-tag-badge">data-analyst</span></div>
      <div class="hero-demo-bullet on"><span class="hero-demo-dot"></span>Identified a 15% revenue opportunity through customer data analysis<span class="bullet-tag-badge">data-analyst</span></div>
      <div class="hero-demo-bullet"><span class="hero-demo-dot"></span>Streamlined reporting workflows, cutting turnaround time by 30%<span class="bullet-tag-badge">business-analyst</span></div>
      <div class="hero-demo-bullet"><span class="hero-demo-dot"></span>Uncovered a 15% revenue opportunity through stakeholder and customer analysis<span class="bullet-tag-badge">business-analyst</span></div>
    </div>
    <div class="hero-demo-arrow hero-demo-arrow-down" aria-hidden="true">&darr;</div>
    <div class="hero-demo-page">
      <div class="hero-demo-page-header">
        <div class="hero-demo-page-name">Alex Rivera</div>
        <div class="hero-demo-page-contact">alex@email.com &middot; (555) 010-0100 &middot; Sydney</div>
      </div>
      <div class="hero-demo-page-heading">Experience</div>
      <div class="hero-demo-page-company">Acme Corp - Data Analyst</div>
      <div class="hero-demo-page-line">&bull; Built dashboards that cut reporting time by 30%</div>
      <div class="hero-demo-page-line">&bull; Identified a 15% revenue opportunity through customer data analysis</div>
    </div>
  </div>`;
  return `<div class="auth-landing">
    <div class="auth-landing-copy">
      <h1>Tailor the content.<br><span class="auth-hero-nowrap">DraftShelf handles the rest.</span></h1>
      <p class="auth-hero-subhead">Keep every job, project, and bullet point you have ever written in one
      library. Choose what to include for each application, and the formatting takes care of itself, so
      every version comes out clean and consistent, without you touching a single margin in Word.</p>
      <div class="auth-hero-ctas">
        <button class="btn btn-brass auth-cta-primary" data-action="switch-signup">Create an account</button>
        <button class="btn btn-ghost auth-cta-secondary" data-action="switch-signin">Sign in</button>
      </div>
    </div>
    ${demoHtml}
  </div>`;
}
function renderAuthScreen(){
  const titles = { signin:'Sign in', signup:'Create your account', forgot:'Reset your password', magic:'Sign in with a link', reset:'Choose a new password' };
  const el = document.getElementById('viewAuth');
  // A real, page-anchored footer -- on request ("their current position feels slightly
  // accidental... floating underneath the hero content rather than behaving like a real
  // footer"). .auth-page is a flex column at least as tall as the view itself
  // (min-height:100%); .auth-legal-links is its last child with margin-top:auto, the standard
  // "sticky footer" pattern -- pinned to the bottom of the viewport when content is short,
  // pushed below it (never overlapping) when content is tall enough to need scrolling.
  const legalLinks = `<div class="auth-legal-links"><a href="privacy.html" target="_blank" rel="noopener">Privacy Policy</a> · <a href="terms.html" target="_blank" rel="noopener">Terms of Service</a> · <a href="help.html" target="_blank" rel="noopener">Help &amp; FAQ</a></div>`;
  if(AUTH_MODE==='landing'){
    // .auth-hero-wrap (flex:1, css/style.css) fills the space above the footer and centers
    // the single-fold hero content vertically inside it.
    el.innerHTML = `<div class="auth-page"><div class="auth-hero-wrap">${authLandingHtml()}</div>${legalLinks}</div>`;
    animateAuthLandingIn();
  } else if(AUTH_MODE==='oauth-consent'){
    // Any previously-scheduled "flip to expired" timer belongs to whatever was rendered last -
    // always cleared here, at the top of every render, so it never fires against a screen this
    // call is about to replace (a stale timer re-triggering this same branch after the user has
    // already moved on, e.g. to 'landing', would otherwise yank them back to a consent screen
    // they'd already left).
    if(OAUTH_CONSENT_EXPIRY_TIMER){ clearTimeout(OAUTH_CONSENT_EXPIRY_TIMER); OAUTH_CONSENT_EXPIRY_TIMER = null; }
    const msUntilExpiry = OAUTH_REQUEST.consentExpiresAt ? OAUTH_REQUEST.consentExpiresAt - Date.now() : null;
    const isExpired = msUntilExpiry !== null && msUntilExpiry <= 0;
    if(isExpired){
      // A lapsed request is a dead end, on purpose - Allow/Deny would just fail server-side
      // anyway (verifyConsentToken() rejects it), and showing them next to an error reads as if
      // retrying might work. No account row either - nothing about this account's connection was
      // ever completed, so there's nothing account-specific left to show.
      el.innerHTML = `<div class="auth-page"><div class="auth-box">
        <h2>Connection request expired</h2>
        <div class="auth-message auth-message-error">This request to connect ${esc(OAUTH_REQUEST.clientName)} is no longer valid - it's been more than 10 minutes since it was opened. Start the connection again from ${esc(OAUTH_REQUEST.clientName)} to get a fresh link.</div>
        <a href="#" class="auth-back-link" data-action="switch-landing">&larr; Back to DraftShelf</a>
      </div>
      ${legalLinks}</div>`;
    } else {
      // No back link (same reasoning 'reset' already has -- arrived at via a redirect carrying
      // real intent, not a choice mid-flow) and its own body, not authFieldsHtml()/
      // authFooterHtml() -- this isn't a credential form, so it doesn't fit that shape.
      el.innerHTML = `<div class="auth-page"><div class="auth-box">
        <h2>Connect ${esc(OAUTH_REQUEST.clientName)}</h2>
        <p class="oauth-consent-desc">This will let <b>${esc(OAUTH_REQUEST.clientName)}</b> read and edit your DraftShelf Library and Versions, on your behalf, until you disconnect it.</p>
        <div class="oauth-consent-account">Connecting as <b>${esc(OAUTH_SESSION.user.email)}</b></div>
        ${AUTH_MESSAGE ? `<div class="auth-message auth-message-${AUTH_MESSAGE.kind}">${esc(AUTH_MESSAGE.text)}</div>` : ''}
        <button class="btn btn-brass auth-submit" data-action="oauth-allow">Allow</button>
        <button class="btn btn-ghost auth-submit" data-action="oauth-deny">Deny</button>
        <p class="oauth-consent-expiry">${esc(oauthConsentExpiryLabel(OAUTH_REQUEST.consentExpiresAt))}</p>
      </div>
      ${legalLinks}</div>`;
      if(msUntilExpiry !== null){
        OAUTH_CONSENT_EXPIRY_TIMER = setTimeout(()=>{
          OAUTH_CONSENT_EXPIRY_TIMER = null;
          if(AUTH_MODE==='oauth-consent') renderAuthScreen();
        }, msUntilExpiry + 250); // +250ms so Date.now() at the next render is unambiguously past expiry, not equal to it
      }
    }
  } else {
    // A small "Back" link on every form screen except 'reset' (arrived at only via a real
    // recovery email, not a choice -- there's no sensible "back" target mid-password-reset).
    const backLink = AUTH_MODE==='reset' ? '' : `<a href="#" class="auth-back-link" data-action="switch-landing">&larr; Back</a>`;
    el.innerHTML = `<div class="auth-page"><div class="auth-box">
      ${backLink}
      <h2>${esc(titles[AUTH_MODE])}</h2>
      ${AUTH_MESSAGE ? `<div class="auth-message auth-message-${AUTH_MESSAGE.kind}">${esc(AUTH_MESSAGE.text)}</div>` : ''}
      ${authFieldsHtml()}
      ${authFooterHtml()}
    </div>
    ${legalLinks}</div>`;
  }
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  el.classList.add('active');
  document.querySelectorAll('.nav button').forEach(b=>b.classList.remove('active'));
  VIEW = 'auth';
  // Topbar Sign in/Create account are redundant (and read as confusing) while already on one
  // of these screens -- a real, reported gap. Swapped for a close (X) back to the homepage,
  // same action the in-box "<- Back" link already uses -- except in 'reset' mode, which shows
  // neither (same reasoning the in-box back link already has: arrived at only via a real
  // recovery email, there's no sensible "back"/"close" target to offer).
  const onLanding = AUTH_MODE==='landing';
  document.getElementById('btnTopbarSignIn').style.display = onLanding ? '' : 'none';
  document.getElementById('btnTopbarSignUp').style.display = onLanding ? '' : 'none';
  document.getElementById('btnTopbarClose').style.display = (!onLanding && AUTH_MODE!=='reset' && AUTH_MODE!=='oauth-consent') ? '' : 'none';
}
// A real, reported gap, arguably the single most important place in the app to have loading
// feedback: none of these buttons showed anything at all while awaiting Supabase -- clicking
// "Sign in"/"Create account"/etc just sat there frozen until the network call resolved, on the
// very first interaction anyone has with this app. withTextButtonLoading() swaps the label
// (not a bare spinner -- a labeled button going icon-only mid-click would read as broken) and
// restores it in .finally(); harmless even when the branch also calls renderAuthScreen() (which
// replaces `el` with a freshly rendered, already-correctly-labeled button of its own -- the
// .finally() cleanup on the now-detached old node is then just a no-op, not a conflict).
async function onAuthClick(ev){
  const el = ev.target.closest('[data-action]'); if(!el) return;
  ev.preventDefault();
  const action = el.dataset.action;
  if(action==='switch-signin' || action==='switch-signup' || action==='switch-forgot' || action==='switch-magic' || action==='switch-landing'){
    AUTH_MODE = action.replace('switch-',''); AUTH_MESSAGE = null; renderAuthScreen(); return;
  }
  if(action==='oauth-google' || action==='oauth-github'){
    const provider = action.replace('oauth-','');
    // Full-page redirect (Supabase's own default OAuth flow, not a popup) -- the browser
    // navigates away to the provider's consent screen and back; the same onAuthStateChange
    // listener in init() picks up the resulting session exactly like a password sign-in does,
    // no separate "OAuth session" handling needed anywhere else in the app.
    await withTextButtonLoading(el, 'Redirecting…', (async()=>{
      const { error } = await window.supabase.auth.signInWithOAuth({ provider, options:{ redirectTo: window.location.origin+window.location.pathname } });
      if(error){ AUTH_MESSAGE = { kind:'error', text:error.message }; renderAuthScreen(); }
    })());
    return;
  }
  if(action==='submit-signin'){
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    await withTextButtonLoading(el, 'Signing in…', (async()=>{
      const { error } = await window.supabase.auth.signInWithPassword({ email, password });
      if(error){ AUTH_MESSAGE = { kind:'error', text:error.message }; renderAuthScreen(); }
      // On success, the onAuthStateChange listener wired in init() picks up the new
      // session and transitions to the dashboard -- no manual redirect needed here.
    })());
    return;
  }
  if(action==='submit-signup'){
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    await withTextButtonLoading(el, 'Creating account…', (async()=>{
      const { error } = await window.supabase.auth.signUp({ email, password });
      if(error) AUTH_MESSAGE = { kind:'error', text:error.message };
      else { AUTH_MESSAGE = { kind:'info', text:'Check your email to confirm your account, then sign in.' }; AUTH_MODE='signin'; }
      renderAuthScreen();
    })());
    return;
  }
  if(action==='submit-forgot'){
    const email = document.getElementById('authEmail').value.trim();
    await withTextButtonLoading(el, 'Sending…', (async()=>{
      // rf:ui:lastAuthLinkType -- device-local, tier-2 KV-style state (not worth a real KV key
      // for one flag) -- purely so init()'s own "your link didn't work" fallback message (see
      // below) can say the right thing when the link that failed carried no distinguishing
      // `type=` param at all (the otp_expired/prefetched-link shape -- see that comment).
      // Recovery is still the default assumption if this was never set, matching every account
      // that used this flow before magic-link existed.
      localStorage.setItem('rf:ui:lastAuthLinkType', 'recovery');
      const { error } = await window.supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin+window.location.pathname });
      AUTH_MESSAGE = error ? { kind:'error', text:error.message } : { kind:'info', text:'Check your email for a reset link.' };
      renderAuthScreen();
    })());
    return;
  }
  if(action==='submit-magic'){
    const email = document.getElementById('authEmail').value.trim();
    await withTextButtonLoading(el, 'Sending…', (async()=>{
      localStorage.setItem('rf:ui:lastAuthLinkType', 'magiclink');
      // emailRedirectTo, not redirectTo -- signInWithOtp()'s own option name (resetPasswordForEmail()
      // above uses redirectTo; both ultimately just set where the emailed link sends the browser).
      const { error } = await window.supabase.auth.signInWithOtp({ email, options:{ emailRedirectTo: window.location.origin+window.location.pathname } });
      AUTH_MESSAGE = error ? { kind:'error', text:error.message } : { kind:'info', text:'Check your email for a sign-in link - open it in this same browser.' };
      renderAuthScreen();
    })());
    return;
  }
  if(action==='submit-reset'){
    const password = document.getElementById('authPassword').value;
    await withTextButtonLoading(el, 'Updating…', (async()=>{
      const { error } = await window.supabase.auth.updateUser({ password });
      AUTH_MESSAGE = error ? { kind:'error', text:error.message } : { kind:'info', text:'Password updated - signing you in.' };
      renderAuthScreen();
    })());
    return;
  }
  if(action==='oauth-allow' || action==='oauth-deny'){
    // POSTs to mcp-remote-auth's own /authorize (already the verified, spec-compliant
    // endpoint -- see supabase/functions/mcp-remote-auth/index.ts) carrying OAUTH_SESSION's
    // real access token as a Bearer header (never a client-supplied user id) plus the
    // consent_token minted when this request was first redirected here, the CSRF guard on
    // this exact action -- see that file's own header comment for why both exist together.
    await withTextButtonLoading(el, action==='oauth-allow' ? 'Connecting…' : 'Declining…', (async()=>{
      try{
        const res = await fetch(window.supabase.supabaseUrl+'/functions/v1/mcp-remote-auth/authorize', {
          method:'POST',
          headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer '+OAUTH_SESSION.access_token },
          body: JSON.stringify({
            client_id: OAUTH_REQUEST.clientId,
            redirect_uri: OAUTH_REQUEST.redirectUri,
            code_challenge: OAUTH_REQUEST.codeChallenge,
            state: OAUTH_REQUEST.state,
            consent_token: OAUTH_REQUEST.consentToken,
            action: action==='oauth-allow' ? 'allow' : 'deny',
          }),
        });
        const body = await res.json();
        if(!res.ok || !body.redirect_to){
          AUTH_MESSAGE = { kind:'error', text: body.error_description || body.error || 'Something went wrong - please try connecting again.' };
          renderAuthScreen();
          return;
        }
        window.location.href = body.redirect_to;
      } catch(e){
        AUTH_MESSAGE = { kind:'error', text:'Network error, please try again.' };
        renderAuthScreen();
      }
    })());
    return;
  }
}
// Shared by both places init() can discover a real session while OAUTH_REQUEST is pending (an
// already-signed-in visitor, and a visitor who just signed in through the form this same
// pending request forced them into) -- see OAUTH_REQUEST's own var declaration for why this
// exists instead of loadAuthedAppState()'s normal Dashboard landing.
function showOAuthConsent(session){
  OAUTH_SESSION = session;
  AUTH_MODE = 'oauth-consent';
  AUTH_MESSAGE = null;
  document.getElementById('topbarAuthedControls').style.display = 'none';
  document.getElementById('topbarSignedOut').style.display = 'none';
  document.querySelector('.topbar').classList.remove('is-authed');
  renderAuthScreen();
}
async function signOut(){
  await window.supabase.auth.signOut();
  // onAuthStateChange's SIGNED_OUT handling resets app state and shows the auth screen.
}

// Mobile/tablet nav (below ~900px, see css/style.css's own comment) -- #topbarAuthedControls
// itself doubles as the collapsible panel, toggled via the .mobile-open class the CSS
// breakpoint keys off. closeMobileMenu() is safe to call unconditionally (a no-op above the
// breakpoint, where the class has no effect at all) -- switchView() calls it on every
// navigation so picking Dashboard/Library/Cover Letter/Preferences/the Continue-editing pill
// from the open menu closes it, rather than leaving the panel covering the screen.
function closeMobileMenu(){
  const el = document.getElementById('topbarAuthedControls');
  if(el) el.classList.remove('mobile-open');
}

function closeSettingsMenu(){
  const dd = document.getElementById('settingsDropdown');
  if(dd) dd.style.display = 'none';
}
// position:fixed, anchored via a JS-computed bounding rect at open time -- a real, reported
// bug: with position:absolute (relative to .settings-menu-wrap, inside .topbar) the dropdown
// rendered behind/overlapping the editor's .stage-controls ("Download PDF/DOCX", position:
// sticky inside .view.active's own overflow:auto scroll container) even at z-index:9999.
// Bumping the z-index further didn't fix it either -- position:absolute stacking is compared
// within whatever stacking context each element's ancestors establish, and something in that
// ancestor chain was putting .settings-dropdown at a real disadvantage no z-index value could
// out-rank. position:fixed sidesteps the ambiguity entirely: it escapes every ancestor's
// stacking/overflow context (short of an ancestor using transform/filter/will-change, which
// none of ours do) and is compared directly at the viewport root -- the exact same technique
// .gh-modal-overlay/.entry-edit-modal-overlay already rely on to guarantee they render above
// everything, just anchored to a button's position instead of centered full-viewport.
function positionSettingsDropdown(){
  const btn = document.getElementById('btnSettingsMenu');
  const dd = document.getElementById('settingsDropdown');
  if(!btn || !dd) return;
  const rect = btn.getBoundingClientRect();
  const ddWidth = dd.getBoundingClientRect().width || 240; // matches .settings-dropdown's CSS width
  // Right-aligned to the gear button by default (matches the desktop look, where the button
  // sits at the far right of the topbar), but clamped to stay fully inside the viewport --
  // a real, reported bug: inside the mobile nav panel (see css/style.css's own comment on
  // #topbarAuthedControls.mobile-open) the gear button sits far to the *left*, and the old
  // right-edge-relative math pushed the dropdown mostly off the left side of the screen.
  // left (not right) is used for the actual positioning specifically so clamping is a single
  // straightforward Math.min/max on one axis, not two interacting offsets.
  let left = rect.right - ddWidth;
  left = Math.max(8, Math.min(left, window.innerWidth - ddWidth - 8));
  dd.style.top = (rect.bottom + 8) + 'px';
  dd.style.left = left + 'px';
  dd.style.right = 'auto';
}

/* ===== view switching ===== */
// A version stays open in CURRENT_VERSION while browsing Library/Preferences/Cover Letter --
// only openEditor() (a *different* document), sign-out, JSON import, or navigating to
// Dashboard (see below) clear it. switchView('editor') here is how the nav's "Continue
// Editing" button gets back to it: renders from the already-in-memory CURRENT_VERSION,
// no DB refetch, so nothing risks clobbering an edit the debounced autosave hasn't
// flushed yet.
function switchView(view, navMode){
  closeMobileMenu(); // no-op above the mobile breakpoint -- see its own comment
  if(view==='editor' && !CURRENT_VERSION) view = 'dashboard';
  // Dashboard closes the open version, like closing a document -- a real, reported UX
  // complaint: the "Continue editing" pill hides *on* Dashboard (see updateNavResumeButton())
  // but CURRENT_VERSION itself used to stay populated in the background, so it silently
  // reappeared the moment you left Dashboard for Library/Preferences/Cover Letter even
  // though, from the user's perspective, they'd already left the editor behind at Dashboard.
  // flushVersionSave() runs first so a same-second edit (made less than 900ms before
  // navigating away) still gets persisted instead of silently lost when CURRENT_VERSION goes
  // null out from under the pending debounced save.
  if(view==='dashboard' && CURRENT_VERSION){
    flushVersionSave();
    CURRENT_VERSION = null;
    clearVersionHistory();
  }
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  const el = document.getElementById('view'+view.charAt(0).toUpperCase()+view.slice(1));
  if(el) el.classList.add('active');
  document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active', b.dataset.view===view));
  // Preferences lives in the settings dropdown now, not .nav -- mirror the same active-state
  // convention there so it doesn't look unselected while actually being the current view.
  const settingsBtn = document.getElementById('btnSettingsMenu');
  if(settingsBtn) settingsBtn.classList.toggle('active', view==='preferences');
  VIEW = view;
  if(view==='dashboard') renderDashboard();
  if(view==='library'){ renderLibrary(); refreshLibraryUsageIndex(); }
  if(view==='preferences') renderPreferences();
  if(view==='coverLetter') renderCoverLetter();
  if(view==='editor') renderEditor();
  if(view==='importReview') renderImportReviewView();
  updateNavResumeButton();
  focusActiveView(el);
  updateRoute(view, null, navMode);
}
// A real accessibility gap: navigating never moved keyboard focus anywhere -- a keyboard user
// clicking a nav tab kept focus on the button they just clicked (now hidden behind whatever
// re-rendered), and a screen-reader user got no signal a navigation happened at all. Every
// .view element carries tabindex="-1" (index.html) specifically so it's a valid programmatic
// focus target without ever joining the normal Tab order (a real user should never *tab* their
// way onto a bare container div -- this is only ever set via script, right after a navigation).
// preventScroll:true because focusing the view's own outer container -- which is already
// sitting at the top of its own scroll position after a fresh render -- has no reason to also
// trigger the browser's default "scroll the focused element into view" behavior.
// switchView('auth') deliberately skips this (the auth screen already manages its own focus
// inside whichever form is showing; stealing focus from an in-progress sign-in field back to
// the outer container would be actively worse, not better).
function focusActiveView(el){
  if(el && el.id!=='viewAuth') el.focus({preventScroll:true});
}
// Shared "show a spinner on this icon-only button while an async action runs" helper --
// swaps in a spinner, disables the button, sets aria-busy, and restores everything in a
// .finally() regardless of outcome. Factored out of onDashboardCardClick()'s own original
// inline version (the "edit" action, the first real, reported case of this) once the same
// pattern needed to be applied to several more buttons across the app -- one implementation
// instead of copy-pasting the same six lines each time. Deliberately for *icon-only* buttons
// (the spinner fully replaces the button's content, same as the original) -- a labeled text
// button (e.g. "Sign in") uses withTextButtonLoading() below instead, which swaps the label
// text rather than blanking it, so the button never goes empty/unlabeled mid-action.
function withButtonSpinner(btn, promise){
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.setAttribute('aria-busy', 'true');
  btn.innerHTML = '<span class="spinner"></span>';
  return promise.finally(()=>{
    btn.disabled = false;
    btn.removeAttribute('aria-busy');
    btn.innerHTML = originalHtml;
  });
}
// Same idea, for a labeled text button (Sign in, Create account, Save, etc.) -- swaps the
// label to `loadingText` instead of a bare spinner, since a text button going icon-only mid-
// click would read as broken/empty rather than "working on it." Restores the exact original
// label in .finally(), same guarantee withButtonSpinner() makes.
function withTextButtonLoading(btn, loadingText, promise){
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.setAttribute('aria-busy', 'true');
  btn.textContent = loadingText;
  return promise.finally(()=>{
    btn.disabled = false;
    btn.removeAttribute('aria-busy');
    btn.textContent = originalText;
  });
}
// UI/UX audit finding: the GitHub Backup, entry-edit, and PDF-fallback modals all share the
// same shape (position:fixed;inset:0 overlay + a centered box) and none of them fade or scale
// in -- they're just present or absent. One shared function instead of three separate CSS
// animation declarations, since it's the exact same visual treatment in every case. GSAP here
// specifically (not the CSS-only view-fade-in keyframe used for view/dropdown/tab transitions
// elsewhere in this app) because the overlay and box need two different, staggered fromTo
// animations at once (the scrim fades, the box fades+scales+rises), which is awkward to
// express as a single CSS @keyframes without either two separate animation names on two
// elements (fine, but then the box's "starts slightly below and scaled down" entrance needs
// its own transform math duplicated in CSS anyway) or accepting a flatter, less considered
// motion. Guarded the same way flipThemeToggleIcon() is -- degrades to an instant, unanimated
// appearance (exactly today's behavior) if GSAP hasn't loaded from its CDN yet, never throws.
function animateModalIn(overlayEl){
  if(!overlayEl || typeof gsap==='undefined') return;
  const box = overlayEl.querySelector('.gh-modal-box, .entry-edit-modal-box, .pdf-fallback-box');
  gsap.fromTo(overlayEl, { opacity:0 }, { opacity:1, duration:0.2, ease:'power1.out' });
  if(box) gsap.fromTo(box, { opacity:0, scale:0.96, y:8 }, { opacity:1, scale:1, y:0, duration:0.25, ease:'power2.out' });
}
// Every other animation in this app respects prefers-reduced-motion via a CSS media query
// override (see the .view-fade-in/.spinner/.lib-panel-fade rules, css/style.css) -- this is
// the first one driven entirely from JS (GSAP timelines/loops can't be paused by a CSS media
// query the way a plain @keyframes animation can), so it needs its own JS-side check.
function prefersReducedMotion(){
  return typeof window.matchMedia==='function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
// A one-time entrance sequence for the homepage's single fold (headline, subhead, CTAs, then
// the library/page demo), on request ("add required animations to the home page"). One
// orchestrated GSAP timeline rather than several independent animations landing at once --
// "an orchestrated moment lands harder than scattered effects" is the same principle this
// app's modal-entrance animation already follows (see animateModalIn() above). Guarded the
// same way every other GSAP call site in this file is: a CDN load failure or
// prefers-reduced-motion simply skips straight to the final, fully-visible state (nothing
// here ever depends on the animation having played), never a thrown error or stuck-invisible
// element.
function animateAuthLandingIn(){
  const copy = document.querySelectorAll('.auth-landing-copy > *');
  const demo = document.querySelector('.auth-hero-demo');
  if(typeof gsap==='undefined' || prefersReducedMotion()) return;
  const tl = gsap.timeline();
  tl.from(copy, { opacity:0, y:16, duration:0.5, ease:'power2.out', stagger:0.09 });
  if(demo) tl.from(demo, { opacity:0, y:16, scale:0.98, duration:0.5, ease:'power2.out' }, '-=0.3');
}
function updateNavResumeButton(){
  const btn = document.getElementById('navResumeEditor');
  if(!btn) return;
  // CURRENT_VERSION is null on Dashboard by construction now -- switchView() itself closes
  // the open version there (see its own comment) -- so the `VIEW!=='dashboard'` check below
  // is belt-and-suspenders, not the primary guard. Still shown from Library/Preferences/
  // Cover Letter, where the open version isn't visible any other way.
  if(CURRENT_VERSION && VIEW!=='editor' && VIEW!=='dashboard'){
    btn.style.display = '';
    btn.textContent = 'Continue editing: '+(CURRENT_VERSION.name||'Untitled version');
  } else {
    btn.style.display = 'none';
  }
}

/* ===== account-level preferences (user_preferences table) -- defaults applied to every
   new version, synced across devices. Deliberately separate from KV's device-local UI
   state (last-opened tab/version), which never touches Supabase -- see the migration
   plan's account-vs-device preference split. ===== */
const PREF_SECTION_LABELS = {experience:'Work Experience', projects:'Projects', education:'Education', skills:'Skills', references:'References'};
// Self-healing, same idea as resolveSectionOrder() for a version's own order: start from
// whatever's saved (or the 5 built-ins if nothing's saved yet), then append any custom
// section not already present. This is what lets a just-created custom section show up
// here immediately, without the user having to first reorder something to "materialize"
// the array. Shared by prefSectionOrderHtml() (render) and onPreferencesClick() (the move
// handler) so the two can't drift -- and by applyPreferenceDefaults() so a brand-new
// version gets this same healed order even if PREFERENCES.export_prefs.sectionOrder was
// never explicitly saved.
function prefEffectiveSectionOrder(){
  const p = PREFERENCES || {};
  const order = (p.export_prefs && Array.isArray(p.export_prefs.sectionOrder)) ? p.export_prefs.sectionOrder.slice() : BUILTIN_SECTION_ORDER.slice();
  (LIBRARY.customSections||[]).forEach(cs=>{ const tok='custom:'+cs.id; if(!order.includes(tok)) order.push(tok); });
  return order;
}
function prefSectionOrderHtml(){
  const order = prefEffectiveSectionOrder();
  return order.map(tok=>{
    let label;
    if(tok.indexOf('custom:')===0){
      const cs = LIBRARY.customSections.find(c=>c.id===tok.slice(7));
      if(!cs) return ''; // stale token for a since-deleted custom section -- skip, same tolerance every other dangling reference in this app already has
      label = cs.heading || '(untitled custom section)';
    } else {
      label = PREF_SECTION_LABELS[tok]||tok;
    }
    return `<div class="sel-item">
    <div class="sel-head">
      <label>${esc(label)}</label>
      <div class="move-btns"><button data-action="move-pref-section" data-token="${esc(tok)}" data-dir="up">${ICONS.chevronUp}</button><button data-action="move-pref-section" data-token="${esc(tok)}" data-dir="down">${ICONS.chevronDown}</button></div>
    </div>
  </div>`;
  }).join('');
}
// Full-width, two-column layout (.prefs-columns, css/style.css) -- the third design tried here.
// Attempt 1 (.prefs-grid, a single row of References mode/Default section order/Import review
// defaults with align-items:start) left a ragged, uneven bottom edge across the row -- those
// three blocks have very different natural content heights. Attempt 2 (same row, switched to
// align-items:stretch) fixed the raggedness but made it worse in a different way: the shorter/
// collapsed cards got stretched into mostly empty boxes ("lot of empty things"). This version,
// suggested directly, drops the single-row idea entirely: Default style -- by far the most
// fields of any block here -- gets its own column, and the other three (References mode,
// Default section order, Import review defaults) stack together in the second column. This
// isn't a new layout risk for Default style specifically: stylePanelHtml() already renders at
// almost exactly this width in the per-version editor's own left panel (.editor-layout's
// minmax(360px,440px) column) and already reads fine there, so giving it a matching half-width
// column here reuses a combination already proven to work rather than guessing. The second
// column's three stacked items again use no forced equal-height trick (align-items:start on the
// outer grid, plain vertical stacking inside the column) -- each is exactly as tall as its own
// content, so the "empty box" problem attempt 2 had can't recur here either.
//
// Import review defaults starts open (it didn't in the original single-column design) --
// collapsed was fine as the last item in a long vertical stack (closed just meant less scroll),
// but sitting in a column of otherwise-open content, a closed panel reads as broken/empty rather
// than intentionally condensed.
function renderPreferences(){
  const el = document.getElementById('viewPreferences');
  const p = PREFERENCES || {};
  const st = p.default_style || defaultStyle();
  el.innerHTML = `<div>
    <h2 style="margin-top:0;">Preferences</h2>
    <p style="font-size:12px;color:var(--text-muted);">Account-level defaults applied whenever you create a new version. These sync across every device you sign into.</p>
    <div class="prefs-columns" style="margin-top:16px;">
      <details class="ed-block" open style="margin:0;"><summary>Default style</summary>${stylePanelHtml(st, 'default_style', p.default_page_size||'A4', 'default_page_size', true)}</details>
      <div>
        <div class="entry" style="margin:0;">
          <div class="field"><label>Default references mode</label><select data-pref="default_references_mode">
            <option value="full" ${(p.default_references_mode||'full')==='full'?'selected':''}>Full list</option>
            <option value="onrequest" ${p.default_references_mode==='onrequest'?'selected':''}>Available upon request</option>
            <option value="none" ${p.default_references_mode==='none'?'selected':''}>None</option>
          </select></div>
        </div>
        <details class="ed-block" open style="margin:0;"><summary>Default section order</summary>${prefSectionOrderHtml()}</details>
        <details class="ed-block" open style="margin:0;"><summary>Import review defaults</summary>${importReviewDefaultsPrefHtml()}</details>
      </div>
    </div>
  </div>`;
  equalizePrefsColumnHeights();
}
// A real, reported problem with a first attempt at this: a hardcoded padding-bottom tuned to
// close the gap for one representative test account overshot on a real account whose stacked
// column (References mode + Default section order + Import review defaults) rendered a
// different real height -- Default style's own field count is fixed, but that column's height
// depends on account-specific data (how many custom sections exist, etc.), so any single fixed
// pixel value is only ever correct for the exact content it was tuned against. This measures
// both columns' real rendered heights after every render instead and pads whichever one is
// shorter by exactly the real difference -- correct for any account's actual content, not just
// the one it happened to be tested against. Called at the end of renderPreferences() (both on
// initial render and after reordering Default section order, the one interaction that calls
// renderPreferences() again -- see onPreferencesClick()); every other field edit here
// (onPreferencesEvent()) writes straight into PREFERENCES without a full re-render, so it can't
// desync the two columns' relative heights between calls. Resets any previous run's padding
// before re-measuring so repeated calls don't compound onto themselves.
function equalizePrefsColumnHeights(){
  const cols = document.querySelector('#viewPreferences .prefs-columns');
  if(!cols || cols.children.length!==2) return;
  const [a, b] = cols.children;
  a.style.paddingBottom = '';
  b.style.paddingBottom = '';
  const aRect = a.getBoundingClientRect(), bRect = b.getBoundingClientRect();
  // .prefs-columns collapses to one column below 900px (css/style.css) -- when that's active,
  // a/b stack vertically instead of sitting side by side, and there's nothing to equalize
  // (padding the first one would just insert a pointless gap before the second). A shared top
  // edge is what "actually side by side" means here; jsdom's real-layout gap (every rect is
  // {0,0,0,0}) also naturally short-circuits on this check, same as the diff<2 guard below.
  if(Math.abs(aRect.top - bRect.top) > 4) return;
  const diff = Math.round(Math.abs(aRect.height - bRect.height));
  if(diff < 2) return; // near enough already -- not worth padding a couple of stray pixels
  const shorter = aRect.height < bRect.height ? a : b;
  // A real bug caught while verifying this live: setting style.paddingBottom directly to `diff`
  // REPLACES .ed-block's own existing bottom padding (12px, from its padding:12px 14px
  // shorthand) rather than adding to it, so the box only ever grew by diff-12px, not the full
  // diff -- confirmed live, a 135px diff only closed 123px of the actual gap. Reading the
  // element's current computed bottom padding first and adding diff on top of it (not
  // replacing it) is what actually closes the gap by the intended amount.
  const basePaddingBottom = parseFloat(getComputedStyle(shorter).paddingBottom) || 0;
  shorter.style.paddingBottom = (basePaddingBottom + diff) + 'px';
}
// Which sections start switched on when "Review & merge" (Import JSON's guided merge path)
// opens -- see js/06_app.js's openImportReview(). Stored inside the same pre-existing
// export_prefs jsonb column sectionOrder already lives in (not a new database column), via
// the existing generic data-path save mechanism onPreferencesEvent() already handles for any
// nested field -- no new event-handling code needed.
// Two columns of checkboxes (bold-toggles' own class, reused as-is -- same "wide checkbox
// grid" component Default style's own Bold fields row already uses) instead of one full-width
// row per kind -- halves this block's height, which is most of what closed the remaining gap
// between Preferences' two columns once Default style itself became compact (see
// renderPreferences()'s comment).
function importReviewDefaultsPrefHtml(){
  const p = PREFERENCES || {};
  const saved = (p.export_prefs && p.export_prefs.importReviewDefaults) || {};
  return `<p style="font-size:12px;color:var(--text-muted);margin:0 0 8px;">Which sections start switched on when you use "Review &amp; merge" on an import. Education and Skills default off.</p>
  <div class="bold-toggles">${IMPORT_REVIEW_KINDS.map(kind=>{
    const checked = saved[kind]!==undefined ? saved[kind] : importReviewSectionDefault(kind);
    return `<label class="chk chk-card"><input type="checkbox" data-path="export_prefs.importReviewDefaults.${kind}" ${checked?'checked':''}><span>${esc(IMPORT_REVIEW_KIND_LABELS[kind])}</span></label>`;
  }).join('')}</div>`;
}
const scheduleSavePreferences = debounce(async ()=>{
  const res = await DB.savePreferences({
    default_page_size: PREFERENCES.default_page_size,
    default_style: PREFERENCES.default_style || null,
    default_references_mode: PREFERENCES.default_references_mode,
    export_prefs: PREFERENCES.export_prefs || {}
  });
  toast(res.ok ? 'Preferences saved' : 'Could not save preferences');
}, 600);
function onPreferencesEvent(ev){
  const t = ev.target;
  if(t.dataset.path){
    if(!PREFERENCES) PREFERENCES = {};
    // Materialize a full style object on first touch -- setPath() alone would only ever
    // create the single field being written (e.g. {fsName:16}), and a partial style object
    // saved as the account default would leave every *other* field undefined on every new
    // version created afterward, not just unspecified.
    if(t.dataset.path.startsWith('default_style.') && !PREFERENCES.default_style){
      PREFERENCES.default_style = defaultStyle();
    }
    let val;
    if(t.type==='checkbox') val = t.checked;
    else if(t.type==='number') val = parseFloat(t.value);
    else val = t.value;
    setPath(PREFERENCES, t.dataset.path, val);
    scheduleSavePreferences();
    return;
  }
  if(!t.dataset.pref) return;
  if(!PREFERENCES) PREFERENCES = {};
  PREFERENCES[t.dataset.pref] = t.value;
  scheduleSavePreferences();
}
function onPreferencesClick(ev){
  const btn = ev.target.closest('button[data-action="move-pref-section"]');
  if(!btn) return;
  if(!PREFERENCES) PREFERENCES = {};
  if(!PREFERENCES.export_prefs) PREFERENCES.export_prefs = {};
  const order = prefEffectiveSectionOrder();
  const i = order.indexOf(btn.dataset.token); if(i<0) return;
  const j = btn.dataset.dir==='up' ? i-1 : i+1;
  if(j<0 || j>=order.length) return;
  [order[i],order[j]] = [order[j],order[i]];
  PREFERENCES.export_prefs.sectionOrder = order;
  scheduleSavePreferences();
  renderPreferences();
}
function applyPreferenceDefaults(v){
  if(!PREFERENCES) return v;
  if(PREFERENCES.default_style){
    v.style = {...v.style, ...PREFERENCES.default_style, bold:{...v.style.bold, ...(PREFERENCES.default_style.bold||{})}};
  } else if(PREFERENCES.default_font_family){
    // Backward compat: an account that only ever set the old flat field (before default_style
    // existed) still gets its font family honored, without needing to re-save anything.
    v.style.fontFamily = PREFERENCES.default_font_family;
  }
  if(PREFERENCES.default_page_size) v.pageSize = PREFERENCES.default_page_size;
  if(PREFERENCES.default_references_mode) v.referencesMode = PREFERENCES.default_references_mode;
  v.sectionOrder = prefEffectiveSectionOrder();
  return v;
}

/* ===== cover letter -- a separate, self-contained tool bolted onto the app. Deliberately
   NOT part of the Library/Version/Supabase data model: COVER_LETTER is a plain in-memory
   object that lives only for this browser session (kept across tab switches so a draft
   survives clicking to Library and back, but never written to KV or Supabase -- gone on
   reload or sign-out). Header/contact fields pre-fill once from LIBRARY.meta the first time
   the tab is opened, then become independently editable per letter without touching the
   saved Library data (e.g. tailoring the name format or dropping a link for one specific
   application). The three typographic looks (Modern/Classic/Minimal) are intentionally
   separate from the resume's Style-panel system -- a cover letter is always exactly one
   page, so there's no pagination engine involved here at all. ===== */
/* ===== preview zoom (resume + cover letter, same mechanism for both) -- like Word: default
   is "Fit" (scaled to the available column width, recomputed on resize), +/- steps to a
   fixed percentage, clamped 30%-200%. .paper/.cl-paper always keep their true, natural
   print-size box; only a wrapping .zoom-wrap gets sized to the *visual* (scaled) footprint
   and the paper itself gets `transform:scale()` -- this is what keeps buildPrintHtml()'s
   clones always full-resolution regardless of viewing zoom (it explicitly resets transform
   on the clone, never the live element), and is why paginate()'s own measurement logic
   (which runs against the real, unscaled DOM in #measureHost) never needs to know zoom
   exists at all. */
var PREVIEW_ZOOM = { editor:'fit', coverLetter:'fit' };
var PREVIEW_ZOOM_RESOLVED = { editor:1, coverLetter:1 };
function applyPreviewZoom(pagesWrapId, zoomKey){
  const wrap = document.getElementById(pagesWrapId);
  if(!wrap) return;
  const zoomWraps = Array.from(wrap.children).filter(c=>c.classList.contains('zoom-wrap'));
  if(!zoomWraps.length) return;
  zoomWraps.forEach(zw=>{ zw.firstElementChild.style.transform = 'none'; });
  const naturalWidth = zoomWraps[0].firstElementChild.offsetWidth;
  const naturalHeight = zoomWraps[0].firstElementChild.offsetHeight;
  let factor = PREVIEW_ZOOM[zoomKey];
  if(factor==='fit'){
    // "Fit" means one whole page visible, like Word's "Fit Page" (not just "Fit Width") --
    // constrain by both the available width AND the available height of the scrollable
    // stage itself (minus its sticky controls bar), so a single page never needs vertical
    // scrolling to see its own bottom edge.
    const availableW = Math.max(100, wrap.clientWidth - 8);
    const stageEl = wrap.closest('.stage');
    let availableH = 600;
    if(stageEl){
      const controls = stageEl.querySelector('.stage-controls');
      const controlsH = controls ? controls.offsetHeight : 0;
      availableH = Math.max(100, stageEl.clientHeight - controlsH - 14);
    }
    factor = Math.min(availableW / naturalWidth, availableH / naturalHeight);
  }
  factor = Math.max(0.3, Math.min(2, factor));
  PREVIEW_ZOOM_RESOLVED[zoomKey] = factor;
  zoomWraps.forEach(zw=>{
    const paper = zw.firstElementChild;
    const w = paper.offsetWidth, h = paper.offsetHeight;
    paper.style.transformOrigin = 'top left';
    paper.style.transform = factor===1 ? 'none' : `scale(${factor})`;
    zw.style.width = (w*factor)+'px';
    zw.style.height = (h*factor)+'px';
  });
  const labelId = zoomKey==='editor' ? 'zoomLabel' : 'clZoomLabel';
  const fitBtnId = zoomKey==='editor' ? 'btnZoomFit' : 'clZoomFitBtn';
  const label = document.getElementById(labelId);
  if(label) label.textContent = Math.round(factor*100)+'%';
  const fitBtn = document.getElementById(fitBtnId);
  if(fitBtn) fitBtn.classList.toggle('active', PREVIEW_ZOOM[zoomKey]==='fit');
}
function wrapPagesForZoom(pagesWrapId){
  const wrap = document.getElementById(pagesWrapId);
  if(!wrap) return;
  Array.from(wrap.children).forEach(child=>{
    if(child.classList.contains('zoom-wrap')) return;
    const zw = document.createElement('div');
    zw.className = 'zoom-wrap';
    child.parentNode.insertBefore(zw, child);
    zw.appendChild(child);
  });
}
function stepZoom(zoomKey, pagesWrapId, delta){
  const current = PREVIEW_ZOOM_RESOLVED[zoomKey] || 1;
  const next = Math.round((current+delta)*20)/20; // snap to nearest 5%
  PREVIEW_ZOOM[zoomKey] = Math.max(0.3, Math.min(2, next));
  applyPreviewZoom(pagesWrapId, zoomKey);
}
function setFitZoom(zoomKey, pagesWrapId){
  PREVIEW_ZOOM[zoomKey] = 'fit';
  applyPreviewZoom(pagesWrapId, zoomKey);
}
// Trackpad pinch (and ctrl+scroll-wheel, the same browser signal) -- browsers expose pinch
// as a 'wheel' event with ctrlKey:true (there's no separate pinch DOM event on desktop);
// preventDefault() is required or the browser's own native page-zoom fires instead.
function pinchZoom(zoomKey, pagesWrapId, deltaY){
  const current = PREVIEW_ZOOM_RESOLVED[zoomKey] || 1;
  const next = current - deltaY * 0.012;
  PREVIEW_ZOOM[zoomKey] = Math.max(0.3, Math.min(2, next));
  applyPreviewZoom(pagesWrapId, zoomKey);
}
function wirePinchZoom(containerEl, zoomKey, pagesWrapId){
  if(!containerEl) return;
  containerEl.addEventListener('wheel', ev=>{
    if(!ev.ctrlKey) return;
    if(!ev.target.closest('.stage')) return;
    ev.preventDefault();
    pinchZoom(zoomKey, pagesWrapId, ev.deltaY);
  }, { passive:false });
}

var COVER_LETTER = null;
function todayFormatted(){
  return new Date().toLocaleDateString('en-AU', { day:'numeric', month:'long', year:'numeric' });
}
function ensureCoverLetter(){
  if(COVER_LETTER) return;
  const m = LIBRARY.meta;
  COVER_LETTER = {
    content:'', style:'modern', align:'justify',
    name:m.name||'', phone:m.phone||'', email:m.email||'', location:m.location||'',
    linkedin:m.linkedin||'', github:m.github||'', portfolio:m.portfolio||'',
    date: todayFormatted(), fileTag:''
  };
}
const SAMPLE_COVER_LETTER = `Dear Hiring Manager,

Re: [Role] position at [Company]

I'm writing to express my interest in the [Role] position at [Company]. [One or two sentences on why this role/company specifically.]

[A paragraph on relevant experience -- one concrete example with a measurable result works better than a general summary.]

[A short paragraph on what you'd bring to the team, or a shared value/interest with the company.]

I welcome the opportunity to discuss this further. Thank you for considering my application.

Yours sincerely,`;
function styleChipHtml(s, active){
  const label = s.charAt(0).toUpperCase()+s.slice(1);
  const swatchInner = s==='modern' ? '<div></div>' : s==='minimal' ? '<span>AA</span>' : '';
  return `<div class="style-chip ${active?'active':''}" data-cl-style="${s}">
    <div class="swatch ${s}">${swatchInner}</div>
    <div class="name">${label}</div>
  </div>`;
}
function renderCoverLetter(){
  ensureCoverLetter();
  const cl = COVER_LETTER;
  // A real, reported bug: this rebuilds the whole view's innerHTML (including the left
  // .ed-panel, the same scrollable container the style chips/sample/clear buttons all live
  // inside) on every call -- a fresh element always starts at scrollTop 0, so picking a style
  // while scrolled down to the Style panel silently snapped back to the top every time.
  // Captured before the rebuild and restored after, same "capture before, restore after"
  // pattern this app already uses elsewhere (e.g. the entry-edit modal's field-value
  // snapshot/restore across its own re-renders).
  const prevPanel = document.querySelector('#viewCoverLetter .ed-panel');
  const prevScrollTop = prevPanel ? prevPanel.scrollTop : 0;
  document.getElementById('viewCoverLetter').innerHTML = `<div class="editor-layout">
    <div class="ed-panel">
      <details class="ed-block" open><summary>Paste your letter</summary>
        <textarea data-cl="content" rows="14" placeholder="Dear Hiring Manager,

Re: Marketing Coordinator position

I'm writing to express my interest in...

Yours sincerely,">${esc(cl.content)}</textarea>
        <div style="display:flex;gap:8px;margin-top:10px;">
          <button class="btn btn-ghost btn-sm" data-cl-action="sample">Load an example</button>
          <button class="btn btn-ghost btn-sm" data-cl-action="clear">Clear</button>
        </div>
      </details>
      <details class="ed-block" open><summary>Your details</summary>
        <p style="font-size:11px;color:var(--text-muted);margin:0 0 10px;">Pre-filled from your Library header -- editable here per letter without changing your saved Library data.</p>
        <div class="field"><label>Your name</label><input type="text" data-cl="name" value="${esc(cl.name)}"></div>
        <div class="field-row">
          <div class="field"><label>Phone</label><input type="text" data-cl="phone" value="${esc(cl.phone)}"></div>
          <div class="field"><label>Email</label><input type="text" data-cl="email" value="${esc(cl.email)}"></div>
        </div>
        <div class="field"><label>Location</label><input type="text" data-cl="location" value="${esc(cl.location)}"></div>
        <div class="field-row">
          <div class="field"><label>LinkedIn</label><input type="text" data-cl="linkedin" value="${esc(cl.linkedin)}"></div>
          <div class="field"><label>GitHub</label><input type="text" data-cl="github" value="${esc(cl.github)}"></div>
        </div>
        <div class="field"><label>Portfolio</label><input type="text" data-cl="portfolio" value="${esc(cl.portfolio)}"></div>
        <div class="field-row">
          <div class="field"><label>Date</label><input type="text" data-cl="date" value="${esc(cl.date)}"></div>
          <div class="field"><label>File name</label><input type="text" data-cl="fileTag" placeholder="Acme-Marketing-Coordinator" value="${esc(cl.fileTag)}"></div>
        </div>
      </details>
      <details class="ed-block" open><summary>Style</summary>
        <div class="style-options">${['modern','classic','minimal'].map(s=>styleChipHtml(s, cl.style===s)).join('')}</div>
        <label class="chk chk-card" style="margin-top:10px;"><input type="checkbox" data-cl-align-toggle ${cl.align!=='left'?'checked':''}><span>Justify body text</span></label>
      </details>
    </div>
    <div class="stage">
      <div class="stage-controls">
        <div></div>
        <div class="zoom-controls">
          <button data-cl-action="zoom-out" title="Zoom out">&minus;</button>
          <button id="clZoomFitBtn" class="zoom-fit-btn ${PREVIEW_ZOOM.coverLetter==='fit'?'active':''}" data-cl-action="zoom-fit" title="Fit to width">Fit</button>
          <span class="zoom-label" id="clZoomLabel">100%</span>
          <button data-cl-action="zoom-in" title="Zoom in">+</button>
        </div>
        <button class="btn btn-brass" data-cl-action="download">Download PDF</button>
      </div>
      <div id="clPagesWrap"></div>
    </div>
  </div>`;
  const newPanel = document.querySelector('#viewCoverLetter .ed-panel');
  if(newPanel) newPanel.scrollTop = prevScrollTop;
  renderCoverLetterPreview();
}
function buildCoverLetterPaperNode(){
  const cl = COVER_LETTER;
  const wrap = document.createElement('div');
  wrap.className = 'cl-paper cl-'+cl.style;
  const header = document.createElement('div');
  if(cl.style==='minimal') header.className = 'cl-header';
  const nameEl = document.createElement('div'); nameEl.className='cl-name'; nameEl.textContent = cl.name || 'Your Name';
  header.appendChild(nameEl);
  const metaBlock = document.createElement('div'); metaBlock.className='cl-meta';
  const sep = ()=>document.createTextNode('   |   ');
  const contactItems = [cl.phone, cl.email].filter(Boolean);
  if(contactItems.length){
    const p = document.createElement('p');
    contactItems.forEach((t,i)=>{ if(i>0) p.appendChild(sep()); p.appendChild(document.createTextNode(t)); });
    metaBlock.appendChild(p);
  }
  const linkItems = [['LinkedIn',cl.linkedin],['GitHub',cl.github],['Portfolio',cl.portfolio]].filter(([,v])=>v);
  if(linkItems.length){
    const p = document.createElement('p');
    linkItems.forEach(([label,val],i)=>{
      if(i>0) p.appendChild(sep());
      const a = document.createElement('a');
      a.href = normalizeUrl(val); a.textContent = label; a.target = '_blank'; a.rel = 'noopener'; a.style.color = 'inherit';
      p.appendChild(a);
    });
    metaBlock.appendChild(p);
  }
  if(cl.location){ const p=document.createElement('p'); p.textContent=cl.location; metaBlock.appendChild(p); }
  header.appendChild(metaBlock);
  wrap.appendChild(header);
  if(cl.style==='modern'){ const rule=document.createElement('div'); rule.className='cl-rule'; wrap.appendChild(rule); }
  wrap.appendChild(Object.assign(document.createElement('div'), {className:'cl-spacer'}));
  const dateEl = document.createElement('p'); dateEl.className='cl-date'; dateEl.textContent = cl.date || todayFormatted();
  wrap.appendChild(dateEl);
  wrap.appendChild(Object.assign(document.createElement('div'), {className:'cl-spacer'}));
  const body = document.createElement('div'); body.className = 'cl-body';
  (cl.content||'').split(/\n\s*\n/).map(p=>p.trim()).filter(Boolean).forEach(p=>{
    const el = document.createElement('p'); el.textContent = p; body.appendChild(el);
  });
  wrap.appendChild(body);
  wrap.style.setProperty('--cl-align', cl.align==='left' ? 'left' : 'justify');
  return wrap;
}
function renderCoverLetterPreview(){
  const host = document.getElementById('clPagesWrap');
  if(!host) return;
  host.innerHTML = '';
  host.appendChild(buildCoverLetterPaperNode());
  wrapPagesForZoom('clPagesWrap');
  applyPreviewZoom('clPagesWrap', 'coverLetter');
}
function downloadCoverLetterPdf(){
  const cl = COVER_LETTER;
  const style = cl.style;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'mm', format:'a4' });
  const pageW=210, pageH=297, marginX=22, marginTop=24, marginBottom=24;
  const usableW = pageW - marginX*2;
  const font = style==='minimal' ? 'helvetica' : 'times';
  let y = marginTop;
  function newPageIfNeeded(h){ if(y+h > pageH-marginBottom){ doc.addPage(); y = marginTop; } }
  function writeInlineRow(items, opts={}){
    const present = items.filter(it=>it.text);
    if(!present.length) return;
    const size = opts.size||10, align = opts.align||'left', lineHeight = opts.lineHeight||(size*0.42), sep = '   |   ';
    doc.setFont(font,'normal'); doc.setFontSize(size);
    const widths = present.map(it=>doc.getTextWidth(it.text));
    const sepWidth = doc.getTextWidth(sep);
    const total = widths.reduce((a,b)=>a+b,0) + sepWidth*(present.length-1);
    newPageIfNeeded(lineHeight);
    let x = marginX;
    if(align==='center') x = pageW/2 - total/2;
    if(align==='right') x = pageW - marginX - total;
    present.forEach((it,i)=>{
      if(it.link){ doc.setTextColor(120,90,50); doc.textWithLink(it.text, x, y, {url:it.link}); doc.setTextColor(0,0,0); }
      else doc.text(it.text, x, y);
      x += widths[i];
      if(i<present.length-1){ doc.text(sep, x, y); x += sepWidth; }
    });
    y += lineHeight;
  }
  function writeLine(text, opts={}){
    const size = opts.size||11, weight = opts.weight||'normal', align = opts.align||'left', lineHeight = opts.lineHeight||(size*0.42);
    doc.setFont(font, weight); doc.setFontSize(size);
    newPageIfNeeded(lineHeight);
    let x = marginX;
    if(align==='right') x = pageW - marginX;
    if(align==='center') x = pageW/2;
    if(opts.link){ doc.setTextColor(120,90,50); doc.textWithLink(text, x, y, {align, url:opts.link}); doc.setTextColor(0,0,0); }
    else doc.text(text, x, y, {align});
    y += lineHeight;
  }
  function writeParagraph(text, opts={}){
    const size = opts.size||11, lineHeight = opts.lineHeight||(size*0.5);
    doc.setFont(font,'normal'); doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, usableW);
    const justify = cl.align!=='left';
    lines.forEach((line,i)=>{
      newPageIfNeeded(lineHeight);
      const isLastLine = i===lines.length-1;
      if(justify && !isLastLine) doc.text(line, marginX, y, { maxWidth: usableW, align:'justify' });
      else doc.text(line, marginX, y);
      y += lineHeight;
    });
    y += size*0.28;
  }
  const nameAlign = style==='minimal' ? 'center' : 'left';
  const dateAlign = style==='minimal' ? 'center' : 'left';
  writeLine(cl.name || 'Your Name', { size: style==='modern'?16:13, weight:'bold', align:nameAlign, lineHeight:7 });
  writeInlineRow([{text:cl.phone},{text:cl.email}], { size:10, align:nameAlign, lineHeight:4.6 });
  writeInlineRow([
    { text: cl.linkedin?'LinkedIn':'', link: normalizeUrl(cl.linkedin) },
    { text: cl.github?'GitHub':'', link: normalizeUrl(cl.github) },
    { text: cl.portfolio?'Portfolio':'', link: normalizeUrl(cl.portfolio) }
  ], { size:10, align:nameAlign, lineHeight:4.6 });
  if(cl.location) writeLine(cl.location, { size:10, align:nameAlign, lineHeight:4.6 });
  y += 6;
  writeLine(cl.date || todayFormatted(), { size:10, align:dateAlign, lineHeight:4.6 });
  y += 6;
  const paras = (cl.content||'').split(/\n\s*\n/).map(p=>p.trim()).filter(Boolean);
  if(!paras.length) writeParagraph('(No letter content yet -- paste your letter on the left.)');
  else paras.forEach(p=>writeParagraph(p, { size:11.5, lineHeight:5.6 }));
  const base = cl.fileTag || cl.name || 'cover-letter';
  doc.save(base.replace(/\s+/g,'-') + '-cover-letter.pdf');
}
function onCoverLetterEvent(ev){
  const t = ev.target;
  if(t.dataset.cl){ COVER_LETTER[t.dataset.cl] = t.value; renderCoverLetterPreview(); return; }
  if(t.matches('[data-cl-align-toggle]')){ COVER_LETTER.align = t.checked ? 'justify' : 'left'; renderCoverLetterPreview(); return; }
}
function onCoverLetterClick(ev){
  const chip = ev.target.closest('[data-cl-style]');
  if(chip){ COVER_LETTER.style = chip.dataset.clStyle; renderCoverLetter(); return; }
  const actionBtn = ev.target.closest('[data-cl-action]');
  if(!actionBtn) return;
  const action = actionBtn.dataset.clAction;
  if(action==='sample'){ COVER_LETTER.content = SAMPLE_COVER_LETTER; renderCoverLetter(); }
  else if(action==='clear'){ COVER_LETTER.content = ''; renderCoverLetter(); }
  else if(action==='download') downloadCoverLetterPdf();
  else if(action==='zoom-out') stepZoom('coverLetter','clPagesWrap',-0.1);
  else if(action==='zoom-in') stepZoom('coverLetter','clPagesWrap',0.1);
  else if(action==='zoom-fit') setFitZoom('coverLetter','clPagesWrap');
}

/* ===== GitHub backup wiring (one-way push only, proxied through the github-backup
   Edge Function -- the browser never holds a PAT after initial setup, see
   supabase/functions/github-backup/index.ts) ===== */
function setGhStatus(kind,text){
  const dot=document.getElementById('ghDot'); if(!dot) return;
  dot.className='dot'+(kind==='on'?' on':kind==='err'?' err':'');
  document.getElementById('ghStatusText').textContent=text;
  // GitHub status now lives inside the settings dropdown (see "Settings menu" below), not the
  // main topbar row -- this small badge on the gear icon itself is what keeps at-a-glance
  // status visible without needing to open the menu. classList.toggle (not a className
  // overwrite) specifically so this doesn't clobber the 'active' class switchView() sets on
  // this same button when VIEW==='preferences'.
  const settingsBtn = document.getElementById('btnSettingsMenu');
  if(settingsBtn){
    settingsBtn.classList.toggle('gh-badge-on', kind==='on');
    settingsBtn.classList.toggle('gh-badge-err', kind==='err');
  }
}
function renderTopbarStatus(){
  const configured = !!(GITHUB_CONFIG && GITHUB_CONFIG.owner && GITHUB_CONFIG.repo);
  if(GITHUB_CONFIG && GITHUB_CONFIG.backup_enabled) setGhStatus('on', (GITHUB_CONFIG.owner||'')+'/'+(GITHUB_CONFIG.repo||''));
  else setGhStatus('', 'GitHub backup not configured');
  // The topbar button's own label was hardcoded "Connect" in index.html and never updated --
  // a real reported bug: it kept saying "Connect" even once a repo was already configured
  // and backing up. Now reflects actual state instead.
  const btn = document.getElementById('btnGhOpen');
  if(btn) btn.textContent = configured ? 'GitHub Manage' : 'Connect';
}
/* ===== In-app "Change password" -- added on request, so a signed-in user doesn't have to go
   through the forgot-password email flow just to change a password they already know. Same
   modal chrome (.gh-modal-overlay/.gh-modal-box) as the GitHub Backup panel -- reachable from
   the same Settings dropdown, right below Preferences. */
var CHANGE_PASSWORD_MODAL_OPEN = false;
function changePasswordModalHtml(){
  if(!CHANGE_PASSWORD_MODAL_OPEN) return '';
  return `<div class="gh-modal-overlay" id="changePasswordModalOverlay">
    <div class="gh-modal-box">
      <div class="gh-modal-header"><h3>Change password</h3><button class="gh-modal-close" id="changePasswordModalClose" aria-label="Close">${ICONS.close}</button></div>
      <div class="gh-modal-body">
        <div id="changePasswordModalMessage"></div>
        <div class="field"><label>Current password</label><input type="password" id="cpCurrentPassword" autocomplete="current-password"></div>
        <div class="field"><label>New password</label><input type="password" id="cpNewPassword" autocomplete="new-password"></div>
        <div class="field"><label>Confirm new password</label><input type="password" id="cpConfirmPassword" autocomplete="new-password"></div>
        <div class="auth-links"><a href="#" id="changePasswordForgotLink">Forgot your current password?</a></div>
      </div>
      <div class="gh-actions">
        <button class="btn btn-brass btn-sm" id="changePasswordModalSubmit">Change password</button>
        <button class="btn btn-ghost btn-sm" id="changePasswordModalCancel">Cancel</button>
      </div>
    </div>
  </div>`;
}
function openChangePasswordModal(){ CHANGE_PASSWORD_MODAL_OPEN = true; renderChangePasswordModal(); }
function closeChangePasswordModal(){ CHANGE_PASSWORD_MODAL_OPEN = false; renderChangePasswordModal(); }
function changePasswordModalMessage(kind, text){
  const el = document.getElementById('changePasswordModalMessage');
  if(el) el.innerHTML = `<div class="auth-message auth-message-${kind}">${esc(text)}</div>`;
}
function renderChangePasswordModal(){
  const wrap = document.getElementById('changePasswordModalWrap');
  if(!wrap) return;
  wrap.innerHTML = changePasswordModalHtml();
  if(!CHANGE_PASSWORD_MODAL_OPEN) return;
  document.getElementById('changePasswordModalClose').onclick = closeChangePasswordModal;
  document.getElementById('changePasswordModalCancel').onclick = closeChangePasswordModal;
  document.getElementById('changePasswordModalOverlay').addEventListener('click', (ev)=>{ if(ev.target.id==='changePasswordModalOverlay') closeChangePasswordModal(); });
  document.getElementById('changePasswordModalSubmit').onclick = submitChangePassword;
  document.getElementById('changePasswordForgotLink').addEventListener('click', (ev)=>{ ev.preventDefault(); sendForgotPasswordFromChangeModal(); });
  document.getElementById('cpCurrentPassword').focus();
}
// "Forgot your current password?" inside the modal, on request -- without this, a signed-in
// user who genuinely doesn't remember their current password (the modal above requires it,
// deliberately, to verify identity before letting the change through) had no way to reach the
// email-based reset flow at all: "Forgot password?" only ever lived on the sign-in screen,
// unreachable once already signed in. Reuses the exact same resetPasswordForEmail() call
// onAuthClick()'s own submit-forgot branch makes -- same redirectTo, same success/error
// message shape -- just sourcing the email from the current session instead of a typed-in
// field, since a signed-in user's own address is already known.
async function sendForgotPasswordFromChangeModal(){
  const { data:{ session } } = await window.supabase.auth.getSession();
  const email = session && session.user && session.user.email;
  if(!email){ changePasswordModalMessage('error', 'Could not determine your account email -- try signing out and back in.'); return; }
  const link = document.getElementById('changePasswordForgotLink');
  link.textContent = 'Sending…';
  const { error } = await window.supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin+window.location.pathname });
  changePasswordModalMessage(error ? 'error' : 'info', error ? error.message : `Check ${email} for a reset link.`);
  const stillThere = document.getElementById('changePasswordForgotLink');
  if(stillThere) stillThere.textContent = 'Forgot your current password?';
}
async function submitChangePassword(){
  const current = document.getElementById('cpCurrentPassword').value;
  const next = document.getElementById('cpNewPassword').value;
  const confirmVal = document.getElementById('cpConfirmPassword').value;
  if(!current || !next || !confirmVal){ changePasswordModalMessage('error', 'Fill in all three fields.'); return; }
  if(next.length < 8){ changePasswordModalMessage('error', 'New password must be at least 8 characters.'); return; }
  if(next !== confirmVal){ changePasswordModalMessage('error', 'New password and confirmation don\'t match.'); return; }
  const { data:{ session } } = await window.supabase.auth.getSession();
  const email = session && session.user && session.user.email;
  if(!email){ changePasswordModalMessage('error', 'Could not determine your account email -- try signing out and back in.'); return; }
  const btn = document.getElementById('changePasswordModalSubmit');
  const oldText = btn.textContent;
  btn.disabled = true; btn.textContent = 'Changing…';
  try{
    // Verify the current password is actually correct before changing anything -- updateUser()
    // below doesn't require it (a valid session alone is enough), but blindly trusting that
    // would let anyone at an already-unlocked, unattended session change the password with no
    // proof they know the existing one. Re-authenticating via signInWithPassword() is the
    // standard way to check a password against Supabase Auth -- there's no separate
    // verify-without-signing-in endpoint; signing in again as the same already-signed-in user
    // is harmless, it just refreshes the session's own tokens.
    const { error: verifyErr } = await window.supabase.auth.signInWithPassword({ email, password: current });
    if(verifyErr){ changePasswordModalMessage('error', 'Current password is incorrect.'); return; }
    const { error: updateErr } = await window.supabase.auth.updateUser({ password: next });
    if(updateErr){ changePasswordModalMessage('error', updateErr.message); return; }
    closeChangePasswordModal();
    toast('Password changed.');
  } finally {
    btn.disabled = false; btn.textContent = oldText;
  }
}
// GitHub push queue -- coalesces every "this needs backing up" signal (library edits,
// version edits, a new/duplicated/starred version) into a single, debounced push cycle
// instead of firing an immediate push-file call per edit. This fixes a real, reported bug:
// rapid edits could trigger several concurrent push-file calls for the *same* file, each
// computing its PUT against a sha that was stale by the time the request actually reached
// GitHub -- the first PUT wins and updates the sha, every other in-flight PUT holding the
// now-stale sha gets rejected with a 409. Coalescing into one push cycle, never more than one
// in flight at a time, makes that race structurally impossible from this tab.
// deletedVersions -- a real, reported gap: deleting a version in the app never told GitHub,
// so the repo kept accumulating versions/{id}.json files for versions long gone from the
// app, and "GitHub Backup" was really "GitHub one-way accumulate," not a mirror of current
// state. markGithubVersionDeleted() (deleteVersionConfirmed()'s own call, below) queues a
// delete-file push through this same debounced cycle -- and discards any pending *edit* for
// that same id in `versions`, since pushing a just-deleted version's content right before (or
// after, in the wrong order) deleting it would be pointless churn at best.
var ghDirty = { library:false, versions:new Set(), deletedVersions:new Set() };
var ghPushTimer = null;
var ghPushInFlight = false;
var ghPushQueuedAgain = false;
var ghFirstDirtyAt = null;
// var (not const) specifically so tests can override the timing -- see js/06_app.js's other
// top-level var declarations and CLAUDE.md's "Conventions to keep" for why.
var GH_PUSH_DEBOUNCE_MS = 10000; // wait for a quiet period, like autosave -- not push-per-edit
var GH_PUSH_MAX_WAIT_MS = 45000; // force a push even under continuous editing, so backups can't starve indefinitely under a naive debounce-that-keeps-resetting

function markGithubDirty(kind, versionId){
  if(!GITHUB_CONFIG || !GITHUB_CONFIG.backup_enabled) return;
  if(kind==='library') ghDirty.library = true; else ghDirty.versions.add(versionId);
  const now = Date.now();
  if(ghFirstDirtyAt===null) ghFirstDirtyAt = now;
  clearTimeout(ghPushTimer);
  const waitedAlready = now - ghFirstDirtyAt;
  const delay = waitedAlready >= GH_PUSH_MAX_WAIT_MS ? 0 : GH_PUSH_DEBOUNCE_MS;
  ghPushTimer = setTimeout(runGithubPushCycle, delay);
}
// The delete-file counterpart to markGithubDirty() -- called once a version is actually gone
// from LIBRARY/VERSIONS_INDEX (deleteVersionConfirmed()), so the next push cycle removes its
// file from GitHub instead of leaving an orphan there forever. Discards any pending *edit*
// queued for the same id (ghDirty.versions) -- there's nothing left to push once it's deleted.
function markGithubVersionDeleted(id){
  if(!GITHUB_CONFIG || !GITHUB_CONFIG.backup_enabled) return;
  ghDirty.versions.delete(id);
  ghDirty.deletedVersions.add(id);
  const now = Date.now();
  if(ghFirstDirtyAt===null) ghFirstDirtyAt = now;
  clearTimeout(ghPushTimer);
  const waitedAlready = now - ghFirstDirtyAt;
  const delay = waitedAlready >= GH_PUSH_MAX_WAIT_MS ? 0 : GH_PUSH_DEBOUNCE_MS;
  ghPushTimer = setTimeout(runGithubPushCycle, delay);
}
async function runGithubPushCycle(){
  if(ghPushInFlight){ ghPushQueuedAgain = true; return; }
  if(!ghDirty.library && ghDirty.versions.size===0 && ghDirty.deletedVersions.size===0) return;
  if(!GITHUB_CONFIG || !GITHUB_CONFIG.backup_enabled) return;
  ghPushInFlight = true;
  ghFirstDirtyAt = null;
  const pushLibrary = ghDirty.library; ghDirty.library = false;
  const versionIds = Array.from(ghDirty.versions); ghDirty.versions.clear();
  const deletedIds = Array.from(ghDirty.deletedVersions); ghDirty.deletedVersions.clear();
  setGhStatus('on','Backing up…');
  let ok = true, lastErr = null;
  try{
    if(pushLibrary){
      const res = await DB.callBackupFunction('push-file', { path:'library.json', content: LIBRARY });
      if(!res.ok){ ok=false; lastErr=res.error; }
    }
    for(const id of versionIds){
      const full = await DB.getVersion(id);
      if(!full) continue;
      const res = await DB.callBackupFunction('push-file', { path:'versions/'+id+'.json', content: full.data });
      if(!res.ok){ ok=false; lastErr=res.error; }
    }
    for(const id of deletedIds){
      const res = await DB.callBackupFunction('delete-file', { path:'versions/'+id+'.json' });
      if(!res.ok){ ok=false; lastErr=res.error; }
    }
  } finally {
    if(ok) setGhStatus('on','Backed up just now'); else setGhStatus('err','Backup failed: '+(lastErr||'unknown error'));
    // Refresh from the DB (the Edge Function already persisted last_backup_at/status/error
    // server-side, for whichever file it saw last) so the modal's status strip -- not just
    // the topbar dot -- reflects this push too. Both are driven by the same event now,
    // instead of two independently-updated displays that could show different, stale results.
    GITHUB_CONFIG = await DB.getGithubConfig();
    if(ghPanelOpen) renderGhPanel();
    ghPushInFlight = false;
    if(ghPushQueuedAgain || ghDirty.library || ghDirty.versions.size>0 || ghDirty.deletedVersions.size>0){
      ghPushQueuedAgain = false;
      runGithubPushCycle();
    }
  }
}
async function pushAllToGithub(){
  if(!GITHUB_CONFIG || !GITHUB_CONFIG.backup_enabled) return;
  if(ghPushInFlight){ toast('A backup is already in progress - try again in a moment'); return; }
  // "Push all now" supersedes any pending individual pushes -- cancel the debounce timer and
  // clear dirty state rather than letting a queued single-file push race this one afterward.
  clearTimeout(ghPushTimer); ghDirty.library=false; ghDirty.versions.clear(); ghFirstDirtyAt=null;
  ghPushInFlight = true;
  setGhStatus('on','Backing up…');
  const files = [ { path:'library.json', content: LIBRARY }, { path:'versions/index.json', content: VERSIONS_INDEX } ];
  for(const v of VERSIONS_INDEX){
    const full = await DB.getVersion(v.id);
    if(full) files.push({ path:'versions/'+v.id+'.json', content: full.data });
  }
  const res = await DB.callBackupFunction('push-all', {
    files, appVersion:'1.0.0', libraryRevision: LIBRARY_REVISION||0, versionCount: VERSIONS_INDEX.length
  });
  if(res.ok){ setGhStatus('on','Backed up just now'); toast('Pushed everything to GitHub'); }
  else{ setGhStatus('err','Backup failed: '+(res.error||'unknown error')); toast('GitHub backup failed'); }
  GITHUB_CONFIG = await DB.getGithubConfig();
  if(ghPanelOpen) renderGhPanel();
  ghPushInFlight = false;
}
// {dotClass, main, sub} for the modal's status strip -- one place that decides what
// "connected/paused/failing/not set up" actually looks like, instead of scattering that
// judgment across the template.
// {dotClass, main, sub} for the modal's status strip -- one function that decides what
// "connected/paused/failing/not set up" actually looks like, instead of scattering that
// judgment across the template.
function ghStatusInfo(c){
  const configured = !!(c.owner && c.repo);
  if(!configured) return { dotClass:'', main:'Not connected', sub:'Set up a repo below to start backing up automatically.' };
  const repoLabel = esc(c.owner)+'/'+esc(c.repo);
  if(!c.backup_enabled) return { dotClass:'', main:'Backup paused', sub:repoLabel+' -- enable backup below to resume.' };
  if(c.last_backup_status==='error') return { dotClass:'err', main:'Last backup failed', sub:repoLabel };
  if(c.last_backup_at) return { dotClass:'on', main:'Connected', sub:repoLabel+' -- last backup '+new Date(c.last_backup_at).toLocaleString() };
  return { dotClass:'on', main:'Connected', sub:repoLabel+' -- no backup pushed yet' };
}
function renderGhPanel(){
  const wrap = document.getElementById('ghPanelWrap');
  if(!ghPanelOpen){ wrap.innerHTML=''; return; }
  // This function also re-runs to refresh content while the panel is *already* open (after
  // Save/Push/Disconnect complete) -- checked before overwriting innerHTML below so the
  // entrance animation only plays on a genuine closed->open transition, not every time a field
  // updates; otherwise the modal would visibly "pop in" again on every Save click.
  const isFreshOpen = wrap.children.length===0;
  const c = GITHUB_CONFIG || { owner:'', repo:'', branch:'main', folder:'DraftShelf Backup', backup_enabled:false, has_token:false };
  const configured = !!(c.owner && c.repo);
  const status = ghStatusInfo(c);
  wrap.innerHTML = `<div class="gh-modal-overlay" id="ghModalOverlay">
    <div class="gh-modal-box">
      <div class="gh-modal-header">
        <h3>GitHub Backup</h3>
        <button class="gh-modal-close" id="ghModalClose" aria-label="Close">${ICONS.close}</button>
      </div>
      <div class="gh-modal-body">
        <div class="gh-status-strip">
          <span class="dot ${status.dotClass}"></span>
          <div><div class="gh-status-main">${esc(status.main)}</div><div class="gh-status-sub">${status.sub}</div></div>
        </div>

        ${!configured ? `
        <div class="gh-section-label">Getting started</div>
        <ol class="gh-steps">
          <li>If you don't already have a repository for this, create one first: <a href="https://github.com/new" target="_blank" rel="noopener">github.com/new</a> -- any name, public or private, either works. (You can also use an existing repo.)</li>
          <li>Open <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">github.com/settings/personal-access-tokens/new</a> to create a fine-grained personal access token.</li>
          <li>Under "Token name", enter something you'll recognize later, e.g. <strong>DraftShelf Backup</strong>.</li>
          <li>Under "Expiration", choose <strong>No expiration</strong> -- this is what avoids ever having to redo these steps later. (If GitHub doesn't offer that option for your account, pick the longest duration available instead; when it eventually expires, backups will show "Last backup failed" here until you generate a new one and paste it in, same steps as below.)</li>
          <li>Under "Repository access", choose <strong>Only select repositories</strong> and pick the one repo you created or chose in step 1.</li>
          <li>Under "Permissions" &rarr; "Repository permissions", find <strong>Contents</strong> and set it to <strong>Read and write</strong>. Nothing else needs changing.</li>
          <li>Scroll down and click <strong>Generate token</strong>.</li>
          <li>Copy the token GitHub shows you (starts with <code>github_pat_</code>) -- it's only ever shown once.</li>
          <li>Come back here, fill in the repository details and paste the token below, then click Save. Every change to your Library and Versions backs up automatically from then on. It's one-way (push only); this app never reads anything back from GitHub.</li>
        </ol>` : ''}

        <div class="gh-section-label">Repository</div>
        <div class="field-row4">
          <div class="field"><label>Owner</label><input type="text" id="ghOwner" placeholder="your GitHub username, not your display name" value="${esc(c.owner||'')}"></div>
          <div class="field"><label>Repo</label><input type="text" id="ghRepo" value="${esc(c.repo||'')}"></div>
          <div class="field"><label>Branch</label><input type="text" id="ghBranch" value="${esc(c.branch||'main')}"></div>
          <div class="field"><label>Folder</label><input type="text" id="ghFolder" value="${esc(c.folder||'DraftShelf Backup')}"></div>
        </div>

        <div class="gh-section-label">Access token</div>
        <div class="field"><label>Fine-grained personal access token${c.has_token?' (already saved -- leave blank to keep it)':''}</label><input type="password" id="ghPat" placeholder="${c.has_token?'••••••••  (saved)':'paste a new token here'}"></div>
        <p style="font-size:11px;color:var(--text-faint);margin:4px 0 0;">Stored encrypted server-side and never readable again once saved, even by this app -- to change it, paste a new one.</p>

        <label class="chk chk-card" style="margin-top:14px;"><input type="checkbox" id="ghBackupEnabled" ${c.backup_enabled?'checked':''}><span>Enable backup</span></label>

        ${c.last_backup_status==='error'&&c.last_backup_error?`<div class="gh-error-box">${esc(c.last_backup_error)}</div>`:''}
      </div>
      <div class="gh-actions">
        <button class="btn btn-brass btn-sm" id="ghSave">Save</button>
        <button class="btn btn-ghost btn-sm" id="ghPush" ${configured?'':'disabled'}>Push all now</button>
        ${configured?'<button class="btn btn-danger btn-sm" id="ghDisconnect">Disconnect</button>':''}
      </div>
    </div>
  </div>`;
  document.getElementById('ghModalClose').onclick = ()=>{ ghPanelOpen=false; renderGhPanel(); };
  document.getElementById('ghModalOverlay').addEventListener('click', (ev)=>{ if(ev.target.id==='ghModalOverlay'){ ghPanelOpen=false; renderGhPanel(); } });
  // A real gap: Save (which, on first setup, is submitting a real GitHub PAT) and Disconnect
  // both do a real network round-trip to the github-backup Edge Function with zero loading
  // feedback on the button itself -- especially worth fixing for Save specifically, since it's
  // handling something security-sensitive a user is likely already a little anxious about.
  // "Push all now" is deliberately left alone here -- pushAllToGithub() already drives the
  // topbar dot + this same modal's own status strip the instant it starts ("Backing up…"), the
  // established, single source of truth for GitHub status elsewhere in this app (see
  // "Status consistency" in CLAUDE.md) -- adding a second, separate loading indicator on the
  // button itself would just be a redundant, potentially-conflicting third one.
  document.getElementById('ghSave').onclick = async (ev)=>{
    const pat = document.getElementById('ghPat').value.trim();
    await withTextButtonLoading(ev.currentTarget, 'Saving…', (async()=>{
      const res = await DB.callBackupFunction('save-config', {
        owner: document.getElementById('ghOwner').value.trim(),
        repo: document.getElementById('ghRepo').value.trim(),
        branch: document.getElementById('ghBranch').value.trim()||'main',
        folder: document.getElementById('ghFolder').value.trim()||'DraftShelf Backup',
        backupEnabled: document.getElementById('ghBackupEnabled').checked,
        ...(pat ? { pat } : {})
      });
      if(res.ok){ GITHUB_CONFIG = await DB.getGithubConfig(); toast('GitHub backup settings saved'); }
      else toast('Save failed: '+(res.error||'unknown error'));
      renderTopbarStatus(); renderGhPanel();
    })());
  };
  if(configured) document.getElementById('ghPush').onclick = pushAllToGithub;
  const disconnectBtn = document.getElementById('ghDisconnect');
  if(disconnectBtn) disconnectBtn.onclick = async (ev)=>{
    await withTextButtonLoading(ev.currentTarget, 'Disconnecting…', (async()=>{
      await DB.callBackupFunction('disconnect');
      GITHUB_CONFIG = await DB.getGithubConfig();
      renderTopbarStatus(); ghPanelOpen=false; renderGhPanel();
    })());
  };
  if(isFreshOpen) animateModalIn(document.getElementById('ghModalOverlay'));
}

/* ===== API Keys -- personal keys for the MCP integration (Claude Code, Codex, and other local
   AI tools reading/writing this account's Library and Versions directly). Same modal chrome and
   "Getting started" pattern as renderGhPanel() above -- numbered steps shown only while no key
   exists yet, replaced by the key list once one does. See
   docs/superpowers/plans/2026-08-19-mcp-ai-integration.md's own Task 2. ===== */
function apiKeysStatusInfo(keys){
  if(!keys.length) return { main:'No keys yet', sub:'Generate one below to connect an AI tool to your account.' };
  return { main: keys.length+' active key'+(keys.length===1?'':'s'), sub:'Revoke any key below to disconnect it immediately.' };
}
// A connected app's access token is short-lived (1 hour, supabase/functions/mcp-remote-auth's
// own issueTokenPair()) and silently renewed in the background every time the app is actually
// used - there's no user-facing moment to interrupt for that, by design. This renders what that
// actually looks like right now: still-valid tokens show a countdown so it's visible that expiry
// is real and enforced (not indefinite), while a token that's already lapsed (the connected app
// hasn't been used in over an hour) shows the accurate "will renew on next use" state instead of
// a stale or negative countdown.
function accessTokenExpiryLabel(expiresAtIso){
  if(!expiresAtIso) return '';
  const msLeft = new Date(expiresAtIso).getTime() - Date.now();
  if(msLeft <= 0) return 'Access token lapsed - renews automatically on next use';
  const minsLeft = Math.max(1, Math.round(msLeft/60000));
  return `Access token expires in ${minsLeft} min${minsLeft===1?'':'s'} - renews automatically while in use`;
}
// Shared row markup for both lists in this modal -- API Keys and Connected Apps show the exact
// same shape (label, created/last-used dates, a two-click-confirm Revoke button), just against
// different data-* attributes and pendingRevoke* state vars, so this is the one place that shape
// is defined rather than two near-identical copies. accessTokenExpiresAt is only ever set for a
// Connected Apps row (API keys have no per-token expiry at all, see api_keys' own indefinite-
// until-revoked posture) - undefined there renders no third line, unchanged from before.
function connectedItemRowHtml(item, revokeAttr, pendingId){
  const expiryLabel = accessTokenExpiryLabel(item.accessTokenExpiresAt);
  return `<div class="api-key-row" style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);">
    <div>
      <div style="font-weight:600;">${esc(item.label)}</div>
      <div style="font-size:11px;color:var(--text-faint);">Created ${new Date(item.createdAt).toLocaleDateString()} &middot; Last used: ${item.lastUsedAt ? new Date(item.lastUsedAt).toLocaleDateString() : 'Never'}</div>
      ${expiryLabel ? `<div style="font-size:11px;color:var(--text-faint);">${esc(expiryLabel)}</div>` : ''}
    </div>
    <button class="btn btn-danger btn-sm" ${revokeAttr}="${esc(item.id)}" style="${item.id===pendingId?'font-weight:700;':''}">${item.id===pendingId?'Confirm?':'Revoke'}</button>
  </div>`;
}
// Personal API key generation/listing is disabled for now (the account owner chose browser
// sign-in only for local MCP tools) - set true to bring the whole "Active keys" section, the
// "+ Generate new key" button, and the one-time raw-key reveal back. DB.generateApiKey/
// listApiKeys/revokeApiKey and the api_keys table are untouched, so flipping this back on needs
// no other change.
const API_KEYS_UI_ENABLED = false;
async function renderApiKeysPanel(){
  const wrap = document.getElementById('apiKeysPanelWrap');
  if(!apiKeysPanelOpen){ wrap.innerHTML=''; justGeneratedKey=null; return; }
  const isFreshOpen = wrap.children.length===0;
  const [keysRes, appsRes] = await Promise.all([
    API_KEYS_UI_ENABLED ? DB.listApiKeys() : Promise.resolve({ ok:true, keys:[] }),
    DB.listConnectedApps(),
  ]);
  const keys = keysRes.ok ? keysRes.keys : [];
  const apps = appsRes.ok ? appsRes.apps : [];
  const status = apiKeysStatusInfo(keys);
  wrap.innerHTML = `<div class="gh-modal-overlay" id="apiKeysModalOverlay">
    <div class="gh-modal-box">
      <div class="gh-modal-header">
        <h3>${API_KEYS_UI_ENABLED ? 'API Keys &amp; Connected Apps' : 'Connected Apps'}</h3>
        <button class="gh-modal-close" id="apiKeysModalClose" aria-label="Close">${ICONS.close}</button>
      </div>
      <div class="gh-modal-body">
        ${API_KEYS_UI_ENABLED ? `
        <div class="gh-status-strip">
          <span class="dot ${keys.length?'on':''}"></span>
          <div><div class="gh-status-main">${esc(status.main)}</div><div class="gh-status-sub">${esc(status.sub)}</div></div>
        </div>

        ${justGeneratedKey ? `
        <div class="gh-section-label">Your new key</div>
        <p style="font-size:12px;color:var(--text-muted);margin:0 0 8px;">Copy this now - it won't be shown again. Paste it into your AI tool's MCP config as <code>DRAFTSHELF_API_KEY</code>.</p>
        <div class="field-row" style="align-items:center;gap:8px;">
          <input type="text" id="newApiKeyValue" readonly value="${esc(justGeneratedKey.rawKey)}" style="font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:12.5px;" onclick="this.select()">
          <button class="btn btn-ghost btn-sm" id="btnCopyApiKey" type="button">${ICONS.copy} Copy</button>
        </div>` : ''}

        ${!keys.length ? `
        <div class="gh-section-label">Getting started</div>
        <ol class="gh-steps">
          <li>Click "+ Generate new key" below and copy it somewhere safe - it's shown once.</li>
          <li>Add <code>draftshelf-mcp</code> to your AI tool's MCP config with your key (<code>npx</code> fetches it automatically; the exact config file/format differs by tool - see the full guide).</li>
          <li>Restart your AI tool. It can now read and edit your Library and Versions directly.</li>
        </ol>` : `
        <div class="gh-section-label">Active keys</div>
        <div class="api-keys-list">
          ${keys.map(k=>connectedItemRowHtml(k, 'data-revoke-key', pendingRevokeKey)).join('')}
        </div>`}

        <div class="gh-section-label" style="margin-top:18px;">Connected Apps</div>` : ''}
        ${!apps.length ? `
        <p style="font-size:12px;color:var(--text-muted);margin:0 0 10px;">No apps connected yet. Add DraftShelf as a custom connector directly from claude.ai or ChatGPT, then sign in and approve when it asks.</p>` : `
        <div class="api-keys-list">
          ${apps.map(a=>connectedItemRowHtml(a, 'data-revoke-connected-app', pendingRevokeConnectedApp)).join('')}
        </div>`}
        <p style="font-size:12px;color:var(--text-muted);margin:10px 0 0;">See the <a href="help.html#ai-assistant" target="_blank" rel="noopener">full setup guide</a> for exact steps, including connecting Claude Code, Codex, or Claude Desktop.</p>
      </div>
      ${API_KEYS_UI_ENABLED ? `<div class="gh-actions">
        <button class="btn btn-brass btn-sm" id="btnGenerateApiKey">+ Generate new key</button>
      </div>` : ''}
    </div>
  </div>`;
  document.getElementById('apiKeysModalClose').onclick = ()=>{ apiKeysPanelOpen=false; renderApiKeysPanel(); };
  document.getElementById('apiKeysModalOverlay').addEventListener('click', (ev)=>{ if(ev.target.id==='apiKeysModalOverlay'){ apiKeysPanelOpen=false; renderApiKeysPanel(); } });

  const copyBtn = document.getElementById('btnCopyApiKey');
  if(copyBtn) copyBtn.onclick = async ()=>{
    try{
      await navigator.clipboard.writeText(justGeneratedKey.rawKey);
      toast('Key copied');
    }catch(e){
      const input = document.getElementById('newApiKeyValue');
      if(input){ input.focus(); input.select(); }
      toast('Could not copy automatically - key is selected, use Cmd/Ctrl+C');
    }
  };

  const generateBtn = document.getElementById('btnGenerateApiKey');
  if(generateBtn) generateBtn.onclick = async (ev)=>{
    await withTextButtonLoading(ev.currentTarget, 'Generating…', (async()=>{
      const label = 'MCP key '+new Date().toLocaleDateString();
      const res = await DB.generateApiKey(label);
      if(res.ok){ justGeneratedKey = { rawKey: res.rawKey, id: res.id }; toast('Key generated'); }
      else toast('Could not generate key: '+(res.error||'unknown error'));
      renderApiKeysPanel();
    })());
  };

  document.querySelectorAll('[data-revoke-key]').forEach(btn=>{
    btn.onclick = async (ev)=>{
      const id = ev.currentTarget.getAttribute('data-revoke-key');
      if(pendingRevokeKey===id){
        await withTextButtonLoading(ev.currentTarget, 'Revoking…', (async()=>{
          const res = await DB.revokeApiKey(id);
          pendingRevokeKey = null;
          if(res.ok) toast('Key revoked'); else toast('Could not revoke key: '+(res.error||'unknown error'));
          renderApiKeysPanel();
        })());
      }else{
        pendingRevokeKey = id;
        renderApiKeysPanel();
        setTimeout(()=>{ if(pendingRevokeKey===id){ pendingRevokeKey=null; renderApiKeysPanel(); } }, 4000);
      }
    };
  });

  document.querySelectorAll('[data-revoke-connected-app]').forEach(btn=>{
    btn.onclick = async (ev)=>{
      const id = ev.currentTarget.getAttribute('data-revoke-connected-app');
      if(pendingRevokeConnectedApp===id){
        await withTextButtonLoading(ev.currentTarget, 'Revoking…', (async()=>{
          const res = await DB.revokeConnectedApp(id);
          pendingRevokeConnectedApp = null;
          if(res.ok) toast('App disconnected'); else toast('Could not disconnect: '+(res.error||'unknown error'));
          renderApiKeysPanel();
        })());
      }else{
        pendingRevokeConnectedApp = id;
        renderApiKeysPanel();
        setTimeout(()=>{ if(pendingRevokeConnectedApp===id){ pendingRevokeConnectedApp=null; renderApiKeysPanel(); } }, 4000);
      }
    };
  });

  if(isFreshOpen) animateModalIn(document.getElementById('apiKeysModalOverlay'));
}

/* ===== Trash -- soft-deleted versions, recoverable until purged. Added on request ("if i
   accidentally delete a version, I can't get that back"). resume_versions.deleted_at
   (supabase/migrations/20260811030000_resume_versions_soft_delete.sql) is set instead of the
   row being removed outright; DB.listVersions() filters it out of the normal Dashboard list,
   this panel is the one place that lists the opposite. No automatic time-based purge exists
   yet (this app has no scheduled/cron infrastructure -- only HTTP-triggered Edge Functions,
   see CLAUDE.md's "PDF export"/"GitHub Backup" sections) -- a trashed version stays
   recoverable until explicitly restored or deleted forever. ===== */
function relativeTimeAgo(ms){
  const diff = Date.now()-ms;
  const mins = Math.round(diff/60000);
  if(mins<1) return 'just now';
  if(mins<60) return mins+' minute'+(mins===1?'':'s')+' ago';
  const hours = Math.round(mins/60);
  if(hours<24) return hours+' hour'+(hours===1?'':'s')+' ago';
  const days = Math.round(hours/24);
  return days+' day'+(days===1?'':'s')+' ago';
}
async function openTrashPanel(){
  trashPanelOpen = true;
  TRASH_VERSIONS = await DB.listTrashedVersions();
  TRASH_COUNT = TRASH_VERSIONS.length; // reconcile the locally-tracked count against the real
  // server state -- catches drift from another tab/device deleting or restoring a version
  pendingPurge = null;
  renderTrashPanel();
  updateTrashButtonLabel();
}
function renderTrashPanel(){
  const wrap = document.getElementById('trashPanelWrap');
  if(!trashPanelOpen){ wrap.innerHTML=''; return; }
  const isFreshOpen = wrap.children.length===0;
  const rowsHtml = TRASH_VERSIONS.length ? TRASH_VERSIONS.map(v=>`
    <div class="trash-row" data-id="${esc(v.id)}">
      <div class="trash-row-info">
        <div class="trash-row-name">${esc(v.name)}</div>
        <div class="trash-row-meta">${v.company?esc(v.company)+(v.role?' - '+esc(v.role):'')+' &middot; ':''}deleted ${relativeTimeAgo(v.deletedAt)}</div>
      </div>
      <div class="trash-row-actions">
        <button class="btn btn-ghost btn-sm" data-trash-act="restore">Restore</button>
        <button class="btn btn-danger btn-sm" data-trash-act="purge" style="${v.id===pendingPurge?'font-weight:700;':''}">${v.id===pendingPurge?'Confirm?':'Delete forever'}</button>
      </div>
    </div>
  `).join('') : `<p style="color:var(--text-muted);font-size:13px;">Trash is empty. Deleted versions show up here and stay recoverable until you delete them forever.</p>`;
  wrap.innerHTML = `<div class="gh-modal-overlay" id="trashModalOverlay">
    <div class="gh-modal-box">
      <div class="gh-modal-header">
        <h3>Trash</h3>
        <button class="gh-modal-close" id="trashModalClose" aria-label="Close">${ICONS.close}</button>
      </div>
      <div class="gh-modal-body">
        ${rowsHtml}
      </div>
      <div class="gh-actions">
        <button class="btn btn-danger btn-sm" id="btnEmptyTrash" ${TRASH_VERSIONS.length?'':'disabled'}>Empty trash</button>
      </div>
    </div>
  </div>`;
  document.getElementById('trashModalClose').onclick = ()=>{ trashPanelOpen=false; renderTrashPanel(); };
  document.getElementById('trashModalOverlay').addEventListener('click', (ev)=>{ if(ev.target.id==='trashModalOverlay'){ trashPanelOpen=false; renderTrashPanel(); } });
  wrap.querySelectorAll('.trash-row').forEach(row=>{
    const id = row.dataset.id;
    row.querySelector('[data-trash-act="restore"]').onclick = (ev)=> withButtonSpinner(ev.currentTarget, restoreTrashedVersion(id));
    row.querySelector('[data-trash-act="purge"]').onclick = (ev)=>{
      if(pendingPurge===id) withButtonSpinner(ev.currentTarget, purgeTrashedVersion(id));
      else { pendingPurge=id; renderTrashPanel(); setTimeout(()=>{ if(pendingPurge===id){ pendingPurge=null; renderTrashPanel(); } },4000); }
    };
  });
  const emptyBtn = document.getElementById('btnEmptyTrash');
  if(TRASH_VERSIONS.length) emptyBtn.onclick = (ev)=> withTextButtonLoading(ev.currentTarget, 'Emptying…', emptyTrash());
  if(isFreshOpen) animateModalIn(document.getElementById('trashModalOverlay'));
}
async function restoreTrashedVersion(id){
  await DB.restoreVersion(id);
  TRASH_VERSIONS = TRASH_VERSIONS.filter(v=>v.id!==id);
  TRASH_COUNT = Math.max(0, TRASH_COUNT-1);
  markGithubDirty('version', id); // put it back in the GitHub mirror too, since deleting it took it out
  VERSIONS_INDEX = await DB.listVersions();
  renderTrashPanel();
  renderDashboard();
  updateTrashButtonLabel();
  toast('Version restored');
}
async function purgeTrashedVersion(id){
  await DB.purgeVersion(id);
  TRASH_VERSIONS = TRASH_VERSIONS.filter(v=>v.id!==id);
  TRASH_COUNT = Math.max(0, TRASH_COUNT-1);
  pendingPurge = null;
  renderTrashPanel();
  updateTrashButtonLabel();
}
async function emptyTrash(){
  await Promise.all(TRASH_VERSIONS.map(v=>DB.purgeVersion(v.id)));
  TRASH_VERSIONS = [];
  TRASH_COUNT = 0;
  renderTrashPanel();
  updateTrashButtonLabel();
}
// The Dashboard's own "Trash" button doesn't know the trash count on its own (VERSIONS_INDEX
// only ever holds non-deleted versions) -- TRASH_COUNT is seeded once on sign-in
// (loadAuthedAppState()) and kept in sync locally by every action above, rather than a
// DB.listTrashedVersions() re-fetch on every Dashboard render just for the button label.
function updateTrashButtonLabel(){
  const btn = document.getElementById('btnTrashOpen');
  if(!btn) return;
  btn.innerHTML = ICONS.trash + `<span>${TRASH_COUNT>0 ? `Trash (${TRASH_COUNT})` : 'Trash'}</span>`;
}

/* ===== sync conflict UI (optimistic concurrency -- see DB.saveLibrary/DB.saveVersion's
   {conflict:true} return, driven by each row's `revision` column). Never silently
   reload-and-overwrite: surface the choice explicitly. ===== */
function showSyncConflict(kind, serverRow){
  syncConflict = { kind, serverRow };
  renderConflictBanner();
}
function renderConflictBanner(){
  const wrap = document.getElementById('conflictBannerWrap');
  if(!wrap) return;
  if(!syncConflict){ wrap.innerHTML=''; return; }
  const label = syncConflict.kind==='library' ? 'your Library' : 'this version';
  wrap.innerHTML = `<div class="conflict-banner">
    <strong>Someone else saved ${esc(label)} first</strong> -- your changes here weren't saved, to avoid silently overwriting theirs.
    <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">
      <button class="btn btn-brass btn-sm" data-action="reload-remote">Reload their version</button>
      <button class="btn btn-ghost btn-sm" data-action="keep-local">Keep editing (export a JSON backup)</button>
      <button class="btn btn-danger btn-sm" data-action="force-overwrite">Overwrite theirs anyway</button>
    </div>
  </div>`;
}
async function resolveConflict(choice){
  if(!syncConflict) return;
  const { kind, serverRow } = syncConflict;
  if(choice==='reload-remote'){
    if(kind==='library'){ LIBRARY = migrateTagOptions(serverRow.data); LIBRARY_REVISION = serverRow.revision; renderLibrary(); }
    else { CURRENT_VERSION = serverRow.data; VERSION_REVISIONS[serverRow.id] = serverRow.revision; renderEditor(); }
    syncConflict = null; renderConflictBanner();
  } else if(choice==='keep-local'){
    syncConflict = null; renderConflictBanner();
    await exportAllJson();
    toast('Exported your unsaved changes as a JSON backup');
  } else if(choice==='force-overwrite'){
    if(kind==='library'){
      const res = await DB.saveLibrary(LIBRARY, serverRow.revision);
      if(res.ok){ LIBRARY_REVISION = res.revision; syncConflict=null; toast('Overwritten'); }
      else if(res.conflict){ syncConflict = { kind, serverRow: res.serverRow }; }
    } else {
      const res = await DB.saveVersion(CURRENT_VERSION.id, CURRENT_VERSION, serverRow.revision);
      if(res.ok){ VERSION_REVISIONS[CURRENT_VERSION.id] = res.revision; syncConflict=null; toast('Overwritten'); }
      else if(res.conflict){ syncConflict = { kind, serverRow: res.serverRow }; }
    }
    renderConflictBanner();
  }
}

/* ===== dashboard ===== */
function renderDashboard(){
  let bulletCount=0;
  ['experience','projects'].forEach(k=> LIBRARY[k].forEach(e=> bulletCount+=e.bullets.length));
  const entryCount = LIBRARY.experience.length+LIBRARY.projects.length+LIBRARY.education.length+LIBRARY.skills.length+LIBRARY.summaries.length+LIBRARY.references.length;
  document.getElementById('statsRow').innerHTML = `
    <div class="stat"><div class="n">${entryCount}</div><div class="l">Library entries</div></div>
    <div class="stat"><div class="n">${bulletCount}</div><div class="l">Total bullets</div></div>
    <div class="stat"><div class="n">${VERSIONS_INDEX.length}</div><div class="l">Versions saved</div></div>
    <div class="stat"><div class="n" style="font-size:14px;">${(GITHUB_CONFIG&&GITHUB_CONFIG.backup_enabled)?'Enabled':'Not configured'}</div><div class="l">GitHub backup</div></div>
  `;
  const q = (document.getElementById('searchInput').value||'').toLowerCase();
  const sort = document.getElementById('sortSelect').value;
  let list = VERSIONS_INDEX.filter(v=> !q || (v.name+' '+(v.company||'')+' '+(v.role||'')).toLowerCase().includes(q));
  if(sort==='company') list = list.slice().sort((a,b)=>(a.company||'').localeCompare(b.company||''));
  else if(sort==='applied') list = list.slice().sort((a,b)=>(b.dateApplied||'').localeCompare(a.dateApplied||''));
  else list = list.slice().sort((a,b)=> b.updatedAt-a.updatedAt);
  // Pin to top -- reuses the pre-existing `main`/`is_main` field (no schema/DB migration
  // needed) but gives it an actual effect on layout instead of just a cosmetic badge, on
  // request ("the current, star + main, feels like a gimmick... I want the ability to pin
  // version to the top of the dashboard"). A stable partition (every pinned card first, in
  // whatever order the chosen sort already put them in, then every unpinned card in that same
  // order) rather than a fresh sort by `main` -- so pinning doesn't fight or reset the
  // company/applied/last-edited ordering within each group.
  list = list.filter(v=>v.main).concat(list.filter(v=>!v.main));

  // "Standalone" badge -- surfaces version.standalone (see buildStandaloneVersion() in
  // js/03_model.js) outside the editor, on request ("Add something to identify that it is a
  // standalone one outside of the editor... I want it in the Dashboard version card only").
  // Backed by resume_versions.is_standalone (supabase/migrations/
  // 20260807120000_resume_versions_is_standalone.sql) -- DB.listVersions() only ever selects a
  // few lightweight dashboard-listing columns, never the full data blob standalone actually
  // lives in, so this needed its own dedicated column, same as is_main/page_count already have.
  const cardsHtml = list.map(v=>`
    <div class="card${v.main?' pinned':''}" data-id="${esc(v.id)}">
      ${v.main?'<span class="badge">'+ICONS.pinFilled+' pinned</span> ':''}${v.standalone?'<span class="badge standalone-badge" title="This version\'s content is private -- imported standalone, never touching your Library">Standalone</span> ':''}<span class="badge">${v.pageCount||1} page${(v.pageCount||1)>1?'s':''}</span>
      <h3>${esc(v.name)}</h3>
      <p>${esc(v.company||'')}${v.role?(' - '+esc(v.role)):''}</p>
      <p>${v.dateApplied?('Applied '+esc(v.dateApplied)):''}</p>
      <div class="card-actions">
        <button data-act="edit" title="Edit">${ICONS.edit}</button>
        <button data-act="dup" title="Duplicate">${ICONS.duplicate}</button>
        <button data-act="pin" title="${v.main?'Unpin':'Pin to top'}">${v.main?ICONS.pinFilled:ICONS.pin}</button>
        <button data-act="del" title="Delete" style="${v.id===pendingDelete?'color:var(--red);font-weight:700;':''}">${v.id===pendingDelete?'Confirm?':ICONS.close}</button>
      </div>
    </div>
  `).join('');
  // First-run empty state -- a brand-new account's Dashboard used to be just the dashed
  // "+ New version" tile with nothing distinguishing "you haven't made anything yet" from
  // any other state. A first attempt added a separate block floating above the grid --
  // reported back as looking wrong: an isolated chunk of centered text with a lot of empty
  // space around it, disconnected from the actual "do something" affordance below it. Folded
  // directly into the "+ New version" tile itself instead -- one cohesive card (icon,
  // heading, one sentence, then the same "+ New version" call to action), no separate
  // floating element, no dead space. Scoped to VERSIONS_INDEX itself (not the filtered
  // `list`), so a search that happens to match nothing doesn't wrongly show first-run copy.
  const isFirstRun = VERSIONS_INDEX.length===0;
  const newCardInner = isFirstRun
    ? `<div class="new-card-icon">${ICONS.layers}</div><h3>Build your first tailored resume</h3><p>Add your experience, projects, and skills to the Library, then create a version to select and arrange what goes on the page.</p><span class="new-card-cta">+ New version</span>`
    : '+ New version';
  document.getElementById('versionCards').innerHTML = cardsHtml + `<div class="card new${isFirstRun?' empty':''}" id="newVersionCard">${newCardInner}</div>`;
}

async function createNewVersion(){
  const v = applyPreferenceDefaults(blankVersion('New version '+(VERSIONS_INDEX.length+1)));
  const created = await DB.createVersion(v);
  if(!created){ toast('Could not create version'); return; }
  VERSION_REVISIONS[v.id] = created.revision;
  VERSIONS_INDEX = await DB.listVersions();
  markGithubDirty('version', v.id);
  await openEditor(v.id);
}
async function duplicateVersion(id){
  const orig = await DB.getVersion(id);
  if(!orig) return;
  const copy = JSON.parse(JSON.stringify(orig.data));
  copy.id = uid(); copy.name = orig.data.name+' copy'; copy.main=false; copy.createdAt=Date.now(); copy.updatedAt=Date.now();
  const created = await DB.createVersion(copy);
  if(!created){ toast('Could not duplicate version'); return; }
  VERSION_REVISIONS[copy.id] = created.revision;
  VERSIONS_INDEX = await DB.listVersions();
  markGithubDirty('version', copy.id);
  renderDashboard();
}
// "Pin to top" -- still named toggleMain() and still flips the same `main`/`is_main` field
// DB.saveVersion()/listVersions() already carry (see js/01b_data.js) -- only the dashboard's
// own rendering/labeling of that field changed (see renderDashboard()), not its storage.
async function toggleMain(id){
  const entry = VERSIONS_INDEX.find(v=>v.id===id); if(!entry) return;
  const full = await DB.getVersion(id); if(!full) return;
  const data = full.data; data.main = !entry.main;
  const res = await DB.saveVersion(id, data, full.revision);
  if(res.conflict){ showSyncConflict('version', res.serverRow); return; }
  if(res.ok){ VERSION_REVISIONS[id] = res.revision; markGithubDirty('version', id); }
  VERSIONS_INDEX = await DB.listVersions();
  renderDashboard();
}
async function deleteVersionConfirmed(id){
  await DB.deleteVersion(id); // soft delete -- sets deleted_at, recoverable from Trash (see below)
  delete VERSION_REVISIONS[id];
  VERSIONS_INDEX = VERSIONS_INDEX.filter(v=>v.id!==id);
  markGithubVersionDeleted(id); // real, reported gap: GitHub used to keep the file forever
  pendingDelete = null;
  TRASH_COUNT++;
  renderDashboard();
  updateTrashButtonLabel();
}
// Every branch below does a real network round-trip (openEditor()'s/duplicateVersion()'s/
// toggleMain()'s/deleteVersionConfirmed()'s own DB.* calls) with nothing else already covering
// loading feedback for it (unlike, say, GitHub pushes, which already drive the topbar dot) --
// a real, reported gap for the "edit" case specifically, generalized to every other action
// here once the same pattern needed to apply everywhere in this row. withButtonSpinner()
// swaps the button's icon for a spinner *synchronously*, before the await even starts, and
// restores it in a .finally() regardless of outcome -- harmless if the click navigated away
// (renderDashboard() rebuilds this markup fresh next time Dashboard is shown anyway) and
// necessary if it didn't (a stuck spinner would be a new bug of its own).
function onDashboardCardClick(ev){
  const newVersionCard = ev.target.closest('#newVersionCard');
  if(newVersionCard){
    if(newVersionCard.dataset.loading) return; // guards a rapid double-click firing two creates
    newVersionCard.dataset.loading = 'true';
    // innerHTML, not textContent -- the first-run empty state renders rich markup (icon +
    // heading + paragraph) inside this same card, and textContent would flatten that to a
    // plain string on restore, losing the layout if createNewVersion() ever fails without a
    // full re-render happening afterward.
    const originalHtml = newVersionCard.innerHTML;
    newVersionCard.textContent = 'Creating…';
    createNewVersion().finally(()=>{
      delete newVersionCard.dataset.loading;
      newVersionCard.innerHTML = originalHtml;
    });
    return;
  }
  const card = ev.target.closest('.card[data-id]'); if(!card) return;
  const id = card.dataset.id;
  const actBtn = ev.target.closest('button[data-act]'); if(!actBtn) return;
  const act = actBtn.dataset.act;
  if(act==='edit') withButtonSpinner(actBtn, openEditor(id));
  else if(act==='dup') withButtonSpinner(actBtn, duplicateVersion(id));
  else if(act==='pin') withButtonSpinner(actBtn, toggleMain(id));
  else if(act==='del'){
    if(pendingDelete===id) withButtonSpinner(actBtn, deleteVersionConfirmed(id));
    else { pendingDelete=id; renderDashboard(); setTimeout(()=>{ if(pendingDelete===id){ pendingDelete=null; renderDashboard(); } },4000); }
  }
}

/* ===== JSON export / import -- the primary content-portability path, independent of
   whatever backend is underneath (see the migration plan's "replaceable Postgres
   provider" section) ===== */
// Used by exportAllJson() (below) -- one place that knows how to snapshot the currently-active
// LIBRARY/VERSIONS_INDEX into the portable payload shape importJsonPayload() expects.
async function buildExportPayload(){
  const versions = {};
  for(const v of VERSIONS_INDEX){ const full = await DB.getVersion(v.id); if(full) versions[v.id] = full.data; }
  return { exportedAt:new Date().toISOString(), library:LIBRARY, versionsIndex:VERSIONS_INDEX, versions };
}
async function exportAllJson(){
  const payload = await buildExportPayload();
  const blob = new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download='resume-forge-backup-'+new Date().toISOString().slice(0,10)+'.json'; a.click();
  return payload;
}
async function importJsonPayload(payload){
  clearLibraryHistory(); clearVersionHistory(); // data is wholesale replaced, not edited
  if(payload.library){
    LIBRARY = migrateTagOptions(payload.library);
    const res = await DB.saveLibrary(LIBRARY, LIBRARY_REVISION);
    if(res.ok) LIBRARY_REVISION = res.revision;
    else if(res.conflict){ showSyncConflict('library', res.serverRow); }
  }
  if(payload.versions){
    for(const id in payload.versions){
      const versionData = payload.versions[id];
      const existing = await DB.getVersion(id);
      if(existing){
        const res = await DB.saveVersion(id, versionData, existing.revision);
        if(res.ok) VERSION_REVISIONS[id] = res.revision;
      } else {
        const created = await DB.createVersion(versionData);
        if(created) VERSION_REVISIONS[id] = created.revision;
      }
    }
  }
  VERSIONS_INDEX = await DB.listVersions();
}
// Contact-link fields worth checking on import (isLikelyLabelNotUrl(), js/01_core.js) -- a
// hand-built import file (not necessarily a prior ResumIT export) sometimes carries just
// the display label ("LinkedIn") instead of the actual URL for these three. A normal
// ResumIT export/import round trip never triggers this: everything exportAllJson() writes
// is already a real URL or empty.
const IMPORT_LINK_FIELD_LABELS = {linkedin:'LinkedIn', github:'GitHub', portfolio:'Portfolio'};

// "Import Resume" -- most people reaching for this button have a resume in some other shape
// (a PDF, a Word doc, plain text) sitting on their computer, not a prior DraftShelf export.
// This prompt is what turns that into the one shape onImportFile()/looksLikeResumitExport()
// already accepts: {"library": {...}} -- library-only, deliberately no `versions` -- an AI
// has no way to know which bullets should be selected into a printed version, and the
// existing Review & merge flow (which every "Choose file" click below still goes through, via
// the same showImportChoiceDialog() as any other import) is exactly the tool for picking that
// afterward. Field shapes copied verbatim from newLibraryEntry()/emptyLibrary() (03_model.js)
// -- `tags`/`id` are deliberately left out of the instructions: `id` is always regenerated on
// import (see libAddEntry()), and `tags` hold this account's own internal tag-pool ids, which
// an AI has no way to populate correctly (see the Tags section of CLAUDE.md) -- asking it to
// leave them off avoids raw text leaking into a field every other part of the app expects to
// hold only ids.
const AI_RESUME_IMPORT_PROMPT = `Convert the resume I'm giving you into JSON matching this exact shape. Output ONLY the JSON -- no markdown code fences, no commentary before or after.

{
  "library": {
    "meta": { "name": "", "phone": "", "email": "", "location": "", "linkedin": "", "github": "", "portfolio": "" },
    "experience": [
      { "company": "", "role": "", "location": "", "dates": "", "tag": "", "bullets": [ { "text": "" } ] }
    ],
    "projects": [
      { "title": "", "dates": "", "bullets": [ { "text": "" } ] }
    ],
    "education": [
      { "school": "", "degree": "", "location": "", "dates": "" }
    ],
    "skills": [
      { "label": "", "text": "" }
    ],
    "summaries": [
      { "text": "" }
    ],
    "references": [
      { "name": "", "title": "", "contact": "" }
    ],
    "customSections": [
      { "heading": "", "subheading": "", "dates": "", "location": "", "contentType": "bullets", "bullets": [ { "text": "" } ], "text": "" }
    ]
  }
}

Rules:
- meta: pull name/phone/email/location from the header. linkedin/github/portfolio should be full URLs (e.g. "https://linkedin.com/in/x"), not just a display label -- leave blank if not present.
- experience: one entry per job. "tag" is an optional short note like "Internship" or "Contract" -- leave it "" if not applicable. Split each bullet point into its own object in "bullets".
- projects: same bullet-splitting as experience.
- education: one entry per degree/school.
- skills: group related skills into categories -- "label" is the category name (e.g. "Languages", "Tools"), "text" is a comma-separated list of the skills in it. One object per category.
- summaries: if there's a professional summary/objective paragraph, put its exact text as one entry. If there isn't one, use an empty array.
- references: only include if the resume actually lists references with contact info. Otherwise use an empty array.
- customSections: use this for anything that doesn't fit the above (certifications, publications, awards, volunteering, etc.) -- one object per section. Set "contentType" to "bullets" and use the "bullets" array for a bulleted list, or "contentType" to "paragraph" and put the text in "text" for prose. Leave "subheading"/"dates"/"location" as "" if not applicable.
- Leave any section as an empty array [] if the resume has nothing for it -- don't invent content.
- Do not include "id" or "tags" fields anywhere -- leave them out entirely.
- Keep bullet text as close to the original wording as possible -- don't rewrite or embellish it.`;

function showImportResumeDialog(){
  hideImportResumeDialog();
  const wrap = document.createElement('div');
  wrap.id = 'importResumeDialog';
  wrap.className = 'gh-modal-overlay';
  wrap.innerHTML = `
    <div class="gh-modal-box" style="max-width:560px;">
      <div class="gh-modal-header"><h3>Import Resume</h3></div>
      <div class="gh-modal-body">
        <p style="font-size:12.5px;color:var(--text-muted);margin:0 0 10px;">DraftShelf imports a specific JSON shape, not a PDF or Word doc directly. Give your resume file to an AI chatbot (ChatGPT, Claude, etc.) along with the prompt below, and it'll hand back JSON you can import here.</p>
        <ol style="font-size:12.5px;color:var(--text-muted);margin:0 0 14px;padding-left:20px;">
          <li>Copy the prompt below.</li>
          <li>Paste it into ChatGPT/Claude/etc., and attach or paste in your resume.</li>
          <li>Save what it gives back as a <code>.json</code> file (or paste it into a new text file and save with a <code>.json</code> extension).</li>
          <li>Come back here and click "Choose file" to import it.</li>
        </ol>
        <div class="gh-section-label" style="display:flex;align-items:center;justify-content:space-between;">
          <span>The prompt</span>
          <button class="btn btn-ghost btn-sm" id="btnCopyAiPrompt" type="button">${ICONS.copy} Copy prompt</button>
        </div>
        <textarea id="aiImportPromptText" readonly style="width:100%;min-height:220px;font-size:11.5px;font-family:ui-monospace,'SF Mono',Menlo,monospace;margin-top:6px;resize:vertical;" onclick="this.select()">${esc(AI_RESUME_IMPORT_PROMPT)}</textarea>
      </div>
      <div class="gh-actions">
        <button class="btn btn-ghost" id="btnImportResumeCancel">Cancel</button>
        <button class="btn btn-brass" id="btnImportResumeChooseFile">Choose file</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  document.getElementById('btnCopyAiPrompt').addEventListener('click', async ()=>{
    try{
      await navigator.clipboard.writeText(AI_RESUME_IMPORT_PROMPT);
      toast('Prompt copied');
    }catch(e){
      // Clipboard API can be unavailable (e.g. a non-secure context) -- fall back to
      // select-the-textarea so the user can still Cmd/Ctrl+C manually.
      const ta = document.getElementById('aiImportPromptText');
      if(ta){ ta.focus(); ta.select(); }
      toast('Could not copy automatically - text is selected, use Cmd/Ctrl+C');
    }
  });
  document.getElementById('btnImportResumeChooseFile').addEventListener('click', ()=>{
    hideImportResumeDialog();
    document.getElementById('importFileInput').click();
  });
  document.getElementById('btnImportResumeCancel').addEventListener('click', hideImportResumeDialog);
}
function hideImportResumeDialog(){
  const el = document.getElementById('importResumeDialog');
  if(el) el.remove();
}
async function onImportFile(ev){
  const file = ev.target.files[0]; if(!file) return;
  try{
    const text = await file.text();
    const payload = JSON.parse(text);
    if(!looksLikeResumitExport(payload)){
      toast('This isn\'t the right JSON format for this app - please check the file and try again.');
      ev.target.value='';
      return;
    }
    if(payload.library){
      showImportChoiceDialog(payload);
    } else {
      await runReplaceEverythingImport(payload);
    }
  }catch(e){ console.error(e); toast('Import failed: '+e.message); }
  ev.target.value='';
}
// The exact behavior Import JSON has always had -- wholesale replace, with the existing
// label-only-link detection ahead of it (showImportLinkPrompt(), unchanged). Factored out of
// onImportFile() so both the no-library-in-file edge case (nothing to reconcile, so the
// choice dialog would be pointless) and the new choice dialog's "Replace everything" button
// share the one implementation -- no behavior change from before this feature existed.
async function runReplaceEverythingImport(payload){
  const meta = payload.library && payload.library.meta;
  const flagged = meta ? Object.keys(IMPORT_LINK_FIELD_LABELS).filter(k=>isLikelyLabelNotUrl(meta[k])) : [];
  if(flagged.length){
    showImportLinkPrompt(payload, flagged);
  } else {
    await importJsonPayload(payload);
    renderDashboard();
    toast('Import complete');
  }
}
// Shown whenever the imported file has library content -- lets the user choose between
// today's one-click wholesale replace (for restoring their own backup) and the new guided
// Review & merge path (for a file from somewhere else). Same dynamically-created-overlay
// pattern as the other one-off import dialog (showImportLinkPrompt).
function showImportChoiceDialog(payload){
  hideImportChoiceDialog();
  const wrap = document.createElement('div');
  wrap.id = 'importChoiceDialog';
  wrap.className = 'gh-modal-overlay';
  wrap.innerHTML = `
    <div class="gh-modal-box">
      <div class="gh-modal-header"><h3>How do you want to import this file?</h3></div>
      <div class="gh-modal-body">
        <div class="entry" style="margin-bottom:10px;">
          <button class="btn btn-brass" id="btnImportChoiceReplace" style="width:100%;">Replace everything</button>
          <p style="font-size:12px;color:var(--text-muted);margin:6px 0 0;">Use this for restoring your own full backup - it replaces your entire Library and adds every version from the file, exactly as exported.</p>
        </div>
        <div class="entry" style="margin-bottom:10px;">
          <button class="btn btn-ghost" id="btnImportChoiceReview" style="width:100%;">Review &amp; merge</button>
          <p style="font-size:12px;color:var(--text-muted);margin:6px 0 0;">Use this for a file from somewhere else - like a resume you converted separately - so you can control what gets combined into your Library instead of overwriting it.</p>
        </div>
        <div class="entry">
          <button class="btn btn-ghost" id="btnImportChoiceStandalone" style="width:100%;">Import as separate version(s)</button>
          <p style="font-size:12px;color:var(--text-muted);margin:6px 0 0;">Use this to bring in a version without touching your Library at all - its content stays private to that one version. You can still edit it fully afterward, and pull anything you like out into your real Library one bullet or entry at a time.</p>
        </div>
      </div>
      <div class="gh-actions"><button class="btn btn-ghost" id="btnImportChoiceCancel">Cancel</button></div>
    </div>`;
  document.body.appendChild(wrap);
  document.getElementById('btnImportChoiceReplace').addEventListener('click', async (ev)=>{
    // A real gap: this used to hide the whole dialog *before* awaiting the import, so the
    // screen went completely blank (no dialog, nothing else visible) for however long the
    // real DB round-trips inside runReplaceEverythingImport() took. Now the dialog stays up,
    // showing a loading label on the clicked button, and is only dismissed once the import
    // has actually finished -- there's always something on screen saying "this is in progress."
    // The dialog's other buttons are disabled for the same window -- since the dialog no
    // longer closes immediately, clicking Cancel/Review/Standalone mid-import would otherwise
    // dismiss the dialog while the replace import kept running silently in the background.
    const siblingButtons = ['btnImportChoiceReview','btnImportChoiceStandalone','btnImportChoiceCancel'].map(id=>document.getElementById(id));
    siblingButtons.forEach(b=>{ if(b) b.disabled = true; });
    await withTextButtonLoading(ev.currentTarget, 'Importing…', runReplaceEverythingImport(payload));
    siblingButtons.forEach(b=>{ if(b) b.disabled = false; });
    hideImportChoiceDialog();
  });
  document.getElementById('btnImportChoiceReview').addEventListener('click', ()=>{
    hideImportChoiceDialog();
    openImportReview(payload);
  });
  document.getElementById('btnImportChoiceStandalone').addEventListener('click', ()=>{
    hideImportChoiceDialog();
    showStandaloneImportDialog(payload);
  });
  document.getElementById('btnImportChoiceCancel').addEventListener('click', ()=>{ hideImportChoiceDialog(); toast('Import cancelled'); });
}
function hideImportChoiceDialog(){
  const el = document.getElementById('importChoiceDialog');
  if(el) el.remove();
}
// "Import as separate version(s)" -- a lighter picker than Import Review's own full-page view,
// since there's no merge decision to make here at all: each checked version becomes its own
// brand-new standalone version, verbatim, with the file's own library content carried along as
// its private embedded copy (see buildStandaloneVersion() in js/03_model.js). Lists whatever
// payload.versionsIndex says (a real ResumIT export always has one); falls back to the raw
// payload.versions object's own keys/names for a hand-built file missing that convenience index.
function standaloneImportCandidates(payload){
  if(Array.isArray(payload.versionsIndex) && payload.versionsIndex.length){
    return payload.versionsIndex.map(v=>({ id:v.id, name:v.name||'(untitled version)' }));
  }
  return Object.keys(payload.versions||{}).map(id=>({ id, name:(payload.versions[id]&&payload.versions[id].name)||'(untitled version)' }));
}
function showStandaloneImportDialog(payload){
  hideStandaloneImportDialog();
  const candidates = standaloneImportCandidates(payload);
  const wrap = document.createElement('div');
  wrap.id = 'standaloneImportDialog';
  wrap.className = 'gh-modal-overlay';
  if(!candidates.length){
    wrap.innerHTML = `<div class="gh-modal-box">
      <div class="gh-modal-header"><h3>Import as separate version(s)</h3></div>
      <div class="gh-modal-body"><p style="font-size:12px;color:var(--text-muted);">This file has no versions to import this way.</p></div>
      <div class="gh-actions"><button class="btn btn-ghost" id="btnStandaloneImportCancel">Close</button></div>
    </div>`;
    document.body.appendChild(wrap);
    document.getElementById('btnStandaloneImportCancel').addEventListener('click', hideStandaloneImportDialog);
    return;
  }
  const rowsHtml = candidates.map(c=>`<label class="chk chk-card" style="margin:6px 0;"><input type="checkbox" class="standalone-import-pick" value="${esc(c.id)}" checked><span>${esc(c.name)}</span></label>`).join('');
  wrap.innerHTML = `<div class="gh-modal-box">
    <div class="gh-modal-header"><h3>Import as separate version(s)</h3></div>
    <div class="gh-modal-body">
      <p style="font-size:12px;color:var(--text-muted);margin:0 0 8px;">Pick which version(s) to bring in. Each becomes its own new version here, with its own private copy of whatever it references - your Library is never touched.</p>
      <label class="chk" style="display:flex;margin-bottom:8px;font-weight:600;"><input type="checkbox" id="standaloneImportSelectAll" checked> Select all</label>
      ${rowsHtml}
    </div>
    <div class="gh-actions">
      <button class="btn btn-brass" id="btnStandaloneImportGo">Import selected</button>
      <button class="btn btn-ghost" id="btnStandaloneImportCancel">Cancel</button>
    </div>
  </div>`;
  document.body.appendChild(wrap);
  const checkboxes = () => Array.from(wrap.querySelectorAll('.standalone-import-pick'));
  document.getElementById('standaloneImportSelectAll').addEventListener('change', (ev)=>{
    checkboxes().forEach(c=> c.checked = ev.target.checked);
  });
  checkboxes().forEach(c=> c.addEventListener('change', ()=>{
    document.getElementById('standaloneImportSelectAll').checked = checkboxes().every(x=>x.checked);
  }));
  document.getElementById('btnStandaloneImportGo').addEventListener('click', async (ev)=>{
    // Same real gap as "Replace everything" (showImportChoiceDialog()) -- used to hide the
    // dialog before the real DB.createVersion() calls inside importSelectedAsStandalone()
    // finished, leaving a blank screen for the duration. Kept open with a loading label until
    // the import actually completes; the Select-all/individual checkboxes and Cancel are
    // disabled for the same window so they can't be changed/cancelled mid-import.
    const ids = checkboxes().filter(c=>c.checked).map(c=>c.value);
    const cancelBtn = document.getElementById('btnStandaloneImportCancel');
    checkboxes().forEach(c=> c.disabled = true);
    document.getElementById('standaloneImportSelectAll').disabled = true;
    if(cancelBtn) cancelBtn.disabled = true;
    await withTextButtonLoading(ev.currentTarget, 'Importing…', importSelectedAsStandalone(payload, ids));
    hideStandaloneImportDialog();
  });
  document.getElementById('btnStandaloneImportCancel').addEventListener('click', ()=>{ hideStandaloneImportDialog(); toast('Import cancelled'); });
}
function hideStandaloneImportDialog(){
  const el = document.getElementById('standaloneImportDialog');
  if(el) el.remove();
}
// Creates one brand-new, standalone version per selected id -- no remap table needed (unlike
// applyImportReviewAndFinish()'s own version-creation loop) since buildStandaloneVersion()
// carries the file's own library along as each version's private embedded copy, so its
// selection's refIds/bulletIds already match verbatim; there's no different id space to
// reconcile against. Wrapped per-version in try/catch, same defensive reasoning
// applyImportReviewAndFinish() already documents: a malformed entry (missing selection/jobMeta,
// not something a real ResumIT export ever produces) is skipped and named in the completion
// toast instead of aborting every other version in the same file.
async function importSelectedAsStandalone(payload, ids){
  if(!ids.length){ toast('No versions selected - nothing imported.'); return; }
  let created = 0; const skipped = [];
  for(const id of ids){
    const raw = payload.versions && payload.versions[id];
    if(!raw || !raw.selection || !raw.jobMeta){ skipped.push(id); continue; }
    try{
      const version = buildStandaloneVersion(raw, payload.library);
      const res = await DB.createVersion(version);
      if(!res) throw new Error('createVersion failed');
      VERSION_REVISIONS[version.id] = res.revision;
      created++;
    }catch(e){ console.error('Standalone import: skipped a malformed version entry', id, e); skipped.push(id); }
  }
  VERSIONS_INDEX = await DB.listVersions();
  renderDashboard();
  const skippedNote = skipped.length ? `, skipped ${skipped.length} malformed entr${skipped.length===1?'y':'ies'}` : '';
  toast(created ? `Imported ${created} version${created===1?'':'s'} as standalone${skippedNote}.` : `Nothing could be imported${skippedNote}.`);
}
/* ===== Import Review -- the "Review & merge" path's own view. See js/03c_import_review.js
   for the pure matching/apply engine this renders and drives; this half is purely DOM
   rendering + event wiring, same split every other pure-engine/DOM-layer pair in this app
   already has (e.g. 02_paginate.js/paginate() in 06_app.js). ===== */
var IMPORT_REVIEW = null; // {payload, reviewState, metaChoices, includeMap} | null
const IMPORT_REVIEW_KIND_LABELS = {experience:'Experience', projects:'Projects', education:'Education', skills:'Skills', skillGroups:'Skill Sets', summaries:'Summaries', references:'References', customSections:'Custom Sections'};
const IMPORT_REVIEW_META_LABELS = {name:'Full name', phone:'Phone', email:'Email', location:'Location', linkedin:'LinkedIn', github:'GitHub', portfolio:'Portfolio'};
function importReviewEntryLabel(kind, entry){
  // summaries matches on the whole `text` field (see IMPORT_REVIEW_MATCH_FIELD's own comment)
  // -- truncated here purely for display, same as entryLabel()'s own summaries fallback; the
  // full, untruncated text is still what actually drives the match.
  if(kind==='summaries') return (entry.text||'').slice(0,40) || '(untitled)';
  return entry[IMPORT_REVIEW_MATCH_FIELD[kind]] || '(untitled)';
}
function importReviewSectionDefault(kind){
  return (kind==='education' || kind==='skills') ? false : true;
}
function openImportReview(payload){
  // A real, reported gap: buildImportReview() (and the includeMap setup below) run directly
  // against the untrusted parsed file with nothing guarding them -- a file that's valid JSON
  // but doesn't actually match the expected shape (e.g. `library.experience` present but not an
  // array) would throw here, before the review screen even has a chance to render, with no
  // feedback to the user at all. Wrapped so a malformed file surfaces as a toast instead.
  try{
    const reviewState = buildImportReview(LIBRARY, payload.library);
    const savedDefaults = (PREFERENCES && PREFERENCES.export_prefs && PREFERENCES.export_prefs.importReviewDefaults) || {};
    const includeMap = {};
    IMPORT_REVIEW_KINDS.forEach(kind=>{
      includeMap[kind] = savedDefaults[kind]!==undefined ? savedDefaults[kind] : importReviewSectionDefault(kind);
    });
    IMPORT_REVIEW = { payload, reviewState, metaChoices:{}, includeMap };
    clearImportReviewHistory();
    switchView('importReview');
  }catch(e){
    console.error('Import Review: failed to build a review from this file', e);
    toast('This file could not be reviewed - it may not match the expected import format.');
  }
}
function renderImportReviewView(){
  const el = document.getElementById('viewImportReview');
  if(!IMPORT_REVIEW){ el.innerHTML=''; return; }
  const { reviewState } = IMPORT_REVIEW;
  const metaHtml = reviewState.metaFields.length ? `<div class="ed-block">
    <div style="font-weight:700;font-size:13px;margin-bottom:8px;">Header info</div>
    ${reviewState.metaFields.map(f=>{
      const chosen = IMPORT_REVIEW.metaChoices[f.key] || 'current';
      return `<div class="entry">
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">${esc(IMPORT_REVIEW_META_LABELS[f.key]||f.key)}</div>
        <label class="chk chk-card" style="margin-bottom:6px;"><input type="radio" name="importMeta_${esc(f.key)}" data-action="import-meta-choice" data-key="${esc(f.key)}" value="current" ${chosen==='current'?'checked':''}><span>Keep current: ${f.currentValue?esc(f.currentValue):'<em>(empty)</em>'}</span></label>
        <label class="chk chk-card"><input type="radio" name="importMeta_${esc(f.key)}" data-action="import-meta-choice" data-key="${esc(f.key)}" value="imported" ${chosen==='imported'?'checked':''}><span>Use imported: ${esc(f.incomingValue)}</span></label>
      </div>`;
    }).join('')}
  </div>` : '';
  const sectionsHtml = IMPORT_REVIEW_KINDS.map(kind=>importReviewSectionHtml(kind)).join('');
  el.innerHTML = `<div style="max-width:720px;">
    <h2 style="margin-top:0;">Review &amp; merge import</h2>
    <p style="font-size:12px;color:var(--text-muted);max-width:640px;">Decide what gets combined into your Library. Nothing is saved until you click "Import selected" below.</p>
    ${metaHtml}
    ${sectionsHtml}
    <div class="import-review-actions">
      <button class="btn btn-brass" id="btnImportReviewApply">Import selected</button>
      <button class="btn btn-ghost" id="btnImportReviewCancel">Cancel</button>
    </div>
  </div>`;
}
function importReviewSectionHtml(kind){
  const { payload, reviewState, includeMap } = IMPORT_REVIEW;
  const incomingEntries = payload.library[kind]||[];
  if(!incomingEntries.length) return '';
  const decisions = reviewState.sections[kind];
  const included = includeMap[kind];
  const rowsHtml = decisions.map((decision,i)=>{
    const source = incomingEntries.find(e=>e.id===decision.incomingId);
    const optionsHtml = (LIBRARY[kind]||[]).map(e=>`<option value="merge:${esc(e.id)}" ${decision.action==='merge'&&decision.mergeTargetId===e.id?'selected':''}>Merge into: ${esc(importReviewEntryLabel(kind,e))}</option>`).join('');
    const bulletsHtml = (decision.action==='merge' && importReviewEntryHasBullets(kind, source)) ? importReviewBulletsHtml(kind, decision, source, i) : '';
    const skillGroupCatsHtml = (kind==='skillGroups') ? importReviewSkillGroupCategoriesHtml(source) : '';
    return `<div class="entry" data-import-entry-kind="${kind}" data-import-entry-id="${esc(decision.incomingId)}">
      <div style="font-weight:600;font-size:13px;margin-bottom:4px;">${esc(importReviewEntryLabel(kind, source))}</div>
      <select data-action="import-entry-action" data-kind="${kind}" data-index="${i}">
        <option value="new" ${decision.action==='new'?'selected':''}>New entry</option>
        ${optionsHtml}
      </select>
      ${bulletsHtml}
      ${skillGroupCatsHtml}
    </div>`;
  }).join('');
  // Always rendered open (a real, reported minor finding: a collapsed <details> with the
  // include checkbox inside its body meant switching on an off-by-default section took two
  // clicks -- expand, then check -- instead of one). The checkbox remains the actual gate on
  // whether this section's entries get merged; open/closed no longer gates visibility at all.
  return `<details class="ed-block" open style="margin-top:12px;">
    <summary><span>${esc(IMPORT_REVIEW_KIND_LABELS[kind])} (${decisions.length})</span></summary>
    <label class="chk chk-card" style="margin-bottom:8px;"><input type="checkbox" data-action="import-section-toggle" data-kind="${kind}" ${included?'checked':''}><span>Include this section in this import</span></label>
    ${included?rowsHtml:'<p style="font-size:12px;color:var(--text-muted);">Section not included - check the box above to review these entries.</p>'}
  </details>`;
}
// Read-only preview of which skill categories a merged/new skill set will carry -- a real,
// reported asymmetry: bullets get a full per-item add/same/discard review when merging, but a
// skillGroups merge silently carried its categoryIds through with nothing shown at all. Full
// per-category review (like bullets) was judged out of scope for this pass -- a skill set's
// categories are matched by exact id already resolved via applyImportReview()'s remap, not
// user-editable one-by-one the way a bullet's inclusion is -- so this is visibility only,
// matching the same "position, not full interactivity" scoping the custom-section default-order
// fix used.
function importReviewSkillGroupCategoriesHtml(source){
  const { payload } = IMPORT_REVIEW;
  const cats = (source.categoryIds||[]).map(id=>{
    const s = (payload.library.skills||[]).find(x=>x.id===id);
    return s ? s.label : null;
  }).filter(Boolean);
  if(!cats.length) return '';
  return `<div class="sel-bullets"><div style="font-size:12px;color:var(--text-muted);">Includes categories: ${cats.map(c=>esc(c)).join(', ')}</div></div>`;
}
function importReviewBulletsHtml(kind, decision, source, entryIndex){
  const target = LIBRARY[kind].find(e=>e.id===decision.mergeTargetId);
  if(!target) return '';
  return `<div class="sel-bullets">${decision.bullets.map((bd,bi)=>{
    const b = source.bullets.find(x=>x.id===bd.incomingId);
    const optionsHtml = target.bullets.map(tb=>`<option value="same:${esc(tb.id)}" ${bd.action==='same'&&bd.sameAsBulletId===tb.id?'selected':''}>Same as existing: ${esc(tb.text.slice(0,50))}</option>`).join('');
    const tagsHtml = bd.action==='add' ? tagChipInputHtml('importReview', `sections.${kind}.${entryIndex}.bullets.${bi}.tags`, bd.tags) : '';
    return `<div class="sel-item" style="padding:6px 0;">
      <div style="font-size:12px;">${esc(b.text)}</div>
      <select data-action="import-bullet-action" data-kind="${kind}" data-entry-index="${entryIndex}" data-bullet-index="${bi}">
        <option value="add" ${bd.action==='add'?'selected':''}>Add</option>
        ${optionsHtml}
        <option value="discard" ${bd.action==='discard'?'selected':''}>Discard</option>
      </select>
      ${tagsHtml}
    </div>`;
  }).join('')}</div>`;
}
function onImportReviewEvent(ev){
  const t = ev.target;
  if(handleTagChipFilterInput(t)) return;
  // Every branch below notes history BEFORE mutating IMPORT_REVIEW's decision state -- same
  // ordering LIBRARY_HISTORY/VERSION_HISTORY already rely on (see this file's own comment on
  // checkboxes/selects firing both 'input' and 'change': noting on 'change' would snapshot the
  // already-mutated state as "before" and make undo a silent no-op).
  if(t.dataset.action==='import-section-toggle'){
    noteImportReviewHistoryImmediate();
    IMPORT_REVIEW.includeMap[t.dataset.kind] = t.checked;
    renderImportReviewView();
    return;
  }
  if(t.dataset.action==='import-entry-action'){
    noteImportReviewHistoryImmediate();
    const kind = t.dataset.kind, i = parseInt(t.dataset.index,10);
    const decision = IMPORT_REVIEW.reviewState.sections[kind][i];
    if(t.value==='new'){
      decision.action='new'; decision.mergeTargetId=null; decision.bullets=[];
    } else {
      const targetId = t.value.slice(6); // strips 'merge:'
      decision.action='merge'; decision.mergeTargetId=targetId;
      const source = IMPORT_REVIEW.payload.library[kind].find(e=>e.id===decision.incomingId);
      const target = LIBRARY[kind].find(e=>e.id===targetId);
      decision.bullets = importReviewEntryHasBullets(kind, source) ? suggestBulletDecisions(source.bullets, target.bullets, LIBRARY.tagOptions) : [];
    }
    renderImportReviewView();
    return;
  }
  if(t.dataset.action==='import-meta-choice'){
    noteImportReviewHistoryImmediate();
    IMPORT_REVIEW.metaChoices[t.dataset.key] = t.value;
    return;
  }
  if(t.dataset.action==='import-bullet-action'){
    noteImportReviewHistoryImmediate();
    const kind = t.dataset.kind, entryIndex = parseInt(t.dataset.entryIndex,10), bulletIndex = parseInt(t.dataset.bulletIndex,10);
    const bd = IMPORT_REVIEW.reviewState.sections[kind][entryIndex].bullets[bulletIndex];
    if(t.value==='add'){ bd.action='add'; bd.sameAsBulletId=null; }
    else if(t.value==='discard'){ bd.action='discard'; bd.sameAsBulletId=null; }
    else { bd.action='same'; bd.sameAsBulletId=t.value.slice(5); } // strips 'same:'
    renderImportReviewView();
    return;
  }
}
function onImportReviewClick(ev){
  if(handleTagChipClick(ev)) return;
  if(ev.target.closest('#btnImportReviewCancel')){
    IMPORT_REVIEW = null;
    clearImportReviewHistory();
    switchView('dashboard');
    toast('Import cancelled');
    return;
  }
  if(ev.target.closest('#btnImportReviewApply')){
    if(IMPORT_REVIEW_APPLYING) return; // a real, reported gap: rapid double-clicking could fire two overlapping imports
    applyImportReviewAndFinish();
  }
}
// Runs the reviewed decisions through the pure engine (js/03c_import_review.js), saves the
// resulting Library, and creates any version(s) from the file with their selection rewritten
// through the same remap table -- so a created version correctly points at wherever each
// piece of content actually ended up, whether merged into something existing or newly
// created. The bare-domain-link check still applies to whatever ends up in library.meta, but
// as a toast rather than a second blocking dialog -- the user already made an active choice
// about every header field that differed in this flow, unlike the Replace-everything path.
// A real, reported gap: nothing guarded against a rapid double-click on "Import selected"
// firing two overlapping runs of this function (two DB.saveLibrary() calls racing, versions
// potentially created twice). Set for the duration of the whole async run; onImportReviewClick()
// checks it before dispatching.
var IMPORT_REVIEW_APPLYING = false;
async function applyImportReviewAndFinish(){
  if(IMPORT_REVIEW_APPLYING) return;
  IMPORT_REVIEW_APPLYING = true;
  try{
    const { payload, reviewState, metaChoices, includeMap } = IMPORT_REVIEW;
    clearLibraryHistory(); clearVersionHistory(); clearImportReviewHistory(); // LIBRARY is about
    // to be replaced by the merge result below -- without this, Cmd+Z right after a merge import
    // would silently revert (and then persist, via the very next autosave) the merge itself, the
    // exact class of data loss this feature exists to prevent; the review's own undo stack is
    // cleared too since IMPORT_REVIEW is about to go null regardless.
    const { library: mergedLibrary, remap } = applyImportReview(LIBRARY, payload.library, reviewState.sections, includeMap);
    LIBRARY = applyImportMetaDecisions(mergedLibrary, payload.library.meta||{}, reviewState.metaFields, metaChoices);
    const res = await DB.saveLibrary(LIBRARY, LIBRARY_REVISION);
    if(res.ok) LIBRARY_REVISION = res.revision;
    else if(res.conflict){ showSyncConflict('library', res.serverRow); }
    // The imported file's versions are untrusted data -- a hand-edited/malformed file can be
    // missing `selection` or `jobMeta` entirely (remapVersionSelection()/DB.createVersion() both
    // assume they exist). Each version is created independently inside its own try/catch so one
    // malformed entry doesn't abort the whole import after LIBRARY has already been saved, and
    // doesn't leave IMPORT_REVIEW stuck populated with no error surfaced.
    const skippedVersionNames = [];
    for(const id in (payload.versions||{})){
      const versionData = payload.versions[id];
      try{
        if(!versionData || !versionData.selection || !versionData.jobMeta){
          throw new Error('version entry is missing selection or jobMeta');
        }
        const remapped = { ...versionData, id: uid(), selection: remapVersionSelection(versionData.selection, remap) };
        const created = await DB.createVersion(remapped);
        if(created) VERSION_REVISIONS[remapped.id] = created.revision;
      }catch(e){
        console.error('Import Review: skipped a malformed version entry', id, e);
        skippedVersionNames.push((versionData && versionData.name) || id);
      }
    }
    VERSIONS_INDEX = await DB.listVersions();
    const flagged = Object.keys(IMPORT_LINK_FIELD_LABELS).filter(k=>isLikelyLabelNotUrl(LIBRARY.meta[k]));
    IMPORT_REVIEW = null;
    switchView('dashboard');
    const parts = ['Import complete'];
    if(skippedVersionNames.length) parts.push('skipped '+skippedVersionNames.length+' invalid version'+(skippedVersionNames.length>1?'s':'')+' ('+skippedVersionNames.join(', ')+')');
    if(flagged.length) parts.push('check your '+flagged.map(f=>IMPORT_LINK_FIELD_LABELS[f]).join('/')+' link'+(flagged.length>1?'s':'')+' in the Library tab');
    toast(parts.join(' - '));
  } finally {
    IMPORT_REVIEW_APPLYING = false;
  }
}
// Shown only when onImportFile() detects a label-only contact link above. A dynamically-
// created overlay (appended to document.body, not a pre-built panel in index.html) since
// it's a rare, one-off dialog.
function showImportLinkPrompt(payload, flaggedFields){
  hideImportLinkPrompt();
  const wrap = document.createElement('div');
  wrap.id = 'importLinkDialog';
  wrap.className = 'gh-modal-overlay';
  const plural = flaggedFields.length>1;
  wrap.innerHTML = `
    <div class="gh-modal-box">
      <div class="gh-modal-header"><h3>Missing profile link${plural?'s':''}</h3></div>
      <div class="gh-modal-body">
        <p>This file's ${flaggedFields.map(f=>IMPORT_LINK_FIELD_LABELS[f]).join('/')} field${plural?'s look':' looks'} like a label, not a real URL. Enter the real link${plural?'s':''} now, or leave blank and add it later from the Library tab.</p>
        ${flaggedFields.map(f=>`<div class="field"><label>${IMPORT_LINK_FIELD_LABELS[f]} URL</label><input type="text" id="importLink_${f}" placeholder="https://…"><p style="font-size:11px;color:var(--text-muted);margin:2px 0 0;">detected: "${esc(payload.library.meta[f])}"</p></div>`).join('')}
      </div>
      <div class="gh-actions">
        <button class="btn btn-brass" id="btnImportLinkContinue">Continue import</button>
        <button class="btn btn-ghost" id="btnImportLinkCancel">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  document.getElementById('btnImportLinkContinue').addEventListener('click', async ()=>{
    const btn = document.getElementById('btnImportLinkContinue');
    btn.disabled = true; btn.textContent = 'Importing…';
    flaggedFields.forEach(f=>{ payload.library.meta[f] = document.getElementById('importLink_'+f).value.trim(); });
    try{
      await importJsonPayload(payload);
      hideImportLinkPrompt();
      renderDashboard();
      toast('Import complete');
    }catch(e){
      console.error(e);
      hideImportLinkPrompt();
      toast('Import failed: '+e.message);
    }
  });
  document.getElementById('btnImportLinkCancel').addEventListener('click', ()=>{ hideImportLinkPrompt(); toast('Import cancelled'); });
}
function hideImportLinkPrompt(){
  const el = document.getElementById('importLinkDialog');
  if(el) el.remove();
}

/* ===== library manager ===== */
function entryLabel(kind, e){
  if(kind==='experience') return e.company;
  if(kind==='projects') return e.title;
  if(kind==='education') return e.school;
  if(kind==='skills') return e.label;
  // No more `label` field (see newLibraryEntry('summaries') in js/03_model.js) -- a summary
  // is identified by a preview of its own text everywhere it needs a display name (this
  // dropdown/picker option text, the Import Review match label, etc). A stray `label` field
  // left over on data saved before this change is simply never read again, not migrated away.
  if(kind==='summaries') return (e.text||'').slice(0,40) || '(untitled summary)';
  if(kind==='references') return e.name;
  if(kind==='customSections') return e.heading;
  return '';
}
function metaFormHtml(){
  const m = LIBRARY.meta;
  return `<div class="entry">
    <div class="field-row">
      <div class="field"><label>Full name</label><input type="text" data-path="meta.name" value="${esc(m.name)}"></div>
      <div class="field"><label>Location</label><input type="text" data-path="meta.location" value="${esc(m.location)}"></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Phone</label><input type="text" data-path="meta.phone" value="${esc(m.phone)}"></div>
      <div class="field"><label>Email</label><input type="text" data-path="meta.email" value="${esc(m.email)}"></div>
    </div>
    <div class="field-row3">
      <div class="field"><label>LinkedIn URL</label><input type="text" data-path="meta.linkedin" value="${esc(m.linkedin)}"></div>
      <div class="field"><label>GitHub URL</label><input type="text" data-path="meta.github" value="${esc(m.github)}"></div>
      <div class="field"><label>Portfolio URL</label><input type="text" data-path="meta.portfolio" value="${esc(m.portfolio)}"></div>
    </div>
  </div>`;
}
function bulletRowHtml(kind, entryIndex, entryId, b, bi){
  const path = `${kind}.${entryIndex}.bullets.${bi}.text`;
  const usage = bulletUsageVersions(kind, entryId, b.id);
  return `<div class="bullet-row">
    <div class="bullet-row-main">
      <textarea data-path="${path}" rows="2">${esc(b.text)}</textarea>
      <div class="field-save-row">
        ${usageLabelHtml(usage)}
        <span class="field-save-slot" data-save-path="${esc(path)}" data-save-kind="${esc(kind)}" data-save-ref="${esc(entryId)}" data-save-bullet="${esc(b.id)}"></span>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end;">
      ${tagChipInputHtml('library', `${kind}.${entryIndex}.bullets.${bi}.tags`, b.tags)}
      ${hasMetric(b.text)?'<span class="metric-ok">has metric</span>':'<span class="metric-flag">no metric</span>'}
      <button class="btn btn-danger btn-icon" data-action="remove-bullet" data-kind="${kind}" data-id="${esc(entryId)}" data-bid="${esc(b.id)}">${ICONS.close}</button>
    </div>
  </div>`;
}
// Empty by default -- filled in with a small Save button, via direct DOM manipulation (not a
// re-render, which would steal focus mid-typing), the moment its field goes dirty while used
// by at least one version. See markFieldPendingSave()/onLibraryInput() below.
function fieldSaveSlotHtml(path){
  return `<span class="field-save-slot" data-save-path="${esc(path)}"></span>`;
}
// Shared collapsible wrapper for Experience/Projects/Skills cards -- collapsible, default
// collapsed, on request. Reuses the exact `.ed-block`/`<details>` component every other
// collapsible panel in the app already uses (Skill Sets cards, the editor's own panels --
// see css/style.css's own comment on `.ed-block` being "the one shared component behind
// every collapsible panel in the entire app"), so open/closed state persists across
// re-renders for free via renderLibrary()'s existing generic data-block-key capture/
// restore -- no changes needed there. `bodyHtml` is passed through completely unchanged
// from what each kind rendered before this wrapper existed, so an opened card looks
// exactly like it did when cards weren't collapsible at all.
function collapsibleEntryCardHtml(key, summaryLabel, usageLine, extraSummaryHtml, bodyHtml, isOpen){
  return `<details class="ed-block entry-collapsible" data-block-key="${esc(key)}" ${isOpen(key, false)}>
    <summary><span>${summaryLabel}</span>${usageLine}${extraSummaryHtml}</summary>
    ${bodyHtml}
  </details>`;
}
function entryCardHtml(kind, e, i, isOpen){
  // esc() on every id below -- ids are always safe (uid()-generated) EXCEPT after "Replace
  // everything" import (importJsonPayload() takes the incoming file's own entry ids verbatim,
  // see its own comment) or a standalone version's embeddedLibrary (same reason, see
  // buildEmbeddedLibrary() in js/03_model.js). A crafted id containing a stray `"` could
  // otherwise break out of these attributes and inject a live event-handler attribute --
  // exactly the class of stored-XSS bug already found and fixed once for Import Review's own
  // id interpolation (see CLAUDE.md's "Tags" section) -- applying it here closes the same gap
  // at every other id-interpolation site in the Library tab.
  // One shared, static "Used in N versions" line per entry (not repeated per field) -- an
  // entry's usage count is the same regardless of which of its fields you're looking at, so
  // showing it once near the top avoids the entry card turning into a wall of identical
  // labels. Each field below still gets its own Save-button *slot* (fieldSaveSlotHtml()),
  // since which specific field is dirty is what actually varies.
  // Summaries are referenced singularly (selection.summaryId), not as an array entry like
  // every other kind here -- summaryUsageVersions() is the matching lookup for that shape.
  const usageVersions = kind==='tagOptions' ? [] : kind==='summaries' ? summaryUsageVersions(e.id) : entryUsageVersions(kind, e.id);
  const usageLine = usageLabelHtml(usageVersions);
  // Shares the row with the remove button rather than sitting on its own line above the
  // fields -- a real, reported bug: as its own block, this line's presence/absence between
  // sibling cards in the same multi-column .lib-grid row (e.g. Skills) pushed each card's
  // fields down by a different amount, so "Category label" started at a different height in
  // every card and, combined with the grid's own align-items:stretch, left visibly uneven
  // empty space in whichever card had no usage to report. Folding it into .entry-top (now
  // justify-content:space-between when the label is present, so the remove button stays
  // pinned to the right either way) keeps every card's field block starting at the exact
  // same offset regardless of usage count.
  // Never repeated here -- the collapsed summary row (collapsibleEntryCardHtml()) already
  // shows this badge for every kind, visible without opening the card at all; showing it a
  // second time down here once the card is open was a real, reported duplicate.
  const rm = `<div class="entry-top"><button class="btn btn-danger btn-icon" data-action="remove-entry" data-kind="${kind}" data-id="${esc(e.id)}">${ICONS.close}</button></div>`;
  if(kind==='experience'){
    // Collapsible, default collapsed, on request -- the collapsed summary shows the
    // identifying "Company - Role" text plus the usage badge (both requested explicitly),
    // so an entry's use/identity is visible without opening it; the expanded body below is
    // completely unchanged from the pre-collapsible markup. Plain hyphen, not an em dash --
    // see "Remove the em dashes" below.
    const summaryLabel = `${esc(e.company||'(untitled)')}${e.role?' - '+esc(e.role):''}`;
    const body = `<div class="entry">${rm}
      <div class="field-row">
        <div class="field"><label>Company</label><input type="text" data-path="experience.${i}.company" value="${esc(e.company)}">${fieldSaveSlotHtml(`experience.${i}.company`)}</div>
        <div class="field"><label>Note (optional)</label><input type="text" placeholder="e.g. Internship, Contract" data-path="experience.${i}.tag" value="${esc(e.tag)}">${fieldSaveSlotHtml(`experience.${i}.tag`)}</div>
      </div>
      <div class="field-row">
        <div class="field"><label>Role</label><input type="text" data-path="experience.${i}.role" value="${esc(e.role)}">${fieldSaveSlotHtml(`experience.${i}.role`)}</div>
        <div class="field"><label>Dates</label><input type="text" data-path="experience.${i}.dates" value="${esc(e.dates)}">${fieldSaveSlotHtml(`experience.${i}.dates`)}</div>
      </div>
      <div class="field"><label>Location</label><input type="text" data-path="experience.${i}.location" value="${esc(e.location)}">${fieldSaveSlotHtml(`experience.${i}.location`)}</div>
      <div style="font-size:11px;color:var(--text-muted);margin:8px 0 4px;">Bullets</div>
      ${e.bullets.map((b,bi)=>bulletRowHtml('experience',i,e.id,b,bi)).join('')}
      <button class="btn btn-ghost btn-sm" data-action="add-bullet" data-kind="experience" data-id="${esc(e.id)}">+ Add bullet</button>
    </div>`;
    return collapsibleEntryCardHtml('experience:'+e.id, summaryLabel, usageLine, '', body, isOpen);
  }
  if(kind==='projects'){
    const summaryLabel = esc(e.title||'(untitled)');
    const body = `<div class="entry">${rm}
      <div class="field-row">
        <div class="field"><label>Title</label><input type="text" data-path="projects.${i}.title" value="${esc(e.title)}">${fieldSaveSlotHtml(`projects.${i}.title`)}</div>
        <div class="field"><label>Dates</label><input type="text" data-path="projects.${i}.dates" value="${esc(e.dates)}">${fieldSaveSlotHtml(`projects.${i}.dates`)}</div>
      </div>
      <div style="font-size:11px;color:var(--text-muted);margin:8px 0 4px;">Bullets</div>
      ${e.bullets.map((b,bi)=>bulletRowHtml('projects',i,e.id,b,bi)).join('')}
      <button class="btn btn-ghost btn-sm" data-action="add-bullet" data-kind="projects" data-id="${esc(e.id)}">+ Add bullet</button>
    </div>`;
    return collapsibleEntryCardHtml('projects:'+e.id, summaryLabel, usageLine, '', body, isOpen);
  }
  if(kind==='education'){
    const summaryLabel = `${esc(e.school||'(untitled)')}${e.degree?' - '+esc(e.degree):''}`;
    const body = `<div class="entry">${rm}
      <div class="field-row">
        <div class="field"><label>School</label><input type="text" data-path="education.${i}.school" value="${esc(e.school)}">${fieldSaveSlotHtml(`education.${i}.school`)}</div>
        <div class="field"><label>Location</label><input type="text" data-path="education.${i}.location" value="${esc(e.location)}">${fieldSaveSlotHtml(`education.${i}.location`)}</div>
      </div>
      <div class="field-row">
        <div class="field"><label>Degree</label><input type="text" data-path="education.${i}.degree" value="${esc(e.degree)}">${fieldSaveSlotHtml(`education.${i}.degree`)}</div>
        <div class="field"><label>Dates</label><input type="text" data-path="education.${i}.dates" value="${esc(e.dates)}">${fieldSaveSlotHtml(`education.${i}.dates`)}</div>
      </div>
    </div>`;
    return collapsibleEntryCardHtml('education:'+e.id, summaryLabel, usageLine, '', body, isOpen);
  }
  if(kind==='skills'){
    const body = `<div class="entry">${rm}
      <div class="field"><label>Category label</label><input type="text" data-path="skills.${i}.label" value="${esc(e.label)}">${fieldSaveSlotHtml(`skills.${i}.label`)}</div>
      <div class="field"><label>Items</label><input type="text" data-path="skills.${i}.text" value="${esc(e.text)}">${fieldSaveSlotHtml(`skills.${i}.text`)}</div>
      <div class="field"><label>Tags</label>${tagChipInputHtml('library', `skills.${i}.tags`, e.tags)}</div>
    </div>`;
    // Collapsed summary shows the category label plus its own tag badges, on request ("Label
    // with tag") -- reuses bulletTagBadgesHtml(), the same tag-badge component every other
    // Skill-tags surface in the app already renders with.
    return collapsibleEntryCardHtml('skills:'+e.id, esc(e.label||'(untitled category)'), usageLine, bulletTagBadgesHtml(e.tags), body, isOpen);
  }
  if(kind==='summaries'){
    // The free-text "Label" field (used only to tell summary variants apart -- "General" vs.
    // "Technical" vs. "Leadership" -- never printed) was replaced with the shared tag system on
    // request, so a summary can be found by "Fill in with tag" the same way tagged bullets/skill
    // categories already are, instead of a name only a human reading it could ever match to a
    // role. See versionFillByTag()'s summary branch (js/03_model.js) for how a tag pick now
    // single-selects a matching summary as the version's active one.
    // Collapsed summary shows a text preview (same 40-char truncation entryLabel() already
    // uses elsewhere for a summary with no title field of its own) plus its own tag badges --
    // resolved via AskUserQuestion ("How can we do for summary??") rather than guessed, since
    // there's no natural single identifying field the way Experience/Education/References have.
    const previewText = (e.text||'').trim();
    const summaryLabel = esc(previewText ? (previewText.length>50 ? previewText.slice(0,50)+'…' : previewText) : '(untitled summary)');
    const body = `<div class="entry">${rm}
      <div class="field"><label>Text</label><textarea data-path="summaries.${i}.text" rows="3">${esc(e.text)}</textarea>${fieldSaveSlotHtml(`summaries.${i}.text`)}</div>
      <div class="field"><label>Tags</label>${tagChipInputHtml('library', `summaries.${i}.tags`, e.tags)}</div>
    </div>`;
    return collapsibleEntryCardHtml('summaries:'+e.id, summaryLabel, usageLine, bulletTagBadgesHtml(e.tags), body, isOpen);
  }
  if(kind==='references'){
    const summaryLabel = `${esc(e.name||'(untitled)')}${e.title?' - '+esc(e.title):''}`;
    const body = `<div class="entry">${rm}
      <div class="field-row">
        <div class="field"><label>Name</label><input type="text" data-path="references.${i}.name" value="${esc(e.name)}">${fieldSaveSlotHtml(`references.${i}.name`)}</div>
        <div class="field"><label>Title / relationship</label><input type="text" data-path="references.${i}.title" value="${esc(e.title)}">${fieldSaveSlotHtml(`references.${i}.title`)}</div>
      </div>
      <div class="field"><label>Contact</label><input type="text" data-path="references.${i}.contact" value="${esc(e.contact)}">${fieldSaveSlotHtml(`references.${i}.contact`)}</div>
    </div>`;
    return collapsibleEntryCardHtml('references:'+e.id, summaryLabel, usageLine, '', body, isOpen);
  }
  if(kind==='customSections'){
    const bulletsBlock = e.contentType==='bullets' ? `
      <div style="font-size:11px;color:var(--text-muted);margin:8px 0 4px;">Bullets</div>
      ${e.bullets.map((b,bi)=>bulletRowHtml('customSections',i,e.id,b,bi)).join('')}
      <button class="btn btn-ghost btn-sm" data-action="add-bullet" data-kind="customSections" data-id="${esc(e.id)}">+ Add bullet</button>` : '';
    const paragraphBlock = e.contentType==='paragraph' ? `
      <div class="field"><label>Text (use **word** for inline bold)</label><textarea data-path="customSections.${i}.text" rows="3">${esc(e.text)}</textarea>${fieldSaveSlotHtml(`customSections.${i}.text`)}</div>` : '';
    const summaryLabel = `${esc(e.heading||'(untitled)')}${e.subheading?' - '+esc(e.subheading):''}`;
    const body = `<div class="entry">${rm}
      <div class="field"><label>Heading</label><input type="text" data-path="customSections.${i}.heading" value="${esc(e.heading)}">${fieldSaveSlotHtml(`customSections.${i}.heading`)}</div>
      <div class="field-row">
        <div class="field"><label>Subheading (optional)</label><input type="text" placeholder="e.g. issuing organization" data-path="customSections.${i}.subheading" value="${esc(e.subheading||'')}">${fieldSaveSlotHtml(`customSections.${i}.subheading`)}</div>
        <div class="field"><label>Location (optional)</label><input type="text" data-path="customSections.${i}.location" value="${esc(e.location||'')}">${fieldSaveSlotHtml(`customSections.${i}.location`)}</div>
      </div>
      <div class="field"><label>Dates (optional)</label><input type="text" data-path="customSections.${i}.dates" value="${esc(e.dates||'')}">${fieldSaveSlotHtml(`customSections.${i}.dates`)}</div>
      <div class="field"><label>Content type</label><select data-path="customSections.${i}.contentType">
        <option value="bullets" ${e.contentType==='bullets'?'selected':''}>Bullets</option>
        <option value="paragraph" ${e.contentType==='paragraph'?'selected':''}>Paragraph</option>
      </select></div>
      ${bulletsBlock}${paragraphBlock}
    </div>`;
    return collapsibleEntryCardHtml('customSections:'+e.id, summaryLabel, usageLine, '', body, isOpen);
  }
  if(kind==='tagOptions'){
    return `<div class="entry">${rm}
      <div class="field"><label>Tag label</label><input type="text" data-path="tagOptions.${i}.label" value="${esc(e.label)}"></div>
    </div>`;
  }
  return '';
}
// Collapsible, on request ("in Skill Sets, I want a set to be collapsable") -- a real
// clutter problem once an account has more than a couple of sets, each showing every skill
// category in the library as its own checkbox. Reuses the exact `.ed-block`/`<details>`
// component the editor's own collapsible panels already use (see css/style.css's own
// comment on it being "the one shared component behind every collapsible panel in the
// entire app") rather than inventing a second collapse pattern. `isOpen` is threaded down
// from renderLibrary() (mirrors renderEditor()'s own open-state capture/restore, see there
// for the full reasoning) -- without it, toggling a category on a set that has other
// versions using it would immediately re-collapse the very set being edited, since that
// toggle triggers a real renderLibrary() call to show the impact dialog.
// Not a generic collapsible panel (on request -- "the skill sets in the library need not be
// collapsable, I want 'edit this set' and then the selection thing"): closed by default, an
// explicit "Edit this set" label (not a chevron) is the only way in, and the "selection
// thing" it reveals is the same category checklist as always, except each row is now also
// directly editable -- "in the selection itself I want to be able to edit the skills there."
// Still built on <details>/<summary> under the hood (reusing renderLibrary()'s own
// open-state capture/restore, same as every other collapsible block in this app) -- only the
// visible affordance changed, not the mechanism.
function skillGroupCardHtml(sg, i, isOpen){
  // Select only, see the content, don't edit it here -- on request ("I only want to be able
  // to select the skills (but see the content), not edit them there"). A category's own card
  // (further up this same Skills tab) is already the one place to edit its label/text/tags;
  // this checklist's only job is membership. Checkbox + read-only label/items/tags, same
  // "content visible, not live-editable" shape skillSetSelectorHtml() already uses for the
  // editor's own version of this list.
  const catRowsList = LIBRARY.skills.map(cat=>{
    const checked = sg.categoryIds.includes(cat.id);
    return `<label class="skillgroup-cat-row">
      <input type="checkbox" data-action="toggle-skillgroup-category" data-group-id="${esc(sg.id)}" data-cat-id="${esc(cat.id)}" ${checked?'checked':''}>
      <span class="skillgroup-cat-row-content">
        <span class="skillgroup-cat-row-label">${esc(cat.label||'(untitled category)')}</span>
        ${cat.text ? `<span class="skillgroup-cat-row-items">${esc(cat.text)}</span>` : ''}
        ${bulletTagBadgesHtml(cat.tags)}
      </span>
    </label>`;
  });
  // One column, not a nested grid -- see skillGroupCardHtml's own comment above on why: the
  // card itself now always stays inside its own .lib-grid-2 column (never spans full width
  // just because it's open), so a single-column stack of rows already has comfortable room.
  const catRows = catRowsList.length ? `<div class="skillgroup-cat-list">${catRowsList.join('')}</div>` : '<p style="font-size:12px;color:var(--text-muted);">Add a skill category above first, then include it in this set.</p>';
  // Membership changes (checking/unchecking a category) are checked for impact immediately
  // on click, not behind a Save button -- see onLibraryClick()'s toggle-skillgroup-category
  // branch. A checkbox toggle is already one discrete, complete action. The label/items
  // fields above it are a different story -- they're the exact same data-path (skills.N.*)
  // the category's own standalone card up in the main Skills list already uses, so they go
  // through the identical Save-button + impact-dialog flow (commitFieldSave()) as editing it
  // there would -- editing a category's content from inside a Skill Set's checklist is not a
  // separate, lesser-checked path.
  const usage = skillGroupUsageVersions(sg.id);
  const usageLine = usageLabelHtml(usage);
  const n = sg.categoryIds.length;
  // Collapsible via the same generic +/- chevron every other card here uses now, on request
  // ("remove that edit this set and make it collapsable like the others") -- the earlier
  // "Edit this set"/"Done" text toggle (and its own dedicated `toggle` event listener) is
  // removed entirely; open/closed state still persists the same way, via the shared
  // data-block-key capture/restore in renderLibrary().
  const summaryLabel = `${esc(sg.label||'(untitled set)')} <span style="font-weight:400;color:var(--text-muted);">(${n} ${n===1?'category':'categories'})</span>`;
  const body = `<div class="entry">
      <div class="entry-top"><button class="btn btn-danger btn-icon" data-action="remove-entry" data-kind="skillGroups" data-id="${esc(sg.id)}">${ICONS.close}</button></div>
      <div class="field"><label>Set name</label><input type="text" data-path="skillGroups.${i}.label" value="${esc(sg.label)}"></div>
      <div style="font-size:11px;color:var(--text-muted);margin:8px 0 4px;">Categories in this set</div>
      ${catRows}
    </div>`;
  return collapsibleEntryCardHtml('sg:'+sg.id, summaryLabel, usageLine, '', body, isOpen);
}
// Skill Sets -- named bundles of the skills categories above (LIBRARY.skillGroups), picked
// as a whole from the editor's Skills section (see skillSetSelectorHtml() in Task 5)
// instead of re-ticking individual categories on every new version. Rendered as a second
// block within the same Skills library tab, not a separate tab of its own -- it's a saved
// view over these same categories, not a different kind of content.
function skillGroupsSectionHtml(isOpen){
  const groups = LIBRARY.skillGroups||[];
  // 2 columns, on request -- closed cards (the default) are compact enough to sit two-across;
  // an opened card spans both columns instead of being squeezed into half-width (see the
  // .skillgroup-block[open] rule in css/style.css), so editing one is never cramped just
  // because the grid it lives in is 2-wide.
  const cardsHtml = groups.length ? `<div class="lib-grid lib-grid-2">${groups.map((sg,i)=>skillGroupCardHtml(sg,i,isOpen)).join('')}</div>` : '';
  return `<div class="skillgroups-section">
    <div style="font-size:13px;font-weight:600;margin-bottom:6px;">Skill Sets</div>
    <p style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">Bundle the categories above into a named set you can pick as a whole from a version's editor.</p>
    <div style="margin-bottom:10px;"><button class="btn btn-ghost btn-sm" data-action="add-entry" data-kind="skillGroups">+ Add skill set</button></div>
    ${cardsHtml}
  </div>`;
}
// Grid column counts, on request ("skills... and tags are only one column so it's like a
// long list") -- kinds not listed here keep the original single-column stack (experience/
// projects/education/etc. cards are tall and full of fields, so a grid would just squeeze
// them; skill categories and tags are short enough that stacking them wasted most of the
// panel's width).
const LIB_GRID_COLS = { skills: 2, tagOptions: 3 };
function libKindHtml(kind, isOpen){
  const items = LIBRARY[kind]||[];
  const labelMap = {experience:'experience',projects:'project',education:'education',skills:'skill category',summaries:'summary',references:'reference',customSections:'custom section',tagOptions:'tag'};
  const cardsList = items.map((e,i)=> entryCardHtml(kind,e,i,isOpen));
  const gridCols = LIB_GRID_COLS[kind];
  const cards = gridCols ? `<div class="lib-grid lib-grid-${gridCols}">${cardsList.join('')}</div>` : cardsList.join('');
  // Pinned to the top of every section, on request ("Move and pin the add {} button to the
  // top in every section in the library") -- it used to render after every card, which on a
  // section with a lot of entries meant scrolling all the way past them just to add another
  // one. margin-bottom (not -top) now, since it leads instead of trails.
  const addSection = `<div style="margin-bottom:10px;"><button class="btn btn-ghost btn-sm" data-action="add-entry" data-kind="${kind}">+ Add ${labelMap[kind]}</button></div>`;
  // Skill Sets lives inside the Skills tab (a saved view over these same categories), not
  // as a separate library kind tab of its own -- see skillGroupsSectionHtml().
  return kind==='skills' ? addSection + cards + skillGroupsSectionHtml(isOpen) : addSection + cards;
}
// UI/UX audit finding: switching between Experience/Projects/Education/etc. (and every
// add/remove-entry or add/remove-bullet action, the only other things that call this function
// -- never plain typing, see onLibraryInput()'s own 'structural' check) re-rendered #libPanels
// instantly with no transition, unlike the top-level .view switch which fades. CSS-only,
// reusing view-fade-in again -- same reasoning as .settings-dropdown just above: a plain fade
// here looks identical with or without GSAP, so the library gets used only where it's actually
// earning something over free CSS. Unlike .settings-dropdown's own display:none->block trick,
// #libPanels never toggles display -- its content just gets replaced in place -- so a CSS
// animation on a static class wouldn't replay on its own; removing then re-adding the class
// (with a forced reflow via offsetWidth in between) is what actually restarts it every call,
// the standard way to re-trigger a CSS animation without recreating the element.
// Fetches every version's real selection data and builds LIBRARY_USAGE_INDEX (buildUsageIndex(),
// js/03_model.js) -- called once whenever the Library tab is opened (switchView()), never on
// every keystroke or every renderLibrary() call, since it's a real network round trip. A stale
// index (another tab deleting/editing a version while this one sits open on Library) is an
// accepted looseness at this app's scale -- the same tradeoff TRASH_COUNT's own comment
// documents -- reopening the Library tab (or the whole app) picks up the true state again.
async function refreshLibraryUsageIndex(){
  const versionsFull = await DB.listVersionSelections();
  LIBRARY_USAGE_INDEX = buildUsageIndex(versionsFull);
  if(VIEW==='library') renderLibrary();
}
// Usage lookups -- all tolerate LIBRARY_USAGE_INDEX still being null (before the Library tab's
// own fetch above has resolved for the first time this session), degrading to "0 versions use
// this," which is exactly today's pre-feature behavior: frictionless, uninterrupted autosave.
function entryUsageVersions(kind, refId){
  if(!LIBRARY_USAGE_INDEX) return [];
  return LIBRARY_USAGE_INDEX.entryUsage[kind+':'+refId] || [];
}
function bulletUsageVersions(kind, refId, bulletId){
  if(!LIBRARY_USAGE_INDEX) return [];
  return LIBRARY_USAGE_INDEX.bulletUsage[kind+':'+refId+':'+bulletId] || [];
}
function skillGroupUsageVersions(groupId){
  if(!LIBRARY_USAGE_INDEX) return [];
  return LIBRARY_USAGE_INDEX.skillGroupUsage[groupId] || [];
}
// Summaries are referenced singularly (selection.summaryId), not as an array entry the way
// experience/projects/etc. are -- buildUsageIndex() tracks them in their own map for exactly
// this reason, so this needs its own lookup rather than reusing entryUsageVersions().
function summaryUsageVersions(summaryId){
  if(!LIBRARY_USAGE_INDEX) return [];
  return LIBRARY_USAGE_INDEX.summaryUsage[summaryId] || [];
}
// A small, always-visible pill -- "Used in 3 versions" -- next to any Library field/bullet
// that's currently referenced somewhere, so the *scale* of an edit is visible before you even
// start typing, not just at the moment you try to save it (see the Save-button gate below for
// that half of this feature). Renders nothing at all when the count is 0, which is also the
// correct/expected look for a brand-new, not-yet-used entry -- no visual noise for the common
// case.
function usageLabelHtml(versions){
  if(!versions.length) return '';
  const n = versions.length;
  return `<span class="usage-label">Used in ${n} version${n===1?'':'s'}</span>`;
}
function renderLibrary(){
  document.querySelectorAll('#libTabs button').forEach(b=>b.classList.toggle('active', b.dataset.kind===LIB_TAB));
  const wrap = document.getElementById('libPanels');
  // Preserve every Skill Set card's open/closed state across the full innerHTML rebuild --
  // same pattern and reasoning as renderEditor()'s own data-block-key capture/restore (see
  // there): this function reruns on structural changes within the same tab (e.g. a category
  // toggle that has usage-impact fallout), which would otherwise silently re-collapse every
  // card back to its default on every such re-render.
  const openState = {};
  wrap.querySelectorAll('details.ed-block[data-block-key]').forEach(d=>{ openState[d.dataset.blockKey] = d.open; });
  const isOpen = (key, defaultOpen) => (openState[key]!==undefined ? openState[key] : defaultOpen) ? 'open' : '';
  wrap.classList.remove('lib-panel-fade');
  void wrap.offsetWidth;
  wrap.innerHTML = LIB_TAB==='meta' ? metaFormHtml() : libKindHtml(LIB_TAB, isOpen);
  wrap.classList.add('lib-panel-fade');
}

/* ===== Library impact dialog -- "this affects N other versions" ==========================
   Added on request ("if I change a bullet in the library... our app must ask the user").
   One shared dialog for every usage-gated edit -- text fields (commitFieldSave() above) and
   Skill Set membership toggles (onLibraryClick()'s toggle-skillgroup-category branch) alike --
   since the choice offered is identical either way: update every affected version, freeze the
   old value in all of them, or choose per version. "Freeze" reuses the per-version override
   system that already exists for every other kind (versionSetOverride/versionSetBulletOverride,
   js/03_model.js); summaries use their own pre-existing free-text slot instead (customSummaryText,
   the same mechanism the entry-edit modal's own "Only this version" choice already uses for a
   summary); Skill Sets use the new versionSetSkillGroupOverride() added alongside this feature. */
var LIBRARY_IMPACT = null; // shape: { path?, kind, refId, bulletId?, field?, originalValue?, isSkillGroup?, groupId?, originalCategoryIds?, versions:[{id,name}] }
var LIBRARY_IMPACT_MODE = 'summary'; // 'summary' (two big buttons) | 'perVersion' (a checklist)
var LIBRARY_IMPACT_CHOICES = {}; // versionId -> 'update'|'freeze', only meaningful in perVersion mode
// Set for the duration of a real, awaited Update/Freeze/Apply request -- a real, reported bug:
// the dialog's own Close (X) / backdrop-click handler used to call resolveLibraryImpact('update')
// unconditionally, with no guard against an Update/Freeze/Apply request already in flight. Clicking
// X while "Applying…" was still showing fired a SECOND, concurrent resolution on top of the first,
// and the busy flag below is what makes that impossible now -- see cancelLibraryImpact().
var LIBRARY_IMPACT_BUSY = false;
function showLibraryImpactDialog(impact){
  LIBRARY_IMPACT = impact;
  LIBRARY_IMPACT_MODE = 'summary';
  LIBRARY_IMPACT_CHOICES = {};
  LIBRARY_IMPACT_BUSY = false;
  impact.versions.forEach(v=> LIBRARY_IMPACT_CHOICES[v.id]='update');
  renderLibraryImpactDialog();
}
function renderLibraryImpactDialog(){
  const wrap = document.getElementById('libraryImpactWrap');
  if(!wrap) return;
  if(!LIBRARY_IMPACT){ wrap.innerHTML=''; return; }
  const isFreshOpen = wrap.children.length===0;
  const { versions } = LIBRARY_IMPACT;
  const n = versions.length;
  const listHtml = `<ul class="impact-version-list">${versions.map(v=>`<li>${esc(v.name)}</li>`).join('')}</ul>`;
  const bodyHtml = LIBRARY_IMPACT_MODE==='summary' ? `
    ${listHtml}
    <div class="gh-actions" style="padding:14px 0 0;border-top:none;">
      <button class="btn btn-brass btn-sm" id="impactUpdateAll">Update all ${n}</button>
      <button class="btn btn-ghost btn-sm" id="impactFreezeAll">Freeze old wording in all ${n}</button>
    </div>
    <button class="impact-per-version-link" id="impactChoosePerVersion">Choose per version instead</button>
  ` : `
    <div class="impact-per-version-list">
      ${versions.map(v=>`
        <div class="impact-version-row">
          <span class="impact-version-name">${esc(v.name)}</span>
          <div class="impact-version-choice">
            <label class="chk"><input type="radio" name="impactChoice_${esc(v.id)}" data-action="impact-choice" data-version-id="${esc(v.id)}" value="update" ${LIBRARY_IMPACT_CHOICES[v.id]==='update'?'checked':''}> Update</label>
            <label class="chk"><input type="radio" name="impactChoice_${esc(v.id)}" data-action="impact-choice" data-version-id="${esc(v.id)}" value="freeze" ${LIBRARY_IMPACT_CHOICES[v.id]==='freeze'?'checked':''}> Freeze old wording</label>
          </div>
        </div>`).join('')}
    </div>
    <div class="gh-actions" style="padding:14px 0 0;border-top:none;">
      <button class="btn btn-brass btn-sm" id="impactApplyPerVersion">Apply</button>
    </div>
  `;
  wrap.innerHTML = `<div class="gh-modal-overlay" id="libraryImpactOverlay">
    <div class="gh-modal-box">
      <div class="gh-modal-header">
        <h3>This affects ${n} other version${n===1?'':'s'}</h3>
        <button class="gh-modal-close" id="libraryImpactClose" aria-label="Close">${ICONS.close}</button>
      </div>
      <div class="gh-modal-body">${bodyHtml}</div>
    </div>
  </div>`;
  // A real, reported bug: closing this dialog (X, or clicking the backdrop) used to silently
  // resolve as "Update all" -- a real, confirmed database write across every affected version,
  // triggered by what reads as a plain "never mind" close button. cancelLibraryImpact() below
  // is a true no-op instead: the field's Save button and pending edit are left exactly as they
  // were, nothing is written anywhere, and the user can reopen the same choice later by clicking
  // Save again. Both are guarded against LIBRARY_IMPACT_BUSY so a click landing while a real
  // Update/Freeze/Apply request is still in flight can't fire a second, concurrent resolution.
  document.getElementById('libraryImpactClose').onclick = cancelLibraryImpact;
  document.getElementById('libraryImpactOverlay').addEventListener('click', (ev)=>{ if(ev.target.id==='libraryImpactOverlay') cancelLibraryImpact(); });
  if(LIBRARY_IMPACT_MODE==='summary'){
    document.getElementById('impactUpdateAll').onclick = (ev)=> runLibraryImpactAction(()=> withTextButtonLoading(ev.currentTarget, 'Updating…', resolveLibraryImpact('update')));
    document.getElementById('impactFreezeAll').onclick = (ev)=> runLibraryImpactAction(()=> withTextButtonLoading(ev.currentTarget, 'Freezing…', resolveLibraryImpact('freeze')));
    document.getElementById('impactChoosePerVersion').onclick = ()=>{ LIBRARY_IMPACT_MODE='perVersion'; renderLibraryImpactDialog(); };
  } else {
    wrap.querySelectorAll('[data-action="impact-choice"]').forEach(r=>{
      r.onclick = ()=>{ LIBRARY_IMPACT_CHOICES[r.dataset.versionId] = r.value; };
    });
    document.getElementById('impactApplyPerVersion').onclick = (ev)=> runLibraryImpactAction(()=> withTextButtonLoading(ev.currentTarget, 'Applying…', resolveLibraryImpactPerVersion()));
  }
  if(isFreshOpen) animateModalIn(document.getElementById('libraryImpactOverlay'));
}
// Ignored while an Update/Freeze/Apply request is genuinely in flight (LIBRARY_IMPACT_BUSY) --
// clicking X mid-request must never race the real resolution. Otherwise a pure, non-destructive
// close: nothing is written, LIBRARY_PENDING_SAVES/the field's Save button are untouched, so the
// exact same edit + choice is still there next time Save is clicked.
function cancelLibraryImpact(){
  if(LIBRARY_IMPACT_BUSY) return;
  if(!LIBRARY_IMPACT) return;
  LIBRARY_IMPACT = null;
  LIBRARY_IMPACT_MODE = 'summary';
  renderLibraryImpactDialog();
  toast('Not saved yet - click Save again when you\'re ready to decide.');
}
// Wraps an explicit Update/Freeze/Apply click: sets the busy guard for the duration of the real
// (possibly multi-version) write so cancelLibraryImpact() can't fire concurrently, and always
// clears it in a finally regardless of success/failure. Also a real error-handling gap this
// whole bug report surfaced: every function this wraps assumes DB.*() always resolves (Supabase
// itself never throws, it returns {ok:false,error}) -- true for an ordinary rejected write, but
// a genuine network exception (offline, DNS failure) instead of a Supabase-level error response
// would previously reject uncaught, leaving LIBRARY_IMPACT non-null and the dialog stuck showing
// "Applying…" forever with no explanation (the window.onerror/unhandledrejection listener would
// still log it, but nothing here would ever tell the person looking at the frozen dialog what
// happened). Catching it here means the dialog always resolves to a real, visible state --
// either genuinely done, or explicitly told it failed and is safe to retry -- never stuck.
async function runLibraryImpactAction(fn){
  LIBRARY_IMPACT_BUSY = true;
  try {
    await fn();
  } catch(e){
    console.error('Library impact action failed:', e);
    toast('Something went wrong applying that change - nothing was lost, try again.');
    LIBRARY_IMPACT = null;
    renderLibraryImpactDialog();
  } finally {
    LIBRARY_IMPACT_BUSY = false;
  }
}
async function resolveLibraryImpact(mode){
  const impact = LIBRARY_IMPACT;
  if(!impact) return;
  if(mode==='freeze') await Promise.all(impact.versions.map(v=> freezeVersionForImpact(v.id, impact)));
  const n = impact.versions.length;
  const summary = mode==='freeze'
    ? `Old wording frozen in ${n} version${n===1?'':'s'}.`
    : `Applied to all ${n} version${n===1?'':'s'}.`;
  await finishLibraryImpact(impact, summary);
}
async function resolveLibraryImpactPerVersion(){
  const impact = LIBRARY_IMPACT;
  if(!impact) return;
  const toFreeze = impact.versions.filter(v=> LIBRARY_IMPACT_CHOICES[v.id]==='freeze');
  await Promise.all(toFreeze.map(v=> freezeVersionForImpact(v.id, impact)));
  const updatedCount = impact.versions.length - toFreeze.length;
  const summary = `${toFreeze.length} frozen, ${updatedCount} updated.`;
  await finishLibraryImpact(impact, summary);
}
// Either outcome (Update all / Freeze some) ends the same way: the Library itself always gets
// the new value -- freezing only ever shields specific *versions* via their own override, it
// never stops the shared Library text from changing. Awaits the real save (flushLibrarySave()
// now returns its promise) so the success/failure toast reflects what actually happened, rather
// than firing "Saved" before the network round trip has even resolved -- the exact ambiguity
// ("I don't know what happened, if it saved it or not") this whole fix exists to close.
async function finishLibraryImpact(impact, summary){
  if(impact.path){
    delete LIBRARY_PENDING_SAVES[impact.path];
    renderFieldSaveSlot(impact.path, false);
  }
  // flushLibrarySave() (not the plain 900ms-debounced scheduleLibrarySave()) -- clicking
  // "Update all"/"Apply" is already a deliberate, explicit save decision, so it should commit
  // right away rather than making the user wait through another debounce window on top of the
  // one they just resolved.
  scheduleLibrarySave();
  const res = await flushLibrarySave();
  LIBRARY_IMPACT = null;
  renderLibraryImpactDialog();
  if(res && res.conflict){
    toast('Saved to other versions, but the Library itself hit a sync conflict - see the banner above to resolve it.');
  } else if(res && res.ok===false){
    toast('The version(s) were updated, but saving the Library itself failed - try editing this field again.');
  } else {
    toast('Saved. '+summary);
  }
}
// Writes a frozen snapshot of the pre-edit value onto one version, so it keeps showing the old
// wording (or old Skill Set membership) regardless of what the Library now says. Uses the
// currently-open version's own in-memory state directly when that's the one being frozen
// (already reflects every edit made in the editor, saved or not) rather than a fresh fetch,
// which could otherwise race a not-yet-flushed autosave; any other version is fetched fresh.
// DB.saveVersion()'s own revision check means a lost race here surfaces as a normal, safe
// failure (reported via toast, nothing silently overwritten) rather than corrupting data.
async function freezeVersionForImpact(versionId, impact){
  let data, revision;
  if(CURRENT_VERSION && CURRENT_VERSION.id===versionId){
    data = CURRENT_VERSION; revision = VERSION_REVISIONS[versionId];
  } else {
    const full = await DB.getVersion(versionId);
    if(!full) return false;
    data = full.data; revision = full.revision;
  }
  if(impact.isSkillGroup){
    data = versionSetSkillGroupOverride(data, impact.groupId, impact.originalCategoryIds);
  } else if(impact.kind==='summaries'){
    // Summaries freeze via their own pre-existing free-text slot, not the generic overrides
    // object -- the exact same mechanism the entry-edit modal's "Only this version" summary
    // scope already uses.
    data = { ...data, selection:{ ...data.selection, summaryId:null, customSummaryText: impact.originalValue } };
  } else if(impact.bulletId){
    data = versionSetBulletOverride(data, impact.kind, impact.refId, impact.bulletId, impact.originalValue);
  } else {
    data = versionSetOverride(data, impact.kind, impact.refId, impact.field, impact.originalValue);
  }
  const res = await DB.saveVersion(versionId, data, revision);
  if(res.ok){
    if(CURRENT_VERSION && CURRENT_VERSION.id===versionId){
      CURRENT_VERSION = data;
      VERSION_REVISIONS[versionId] = res.revision;
      if(VIEW==='editor') renderEditor();
    }
  } else {
    const v = impact.versions.find(x=>x.id===versionId);
    toast(`Couldn't freeze wording for "${v?v.name:'a version'}" - try again`);
  }
  return res.ok;
}
// The entry-edit modal's own "Choose per version" scope -- a separate, independent state/dialog
// from LIBRARY_IMPACT above rather than a generalization of it, since this one edits several
// fields (and several bullets) on one entry in a single save, not one field/bullet at a time.
// The Library itself always gets the new value regardless of any per-version choice made here,
// same "Library changes for everyone, freezing only shields the versions you pick" rule
// LIBRARY_IMPACT already established.
var ENTRY_EDIT_IMPACT = null; // { kind, refId, fields:[{field,oldValue}], bullets:[{bulletId,oldValue}], originalText?, versions:[{id,name}] }
var ENTRY_EDIT_IMPACT_CHOICES = {}; // versionId -> 'update'|'freeze'
// Same busy guard as LIBRARY_IMPACT_BUSY -- ignore a close click that lands while Apply is
// still awaiting its DB.saveVersion() round trips.
var ENTRY_EDIT_IMPACT_BUSY = false;
function showEntryEditImpactDialog(impact){
  ENTRY_EDIT_IMPACT = impact;
  ENTRY_EDIT_IMPACT_CHOICES = {};
  ENTRY_EDIT_IMPACT_BUSY = false;
  impact.versions.forEach(v=> ENTRY_EDIT_IMPACT_CHOICES[v.id]='update');
  renderEntryEditImpactDialog();
}
function renderEntryEditImpactDialog(){
  const wrap = document.getElementById('libraryImpactWrap');
  if(!wrap) return;
  if(!ENTRY_EDIT_IMPACT){ wrap.innerHTML=''; return; }
  const isFreshOpen = wrap.children.length===0;
  const { versions } = ENTRY_EDIT_IMPACT;
  const n = versions.length;
  wrap.innerHTML = `<div class="gh-modal-overlay" id="entryEditImpactOverlay">
    <div class="gh-modal-box">
      <div class="gh-modal-header">
        <h3>This affects ${n} other version${n===1?'':'s'}</h3>
        <button class="gh-modal-close" id="entryEditImpactClose" aria-label="Close">${ICONS.close}</button>
      </div>
      <div class="gh-modal-body">
        <div class="impact-per-version-list">
          ${versions.map(v=>`
            <div class="impact-version-row">
              <span class="impact-version-name">${esc(v.name)}</span>
              <div class="impact-version-choice">
                <label class="chk"><input type="radio" name="eeImpactChoice_${esc(v.id)}" data-action="ee-impact-choice" data-version-id="${esc(v.id)}" value="update" ${ENTRY_EDIT_IMPACT_CHOICES[v.id]==='update'?'checked':''}> Update</label>
                <label class="chk"><input type="radio" name="eeImpactChoice_${esc(v.id)}" data-action="ee-impact-choice" data-version-id="${esc(v.id)}" value="freeze" ${ENTRY_EDIT_IMPACT_CHOICES[v.id]==='freeze'?'checked':''}> Freeze old wording</label>
              </div>
            </div>`).join('')}
        </div>
        <div class="gh-actions" style="padding:14px 0 0;border-top:none;">
          <button class="btn btn-brass btn-sm" id="entryEditImpactApply">Apply</button>
        </div>
      </div>
    </div>
  </div>`;
  // A real, reported bug (the same class as LIBRARY_IMPACT's own fix above): closing this
  // dialog used to call resolveEntryEditImpact() directly, which silently APPLIED whatever
  // Freeze/Update radio choices had already been picked -- picking "Freeze" for a version, then
  // closing instead of clicking Apply, still froze it, with no visible confirmation either way.
  // cancelEntryEditImpact() is a true no-op instead: no version is frozen, every picked radio
  // choice is discarded, and a toast says so explicitly. The Library edit itself was already
  // committed before this dialog opened (saveEntryEditModal()'s own flushLibrarySave() call), so
  // there's nothing about the Library write left ambiguous by canceling here -- only the
  // per-version freeze choices are what's being discarded.
  document.getElementById('entryEditImpactClose').onclick = cancelEntryEditImpact;
  document.getElementById('entryEditImpactOverlay').addEventListener('click', (ev)=>{ if(ev.target.id==='entryEditImpactOverlay') cancelEntryEditImpact(); });
  wrap.querySelectorAll('[data-action="ee-impact-choice"]').forEach(r=>{
    r.onclick = ()=>{ ENTRY_EDIT_IMPACT_CHOICES[r.dataset.versionId] = r.value; };
  });
  document.getElementById('entryEditImpactApply').onclick = (ev)=> runEntryEditImpactAction(()=> withTextButtonLoading(ev.currentTarget, 'Applying…', resolveEntryEditImpact()));
  if(isFreshOpen) animateModalIn(document.getElementById('entryEditImpactOverlay'));
}
function cancelEntryEditImpact(){
  if(ENTRY_EDIT_IMPACT_BUSY) return;
  if(!ENTRY_EDIT_IMPACT) return;
  ENTRY_EDIT_IMPACT = null;
  renderEntryEditImpactDialog();
  renderEditor();
  toast('No versions frozen - they\'ll all pick up the new text.');
}
async function runEntryEditImpactAction(fn){
  ENTRY_EDIT_IMPACT_BUSY = true;
  try {
    await fn();
  } catch(e){
    console.error('Entry-edit impact action failed:', e);
    toast('Something went wrong - nothing was lost, try again.');
    ENTRY_EDIT_IMPACT = null;
    renderEntryEditImpactDialog();
  } finally {
    ENTRY_EDIT_IMPACT_BUSY = false;
  }
}
async function resolveEntryEditImpact(){
  const impact = ENTRY_EDIT_IMPACT;
  if(!impact) return;
  const toFreeze = impact.versions.filter(v=> ENTRY_EDIT_IMPACT_CHOICES[v.id]==='freeze');
  const results = await Promise.all(toFreeze.map(v=> freezeVersionForEntryEditImpact(v.id, impact)));
  ENTRY_EDIT_IMPACT = null;
  renderEntryEditImpactDialog();
  renderEditor();
  const failedCount = results.filter(ok=> ok===false).length;
  const updatedCount = impact.versions.length - toFreeze.length;
  if(failedCount>0){
    toast(`${toFreeze.length-failedCount} frozen, ${updatedCount} updated - ${failedCount} failed, see above.`);
  } else {
    toast(`Done. ${toFreeze.length} frozen, ${updatedCount} updated.`);
  }
}
async function freezeVersionForEntryEditImpact(versionId, impact){
  let data, revision;
  if(CURRENT_VERSION && CURRENT_VERSION.id===versionId){
    data = CURRENT_VERSION; revision = VERSION_REVISIONS[versionId];
  } else {
    const full = await DB.getVersion(versionId);
    if(!full) return false;
    data = full.data; revision = full.revision;
  }
  if(impact.kind==='summaries'){
    data = { ...data, selection:{ ...data.selection, summaryId:null, customSummaryText: impact.originalText } };
  } else {
    impact.fields.forEach(({field,oldValue})=>{ data = versionSetOverride(data, impact.kind, impact.refId, field, oldValue); });
    impact.bullets.forEach(({bulletId,oldValue})=>{ data = versionSetBulletOverride(data, impact.kind, impact.refId, bulletId, oldValue); });
  }
  const res = await DB.saveVersion(versionId, data, revision);
  if(res.ok){
    if(CURRENT_VERSION && CURRENT_VERSION.id===versionId){
      CURRENT_VERSION = data;
      VERSION_REVISIONS[versionId] = res.revision;
      if(VIEW==='editor') renderEditor();
    }
  } else {
    const v = impact.versions.find(x=>x.id===versionId);
    toast(`Couldn't freeze wording for "${v?v.name:'a version'}" - try again`);
  }
  return res.ok;
}
// Manually-tracked timer (not the generic debounce() helper) specifically so it can be
// flushed on demand -- same reasoning/shape as flushVersionSave()/doVersionSave() elsewhere in
// this file: commitFieldSave() below needs a way to persist immediately (skip the 900ms wait)
// for a field with zero usage, where there's nothing to ask about, just a "save now" shortcut
// behind the same button used fields show.
var librarySaveTimer = null;
async function doLibrarySave(){
  librarySaveTimer = null;
  SAVE_STATUS.library = 'saving'; updateSaveStatusUI();
  const res = await DB.saveLibrary(LIBRARY, LIBRARY_REVISION);
  if(res.conflict){ showSyncConflict('library', res.serverRow); SAVE_STATUS.library='error'; updateSaveStatusUI(); return res; }
  SAVE_STATUS.library = res.ok ? 'saved' : 'error';
  if(res.ok){ LIBRARY_REVISION = res.revision; markGithubDirty('library'); }
  updateSaveStatusUI();
  return res;
}
// scheduleLibrarySave() -- same name every existing call site already uses, so nothing else
// needed to change -- flips the status indicator to 'dirty' synchronously the instant it's
// called, not 900ms later, so "Unsaved changes" shows up immediately rather than lagging
// behind the edit that caused it.
function scheduleLibrarySave(){
  SAVE_STATUS.library='dirty'; updateSaveStatusUI();
  clearTimeout(librarySaveTimer);
  librarySaveTimer = setTimeout(doLibrarySave, 900);
}
function flushLibrarySave(){
  if(librarySaveTimer){ clearTimeout(librarySaveTimer); return doLibrarySave(); }
  return Promise.resolve();
}
// Core LIBRARY-mutating logic, factored out of onLibraryInput/onLibraryClick. The entry-edit
// modal (renderEntryEditModal() below) mutates LIBRARY through its own saveEntryEditModal()/
// add-bullet/remove-bullet handlers rather than these two -- it needs to buffer edits
// uncommitted until Save (to support the library-vs-version-only choice), which these
// immediate-apply functions aren't shaped for. Kept factored out anyway since both call
// sites want the exact same reducer calls + noteLibraryHistory() timing, just triggered
// differently.
function updateBulletMetricFlag(t){
  if(t.dataset.path.endsWith('.text') && t.closest('.bullet-row')){
    const flagEl = t.closest('.bullet-row').querySelector('.metric-flag,.metric-ok');
    if(flagEl){ const ok=hasMetric(t.value); flagEl.className = ok?'metric-ok':'metric-flag'; flagEl.textContent = ok?'has metric':'no metric'; }
  }
}
function applyLibraryInputChange(t){
  if(!t.dataset.path) return false;
  noteLibraryHistory();
  setPath(LIBRARY, t.dataset.path, t.value);
  updateBulletMetricFlag(t);
  scheduleLibrarySave();
  return t.dataset.path.endsWith('.contentType') ? 'structural' : true;
}
// Resolves a data-path into which Library item it touches and how many versions currently
// use that item -- the one place that decides whether a field is "usage-gated" (see
// onLibraryInput() below). Returns null for anything out of scope: the tag pool
// (tagOptions.*), any .tags[] array (never printed, see buildUsageIndex()'s own comment), and
// .contentType (a structural UI toggle, not printed content -- gating a <select> behind a
// manual Save button would make picking an option feel broken, unlike a text field).
function fieldUsageForPath(path){
  const parts = path.split('.');
  const kind = parts[0];
  if(kind==='tagOptions') return null;
  const entry = LIBRARY[kind] && LIBRARY[kind][Number(parts[1])];
  if(!entry) return null;
  if(parts[2]==='bullets'){
    if(parts[4]!=='text') return null;
    const bullet = entry.bullets && entry.bullets[Number(parts[3])];
    if(!bullet) return null;
    return { kind, refId:entry.id, bulletId:bullet.id, field:'text', versions: bulletUsageVersions(kind, entry.id, bullet.id) };
  }
  const field = parts[2];
  if(field==='contentType' || field==='tags') return null;
  return { kind, refId:entry.id, bulletId:null, field, versions: entryUsageVersions(kind, entry.id) };
}
// Fills in a field's (currently empty) .field-save-slot with a real Save button, via direct
// DOM manipulation -- never a renderLibrary() re-render, which would steal focus/cursor
// position away from whatever's still being typed into. The slot's own markup already exists
// in the page (fieldSaveSlotHtml()); this only ever changes that one small sibling element.
// querySelectorAll, not querySelector -- a skill category's data-path can now legitimately
// render twice on the same Library tab (once in its own card, once again inside any Skill
// Set's "Categories in this set" list that includes it), so every matching slot needs to
// stay in sync, not just whichever one happens to be first in the DOM.
function renderFieldSaveSlot(path, showButton){
  document.querySelectorAll(`.field-save-slot[data-save-path="${path}"]`).forEach(slot=>{
    slot.innerHTML = showButton ? `<button class="btn btn-brass btn-xs" data-action="commit-field-save" data-save-path="${esc(path)}">Save</button>` : '';
  });
}
function applyLibraryClickAction(action, kind, btn){
  if(!['add-entry','remove-entry','add-bullet','remove-bullet'].includes(action)) return false;
  noteLibraryHistoryImmediate();
  if(action==='add-entry') LIBRARY = libAddEntry(LIBRARY, kind);
  else if(action==='remove-entry') LIBRARY = kind==='tagOptions' ? libRemoveTagOption(LIBRARY, btn.dataset.id) : libRemoveEntry(LIBRARY, kind, btn.dataset.id);
  else if(action==='add-bullet') LIBRARY = libAddBullet(LIBRARY, kind, btn.dataset.id);
  else if(action==='remove-bullet') LIBRARY = libRemoveBullet(LIBRARY, kind, btn.dataset.id, btn.dataset.bid);
  scheduleLibrarySave();
  return true;
}
function onLibraryInput(ev){
  const t = ev.target;
  if(handleTagChipFilterInput(t)) return;
  if(!t.dataset.path) return;
  const usage = fieldUsageForPath(t.dataset.path);
  if(!usage){
    // Out of scope for this feature entirely (tag pool, .tags[], .contentType) -- exactly
    // today's pre-existing behavior, frictionless autosave, no button.
    if(applyLibraryInputChange(t)==='structural') renderLibrary();
    return;
  }
  const path = t.dataset.path;
  // Captured once, on the first keystroke of this dirty streak -- not re-captured on every
  // subsequent one, which would just capture the already-modified value and make "Freeze old
  // wording" a no-op.
  if(!LIBRARY_PENDING_SAVES[path]){
    LIBRARY_PENDING_SAVES[path] = { originalValue:getPath(LIBRARY, path), kind:usage.kind, refId:usage.refId, bulletId:usage.bulletId, field:usage.field };
  }
  noteLibraryHistory();
  setPath(LIBRARY, path, t.value);
  updateBulletMetricFlag(t);
  // The Save button always appears once a field is dirty, even one used nowhere yet ("for
  // consistency" -- one interaction pattern regardless of usage). For a genuinely unused
  // field there's nothing to ask about, so it's just a "save now" shortcut on top of the
  // background autosave below, which still covers the case where nobody bothers clicking it.
  // A *used* field gets no such background save -- the button (and the impact dialog it
  // opens) is the only path its edit takes to the server, which is the actual point of this
  // feature: nothing silently changes what several versions print.
  renderFieldSaveSlot(path, true);
  if(!usage.versions.length) scheduleLibrarySave();
}
// The Save button's click handler -- either persists immediately (a field nobody else uses,
// nothing to ask about) or opens the impact dialog (see showLibraryImpactDialog() below).
function commitFieldSave(path){
  const usage = fieldUsageForPath(path);
  if(!usage || !usage.versions.length){
    delete LIBRARY_PENDING_SAVES[path];
    renderFieldSaveSlot(path, false);
    flushLibrarySave();
    return;
  }
  const pending = LIBRARY_PENDING_SAVES[path];
  showLibraryImpactDialog({
    path, kind:usage.kind, refId:usage.refId, bulletId:usage.bulletId, field:usage.field,
    originalValue: pending ? pending.originalValue : null,
    versions: usage.versions
  });
}
// Library-tab-only (which categories belong to a Skill Set is chosen here; the editor's own
// Skill Set view edits the categories' own content instead, see skillSetSelectorHtml()'s own
// comment on why). A checkbox toggle is already one complete, discrete action -- unlike
// typing into a text field, there's no "still in progress" phase to defer past, so the impact
// check (when relevant) fires immediately on click rather than waiting behind a Save button.
function toggleSkillGroupCategory(groupId, catId, checked){
  const usage = skillGroupUsageVersions(groupId);
  const group = LIBRARY.skillGroups.find(g=>g.id===groupId);
  const originalCategoryIds = group ? group.categoryIds.slice() : [];
  noteLibraryHistoryImmediate();
  LIBRARY = libToggleSkillGroupCategory(LIBRARY, groupId, catId, checked);
  scheduleLibrarySave();
  if(usage.length){
    renderLibrary(); // reflect the toggle in the UI right away; the dialog below governs only whether/how it reaches the server for each affected version
    showLibraryImpactDialog({ isSkillGroup:true, groupId, originalCategoryIds, versions:usage });
  }
}
function onLibraryClick(ev){
  if(handleTagChipClick(ev)) return;
  const saveBtn = ev.target.closest('[data-action="commit-field-save"]');
  if(saveBtn){ commitFieldSave(saveBtn.dataset.savePath); return; }
  // Handled directly here, not through applyLibraryClickAction() -- that function's
  // contract is button-only actions (add/remove entry or bullet); this is a checkbox whose
  // checked state (not a click target) is the thing that matters, and toggling one category
  // doesn't need a full library re-render the way add/remove does.
  const toggleInput = ev.target.closest('input[data-action="toggle-skillgroup-category"]');
  if(toggleInput){
    toggleSkillGroupCategory(toggleInput.dataset.groupId, toggleInput.dataset.catId, toggleInput.checked);
    return;
  }
  const btn = ev.target.closest('button[data-action]'); if(!btn) return;
  if(applyLibraryClickAction(btn.dataset.action, btn.dataset.kind, btn)) renderLibrary();
}

/* ===== version editor ===== */
async function openEditor(id, navMode){
  // Flush any pending save for whatever was previously open *before* the fetch below --
  // same reasoning as switchView('dashboard')'s own flushVersionSave() call: opening a
  // different version is exactly as much "closing the old document" as Dashboard is, so a
  // same-second edit to the old version must not get silently dropped just because
  // CURRENT_VERSION gets reassigned (after this function's own await) before its debounced
  // autosave timer had a chance to fire.
  flushVersionSave();
  const full = await DB.getVersion(id);
  if(!full){ toast('Version not found'); return; }
  CURRENT_VERSION = full.data;
  VERSION_REVISIONS[id] = full.revision;
  clearVersionHistory(); // a different document than whatever was open before, if anything
  ENTRY_EDIT_MODAL = null; renderEntryEditModal(); // don't carry a stale edit dialog into a different document
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  const editorEl = document.getElementById('viewEditor');
  editorEl.classList.add('active');
  document.querySelectorAll('.nav button').forEach(b=>b.classList.remove('active'));
  VIEW='editor';
  renderEditor();
  updateNavResumeButton();
  focusActiveView(editorEl);
  updateRoute('editor', id, navMode);
}
function jobMetaFields(){
  const jm = CURRENT_VERSION.jobMeta;
  return `<div class="field"><label>Version name</label><input type="text" data-path="name" value="${esc(CURRENT_VERSION.name)}"></div>
  <div class="field-row">
    <div class="field"><label>Company</label><input type="text" data-path="jobMeta.company" value="${esc(jm.company)}"></div>
    <div class="field"><label>Role applied for</label><input type="text" data-path="jobMeta.role" value="${esc(jm.role)}"></div>
  </div>
  <div class="field-row">
    <div class="field"><label>Date applied</label><input type="text" placeholder="YYYY-MM-DD" data-path="jobMeta.dateApplied" value="${esc(jm.dateApplied)}"></div>
    <div class="field"><label>Job link</label><input type="text" data-path="jobMeta.jdLink" value="${esc(jm.jdLink)}"></div>
  </div>`;
}
// "Fill in with tag" -- above Summary in the editor, on request. Picking a tag here is a
// one-off bulk-include action (versionFillByTag() in js/03_model.js) -- it only ever adds,
// never removes. Originally a plain <select>; swapped for the same GitHub/Notion-style
// chip-input component used everywhere else tags are picked (bullets, skill categories,
// Import Review), on request, for visual/behavioral consistency -- see tagChipInputHtml() for
// the shape this borrows its markup/CSS classes from. Deliberately its own small, bespoke
// implementation rather than a literal call into tagChipInputHtml() itself: that function
// writes into a real tags[] array via applyTagToggle() the instant a chip is picked/removed,
// with no room for a confirmation step in between -- this one is single-select (0 or 1 chip,
// never more) and every pick needs to run through a confirm() first (see onEditorClick()),
// since unlike a normal tag membership toggle, applying a fill is a bulk, hard-to-eyeball
// change to the version's whole selection. Two real, reported bugs already fixed by this
// shape: the widget used to snap back to "Custom" after every pick even though the pick was
// still in effect (now recorded in `selection.lastFillTagId` and rendered back as the shown
// chip); and picking a second tag right after a first used to silently pile its content on
// top with no warning (now impossible to even reach without first clicking the chip's "x" to
// clear the prior pick, and every pick is confirmed before it's applied).
function fillWithTagHtml(){
  const options = currentLibrary().tagOptions || [];
  if(!options.length){
    return '<p style="font-size:12px;color:var(--text-muted);">No tags yet - add some in the Library\'s Tags tab, then use this to quickly pull in everything tagged for a role.</p>';
  }
  const selectedId = CURRENT_VERSION.selection.lastFillTagId || '';
  const selectedOpt = options.find(o=>o.id===selectedId);
  const chip = selectedOpt
    ? `<span class="tag-chip">${esc(selectedOpt.label||'(untitled tag)')}<button type="button" class="tag-chip-remove" data-action="remove-fill-tag-chip" aria-label="Clear picked tag">&times;</button></span>`
    : '';
  const isOpen = CHIP_INPUT_FOCUSED==='fillTagChip';
  return `<span class="tag-chip-input" data-chip-id="fillTagChip">
    ${chip}
    ${selectedOpt ? '' : `<input type="text" class="tag-chip-text" placeholder="Select" autocomplete="off" data-action="tag-chip-filter" data-tag-root="fillTag" data-chip-id="fillTagChip">`}
    <div class="tag-chip-suggestions" id="fillTagChip_sugg" ${isOpen?'':'hidden'}>${isOpen?chipSuggestionsHtml('fillTag','',''):''}</div>
  </span>
  <p style="font-size:11px;color:var(--text-muted);margin:6px 0 0;">Picking a tag includes every bullet, entry, and skill category tagged with it in this version, and switches to a tagged summary if one exists - it only adds/switches, it never removes anything already included. You'll be asked to confirm before anything is added.</p>`;
}
// The Summary picker's own dropdown identifies each option by its tag(s) instead of a text
// preview, on request ("for selection itself it must use those tags, not only display it" ...
// "already there is a dropdown showing the starting of the summary itself, replace it") -- no
// separate tag-picker UI, the SAME <select> summarySelectorHtml() already had just labels its
// options differently now. A summary with no tags at all still falls back to the old text
// preview (entryLabel()) so it stays reachable/identifiable -- tags are how you tell tagged
// variants apart, not a hard requirement to have one.
function summaryOptionLabel(s, library){
  const tagLabels = (s.tags||[]).map(id=>{
    const opt = (library.tagOptions||[]).find(o=>o.id===id);
    return opt ? (opt.label||'(untitled tag)') : null;
  }).filter(Boolean);
  return tagLabels.length ? tagLabels.join(', ') : entryLabel('summaries', s);
}
function summarySelectorHtml(){
  const lib = currentLibrary();
  const sel = CURRENT_VERSION.selection;
  // "(custom text below)" mode already lets the textarea double as a per-version-only
  // summary -- the gap this closes is the *other* mode: once a library summary is picked,
  // its printed text was only editable from the Library tab. The button here opens the same
  // entry-edit modal every other kind uses, offering the library-vs-version-only choice for
  // that summary's text specifically.
  const editBtn = sel.summaryId ? editDetailsButtonHtml('summaries', sel.summaryId) : '';
  const addFromLibBtn = isStandaloneVersion() ? `<button type="button" class="btn btn-ghost btn-sm" data-action="open-library-picker" data-kind="summaries" style="margin-top:6px;">+ Add from my Library</button>` : '';
  // The free-text textarea only makes sense in "(custom text below)" mode -- showing it
  // alongside an already-picked library summary implied it was still in play (it wasn't; a
  // picked summaryId always wins in resolveVersion(), see js/03_model.js), so it's hidden
  // entirely once a real summary is selected, on request.
  const textareaHtml = sel.summaryId ? '' : `<textarea data-path="selection.customSummaryText" placeholder="Or write one-off text for just this version (use **word** for inline bold)" rows="3">${esc(sel.customSummaryText)}</textarea>`;
  return `<div class="field"><label>Heading</label><input type="text" data-path="selection.summaryHeading" value="${esc(sel.summaryHeading||'Summary')}"></div>
  <select data-path="selection.summaryId">
    <option value="">(custom text below)</option>
    ${lib.summaries.map(s=>`<option value="${s.id}" ${sel.summaryId===s.id?'selected':''}>${esc(summaryOptionLabel(s, lib))}</option>`).join('')}
  </select>
  ${textareaHtml}
  ${editBtn}${addFromLibBtn}`;
}
// Mirrors summarySelectorHtml()'s "pick a saved item, or fall back to manual" pattern.
// skillGroupId unset (Custom) keeps today's exact per-category checklist
// (selectionListHtml('skills')) working unchanged -- every existing saved version has no
// skillGroupId at all and lands here. Picking a saved set swaps that checklist for the set's
// own content, editable inline -- went through two rounds on request: first "I don't want
// 'Edit this set in library', I want to be able to edit it there" (replaced a read-only
// summary + a button navigating away with an editable membership checklist inline), then
// "I don't want to edit the selection... I want to edit the content" (replaced THAT
// checklist with the categories' own label/text fields instead -- which categories belong
// to the set is still chosen from the Library tab's own Skill Sets manager, unchanged).
function skillSetSelectorHtml(){
  const lib = currentLibrary();
  const sel = CURRENT_VERSION.selection;
  const groups = lib.skillGroups||[];
  const activeId = sel.skillGroupId || '';
  let body = `<div class="field"><label>Skill set</label><select data-path="selection.skillGroupId">
    <option value="">Custom (pick individually)</option>
    ${groups.map(g=>`<option value="${g.id}" ${activeId===g.id?'selected':''}>${esc(g.label||'(untitled set)')}</option>`).join('')}
  </select></div>`;
  if(!activeId) return body + selectionListHtml('skills');
  const group = groups.find(g=>g.id===activeId);
  if(!group) return body + '<p style="font-size:12px;color:var(--text-muted);">This skill set no longer exists -- pick another, or switch back to Custom.</p>';
  const usage = skillGroupUsageVersions(activeId);
  const usageBlock = usage.length ? `<div class="entry-usage-line">${usageLabelHtml(usage)}</div>` : '';
  const renameField = isStandaloneVersion() ? '' : `<div class="field" style="margin-top:8px;"><label>Set name</label><input type="text" data-skillgroup-rename="${esc(group.id)}" value="${esc(group.label)}"></div>`;
  // Read-only content + an "Edit details" button, same pattern selectionListHtml()'s own
  // Custom-mode checklist already uses for every other kind -- on request ("like how the
  // normal skills have a 'edit details' thing in the editor, I also want the skill set also
  // to have like that, not directly editable"). This replaced a previous version of this view
  // that had live-editable Label/Items fields inline; editDetailsButtonHtml() opens the exact
  // same shared entry-edit modal (openEntryEditModal('skills', cat.id)) that editing this
  // category anywhere else in the app already uses, including its own Library/Only-this-
  // version/Choose-per-version scope choice -- no separate, lesser editing path here. Which
  // categories belong to the set at all is still a Library-tab-only decision.
  const cats = group.categoryIds.map(id=>lib.skills.find(c=>c.id===id)).filter(Boolean);
  const catRows = cats.length ? cats.map(cat=>`
    <div class="sel-item">
      <div class="sel-head"><label>${esc(cat.label||'(untitled category)')}</label></div>
      ${cat.text ? `<div class="sel-skill-items">${esc(cat.text)}</div>` : ''}
      ${bulletTagBadgesHtml(cat.tags, lib)}
      ${editDetailsButtonHtml('skills', cat.id)}
    </div>`).join('') : '<p style="font-size:12px;color:var(--text-muted);">This set has no categories yet -- add some from the Library tab\'s Skill Sets manager.</p>';
  return body + usageBlock + renameField + `<div style="font-size:11px;color:var(--text-muted);margin:8px 0 4px;">Categories in this set</div>${catRows}`;
}
// Section-level reordering lives inline on each section's own <summary> header (and on each
// custom section's own row) rather than a separate "reorder sections" panel -- the same
// move-up/move-down interaction already used for reordering entries *within* a section
// (moveSelection()/onEditorClick's `data-move` branch), just one level up. onEditorClick()
// calls preventDefault() for this button specifically -- these buttons sit inside a
// <summary>, and an unprevented click anywhere inside <summary> also toggles the parent
// <details> open/closed as the browser's native default action, which would both reorder
// the section AND randomly collapse/expand it in the same click.
function sectionMoveButtonsHtml(token){
  return `<span class="move-btns"><button data-action="move-section" data-token="${esc(token)}" data-dir="up">${ICONS.chevronUp}</button><button data-action="move-section" data-token="${esc(token)}" data-dir="down">${ICONS.chevronDown}</button></span>`;
}
// Reused by both selectionListHtml() (the 5 built-in kinds) and customSectionBlockHtml() --
// opens the entry-edit modal (renderEntryEditModal() below) rather than an inline disclosure
// (an earlier version used a small nested <details> here; reported as too cramped for
// comfortable field editing, replaced with a proper dialog).
function editDetailsButtonHtml(kind, entryId){
  return `<button type="button" class="btn btn-ghost btn-sm" data-action="open-edit-modal" data-kind="${kind}" data-entry-id="${esc(entryId)}" style="margin-top:6px;">Edit details</button>`;
}
const ED_ADD_LABELS = {experience:'experience', projects:'project', education:'education', skills:'skill category', references:'reference', customSections:'custom section'};

// Read-only pill badges for a bullet's/skill category's own tags -- tags[] holds pool ids
// (see LIBRARY.tagOptions), resolved to their current labels here so a rename in the Tags tab
// shows up everywhere without touching the item that was tagged. An id with no matching pool
// entry is silently skipped (resolveTagLabels()'s own dangling-reference tolerance). `library`
// defaults to the account's shared LIBRARY (every Library-tab call site) -- editor-context call
// sites pass currentLibrary() explicitly, since a standalone version's tags resolve against its
// own embedded pool, not the shared one.
function bulletTagBadgesHtml(tagIds, library){
  const labels = resolveTagLabels(library||LIBRARY, tagIds);
  if(!labels.length) return '';
  return `<span class="bullet-tags">${labels.map(l=>`<span class="bullet-tag-badge">${esc(l)}</span>`).join('')}</span>`;
}
// Applies one checkbox's checked state to the tags[] array at `path`, in whichever global
// object `root` designates -- 'library' writes into LIBRARY (autosaved, same as every other
// Library edit, via the caller's own scheduleLibrarySave()); 'importReview' writes into
// IMPORT_REVIEW.reviewState, not saved anywhere until Import selected is clicked.
function applyTagToggle(root, path, tagId, checked){
  const target = root==='library' ? LIBRARY : IMPORT_REVIEW.reviewState;
  const cur = getPath(target, path) || [];
  const next = checked ? [...cur, tagId] : cur.filter(id=>id!==tagId);
  setPath(target, path, next);
}
// A real, reported bug: floating panels anchored via position:absolute relative to their own
// trigger element have no awareness of the viewport at all -- one near the bottom or right edge
// of a scrolling panel opens off-screen, unreachable/unreadable. Same fix
// positionSettingsDropdown() above already needed: real pixel top/left from the anchor
// element's getBoundingClientRect(), clamped to stay fully inside the viewport, with a
// vertical flip-to-above when there isn't room below. Shared by the chip-input's suggestion
// list (its only caller now) -- kept as a standalone, anchor-agnostic function since it's
// generically "float a panel off a trigger element, keep it on-screen." Measures the panel's
// real size after unhiding it, not while still `hidden`.
function positionFloatingPanel(panelEl, anchorEl){
  if(!panelEl || panelEl.hidden || !anchorEl) return;
  const rect = anchorEl.getBoundingClientRect();
  const panelRect = panelEl.getBoundingClientRect();
  let left = rect.right - panelRect.width;
  left = Math.max(8, Math.min(left, window.innerWidth - panelRect.width - 8));
  let top = rect.bottom + 4;
  if(top + panelRect.height > window.innerHeight - 8){
    top = Math.max(8, rect.top - panelRect.height - 4);
  }
  panelEl.style.left = left + 'px';
  panelEl.style.top = top + 'px';
}

// ===== Tag chip input -- the single tag-picker UI used everywhere a tag is applied: Library
// tab bullet rows, Library tab skill category rows, and Import Review's per-bullet tag field.
// (An earlier checkbox-popover picker was tried alongside this one and retired once this was
// chosen -- see git history if you need it back.) `root` is 'library' or 'importReview',
// discriminating which global object applyTagToggle() writes into; `path` is a dot-path (via
// getPath/setPath, this app's existing generic mechanism) to the tags[] array being edited.
// Always reads the pool from LIBRARY.tagOptions regardless of root -- there's only ever one
// pool, the account's own. Only existing pool tags are selectable -- no inline creation here;
// Manage Tags stays the only place a new pool entry is created.
var CHIP_INPUT_FOCUSED = null; // the chip-input id whose suggestion list should stay open/focused across the next re-render, or null
// Dispatches to the right history/render/save functions for whichever root a chip action
// happened in -- 'library' (autosaved immediately, like every other Library edit) or
// 'importReview' (buffered in IMPORT_REVIEW.reviewState, not saved until Import selected is
// clicked). Shared by onLibraryClick/onLibraryInput and onImportReviewClick/onImportReviewEvent
// so the chip-input's click/filter/keydown handling exists exactly once, not once per view.
function noteTagRootHistory(root){ if(root==='library') noteLibraryHistoryImmediate(); else noteImportReviewHistoryImmediate(); }
function rerenderTagRoot(root){ if(root==='library') renderLibrary(); else renderImportReviewView(); }
// Handles a click on a chip's remove ("x") button or a suggestion-list item -- returns true if
// the click was one of these (caller should stop processing further), false otherwise.
function handleTagChipClick(ev){
  const chipRemove = ev.target.closest('button[data-action="remove-tag-chip"]');
  if(chipRemove){
    noteTagRootHistory(chipRemove.dataset.tagRoot);
    applyTagToggle(chipRemove.dataset.tagRoot, chipRemove.dataset.tagPath, chipRemove.dataset.tagId, false);
    if(chipRemove.dataset.tagRoot==='library') scheduleLibrarySave();
    CHIP_INPUT_FOCUSED = chipRemove.closest('.tag-chip-input').dataset.chipId;
    rerenderTagRoot(chipRemove.dataset.tagRoot);
    refocusChipInput(CHIP_INPUT_FOCUSED);
    return true;
  }
  const chipSelect = ev.target.closest('button[data-action="tag-chip-select"]');
  if(chipSelect){
    noteTagRootHistory(chipSelect.dataset.tagRoot);
    applyTagToggle(chipSelect.dataset.tagRoot, chipSelect.dataset.tagPath, chipSelect.dataset.tagId, true);
    if(chipSelect.dataset.tagRoot==='library') scheduleLibrarySave();
    CHIP_INPUT_FOCUSED = chipSelect.closest('.tag-chip-input').dataset.chipId;
    rerenderTagRoot(chipSelect.dataset.tagRoot);
    refocusChipInput(CHIP_INPUT_FOCUSED);
    return true;
  }
  return false;
}
// Handles the filter text field's 'input' event -- updates only the suggestion list directly,
// never through a full render, or the field would lose focus/cursor on every keystroke. Returns
// true if this was a chip filter field (caller should stop processing further), false otherwise.
function handleTagChipFilterInput(t){
  if(t.dataset.action!=='tag-chip-filter') return false;
  const sugg = document.getElementById(t.dataset.chipId+'_sugg');
  if(sugg){
    sugg.innerHTML = chipSuggestionsHtml(t.dataset.tagRoot, t.dataset.tagPath, t.value);
    sugg.hidden = false;
    positionFloatingPanel(sugg, t);
  }
  return true;
}
function chipSuggestionsHtml(root, path, filterText){
  // "fillTag" is a third root, "Fill in with tag" (js/06_app.js's fillWithTagHtml()) -- it's
  // single-select and has no backing tags[] array to read/exclude against, just the one
  // currently-picked id (if any) on CURRENT_VERSION.selection.lastFillTagId, and its picks are
  // handled by onEditorClick()'s own data-action="fill-tag-chip-select" branch (confirm() +
  // versionFillByTag()), not applyTagToggle() -- so this only needs to build the filtered
  // suggestion list, not the toggle-button wiring the other two roots share.
  if(root==='fillTag'){
    const selectedId = CURRENT_VERSION.selection.lastFillTagId || '';
    const q = (filterText||'').trim().toLowerCase();
    // currentLibrary() -- a standalone version fills from (and its picker lists) its own
    // embedded tag pool, never the account's shared one.
    const options = (currentLibrary().tagOptions||[]).filter(o=> o.id!==selectedId && (!q || (o.label||'').toLowerCase().includes(q)));
    if(!options.length) return '<div class="tag-chip-suggestion" style="color:var(--text-muted);cursor:default;">No matching tags</div>';
    return options.map(o=>`<button type="button" class="tag-chip-suggestion" data-action="fill-tag-chip-select" data-tag-id="${esc(o.id)}">${esc(o.label||'(untitled tag)')}</button>`).join('');
  }
  const target = root==='library' ? LIBRARY : IMPORT_REVIEW.reviewState;
  const ids = getPath(target, path) || [];
  const q = (filterText||'').trim().toLowerCase();
  const options = (LIBRARY.tagOptions||[]).filter(o=> !ids.includes(o.id) && (!q || (o.label||'').toLowerCase().includes(q)));
  if(!options.length) return '<div class="tag-chip-suggestion" style="color:var(--text-muted);cursor:default;">No matching tags</div>';
  return options.map(o=>`<button type="button" class="tag-chip-suggestion" data-action="tag-chip-select" data-tag-root="${root}" data-tag-path="${esc(path)}" data-tag-id="${esc(o.id)}">${esc(o.label||'(untitled tag)')}</button>`).join('');
}
function tagChipInputHtml(root, path, selectedIds){
  const ids = selectedIds || [];
  const options = LIBRARY.tagOptions || [];
  const chipId = 'tagchip_'+root+'_'+path.replace(/[^a-zA-Z0-9]/g,'_');
  const chips = ids.map(id=>{
    const opt = options.find(o=>o.id===id);
    const label = opt ? (opt.label||'(untitled tag)') : '(removed tag)';
    return `<span class="tag-chip">${esc(label)}<button type="button" class="tag-chip-remove" data-action="remove-tag-chip" data-tag-root="${root}" data-tag-path="${esc(path)}" data-tag-id="${esc(id)}" aria-label="Remove tag">&times;</button></span>`;
  }).join('');
  const isOpen = CHIP_INPUT_FOCUSED===chipId;
  return `<span class="tag-chip-input" data-chip-id="${chipId}">
    ${chips}
    <input type="text" class="tag-chip-text" placeholder="Add tag…" autocomplete="off"
      data-action="tag-chip-filter" data-tag-root="${root}" data-tag-path="${esc(path)}" data-chip-id="${chipId}">
    <div class="tag-chip-suggestions" id="${chipId}_sugg" ${isOpen?'':'hidden'}>${isOpen?chipSuggestionsHtml(root,path,''):''}</div>
  </span>`;
}
// Refocuses a chip-input's text field and re-opens its (now stale) suggestion list after a
// render caused by adding/removing a chip -- a full re-render always destroys and rebuilds the
// DOM, which would otherwise silently drop focus/cursor out of the field the user was just
// typing in.
function refocusChipInput(chipId){
  const input = document.querySelector(`input.tag-chip-text[data-chip-id="${chipId}"]`);
  if(!input) return;
  input.focus();
  const sugg = document.getElementById(chipId+'_sugg');
  if(sugg){
    sugg.innerHTML = chipSuggestionsHtml(input.dataset.tagRoot, input.dataset.tagPath, '');
    sugg.hidden = false;
    positionFloatingPanel(sugg, input);
  }
}

function selectionListHtml(kind){
  const lib = currentLibrary();
  const selMap={}; CURRENT_VERSION.selection[kind].forEach((s,i)=> selMap[s.refId]=i);
  const libraryItems = lib[kind];
  // "+ Add from my Library" only makes sense for a standalone version -- a normal version
  // already IS a view over the shared Library, there's nothing to pull in from itself.
  const addFromLibBtn = isStandaloneVersion() ? `<button class="btn btn-ghost btn-sm" data-action="open-library-picker" data-kind="${kind}">+ Add from my Library</button>` : '';
  const addBtnHtml = `<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;"><button class="btn btn-ghost btn-sm" data-action="ed-add-entry" data-kind="${kind}">+ Add new ${ED_ADD_LABELS[kind]}</button>${addFromLibBtn}</div>`;
  if(!libraryItems.length) return '<p style="font-size:12px;color:var(--text-muted);">Nothing in the library yet.</p>'+addBtnHtml;
  // Row order must match resolveVersion()'s print order -- included entries in
  // selection[kind]'s own array order (what actually determines print order; see
  // resolveVersion()'s resolveKind(), which maps over the selection array, not the
  // library's) -- not LIBRARY[kind]'s fixed library-order, which is what this used to sort
  // by. That mismatch was a real, reported bug: clicking an entry's move up/down changed
  // print order correctly, but the row never visibly moved in this panel, since this list's
  // own order never reflected the reorder at all. Not-yet-included entries are appended
  // after, in library order (nothing to determine their order by yet).
  const byId = {}; libraryItems.forEach(e=>{ byId[e.id]=e; });
  const includedEntries = CURRENT_VERSION.selection[kind].map(s=>byId[s.refId]).filter(Boolean);
  const includedIds = new Set(includedEntries.map(e=>e.id));
  const items = includedEntries.concat(libraryItems.filter(e=>!includedIds.has(e.id)));
  return items.map(entry=>{
    const hasBullets = kind==='experience'||kind==='projects';
    const included = selMap[entry.id]!==undefined;
    const label = entryLabel(kind, entry) || '(untitled)';
    let bulletsHtml='';
    if(hasBullets && included){
      const sel = CURRENT_VERSION.selection[kind][selMap[entry.id]];
      bulletsHtml = `<div class="sel-bullets">${entry.bullets.map(b=>{
        const on = sel.bulletIds.includes(b.id);
        return `<label class="sel-bullet ${on?'on':''}"><input type="checkbox" data-bullet-toggle data-kind="${kind}" data-ref="${esc(entry.id)}" data-bullet="${esc(b.id)}" ${on?'checked':''}> ${esc(b.text.slice(0,70))}${b.text.length>70?'\u2026':''}${bulletTagBadgesHtml(b.tags, lib)}${!hasMetric(b.text)?' <span class="metric-flag">no metric</span>':''}</label>`;
      }).join('')}</div>`;
    }
    // Skills' own content (the category's comma-separated item list) and tags render on
    // their own line below the label, same as bullets do for experience/projects -- on
    // request ("it looks clumsy with the category label and the items just in the same
    // line"), replacing a single crammed "Label: item, item, item [tags]" line.
    const skillItemsHtml = kind==='skills' && entry.text ? `<div class="sel-skill-items">${esc(entry.text)}</div>` : '';
    const skillTagsHtml = kind==='skills' ? bulletTagBadgesHtml(entry.tags, lib) : '';
    return `<div class="sel-item">
      <div class="sel-head">
        <input type="checkbox" data-ref-toggle data-kind="${kind}" data-ref="${esc(entry.id)}" ${included?'checked':''}>
        <label>${esc(label)}</label>
        ${included?`<div class="move-btns"><button data-move="up" data-kind="${kind}" data-ref="${esc(entry.id)}">${ICONS.chevronUp}</button><button data-move="down" data-kind="${kind}" data-ref="${esc(entry.id)}">${ICONS.chevronDown}</button></div>`:''}
      </div>
      ${skillItemsHtml}${skillTagsHtml}
      ${bulletsHtml}
      ${editDetailsButtonHtml(kind, entry.id)}
    </div>`;
  }).join('') + addBtnHtml;
}
function referencesPanelHtml(){
  const mode = CURRENT_VERSION.referencesMode;
  return `<div class="field"><label>Mode</label><select data-path="referencesMode">
    <option value="full" ${mode==='full'?'selected':''}>Full list</option>
    <option value="onrequest" ${mode==='onrequest'?'selected':''}>Available upon request</option>
    <option value="none" ${mode==='none'?'selected':''}>None</option>
  </select></div>
  ${mode==='full' ? selectionListHtml('references') : ''}`;
}
// Each custom section gets its own <details> block, same as the 5 built-in sections -- own
// summary (with section-move buttons once included), own per-version heading override
// (sectionHeadingFieldHtml, exactly like Experience/Projects/etc get), own bullets/paragraph
// content -- rather than being lumped as rows inside one shared "Custom Sections" panel.
// Called two ways from renderEditor(): once per token in resolveSectionOrder() for sections
// already included (order matters, driven by sectionOrder), and once per not-yet-included
// library entry (order doesn't matter yet -- they have no position to speak of until turned
// on), so `included` is passed in rather than recomputed here.
function customSectionBlockHtml(cs, included){
  const heading = cs.heading || '(untitled custom section)';
  const token = 'custom:'+cs.id;
  let body = `<label class="chk chk-card"><input type="checkbox" data-ref-toggle data-kind="customSections" data-ref="${esc(cs.id)}" ${included?'checked':''}><span>Include in this version</span></label>`;
  if(included){
    body += sectionHeadingFieldHtml(token, cs.heading||'Untitled');
    if(cs.contentType==='bullets'){
      const sel = CURRENT_VERSION.selection.customSections.find(s=>s.refId===cs.id);
      const bulletIds = sel ? sel.bulletIds : [];
      body += `<div class="sel-bullets">${cs.bullets.map(b=>{
        const on = bulletIds.includes(b.id);
        return `<label class="sel-bullet ${on?'on':''}"><input type="checkbox" data-bullet-toggle data-kind="customSections" data-ref="${esc(cs.id)}" data-bullet="${esc(b.id)}" ${on?'checked':''}> ${esc(b.text.slice(0,70))}${b.text.length>70?'…':''}${bulletTagBadgesHtml(b.tags, currentLibrary())}${!hasMetric(b.text)?' <span class="metric-flag">no metric</span>':''}</label>`;
      }).join('')}</div>`;
    } else {
      const preview = (cs.text||'').slice(0,140);
      body += `<p style="font-size:12px;color:var(--text-muted);margin-top:6px;">${esc(preview)}${(cs.text||'').length>140?'…':''}</p>`;
    }
  }
  // Unconditional (not gated on `included`) -- same as Library tab, a custom section's own
  // content (heading, subheading/dates/location, bullets/paragraph text) should be editable
  // right here whether or not it's turned on for this version yet.
  body += editDetailsButtonHtml('customSections', cs.id);
  return { label: heading, body, included };
}
// Shared by the per-version editor's Style panel and the account-level Preferences panel
// (see renderPreferences()) -- same fields, different data-path prefix/target object, so
// account-level style defaults don't need a second, separately-maintained copy of every
// field. `style`/`pageSize` are read-only inputs to render from; `pathPrefix`/`pageSizePath`
// control which object setPath() below writes into (CURRENT_VERSION.style vs
// PREFERENCES.default_style).
// `compact` (default false -- the per-version editor's own Style panel call site never passes
// it, so its layout is completely unchanged) is Preferences' own request: its Default style
// column was noticeably taller than the stacked References-mode/Default-section-order/Import-
// review-defaults column next to it, since this panel normally spreads its ~20 fields across
// many one- or two-per-row lines. compact:true regroups the same fields into a specific,
// requested field-by-field arrangement (5 explicit rows, none left to a generic flowing grid):
//   1. Font family, Bullet marker, Body align       (field-row3)
//   2. Name size, Contact size, Body size, Page size (field-row4 -- page size moved up from
//      its own separate line further down, on a follow-up, to close more of the height gap)
//   3. Line height, Bullet gap, Entry gap, Section gap (field-row4)
//   4. the 4 margin fields (field-row4)
//   5. Heading align, Heading size, Heading gap above, Heading gap below (field-row4)
// then underline/uppercase headings share one row instead of two. Bold fields keeps the plain
// 2-column .bold-toggles grid, same as the editor's own Style panel -- an earlier version
// widened it to 3 columns here specifically, reverted on a direct follow-up request. Every
// numbered row above divides evenly (3 or 4 fields exactly filling a 3- or 4-column row) --
// this specific grouping was chosen field-by-field, not derived generically, so unlike an
// earlier version of this layout there's no incomplete trailing row to work around. This is
// Preferences-only by construction -- the editor's own Style panel keeps its existing spacing
// (a single flowing 2-column grid) exactly as it's always been.
//
// Bold fields also drops 'dates' from the checklist unconditionally, in both compact and
// non-compact mode -- a real, reported dead toggle: bd() (both the live-preview one in this
// file and buildDocxDocument()'s own in js/05_export_docx.js) is never called with 'dates' as
// its flagKey anywhere, so checking it never had any visible effect on the live preview, PDF,
// or DOCX export. defaultStyle() (js/03_model.js) no longer seeds it for new style objects;
// filtering it out here as well (rather than only removing it from defaultStyle()) is what
// makes it disappear from the UI for every already-saved version/preference too, without
// needing a data migration -- the dead key can stay harmlessly in old saved data forever, it's
// simply never rendered as a checkbox anywhere again.
function stylePanelHtml(style, pathPrefix, pageSize, pageSizePath, compact){
  const st = style;
  // Every field this panel exposes, each as its own standalone snippet -- both branches below
  // just compose these in a different order/grouping, rather than keeping two near-duplicate
  // copies of the same field markup in sync by hand.
  const fontFieldHtml = `<div class="field"><label>Font family</label><select data-path="${pathPrefix}.fontFamily">
    <option value='"Times New Roman", Times, serif' ${st.fontFamily.includes('Times')?'selected':''}>Times New Roman</option>
    <option value='Arial, sans-serif' ${st.fontFamily.includes('Arial')?'selected':''}>Arial</option>
    <option value='"Carlito", sans-serif' ${(st.fontFamily.includes('Calibri')||st.fontFamily.includes('Carlito'))?'selected':''}>Calibri</option>
    <option value='Georgia, serif' ${st.fontFamily.includes('Georgia')?'selected':''}>Georgia</option>
  </select></div>`;
  const headingAlignFieldHtml = `<div class="field"><label>Heading align</label><select data-path="${pathPrefix}.headingAlign">
      <option value="left" ${st.headingAlign==='left'?'selected':''}>Left</option>
      <option value="center" ${st.headingAlign==='center'?'selected':''}>Center</option>
    </select></div>`;
  const bodyAlignFieldHtml = `<div class="field"><label>Body align</label><select data-path="${pathPrefix}.bodyAlign">
      <option value="justify" ${st.bodyAlign==='justify'?'selected':''}>Justify</option>
      <option value="left" ${st.bodyAlign==='left'?'selected':''}>Left</option>
    </select></div>`;
  const bulletMarkerFieldHtml = `<div class="field"><label>Bullet marker</label><select data-path="${pathPrefix}.bulletMarker">
      <option value="&#8226;" ${st.bulletMarker==='\u2022'?'selected':''}>&bull;</option>
      <option value="-" ${st.bulletMarker==='-'?'selected':''}>&ndash;</option>
      <option value="&#9656;" ${st.bulletMarker==='\u25B8'?'selected':''}>&#9656;</option>
      <option value="none" ${st.bulletMarker==='none'?'selected':''}>none</option>
    </select></div>`;
  const fsNameFieldHtml = `<div class="field"><label>Name size (pt)</label><input type="number" step="0.5" min="6" data-path="${pathPrefix}.fsName" value="${st.fsName}"></div>`;
  const fsContactFieldHtml = `<div class="field"><label>Contact size (pt)</label><input type="number" step="0.5" min="6" data-path="${pathPrefix}.fsContact" value="${st.fsContact}"></div>`;
  const fsHeadingFieldHtml = `<div class="field"><label>Heading size (pt)</label><input type="number" step="0.5" min="6" data-path="${pathPrefix}.fsHeading" value="${st.fsHeading}"></div>`;
  const fsBodyFieldHtml = `<div class="field"><label>Body size (pt)</label><input type="number" step="0.5" min="6" data-path="${pathPrefix}.fsBody" value="${st.fsBody}"></div>`;
  const lineHeightFieldHtml = `<div class="field"><label>Line height</label><input type="number" step="0.05" min="1" data-path="${pathPrefix}.lineHeight" value="${st.lineHeight}"></div>`;
  const gapBulletFieldHtml = `<div class="field"><label>Bullet gap (pt)</label><input type="number" step="0.5" min="0" data-path="${pathPrefix}.gapBullet" value="${st.gapBullet}"></div>`;
  const gapEntryFieldHtml = `<div class="field"><label>Entry gap (pt)</label><input type="number" step="0.5" min="0" data-path="${pathPrefix}.gapEntry" value="${st.gapEntry}"></div>`;
  const gapSectionFieldHtml = `<div class="field"><label>Section gap (pt)</label><input type="number" step="0.5" min="0" data-path="${pathPrefix}.gapSection" value="${st.gapSection}"></div>`;
  const headingGapAboveFieldHtml = `<div class="field"><label>Heading gap above (pt)</label><input type="number" step="0.5" min="0" data-path="${pathPrefix}.headingGapAbove" value="${st.headingGapAbove}"></div>`;
  const headingGapBelowFieldHtml = `<div class="field"><label>Heading gap below (pt)</label><input type="number" step="0.5" min="0" data-path="${pathPrefix}.headingGapBelow" value="${st.headingGapBelow}"></div>`;
  const pageSizeOptionsHtml = `<select data-path="${pageSizePath}">
    <option value="A4" ${pageSize==='A4'?'selected':''}>A4</option>
    <option value="Letter" ${pageSize==='Letter'?'selected':''}>US Letter</option>
  </select>`;
  const pageSizeFieldHtml = `<div class="field"><label>Page size</label>${pageSizeOptionsHtml}</div>`;
  const pageSizeFieldOwnLineHtml = `<div class="field" style="margin-top:8px;"><label>Page size</label>${pageSizeOptionsHtml}</div>`;
  const marginsFieldsHtml = `<div class="field"><label>Margin top (in)</label><input type="number" step="0.1" min="0.5" data-path="${pathPrefix}.marginTop" value="${st.marginTop}"></div>
    <div class="field"><label>Margin right (in)</label><input type="number" step="0.1" min="0.5" data-path="${pathPrefix}.marginRight" value="${st.marginRight}"></div>
    <div class="field"><label>Margin bottom (in)</label><input type="number" step="0.1" min="0.5" data-path="${pathPrefix}.marginBottom" value="${st.marginBottom}"></div>
    <div class="field"><label>Margin left (in)</label><input type="number" step="0.1" min="0.5" data-path="${pathPrefix}.marginLeft" value="${st.marginLeft}"></div>`;
  // compact:true's specific row grouping was requested directly, field by field -- every row
  // here divides evenly (3 or 4 items filling a 3- or 4-column field-row exactly), unlike the
  // first version of this grid, so no flex-fill workaround is needed anymore for an incomplete
  // trailing row.
  const topRowHtml = compact
    ? `<div class="field-row3">${fontFieldHtml}${bulletMarkerFieldHtml}${bodyAlignFieldHtml}</div>
       <div class="field-row4" style="margin-top:8px;">${fsNameFieldHtml}${fsContactFieldHtml}${fsBodyFieldHtml}${pageSizeFieldHtml}</div>
       <div class="field-row4" style="margin-top:8px;">${lineHeightFieldHtml}${gapBulletFieldHtml}${gapEntryFieldHtml}${gapSectionFieldHtml}</div>
       <div class="field-row4" style="margin-top:8px;">${marginsFieldsHtml}</div>
       <div class="field-row4" style="margin-top:8px;">${headingAlignFieldHtml}${fsHeadingFieldHtml}${headingGapAboveFieldHtml}${headingGapBelowFieldHtml}</div>`
    : `${fontFieldHtml}<div class="style-grid">${fsNameFieldHtml}${fsContactFieldHtml}${fsHeadingFieldHtml}${fsBodyFieldHtml}${lineHeightFieldHtml}${bulletMarkerFieldHtml}${gapBulletFieldHtml}${gapEntryFieldHtml}${gapSectionFieldHtml}${headingGapAboveFieldHtml}${headingGapBelowFieldHtml}${headingAlignFieldHtml}${bodyAlignFieldHtml}</div>`;
  const underlineUppercaseHtml = compact
    ? `<div class="field-row" style="margin-top:6px;">
        <label class="chk chk-card"><input type="checkbox" data-path="${pathPrefix}.headingUnderline" ${st.headingUnderline?'checked':''}><span>Underline headings</span></label>
        <label class="chk chk-card"><input type="checkbox" data-path="${pathPrefix}.headingUppercase" ${st.headingUppercase?'checked':''}><span>Uppercase headings</span></label>
      </div>`
    : `<label class="chk chk-card" style="margin-top:6px;"><input type="checkbox" data-path="${pathPrefix}.headingUnderline" ${st.headingUnderline?'checked':''}><span>Underline headings</span></label>
       <label class="chk chk-card" style="margin-top:6px;"><input type="checkbox" data-path="${pathPrefix}.headingUppercase" ${st.headingUppercase?'checked':''}><span>Uppercase headings</span></label>`;
  return `${topRowHtml}
  ${underlineUppercaseHtml}
  ${compact?'':`<div class="field-row4" style="margin-top:8px;">${marginsFieldsHtml}</div>${pageSizeFieldOwnLineHtml}`}
  <div style="font-size:11px;color:var(--text-muted);margin:8px 0 2px;">Bold fields</div>
  <div class="bold-toggles">${Object.keys(st.bold).filter(k=>k!=='dates').map(k=>`<label class="chk chk-card"><input type="checkbox" data-path="${pathPrefix}.bold.${k}" ${st.bold[k]?'checked':''}><span>${k}</span></label>`).join('')}</div>`;
}
function moveSelection(version, kind, refId, dir){
  const list = version.selection[kind];
  const i = list.findIndex(x=>x.refId===refId); if(i<0) return version;
  const j = dir==='up'?i-1:i+1;
  if(j<0||j>=list.length) return version;
  const next = list.slice(); [next[i],next[j]]=[next[j],next[i]];
  return {...version, selection:{...version.selection, [kind]:next}};
}
function sectionHeadingFieldHtml(token, defaultLabel){
  const sh = CURRENT_VERSION.sectionHeadings || {};
  const val = sh[token]!=null ? sh[token] : defaultLabel;
  return `<div class="field section-heading-field"><label>Heading</label><input type="text" data-path="sectionHeadings.${esc(token)}" value="${esc(val)}"></div>`;
}
const BUILTIN_SECTION_META = {
  experience: { label:'Experience', defaultHeading:'Work Experience', defaultOpen:true, body:()=>sectionHeadingFieldHtml('experience','Work Experience')+selectionListHtml('experience') },
  projects:   { label:'Projects',   defaultHeading:'Projects',        defaultOpen:false, body:()=>sectionHeadingFieldHtml('projects','Projects')+selectionListHtml('projects') },
  education:  { label:'Education',  defaultHeading:'Education',       defaultOpen:false, body:()=>sectionHeadingFieldHtml('education','Education')+selectionListHtml('education') },
  skills:     { label:'Skills',     defaultHeading:'Skills',          defaultOpen:false, body:()=>sectionHeadingFieldHtml('skills','Skills')+skillSetSelectorHtml() },
  references: { label:'References', defaultHeading:'References',      defaultOpen:false, body:()=>sectionHeadingFieldHtml('references','References')+referencesPanelHtml() },
};

/* ===== entry-edit modal =====
   Opened from any "Edit details" button (selectionListHtml()/customSectionBlockHtml()/
   summarySelectorHtml() via editDetailsButtonHtml()). A full dialog rather than a small
   inline disclosure -- that was the original design here and was reported as too cramped
   for comfortable field editing. Unlike every other data-path field in this app, the
   modal's inputs are deliberately NOT live-bound: nothing is written anywhere until Save is
   clicked, because Save also needs to know the scope choice (library vs. this version only)
   before it knows *which* object to write into. This mirrors the GH Backup modal's own
   "read values via getElementById at Save time" pattern (js/06_app.js's renderGhPanel()),
   not the rest of the editor's live data-path convention. */
var ENTRY_EDIT_MODAL = null; // {kind, entryId} | null
// The library fields each kind's modal edits, as [fieldName,label] pairs (order = render
// order). 'heading' is deliberately excluded from customSections -- that field already has
// its own dedicated per-version override mechanism (CURRENT_VERSION.sectionHeadings, see
// sectionHeadingFieldHtml()); adding it here too would create two competing ways to override
// the same thing. Bullets (for kinds that have them) are handled separately, not listed here.
const ENTRY_EDIT_FIELDS = {
  experience: [['company','Company'],['tag','Note (optional)'],['role','Role'],['dates','Dates'],['location','Location']],
  projects: [['title','Title'],['dates','Dates']],
  education: [['school','School'],['location','Location'],['degree','Degree'],['dates','Dates']],
  skills: [['label','Category label'],['text','Items']],
  references: [['name','Name'],['title','Title / relationship'],['contact','Contact']],
  customSections: [['subheading','Subheading (optional)'],['location','Location (optional)'],['dates','Dates (optional)'],['contentType','Content type'],['text','Paragraph text (used when Content type is Paragraph)']],
};
// The resolved (library value, shadowed by any existing per-version override) view of an
// entry -- what the modal should show when it opens, so editing starts from what's actually
// showing in the preview right now, not a stale library value a prior override has already
// superseded for this version.
function resolvedEntryForModal(kind, entryId){
  const libEntry = currentLibrary()[kind].find(e=>e.id===entryId);
  if(!libEntry) return null;
  const sel = CURRENT_VERSION.selection[kind].find(s=>s.refId===entryId);
  let resolved = sel && sel.overrides ? {...libEntry, ...sel.overrides} : libEntry;
  if(resolved.bullets && sel && sel.bulletOverrides){
    resolved = {...resolved, bullets: resolved.bullets.map(b=> sel.bulletOverrides[b.id]!=null ? {...b, text:sel.bulletOverrides[b.id]} : b)};
  }
  return resolved;
}
function entryEditFieldInputHtml(kind, field, label, value){
  if(field==='contentType'){
    return `<div class="field"><label>${label}</label><select id="ef_${field}">
      <option value="bullets" ${value==='bullets'?'selected':''}>Bullets</option>
      <option value="paragraph" ${value==='paragraph'?'selected':''}>Paragraph</option>
    </select></div>`;
  }
  if(field==='text' && kind==='customSections'){
    return `<div class="field"><label>${label}</label><textarea id="ef_${field}" rows="3">${esc(value||'')}</textarea></div>`;
  }
  return `<div class="field"><label>${label}</label><input type="text" id="ef_${field}" value="${esc(value||'')}"></div>`;
}
function entryEditBulletsHtml(resolvedEntry){
  // The per-bullet "+ Library" button is the fine-grained half of the standalone "Add to
  // Library" escape hatch (see addStandaloneBulletToLibrary() below) -- only relevant, and only
  // rendered, when the entry being edited lives in a standalone version's embedded copy. A
  // normal version's bullets already live in the shared LIBRARY; there's nothing to "add".
  return `<div style="font-size:11px;color:var(--text-muted);margin:10px 0 4px;">Bullets</div>
    ${resolvedEntry.bullets.map(b=>`<div class="bullet-row">
      <textarea id="ef_bullet_${esc(b.id)}">${esc(b.text)}</textarea>
      <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end;">
        ${isStandaloneVersion()?`<button type="button" class="btn btn-ghost btn-sm" data-modal-action="add-bullet-to-library" data-bullet-id="${esc(b.id)}" title="Add this bullet to your Library">+ Library</button>`:''}
        <button type="button" class="btn btn-danger btn-icon" data-modal-action="remove-bullet" data-bullet-id="${esc(b.id)}">${ICONS.close}</button>
      </div>
    </div>`).join('')}
    <button type="button" class="btn btn-ghost btn-sm" data-modal-action="add-bullet">+ Add bullet</button>`;
}
function entryEditModalHtml(){
  if(!ENTRY_EDIT_MODAL) return '';
  const { kind, entryId } = ENTRY_EDIT_MODAL;
  const lib = currentLibrary();
  const standalone = isStandaloneVersion();
  if(kind==='summaries'){
    const libEntry = lib.summaries.find(s=>s.id===entryId);
    if(!libEntry) return '';
    const sel = CURRENT_VERSION.selection;
    // If this version's summaryId still points at this summary and it hasn't set its own
    // customSummaryText, the version is currently just showing the library text as-is --
    // prefill with that, not blank.
    const currentText = (sel.summaryId===entryId && sel.customSummaryText) ? sel.customSummaryText : libEntry.text;
    // A standalone version's summary already lives only in its own embedded copy -- the
    // library-vs-version-only scope choice (which exists to pick between the shared LIBRARY
    // and a per-version shadow over it) has nothing to choose between here, so it's skipped
    // entirely: saveEntryEditModal() always writes straight into embeddedLibrary for these.
    const scopeHtml = standalone ? '' : `<div class="edit-scope-choice">
            <div class="gh-section-label">Save changes to</div>
            <label class="chk chk-card" style="margin-bottom:6px;"><input type="radio" name="editScope" value="library" checked><span>Library (every version using this summary)</span></label>
            <label class="chk chk-card" style="margin-bottom:6px;"><input type="radio" name="editScope" value="version"><span>Only this version</span></label>
            <label class="chk chk-card"><input type="radio" name="editScope" value="perVersion"><span>Choose per version</span></label>
          </div>`;
    return `<div class="entry-edit-modal-overlay" id="entryEditModalOverlay">
      <div class="entry-edit-modal-box">
        <div class="gh-modal-header"><h3>Edit summary</h3><button class="gh-modal-close" id="entryEditModalClose" aria-label="Close">${ICONS.close}</button></div>
        <div class="gh-modal-body">
          <div class="field"><label>Text (use **word** for inline bold)</label><textarea id="ef_text" rows="6">${esc(currentText)}</textarea></div>
          ${scopeHtml}
        </div>
        <div class="gh-actions">
          <button class="btn btn-brass btn-sm" id="entryEditModalSave">Save</button>
          <button class="btn btn-ghost btn-sm" id="entryEditModalCancel">Cancel</button>
          ${standalone?`<button type="button" class="btn btn-ghost btn-sm" id="entryEditModalAddToLibrary" style="margin-left:auto;">+ Add to my Library</button>`:''}
        </div>
      </div>
    </div>`;
  }
  const libEntry = lib[kind].find(e=>e.id===entryId);
  if(!libEntry) return '';
  const resolved = resolvedEntryForModal(kind, entryId);
  const sel = CURRENT_VERSION.selection[kind].find(s=>s.refId===entryId);
  const fields = ENTRY_EDIT_FIELDS[kind];
  const fieldsHtml = fields.map(([f,label])=> entryEditFieldInputHtml(kind, f, label, resolved[f])).join('');
  const bulletsHtml = resolved.bullets ? entryEditBulletsHtml(resolved) : '';
  const kindLabel = ED_ADD_LABELS[kind] || kind;
  const scopeHtml = standalone ? '' : `<div class="edit-scope-choice">
          <div class="gh-section-label">Save changes to</div>
          <label class="chk chk-card" style="margin-bottom:6px;"><input type="radio" name="editScope" value="library" checked><span>Library (all versions)</span></label>
          <label class="chk chk-card" style="margin-bottom:6px;" ${sel?'':'title="Include this in the version first to enable a version-only edit"'}><input type="radio" name="editScope" value="version" ${sel?'':'disabled'}><span>Only this version</span></label>
          <label class="chk chk-card"><input type="radio" name="editScope" value="perVersion"><span>Choose per version</span></label>
        </div>`;
  // "Add to my Library" is the entry-level half of the standalone escape hatch -- copies this
  // whole entry (bullets included, tags stripped -- see copyEntryForLibrary()) into the
  // account's real, shared LIBRARY, leaving the embedded copy this modal is editing untouched.
  const addToLibraryBtn = standalone ? `<button type="button" class="btn btn-ghost btn-sm" id="entryEditModalAddToLibrary" style="margin-left:auto;">+ Add to my Library</button>` : '';
  return `<div class="entry-edit-modal-overlay" id="entryEditModalOverlay">
    <div class="entry-edit-modal-box">
      <div class="gh-modal-header"><h3>Edit ${esc(kindLabel)}</h3><button class="gh-modal-close" id="entryEditModalClose" aria-label="Close">${ICONS.close}</button></div>
      <div class="gh-modal-body">
        ${fieldsHtml}
        ${bulletsHtml}
        ${scopeHtml}
      </div>
      <div class="gh-actions">
        <button class="btn btn-brass btn-sm" id="entryEditModalSave">Save</button>
        <button class="btn btn-ghost btn-sm" id="entryEditModalCancel">Cancel</button>
        <button class="btn btn-danger btn-sm" id="entryEditModalRemove" ${standalone?'':'style="margin-left:auto;"'}>${standalone?'Remove':'Remove from library'}</button>
        ${addToLibraryBtn}
      </div>
    </div>
  </div>`;
}
// Preserve in-progress, not-yet-saved field edits across an add-bullet/remove-bullet click
// inside the modal -- those mutate LIBRARY immediately (bullet structure is always
// library-wide, same as the Library tab) and re-render the modal fresh from that new LIBRARY
// state, which would otherwise silently discard whatever the user had already typed into
// Company/Role/other bullets in this same modal session.
function snapshotModalFieldValues(){
  const vals = {};
  document.querySelectorAll('#entryEditModalWrap [id^="ef_"]').forEach(el=>{ vals[el.id] = el.value; });
  const scopeEl = document.querySelector('input[name="editScope"]:checked');
  return { vals, scope: scopeEl ? scopeEl.value : 'library' };
}
function restoreModalFieldValues(snap){
  Object.keys(snap.vals).forEach(id=>{ const el=document.getElementById(id); if(el) el.value = snap.vals[id]; });
  const scopeEl = document.querySelector(`input[name="editScope"][value="${snap.scope}"]`);
  if(scopeEl) scopeEl.checked = true;
}
function openEntryEditModal(kind, entryId){ ENTRY_EDIT_MODAL = {kind, entryId}; renderEntryEditModal(); }
function closeEntryEditModal(){ ENTRY_EDIT_MODAL = null; renderEntryEditModal(); }
function renderEntryEditModal(){
  const wrap = document.getElementById('entryEditModalWrap');
  if(!wrap) return;
  if(!ENTRY_EDIT_MODAL){ wrap.innerHTML=''; return; }
  // Same reasoning as renderGhPanel()'s own isFreshOpen -- this function also re-runs while
  // the modal is already open (adding/removing a bullet re-renders it, preserving in-progress
  // field values via snapshotModalFieldValues()/restoreModalFieldValues() above), so the
  // entrance animation below must only play on a genuine closed->open transition.
  const isFreshOpen = wrap.children.length===0;
  wrap.innerHTML = entryEditModalHtml();
  const overlay = document.getElementById('entryEditModalOverlay');
  if(!overlay){ ENTRY_EDIT_MODAL=null; return; } // entry vanished from LIBRARY mid-session
  document.getElementById('entryEditModalClose').onclick = closeEntryEditModal;
  document.getElementById('entryEditModalCancel').onclick = closeEntryEditModal;
  overlay.addEventListener('click', (ev)=>{ if(ev.target.id==='entryEditModalOverlay') closeEntryEditModal(); });
  // Wrapped in .catch() rather than left as a bare async handler -- an uncaught rejection here
  // (e.g. refreshLibraryUsageIndex()'s network call genuinely failing, not just returning an
  // ok:false) would otherwise vanish as an unhandled promise rejection with the modal already
  // closed and no feedback at all about whether the edit was saved.
  document.getElementById('entryEditModalSave').onclick = ()=> saveEntryEditModal().catch(e=>{
    console.error('Saving the entry-edit modal failed:', e);
    toast('Something went wrong saving - try again.');
  });
  const removeBtn = document.getElementById('entryEditModalRemove');
  if(removeBtn) removeBtn.onclick = ()=>{
    const { kind, entryId } = ENTRY_EDIT_MODAL;
    noteCurrentLibraryHistory();
    mutateCurrentLibrary(lib=>libRemoveEntry(lib, kind, entryId));
    closeEntryEditModal();
    renderEditor();
  };
  wrap.querySelectorAll('[data-modal-action="add-bullet"]').forEach(btn=> btn.onclick = ()=>{
    const snap = snapshotModalFieldValues();
    noteCurrentLibraryHistory();
    mutateCurrentLibrary(lib=>libAddBullet(lib, ENTRY_EDIT_MODAL.kind, ENTRY_EDIT_MODAL.entryId));
    renderEntryEditModal();
    restoreModalFieldValues(snap);
  });
  wrap.querySelectorAll('[data-modal-action="remove-bullet"]').forEach(btn=> btn.onclick = ()=>{
    const snap = snapshotModalFieldValues();
    delete snap.vals['ef_bullet_'+btn.dataset.bulletId];
    noteCurrentLibraryHistory();
    mutateCurrentLibrary(lib=>libRemoveBullet(lib, ENTRY_EDIT_MODAL.kind, ENTRY_EDIT_MODAL.entryId, btn.dataset.bulletId));
    renderEntryEditModal();
    restoreModalFieldValues(snap);
  });
  // "Add to my Library" -- the standalone escape hatch (see copyEntryForLibrary()'s own
  // comment in js/03_model.js). Reads the field values currently sitting in the modal (via the
  // same snapshot helper used elsewhere in this function) rather than the stale
  // pre-edit-session embedded entry, so "type a fix, then Add to my Library" carries the fix
  // along instead of silently discarding it.
  const addToLibBtn = document.getElementById('entryEditModalAddToLibrary');
  if(addToLibBtn) addToLibBtn.onclick = ()=>{
    const { kind, entryId } = ENTRY_EDIT_MODAL;
    if(kind==='summaries'){
      const text = document.getElementById('ef_text').value;
      addStandaloneSummaryToLibrary(text);
      return;
    }
    const fieldNames = ENTRY_EDIT_FIELDS[kind].map(([f])=>f);
    const resolved = resolvedEntryForModal(kind, entryId);
    const draft = {...resolved};
    fieldNames.forEach(f=>{ const el=document.getElementById('ef_'+f); if(el) draft[f]=el.value; });
    if(draft.bullets){
      draft.bullets = draft.bullets.map(b=>{ const el=document.getElementById('ef_bullet_'+b.id); return el ? {...b, text:el.value} : b; });
    }
    addStandaloneEntryToLibrary(kind, draft);
  };
  wrap.querySelectorAll('[data-modal-action="add-bullet-to-library"]').forEach(btn=> btn.onclick = ()=>{
    const el = document.getElementById('ef_bullet_'+btn.dataset.bulletId);
    if(!el) return;
    addStandaloneBulletToLibrary(ENTRY_EDIT_MODAL.kind, ENTRY_EDIT_MODAL.entryId, el.value);
  });
  const firstField = wrap.querySelector('input, textarea, select');
  if(firstField) firstField.focus();
  if(isFreshOpen) animateModalIn(overlay);
}
async function saveEntryEditModal(){
  if(!ENTRY_EDIT_MODAL) return;
  const { kind, entryId } = ENTRY_EDIT_MODAL;
  const standalone = isStandaloneVersion();
  // The scope radio doesn't exist in the DOM at all for a standalone version (its modal never
  // renders it -- see entryEditModalHtml()), so this always falls through to 'library', which
  // is exactly right: mutateCurrentLibrary() below routes a standalone version's "library"
  // writes into its own embeddedLibrary, not the account's shared one, so there's nothing an
  // "only this version" mode would even mean here that plain "library" doesn't already do.
  const scope = standalone ? 'library' : ((document.querySelector('input[name="editScope"]:checked')||{}).value || 'library');
  if(kind==='summaries'){
    const text = document.getElementById('ef_text').value;
    if(scope==='library'){
      noteCurrentLibraryHistory();
      mutateCurrentLibrary(lib=>({...lib, summaries: lib.summaries.map(s=> s.id===entryId ? {...s, text} : s)}));
    } else if(scope==='perVersion'){
      // Same idea as the generic-entry perVersion branch below, just against the summary's
      // single `text` field instead of a field/bullet list -- see freezeVersionForEntryEditImpact()
      // for how a "Freeze" choice reuses the version's own customSummaryText slot.
      const oldEntry = currentLibrary().summaries.find(s=>s.id===entryId);
      const oldText = oldEntry ? oldEntry.text : '';
      noteCurrentLibraryHistory();
      mutateCurrentLibrary(lib=>({...lib, summaries: lib.summaries.map(s=> s.id===entryId ? {...s, text} : s)}));
      closeEntryEditModal();
      // Flushed immediately, not left on the plain 900ms debounce -- clicking Save with an
      // explicit scope choice already made is a deliberate save decision, same reasoning
      // finishLibraryImpact() documents for the Library tab's own field-level flow, and it
      // means the impact dialog that's about to open is never reasoning about a still-pending,
      // not-yet-persisted Library write.
      const saveRes = await flushLibrarySave();
      if(saveRes && saveRes.ok===false && !saveRes.conflict){
        toast('Could not save the Library - try again.');
        renderEditor();
        return;
      }
      await refreshLibraryUsageIndex();
      const versions = summaryUsageVersions(entryId);
      if(versions.length && text!==oldText){
        showEntryEditImpactDialog({ kind:'summaries', refId:entryId, fields:[], bullets:[], originalText:oldText, versions });
      } else {
        toast('Saved.');
        renderEditor();
      }
      return;
    } else {
      noteVersionHistoryImmediate();
      // "Only this version" for a summary reuses the version's existing free-text slot --
      // a version has always been able to show its own one-off summary text via
      // customSummaryText whenever summaryId is unset; detaching summaryId here is exactly
      // that same mechanism, not new state.
      CURRENT_VERSION = {...CURRENT_VERSION, selection:{...CURRENT_VERSION.selection, summaryId:null, customSummaryText:text}};
      scheduleVersionSave();
    }
    closeEntryEditModal();
    renderEditor();
    return;
  }
  const libEntry = currentLibrary()[kind].find(e=>e.id===entryId);
  if(!libEntry){ closeEntryEditModal(); return; }
  const fieldNames = ENTRY_EDIT_FIELDS[kind].map(([f])=>f);
  if(scope==='library'){
    noteCurrentLibraryHistory();
    const updated = {...libEntry};
    fieldNames.forEach(f=>{ const el=document.getElementById('ef_'+f); if(el) updated[f]=el.value; });
    if(updated.bullets){
      updated.bullets = updated.bullets.map(b=>{
        const el = document.getElementById('ef_bullet_'+b.id);
        return el ? {...b, text: el.value} : b;
      });
    }
    mutateCurrentLibrary(lib=>({...lib, [kind]: lib[kind].map(e=> e.id===entryId ? updated : e)}));
    // Clear any stale version-only overrides for the fields just written to the library --
    // otherwise an old per-version override would keep silently shadowing the new library
    // value forever, and this "update the library" save would appear to do nothing for
    // whichever version had previously customized that same field. Meaningless (and a no-op
    // in practice, since a standalone version's entries never accumulate overrides in the
    // first place -- there's no separate shared entry to shadow) for a standalone version,
    // skipped there.
    if(!standalone){
      let cv = CURRENT_VERSION;
      fieldNames.forEach(f=>{ cv = versionClearOverride(cv, kind, entryId, f); });
      if(updated.bullets) updated.bullets.forEach(b=>{ cv = versionClearBulletOverride(cv, kind, entryId, b.id); });
      CURRENT_VERSION = cv;
      scheduleVersionSave();
    }
  } else if(scope==='perVersion'){
    const changedFields = [];
    fieldNames.forEach(f=>{ const el=document.getElementById('ef_'+f); if(el && el.value!==libEntry[f]) changedFields.push({field:f, oldValue: libEntry[f]}); });
    const changedBullets = [];
    if(libEntry.bullets){
      libEntry.bullets.forEach(b=>{
        const el = document.getElementById('ef_bullet_'+b.id);
        if(el && el.value!==b.text) changedBullets.push({bulletId:b.id, oldValue:b.text});
      });
    }
    noteCurrentLibraryHistory();
    const updated = {...libEntry};
    fieldNames.forEach(f=>{ const el=document.getElementById('ef_'+f); if(el) updated[f]=el.value; });
    if(updated.bullets){
      updated.bullets = updated.bullets.map(b=>{
        const el = document.getElementById('ef_bullet_'+b.id);
        return el ? {...b, text: el.value} : b;
      });
    }
    mutateCurrentLibrary(lib=>({...lib, [kind]: lib[kind].map(e=> e.id===entryId ? updated : e)}));
    closeEntryEditModal();
    // Same reasoning as the summaries perVersion branch above -- flush immediately rather than
    // leave the write on the plain debounce, so the impact dialog is never reasoning about a
    // still-pending Library save.
    const saveRes = await flushLibrarySave();
    if(saveRes && saveRes.ok===false && !saveRes.conflict){
      toast('Could not save the Library - try again.');
      renderEditor();
      return;
    }
    await refreshLibraryUsageIndex();
    const versions = entryUsageVersions(kind, entryId);
    if(versions.length && (changedFields.length || changedBullets.length)){
      showEntryEditImpactDialog({ kind, refId:entryId, fields:changedFields, bullets:changedBullets, versions });
    } else {
      toast('Saved.');
      renderEditor();
    }
    return;
  } else {
    noteVersionHistoryImmediate();
    let cv = CURRENT_VERSION;
    fieldNames.forEach(f=>{ const el=document.getElementById('ef_'+f); if(el) cv = versionSetOverride(cv, kind, entryId, f, el.value); });
    if(libEntry.bullets){
      libEntry.bullets.forEach(b=>{
        const el = document.getElementById('ef_bullet_'+b.id);
        if(el) cv = versionSetBulletOverride(cv, kind, entryId, b.id, el.value);
      });
    }
    CURRENT_VERSION = cv;
    scheduleVersionSave();
  }
  closeEntryEditModal();
  renderEditor();
}
// The three "Add to Library" escape-hatch actions -- see copyEntryForLibrary()'s own comment
// in js/03_model.js for why tags are stripped on the copy. All three always target the
// account's real, shared LIBRARY (never currentLibrary()/mutateCurrentLibrary() -- that's the
// whole point: pulling content OUT of a standalone version's private copy and INTO the shared
// one) and are only ever reachable from a standalone version's entry-edit modal.
function addStandaloneEntryToLibrary(kind, draftEntry){
  noteLibraryHistoryImmediate();
  const copy = copyEntryForLibrary(draftEntry);
  LIBRARY = {...LIBRARY, [kind]: [...LIBRARY[kind], copy]};
  scheduleLibrarySave();
  toast('Added to your Library.');
}
function addStandaloneSummaryToLibrary(text){
  if(!(text||'').trim()) return;
  noteLibraryHistoryImmediate();
  const entry = { id: uid(), text, tags: [] }; // no `label` -- see newLibraryEntry('summaries')
  LIBRARY = {...LIBRARY, summaries: [...LIBRARY.summaries, entry]};
  scheduleLibrarySave();
  toast('Added to your Library.');
}
// A single bullet, added into a matching-by-name existing Library entry if one exists
// (case-insensitive on the kind's identifying field, same match heuristic Import Review's own
// buildImportReview() already uses), or a brand-new entry seeded with this entry's identifying
// fields otherwise. Bullets can't exist without a parent entry in this app's data model (see
// newLibraryEntry() in js/03_model.js), so "add just this bullet" always means "into some
// entry" -- reusing an existing same-named one is what makes repeatedly adding bullets from the
// same standalone company/project end up on one real Library entry instead of a new one each time.
function addStandaloneBulletToLibrary(kind, entryId, bulletText){
  if(!(bulletText||'').trim()) return;
  const embeddedEntry = currentLibrary()[kind].find(e=>e.id===entryId);
  if(!embeddedEntry) return;
  const idField = kind==='experience' ? 'company' : kind==='projects' ? 'title' : 'heading';
  const matchVal = (embeddedEntry[idField]||'').trim().toLowerCase();
  noteLibraryHistoryImmediate();
  let target = matchVal ? LIBRARY[kind].find(e=>(e[idField]||'').trim().toLowerCase()===matchVal) : null;
  if(!target){
    LIBRARY = libAddEntry(LIBRARY, kind);
    const created = LIBRARY[kind][LIBRARY[kind].length-1];
    const seeded = { ...created };
    ENTRY_EDIT_FIELDS[kind].forEach(([f])=>{ if(f!=='contentType' && f!=='text' && embeddedEntry[f]!=null) seeded[f]=embeddedEntry[f]; });
    // idField itself (company/title/heading) is deliberately NOT always listed in
    // ENTRY_EDIT_FIELDS[kind] as a copyable field (customSections excludes 'heading' entirely --
    // it has its own dedicated per-version override mechanism instead, see ENTRY_EDIT_FIELDS's
    // own comment) -- set it explicitly regardless, so a second bullet from the same standalone
    // entry still matches this newly-created one by name next time, instead of silently landing
    // on a second, blank-named entry.
    seeded[idField] = embeddedEntry[idField];
    LIBRARY = {...LIBRARY, [kind]: LIBRARY[kind].map(e=> e.id===created.id ? seeded : e)};
    target = seeded;
  }
  LIBRARY = libAddBullet(LIBRARY, kind, target.id);
  const withNewBullet = LIBRARY[kind].find(e=>e.id===target.id);
  const newBulletId = withNewBullet.bullets[withNewBullet.bullets.length-1].id;
  LIBRARY = {...LIBRARY, [kind]: LIBRARY[kind].map(e=> e.id===target.id ? {...e, bullets: e.bullets.map(b=> b.id===newBulletId ? {...b, text:bulletText} : b)} : e)};
  scheduleLibrarySave();
  toast('Bullet added to your Library.');
}

/* ===== Library picker -- the reverse escape hatch, added on request: "I need an option to add
   things from the library to the standalone version if I want." Lets a standalone version pull
   a whole entry (or a summary) from the account's real, shared LIBRARY into its own private
   embedded copy, the mirror image of "Add to my Library" above. A small dedicated modal (own
   #libraryPickerWrap in index.html, same overlay/box chrome as the entry-edit modal) rather than
   folded into that one, since this is "browse many, pick one to copy in" -- a different shape
   than "edit the one entry already open". Only ever offered when isStandaloneVersion() -- a
   normal version already references the one shared Library directly, there's nothing to "add
   from" it into itself. */
var LIBRARY_PICKER = null; // {kind} | null
const LIBRARY_PICKER_LABELS = {...ED_ADD_LABELS, summaries:'summary'};
function libraryPickerModalHtml(){
  if(!LIBRARY_PICKER) return '';
  const { kind } = LIBRARY_PICKER;
  const items = LIBRARY[kind] || [];
  const kindLabel = LIBRARY_PICKER_LABELS[kind] || kind;
  const rows = items.length ? items.map(e=>`<div class="entry" style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px;">
      <span style="font-size:13px;">${esc(entryLabel(kind, e) || '(untitled)')}</span>
      <button type="button" class="btn btn-ghost btn-sm" data-action="library-picker-add" data-entry-id="${esc(e.id)}">Add</button>
    </div>`).join('') : `<p style="font-size:12px;color:var(--text-muted);">Nothing in your Library for this yet.</p>`;
  return `<div class="entry-edit-modal-overlay" id="libraryPickerOverlay">
    <div class="entry-edit-modal-box">
      <div class="gh-modal-header"><h3>Add ${esc(kindLabel)} from your Library</h3><button class="gh-modal-close" id="libraryPickerClose" aria-label="Close">${ICONS.close}</button></div>
      <div class="gh-modal-body">${rows}</div>
      <div class="gh-actions"><button class="btn btn-ghost" id="libraryPickerCancel">Close</button></div>
    </div>
  </div>`;
}
function openLibraryPicker(kind){ LIBRARY_PICKER = {kind}; renderLibraryPicker(); }
function closeLibraryPicker(){ LIBRARY_PICKER = null; renderLibraryPicker(); }
function renderLibraryPicker(){
  const wrap = document.getElementById('libraryPickerWrap');
  if(!wrap) return;
  wrap.innerHTML = libraryPickerModalHtml();
  if(!LIBRARY_PICKER) return;
  document.getElementById('libraryPickerClose').onclick = closeLibraryPicker;
  document.getElementById('libraryPickerCancel').onclick = closeLibraryPicker;
  document.getElementById('libraryPickerOverlay').addEventListener('click', ev=>{ if(ev.target.id==='libraryPickerOverlay') closeLibraryPicker(); });
  wrap.querySelectorAll('[data-action="library-picker-add"]').forEach(btn=> btn.onclick = ()=>{
    addFromLibraryToStandalone(LIBRARY_PICKER.kind, btn.dataset.entryId);
    closeLibraryPicker();
  });
}
// Copies one real Library entry into the open standalone version's embeddedLibrary and
// immediately includes it (mirrors edAddEntry()'s own "create and include in one motion"
// behavior) -- fresh id, fresh bullet ids, tags stripped (copyEntryForLibrary() is symmetric:
// the embedded pool and the shared pool never share tag ids in either direction, see its own
// comment). Summaries have no include-checklist of their own (a version points at one summary
// at a time via selection.summaryId, not a toggle array) -- adding one here makes it the
// version's active summary directly, same as picking it from the dropdown would.
function addFromLibraryToStandalone(kind, entryId){
  const source = LIBRARY[kind].find(e=>e.id===entryId);
  if(!source) return;
  noteVersionHistoryImmediate();
  const copy = copyEntryForLibrary(source);
  CURRENT_VERSION.embeddedLibrary = {...CURRENT_VERSION.embeddedLibrary, [kind]: [...CURRENT_VERSION.embeddedLibrary[kind], copy]};
  if(kind==='summaries'){
    CURRENT_VERSION.selection.summaryId = copy.id;
  } else {
    CURRENT_VERSION = versionToggleRef(CURRENT_VERSION, kind, copy.id, true);
    if(copy.bullets) copy.bullets.forEach(b=>{ CURRENT_VERSION = versionToggleBullet(CURRENT_VERSION, kind, copy.id, b.id, true); });
  }
  scheduleVersionSave();
  renderEditor();
  toast('Added to this version.');
}

function renderEditor(){
  const panel = document.getElementById('edPanel');
  // Preserve each <details> section's open/closed state across the full innerHTML rebuild
  // below -- renderEditor() reruns on every structural change (e.g. toggling which library
  // entries/bullets a version includes, or reordering sections), which used to silently
  // re-close every section back to its hardcoded default each time. Keyed by an explicit
  // data-block-key (not the summary's text, which now varies for custom sections and isn't
  // guaranteed unique) rather than DOM node identity, since the set/order of blocks changes.
  const openState = {};
  panel.querySelectorAll('details.ed-block[data-block-key]').forEach(d=>{ openState[d.dataset.blockKey] = d.open; });
  // Falls back to PANEL_OPEN_STATE (device-local, KV-backed -- loaded once at sign-in, see
  // loadAuthedAppState()) before the block's own hardcoded default, so a panel someone
  // explicitly opened/closed stays that way across a fresh page load too, not just across an
  // in-session re-render -- openState above only knows about *already-rendered* DOM, which is
  // empty on the very first render of a freshly opened version.
  const isOpen = (key, defaultOpen) => (openState[key] !== undefined ? openState[key] : (PANEL_OPEN_STATE[key] !== undefined ? PANEL_OPEN_STATE[key] : defaultOpen)) ? 'open' : '';

  // The panel's own block order follows CURRENT_VERSION.sectionOrder directly -- reordering
  // a section (the move-section buttons in each block's own summary) now visibly reorders
  // the editor panel itself, not just the print preview off to the side. Custom sections are
  // full peers of the 5 built-ins here (their own block, own heading override, own position
  // in this same order) rather than being lumped into one shared "Custom Sections" panel.
  const includedCustomIds = new Set(CURRENT_VERSION.selection.customSections.map(s=>s.refId));
  // A version's sectionOrder can now contain a custom section's token before that section is
  // actually turned on (Preferences' default order reserves a position without toggling
  // inclusion -- see prefEffectiveSectionOrder()/applyPreferenceDefaults()). Track every
  // token that already has a position, ordered or not, so both the loop below and the
  // trailing "not yet included" list can tell "has a slot" apart from "is actually on".
  const lib = currentLibrary();
  const orderedTokens = resolveSectionOrder(CURRENT_VERSION);
  const tokensWithPosition = new Set(orderedTokens);
  const sectionBlocksHtml = orderedTokens.map(token=>{
    if(token.indexOf('custom:')===0){
      const id = token.slice(7);
      const cs = lib.customSections.find(c=>c.id===id);
      if(!cs) return '';
      // Reserving a position is not the same as being included -- only render this block's
      // checkbox as checked if the ref is actually in selection.customSections. A real,
      // reported bug otherwise: the checkbox showed pre-checked the moment a section had a
      // default position, regardless of whether it was actually toggled on.
      const info = customSectionBlockHtml(cs, includedCustomIds.has(id));
      const key = 'cs:'+id;
      return `<details class="ed-block" data-block-key="${esc(key)}" ${isOpen(key, false)}><summary><span>${esc(info.label)}</span>${sectionMoveButtonsHtml(token)}</summary>${info.body}</details>`;
    }
    const meta = BUILTIN_SECTION_META[token];
    if(!meta) return '';
    return `<details class="ed-block" data-block-key="${token}" ${isOpen(token, meta.defaultOpen)}><summary><span>${meta.label}</span>${sectionMoveButtonsHtml(token)}</summary>${meta.body()}</details>`;
  }).join('');
  // Custom sections with no position at all (neither toggled on nor reserved by a default
  // order) aren't in the loop above; list them too, collapsed, purely so there's still a way
  // to discover and turn them on. Filtered on "no position anywhere" (tokensWithPosition),
  // not just "not included" -- a section can now have a reserved-but-not-yet-toggled position
  // (already rendered, correctly unchecked, in the loop above), and must not also be listed
  // here or it would appear twice.
  const notIncludedCustomHtml = lib.customSections.filter(cs=>!tokensWithPosition.has('custom:'+cs.id)).map(cs=>{
    const info = customSectionBlockHtml(cs, false);
    const key = 'cs:'+cs.id;
    return `<details class="ed-block" data-block-key="${esc(key)}" ${isOpen(key, false)}><summary>${esc(info.label)}</summary>${info.body}</details>`;
  }).join('');

  // Standalone banner -- the one always-visible signal that this version's content is its own
  // private, imported copy, not the account's Library (see currentLibrary()'s own comment).
  // No data-block-key/<details> wrapper -- unlike the collapsible panels below it, this is
  // informational only, always shown, never collapsed.
  const standaloneBannerHtml = isStandaloneVersion()
    ? `<div class="standalone-banner">This version was imported as a standalone copy - its content is private to this version and never touches your Library. Use "Add to my Library" inside any entry's "Edit details" to pull specific bullets or entries into your real Library.</div>`
    : '';
  panel.innerHTML = `
    ${standaloneBannerHtml}
    <details class="ed-block" data-block-key="job-details" ${isOpen('job-details', true)}><summary>Job details</summary>${jobMetaFields()}</details>
    <details class="ed-block" data-block-key="fill-with-tag" ${isOpen('fill-with-tag', false)}><summary>Fill in with tag</summary>${fillWithTagHtml()}</details>
    <details class="ed-block" data-block-key="summary" ${isOpen('summary', true)}><summary>Summary</summary>${summarySelectorHtml()}</details>
    ${sectionBlocksHtml}
    ${notIncludedCustomHtml}
    <div style="margin:-4px 0 12px;display:flex;gap:8px;flex-wrap:wrap;"><button class="btn btn-ghost btn-sm" data-action="ed-add-entry" data-kind="customSections">+ Add custom section</button>${isStandaloneVersion()?`<button class="btn btn-ghost btn-sm" data-action="open-library-picker" data-kind="customSections">+ Add from my Library</button>`:''}</div>
    <details class="ed-block" data-block-key="style" ${isOpen('style', false)}><summary>Style</summary>${stylePanelHtml(CURRENT_VERSION.style, 'style', CURRENT_VERSION.pageSize, 'pageSize')}</details>
  `;
  renderPreview();
}
// Same two-part debounce split as scheduleLibrarySave() above -- see its comment.
// Manual setTimeout (not the generic debounce() helper) specifically so flushVersionSave()
// below can cancel a pending save and run it immediately -- needed because switchView()
// closing the open version on Dashboard (see its own comment) must not let a same-second
// edit's autosave get silently dropped by CURRENT_VERSION going null before the debounce
// timer fires. `version` is captured synchronously at the top, before any `await`, so the
// save is self-contained against CURRENT_VERSION changing (or going null) underneath it
// while this is in flight, regardless of what triggered the flush.
var versionSaveTimer = null;
async function doVersionSave(){
  const version = CURRENT_VERSION;
  if(!version) return;
  SAVE_STATUS.version = 'saving'; updateSaveStatusUI();
  version.updatedAt = Date.now();
  const res = await DB.saveVersion(version.id, version, VERSION_REVISIONS[version.id]);
  if(res.conflict){ showSyncConflict('version', res.serverRow); SAVE_STATUS.version='error'; updateSaveStatusUI(); return; }
  if(!res.ok){ SAVE_STATUS.version='error'; updateSaveStatusUI(); return; }
  VERSION_REVISIONS[version.id] = res.revision;
  const idxEntry = VERSIONS_INDEX.find(v=>v.id===version.id);
  if(idxEntry){
    idxEntry.name=version.name; idxEntry.updatedAt=version.updatedAt;
    idxEntry.company=version.jobMeta.company; idxEntry.role=version.jobMeta.role;
    idxEntry.dateApplied=version.jobMeta.dateApplied; idxEntry.pageCount=version.pageCount||1; idxEntry.main=version.main;
  }
  markGithubDirty('version', version.id);
  SAVE_STATUS.version = 'saved';
  updateSaveStatusUI();
}
function scheduleVersionSave(){
  SAVE_STATUS.version='dirty'; updateSaveStatusUI();
  clearTimeout(versionSaveTimer);
  versionSaveTimer = setTimeout(doVersionSave, 900);
}
// Cancels a pending debounced save and runs it immediately -- called by switchView() right
// before it closes the open version on Dashboard, so the very last edit (made less than
// 900ms before navigating away) still gets persisted instead of silently lost.
function flushVersionSave(){
  if(versionSaveTimer){ clearTimeout(versionSaveTimer); versionSaveTimer=null; doVersionSave(); }
}
function onEditorEvent(ev){
  const t = ev.target;
  // The "Fill in with tag" chip input's filter text field -- same shared handler the Library
  // tab and Import Review's own chip inputs use, updating only the suggestion list directly so
  // typing doesn't lose focus/cursor via a full render. Checked before the data-path branch
  // below since this field carries no data-path of its own.
  if(handleTagChipFilterInput(t)) return;
  // The Skill Set name field, editable inline from skillSetSelectorHtml() -- a distinct
  // attribute (not the generic data-path scheme) since this field targets the *library*
  // (currentLibrary()/mutateCurrentLibrary(), respecting a standalone version's own embedded
  // copy) rather than CURRENT_VERSION, which is what every other data-path field here writes
  // into. Debounced (typing), not immediate -- matches every other live-bound text field's
  // own history-noting convention, one undo step per typing burst, not per keystroke.
  if(t.dataset.skillgroupRename!==undefined){
    if(ev.type==='input') noteCurrentLibraryHistoryDebounced();
    const groupId = t.dataset.skillgroupRename;
    mutateCurrentLibrary(lib=>({...lib, skillGroups: lib.skillGroups.map(g=> g.id===groupId ? {...g, label:t.value} : g)}));
    return;
  }
  if(t.dataset.path){
    let val;
    if(t.type==='checkbox') val = t.checked;
    else if(t.type==='number') val = parseFloat(t.value);
    else val = t.value;
    // The Skill Sets picker's "Custom" option has value="" -- normalize that back to null so
    // it matches blankVersion()'s own documented default (selection.skillGroupId:null) rather
    // than storing an empty string, which resolveVersion()'s `!groupId` check treats the same
    // way functionally but callers elsewhere in the app compare against null explicitly.
    if(t.dataset.path==='selection.skillGroupId' && val==='') val = null;
    // 'input' always fires before 'change' for the same user action, and this branch's
    // setPath() below runs unconditionally on both -- so the state is still pre-mutation
    // only on 'input'. History must snapshot there, not on 'change' (which would capture
    // the already-mutated state as "before" and make undo a no-op). 'change' still runs
    // setPath/save below same as always; it's just not a second history entry.
    const isToggle = t.type==='checkbox' || t.tagName==='SELECT';
    if(ev.type==='input'){ if(isToggle) noteVersionHistoryImmediate(); else noteVersionHistory(); }
    setPath(CURRENT_VERSION, t.dataset.path, val);
    scheduleVersionSave();
    const structural = ['selection.summaryId','pageSize','referencesMode','selection.skillGroupId'].includes(t.dataset.path);
    if(structural) renderEditor(); else renderPreview();
    return;
  }
  if(t.dataset.refToggle!==undefined){
    if(ev.type==='input') noteVersionHistoryImmediate();
    CURRENT_VERSION = versionToggleRef(CURRENT_VERSION, t.dataset.kind, t.dataset.ref, t.checked);
    if(t.dataset.kind==='customSections'){
      const tok = 'custom:'+t.dataset.ref;
      CURRENT_VERSION = t.checked ? sectionOrderAdd(CURRENT_VERSION, tok) : sectionOrderRemove(CURRENT_VERSION, tok);
    }
    scheduleVersionSave(); renderEditor(); return;
  }
  if(t.dataset.bulletToggle!==undefined){
    if(ev.type==='input') noteVersionHistoryImmediate();
    CURRENT_VERSION = versionToggleBullet(CURRENT_VERSION, t.dataset.kind, t.dataset.ref, t.dataset.bullet, t.checked);
    scheduleVersionSave(); renderEditor(); return;
  }
}
// Creates a brand-new library entry (or custom section) and immediately includes it in the
// current version, then opens its edit modal ready to type -- so "+ Add new X" from inside
// the editor needs no trip to the Library tab: create, land on a field, done. Reuses the
// exact same libAddEntry()/versionToggleRef() reducers the Library tab and the ref-toggle
// checkboxes already use.
function edAddEntry(kind){
  noteCurrentLibraryHistory();
  mutateCurrentLibrary(lib=>libAddEntry(lib, kind));
  const created = currentLibrary()[kind][currentLibrary()[kind].length-1];
  noteVersionHistoryImmediate();
  CURRENT_VERSION = versionToggleRef(CURRENT_VERSION, kind, created.id, true);
  if(kind==='customSections') CURRENT_VERSION = sectionOrderAdd(CURRENT_VERSION, 'custom:'+created.id);
  scheduleVersionSave();
  renderEditor();
  if(kind==='customSections'){
    const blockEl = document.getElementById('edPanel').querySelector(`details.ed-block[data-block-key="cs:${created.id}"]`);
    if(blockEl) blockEl.open = true;
  }
  openEntryEditModal(kind, created.id);
}
function onEditorClick(ev){
  const fillSelect = ev.target.closest('button[data-action="fill-tag-chip-select"]');
  if(fillSelect){
    // A real, reported bug in the prior <select>-based version: picking a second tag right
    // after a first silently piled its content on top with no warning that "fill" only ever
    // adds, never replaces. Confirmed before applying now -- cancelling just leaves the picker
    // exactly as it was (nothing was ever removed/changed to snap back from, unlike the old
    // <select> whose own displayed value moved on its own before this handler even ran).
    const tagId = fillSelect.dataset.tagId;
    const opt = (currentLibrary().tagOptions||[]).find(o=>o.id===tagId);
    const label = opt ? (opt.label||'(untitled tag)') : 'this tag';
    const ok = window.confirm(`Include every bullet, entry, and skill category tagged "${label}" in this version (and switch to a tagged summary, if one exists)?\n\nThis only adds/switches - it won't remove anything already included.`);
    if(!ok) return;
    noteVersionHistoryImmediate();
    CURRENT_VERSION = versionFillByTag(CURRENT_VERSION, currentLibrary(), tagId);
    CURRENT_VERSION.selection.lastFillTagId = tagId;
    scheduleVersionSave();
    CHIP_INPUT_FOCUSED = null;
    renderEditor();
    return;
  }
  const fillRemove = ev.target.closest('button[data-action="remove-fill-tag-chip"]');
  if(fillRemove){
    // A real, reported bug: clearing the chip only ever forgot which tag had been picked --
    // it never un-included any of the content that tag's own fill had switched on, so trying a
    // different tag afterward just kept piling everything on top with no way back except
    // manually unchecking every box. Now asks first: confirming actually removes everything
    // this tag was responsible for (versionRemoveByTag(), the exact reverse of
    // versionFillByTag()); declining just clears the chip as before, leaving the content in
    // place -- still a real, useful choice for "I don't need the reminder anymore, but I want
    // to keep what it added."
    const tagId = CURRENT_VERSION.selection.lastFillTagId;
    const opt = tagId ? (currentLibrary().tagOptions||[]).find(o=>o.id===tagId) : null;
    const label = opt ? (opt.label||'(untitled tag)') : 'this tag';
    const alsoRemove = tagId ? window.confirm(`Also remove everything that was included by "${label}"?\n\nOK removes every bullet/entry/skill category this tag added, and clears the summary if it's still the one this tag switched to (anything else you've included separately is left alone). Cancel just clears this picker, keeping the content.`) : false;
    noteVersionHistoryImmediate();
    if(alsoRemove) CURRENT_VERSION = versionRemoveByTag(CURRENT_VERSION, currentLibrary(), tagId);
    CURRENT_VERSION.selection.lastFillTagId = '';
    scheduleVersionSave();
    renderEditor();
    return;
  }
  const addBtn = ev.target.closest('button[data-action="ed-add-entry"]');
  if(addBtn){ edAddEntry(addBtn.dataset.kind); return; }
  const libPickBtn = ev.target.closest('button[data-action="open-library-picker"]');
  if(libPickBtn){ openLibraryPicker(libPickBtn.dataset.kind); return; }
  const editBtn = ev.target.closest('button[data-action="open-edit-modal"]');
  if(editBtn){ openEntryEditModal(editBtn.dataset.kind, editBtn.dataset.entryId); return; }
  const moveBtn = ev.target.closest('button[data-move]');
  if(moveBtn){ noteVersionHistoryImmediate(); CURRENT_VERSION = moveSelection(CURRENT_VERSION, moveBtn.dataset.kind, moveBtn.dataset.ref, moveBtn.dataset.move); scheduleVersionSave(); renderEditor(); return; }
  const secBtn = ev.target.closest('button[data-action="move-section"]');
  if(secBtn){
    // These buttons live inside a <summary> (for the 5 built-in sections) -- an unprevented
    // click there also triggers the browser's native "toggle the parent <details>" default
    // action, which would both reorder the section AND randomly collapse/expand it.
    ev.preventDefault();
    noteVersionHistoryImmediate(); CURRENT_VERSION = moveSectionOrder(CURRENT_VERSION, secBtn.dataset.token, secBtn.dataset.dir); scheduleVersionSave(); renderEditor(); return;
  }
}

/* ===== pagination-driven preview ===== */
function pt(n){ return n+'pt'; }
function spacerEl(pts){ const d=document.createElement('div'); d.style.height=pt(pts); return d; }
function bd(text, flagKey){ return CURRENT_VERSION.style.bold[flagKey] ? '<b>'+esc(text)+'</b>' : esc(text); }
function renderInlineMarkup(text){
  return parseInlineBold(text).map(seg=> seg.bold ? '<b>'+esc(seg.text)+'</b>' : esc(seg.text)).join('');
}
function buildHeaderNode(){
  const st=CURRENT_VERSION.style;
  // currentLibrary().meta -- a standalone version prints its own embedded header/contact info
  // (whatever the imported file's own meta said), not the account's. This is deliberate: a
  // standalone import is meant to be a genuinely separate resume, which can reasonably have come
  // from someone else's file or an old version of your own with different contact details.
  const meta = currentLibrary().meta;
  const wrap=document.createElement('div');
  const name=document.createElement('div');
  name.textContent=meta.name||'Your Name';
  name.style.cssText=`font-family:${normalizeFontFamily(st.fontFamily)};font-size:${pt(st.fsName)};font-weight:bold;text-align:center;margin:0;`;
  const contact=document.createElement('div');
  contact.style.cssText=`font-family:${normalizeFontFamily(st.fontFamily)};font-size:${pt(st.fsContact)};text-align:center;margin:2pt 0 0;`;
  const sep=()=>document.createTextNode('   |   ');
  let any=false;
  if(meta.phone){ contact.appendChild(document.createTextNode(meta.phone)); any=true; }
  if(meta.email){
    if(any) contact.appendChild(sep());
    const a=document.createElement('a');
    a.href='mailto:'+meta.email;
    a.textContent=meta.email;
    a.className='contact-email';
    a.style.cssText='color:#0563C1;text-decoration:underline;';
    contact.appendChild(a);
    any=true;
  }
  if(meta.location){
    if(any) contact.appendChild(sep());
    contact.appendChild(document.createTextNode(meta.location));
    any=true;
  }
  [['LinkedIn',meta.linkedin],['GitHub',meta.github],['Portfolio',meta.portfolio]].forEach(([label,val])=>{
    if(!val) return;
    if(any) contact.appendChild(sep());
    const a=document.createElement('a');
    a.href=normalizeUrl(val);
    a.textContent=label;
    a.target='_blank';
    a.rel='noopener';
    a.style.cssText='color:#0563C1;text-decoration:underline;';
    contact.appendChild(a);
    any=true;
  });
  wrap.appendChild(name); wrap.appendChild(contact);
  return wrap;
}
function buildParagraphNode(text){
  const st=CURRENT_VERSION.style;
  const d=document.createElement('div'); d.innerHTML=renderInlineMarkup(text);
  d.style.cssText=`font-family:${normalizeFontFamily(st.fontFamily)};font-size:${pt(st.fsBody)};line-height:${st.lineHeight};text-align:${st.bodyAlign};margin:0;`;
  return d;
}
function buildHeadingNode(text){
  const st=CURRENT_VERSION.style;
  const el=document.createElement('div');
  el.textContent = st.headingUppercase ? text.toUpperCase() : text;
  el.style.cssText=`font-family:${normalizeFontFamily(st.fontFamily)};font-size:${pt(st.fsHeading)};font-weight:bold;text-align:${st.headingAlign};margin:0;`;
  if(st.headingUnderline){ el.style.borderBottom=st.headingUnderlineThickness+'pt solid #000000'; el.style.paddingBottom='2pt'; }
  return el;
}
function buildRowFlex(leftHtml, rightText){
  const st=CURRENT_VERSION.style;
  const row=document.createElement('div');
  row.style.cssText=`display:flex;justify-content:space-between;gap:10px;font-family:${normalizeFontFamily(st.fontFamily)};font-size:${pt(st.fsBody)};line-height:${st.lineHeight};`;
  const l=document.createElement('span'); l.innerHTML=leftHtml; l.style.minWidth='0';
  // Location/dates stay on one line and never shrink -- only the left side (company/
  // project/degree name, which is what actually gets arbitrarily long) should absorb
  // wrapping; letting both sides shrink evenly was squeezing short text like "Remote"
  // into an awkward multi-line mid-word break whenever the left side was very long.
  const r=document.createElement('span'); r.textContent=rightText||''; r.style.cssText='white-space:nowrap;flex-shrink:0;';
  row.appendChild(l); row.appendChild(r);
  return row;
}
function buildBulletList(bullets){
  const st=CURRENT_VERSION.style;
  const ul=document.createElement('ul');
  ul.style.cssText=`margin:${pt(st.gapBullet)} 0 0;padding-left:15px;list-style:none;`;
  bullets.forEach((b,i)=>{
    const li=document.createElement('li');
    li.style.cssText=`margin-bottom:${i<bullets.length-1?pt(st.gapBullet):'0'};font-family:${normalizeFontFamily(st.fontFamily)};font-size:${pt(st.fsBody)};line-height:${st.lineHeight};text-align:${st.bodyAlign};position:relative;`;
    if(st.bulletMarker && st.bulletMarker!=='none'){
      li.style.paddingLeft='14px';
      const marker=document.createElement('span'); marker.textContent=st.bulletMarker; marker.style.cssText='position:absolute;left:0;';
      li.appendChild(marker);
      const txt=document.createElement('span'); txt.innerHTML=renderInlineMarkup(b.text); li.appendChild(txt);
    } else { li.innerHTML=renderInlineMarkup(b.text); }
    ul.appendChild(li);
  });
  return ul;
}
function buildExperienceEntryNode(e){
  const wrap=document.createElement('div');
  wrap.appendChild(buildRowFlex(bd(e.company,'company')+(e.tag?` <span style="font-weight:400;">(${esc(e.tag)})</span>`:''), e.location));
  wrap.appendChild(buildRowFlex(bd(e.role,'role'), e.dates));
  if(e.bullets.length) wrap.appendChild(buildBulletList(e.bullets));
  return wrap;
}
function buildProjectEntryNode(p){
  const wrap=document.createElement('div');
  wrap.appendChild(buildRowFlex(bd(p.title,'project'), p.dates));
  if(p.bullets.length) wrap.appendChild(buildBulletList(p.bullets));
  return wrap;
}
function buildEducationEntryNode(ed){
  const st=CURRENT_VERSION.style;
  const wrap=document.createElement('div');
  wrap.appendChild(buildRowFlex(bd(ed.school,'university'), ed.location));
  const d=document.createElement('div');
  d.style.cssText=`display:flex;justify-content:space-between;font-family:${normalizeFontFamily(st.fontFamily)};font-size:${pt(st.fsBody)};line-height:${st.lineHeight};`;
  const l=document.createElement('span'); l.textContent=ed.degree;
  const r=document.createElement('span'); r.textContent=ed.dates;
  d.appendChild(l); d.appendChild(r);
  wrap.appendChild(d);
  return wrap;
}
// Custom sections' subheading/dates/location mirror experience's tag/dates/location -- same
// buildRowFlex() rows, just optional (a plain "Certifications" section with no organization/
// dates shouldn't render two empty rows above its bullets).
function buildCustomSectionBodyNode(cs){
  const wrap=document.createElement('div');
  if(cs.subheading || cs.location) wrap.appendChild(buildRowFlex(cs.subheading?bd(cs.subheading,'company'):'', cs.location||''));
  if(cs.dates) wrap.appendChild(buildRowFlex('', cs.dates));
  wrap.appendChild(cs.contentType==='paragraph' ? buildParagraphNode(cs.text) : buildBulletList(cs.bullets));
  return wrap;
}
function buildSkillRowNode(s){
  const st=CURRENT_VERSION.style;
  const d=document.createElement('div');
  d.style.cssText=`font-family:${normalizeFontFamily(st.fontFamily)};font-size:${pt(st.fsBody)};line-height:${st.lineHeight};margin-bottom:${pt(st.gapBullet)};`;
  d.innerHTML = bd(s.label+': ','skillsLabel')+esc(s.text);
  return d;
}
function buildReferenceNode(r){
  const st=CURRENT_VERSION.style;
  const wrap=document.createElement('div');
  const n=document.createElement('div');
  n.style.cssText=`font-family:${normalizeFontFamily(st.fontFamily)};font-size:${pt(st.fsBody)};line-height:${st.lineHeight};`;
  n.innerHTML = bd(r.name,'referenceName')+(r.title?'  -  '+esc(r.title):'');
  const c=document.createElement('div');
  c.style.cssText=`font-family:${normalizeFontFamily(st.fontFamily)};font-size:${pt(st.fsBody)};line-height:${st.lineHeight};`;
  c.textContent=r.contact||'';
  wrap.appendChild(n); wrap.appendChild(c);
  return wrap;
}
function buildSectionUnits(headingText, items, buildItemFn, glueAllTogether){
  if(!items.length) return [];
  const st=CURRENT_VERSION.style;
  const units=[];
  if(glueAllTogether){
    const wrap=document.createElement('div');
    wrap.appendChild(buildHeadingNode(headingText));
    wrap.appendChild(spacerEl(st.headingGapBelow));
    items.forEach((it,i)=>{ wrap.appendChild(buildItemFn(it)); if(i<items.length-1) wrap.appendChild(spacerEl(st.gapBullet)); });
    units.push({node:wrap, gapBefore:st.gapSection});
  } else {
    const firstWrap=document.createElement('div');
    firstWrap.appendChild(buildHeadingNode(headingText));
    firstWrap.appendChild(spacerEl(st.headingGapBelow));
    firstWrap.appendChild(buildItemFn(items[0]));
    units.push({node:firstWrap, gapBefore:st.gapSection});
    for(let i=1;i<items.length;i++) units.push({node:buildItemFn(items[i]), gapBefore:st.gapEntry});
  }
  return units;
}
function describeSection(token, resolved){
  // sectionHeadings may be absent on versions saved before this field existed --
  // fall back to the exact same default strings blankVersion() ships, same pattern
  // selection.summaryHeading already uses (sel.summaryHeading||'Summary').
  const sh = CURRENT_VERSION.sectionHeadings || {};
  if(token==='experience') return resolved.experience.length ? {headingText:sh.experience||'Work Experience', items:resolved.experience, buildItemFn:buildExperienceEntryNode, glueAllTogether:false} : null;
  if(token==='projects') return resolved.projects.length ? {headingText:sh.projects||'Projects', items:resolved.projects, buildItemFn:buildProjectEntryNode, glueAllTogether:false} : null;
  if(token==='education') return resolved.education.length ? {headingText:sh.education||'Education', items:resolved.education, buildItemFn:buildEducationEntryNode, glueAllTogether:false} : null;
  if(token==='skills') return resolved.skills.length ? {headingText:sh.skills||'Skills', items:resolved.skills, buildItemFn:buildSkillRowNode, glueAllTogether:true} : null;
  if(token==='references'){
    if(CURRENT_VERSION.referencesMode==='none') return null;
    if(CURRENT_VERSION.referencesMode==='onrequest') return {headingText:sh.references||'References', items:['Available upon request'], buildItemFn:buildParagraphNode, glueAllTogether:true};
    if(CURRENT_VERSION.referencesMode==='full' && resolved.references.length) return {headingText:sh.references||'References', items:resolved.references, buildItemFn:buildReferenceNode, glueAllTogether:false};
    return null;
  }
  if(token.indexOf('custom:')===0){
    const refId = token.slice(7);
    const cs = resolved.customSections.find(c=>c.id===refId);
    if(!cs) return null;
    if(cs.contentType==='paragraph'){ if(!cs.text || !cs.text.trim()) return null; }
    else if(!cs.bullets.length) return null;
    return {headingText: cs.heading||'Untitled', items:[cs], buildItemFn:buildCustomSectionBodyNode, glueAllTogether:true};
  }
  return null;
}
function paginate(){
  const st = CURRENT_VERSION.style;
  const resolved = resolveVersion(currentLibrary(), CURRENT_VERSION);
  const pageInches = CURRENT_VERSION.pageSize==='Letter' ? {w:8.5,h:11} : {w:8.27,h:11.69};
  const marginTop=clamp(st.marginTop,0.5,3), marginBottom=clamp(st.marginBottom,0.5,3);
  const marginLeft=clamp(st.marginLeft,0.5,3), marginRight=clamp(st.marginRight,0.5,3);
  const usableWidthPx = (pageInches.w - marginLeft - marginRight) * 96;
  const usableHeightPx = (pageInches.h - marginTop - marginBottom) * 96;

  let units = [];
  units.push({node: buildHeaderNode(), gapBefore:0});
  if(resolved.summary && resolved.summary.trim()){
    units = units.concat(buildSectionUnits(resolved.summaryHeading||'Summary', [resolved.summary], buildParagraphNode, true));
  }
  resolveSectionOrder(CURRENT_VERSION).forEach(token=>{
    const d = describeSection(token, resolved);
    if(d) units = units.concat(buildSectionUnits(d.headingText, d.items, d.buildItemFn, d.glueAllTogether));
  });

  const host = document.getElementById('measureHost');
  host.innerHTML='';
  host.style.width = usableWidthPx+'px';
  units.forEach(u=> host.appendChild(u.node));
  const heights = units.map(u=> u.node.getBoundingClientRect().height);

  const packed = packUnits(units.map((u,i)=>({height:heights[i], gapBefore:u.gapBefore*PT2PX})), applyPrintSafety(usableHeightPx));

  const pagesWrap = document.getElementById('pagesWrap');
  pagesWrap.innerHTML='';
  packed.forEach(indices=>{
    const paper=document.createElement('div');
    paper.className='paper'+(CURRENT_VERSION.pageSize==='Letter'?' letter':'');
    const inner=document.createElement('div');
    inner.className='paper-inner';
    inner.style.padding=`${marginTop}in ${marginRight}in ${marginBottom}in ${marginLeft}in`;
    indices.forEach((idx,j)=>{
      if(j>0) inner.appendChild(spacerEl(units[idx].gapBefore));
      inner.appendChild(units[idx].node);
    });
    paper.appendChild(inner);
    pagesWrap.appendChild(paper);
  });

  CURRENT_VERSION.pageCount = packed.length || 1;
  const badge = document.getElementById('pageBadge');
  if(badge) badge.textContent = CURRENT_VERSION.pageCount+(CURRENT_VERSION.pageCount>1?' pages':' page');
  return resolved;
}
function renderPreview(){
  paginate();
  wrapPagesForZoom('pagesWrap');
  applyPreviewZoom('pagesWrap', 'editor');
}

/* ===== exports ===== */
// Builds a small, fully self-contained HTML document from the *already-paginated* live
// preview -- reusing paginate()'s real page breaks as the single source of truth (Chromium
// never re-paginates on its own) -- for the pdf-service (see CLAUDE.md's "PDF export"
// section) to print with real headless Chromium into a genuine vector-text PDF. Every
// resume node-builder (buildHeaderNode/buildParagraphNode/buildRowFlex/etc.) already sets
// only inline styles, so each .paper's outerHTML is nearly self-contained already; the only
// external CSS this needs to carry along is the .paper/.paper-inner box model itself.
function buildPrintHtml(){
  const papers = document.querySelectorAll('#pagesWrap .paper');
  const pagesHtml = Array.from(papers).map(p=>{
    // Clone so the zoom feature's `transform:scale()` (live on-screen state) never leaks
    // into the printed page -- printing must always be the true, natural size.
    const clone = p.cloneNode(true);
    clone.style.transform = 'none';
    return clone.outerHTML;
  }).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{background:#fff;}
    .paper{width:210mm;background:#fff;color:#000000;position:relative;overflow:hidden;break-after:page;}
    .paper:last-child{break-after:auto;}
    .paper.letter{width:8.5in;}
    .paper-inner{width:100%;}
    .paper, .paper *{overflow-wrap:break-word;min-width:0;}
    @page{margin:0;}
  </style></head><body>${pagesHtml}</body></html>`;
}
/* ===== PDF export fallback-wake dialog =====
   Render (PDF_SERVICE_URL_FALLBACK) is deliberately left to sleep between uses -- unlike the
   primary, nothing pings its /health to keep it warm (see pdf-service/README.md's "Keeping
   it awake"). If the primary fails, silently retrying against a cold Render instance would
   just time out too (cold start ~20-30s) with no explanation. Instead this shows a dialog,
   polls the fallback's /health (any request wakes a sleeping free-tier instance) until it
   responds, then retries the actual render -- so the user sees what's happening instead of
   a frozen "Rendering…" button. */
var PDF_FALLBACK_ABORTED = false;

function showPdfFallbackDialog(){
  hidePdfFallbackDialog();
  const wrap=document.createElement('div');
  wrap.id='pdfFallbackDialog';
  wrap.className='pdf-fallback-overlay';
  wrap.innerHTML=`
    <div class="pdf-fallback-box">
      <h3>Primary PDF server unavailable</h3>
      <p>Waking up the backup server - this can take up to 30 seconds on a cold start.</p>
      <div class="pdf-fallback-status">
        <span class="pdf-fallback-spinner" id="pdfFallbackSpinner"></span>
        <span id="pdfFallbackStatusText">Checking backup server…</span>
      </div>
      <button class="btn btn-ghost btn-sm" id="btnCancelPdfFallback">Cancel</button>
    </div>`;
  document.body.appendChild(wrap);
  document.getElementById('btnCancelPdfFallback').addEventListener('click', ()=>{
    PDF_FALLBACK_ABORTED=true;
    hidePdfFallbackDialog();
  });
  // Unlike renderGhPanel()/renderEntryEditModal(), this function is only ever called for a
  // genuine open -- content updates while it's showing go through updatePdfFallbackDialog()
  // instead, which mutates the existing text/spinner elements directly rather than recreating
  // this DOM -- so no isFreshOpen guard is needed here.
  animateModalIn(wrap);
}
function updatePdfFallbackDialog(text, state){
  const textEl=document.getElementById('pdfFallbackStatusText');
  if(textEl) textEl.textContent=text;
  const spinner=document.getElementById('pdfFallbackSpinner');
  if(spinner){
    spinner.classList.remove('ok','fail');
    if(state) spinner.classList.add(state);
  }
  if(state==='fail'){
    const btn=document.getElementById('btnCancelPdfFallback');
    if(btn) btn.textContent='Close';
  }
}
function hidePdfFallbackDialog(){
  const el=document.getElementById('pdfFallbackDialog');
  if(el) el.remove();
}
// Fire-and-forget /health pings for *both* PDF render hosts, called once from
// loadAuthedAppState() right after a successful sign-in. Previously the fallback (Render)
// was only ever woken reactively, inside downloadPdf(), after the primary had already been
// tried and failed -- meaning the user always ate a full ~20-30s cold-start wait in the
// moment they actually wanted their PDF, even for the primary (whose own UptimeRobot ping
// runs on its own schedule and can't be assumed to always land before a given export click).
// Pinging both here instead means whichever host actually ends up serving the export has a
// head start absorbed during the time the user is doing something else (filling in resume
// data) after signing in, not at the moment Download is clicked. Deliberately not awaited
// and errors are silently swallowed -- this is a best-effort warm-up only; downloadPdf()'s
// own primary-then-fallback-with-wake-dialog flow is what actually guarantees correctness,
// this just makes the common case faster.
function warmPdfServices(){
  [window.PDF_SERVICE_URL, window.PDF_SERVICE_URL_FALLBACK].forEach(url=>{
    if(!url) return;
    const healthUrl = url.replace(/\/render$/, '/health');
    window.fetch(healthUrl, { method:'GET' }).catch(()=>{});
  });
}
async function waitForFallbackHealth(healthUrl, {intervalMs=3000, timeoutMs=90000}={}){
  const start=Date.now();
  let attempt=0;
  while(Date.now()-start < timeoutMs){
    if(PDF_FALLBACK_ABORTED) return false;
    attempt++;
    updatePdfFallbackDialog(`Checking backup server… (attempt ${attempt})`);
    try{
      const res=await window.fetch(healthUrl, { method:'GET' });
      if(res.ok){ updatePdfFallbackDialog('Backup server is awake - rendering…', 'ok'); return true; }
    }catch(e){ /* still asleep/unreachable -- keep polling */ }
    await new Promise(r=>setTimeout(r, intervalMs));
  }
  return false;
}

async function downloadPdf(){
  const btn=document.getElementById('btnDownloadPdf'); const old=btn.textContent;
  btn.disabled=true; btn.textContent='Rendering…';
  PDF_FALLBACK_ABORTED=false;
  try{
    const { data: { session } } = await window.supabase.auth.getSession();
    if(!session) throw new Error('not signed in');
    const pageInches = CURRENT_VERSION.pageSize==='Letter' ? {w:8.5,h:11} : {w:8.27,h:11.69};
    const payload = JSON.stringify({ html: buildPrintHtml(), pageInches });
    const headers = { 'Content-Type':'application/json', Authorization:'Bearer '+session.access_token };

    let res=null;
    try{
      const r=await window.fetch(window.PDF_SERVICE_URL, { method:'POST', headers, body: payload });
      if(r.ok) res=r;
    }catch(e){ /* primary unreachable -- fall through to the wake-fallback path below */ }

    if(!res){
      showPdfFallbackDialog();
      const healthUrl=window.PDF_SERVICE_URL_FALLBACK.replace(/\/render$/, '/health');
      const awake=await waitForFallbackHealth(healthUrl);
      if(PDF_FALLBACK_ABORTED) return;
      if(!awake){
        updatePdfFallbackDialog('Backup server did not respond in time. Please try again shortly.', 'fail');
        return;
      }
      res=await window.fetch(window.PDF_SERVICE_URL_FALLBACK, { method:'POST', headers, body: payload });
      hidePdfFallbackDialog();
      if(!res.ok) throw new Error('PDF service returned '+res.status);
    }

    const blob = await res.blob();
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
    a.download=(currentLibrary().meta.name||'resume').replace(/\s+/g,'-')+'-'+(CURRENT_VERSION.name||'version').replace(/\s+/g,'-')+'.pdf';
    a.click();
  }catch(e){ console.error(e); hidePdfFallbackDialog(); toast('PDF export failed: '+e.message); }
  finally{ btn.disabled=false; btn.textContent=old; }
}
async function downloadDocx(){
  try{
    const resolved = resolveVersion(currentLibrary(), CURRENT_VERSION);
    const doc = buildDocxDocument(window.docx, resolved, CURRENT_VERSION.style, CURRENT_VERSION.pageSize, currentLibrary().meta, CURRENT_VERSION.referencesMode, resolveSectionOrder(CURRENT_VERSION));
    const blob = await window.docx.Packer.toBlob(doc);
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
    a.download=(currentLibrary().meta.name||'resume').replace(/\s+/g,'-')+'-'+(CURRENT_VERSION.name||'version').replace(/\s+/g,'-')+'.docx';
    a.click();
  }catch(e){ console.error(e); toast('DOCX export failed: '+e.message); }
}

/* ===== boot ===== */
// Loads everything for a signed-in user and shows the dashboard. Accounts always start
// empty -- no auto-import of pre-existing local data (see the migration plan); DB.getLibrary()
// itself creates an empty row on a brand-new account's first call.
async function loadAuthedAppState(){
  AUTH_MESSAGE = null;
  warmPdfServices(); // fire-and-forget -- see its own comment
  // These five reads are all independent of each other -- firing them together instead of one
  // at a time is what actually shortens the visible "signed in, but the app still looks
  // signed-out/blank" gap on a fresh page load or reload, on top of index.html's own fix (see
  // #topbarSignedOut's comment) for not showing the *wrong* thing during that gap. A real,
  // reported bug: this used to be four/five sequential awaits, each a full network round trip.
  const [libResult, versionsResult, githubConfigResult, preferencesResult, sessionResult, trashResult] = await Promise.all([
    DB.getLibrary(), DB.listVersions(), DB.getGithubConfig(), DB.getPreferences(), window.supabase.auth.getSession(), DB.listTrashedVersions()
  ]);
  LIBRARY = libResult ? libResult.data : emptyLibrary();
  LIBRARY_REVISION = libResult ? libResult.revision : null;
  // One-time, silent migration to the tag-dropdown pool -- see migrateTagOptions() in
  // js/03_model.js. A brand-new account's emptyLibrary() already seeds tagOptions:[], so this
  // only actually does anything for an account that predates this feature. Has to run after
  // the parallel reads above (it needs LIBRARY resolved first), not folded into them.
  if(!LIBRARY.tagOptions){
    LIBRARY = migrateTagOptions(LIBRARY);
    const migRes = await DB.saveLibrary(LIBRARY, LIBRARY_REVISION);
    if(migRes.ok) LIBRARY_REVISION = migRes.revision;
  }
  VERSIONS_INDEX = versionsResult;
  VERSION_REVISIONS = {};
  GITHUB_CONFIG = githubConfigResult;
  PREFERENCES = preferencesResult;
  TRASH_COUNT = trashResult.length;
  updateTrashButtonLabel();
  // "Change password" only makes sense for an account that actually has a password -- a real,
  // reported gap: signing in via Google/GitHub means Supabase Auth has no password credential
  // on the account at all, so submitChangePassword()'s own current-password check
  // (signInWithPassword()) always fails, surfacing as a misleading "Current password is
  // incorrect" no matter what's typed. Hidden outright for those accounts instead, on request,
  // rather than trying to explain the distinction inside the modal itself.
  {
    const { data:{ session } } = sessionResult;
    const provider = session && session.user && session.user.app_metadata && session.user.app_metadata.provider;
    const btnChangePassword = document.getElementById('btnChangePassword');
    if(btnChangePassword) btnChangePassword.style.display = (provider==='google'||provider==='github') ? 'none' : '';
  }
  CURRENT_VERSION = null;
  syncConflict = null; renderConflictBanner();
  renderTopbarStatus();
  SAVE_STATUS = { library:'saved', version:'saved' }; updateSaveStatusUI();
  document.getElementById('topbarAuthedControls').style.display = 'flex';
  document.getElementById('topbarSignedOut').style.display = 'none';
  document.querySelector('.topbar').classList.add('is-authed'); // gates the mobile hamburger's visibility (css/style.css) -- irrelevant while signed out

  // Device-local session restore (this browser only, never synced) -- see the
  // account-vs-device preference split. A fresh load always lands on Dashboard now, full
  // stop -- on request ("I close the tab with the editor open... this is not good UX right??
  // ... Yes, always Dashboard"). This used to carve out one exception (silently reopening
  // straight into the editor if that's what was last open) on the reasoning that continuing
  // a document was worth the inconsistency; asked directly, the account owner preferred a
  // single predictable landing page over that convenience, matching how every other view
  // (Library, Cover Letter, Preferences) already behaved. Nothing is lost by this: the version
  // itself autosaves regardless, and it's one click away from its own Dashboard card. A real
  // deep link (someone bookmarked/shared /draftshelf/editor/:id) is a separate, explicit
  // statement of intent and still opens straight into that version -- see the `route` handling
  // just below, unaffected by this change. The only case this function needs to re-run outside
  // a genuine fresh sign-in is a real full page reload (e.g. Safari evicting a backgrounded tab
  // under memory pressure -- ordinary browser behavior no app-level JS can prevent);
  // onAuthStateChange() below no longer re-runs this on a tab-visibility-driven token refresh,
  // so that path doesn't land here anymore either.
  const savedLibTab = await KV.get('rf:ui:lastLibTab');
  if(savedLibTab) LIB_TAB = savedLibTab;
  // Deliberately NOT restored from KV -- every editor/library panel starts collapsed on a
  // fresh load, on request (see PANEL_OPEN_STATE's own comment). loadAuthedAppState() itself
  // only ever re-runs on a genuine fresh sign-in or a real full page reload (per this
  // function's own doc above), never on in-app navigation, so this reset only fires exactly
  // where it's meant to.
  PANEL_OPEN_STATE = {};
  // A real URL (e.g. someone bookmarked/shared /draftshelf/library, or reloaded mid-session)
  // takes priority over the KV-based restore below -- that's the actual point of deep linking:
  // the URL is a more specific, more recent statement of intent than whatever this device
  // happened to have open last. Falls through to the existing KV-based restore unchanged
  // whenever the URL doesn't encode a real route (the bare root -- by far the common case,
  // since most navigation within a session uses pushState and never touches the address bar).
  const route = parseAppRoute();
  if(route && route.view==='editor' && VERSIONS_INDEX.some(v=>v.id===route.versionId)){
    await openEditor(route.versionId, 'replace');
    return;
  }
  if(route && route.view!=='editor'){
    switchView(route.view, 'replace');
    return;
  }
  // 'replace' -- this is establishing the initial URL for a fresh page load, not a new
  // user-triggered navigation, so it must not add a spurious back-stack entry.
  switchView('dashboard', 'replace');

}
function showSignedOutState(){
  LIBRARY = null; CURRENT_VERSION = null; VERSIONS_INDEX = []; VERSION_REVISIONS = {}; GITHUB_CONFIG = null;
  PREFERENCES = null;
  TRASH_VERSIONS = []; TRASH_COUNT = 0; trashPanelOpen = false; renderTrashPanel();
  COVER_LETTER = null; // ephemeral, session-only -- never leaves it around for the next sign-in
  clearLibraryHistory(); clearVersionHistory();
  syncConflict = null;
  SAVE_STATUS = { library:'saved', version:'saved' };
  ENTRY_EDIT_MODAL = null; renderEntryEditModal();
  // 'landing', not 'signin' -- a real sign-out (or a fresh, never-signed-in visit) should land
  // on the actual homepage, not jump straight into a form. The one deliberate exception is the
  // recovery-link-failed path in init(), which calls this function too but forces AUTH_MODE
  // back to 'signin' right after, since showing the sign-in form with a clear error is the
  // right outcome there, not the marketing page -- see that call site's own comment.
  AUTH_MODE = 'landing'; AUTH_MESSAGE = null;
  document.getElementById('topbarAuthedControls').style.display = 'none';
  // topbarSignedOut is the inverse of topbarAuthedControls (see loadAuthedAppState()'s own
  // toggle) -- a real, reported gap: the topbar previously showed nothing at all here for a
  // signed-out visitor, not even the theme toggle. renderThemeToggle() also runs again here
  // (init() already called it once during boot, before either topbar group's real state was
  // known) so #btnThemeToggleOut reflects the current theme immediately, not just after the
  // next explicit toggle click.
  document.getElementById('topbarSignedOut').style.display = 'flex';
  document.querySelector('.topbar').classList.remove('is-authed');
  renderThemeToggle();
  renderAuthScreen();
  // Reset the URL back to the app root on sign-out -- whatever deep path was open before
  // (e.g. /draftshelf/editor/abc123) is meaningless once signed out, and leaving it in the
  // address bar would just make a reload (or a shared link) try to restore a version that
  // isn't even loaded. replaceState (not updateRoute(), which is scoped to real, routable
  // views and would refuse this exact case) since there's no view left to "navigate" from.
  if(window.location.pathname!==ROUTE_BASE) history.replaceState(null, '', ROUTE_BASE);
}
async function init(){
  await window.__sbReady;

  // Em dashes are never allowed to reach saved data -- typed or pasted, anywhere in the app.
  // Capture phase (the `true` third argument) so this runs before every view's own bubble-phase
  // 'input' listener (onLibraryInput, onEditorEvent, etc.) reads the field's value -- one choke
  // point for the whole app instead of patching each view individually. Only INPUT/TEXTAREA
  // elements are touched; selects/checkboxes never carry free text. Cursor position is
  // preserved deliberately: stripEmDash() is a strict 1-char-for-1-char replacement, so the
  // character offsets on either side of the cursor never shift.
  document.addEventListener('input', ev=>{
    const t = ev.target;
    if(!(t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement)) return;
    if(typeof t.value !== 'string' || t.value.indexOf('—')===-1) return;
    const start = t.selectionStart, end = t.selectionEnd;
    t.value = stripEmDash(t.value);
    if(start!=null && end!=null && typeof t.setSelectionRange==='function') t.setSelectionRange(start, end);
  }, true);

  document.getElementById('viewAuth').addEventListener('click', onAuthClick);
  document.getElementById('conflictBannerWrap').addEventListener('click', ev=>{
    const btn = ev.target.closest('button[data-action]'); if(!btn) return;
    // A real gap: resolving a sync conflict does a real DB round-trip (force-overwrite) or an
    // export (keep-local) with zero loading feedback on the button itself -- easy to miss on a
    // banner someone's likely already anxious about (their edits might be about to be
    // overwritten). withTextButtonLoading() here is harmless even on the reload-remote/force-
    // overwrite paths that clear the conflict and remove this banner entirely -- the .finally()
    // cleanup just becomes a no-op on an already-detached button.
    withTextButtonLoading(btn, 'Working…', resolveConflict(btn.dataset.action));
  });
  document.querySelectorAll('.nav button').forEach(b=> b.addEventListener('click', ()=> switchView(b.dataset.view)));
  document.getElementById('libTabs').addEventListener('click', ev=>{
    const b=ev.target.closest('button[data-kind]'); if(!b) return;
    LIB_TAB=b.dataset.kind; KV.set('rf:ui:lastLibTab', LIB_TAB); renderLibrary();
    // A real, reported bug: #viewLibrary is the scroll container the sticky tabs bar lives
    // in, and switching tabs only ever swapped #libPanels's content -- the scroll position
    // itself carried over from whatever section was open before, so a new section's own
    // top content could land already scrolled a good way down, hidden under the sticky bar
    // ("the fixed bar covers a little top part of the contents in every section"). Only
    // reset here, not inside renderLibrary() itself -- that function also re-renders for
    // in-tab edits (a checkbox toggle, impact-dialog fallout), where jumping someone's
    // scroll position while they're mid-edit further down the page would be a new bug.
    document.getElementById('viewLibrary').scrollTop = 0;
  });
  document.getElementById('viewPreferences').addEventListener('input', onPreferencesEvent);
  document.getElementById('viewPreferences').addEventListener('change', onPreferencesEvent);
  document.getElementById('viewPreferences').addEventListener('click', onPreferencesClick);
  document.getElementById('viewCoverLetter').addEventListener('input', onCoverLetterEvent);
  document.getElementById('viewCoverLetter').addEventListener('click', onCoverLetterClick);
  document.getElementById('searchInput').addEventListener('input', renderDashboard);
  document.getElementById('sortSelect').addEventListener('change', renderDashboard);
  // closeMobileMenu() alongside closeSettingsMenu() here -- a real, found-in-testing mobile bug:
  // opening this modal via the settings dropdown never routed through switchView() (the only
  // other place that already called closeMobileMenu()), so on a narrow screen the hamburger
  // panel (#topbarAuthedControls.mobile-open, z-index:9999) stayed open behind/in front of the
  // modal (.gh-modal-overlay, z-index:9998) -- undimmed nav visible on top of a modal that
  // should have been the only thing on screen. closeMobileMenu() is a no-op above the mobile
  // breakpoint, so this changes nothing on desktop.
  document.getElementById('btnGhOpen').addEventListener('click', ()=>{ closeSettingsMenu(); closeMobileMenu(); ghPanelOpen=!ghPanelOpen; renderGhPanel(); });
  // Same closeMobileMenu()/closeSettingsMenu() pairing as btnGhOpen just above, same reason.
  document.getElementById('btnApiKeysOpen').addEventListener('click', ()=>{ closeSettingsMenu(); closeMobileMenu(); apiKeysPanelOpen=!apiKeysPanelOpen; renderApiKeysPanel(); });
  // Export Shelf -- moved into the settings dropdown (was a standalone topbar button,
  // "Export JSON"); same closeSettingsMenu()/closeMobileMenu() pair every other dropdown
  // action already calls (see btnGhOpen/btnChangePassword above) before doing its own thing.
  document.getElementById('btnExportJson').addEventListener('click', ()=>{ closeSettingsMenu(); closeMobileMenu(); exportAllJson(); });
  // Import Resume -- stays in the topbar (unlike Export, not moved into Settings). No longer
  // opens the file picker directly; shows the AI-conversion instructions dialog first (most
  // people importing a resume that isn't already a ResumIT/DraftShelf export need the prompt
  // to get there) -- showImportResumeDialog()'s own "Choose file" button is what actually
  // triggers #importFileInput, same file input reused as before.
  document.getElementById('btnImportResume').addEventListener('click', showImportResumeDialog);
  document.getElementById('importFileInput').addEventListener('change', onImportFile);
  document.getElementById('btnSignOut').addEventListener('click', signOut);
  // Settings menu -- consolidates Preferences + GitHub status/Connect out of the always-visible
  // topbar row (a real, reported bug: with everything visible at once the topbar wrapped onto
  // a second line on anything but a wide window). Static HTML in index.html, just a plain
  // show/hide toggle rather than a rebuilt-every-render panel like the GH/entry-edit modals --
  // its contents (#ghDot/#ghStatusText/#btnGhOpen) are the exact same elements
  // renderTopbarStatus()/setGhStatus() already target, just relocated in the DOM, so neither
  // needed any changes to keep working.
  document.getElementById('btnSettingsMenu').innerHTML = ICONS.settings;
  document.getElementById('btnSettingsMenu').addEventListener('click', (ev)=>{
    ev.stopPropagation();
    const dd = document.getElementById('settingsDropdown');
    if(dd.style.display==='block'){ dd.style.display='none'; return; }
    positionSettingsDropdown();
    dd.style.display = 'block';
  });
  window.addEventListener('resize', ()=>{ if(document.getElementById('settingsDropdown').style.display==='block') positionSettingsDropdown(); });
  document.getElementById('settingsDropdown').querySelector('button[data-view="preferences"]').addEventListener('click', ()=>{
    closeSettingsMenu(); switchView('preferences');
  });
  document.getElementById('btnChangePassword').addEventListener('click', ()=>{
    // Same closeMobileMenu() fix as btnGhOpen above -- same root cause, same effect (modal
    // rendered behind/under the still-open hamburger panel on a narrow screen).
    closeSettingsMenu(); closeMobileMenu(); openChangePasswordModal();
  });
  document.addEventListener('click', (ev)=>{
    const wrap = document.querySelector('.settings-menu-wrap');
    if(wrap && !wrap.contains(ev.target)) closeSettingsMenu();
  });
  document.getElementById('btnMobileMenu').innerHTML = ICONS.menu;
  document.getElementById('btnMobileMenu').addEventListener('click', (ev)=>{
    ev.stopPropagation();
    const authedControls = document.getElementById('topbarAuthedControls');
    // Guard against a real latent bug this surfaced: below the ~900px breakpoint this button
    // is CSS-forced visible (!important, to defeat the auth-state inline style -- see that
    // rule's own comment) regardless of sign-in state, but it only ever toggled .mobile-open
    // unconditionally -- while signed out, that class's own !important rule would have opened
    // #topbarAuthedControls' full authed nav (Dashboard/Library/etc.) despite nobody being
    // signed in. Only toggle it while actually signed in.
    if(authedControls.style.display==='none') return;
    authedControls.classList.toggle('mobile-open');
  });
  document.addEventListener('click', (ev)=>{
    const panel = document.getElementById('topbarAuthedControls');
    if(panel.classList.contains('mobile-open') && !panel.contains(ev.target) && ev.target.id!=='btnMobileMenu') closeMobileMenu();
  });
  window.addEventListener('resize', ()=>{
    if(CHIP_INPUT_FOCUSED){
      const input = document.querySelector(`input.tag-chip-text[data-chip-id="${CHIP_INPUT_FOCUSED}"]`);
      const sugg = document.getElementById(CHIP_INPUT_FOCUSED+'_sugg');
      if(input && sugg && !sugg.hidden) positionFloatingPanel(sugg, input);
    }
  });
  window.addEventListener('beforeunload', onBeforeUnload);
  // The browser back/forward buttons -- see this file's own top-of-file comment on
  // ROUTE_BASE/updateRoute() for why this exists at all. Fires whenever the user navigates the
  // history stack (back/forward, or programmatically via history.back()/forward()); the browser
  // has already updated window.location by the time this runs, so this only ever needs to read
  // the new URL and reflect it in the app's own state -- never write to history itself (every
  // downstream switchView()/openEditor() call passes 'popstate' precisely to suppress that).
  window.addEventListener('popstate', ()=>{
    if(VIEW==='auth') return; // signed out -- nothing in this app's own routing applies yet
    const route = parseAppRoute();
    if(!route){ switchView('dashboard', 'popstate'); return; }
    if(route.view==='editor'){
      if(CURRENT_VERSION && CURRENT_VERSION.id===route.versionId){
        switchView('editor', 'popstate'); // already the open document, no need to refetch it
      } else if(VERSIONS_INDEX.some(v=>v.id===route.versionId)){
        openEditor(route.versionId, 'popstate');
      } else {
        switchView('dashboard', 'popstate'); // the version this URL pointed to no longer exists
      }
    } else {
      switchView(route.view, 'popstate');
    }
  });
  document.getElementById('versionCards').addEventListener('click', onDashboardCardClick);
  document.getElementById('btnTrashOpen').addEventListener('click', openTrashPanel);
  // UI/UX audit finding: .card had no :hover state at all -- the single most-clicked element
  // on the most-visited screen sat completely flat and static under the cursor. Delegated on
  // the container (not per-card, since renderDashboard() rebuilds every .card node on every
  // render -- direct per-element listeners would be silently lost each time) using mouseover/
  // mouseout rather than mouseenter/mouseleave specifically because the latter don't bubble at
  // all, so they can't be delegated this way; the ev.relatedTarget/contains() check below is
  // what makes mouseover/mouseout behave like true enter/leave instead of firing repeatedly as
  // the pointer moves between a card's own child elements. GSAP for the lift itself (a real
  // power2.out ease, not a linear CSS transition) -- box-shadow stays plain CSS (.card's own
  // :hover rule, css/style.css) since box-shadow doesn't meaningfully benefit from GSAP's
  // easing the way a transform does, no reason to hand that half to JS too. :not(.new) excludes
  // the dashed "+ New version" tile, which already has its own distinct hover treatment.
  document.getElementById('versionCards').addEventListener('mouseover', (ev)=>{
    if(typeof gsap==='undefined') return;
    const card = ev.target.closest('.card:not(.new)');
    if(!card || card.contains(ev.relatedTarget)) return;
    gsap.to(card, { y:-4, duration:0.25, ease:'power2.out' });
  });
  document.getElementById('versionCards').addEventListener('mouseout', (ev)=>{
    if(typeof gsap==='undefined') return;
    const card = ev.target.closest('.card:not(.new)');
    if(!card || card.contains(ev.relatedTarget)) return;
    gsap.to(card, { y:0, duration:0.25, ease:'power2.out' });
  });
  document.getElementById('libPanels').addEventListener('input', onLibraryInput);
  document.getElementById('libPanels').addEventListener('click', onLibraryClick);
  // Chip-input suggestions: opened on focus (shows every not-yet-selected pool tag, same
  // "click to browse the full list" convenience GitHub's own label picker has), closed on blur
  // -- focusin/focusout (not focus/blur, which don't bubble). Document-level (not scoped to
  // #libPanels) since chip inputs now render in both the Library tab and Import Review; each
  // handler reads root from the field's own dataset rather than hardcoding one, so this one
  // delegated set covers every chip input in the app, wherever it appears.
  document.addEventListener('focusin', ev=>{
    const t = ev.target;
    if(!t.dataset || t.dataset.action!=='tag-chip-filter') return;
    CHIP_INPUT_FOCUSED = t.dataset.chipId;
    const sugg = document.getElementById(t.dataset.chipId+'_sugg');
    if(sugg){
      sugg.innerHTML = chipSuggestionsHtml(t.dataset.tagRoot, t.dataset.tagPath, t.value);
      sugg.hidden = false;
      positionFloatingPanel(sugg, t);
    }
  });
  document.addEventListener('focusout', ev=>{
    const t = ev.target;
    if(!t.dataset || t.dataset.action!=='tag-chip-filter') return;
    const chipId = t.dataset.chipId;
    // Delayed so a click on a suggestion button or the remove ("x") button -- which blurs the
    // text input first -- still registers before the suggestion list disappears underneath it.
    setTimeout(()=>{
      const sugg = document.getElementById(chipId+'_sugg');
      if(sugg && document.activeElement!==document.querySelector(`input.tag-chip-text[data-chip-id="${chipId}"]`) && !(sugg.contains(document.activeElement))){
        sugg.hidden = true;
        if(CHIP_INPUT_FOCUSED===chipId) CHIP_INPUT_FOCUSED = null;
      }
    }, 150);
  });
  document.addEventListener('keydown', ev=>{
    const t = ev.target;
    if(!t.dataset || t.dataset.action!=='tag-chip-filter') return;
    if(ev.key==='Enter'){
      ev.preventDefault(); // a chip input lives inside no <form>, but suppress accidental submits/newlines regardless
      const sugg = document.getElementById(t.dataset.chipId+'_sugg');
      const first = sugg && sugg.querySelector('button.tag-chip-suggestion');
      if(first) first.click();
    } else if(ev.key==='Backspace' && t.value===''){
      // "fillTag" has nothing to pop here -- it's single-select, and its filter input isn't
      // even rendered once a tag is picked (only the chip + its own explicit "x" button are),
      // so this text field can only ever be focused while there's no chip to remove yet.
      if(t.dataset.tagRoot==='fillTag') return;
      // Empty-input Backspace removes the last chip -- the same convenience GitHub/Notion-style
      // chip inputs already have, so deleting a mis-added tag doesn't require reaching for the mouse.
      const target = t.dataset.tagRoot==='library' ? LIBRARY : IMPORT_REVIEW.reviewState;
      const ids = getPath(target, t.dataset.tagPath) || [];
      if(ids.length){
        noteTagRootHistory(t.dataset.tagRoot);
        applyTagToggle(t.dataset.tagRoot, t.dataset.tagPath, ids[ids.length-1], false);
        if(t.dataset.tagRoot==='library') scheduleLibrarySave();
        CHIP_INPUT_FOCUSED = t.dataset.chipId;
        rerenderTagRoot(t.dataset.tagRoot);
        refocusChipInput(t.dataset.chipId);
      }
    }
  });
  document.getElementById('viewImportReview').addEventListener('input', onImportReviewEvent);
  document.getElementById('viewImportReview').addEventListener('click', onImportReviewClick);
  document.getElementById('edPanel').addEventListener('input', onEditorEvent);
  document.getElementById('edPanel').addEventListener('change', onEditorEvent);
  document.getElementById('edPanel').addEventListener('click', onEditorClick);
  // Keeps PANEL_OPEN_STATE (in-memory only -- see its own comment) in sync with each
  // <details> panel's open/closed state, so it survives in-app navigation (Editor ->
  // Dashboard -> Editor, no reload) without surviving an actual reload. The native `toggle`
  // event does NOT bubble (fires only on the <details> element itself), so a capturing-phase
  // listener on an ancestor is the only way to catch it via delegation -- capture intercepts
  // the event on its way down to the target regardless of whether it would go on to bubble
  // back up.
  document.getElementById('edPanel').addEventListener('toggle', (ev)=>{
    const d = ev.target.closest && ev.target.closest('details.ed-block[data-block-key]');
    if(!d) return;
    PANEL_OPEN_STATE[d.dataset.blockKey] = d.open;
  }, true);
  document.getElementById('btnBackDash').addEventListener('click', ()=> switchView('dashboard'));
  document.getElementById('btnDownloadPdf').addEventListener('click', downloadPdf);
  document.getElementById('btnDownloadDocx').addEventListener('click', downloadDocx);
  document.getElementById('btnThemeToggle').addEventListener('click', (ev)=>{ flipThemeToggleIcon(ev.currentTarget); setTheme(THEME==='dark' ? 'light' : 'dark'); });
  document.getElementById('btnThemeToggleOut').addEventListener('click', (ev)=>{ flipThemeToggleIcon(ev.currentTarget); setTheme(THEME==='dark' ? 'light' : 'dark'); });
  document.getElementById('btnTopbarSignIn').addEventListener('click', ()=>{ AUTH_MODE='signin'; AUTH_MESSAGE=null; renderAuthScreen(); });
  document.getElementById('btnTopbarSignUp').addEventListener('click', ()=>{ AUTH_MODE='signup'; AUTH_MESSAGE=null; renderAuthScreen(); });
  document.getElementById('btnTopbarClose').addEventListener('click', ()=>{ AUTH_MODE='landing'; AUTH_MESSAGE=null; renderAuthScreen(); });
  document.getElementById('btnTopbarClose').innerHTML = ICONS.close;
  document.getElementById('btnHelpAuthed').innerHTML = ICONS.help;
  document.getElementById('btnHelpOut').innerHTML = ICONS.help;
  renderThemeToggle();
  document.getElementById('btnZoomOut').addEventListener('click', ()=> stepZoom('editor','pagesWrap',-0.1));
  document.getElementById('btnZoomIn').addEventListener('click', ()=> stepZoom('editor','pagesWrap',0.1));
  document.getElementById('btnZoomFit').addEventListener('click', ()=> setFitZoom('editor','pagesWrap'));
  wirePinchZoom(document.getElementById('viewEditor'), 'editor', 'pagesWrap');
  wirePinchZoom(document.getElementById('viewCoverLetter'), 'coverLetter', 'clPagesWrap');
  window.addEventListener('resize', debounce(()=>{
    if(VIEW==='editor' && CURRENT_VERSION) applyPreviewZoom('pagesWrap','editor');
    if(VIEW==='coverLetter') applyPreviewZoom('clPagesWrap','coverLetter');
  }, 150));
  document.addEventListener('keydown', ev=>{
    const key = ev.key.toLowerCase();
    if(!(ev.metaKey||ev.ctrlKey) || key!=='z') return;
    if(VIEW!=='editor' && VIEW!=='library' && VIEW!=='importReview') return;
    ev.preventDefault();
    if(VIEW==='library'){ if(ev.shiftKey) redoLibrary(); else undoLibrary(); }
    else if(VIEW==='importReview'){ if(ev.shiftKey) redoImportReview(); else undoImportReview(); }
    else { if(ev.shiftKey) redoVersion(); else undoVersion(); }
  });

  // A real, reported bug: supabase-js's autoRefreshToken ties its refresh check to tab
  // visibility -- switching away to a different browser tab and back (after long enough for
  // the token to need refreshing) fires a 'TOKEN_REFRESHED' event here, same as 'SIGNED_IN'/
  // 'SIGNED_OUT'/etc all coming through this one callback. The old code treated *any* event
  // with a session as "reload everything" (loadAuthedAppState(), which nulls CURRENT_VERSION
  // and always re-derives VIEW back to Dashboard) -- so simply switching tabs and back could
  // silently kick the editor (or Cover Letter, or Library) back to the dashboard mid-session.
  // DB.* (js/01b_data.js) always reads a fresh session via getSession() at call time -- this
  // app has no state that actually depends on reacting to a token refresh, so the fix is to
  // just not react to it: only 'SIGNED_IN' (a genuine new interactive sign-in) reloads state.
  // A real, reported bug: clicking a password-reset link would sometimes land on the plain
  // sign-in screen instead of "choose a new password". Root cause: supabase-js's own
  // URL/session detection (parsing the recovery link's token, establishing a session, and
  // firing the PASSWORD_RECOVERY event) starts running asynchronously the moment the client is
  // created (js/00_supabase.js's createClient() call) -- window.__sbReady resolves as soon as
  // that call returns, NOT once that background processing finishes, so there's a real race
  // between it and this function registering the onAuthStateChange listener below. If the
  // client's own processing wins the race, PASSWORD_RECOVERY fires to no listener at all and
  // is gone for good -- this function's own getSession() call then finds a perfectly valid
  // (recovery) session and treats it as an ordinary sign-in, landing on the Dashboard, or --
  // if the link had actually failed to establish a session at all (see below) -- getSession()
  // finds nothing and falls through to the plain, unhelpful sign-in screen, which is the
  // specific case reported. Fixed by checking the URL for the recovery link's own
  // `type=recovery` marker directly, up front -- not relying solely on catching the transient
  // event -- so intent survives regardless of which async task wins that race.
  // A second real, reported gap in the fix above: when Supabase itself already rejects the
  // link (expired, or -- what actually happened here -- already consumed before the human
  // even clicked it, e.g. a messaging app's own link-preview prefetcher silently fetching it
  // server-side to generate a preview card) it redirects with `#error=...&error_code=
  // otp_expired&error_description=...`, NOT `type=recovery` at all -- a completely different
  // URL shape this check didn't recognize, so it fell all the way through to a blank, silent
  // sign-in form with no explanation whatsoever. `error_code` presence is now treated as
  // recovery-related too, and Supabase's own `error_description` (already a safe, generic,
  // user-facing string -- never anything sensitive) is surfaced directly when present, more
  // specific than the generic fallback message below.
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const searchParams = new URLSearchParams(window.location.search.replace(/^\?/, ''));
  const urlErrorDescription = hashParams.get('error_description') || searchParams.get('error_description');
  const recoveryRequested = hashParams.get('type')==='recovery' || searchParams.get('type')==='recovery'
    || !!(hashParams.get('error_code') || searchParams.get('error_code'));
  if(recoveryRequested) AUTH_MODE = 'reset';

  // A redirect landed here from mcp-remote-auth's own /authorize -- see OAUTH_REQUEST's own
  // var declaration above for why this app renders the consent screen itself instead of that
  // Edge Function doing it directly.
  const oauthClientId = searchParams.get('oauth_client_id');
  if(oauthClientId){
    const consentToken = searchParams.get('oauth_consent_token') || '';
    // The consent token is `${expiryEpochMs}.${hmacSig}` (mcp-remote-auth's own
    // makeConsentToken()) - the expiry is already right there in plain text ahead of the
    // signature, so it can be read directly here instead of the app inventing its own
    // separate notion of how long this request is good for and risking it drifting out of
    // sync with what the server actually enforces (verifyConsentToken() there rejects past
    // this same timestamp).
    const consentExpiresAt = Number(consentToken.split('.')[0]) || null;
    OAUTH_REQUEST = {
      clientId: oauthClientId,
      clientName: searchParams.get('oauth_client_name') || 'A connector',
      redirectUri: searchParams.get('oauth_redirect_uri') || '',
      codeChallenge: searchParams.get('oauth_code_challenge') || '',
      state: searchParams.get('oauth_state') || '',
      consentToken,
      consentExpiresAt,
    };
  }

  window.supabase.auth.onAuthStateChange((event, session)=>{
    // Cheap, permanent diagnostic -- if "switching tabs resets the app" is ever reported
    // again, checking the console for which event actually fired (and whether this handler
    // even ran, vs. a full page reload bypassing it entirely -- see loadAuthedAppState()'s
    // own comment on that) answers it in seconds instead of re-deriving the auth-event
    // theory from scratch.
    console.debug('[auth]', event, session ? 'session present' : 'no session');
    if(event === 'PASSWORD_RECOVERY'){ clearLibraryHistory(); clearVersionHistory(); AUTH_MODE='reset'; AUTH_MESSAGE=null; renderAuthScreen(); return; }
    if(event === 'SIGNED_OUT'){ clearLibraryHistory(); clearVersionHistory(); showSignedOutState(); return; }
    if(event === 'SIGNED_IN' && session){
      // A recovery link's own session fires as plain SIGNED_IN too, on top of (or instead of,
      // if this listener registered too late to catch the transient event -- see above)
      // PASSWORD_RECOVERY -- recoveryRequested (captured from the URL, not the event) is what
      // keeps this landing on "choose a new password" instead of the Dashboard either way.
      if(recoveryRequested){ AUTH_MODE='reset'; AUTH_MESSAGE=null; renderAuthScreen(); return; }
      // A visitor with OAUTH_REQUEST pending was shown the sign-in form specifically to reach
      // this moment -- once signed in, the consent screen is the correct landing, not the
      // normal Dashboard loadAuthedAppState() would otherwise go to.
      if(OAUTH_REQUEST){ showOAuthConsent(session); return; }
      clearLibraryHistory(); clearVersionHistory(); loadAuthedAppState();
    }
  });

  const { data: { session } } = await window.supabase.auth.getSession();
  if(session && recoveryRequested){
    // Already handled above (AUTH_MODE set from the URL before the listener even ran) -- just
    // make sure the screen reflects it, in case no auth event fired at all before this point.
    AUTH_MESSAGE = null;
    renderAuthScreen();
  }
  else if(session && OAUTH_REQUEST){
    // Already signed in (a real, existing session on this browser) when the redirect landed --
    // straight to consent, no need to ask for credentials again.
    showOAuthConsent(session);
  }
  else if(session) await loadAuthedAppState();
  else if(OAUTH_REQUEST){
    // No session yet -- show the real sign-in form (not the marketing landing page) so the
    // visitor can actually reach the consent screen above. The SIGNED_IN handler's own
    // OAUTH_REQUEST branch picks up from here once they do.
    showSignedOutState();
    AUTH_MODE = 'signin';
    renderAuthScreen();
  }
  else if(recoveryRequested){
    // The link carried a recovery marker but no session ever materialized -- most commonly
    // because the link was opened in a different browser (or an email app's built-in preview
    // browser) than the one "Forgot password?" was originally submitted from, so the
    // one-time verifier Supabase needs to complete the exchange isn't there. Surfacing this
    // explicitly is much more useful than silently falling through to a plain, unexplained
    // sign-in form.
    // showSignedOutState() itself unconditionally resets AUTH_MODE/AUTH_MESSAGE (clearing any
    // stale state from a previous session) and re-renders -- call it first, then set the
    // message and render again, or it would wipe the very message being set here.
    // showSignedOutState() now defaults to AUTH_MODE='landing' (the real homepage), but this
    // case specifically needs the actual sign-in form with the error shown, not the marketing
    // page -- force it back to 'signin' explicitly.
    showSignedOutState();
    AUTH_MODE = 'signin';
    // error_code alone (no type=recovery) can't be attributed to a specific flow from the URL
    // itself -- both "Forgot password?" and "Sign in with a link" hit the exact same rejection
    // shape (see the comment above). rf:ui:lastAuthLinkType is set right before either request
    // goes out (onAuthClick()'s submit-forgot/submit-magic) specifically to make this message
    // accurate instead of always assuming password reset -- defaults to 'recovery' or an unset
    // value the same way for any account that used this flow before magic-link existed.
    const linkType = localStorage.getItem('rf:ui:lastAuthLinkType');
    const linkNoun = linkType==='magiclink' ? 'sign-in link' : 'password reset link';
    AUTH_MESSAGE = { kind:'error', text: urlErrorDescription
      ? `${urlErrorDescription}. Please request a new link - and if you're sharing it via a messaging app, note some apps auto-open links to generate a preview, which can use it up before it's actually clicked.`
      : `This ${linkNoun} didn't work - it may have expired, already been used, or been opened in a different browser than the one you requested it from. Please request a new link and open it in the same browser.` };
    renderAuthScreen();
  }
  else showSignedOutState();
}
// A real, reported bug: init() had no top-level error handling at all -- if anything in it
// threw (most realistically window.supabase still being undefined after a failed CDN import,
// see js/00_supabase.js's own comment on this), the page was left permanently stuck: the
// topbar's static HTML still shows (not gated on JS), but neither the sign-in buttons nor the
// dashboard ever appear, with no error and no way to recover short of knowing to hit reload.
function handleBootFailure(e){
  console.error('[boot] init() failed:', e);
  reportClientError(e, 'boot');
  document.querySelectorAll('.view').forEach(el=>el.classList.remove('active'));
  const wrap = document.getElementById('viewAuth');
  wrap.classList.add('active');
  wrap.innerHTML = `<div style="max-width:420px;margin:100px auto 0;text-align:center;">
    <h2 style="margin:0 0 10px;">Couldn't connect</h2>
    <p style="color:var(--text-muted);font-size:14px;margin:0 0 22px;">DraftShelf couldn't reach its servers just now -- this is usually temporary (e.g. right after your device reconnects to the internet or wakes from sleep).</p>
    <button class="btn btn-brass" onclick="window.location.reload()">Reload</button>
  </div>`;
}
// Client-side error monitoring, added on request -- until now, an uncaught runtime error
// anywhere past init()'s own try/catch (the one handleBootFailure() above exists for) only
// ever reached that browser's own console; there was no way to know it happened at all unless
// the user reported it. reportClientError() is the one funnel both the global listeners below
// and handleBootFailure() itself call -- DB.logClientError() (js/01b_data.js) does the actual
// write, into a write-only-from-the-client table (see supabase/migrations/
// 20260810090000_client_errors.sql) nothing in the UI ever reads back from.
//
// Throttled and deduped client-side, in memory, reset every page load -- this is a personal-
// scale app (see CLAUDE.md's own framing throughout), not a hardened production error pipeline;
// the goal is "don't lose the first occurrence of a real bug," not "capture every single
// instance of a tight error loop." CLIENT_ERROR_MAX_PER_SESSION caps the total the tab will
// ever send; CLIENT_ERRORS_SEEN dedupes identical message+stack pairs (an error loop firing the
// same TypeError a thousand times in a row is one bug report, not a thousand).
const CLIENT_ERROR_MAX_PER_SESSION = 20;
let clientErrorsSentThisSession = 0;
const CLIENT_ERRORS_SEEN = new Set();
// `context` is deliberately optional and null for the two generic window listeners below --
// they have nothing more specific to say than "an error happened," so they defer entirely to
// VIEW (which view was actually open when it fired -- far more useful for tracking down a real
// bug than a fixed label). handleBootFailure() is the one call site that passes a real,
// meaningful context ('boot') -- that always wins over VIEW, since a boot failure by
// definition happens before VIEW ever gets set to anything but its initial default, so VIEW
// alone wouldn't tell you this was a boot failure specifically.
function reportClientError(err, context){
  if(clientErrorsSentThisSession >= CLIENT_ERROR_MAX_PER_SESSION) return;
  const message = (err && err.message) ? String(err.message) : String(err);
  const stack = (err && err.stack) ? String(err.stack) : null;
  const dedupeKey = message+'|'+(stack||'');
  if(CLIENT_ERRORS_SEEN.has(dedupeKey)) return;
  CLIENT_ERRORS_SEEN.add(dedupeKey);
  clientErrorsSentThisSession++;
  // Best-effort, fire-and-forget -- DB.logClientError() already swallows its own failures
  // (never let a failure to log an error surface as a second error), and this function is
  // itself called from inside error-handling paths, so it must never throw back into them.
  try{
    DB.logClientError({
      message, stack,
      view: context || ((typeof VIEW!=='undefined' && VIEW) ? VIEW : null),
      url: window.location.href,
      userAgent: navigator.userAgent
    });
  }catch(e){ /* swallow -- see comment above */ }
}
// window 'error' fires for uncaught exceptions and (with useCapture:true) resource load
// failures alike; only the former has a real .error object worth reporting here -- a failed
// <img>/<script> load fires the same event with ev.error null, which this app already has
// dedicated handling for elsewhere (js/00_supabase.js's own CDN-import retry, the PDF fallback
// dialog) and would just be console-log noise duplicated here.
window.addEventListener('error', ev=>{ if(ev.error) reportClientError(ev.error, null); });
// unhandledrejection is the promise equivalent -- an async function that throws with nothing
// awaiting/catching it fires this instead of window 'error'. ev.reason is usually a real Error
// but isn't guaranteed to be (a promise can reject with any value) -- reportClientError()
// already tolerates a plain string/non-Error value via its own message/stack fallback.
window.addEventListener('unhandledrejection', ev=>{ reportClientError(ev.reason, null); });
init().catch(handleBootFailure);
