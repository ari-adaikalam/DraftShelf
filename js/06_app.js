const PT2PX = 96/72;

/* ===== inline SVG icon set (replaces the old ad-hoc unicode glyphs) -- outline style,
   currentColor stroke so every icon inherits its button's text color automatically, no
   runtime dependency (fits the zero-build/CDN-or-inline convention). ===== */
const ICONS = {
  edit:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>',
  duplicate:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  star:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  starFilled:'<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  close:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  chevronUp:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m18 15-6-6-6 6"/></svg>',
  chevronDown:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
  sun:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>',
  moon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/></svg>',
  settings:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>',
  menu:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>'
};

var LIBRARY = null;
var VERSIONS_INDEX = [];
var CURRENT_VERSION = null;
var VIEW = 'auth';
var LIB_TAB = 'experience';
var ghPanelOpen = false;
var pendingDelete = null;
var LIBRARY_REVISION = null;
var VERSION_REVISIONS = {};
var GITHUB_CONFIG = null;
var syncConflict = null;
var PREFERENCES = null; // account-level, synced via Supabase user_preferences -- see renderPreferences()
var AUTH_MODE = 'signin'; // 'signin' | 'signup' | 'forgot' | 'reset'
var AUTH_MESSAGE = null; // {kind:'error'|'info', text}

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
  // Guest mode reuses this same element/slot rather than adding a separate always-visible
  // topbar badge -- the topbar was only just fixed for overflowing on narrow screens (see
  // the mobile-nav section of CLAUDE.md), so a new permanent element here isn't free.
  if(DB.guestMode){
    text = 'Guest — '+text;
    el.title = "You're not signed in -- this resume is saved to this browser only. Sign up any time to keep it and sync across devices.";
  } else {
    el.title = 'Library and version edits autosave to your account a moment after you stop typing.';
  }
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
  const btn = document.getElementById('btnThemeToggle');
  if(!btn) return;
  btn.innerHTML = THEME==='dark' ? ICONS.sun : ICONS.moon;
}
function setTheme(t){
  THEME = t;
  document.documentElement.setAttribute('data-theme', t);
  KV.set('rf:ui:theme', t);
  renderThemeToggle();
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

function toast(msg){
  const t=document.createElement('div');
  t.textContent=msg;
  t.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--ink-soft);border:1px solid var(--brass);color:var(--text-light);padding:10px 18px;border-radius:8px;font-size:13px;z-index:9999;';
  document.body.appendChild(t);
  setTimeout(()=>t.remove(),3000);
}

/* ===== mandatory auth gate: sign-in/sign-up/forgot-password/reset-password.
   Signing in is required to use the app at all -- there is no local-only fallback. ===== */
function authFieldsHtml(){
  if(AUTH_MODE==='signin') return `
    <div class="field"><label>Email</label><input type="email" id="authEmail" autocomplete="email"></div>
    <div class="field"><label>Password</label><input type="password" id="authPassword" autocomplete="current-password"></div>
    <button class="btn btn-brass" data-action="submit-signin">Sign in</button>
    <div class="auth-links">
      <a href="#" data-action="switch-signup">Create an account</a>
      <a href="#" data-action="switch-forgot">Forgot password?</a>
    </div>`;
  if(AUTH_MODE==='signup') return `
    <div class="field"><label>Email</label><input type="email" id="authEmail" autocomplete="email"></div>
    <div class="field"><label>Password</label><input type="password" id="authPassword" autocomplete="new-password"></div>
    <button class="btn btn-brass" data-action="submit-signup">Sign up</button>
    <div class="auth-links"><a href="#" data-action="switch-signin">Already have an account? Sign in</a></div>`;
  if(AUTH_MODE==='forgot') return `
    <div class="field"><label>Email</label><input type="email" id="authEmail" autocomplete="email"></div>
    <button class="btn btn-brass" data-action="submit-forgot">Send reset link</button>
    <div class="auth-links"><a href="#" data-action="switch-signin">Back to sign in</a></div>`;
  if(AUTH_MODE==='reset') return `
    <div class="field"><label>New password</label><input type="password" id="authPassword" autocomplete="new-password"></div>
    <button class="btn btn-brass" data-action="submit-reset">Set new password</button>`;
  return '';
}
function renderAuthScreen(){
  const titles = { signin:'Sign in', signup:'Create your account', forgot:'Reset your password', reset:'Choose a new password' };
  const el = document.getElementById('viewAuth');
  // "Continue without an account" only makes sense while actually choosing how to get in --
  // not mid-password-reset, and not once already in guest mode (VIEW never lands back on
  // 'auth' while DB.guestMode is true, so this condition is really just excluding 'reset').
  const guestLink = (AUTH_MODE==='signin' || AUTH_MODE==='signup')
    ? `<div class="auth-guest-link"><a href="#" data-action="continue-as-guest">Continue without an account</a></div>` : '';
  el.innerHTML = `<div class="auth-box">
    <h2>${esc(titles[AUTH_MODE])}</h2>
    ${AUTH_MESSAGE ? `<div class="auth-message auth-message-${AUTH_MESSAGE.kind}">${esc(AUTH_MESSAGE.text)}</div>` : ''}
    ${authFieldsHtml()}
    ${guestLink}
  </div>`;
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  el.classList.add('active');
  document.querySelectorAll('.nav button').forEach(b=>b.classList.remove('active'));
  VIEW = 'auth';
}
async function onAuthClick(ev){
  const el = ev.target.closest('[data-action]'); if(!el) return;
  ev.preventDefault();
  const action = el.dataset.action;
  if(action==='switch-signin' || action==='switch-signup' || action==='switch-forgot'){
    AUTH_MODE = action.replace('switch-',''); AUTH_MESSAGE = null; renderAuthScreen(); return;
  }
  if(action==='continue-as-guest'){ await enterGuestMode(); return; }
  if(action==='submit-signin'){
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    const { error } = await window.supabase.auth.signInWithPassword({ email, password });
    if(error){ AUTH_MESSAGE = { kind:'error', text:error.message }; renderAuthScreen(); }
    // On success, the onAuthStateChange listener wired in init() picks up the new
    // session and transitions to the dashboard -- no manual redirect needed here.
    return;
  }
  if(action==='submit-signup'){
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    const { error } = await window.supabase.auth.signUp({ email, password });
    if(error) AUTH_MESSAGE = { kind:'error', text:error.message };
    else { AUTH_MESSAGE = { kind:'info', text:'Check your email to confirm your account, then sign in.' }; AUTH_MODE='signin'; }
    renderAuthScreen();
    return;
  }
  if(action==='submit-forgot'){
    const email = document.getElementById('authEmail').value.trim();
    const { error } = await window.supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin+window.location.pathname });
    AUTH_MESSAGE = error ? { kind:'error', text:error.message } : { kind:'info', text:'Check your email for a reset link.' };
    renderAuthScreen();
    return;
  }
  if(action==='submit-reset'){
    const password = document.getElementById('authPassword').value;
    const { error } = await window.supabase.auth.updateUser({ password });
    AUTH_MESSAGE = error ? { kind:'error', text:error.message } : { kind:'info', text:'Password updated -- signing you in.' };
    renderAuthScreen();
    return;
  }
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
function switchView(view){
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
  if(view!=='auth') KV.set('rf:ui:lastView', view); // device-local -- see loadAuthedAppState()'s restore logic
  if(view==='dashboard') renderDashboard();
  if(view==='library') renderLibrary();
  if(view==='preferences') renderPreferences();
  if(view==='coverLetter') renderCoverLetter();
  if(view==='editor') renderEditor();
  updateNavResumeButton();
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
function prefSectionOrderHtml(){
  const p = PREFERENCES || {};
  const order = (p.export_prefs && Array.isArray(p.export_prefs.sectionOrder)) ? p.export_prefs.sectionOrder : BUILTIN_SECTION_ORDER.slice();
  return order.map(tok=>`<div class="sel-item">
    <div class="sel-head">
      <label>${esc(PREF_SECTION_LABELS[tok]||tok)}</label>
      <div class="move-btns"><button data-action="move-pref-section" data-token="${esc(tok)}" data-dir="up">${ICONS.chevronUp}</button><button data-action="move-pref-section" data-token="${esc(tok)}" data-dir="down">${ICONS.chevronDown}</button></div>
    </div>
  </div>`).join('');
}
function renderPreferences(){
  const el = document.getElementById('viewPreferences');
  const p = PREFERENCES || {};
  const st = p.default_style || defaultStyle();
  el.innerHTML = `<div style="max-width:520px;">
    <h2 style="margin-top:0;">Preferences</h2>
    <p style="font-size:12px;color:var(--text-muted);max-width:480px;">Account-level defaults applied whenever you create a new version. These sync across every device you sign into.</p>
    <div class="entry">
      <div class="field"><label>Default references mode</label><select data-pref="default_references_mode">
        <option value="full" ${(p.default_references_mode||'full')==='full'?'selected':''}>Full list</option>
        <option value="onrequest" ${p.default_references_mode==='onrequest'?'selected':''}>Available upon request</option>
        <option value="none" ${p.default_references_mode==='none'?'selected':''}>None</option>
      </select></div>
    </div>
    <details class="ed-block" open style="margin-top:16px;"><summary>Default style</summary>${stylePanelHtml(st, 'default_style', p.default_page_size||'A4', 'default_page_size')}</details>
    <details class="ed-block" open style="margin-top:12px;"><summary>Default section order</summary>${prefSectionOrderHtml()}</details>
  </div>`;
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
  const order = Array.isArray(PREFERENCES.export_prefs.sectionOrder) ? PREFERENCES.export_prefs.sectionOrder.slice() : BUILTIN_SECTION_ORDER.slice();
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
  if(PREFERENCES.export_prefs && Array.isArray(PREFERENCES.export_prefs.sectionOrder)) v.sectionOrder = PREFERENCES.export_prefs.sectionOrder.slice();
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
        <label class="chk" style="margin-top:10px;"><input type="checkbox" data-cl-align-toggle ${cl.align!=='left'?'checked':''}> Justify body text</label>
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
  // Guest mode has no GitHub-backup equivalent (DB.getGithubConfig()/callBackupFunction()
  // both need a real account server-side) -- swap the whole GH section out for a sign-up
  // prompt instead of letting a guest click Connect and hit a confusing failure.
  const guestNotice = document.getElementById('guestNotice');
  const ghSection = document.getElementById('ghSection');
  if(guestNotice) guestNotice.style.display = DB.guestMode ? 'block' : 'none';
  if(ghSection) ghSection.style.display = DB.guestMode ? 'none' : 'block';
  const signOutBtn = document.getElementById('btnSignOut');
  if(signOutBtn) signOutBtn.textContent = DB.guestMode ? 'Sign up' : 'Sign out';
}
// GitHub push queue -- coalesces every "this needs backing up" signal (library edits,
// version edits, a new/duplicated/starred version) into a single, debounced push cycle
// instead of firing an immediate push-file call per edit. This fixes a real, reported bug:
// rapid edits could trigger several concurrent push-file calls for the *same* file, each
// computing its PUT against a sha that was stale by the time the request actually reached
// GitHub -- the first PUT wins and updates the sha, every other in-flight PUT holding the
// now-stale sha gets rejected with a 409. Coalescing into one push cycle, never more than one
// in flight at a time, makes that race structurally impossible from this tab.
var ghDirty = { library:false, versions:new Set() };
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
async function runGithubPushCycle(){
  if(ghPushInFlight){ ghPushQueuedAgain = true; return; }
  if(!ghDirty.library && ghDirty.versions.size===0) return;
  if(!GITHUB_CONFIG || !GITHUB_CONFIG.backup_enabled) return;
  ghPushInFlight = true;
  ghFirstDirtyAt = null;
  const pushLibrary = ghDirty.library; ghDirty.library = false;
  const versionIds = Array.from(ghDirty.versions); ghDirty.versions.clear();
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
  } finally {
    if(ok) setGhStatus('on','Backed up just now'); else setGhStatus('err','Backup failed: '+(lastErr||'unknown error'));
    // Refresh from the DB (the Edge Function already persisted last_backup_at/status/error
    // server-side, for whichever file it saw last) so the modal's status strip -- not just
    // the topbar dot -- reflects this push too. Both are driven by the same event now,
    // instead of two independently-updated displays that could show different, stale results.
    GITHUB_CONFIG = await DB.getGithubConfig();
    if(ghPanelOpen) renderGhPanel();
    ghPushInFlight = false;
    if(ghPushQueuedAgain || ghDirty.library || ghDirty.versions.size>0){
      ghPushQueuedAgain = false;
      runGithubPushCycle();
    }
  }
}
async function pushAllToGithub(){
  if(!GITHUB_CONFIG || !GITHUB_CONFIG.backup_enabled) return;
  if(ghPushInFlight){ toast('A backup is already in progress -- try again in a moment'); return; }
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
  const c = GITHUB_CONFIG || { owner:'', repo:'', branch:'main', folder:'resume-forge', backup_enabled:false, has_token:false };
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
          <li>Create a <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">fine-grained personal access token</a>, scoped to <strong>Contents: Read and write</strong> on the one repo you want to use.</li>
          <li>Fill in that repo's details and paste the token below.</li>
          <li>Save -- every change to your Library and Versions backs up automatically from then on. It's one-way (push only); this app never reads anything back from GitHub.</li>
        </ol>` : ''}

        <div class="gh-section-label">Repository</div>
        <div class="field-row4">
          <div class="field"><label>Owner</label><input type="text" id="ghOwner" placeholder="your GitHub username, not your display name" value="${esc(c.owner||'')}"></div>
          <div class="field"><label>Repo</label><input type="text" id="ghRepo" value="${esc(c.repo||'')}"></div>
          <div class="field"><label>Branch</label><input type="text" id="ghBranch" value="${esc(c.branch||'main')}"></div>
          <div class="field"><label>Folder</label><input type="text" id="ghFolder" value="${esc(c.folder||'resume-forge')}"></div>
        </div>

        <div class="gh-section-label">Access token</div>
        <div class="field"><label>Fine-grained personal access token${c.has_token?' (already saved -- leave blank to keep it)':''}</label><input type="password" id="ghPat" placeholder="${c.has_token?'••••••••  (saved)':'paste a new token here'}"></div>
        <p style="font-size:11px;color:var(--text-faint);margin:4px 0 0;">Stored encrypted server-side and never readable again once saved, even by this app -- to change it, paste a new one.</p>

        <label class="chk" style="margin-top:14px;"><input type="checkbox" id="ghBackupEnabled" ${c.backup_enabled?'checked':''}> Enable backup</label>

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
  document.getElementById('ghSave').onclick = async ()=>{
    const pat = document.getElementById('ghPat').value.trim();
    const res = await DB.callBackupFunction('save-config', {
      owner: document.getElementById('ghOwner').value.trim(),
      repo: document.getElementById('ghRepo').value.trim(),
      branch: document.getElementById('ghBranch').value.trim()||'main',
      folder: document.getElementById('ghFolder').value.trim()||'resume-forge',
      backupEnabled: document.getElementById('ghBackupEnabled').checked,
      ...(pat ? { pat } : {})
    });
    if(res.ok){ GITHUB_CONFIG = await DB.getGithubConfig(); toast('GitHub backup settings saved'); }
    else toast('Save failed: '+(res.error||'unknown error'));
    renderTopbarStatus(); renderGhPanel();
  };
  if(configured) document.getElementById('ghPush').onclick = pushAllToGithub;
  const disconnectBtn = document.getElementById('ghDisconnect');
  if(disconnectBtn) disconnectBtn.onclick = async ()=>{
    await DB.callBackupFunction('disconnect');
    GITHUB_CONFIG = await DB.getGithubConfig();
    renderTopbarStatus(); ghPanelOpen=false; renderGhPanel();
  };
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
    if(kind==='library'){ LIBRARY = serverRow.data; LIBRARY_REVISION = serverRow.revision; renderLibrary(); }
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

  const cardsHtml = list.map(v=>`
    <div class="card" data-id="${v.id}">
      ${v.main?'<span class="badge">'+ICONS.starFilled+' main</span> ':''}<span class="badge">${v.pageCount||1} page${(v.pageCount||1)>1?'s':''}</span>
      <h3>${esc(v.name)}</h3>
      <p>${esc(v.company||'')}${v.role?(' &mdash; '+esc(v.role)):''}</p>
      <p>${v.dateApplied?('Applied '+esc(v.dateApplied)):''}</p>
      <div class="card-actions">
        <button data-act="edit" title="Edit">${ICONS.edit}</button>
        <button data-act="dup" title="Duplicate">${ICONS.duplicate}</button>
        <button data-act="star" title="Toggle main">${ICONS.star}</button>
        <button data-act="del" title="Delete" style="${v.id===pendingDelete?'color:var(--red);font-weight:700;':''}">${v.id===pendingDelete?'Confirm?':ICONS.close}</button>
      </div>
    </div>
  `).join('') + `<div class="card new" id="newVersionCard">+ New version</div>`;
  document.getElementById('versionCards').innerHTML = cardsHtml;
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
  await DB.deleteVersion(id);
  delete VERSION_REVISIONS[id];
  VERSIONS_INDEX = VERSIONS_INDEX.filter(v=>v.id!==id);
  pendingDelete = null;
  renderDashboard();
}
function onDashboardCardClick(ev){
  if(ev.target.closest('#newVersionCard')){ createNewVersion(); return; }
  const card = ev.target.closest('.card[data-id]'); if(!card) return;
  const id = card.dataset.id;
  const actBtn = ev.target.closest('button[data-act]'); if(!actBtn) return;
  const act = actBtn.dataset.act;
  if(act==='edit') openEditor(id);
  else if(act==='dup') duplicateVersion(id);
  else if(act==='star') toggleMain(id);
  else if(act==='del'){
    if(pendingDelete===id) deleteVersionConfirmed(id);
    else { pendingDelete=id; renderDashboard(); setTimeout(()=>{ if(pendingDelete===id){ pendingDelete=null; renderDashboard(); } },4000); }
  }
}

/* ===== JSON export / import -- the primary content-portability path, independent of
   whatever backend is underneath (see the migration plan's "replaceable Postgres
   provider" section) ===== */
// Shared by exportAllJson() (below) and the guest-mode-to-signup bridge (exitGuestMode()) --
// one place that knows how to snapshot the currently-active LIBRARY/VERSIONS_INDEX into the
// portable payload shape importJsonPayload() expects.
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
    LIBRARY = payload.library;
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
async function onImportFile(ev){
  const file = ev.target.files[0]; if(!file) return;
  try{
    const text = await file.text();
    await importJsonPayload(JSON.parse(text));
    renderDashboard();
    toast('Import complete');
  }catch(e){ console.error(e); toast('Import failed: '+e.message); }
  ev.target.value='';
}

/* ===== library manager ===== */
function entryLabel(kind, e){
  if(kind==='experience') return e.company;
  if(kind==='projects') return e.title;
  if(kind==='education') return e.school;
  if(kind==='skills') return e.label;
  if(kind==='summaries') return e.label || (e.text||'').slice(0,30);
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
  return `<div class="bullet-row">
    <textarea data-path="${kind}.${entryIndex}.bullets.${bi}.text">${esc(b.text)}</textarea>
    <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end;">
      <input type="text" class="tag-input" placeholder="tags, comma" data-tagpath="${kind}.${entryIndex}.bullets.${bi}" value="${esc((b.tags||[]).join(', '))}">
      ${hasMetric(b.text)?'<span class="metric-ok">has metric</span>':'<span class="metric-flag">no metric</span>'}
      <button class="btn btn-danger btn-icon" data-action="remove-bullet" data-kind="${kind}" data-id="${entryId}" data-bid="${b.id}">${ICONS.close}</button>
    </div>
  </div>`;
}
function entryCardHtml(kind, e, i){
  const rm = `<div class="entry-top"><button class="btn btn-danger btn-icon" data-action="remove-entry" data-kind="${kind}" data-id="${e.id}">${ICONS.close}</button></div>`;
  if(kind==='experience'){
    return `<div class="entry">${rm}
      <div class="field-row">
        <div class="field"><label>Company</label><input type="text" data-path="experience.${i}.company" value="${esc(e.company)}"></div>
        <div class="field"><label>Tag (optional)</label><input type="text" data-path="experience.${i}.tag" value="${esc(e.tag)}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Role</label><input type="text" data-path="experience.${i}.role" value="${esc(e.role)}"></div>
        <div class="field"><label>Dates</label><input type="text" data-path="experience.${i}.dates" value="${esc(e.dates)}"></div>
      </div>
      <div class="field"><label>Location</label><input type="text" data-path="experience.${i}.location" value="${esc(e.location)}"></div>
      <div style="font-size:11px;color:var(--text-muted);margin:8px 0 4px;">Bullets</div>
      ${e.bullets.map((b,bi)=>bulletRowHtml('experience',i,e.id,b,bi)).join('')}
      <button class="btn btn-ghost btn-sm" data-action="add-bullet" data-kind="experience" data-id="${e.id}">+ Add bullet</button>
    </div>`;
  }
  if(kind==='projects'){
    return `<div class="entry">${rm}
      <div class="field-row">
        <div class="field"><label>Title</label><input type="text" data-path="projects.${i}.title" value="${esc(e.title)}"></div>
        <div class="field"><label>Dates</label><input type="text" data-path="projects.${i}.dates" value="${esc(e.dates)}"></div>
      </div>
      <div style="font-size:11px;color:var(--text-muted);margin:8px 0 4px;">Bullets</div>
      ${e.bullets.map((b,bi)=>bulletRowHtml('projects',i,e.id,b,bi)).join('')}
      <button class="btn btn-ghost btn-sm" data-action="add-bullet" data-kind="projects" data-id="${e.id}">+ Add bullet</button>
    </div>`;
  }
  if(kind==='education'){
    return `<div class="entry">${rm}
      <div class="field-row">
        <div class="field"><label>School</label><input type="text" data-path="education.${i}.school" value="${esc(e.school)}"></div>
        <div class="field"><label>Location</label><input type="text" data-path="education.${i}.location" value="${esc(e.location)}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Degree</label><input type="text" data-path="education.${i}.degree" value="${esc(e.degree)}"></div>
        <div class="field"><label>Dates</label><input type="text" data-path="education.${i}.dates" value="${esc(e.dates)}"></div>
      </div>
    </div>`;
  }
  if(kind==='skills'){
    return `<div class="entry">${rm}
      <div class="field"><label>Category label</label><input type="text" data-path="skills.${i}.label" value="${esc(e.label)}"></div>
      <div class="field"><label>Items</label><input type="text" data-path="skills.${i}.text" value="${esc(e.text)}"></div>
    </div>`;
  }
  if(kind==='summaries'){
    return `<div class="entry">${rm}
      <div class="field"><label>Label</label><input type="text" data-path="summaries.${i}.label" value="${esc(e.label)}"></div>
      <div class="field"><label>Text</label><textarea data-path="summaries.${i}.text" rows="3">${esc(e.text)}</textarea></div>
      <div class="field"><label>Tags (comma separated)</label><input type="text" class="tag-input" style="width:100%;" data-tagpath="summaries.${i}" value="${esc((e.tags||[]).join(', '))}"></div>
    </div>`;
  }
  if(kind==='references'){
    return `<div class="entry">${rm}
      <div class="field-row">
        <div class="field"><label>Name</label><input type="text" data-path="references.${i}.name" value="${esc(e.name)}"></div>
        <div class="field"><label>Title / relationship</label><input type="text" data-path="references.${i}.title" value="${esc(e.title)}"></div>
      </div>
      <div class="field"><label>Contact</label><input type="text" data-path="references.${i}.contact" value="${esc(e.contact)}"></div>
    </div>`;
  }
  if(kind==='customSections'){
    const bulletsBlock = e.contentType==='bullets' ? `
      <div style="font-size:11px;color:var(--text-muted);margin:8px 0 4px;">Bullets</div>
      ${e.bullets.map((b,bi)=>bulletRowHtml('customSections',i,e.id,b,bi)).join('')}
      <button class="btn btn-ghost btn-sm" data-action="add-bullet" data-kind="customSections" data-id="${e.id}">+ Add bullet</button>` : '';
    const paragraphBlock = e.contentType==='paragraph' ? `
      <div class="field"><label>Text (use **word** for inline bold)</label><textarea data-path="customSections.${i}.text" rows="3">${esc(e.text)}</textarea></div>` : '';
    return `<div class="entry">${rm}
      <div class="field"><label>Heading</label><input type="text" data-path="customSections.${i}.heading" value="${esc(e.heading)}"></div>
      <div class="field-row">
        <div class="field"><label>Subheading (optional)</label><input type="text" placeholder="e.g. issuing organization" data-path="customSections.${i}.subheading" value="${esc(e.subheading||'')}"></div>
        <div class="field"><label>Location (optional)</label><input type="text" data-path="customSections.${i}.location" value="${esc(e.location||'')}"></div>
      </div>
      <div class="field"><label>Dates (optional)</label><input type="text" data-path="customSections.${i}.dates" value="${esc(e.dates||'')}"></div>
      <div class="field"><label>Content type</label><select data-path="customSections.${i}.contentType">
        <option value="bullets" ${e.contentType==='bullets'?'selected':''}>Bullets</option>
        <option value="paragraph" ${e.contentType==='paragraph'?'selected':''}>Paragraph</option>
      </select></div>
      ${bulletsBlock}${paragraphBlock}
    </div>`;
  }
  return '';
}
function libKindHtml(kind){
  const items = LIBRARY[kind];
  const labelMap = {experience:'experience',projects:'project',education:'education',skills:'skill category',summaries:'summary',references:'reference',customSections:'custom section'};
  const cards = items.map((e,i)=> entryCardHtml(kind,e,i)).join('');
  return cards + `<div style="margin-top:6px;"><button class="btn btn-ghost btn-sm" data-action="add-entry" data-kind="${kind}">+ Add ${labelMap[kind]}</button></div>`;
}
function renderLibrary(){
  document.querySelectorAll('#libTabs button').forEach(b=>b.classList.toggle('active', b.dataset.kind===LIB_TAB));
  const wrap = document.getElementById('libPanels');
  wrap.innerHTML = LIB_TAB==='meta' ? metaFormHtml() : libKindHtml(LIB_TAB);
}
// Two-part debounce: the inner _Debounced function is the actual save (fires 900ms after
// the last edit); the outer scheduleLibrarySave() wrapper -- same name every call site
// already uses, so nothing else needs to change -- flips the status indicator to 'dirty'
// synchronously the instant it's called, not 900ms later, so "Unsaved changes" shows up
// immediately rather than lagging behind the edit that caused it.
const scheduleLibrarySaveDebounced = debounce(async ()=>{
  SAVE_STATUS.library = 'saving'; updateSaveStatusUI();
  const res = await DB.saveLibrary(LIBRARY, LIBRARY_REVISION);
  if(res.conflict){ showSyncConflict('library', res.serverRow); SAVE_STATUS.library='error'; updateSaveStatusUI(); return; }
  SAVE_STATUS.library = res.ok ? 'saved' : 'error';
  if(res.ok){ LIBRARY_REVISION = res.revision; markGithubDirty('library'); }
  updateSaveStatusUI();
}, 900);
function scheduleLibrarySave(){ SAVE_STATUS.library='dirty'; updateSaveStatusUI(); scheduleLibrarySaveDebounced(); }
// Core LIBRARY-mutating logic, factored out of onLibraryInput/onLibraryClick. The entry-edit
// modal (renderEntryEditModal() below) mutates LIBRARY through its own saveEntryEditModal()/
// add-bullet/remove-bullet handlers rather than these two -- it needs to buffer edits
// uncommitted until Save (to support the library-vs-version-only choice), which these
// immediate-apply functions aren't shaped for. Kept factored out anyway since both call
// sites want the exact same reducer calls + noteLibraryHistory() timing, just triggered
// differently.
function applyLibraryInputChange(t){
  if(!t.dataset.path && !t.dataset.tagpath) return false;
  noteLibraryHistory();
  if(t.dataset.path){
    setPath(LIBRARY, t.dataset.path, t.value);
    if(t.dataset.path.endsWith('.text') && t.closest('.bullet-row')){
      const flagEl = t.closest('.bullet-row').querySelector('.metric-flag,.metric-ok');
      if(flagEl){ const ok=hasMetric(t.value); flagEl.className = ok?'metric-ok':'metric-flag'; flagEl.textContent = ok?'has metric':'no metric'; }
    }
    scheduleLibrarySave();
    return t.dataset.path.endsWith('.contentType') ? 'structural' : true;
  }
  const arr = t.value.split(',').map(s=>s.trim()).filter(Boolean);
  setPath(LIBRARY, t.dataset.tagpath+'.tags', arr);
  scheduleLibrarySave();
  return true;
}
function applyLibraryClickAction(action, kind, btn){
  if(!['add-entry','remove-entry','add-bullet','remove-bullet'].includes(action)) return false;
  noteLibraryHistoryImmediate();
  if(action==='add-entry') LIBRARY = libAddEntry(LIBRARY, kind);
  else if(action==='remove-entry') LIBRARY = libRemoveEntry(LIBRARY, kind, btn.dataset.id);
  else if(action==='add-bullet') LIBRARY = libAddBullet(LIBRARY, kind, btn.dataset.id);
  else if(action==='remove-bullet') LIBRARY = libRemoveBullet(LIBRARY, kind, btn.dataset.id, btn.dataset.bid);
  scheduleLibrarySave();
  return true;
}
function onLibraryInput(ev){
  if(applyLibraryInputChange(ev.target)==='structural') renderLibrary();
}
function onLibraryClick(ev){
  const btn = ev.target.closest('button[data-action]'); if(!btn) return;
  if(applyLibraryClickAction(btn.dataset.action, btn.dataset.kind, btn)) renderLibrary();
}

/* ===== version editor ===== */
async function openEditor(id){
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
  KV.set('rf:ui:lastVersionId', id); // device-local only -- see the account-vs-device preference split
  KV.set('rf:ui:lastView', 'editor'); // same restore mechanism switchView() uses -- see loadAuthedAppState()
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('viewEditor').classList.add('active');
  document.querySelectorAll('.nav button').forEach(b=>b.classList.remove('active'));
  VIEW='editor';
  renderEditor();
  updateNavResumeButton();
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
function summarySelectorHtml(){
  const sel = CURRENT_VERSION.selection;
  // "(custom text below)" mode already lets the textarea double as a per-version-only
  // summary -- the gap this closes is the *other* mode: once a library summary is picked,
  // its printed text was only editable from the Library tab. The button here opens the same
  // entry-edit modal every other kind uses, offering the library-vs-version-only choice for
  // that summary's text specifically.
  const editBtn = sel.summaryId ? editDetailsButtonHtml('summaries', sel.summaryId) : '';
  return `<div class="field"><label>Heading</label><input type="text" data-path="selection.summaryHeading" value="${esc(sel.summaryHeading||'Summary')}"></div>
  <select data-path="selection.summaryId">
    <option value="">(custom text below)</option>
    ${LIBRARY.summaries.map(s=>`<option value="${s.id}" ${sel.summaryId===s.id?'selected':''}>${esc(entryLabel('summaries',s))}</option>`).join('')}
  </select>
  <textarea data-path="selection.customSummaryText" placeholder="Or write one-off text for just this version (use **word** for inline bold)" rows="3">${esc(sel.customSummaryText)}</textarea>
  ${editBtn}`;
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
  return `<button type="button" class="btn btn-ghost btn-sm" data-action="open-edit-modal" data-kind="${kind}" data-entry-id="${entryId}" style="margin-top:6px;">Edit details</button>`;
}
const ED_ADD_LABELS = {experience:'experience', projects:'project', education:'education', skills:'skill category', references:'reference', customSections:'custom section'};
function selectionListHtml(kind){
  const selMap={}; CURRENT_VERSION.selection[kind].forEach((s,i)=> selMap[s.refId]=i);
  const libraryItems = LIBRARY[kind];
  const addBtnHtml = `<div style="margin-top:8px;"><button class="btn btn-ghost btn-sm" data-action="ed-add-entry" data-kind="${kind}">+ Add new ${ED_ADD_LABELS[kind]}</button></div>`;
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
        return `<label class="sel-bullet ${on?'on':''}"><input type="checkbox" data-bullet-toggle data-kind="${kind}" data-ref="${entry.id}" data-bullet="${b.id}" ${on?'checked':''}> ${esc(b.text.slice(0,70))}${b.text.length>70?'\u2026':''}${!hasMetric(b.text)?' <span class="metric-flag">no metric</span>':''}</label>`;
      }).join('')}</div>`;
    }
    return `<div class="sel-item">
      <div class="sel-head">
        <input type="checkbox" data-ref-toggle data-kind="${kind}" data-ref="${entry.id}" ${included?'checked':''}>
        <label>${esc(label)}</label>
        ${included?`<div class="move-btns"><button data-move="up" data-kind="${kind}" data-ref="${entry.id}">${ICONS.chevronUp}</button><button data-move="down" data-kind="${kind}" data-ref="${entry.id}">${ICONS.chevronDown}</button></div>`:''}
      </div>
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
  let body = `<label class="chk"><input type="checkbox" data-ref-toggle data-kind="customSections" data-ref="${cs.id}" ${included?'checked':''}> Include in this version</label>`;
  if(included){
    body += sectionHeadingFieldHtml(token, cs.heading||'Untitled');
    if(cs.contentType==='bullets'){
      const sel = CURRENT_VERSION.selection.customSections.find(s=>s.refId===cs.id);
      const bulletIds = sel ? sel.bulletIds : [];
      body += `<div class="sel-bullets">${cs.bullets.map(b=>{
        const on = bulletIds.includes(b.id);
        return `<label class="sel-bullet ${on?'on':''}"><input type="checkbox" data-bullet-toggle data-kind="customSections" data-ref="${cs.id}" data-bullet="${b.id}" ${on?'checked':''}> ${esc(b.text.slice(0,70))}${b.text.length>70?'…':''}${!hasMetric(b.text)?' <span class="metric-flag">no metric</span>':''}</label>`;
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
function stylePanelHtml(style, pathPrefix, pageSize, pageSizePath){
  const st = style;
  return `<div class="field"><label>Font family</label><select data-path="${pathPrefix}.fontFamily">
    <option value='"Times New Roman", Times, serif' ${st.fontFamily.includes('Times')?'selected':''}>Times New Roman</option>
    <option value='Arial, sans-serif' ${st.fontFamily.includes('Arial')?'selected':''}>Arial</option>
    <option value='"Carlito", sans-serif' ${(st.fontFamily.includes('Calibri')||st.fontFamily.includes('Carlito'))?'selected':''}>Calibri</option>
    <option value='Georgia, serif' ${st.fontFamily.includes('Georgia')?'selected':''}>Georgia</option>
  </select></div>
  <div class="style-grid">
    <div class="field"><label>Name size (pt)</label><input type="number" step="0.5" min="6" data-path="${pathPrefix}.fsName" value="${st.fsName}"></div>
    <div class="field"><label>Contact size (pt)</label><input type="number" step="0.5" min="6" data-path="${pathPrefix}.fsContact" value="${st.fsContact}"></div>
    <div class="field"><label>Heading size (pt)</label><input type="number" step="0.5" min="6" data-path="${pathPrefix}.fsHeading" value="${st.fsHeading}"></div>
    <div class="field"><label>Body size (pt)</label><input type="number" step="0.5" min="6" data-path="${pathPrefix}.fsBody" value="${st.fsBody}"></div>
    <div class="field"><label>Line height</label><input type="number" step="0.05" min="1" data-path="${pathPrefix}.lineHeight" value="${st.lineHeight}"></div>
    <div class="field"><label>Bullet marker</label><select data-path="${pathPrefix}.bulletMarker">
      <option value="&#8226;" ${st.bulletMarker==='\u2022'?'selected':''}>&bull;</option>
      <option value="-" ${st.bulletMarker==='-'?'selected':''}>&ndash;</option>
      <option value="&#9656;" ${st.bulletMarker==='\u25B8'?'selected':''}>&#9656;</option>
      <option value="none" ${st.bulletMarker==='none'?'selected':''}>none</option>
    </select></div>
    <div class="field"><label>Bullet gap (pt)</label><input type="number" step="0.5" min="0" data-path="${pathPrefix}.gapBullet" value="${st.gapBullet}"></div>
    <div class="field"><label>Entry gap (pt)</label><input type="number" step="0.5" min="0" data-path="${pathPrefix}.gapEntry" value="${st.gapEntry}"></div>
    <div class="field"><label>Section gap (pt)</label><input type="number" step="0.5" min="0" data-path="${pathPrefix}.gapSection" value="${st.gapSection}"></div>
    <div class="field"><label>Heading gap above (pt)</label><input type="number" step="0.5" min="0" data-path="${pathPrefix}.headingGapAbove" value="${st.headingGapAbove}"></div>
    <div class="field"><label>Heading gap below (pt)</label><input type="number" step="0.5" min="0" data-path="${pathPrefix}.headingGapBelow" value="${st.headingGapBelow}"></div>
    <div class="field"><label>Heading align</label><select data-path="${pathPrefix}.headingAlign">
      <option value="left" ${st.headingAlign==='left'?'selected':''}>Left</option>
      <option value="center" ${st.headingAlign==='center'?'selected':''}>Center</option>
    </select></div>
    <div class="field"><label>Body align</label><select data-path="${pathPrefix}.bodyAlign">
      <option value="justify" ${st.bodyAlign==='justify'?'selected':''}>Justify</option>
      <option value="left" ${st.bodyAlign==='left'?'selected':''}>Left</option>
    </select></div>
  </div>
  <label class="chk" style="margin-top:6px;"><input type="checkbox" data-path="${pathPrefix}.headingUnderline" ${st.headingUnderline?'checked':''}> Underline headings</label>
  <label class="chk"><input type="checkbox" data-path="${pathPrefix}.headingUppercase" ${st.headingUppercase?'checked':''}> Uppercase headings</label>
  <div class="field-row4" style="margin-top:8px;">
    <div class="field"><label>Margin top (in)</label><input type="number" step="0.1" min="0.5" data-path="${pathPrefix}.marginTop" value="${st.marginTop}"></div>
    <div class="field"><label>Margin right (in)</label><input type="number" step="0.1" min="0.5" data-path="${pathPrefix}.marginRight" value="${st.marginRight}"></div>
    <div class="field"><label>Margin bottom (in)</label><input type="number" step="0.1" min="0.5" data-path="${pathPrefix}.marginBottom" value="${st.marginBottom}"></div>
    <div class="field"><label>Margin left (in)</label><input type="number" step="0.1" min="0.5" data-path="${pathPrefix}.marginLeft" value="${st.marginLeft}"></div>
  </div>
  <div class="field" style="margin-top:8px;"><label>Page size</label><select data-path="${pageSizePath}">
    <option value="A4" ${pageSize==='A4'?'selected':''}>A4</option>
    <option value="Letter" ${pageSize==='Letter'?'selected':''}>US Letter</option>
  </select></div>
  <div style="font-size:11px;color:var(--text-muted);margin:8px 0 2px;">Bold fields</div>
  <div class="bold-toggles">${Object.keys(st.bold).map(k=>`<label class="chk"><input type="checkbox" data-path="${pathPrefix}.bold.${k}" ${st.bold[k]?'checked':''}> ${k}</label>`).join('')}</div>`;
}
function jdPanelHtml(){
  return `<div class="field"><label>Paste job description</label><textarea data-path="jobMeta.jdText" rows="5">${esc(CURRENT_VERSION.jobMeta.jdText)}</textarea></div>
  <button class="btn btn-ghost btn-sm" data-action="jd-match">Match keywords</button>
  <div id="jdResult"></div>`;
}
function runJdMatch(){
  const resolved = resolveVersion(LIBRARY, CURRENT_VERSION);
  const corpus = [resolved.summary, ...resolved.experience.flatMap(e=>e.bullets.map(b=>b.text)),
    ...resolved.projects.flatMap(p=>p.bullets.map(b=>b.text)), ...resolved.skills.map(s=>s.text)].join(' ');
  const r = matchKeywords(CURRENT_VERSION.jobMeta.jdText, corpus);
  const el = document.getElementById('jdResult'); if(!el) return;
  el.innerHTML = `<div style="font-size:11px;color:var(--text-muted);margin:6px 0 4px;">Matched (${r.matched.length})</div>
    <div class="jd-result">${r.matched.map(k=>`<span class="kw match">${esc(k.word)}</span>`).join('')||'<span style="font-size:11px;color:var(--text-faint);">none yet</span>'}</div>
    <div style="font-size:11px;color:var(--text-muted);margin:10px 0 4px;">Consider adding (${r.missing.length})</div>
    <div class="jd-result">${r.missing.map(k=>`<span class="kw miss">${esc(k.word)}</span>`).join('')||'<span style="font-size:11px;color:var(--text-faint);">none</span>'}</div>`;
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
  return `<div class="field section-heading-field"><label>Heading</label><input type="text" data-path="sectionHeadings.${token}" value="${esc(val)}"></div>`;
}
const BUILTIN_SECTION_META = {
  experience: { label:'Experience', defaultHeading:'Work Experience', defaultOpen:true, body:()=>sectionHeadingFieldHtml('experience','Work Experience')+selectionListHtml('experience') },
  projects:   { label:'Projects',   defaultHeading:'Projects',        defaultOpen:false, body:()=>sectionHeadingFieldHtml('projects','Projects')+selectionListHtml('projects') },
  education:  { label:'Education',  defaultHeading:'Education',       defaultOpen:false, body:()=>sectionHeadingFieldHtml('education','Education')+selectionListHtml('education') },
  skills:     { label:'Skills',     defaultHeading:'Skills',          defaultOpen:false, body:()=>sectionHeadingFieldHtml('skills','Skills')+selectionListHtml('skills') },
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
  experience: [['company','Company'],['tag','Tag (optional)'],['role','Role'],['dates','Dates'],['location','Location']],
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
  const libEntry = LIBRARY[kind].find(e=>e.id===entryId);
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
  return `<div style="font-size:11px;color:var(--text-muted);margin:10px 0 4px;">Bullets</div>
    ${resolvedEntry.bullets.map(b=>`<div class="bullet-row">
      <textarea id="ef_bullet_${b.id}">${esc(b.text)}</textarea>
      <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end;">
        <button type="button" class="btn btn-danger btn-icon" data-modal-action="remove-bullet" data-bullet-id="${b.id}">${ICONS.close}</button>
      </div>
    </div>`).join('')}
    <button type="button" class="btn btn-ghost btn-sm" data-modal-action="add-bullet">+ Add bullet</button>`;
}
function entryEditModalHtml(){
  if(!ENTRY_EDIT_MODAL) return '';
  const { kind, entryId } = ENTRY_EDIT_MODAL;
  if(kind==='summaries'){
    const libEntry = LIBRARY.summaries.find(s=>s.id===entryId);
    if(!libEntry) return '';
    const sel = CURRENT_VERSION.selection;
    // If this version's summaryId still points at this summary and it hasn't set its own
    // customSummaryText, the version is currently just showing the library text as-is --
    // prefill with that, not blank.
    const currentText = (sel.summaryId===entryId && sel.customSummaryText) ? sel.customSummaryText : libEntry.text;
    return `<div class="entry-edit-modal-overlay" id="entryEditModalOverlay">
      <div class="entry-edit-modal-box">
        <div class="gh-modal-header"><h3>Edit summary</h3><button class="gh-modal-close" id="entryEditModalClose" aria-label="Close">${ICONS.close}</button></div>
        <div class="gh-modal-body">
          <div class="field"><label>Text (use **word** for inline bold)</label><textarea id="ef_text" rows="6">${esc(currentText)}</textarea></div>
          <div class="edit-scope-choice">
            <div class="gh-section-label">Save changes to</div>
            <label class="chk"><input type="radio" name="editScope" value="library" checked> Library (every version using this summary)</label>
            <label class="chk"><input type="radio" name="editScope" value="version"> Only this version</label>
          </div>
        </div>
        <div class="gh-actions">
          <button class="btn btn-brass btn-sm" id="entryEditModalSave">Save</button>
          <button class="btn btn-ghost btn-sm" id="entryEditModalCancel">Cancel</button>
        </div>
      </div>
    </div>`;
  }
  const libEntry = LIBRARY[kind].find(e=>e.id===entryId);
  if(!libEntry) return '';
  const resolved = resolvedEntryForModal(kind, entryId);
  const sel = CURRENT_VERSION.selection[kind].find(s=>s.refId===entryId);
  const fields = ENTRY_EDIT_FIELDS[kind];
  const fieldsHtml = fields.map(([f,label])=> entryEditFieldInputHtml(kind, f, label, resolved[f])).join('');
  const bulletsHtml = resolved.bullets ? entryEditBulletsHtml(resolved) : '';
  const kindLabel = ED_ADD_LABELS[kind] || kind;
  return `<div class="entry-edit-modal-overlay" id="entryEditModalOverlay">
    <div class="entry-edit-modal-box">
      <div class="gh-modal-header"><h3>Edit ${esc(kindLabel)}</h3><button class="gh-modal-close" id="entryEditModalClose" aria-label="Close">${ICONS.close}</button></div>
      <div class="gh-modal-body">
        ${fieldsHtml}
        ${bulletsHtml}
        <div class="edit-scope-choice">
          <div class="gh-section-label">Save changes to</div>
          <label class="chk"><input type="radio" name="editScope" value="library" checked> Library (all versions)</label>
          <label class="chk" ${sel?'':'title="Include this in the version first to enable a version-only edit"'}><input type="radio" name="editScope" value="version" ${sel?'':'disabled'}> Only this version</label>
        </div>
      </div>
      <div class="gh-actions">
        <button class="btn btn-brass btn-sm" id="entryEditModalSave">Save</button>
        <button class="btn btn-ghost btn-sm" id="entryEditModalCancel">Cancel</button>
        <button class="btn btn-danger btn-sm" id="entryEditModalRemove" style="margin-left:auto;">Remove from library</button>
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
  wrap.innerHTML = entryEditModalHtml();
  const overlay = document.getElementById('entryEditModalOverlay');
  if(!overlay){ ENTRY_EDIT_MODAL=null; return; } // entry vanished from LIBRARY mid-session
  document.getElementById('entryEditModalClose').onclick = closeEntryEditModal;
  document.getElementById('entryEditModalCancel').onclick = closeEntryEditModal;
  overlay.addEventListener('click', (ev)=>{ if(ev.target.id==='entryEditModalOverlay') closeEntryEditModal(); });
  document.getElementById('entryEditModalSave').onclick = saveEntryEditModal;
  const removeBtn = document.getElementById('entryEditModalRemove');
  if(removeBtn) removeBtn.onclick = ()=>{
    const { kind, entryId } = ENTRY_EDIT_MODAL;
    noteLibraryHistoryImmediate();
    LIBRARY = libRemoveEntry(LIBRARY, kind, entryId);
    scheduleLibrarySave();
    closeEntryEditModal();
    renderEditor();
  };
  wrap.querySelectorAll('[data-modal-action="add-bullet"]').forEach(btn=> btn.onclick = ()=>{
    const snap = snapshotModalFieldValues();
    noteLibraryHistoryImmediate();
    LIBRARY = libAddBullet(LIBRARY, ENTRY_EDIT_MODAL.kind, ENTRY_EDIT_MODAL.entryId);
    scheduleLibrarySave();
    renderEntryEditModal();
    restoreModalFieldValues(snap);
  });
  wrap.querySelectorAll('[data-modal-action="remove-bullet"]').forEach(btn=> btn.onclick = ()=>{
    const snap = snapshotModalFieldValues();
    delete snap.vals['ef_bullet_'+btn.dataset.bulletId];
    noteLibraryHistoryImmediate();
    LIBRARY = libRemoveBullet(LIBRARY, ENTRY_EDIT_MODAL.kind, ENTRY_EDIT_MODAL.entryId, btn.dataset.bulletId);
    scheduleLibrarySave();
    renderEntryEditModal();
    restoreModalFieldValues(snap);
  });
  const firstField = wrap.querySelector('input, textarea, select');
  if(firstField) firstField.focus();
}
async function saveEntryEditModal(){
  if(!ENTRY_EDIT_MODAL) return;
  const { kind, entryId } = ENTRY_EDIT_MODAL;
  const scope = (document.querySelector('input[name="editScope"]:checked')||{}).value || 'library';
  if(kind==='summaries'){
    const text = document.getElementById('ef_text').value;
    if(scope==='library'){
      noteLibraryHistoryImmediate();
      LIBRARY = {...LIBRARY, summaries: LIBRARY.summaries.map(s=> s.id===entryId ? {...s, text} : s)};
      scheduleLibrarySave();
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
  const libEntry = LIBRARY[kind].find(e=>e.id===entryId);
  if(!libEntry){ closeEntryEditModal(); return; }
  const fieldNames = ENTRY_EDIT_FIELDS[kind].map(([f])=>f);
  if(scope==='library'){
    noteLibraryHistoryImmediate();
    const updated = {...libEntry};
    fieldNames.forEach(f=>{ const el=document.getElementById('ef_'+f); if(el) updated[f]=el.value; });
    if(updated.bullets){
      updated.bullets = updated.bullets.map(b=>{
        const el = document.getElementById('ef_bullet_'+b.id);
        return el ? {...b, text: el.value} : b;
      });
    }
    LIBRARY = {...LIBRARY, [kind]: LIBRARY[kind].map(e=> e.id===entryId ? updated : e)};
    // Clear any stale version-only overrides for the fields just written to the library --
    // otherwise an old per-version override would keep silently shadowing the new library
    // value forever, and this "update the library" save would appear to do nothing for
    // whichever version had previously customized that same field.
    let cv = CURRENT_VERSION;
    fieldNames.forEach(f=>{ cv = versionClearOverride(cv, kind, entryId, f); });
    if(updated.bullets) updated.bullets.forEach(b=>{ cv = versionClearBulletOverride(cv, kind, entryId, b.id); });
    CURRENT_VERSION = cv;
    scheduleLibrarySave(); scheduleVersionSave();
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
  const isOpen = (key, defaultOpen) => (openState[key] !== undefined ? openState[key] : defaultOpen) ? 'open' : '';

  // The panel's own block order follows CURRENT_VERSION.sectionOrder directly -- reordering
  // a section (the move-section buttons in each block's own summary) now visibly reorders
  // the editor panel itself, not just the print preview off to the side. Custom sections are
  // full peers of the 5 built-ins here (their own block, own heading override, own position
  // in this same order) rather than being lumped into one shared "Custom Sections" panel.
  const includedCustomIds = new Set(CURRENT_VERSION.selection.customSections.map(s=>s.refId));
  const sectionBlocksHtml = resolveSectionOrder(CURRENT_VERSION).map(token=>{
    if(token.indexOf('custom:')===0){
      const id = token.slice(7);
      const cs = LIBRARY.customSections.find(c=>c.id===id);
      if(!cs) return '';
      const info = customSectionBlockHtml(cs, true);
      const key = 'cs:'+id;
      return `<details class="ed-block" data-block-key="${key}" ${isOpen(key, false)}><summary><span>${esc(info.label)}</span>${sectionMoveButtonsHtml(token)}</summary>${info.body}</details>`;
    }
    const meta = BUILTIN_SECTION_META[token];
    if(!meta) return '';
    return `<details class="ed-block" data-block-key="${token}" ${isOpen(token, meta.defaultOpen)}><summary><span>${meta.label}</span>${sectionMoveButtonsHtml(token)}</summary>${meta.body()}</details>`;
  }).join('');
  // Custom sections not yet turned on for this version have no position in sectionOrder at
  // all (self-heal only adds a token once selected -- see resolveSectionOrder()), so they
  // wouldn't appear in the loop above; list them too, collapsed, purely so there's still a
  // way to discover and turn them on.
  const notIncludedCustomHtml = LIBRARY.customSections.filter(cs=>!includedCustomIds.has(cs.id)).map(cs=>{
    const info = customSectionBlockHtml(cs, false);
    const key = 'cs:'+cs.id;
    return `<details class="ed-block" data-block-key="${key}" ${isOpen(key, false)}><summary>${esc(info.label)}</summary>${info.body}</details>`;
  }).join('');

  panel.innerHTML = `
    <details class="ed-block" data-block-key="job-details" ${isOpen('job-details', true)}><summary>Job details</summary>${jobMetaFields()}</details>
    <details class="ed-block" data-block-key="summary" ${isOpen('summary', true)}><summary>Summary</summary>${summarySelectorHtml()}</details>
    ${sectionBlocksHtml}
    ${notIncludedCustomHtml}
    <div style="margin:-4px 0 12px;"><button class="btn btn-ghost btn-sm" data-action="ed-add-entry" data-kind="customSections">+ Add custom section</button></div>
    <details class="ed-block" data-block-key="style" ${isOpen('style', false)}><summary>Style</summary>${stylePanelHtml(CURRENT_VERSION.style, 'style', CURRENT_VERSION.pageSize, 'pageSize')}</details>
    <details class="ed-block" data-block-key="jd-match" ${isOpen('jd-match', false)}><summary>Match a job description</summary>${jdPanelHtml()}</details>
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
  if(t.dataset.path){
    let val;
    if(t.type==='checkbox') val = t.checked;
    else if(t.type==='number') val = parseFloat(t.value);
    else val = t.value;
    // 'input' always fires before 'change' for the same user action, and this branch's
    // setPath() below runs unconditionally on both -- so the state is still pre-mutation
    // only on 'input'. History must snapshot there, not on 'change' (which would capture
    // the already-mutated state as "before" and make undo a no-op). 'change' still runs
    // setPath/save below same as always; it's just not a second history entry.
    const isToggle = t.type==='checkbox' || t.tagName==='SELECT';
    if(ev.type==='input'){ if(isToggle) noteVersionHistoryImmediate(); else noteVersionHistory(); }
    setPath(CURRENT_VERSION, t.dataset.path, val);
    scheduleVersionSave();
    const structural = ['selection.summaryId','pageSize','referencesMode'].includes(t.dataset.path);
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
  noteLibraryHistoryImmediate();
  LIBRARY = libAddEntry(LIBRARY, kind);
  const created = LIBRARY[kind][LIBRARY[kind].length-1];
  noteVersionHistoryImmediate();
  CURRENT_VERSION = versionToggleRef(CURRENT_VERSION, kind, created.id, true);
  if(kind==='customSections') CURRENT_VERSION = sectionOrderAdd(CURRENT_VERSION, 'custom:'+created.id);
  scheduleLibrarySave(); scheduleVersionSave();
  renderEditor();
  if(kind==='customSections'){
    const blockEl = document.getElementById('edPanel').querySelector(`details.ed-block[data-block-key="cs:${created.id}"]`);
    if(blockEl) blockEl.open = true;
  }
  openEntryEditModal(kind, created.id);
}
function onEditorClick(ev){
  const addBtn = ev.target.closest('button[data-action="ed-add-entry"]');
  if(addBtn){ edAddEntry(addBtn.dataset.kind); return; }
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
  const jdBtn = ev.target.closest('button[data-action="jd-match"]');
  if(jdBtn){ runJdMatch(); return; }
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
  const wrap=document.createElement('div');
  const name=document.createElement('div');
  name.textContent=LIBRARY.meta.name||'Your Name';
  name.style.cssText=`font-family:${normalizeFontFamily(st.fontFamily)};font-size:${pt(st.fsName)};font-weight:bold;text-align:center;margin:0;`;
  const contact=document.createElement('div');
  contact.style.cssText=`font-family:${normalizeFontFamily(st.fontFamily)};font-size:${pt(st.fsContact)};text-align:center;margin:2pt 0 0;`;
  const sep=()=>document.createTextNode('   |   ');
  let any=false;
  if(LIBRARY.meta.phone){ contact.appendChild(document.createTextNode(LIBRARY.meta.phone)); any=true; }
  if(LIBRARY.meta.email){
    if(any) contact.appendChild(sep());
    const a=document.createElement('a');
    a.href='mailto:'+LIBRARY.meta.email;
    a.textContent=LIBRARY.meta.email;
    a.className='contact-email';
    a.style.cssText='color:#0563C1;text-decoration:underline;';
    contact.appendChild(a);
    any=true;
  }
  if(LIBRARY.meta.location){
    if(any) contact.appendChild(sep());
    contact.appendChild(document.createTextNode(LIBRARY.meta.location));
    any=true;
  }
  [['LinkedIn',LIBRARY.meta.linkedin],['GitHub',LIBRARY.meta.github],['Portfolio',LIBRARY.meta.portfolio]].forEach(([label,val])=>{
    if(!val) return;
    if(any) contact.appendChild(sep());
    const a=document.createElement('a');
    a.href=val;
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
  n.innerHTML = bd(r.name,'referenceName')+(r.title?'  \u2014  '+esc(r.title):'');
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
  const resolved = resolveVersion(LIBRARY, CURRENT_VERSION);
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
      <p>Waking up the backup server — this can take up to 30 seconds on a cold start.</p>
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
      if(res.ok){ updatePdfFallbackDialog('Backup server is awake — rendering…', 'ok'); return true; }
    }catch(e){ /* still asleep/unreachable -- keep polling */ }
    await new Promise(r=>setTimeout(r, intervalMs));
  }
  return false;
}

async function downloadPdf(){
  // PDF rendering runs server-side against a rate-limited service that authenticates the
  // caller via their Supabase session -- guests have none, so there's nothing to gate inside
  // the try/catch below (that already fails on a missing session, just with a generic
  // error). DOCX export needs no server at all (docx.js runs entirely client-side) so it's
  // unaffected and stays available to guests.
  if(DB.guestMode){ toast('Sign up for a free account to export PDF -- DOCX export works right now.'); return; }
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
    a.download=(LIBRARY.meta.name||'resume').replace(/\s+/g,'-')+'-'+(CURRENT_VERSION.name||'version').replace(/\s+/g,'-')+'.pdf';
    a.click();
  }catch(e){ console.error(e); hidePdfFallbackDialog(); toast('PDF export failed: '+e.message); }
  finally{ btn.disabled=false; btn.textContent=old; }
}
async function downloadDocx(){
  try{
    const resolved = resolveVersion(LIBRARY, CURRENT_VERSION);
    const doc = buildDocxDocument(window.docx, resolved, CURRENT_VERSION.style, CURRENT_VERSION.pageSize, LIBRARY.meta, CURRENT_VERSION.referencesMode, resolveSectionOrder(CURRENT_VERSION));
    const blob = await window.docx.Packer.toBlob(doc);
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
    a.download=(LIBRARY.meta.name||'resume').replace(/\s+/g,'-')+'-'+(CURRENT_VERSION.name||'version').replace(/\s+/g,'-')+'.docx';
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
  const libResult = await DB.getLibrary();
  LIBRARY = libResult ? libResult.data : emptyLibrary();
  LIBRARY_REVISION = libResult ? libResult.revision : null;
  VERSIONS_INDEX = await DB.listVersions();
  VERSION_REVISIONS = {};
  GITHUB_CONFIG = await DB.getGithubConfig();
  PREFERENCES = await DB.getPreferences();
  CURRENT_VERSION = null;
  syncConflict = null; renderConflictBanner();
  renderTopbarStatus();
  SAVE_STATUS = { library:'saved', version:'saved' }; updateSaveStatusUI();
  document.getElementById('topbarAuthedControls').style.display = 'flex';

  // Device-local session restore (this browser only, never synced) -- see the
  // account-vs-device preference split. Restores "which top-level view was active"
  // (rf:ui:lastView) in addition to "which version was open" (rf:ui:lastVersionId,
  // pre-existing) -- but deliberately does NOT silently reopen a version in the background
  // just because rf:ui:lastVersionId happens to be set while landing on some other view. An
  // earlier version of this restore did exactly that (openEditor() first, then switchView()
  // to the real lastView afterward) and it was a real, reported regression: rf:ui:lastVersionId
  // persists in localStorage indefinitely -- nothing clears it except opening a *different*
  // version -- so any account that had *ever* opened a version would have it silently
  // reappear as a background CURRENT_VERSION (and the "Continue editing" pill along with it)
  // on every future sign-in landing anywhere but Dashboard/Editor, even a totally fresh
  // session where the user never touched the editor at all. The only case this function
  // needs to re-run outside a genuine fresh sign-in is a real full page reload (e.g. Safari
  // evicting a backgrounded tab under memory pressure -- ordinary browser behavior no
  // app-level JS can prevent); onAuthStateChange() below no longer re-runs this on a
  // tab-visibility-driven token refresh, so that path doesn't land here anymore either.
  // Restoring the exact view (editor vs. not) is what matters for that reload case --
  // silently resurrecting an old background version is not, and is exactly what caused the
  // regression, so this only reopens the editor when the last view actually was (or, for
  // backward compatibility with data predating rf:ui:lastView, simply wasn't recorded as
  // being) something other than the editor.
  const savedLibTab = await KV.get('rf:ui:lastLibTab');
  if(savedLibTab) LIB_TAB = savedLibTab;
  const lastVersionId = await KV.get('rf:ui:lastVersionId');
  const lastView = await KV.get('rf:ui:lastView');
  // !lastView (not just lastView==='editor') also restores into the editor -- accounts whose
  // rf:ui:lastVersionId predates rf:ui:lastView entirely (or any other case where the latter
  // just isn't set) still get the original, pre-existing "reopen my last version" behavior;
  // only an *explicit* lastView of something else (the user genuinely navigated away to
  // Library/Preferences/Cover Letter more recently) skips it.
  if(lastVersionId && VERSIONS_INDEX.some(v=>v.id===lastVersionId) && (!lastView || lastView==='editor')){
    await openEditor(lastVersionId);
  } else {
    switchView(['library','preferences','coverLetter'].includes(lastView) ? lastView : 'dashboard');
  }

  // Guest-to-signup bridge, part two (see exitGuestMode()'s own comment for part one) -- only
  // for a real signed-in session, never while this call is itself the one entering guest mode.
  // Checked on every real load (not just right after SIGNED_IN) because email confirmation
  // sits between "guest exits to sign up" and "guest actually signs in" -- that sign-in, or
  // any reload of that same session before the prompt is resolved, is what needs to catch it.
  if(!DB.guestMode){
    const pending = localStorage.getItem('rf:guest:pendingImport');
    if(pending){
      try{ showGuestImportPrompt(JSON.parse(pending)); }
      catch(e){ localStorage.removeItem('rf:guest:pendingImport'); }
    }
  }
}
// Guest mode -- added on request, so someone can build a resume before deciding to sign up.
// DB.guestMode (js/01b_data.js) is the actual storage switch; everything here just flips
// that flag and reuses the exact same boot/teardown paths real sign-in/sign-out already use
// (loadAuthedAppState()/showSignedOutState()), since DB's guest branches make every call
// inside them resolve against this browser's localStorage instead of Supabase transparently
// -- no separate "guest app state" function needed.
async function enterGuestMode(){
  DB.guestMode = true;
  localStorage.setItem('rf:guest:active', '1'); // survives a reload -- see init()'s own restore check
  await loadAuthedAppState();
}
// True if this guest has actually entered anything worth offering to import later -- a guest
// who clicked "Continue without an account" and immediately decided to sign up shouldn't be
// asked to import an empty library.
function guestHasContent(){
  if(VERSIONS_INDEX.length) return true;
  if(!LIBRARY) return false;
  if(Object.values(LIBRARY.meta||{}).some(v=>v)) return true;
  return ['experience','projects','education','skills','summaries','references','customSections']
    .some(k=>(LIBRARY[k]||[]).length>0);
}
// Leaves guest mode without touching any of the guest's saved data (it stays in this
// browser's localStorage under its own rf:guest:* keys, untouched, in case they come back to
// guest mode later) -- lands straight on the sign-up form, since "exit guest mode" is
// something a guest only ever does *to* sign up, not to sit on a blank sign-in screen.
//
// Also stashes a snapshot of the current guest data under rf:guest:pendingImport (a separate
// key from the raw rf:guest:* data, which is left alone either way) -- loadAuthedAppState()
// offers to import it the next time a *real* signed-in session loads. This has to be a
// snapshot taken now, not a later re-read of rf:guest:library/versions, because those two
// things can diverge: signup requires email confirmation on this project, so the real sign-in
// that actually picks this up may happen in a whole separate visit, by which point the guest
// may have re-entered guest mode and kept editing. Deliberately not a silent auto-import on
// the other end -- see loadAuthedAppState()'s own comment for why.
async function exitGuestMode(){
  if(guestHasContent()){
    const payload = await buildExportPayload(); // must run before DB.guestMode flips below
    localStorage.setItem('rf:guest:pendingImport', JSON.stringify(payload));
  }
  DB.guestMode = false;
  localStorage.removeItem('rf:guest:active');
  showSignedOutState(); // resets AUTH_MODE to 'signin' as a side effect -- override right after
  AUTH_MODE = 'signup'; AUTH_MESSAGE = null;
  renderAuthScreen();
}
// Offered once a real signed-in session loads and rf:guest:pendingImport is sitting there
// waiting (see exitGuestMode() above) -- deliberately a confirm, not a silent import.
// importJsonPayload() replaces this account's LIBRARY wholesale, and this account might not
// even be the fresh signup the guest data came from -- if the user instead signs into a
// different, pre-existing real account, silently overwriting its actual library with stale
// guest data would be a real, surprising data-loss bug. A one-click confirm keeps the bridge
// close to fully automatic while still requiring the user to actually mean it.
function showGuestImportPrompt(payload){
  hideGuestImportPrompt();
  const versionCount = Object.keys(payload.versions||{}).length;
  const wrap = document.createElement('div');
  wrap.id = 'guestImportDialog';
  wrap.className = 'gh-modal-overlay';
  wrap.innerHTML = `
    <div class="gh-modal-box">
      <div class="gh-modal-header"><h3>Import your guest data?</h3></div>
      <div class="gh-modal-body">
        <p>You built a library${versionCount ? ` and ${versionCount} version${versionCount===1?'':'s'}` : ''} while using ResumIT as a guest, before signing up.</p>
        <p style="color:var(--text-muted);font-size:13px;">Importing replaces this account's Library with that guest data and adds the guest versions alongside any you already have here. Your guest data stays in this browser either way.</p>
      </div>
      <div class="gh-actions">
        <button class="btn btn-brass" id="btnGuestImportConfirm">Import</button>
        <button class="btn btn-ghost" id="btnGuestImportDiscard">Discard</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  document.getElementById('btnGuestImportConfirm').addEventListener('click', async ()=>{
    const btn = document.getElementById('btnGuestImportConfirm');
    btn.disabled = true; btn.textContent = 'Importing…';
    await importJsonPayload(payload);
    localStorage.removeItem('rf:guest:pendingImport');
    hideGuestImportPrompt();
    renderDashboard();
    toast('Guest data imported');
  });
  document.getElementById('btnGuestImportDiscard').addEventListener('click', ()=>{
    localStorage.removeItem('rf:guest:pendingImport');
    hideGuestImportPrompt();
  });
}
function hideGuestImportPrompt(){
  const el = document.getElementById('guestImportDialog');
  if(el) el.remove();
}
function showSignedOutState(){
  LIBRARY = null; CURRENT_VERSION = null; VERSIONS_INDEX = []; VERSION_REVISIONS = {}; GITHUB_CONFIG = null;
  PREFERENCES = null;
  COVER_LETTER = null; // ephemeral, session-only -- never leaves it around for the next sign-in
  clearLibraryHistory(); clearVersionHistory();
  syncConflict = null;
  SAVE_STATUS = { library:'saved', version:'saved' };
  ENTRY_EDIT_MODAL = null; renderEntryEditModal();
  AUTH_MODE = 'signin'; AUTH_MESSAGE = null;
  document.getElementById('topbarAuthedControls').style.display = 'none';
  renderAuthScreen();
}
async function init(){
  await window.__sbReady;

  document.getElementById('viewAuth').addEventListener('click', onAuthClick);
  document.getElementById('conflictBannerWrap').addEventListener('click', ev=>{
    const btn = ev.target.closest('button[data-action]'); if(!btn) return;
    resolveConflict(btn.dataset.action);
  });
  document.querySelectorAll('.nav button').forEach(b=> b.addEventListener('click', ()=> switchView(b.dataset.view)));
  document.getElementById('libTabs').addEventListener('click', ev=>{ const b=ev.target.closest('button[data-kind]'); if(!b) return; LIB_TAB=b.dataset.kind; KV.set('rf:ui:lastLibTab', LIB_TAB); renderLibrary(); });
  document.getElementById('viewPreferences').addEventListener('input', onPreferencesEvent);
  document.getElementById('viewPreferences').addEventListener('change', onPreferencesEvent);
  document.getElementById('viewPreferences').addEventListener('click', onPreferencesClick);
  document.getElementById('viewCoverLetter').addEventListener('input', onCoverLetterEvent);
  document.getElementById('viewCoverLetter').addEventListener('click', onCoverLetterClick);
  document.getElementById('searchInput').addEventListener('input', renderDashboard);
  document.getElementById('sortSelect').addEventListener('change', renderDashboard);
  document.getElementById('btnGhOpen').addEventListener('click', ()=>{ closeSettingsMenu(); ghPanelOpen=!ghPanelOpen; renderGhPanel(); });
  document.getElementById('btnExportJson').addEventListener('click', exportAllJson);
  document.getElementById('btnImportJson').addEventListener('click', ()=> document.getElementById('importFileInput').click());
  document.getElementById('importFileInput').addEventListener('change', onImportFile);
  document.getElementById('btnSignOut').addEventListener('click', ()=>{ if(DB.guestMode) exitGuestMode(); else signOut(); });
  document.getElementById('btnGuestSignUp').addEventListener('click', exitGuestMode);
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
  document.addEventListener('click', (ev)=>{
    const wrap = document.querySelector('.settings-menu-wrap');
    if(wrap && !wrap.contains(ev.target)) closeSettingsMenu();
  });
  document.getElementById('btnMobileMenu').innerHTML = ICONS.menu;
  document.getElementById('btnMobileMenu').addEventListener('click', (ev)=>{
    ev.stopPropagation();
    document.getElementById('topbarAuthedControls').classList.toggle('mobile-open');
  });
  document.addEventListener('click', (ev)=>{
    const panel = document.getElementById('topbarAuthedControls');
    if(panel.classList.contains('mobile-open') && !panel.contains(ev.target) && ev.target.id!=='btnMobileMenu') closeMobileMenu();
  });
  window.addEventListener('beforeunload', onBeforeUnload);
  document.getElementById('versionCards').addEventListener('click', onDashboardCardClick);
  document.getElementById('libPanels').addEventListener('input', onLibraryInput);
  document.getElementById('libPanels').addEventListener('click', onLibraryClick);
  document.getElementById('edPanel').addEventListener('input', onEditorEvent);
  document.getElementById('edPanel').addEventListener('change', onEditorEvent);
  document.getElementById('edPanel').addEventListener('click', onEditorClick);
  document.getElementById('btnBackDash').addEventListener('click', ()=> switchView('dashboard'));
  document.getElementById('btnDownloadPdf').addEventListener('click', downloadPdf);
  document.getElementById('btnDownloadDocx').addEventListener('click', downloadDocx);
  document.getElementById('btnThemeToggle').addEventListener('click', ()=> setTheme(THEME==='dark' ? 'light' : 'dark'));
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
    if(VIEW!=='editor' && VIEW!=='library') return;
    ev.preventDefault();
    if(VIEW==='library'){ if(ev.shiftKey) redoLibrary(); else undoLibrary(); }
    else { if(ev.shiftKey) redoVersion(); else undoVersion(); }
  });

  // A real, reported bug: supabase-js's autoRefreshToken ties its refresh check to tab
  // visibility -- switching away to a different browser tab and back (after long enough for
  // the token to need refreshing) fires a 'TOKEN_REFRESHED' event here, same as 'SIGNED_IN'/
  // 'SIGNED_OUT'/etc all coming through this one callback. The old code treated *any* event
  // with a session as "reload everything" (loadAuthedAppState(), which nulls CURRENT_VERSION
  // and re-derives VIEW from KV's lastVersionId) -- so simply switching tabs and back could
  // silently kick the editor (or Cover Letter, or Library) back to the dashboard mid-session.
  // DB.* (js/01b_data.js) always reads a fresh session via getSession() at call time -- this
  // app has no state that actually depends on reacting to a token refresh, so the fix is to
  // just not react to it: only 'SIGNED_IN' (a genuine new interactive sign-in) reloads state.
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
      // Defensive, not expected in the normal flow (exitGuestMode() already clears guestMode
      // before the sign-in/sign-up form is even reachable) -- but a real sign-in should never
      // leave DB pointed at localStorage regardless of how it was reached.
      DB.guestMode = false; localStorage.removeItem('rf:guest:active');
      clearLibraryHistory(); clearVersionHistory(); loadAuthedAppState();
    }
  });

  const { data: { session } } = await window.supabase.auth.getSession();
  if(session) await loadAuthedAppState();
  // A real session always wins over a stale guest flag (matches the SIGNED_IN handler above
  // clearing it) -- otherwise, a guest session survives an ordinary page reload the same way
  // a real sign-in does, rather than dropping them back on the auth screen mid-edit.
  else if(localStorage.getItem('rf:guest:active')==='1') await enterGuestMode();
  else showSignedOutState();
}
init();
