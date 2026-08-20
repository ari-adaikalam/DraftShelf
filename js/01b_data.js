/* ===== DB: the only place app code talks to Supabase tables/RPCs =====
   Every write takes an expectedRevision and does the conditional
   `.eq('revision', expectedRevision)` update from the plan's requirement 2 -- zero rows
   affected means someone else (another tab/device) saved first, surfaced as {conflict:true}
   rather than silently overwritten. DB.listVersions() maps column names to the exact
   shape renderDashboard() already consumes, so that function needs zero changes.

   Guest mode (a localStorage-only, no-account way to try the app) existed here previously and
   was removed on request -- signing up is required to use the app now, no exceptions. If it's
   ever reconsidered, look at git history for enterGuestMode()/exitGuestMode() and this file's
   own DB.guestMode branches (every function below used to fork at the top between this
   browser's localStorage and Supabase). */
var DB = {
  async _userId(){
    const { data: { session } } = await window.supabase.auth.getSession();
    return session ? session.user.id : null;
  },

  async getLibrary(){
    const userId = await DB._userId();
    if(!userId) return null;
    const { data, error } = await window.supabase.from('library').select('*').eq('user_id', userId).maybeSingle();
    if(error){ console.error('getLibrary failed:', error); return null; }
    if(!data){
      // First login: accounts always start empty (no auto-import of pre-existing local data).
      const fresh = emptyLibrary();
      const { data: created, error: insErr } = await window.supabase.from('library')
        .insert({ user_id: userId, data: fresh }).select().single();
      if(insErr){ console.error('creating initial library row failed:', insErr); return null; }
      return { data: created.data, revision: created.revision };
    }
    return { data: data.data, revision: data.revision };
  },

  async saveLibrary(data, expectedRevision){
    const userId = await DB._userId();
    if(!userId) return { ok:false, error:'not signed in' };
    const { data: rows, error } = await window.supabase.from('library')
      .update({ data, revision: expectedRevision+1, updated_at: new Date().toISOString() })
      .eq('user_id', userId).eq('revision', expectedRevision)
      .select();
    if(error) return { ok:false, error: error.message };
    if(!rows || rows.length===0){
      const { data: serverRow } = await window.supabase.from('library').select('*').eq('user_id', userId).maybeSingle();
      return { ok:false, conflict:true, serverRow };
    }
    return { ok:true, revision: rows[0].revision };
  },

  async listVersions(){
    const userId = await DB._userId();
    if(!userId) return [];
    const { data, error } = await window.supabase.from('resume_versions')
      .select('id,name,target_company,target_role,date_applied,is_main,page_count,revision,updated_at,is_standalone')
      .eq('user_id', userId).is('deleted_at', null)
      .order('updated_at', { ascending:false });
    if(error){ console.error('listVersions failed:', error); return []; }
    return data.map(r=>({
      id:r.id, name:r.name, main:r.is_main, updatedAt:new Date(r.updated_at).getTime(),
      company:r.target_company, role:r.target_role, dateApplied:r.date_applied,
      pageCount:r.page_count, revision:r.revision, standalone:!!r.is_standalone
    }));
  },

  // The Trash panel's own listing -- the exact inverse filter of listVersions() above, plus
  // deleted_at itself (for the "deleted 3 days ago" label) and ordered by *that* column, not
  // updated_at, since "most recently trashed" is what a trash view should surface first.
  async listTrashedVersions(){
    const userId = await DB._userId();
    if(!userId) return [];
    const { data, error } = await window.supabase.from('resume_versions')
      .select('id,name,target_company,target_role,date_applied,is_main,page_count,revision,updated_at,is_standalone,deleted_at')
      .eq('user_id', userId).not('deleted_at', 'is', null)
      .order('deleted_at', { ascending:false });
    if(error){ console.error('listTrashedVersions failed:', error); return []; }
    return data.map(r=>({
      id:r.id, name:r.name, main:r.is_main, updatedAt:new Date(r.updated_at).getTime(),
      company:r.target_company, role:r.target_role, dateApplied:r.date_applied,
      pageCount:r.page_count, revision:r.revision, standalone:!!r.is_standalone,
      deletedAt:new Date(r.deleted_at).getTime()
    }));
  },

  // Powers the Library tab's "used in N versions" warnings (buildUsageIndex(), js/03_model.js)
  // -- the one place this app needs to know every version's *selection*, not just the
  // lightweight Dashboard-listing columns listVersions() above selects. One query for every
  // non-deleted version's full data (a real cost for an account with a lot of versions, but
  // still one round trip, not N) -- only ever called when the Library tab is opened, never on
  // every keystroke.
  async listVersionSelections(){
    const userId = await DB._userId();
    if(!userId) return [];
    const { data, error } = await window.supabase.from('resume_versions')
      .select('id,name,data')
      .eq('user_id', userId).is('deleted_at', null);
    if(error){ console.error('listVersionSelections failed:', error); return []; }
    return data.map(r=>({ id:r.id, name:r.name, selection: r.data && r.data.selection }));
  },

  async getVersion(id){
    const userId = await DB._userId();
    if(!userId) return null;
    const { data, error } = await window.supabase.from('resume_versions').select('*').eq('id', id).eq('user_id', userId).maybeSingle();
    if(error || !data) return null;
    return { data: data.data, revision: data.revision };
  },

  // is_standalone is only ever written here, at creation -- unlike is_main/page_count (which
  // genuinely change over a version's life and so saveVersion() below re-derives them on every
  // save), a version's standalone-ness is fixed for good the moment it's created
  // (buildStandaloneVersion() in js/03_model.js is the only place that ever sets
  // versionObj.standalone=true) and nothing in the app ever flips it either way afterward.
  async createVersion(versionObj){
    const userId = await DB._userId();
    if(!userId) return null;
    const row = {
      id: versionObj.id, user_id: userId, name: versionObj.name||'New version',
      target_company: versionObj.jobMeta.company||'', target_role: versionObj.jobMeta.role||'',
      date_applied: versionObj.jobMeta.dateApplied||'', is_main: !!versionObj.main,
      page_count: versionObj.pageCount||1, is_standalone: !!versionObj.standalone, data: versionObj
    };
    const { data, error } = await window.supabase.from('resume_versions').insert(row).select().single();
    if(error){ console.error('createVersion failed:', error); return null; }
    return { data: data.data, revision: data.revision };
  },

  async saveVersion(id, data, expectedRevision){
    const userId = await DB._userId();
    if(!userId) return { ok:false, error:'not signed in' };
    const { data: rows, error } = await window.supabase.from('resume_versions')
      .update({
        data, revision: expectedRevision+1, updated_at: new Date().toISOString(),
        name: data.name||'New version', target_company: data.jobMeta.company||'',
        target_role: data.jobMeta.role||'', date_applied: data.jobMeta.dateApplied||'',
        is_main: !!data.main, page_count: data.pageCount||1
      })
      .eq('id', id).eq('user_id', userId).eq('revision', expectedRevision)
      .select();
    if(error) return { ok:false, error: error.message };
    if(!rows || rows.length===0){
      const { data: serverRow } = await window.supabase.from('resume_versions').select('*').eq('id', id).eq('user_id', userId).maybeSingle();
      return { ok:false, conflict:true, serverRow };
    }
    return { ok:true, revision: rows[0].revision };
  },

  // Soft delete, on request ("if i accidentally delete a version, I can't get that back") --
  // sets deleted_at instead of removing the row, so restoreVersion() below can bring it back.
  // The function name/call sites (deleteVersionConfirmed(), js/06_app.js) are unchanged; only
  // the underlying behavior is. See purgeVersion() for the real, irreversible delete.
  async deleteVersion(id){
    const userId = await DB._userId();
    if(!userId) return false;
    const { error } = await window.supabase.from('resume_versions')
      .update({ deleted_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId);
    return !error;
  },

  async restoreVersion(id){
    const userId = await DB._userId();
    if(!userId) return false;
    const { error } = await window.supabase.from('resume_versions')
      .update({ deleted_at: null }).eq('id', id).eq('user_id', userId);
    return !error;
  },

  // The real, irreversible delete -- only reachable from the Trash panel's own "Delete
  // forever" action, never from the Dashboard's normal delete flow.
  async purgeVersion(id){
    const userId = await DB._userId();
    if(!userId) return false;
    const { error } = await window.supabase.from('resume_versions').delete().eq('id', id).eq('user_id', userId);
    return !error;
  },

  async getPreferences(){
    const userId = await DB._userId();
    if(!userId) return null;
    const { data, error } = await window.supabase.from('user_preferences').select('*').eq('user_id', userId).maybeSingle();
    if(error) return null;
    if(!data){
      const defaults = { user_id:userId, default_page_size:'A4', default_references_mode:'full' };
      const { data: created } = await window.supabase.from('user_preferences').insert(defaults).select().single();
      return created;
    }
    return data;
  },

  async savePreferences(fields){
    const userId = await DB._userId();
    if(!userId) return { ok:false };
    const { error } = await window.supabase.from('user_preferences')
      .update({ ...fields, updated_at: new Date().toISOString() }).eq('user_id', userId);
    return { ok: !error };
  },

  async getGithubConfig(){
    const userId = await DB._userId();
    if(!userId) return null;
    const { data, error } = await window.supabase.from('github_config').select('*').eq('user_id', userId).maybeSingle();
    if(error) return null;
    return data;
  },

  async callBackupFunction(action, args){
    const { data: { session } } = await window.supabase.auth.getSession();
    if(!session) return { ok:false, error:'not signed in' };
    try{
      const res = await fetch(window.supabase.supabaseUrl+'/functions/v1/github-backup', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+session.access_token },
        body: JSON.stringify({ action, ...args })
      });
      return await res.json();
    }catch(e){
      return { ok:false, error:'Network error contacting backup function' };
    }
  },

  // ===== Personal API keys (MCP integration) — see
  // docs/superpowers/plans/2026-08-19-mcp-ai-integration.md's own Task 2. The raw key is
  // generated and hashed entirely client-side (crypto.getRandomValues + SHA-256) before ever
  // leaving the browser — only the hash is ever sent to Supabase, so even a compromised network
  // log between browser and Supabase never exposes the raw key. This is the one and only place
  // the raw key is ever available; the Settings panel that calls this must show it exactly once
  // and never persist it anywhere itself.
  async generateApiKey(label){
    const userId = await DB._userId();
    if(!userId) return { ok:false, error:'not signed in' };
    const raw = 'dsk_' + Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map(b => b.toString(16).padStart(2,'0')).join('');
    const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
    const hash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2,'0')).join('');
    // id generated client-side (uid(), js/01_core.js) rather than left to the database's own
    // default -- same established convention DB.createVersion() already follows, for the same
    // reason: the value is needed back immediately (to return via {ok:true, id}) without
    // depending on a round-trip echoing a server-generated default correctly.
    const id = uid();
    const { data, error } = await window.supabase.from('api_keys')
      .insert({ id, user_id: userId, key_hash: hash, label: label || 'MCP key' })
      .select().single();
    if(error) return { ok:false, error: error.message };
    return { ok:true, rawKey: raw, id: data.id };
  },

  async listApiKeys(){
    const userId = await DB._userId();
    if(!userId) return { ok:false, error:'not signed in' };
    const { data, error } = await window.supabase.from('api_keys')
      .select('id,label,created_at,last_used_at')
      .eq('user_id', userId).is('revoked_at', null).order('created_at', { ascending:false });
    if(error) return { ok:false, error: error.message };
    return { ok:true, keys: data.map(r => ({ id:r.id, label:r.label, createdAt:r.created_at, lastUsedAt:r.last_used_at })) };
  },

  async revokeApiKey(id){
    const userId = await DB._userId();
    if(!userId) return { ok:false, error:'not signed in' };
    const { error } = await window.supabase.from('api_keys')
      .update({ revoked_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId);
    return error ? { ok:false, error: error.message } : { ok:true };
  },

  // ===== Connected Apps (remote MCP / OAuth) -- claude.ai/ChatGPT connectors, see Task 15 of
  // the same plan. Mirrors listApiKeys/revokeApiKey exactly (same row shape, same revoke-not-
  // delete posture -- oauth_tokens has no DELETE RLS policy at all, same least-privilege reasoning
  // api_keys already has) -- the two lists sit side by side in the Settings UI because they're
  // both "ways an AI can act on your account." There's no generateConnectedApp() counterpart:
  // a row here only ever exists because someone completed a real OAuth consent flow from
  // claude.ai/ChatGPT itself (mcp-remote-auth's own /authorize+/token), never something created
  // from inside DraftShelf directly.
  async listConnectedApps(){
    const userId = await DB._userId();
    if(!userId) return { ok:false, error:'not signed in' };
    const { data, error } = await window.supabase.from('oauth_tokens')
      .select('id,label,created_at,last_used_at,access_token_expires_at')
      .eq('user_id', userId).is('revoked_at', null).order('created_at', { ascending:false });
    if(error) return { ok:false, error: error.message };
    return { ok:true, apps: data.map(r => ({ id:r.id, label:r.label, createdAt:r.created_at, lastUsedAt:r.last_used_at, accessTokenExpiresAt:r.access_token_expires_at })) };
  },

  async revokeConnectedApp(id){
    const userId = await DB._userId();
    if(!userId) return { ok:false, error:'not signed in' };
    const { error } = await window.supabase.from('oauth_tokens')
      .update({ revoked_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId);
    return error ? { ok:false, error: error.message } : { ok:true };
  },

  // Write-only client error monitoring (see supabase/migrations/20260810090000_client_errors.sql
  // for the table/RLS this writes into, and installClientErrorMonitoring() in js/06_app.js for
  // what actually captures errors and calls this). Deliberately doesn't go through DB._userId()
  // the way every other method here does -- an error can happen before sign-in (e.g. the CDN-load
  // failure handleBootFailure() exists for), and DB._userId() itself calls
  // window.supabase.auth.getSession(), which can throw if window.supabase never finished loading
  // in the first place. Reads the session directly and tolerates it failing -- a failure to log
  // an error should never itself throw and mask the original error.
  async logClientError(errorData){
    try{
      let userId = null;
      try{
        const { data:{ session } } = await window.supabase.auth.getSession();
        userId = session ? session.user.id : null;
      }catch(e){ /* window.supabase not ready yet -- log with no user_id rather than give up */ }
      await window.supabase.from('client_errors').insert({
        user_id: userId,
        message: errorData.message,
        stack: errorData.stack || null,
        view: errorData.view || null,
        url: errorData.url || null,
        user_agent: errorData.userAgent || null,
      });
    }catch(e){
      // Never let a failure to log an error surface as a second error -- console.error only,
      // same as every other best-effort/fire-and-forget call in this app (warmPdfServices(),
      // etc).
      console.error('logClientError failed:', e);
    }
  }
};

if(typeof module !== 'undefined') module.exports = { DB };
