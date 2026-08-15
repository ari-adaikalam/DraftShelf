/* ===== utils ===== */
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7);}
function esc(s){return (s==null?'':String(s)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function getPath(obj,path){return path.split('.').reduce((o,k)=>(o==null?undefined:o[k]),obj);}
function setPath(obj,path,val){
  const keys=path.split('.');
  let o=obj;
  for(let i=0;i<keys.length-1;i++){ if(o[keys[i]]==null) o[keys[i]]={}; o=o[keys[i]]; }
  o[keys[keys.length-1]]=val;
}
function normalizeUrl(u){if(!u)return '';return /^https?:\/\//i.test(u)?u:'https://'+u;}
// Em dashes are never allowed to reach saved data (nor, by extension, the live preview or any
// export -- both render straight from saved LIBRARY/Version data, so scrubbing at the input
// layer covers them for free). A hyphen is the replacement, chosen once and used everywhere --
// not per-occurrence -- since it's the standard ASCII fallback and keeps the same "break" role
// an em dash plays in a sentence, unlike a comma which can change what the sentence means.
// Wired in globally via a capture-phase 'input' listener (see init() in js/06_app.js) so it
// catches typed and pasted em dashes across every text field in the app from one place, rather
// than patching each view's own input handler individually.
function stripEmDash(s){ return s==null ? s : String(s).replace(/—/g,'-'); }
// A real, reported bug: onImportFile() (js/06_app.js) treated *any* valid JSON with no
// top-level `library` key as the "no library in file, just versions" edge case and ran
// runReplaceEverythingImport() unconditionally -- a totally unrelated JSON file (no `library`,
// no `versions` either) fell all the way through importJsonPayload() doing nothing at all
// (both its `if(payload.library)`/`if(payload.versions)` guards are false), yet still landed on
// the unconditional "Import complete" toast at the end -- a false success with nothing actually
// imported and no error to explain why. This is the one shared validation gate: a payload only
// counts as importable if it has a real `library` object, or a real, non-empty `versions`
// object -- the two shapes a genuine ResumIT export (or a legitimately hand-crafted
// versions-only file) can have. Anything else is rejected before any import path runs at all.
function looksLikeResumitExport(payload){
  if(!payload || typeof payload!=='object' || Array.isArray(payload)) return false;
  const isPlainObject = v => v && typeof v==='object' && !Array.isArray(v);
  const hasLibrary = isPlainObject(payload.library);
  const hasVersions = isPlainObject(payload.versions) && Object.keys(payload.versions).length>0;
  return !!(hasLibrary || hasVersions);
}
// Heuristic for "this looks like a placeholder label, not a real URL" -- used only by the
// JSON import flow's link-prompt (see showImportLinkPrompt() in js/06_app.js) to catch a
// hand-built import file whose linkedin/github/portfolio field is just the display label
// ("LinkedIn") rather than an actual link. Every real domain/URL contains at least one '.'
// ("linkedin.com/in/x", "https://..."); common placeholder text ("LinkedIn", "N/A", "See
// resume") doesn't, so a missing '.' is a simple, low-false-positive signal.
function isLikelyLabelNotUrl(v){
  return typeof v==='string' && v.trim()!=='' && v.indexOf('.')===-1;
}
function clamp(n,min,max){ n=parseFloat(n); if(isNaN(n)) n=min; return Math.min(max,Math.max(min,n)); }
function debounce(fn,ms){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; }
function hasMetric(text){ return /\d/.test(text||''); }
function parseInlineBold(text){
  const s = text==null ? '' : String(text);
  const segments = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0, m;
  while((m = re.exec(s))){
    if(m.index > last) segments.push({ text: s.slice(last, m.index), bold:false });
    segments.push({ text: m[1], bold:true });
    last = re.lastIndex;
  }
  if(last < s.length) segments.push({ text: s.slice(last), bold:false });
  if(!segments.length) segments.push({ text:'', bold:false });
  return segments;
}
function b64EncodeUnicode(str){
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (m,p1)=>String.fromCharCode('0x'+p1)));
}
function b64DecodeUnicode(str){
  return decodeURIComponent(atob(str).split('').map(c=>'%'+('00'+c.charCodeAt(0).toString(16)).slice(-2)).join(''));
}

/* ===== portable storage: browser localStorage only, for device-local UI state
   (theme, last-opened version id, last-opened library tab, collapsed panel states --
   see the multi-user migration plan's account-vs-device preference split). Library/
   Version/preferences/GitHub-config data all go through DB (js/01b_data.js) instead,
   backed by Supabase. GitHub sync used to be a direct browser-to-GitHub client here
   (`GH`) using a locally-stored PAT; that's now proxied through the github-backup
   Edge Function so the PAT never reaches the browser after initial setup -- see
   DB.callBackupFunction() and supabase/functions/github-backup/index.ts. Claude.ai
   artifact-preview support (`window.storage`) was also removed here: this app is no
   longer runnable inside a Claude.ai artifact preview now that Supabase auth is
   mandatory. */
var KV = {
  mode: 'local',
  async get(key){
    try{ const v = window.localStorage.getItem(key); return v ? JSON.parse(v) : null; }
    catch(e){ return null; }
  },
  async set(key,val){
    try{ window.localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch(e){ return false; }
  },
  async delete(key){
    try{ window.localStorage.removeItem(key); }catch(e){}
  }
};

if(typeof module !== 'undefined') module.exports = { uid, esc, getPath, setPath, normalizeUrl, isLikelyLabelNotUrl, stripEmDash, looksLikeResumitExport, clamp, debounce, hasMetric, parseInlineBold, b64EncodeUnicode, b64DecodeUnicode, KV };
