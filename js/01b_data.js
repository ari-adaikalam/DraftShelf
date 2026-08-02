/* ===== DB: the only place app code talks to Supabase tables/RPCs =====
   Every write takes an expectedRevision and does the conditional
   `.eq('revision', expectedRevision)` update from the plan's requirement 2 -- zero rows
   affected means someone else (another tab/device) saved first, surfaced as {conflict:true}
   rather than silently overwritten. DB.listVersions() maps column names to the exact
   shape renderDashboard() already consumes, so that function needs zero changes. */
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
    const userId = await DB._userId();
    if(!userId) return null;
    const { data, error } = await window.supabase.from('resume_versions').select('*').eq('id', id).eq('user_id', userId).maybeSingle();
    if(error || !data) return null;
    return { data: data.data, revision: data.revision };
  },

  async createVersion(versionObj){
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
  }
};

if(typeof module !== 'undefined') module.exports = { DB };
