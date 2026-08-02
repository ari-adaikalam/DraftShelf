/* ===== utils ===== */
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7);}
function esc(s){return (s==null?'':String(s)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function getPath(obj,path){return path.split('.').reduce((o,k)=>(o==null?undefined:o[k]),obj);}
function setPath(obj,path,val){
  const keys=path.split('.');
  let o=obj;
  for(let i=0;i<keys.length-1;i++){ if(o[keys[i]]==null) o[keys[i]]={}; o=o[keys[i]]; }
  o[keys[keys.length-1]]=val;
}
function normalizeUrl(u){if(!u)return '';return /^https?:\/\//i.test(u)?u:'https://'+u;}
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

if(typeof module !== 'undefined') module.exports = { uid, esc, getPath, setPath, normalizeUrl, clamp, debounce, hasMetric, parseInlineBold, b64EncodeUnicode, b64DecodeUnicode, KV };
