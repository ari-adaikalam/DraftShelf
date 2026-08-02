/* ===== DB: the only place app code talks to Supabase tables/RPCs (or, in guest mode, this
   browser's own localStorage as a stand-in) =====
   Every write takes an expectedRevision and does the conditional
   `.eq('revision', expectedRevision)` update from the plan's requirement 2 -- zero rows
   affected means someone else (another tab/device) saved first, surfaced as {conflict:true}
   rather than silently overwritten. DB.listVersions() maps column names to the exact
   shape renderDashboard() already consumes, so that function needs zero changes.

   Guest mode (DB.guestMode, toggled by js/06_app.js's enterGuestMode()/exitGuestMode()) --
   added on request, so someone can try the app without signing up first. Every function
   below branches at the top: guest mode reads/writes this browser's localStorage instead of
   Supabase, returning the *exact same shapes* real callers already expect, so nothing else
   in the app (06_app.js's rendering, the conflict-banner UI, etc.) needs to know or care
   which mode is active. There's no real conflict risk in guest mode (nothing else writes to
   this browser's localStorage concurrently in any way this app needs to defend against), but
   saveLibrary()/saveVersion() still honor expectedRevision and return the same
   {conflict:true, serverRow} shape on a mismatch, since 06_app.js's own optimistic-
   concurrency bookkeeping (LIBRARY_REVISION/VERSION_REVISIONS) expects a real revision
   number back either way -- keeping this consistent means zero special-casing anywhere else.
   GitHub backup (getGithubConfig/callBackupFunction) and PDF export have no guest
   equivalent -- both need a real account server-side -- callers check DB.guestMode
   themselves before offering those (see the settings menu and downloadPdf() in 06_app.js). */
var DB = {
  guestMode: false,

  _guestRead(key, fallback){
    try{ const raw = localStorage.getItem(key); return raw==null ? fallback : JSON.parse(raw); }
    catch(e){ return fallback; }
  },
  _guestWrite(key, value){
    try{ localStorage.setItem(key, JSON.stringify(value)); }
    catch(e){ /* storage full/unavailable -- silently no-op, same tolerance KV already has */ }
  },

  async _userId(){
    const { data: { session } } = await window.supabase.auth.getSession();
    return session ? session.user.id : null;
  },

  async getLibrary(){
    if(DB.guestMode){
      let row = DB._guestRead('rf:guest:library', null);
      if(!row){ row = { data: emptyLibrary(), revision: 1 }; DB._guestWrite('rf:guest:library', row); }
      return { data: row.data, revision: row.revision };
    }
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
    if(DB.guestMode){
      const row = DB._guestRead('rf:guest:library', { data: emptyLibrary(), revision: 0 });
      if(row.revision !== expectedRevision) return { ok:false, conflict:true, serverRow: row };
      const next = { data, revision: expectedRevision+1 };
      DB._guestWrite('rf:guest:library', next);
      return { ok:true, revision: next.revision };
    }
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
    if(DB.guestMode){
      const rows = DB._guestRead('rf:guest:versions', []);
      return rows.slice().sort((a,b)=> new Date(b.updated_at) - new Date(a.updated_at)).map(r=>({
        id:r.id, name:r.name, main:r.is_main, updatedAt:new Date(r.updated_at).getTime(),
        company:r.target_company, role:r.target_role, dateApplied:r.date_applied,
        pageCount:r.page_count, revision:r.revision
      }));
    }
    const userId = await DB._userId();
    if(!userId) return [];
    const { data, error } = await window.supabase.from('resume_versions')
      .select('id,name,target_company,target_role,date_applied,is_main,page_count,revision,updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending:false });
    if(error){ console.error('listVersions failed:', error); return []; }
    return data.map(r=>({
      id:r.id, name:r.name, main:r.is_main, updatedAt:new Date(r.updated_at).getTime(),
      company:r.target_company, role:r.target_role, dateApplied:r.date_applied,
      pageCount:r.page_count, revision:r.revision
    }));
  },

  async getVersion(id){
    if(DB.guestMode){
      const row = DB._guestRead('rf:guest:versions', []).find(r=>r.id===id);
      return row ? { data: row.data, revision: row.revision } : null;
    }
    const userId = await DB._userId();
    if(!userId) return null;
    const { data, error } = await window.supabase.from('resume_versions').select('*').eq('id', id).eq('user_id', userId).maybeSingle();
    if(error || !data) return null;
    return { data: data.data, revision: data.revision };
  },

  async createVersion(versionObj){
    if(DB.guestMode){
      const rows = DB._guestRead('rf:guest:versions', []);
      const row = {
        id: versionObj.id, name: versionObj.name||'New version',
        target_company: versionObj.jobMeta.company||'', target_role: versionObj.jobMeta.role||'',
        date_applied: versionObj.jobMeta.dateApplied||'', is_main: !!versionObj.main,
        page_count: versionObj.pageCount||1, revision: 1, updated_at: new Date().toISOString(),
        data: versionObj
      };
      rows.push(row);
      DB._guestWrite('rf:guest:versions', rows);
      return { data: row.data, revision: row.revision };
    }
    const userId = await DB._userId();
    if(!userId) return null;
    const row = {
      id: versionObj.id, user_id: userId, name: versionObj.name||'New version',
      target_company: versionObj.jobMeta.company||'', target_role: versionObj.jobMeta.role||'',
      date_applied: versionObj.jobMeta.dateApplied||'', is_main: !!versionObj.main,
      page_count: versionObj.pageCount||1, data: versionObj
    };
    const { data, error } = await window.supabase.from('resume_versions').insert(row).select().single();
    if(error){ console.error('createVersion failed:', error); return null; }
    return { data: data.data, revision: data.revision };
  },

  async saveVersion(id, data, expectedRevision){
    if(DB.guestMode){
      const rows = DB._guestRead('rf:guest:versions', []);
      const idx = rows.findIndex(r=>r.id===id);
      if(idx<0) return { ok:false, error:'version not found' };
      if(rows[idx].revision !== expectedRevision) return { ok:false, conflict:true, serverRow: rows[idx] };
      const updated = {
        ...rows[idx], data, revision: expectedRevision+1, updated_at: new Date().toISOString(),
        name: data.name||'New version', target_company: data.jobMeta.company||'',
        target_role: data.jobMeta.role||'', date_applied: data.jobMeta.dateApplied||'',
        is_main: !!data.main, page_count: data.pageCount||1
      };
      rows[idx] = updated;
      DB._guestWrite('rf:guest:versions', rows);
      return { ok:true, revision: updated.revision };
    }
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

  async deleteVersion(id){
    if(DB.guestMode){
      DB._guestWrite('rf:guest:versions', DB._guestRead('rf:guest:versions', []).filter(r=>r.id!==id));
      return true;
    }
    const userId = await DB._userId();
    if(!userId) return false;
    const { error } = await window.supabase.from('resume_versions').delete().eq('id', id).eq('user_id', userId);
    return !error;
  },

  async getPreferences(){
    if(DB.guestMode){
      let row = DB._guestRead('rf:guest:preferences', null);
      if(!row){ row = { default_page_size:'A4', default_references_mode:'full' }; DB._guestWrite('rf:guest:preferences', row); }
      return row;
    }
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
    if(DB.guestMode){
      DB._guestWrite('rf:guest:preferences', { ...DB._guestRead('rf:guest:preferences', {}), ...fields });
      return { ok:true };
    }
    const userId = await DB._userId();
    if(!userId) return { ok:false };
    const { error } = await window.supabase.from('user_preferences')
      .update({ ...fields, updated_at: new Date().toISOString() }).eq('user_id', userId);
    return { ok: !error };
  },

  async getGithubConfig(){
    if(DB.guestMode) return null; // no guest equivalent -- GitHub backup always needs a real account
    const userId = await DB._userId();
    if(!userId) return null;
    const { data, error } = await window.supabase.from('github_config').select('*').eq('user_id', userId).maybeSingle();
    if(error) return null;
    return data;
  },

  async callBackupFunction(action, args){
    if(DB.guestMode) return { ok:false, error:'Sign up for a free account to enable GitHub backup.' };
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
  }
};

if(typeof module !== 'undefined') module.exports = { DB };
