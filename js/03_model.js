function emptyLibrary(){
  return {
    meta:{name:'',phone:'',email:'',location:'',linkedin:'',github:'',portfolio:''},
    experience:[], projects:[], education:[], skills:[], summaries:[], references:[], customSections:[],
    // Named, reusable bundles of the skills categories above -- see resolveVersion()'s
    // skillGroupId branch below. Absent on any library saved before this feature; every
    // read site treats that the same as an empty array, no migration needed.
    skillGroups:[],
    // Customizable pool of tag options ({id,label}), shared by bullet tags and skill-category
    // tags -- referenced by id from those items' own tags[] arrays, the same "edit once,
    // referenced everywhere" pattern skillGroups/categoryIds already uses. Absent on any
    // library saved before this feature; migrateTagOptions() below builds it from existing
    // free-text tag values the first time such a library loads.
    tagOptions:[]
  };
}

function defaultStyle(){
  return {
    fontFamily:'"Times New Roman", Times, serif',
    fsName:16, fsContact:10.5, fsHeading:11, fsBody:10.5,
    lineHeight:1.2,
    gapBullet:2, gapEntry:8, gapSection:10, headingGapAbove:8, headingGapBelow:4,
    headingAlign:'left', headingUnderline:true, headingUnderlineThickness:1, headingUppercase:true,
    bodyAlign:'justify',
    bulletMarker:'\u2022',
    marginTop:0.5, marginRight:0.5, marginBottom:0.5, marginLeft:0.5,
    // `dates` was a real, reported dead toggle -- bd()/buildDocxDocument()'s own bd() (both
    // js/06_app.js) never call it with 'dates' as the flag key anywhere, so checking it never
    // had any visible effect on the live preview, PDF, or DOCX export. Removed from new style
    // objects here; stylePanelHtml() (js/06_app.js) also filters any pre-existing 'dates' key
    // out of the Bold fields checklist so an already-saved version/preference that still has
    // it in its data (harmless, still unused) doesn't show a checkbox for it either.
    bold:{ company:true, role:true, project:true, university:true, skillsLabel:true, referenceName:true }
  };
}

// Calibri was never part of Microsoft's freely-licensed "Core Fonts for the Web" package
// (unlike Times New Roman/Arial/Georgia, which the server installs as real system fonts --
// see pdf-service/Dockerfile) and isn't even on Mac by default without Office installed.
// Carlito is the standard metric-compatible substitute. Versions saved before this change
// still carry the raw `'"Calibri", sans-serif'` string in their data -- this normalizes it
// at render time everywhere style.fontFamily is read, so old versions render correctly
// (and match the server-rendered PDF export) with no data migration needed. Times New
// Roman/Arial/Georgia need no remapping -- both client and server render those for real.
function normalizeFontFamily(raw){
  if(typeof raw==='string' && raw.indexOf('Calibri')!==-1) return '"Carlito", sans-serif';
  return raw;
}

const BUILTIN_SECTION_ORDER = ['experience','projects','education','skills','references'];

function blankVersion(name){
  return {
    id: uid(), name: name||'New version', main:false, createdAt:Date.now(), updatedAt:Date.now(),
    jobMeta:{company:'',role:'',dateApplied:'',jdText:'',jdLink:''},
    style: defaultStyle(),
    pageSize:'A4',
    referencesMode:'full',
    sectionOrder: BUILTIN_SECTION_ORDER.slice(),
    // Per-version overrides for the 5 built-in section headings, editable same as
    // selection.summaryHeading already is. describeSection() in 06_app.js falls back to
    // these exact default strings when a field is unset/empty -- older saved versions
    // (no sectionHeadings object at all) render identically, no migration needed.
    sectionHeadings:{experience:'Work Experience', projects:'Projects', education:'Education', skills:'Skills', references:'References'},
    selection:{
      summaryId:null, customSummaryText:'', summaryHeading:'Summary',
      // null = "Custom": resolve skills from the per-category toggles below (unchanged
      // pre-existing behavior). A real skillGroups id = resolve from that set's categories
      // instead (see resolveVersion()). Mirrors summaryId/customSummaryText's own
      // "pick a saved item, or fall back to manual" pattern.
      skillGroupId:null,
      // Remembers which "Fill in with tag" pick is currently in effect, purely so the
      // dropdown can show it back after a re-render (see fillWithTagHtml()/onEditorEvent() in
      // js/06_app.js) -- '' means "Custom". Fill itself is a one-off additive action, not a
      // resolved mode: resolveVersion() never reads this field, only the checklist above does.
      lastFillTagId:'',
      experience:[], projects:[], education:[], skills:[], references:[], customSections:[]
      // each entry: {refId, bulletIds:[...]}  (bulletIds omitted for education/skills/references)
    }
  };
}

function newLibraryEntry(kind){
  const id = uid();
  switch(kind){
    case 'experience': return {id,company:'',tag:'',location:'',role:'',dates:'',bullets:[]};
    case 'projects': return {id,title:'',dates:'',bullets:[]};
    case 'education': return {id,school:'',location:'',degree:'',dates:''};
    case 'skills': return {id,label:'',text:'',tags:[]};
    // No `label` field -- replaced by the shared tags[] system on request (see
    // versionFillByTag()'s summary branch and entryCardHtml()'s summaries case in
    // js/06_app.js for how it's used); a summary is now identified for display purposes by
    // its own text (see entryLabel() in js/06_app.js), not a separate free-text name.
    case 'summaries': return {id,text:'',tags:[]};
    case 'references': return {id,name:'',title:'',contact:''};
    // subheading/dates/location mirror experience's tag/dates/location -- optional context
    // above the section's content (e.g. an issuing organization + date for a certification).
    // Library-level fields, not per-version-overridable, same as experience's own fields --
    // only `heading` gets a per-version override (see sectionHeadingFieldHtml() in
    // js/06_app.js), for consistency with how every other section type works.
    case 'customSections': return {id,heading:'',subheading:'',dates:'',location:'',contentType:'bullets',bullets:[],text:''};
    case 'skillGroups': return {id,label:'',categoryIds:[]};
    case 'tagOptions': return {id,label:''};
    default: throw new Error('unknown kind '+kind);
  }
}
function newBullet(){ return {id:uid(), text:'', tags:[]}; }

/* Reducers -- pure, return new state (shallow-mutate copies) for testability */
function libAddEntry(library, kind){
  const next = {...library, [kind]: [...(library[kind]||[]), newLibraryEntry(kind)]};
  return next;
}
function libRemoveEntry(library, kind, id){
  return {...library, [kind]: library[kind].filter(e=>e.id!==id)};
}
function libAddBullet(library, kind, entryId){
  return {...library, [kind]: library[kind].map(e=> e.id===entryId ? {...e, bullets:[...e.bullets, newBullet()]} : e)};
}
function libRemoveBullet(library, kind, entryId, bulletId){
  return {...library, [kind]: library[kind].map(e=> e.id===entryId ? {...e, bullets:e.bullets.filter(b=>b.id!==bulletId)} : e)};
}
// Generic field-level edit reducers -- added for the MCP integration's edit_entry/edit_bullet
// tools (supabase/functions/mcp-api/tools/entries.ts), which need a dedicated reducer the same
// way every other mutation here does rather than a bespoke setPath() call. The browser itself
// still edits fields via setPath() directly on LIBRARY (06_app.js's generic data-path
// mechanism) -- these aren't wired into that path, just available for it to adopt later if
// ever useful there too, matching every other reducer in this file being usable from either
// context.
function libEditEntry(library, kind, id, fields){
  return {...library, [kind]: library[kind].map(e => e.id===id ? {...e, ...fields} : e)};
}
function libEditBullet(library, kind, entryId, bulletId, fields){
  return {...library, [kind]: library[kind].map(e => e.id===entryId
    ? {...e, bullets: e.bullets.map(b => b.id===bulletId ? {...b, ...fields} : b)}
    : e)};
}

// Skill Sets -- named bundles of skills categories (LIBRARY.skillGroups), referenced by id
// from a version's selection.skillGroupId (see resolveVersion() below) rather than toggling
// individual categories per version. This is the one library kind whose "which items does
// it contain" state isn't a bullet list, so it gets its own small toggle reducer instead of
// reusing libAddBullet/libRemoveBullet.
function libToggleSkillGroupCategory(library, groupId, categoryId, included){
  const groups = (library.skillGroups||[]).map(g=>{
    if(g.id!==groupId) return g;
    const has = g.categoryIds.includes(categoryId);
    let categoryIds;
    if(included && !has) categoryIds = [...g.categoryIds, categoryId];
    else if(!included && has) categoryIds = g.categoryIds.filter(id=>id!==categoryId);
    else categoryIds = g.categoryIds;
    return {...g, categoryIds};
  });
  return {...library, skillGroups:groups};
}

// Removing a tag option is unblocked -- no "in use" warning -- and scrubs the id from every
// bullet's/skill category's own tags[] array wherever it appears, the same dangling-reference
// tolerance every other kind of Library removal already has (see resolveVersion()'s handling
// of a deleted entry, below). Doesn't reuse the generic libRemoveEntry() because that one only
// ever removes the top-level entry itself, never chases down references to it elsewhere.
function libRemoveTagOption(library, id){
  const scrub = arr => (arr||[]).filter(tagId=>tagId!==id);
  const next = { ...library, tagOptions: library.tagOptions.filter(t=>t.id!==id) };
  ['experience','projects','customSections'].forEach(kind=>{
    next[kind] = (library[kind]||[]).map(e=> e.bullets ? {...e, bullets: e.bullets.map(b=>({...b, tags:scrub(b.tags)}))} : e);
  });
  next.skills = (library.skills||[]).map(s=>({...s, tags:scrub(s.tags)}));
  return next;
}

// Turns a bullet's/skill category's tags[] array of ids into their current pool labels, for
// rendering -- an id with no matching pool entry (deleted since, or a library that hasn't run
// migrateTagOptions() yet in this process) is silently skipped, same tolerance every other
// dangling reference in this app already has.
function resolveTagLabels(library, ids){
  const pool = (library && library.tagOptions) || [];
  return (ids||[]).map(id=>{
    const opt = pool.find(o=>o.id===id);
    return opt ? opt.label : null;
  }).filter(Boolean);
}

// One-time, silent migration: the first time a Library loads with no tagOptions array at all,
// build the pool from whatever free-text tag values already exist on bullets/skill categories
// (collapsed case-insensitively -- "DA" and "da" become one entry, first-seen casing wins as
// the label), then rewrite every tags[] array from that raw text to the new ids. Pure --
// returns a new library object (or the exact same object, unchanged, if there's nothing to
// migrate). The caller (js/06_app.js's loadAuthedAppState()) is responsible for persisting the
// result via DB.saveLibrary() so this only ever actually runs once per account.
function migrateTagOptions(library){
  if(library.tagOptions) return library;
  const byLowerLabel = new Map(); // lowercased label -> {id,label}
  const tagOptions = [];
  function idFor(text){
    const label = (text||'').trim();
    if(!label) return null;
    const key = label.toLowerCase();
    let entry = byLowerLabel.get(key);
    if(!entry){
      entry = { id: uid(), label };
      byLowerLabel.set(key, entry);
      tagOptions.push(entry);
    }
    return entry.id;
  }
  function remap(tags){ return (tags||[]).map(idFor).filter(Boolean); }
  const next = { ...library };
  ['experience','projects','customSections'].forEach(kind=>{
    next[kind] = (library[kind]||[]).map(e=> e.bullets ? {...e, bullets: e.bullets.map(b=>({...b, tags:remap(b.tags)}))} : e);
  });
  next.skills = (library.skills||[]).map(s=>({...s, tags:remap(s.tags)}));
  next.tagOptions = tagOptions;
  return next;
}

/* Selection helpers on a version -- toggling inclusion of a library ref */
function versionToggleRef(version, kind, refId, included){
  const list = version.selection[kind];
  const exists = list.some(x=>x.refId===refId);
  let next;
  if(included && !exists) next = [...list, {refId, bulletIds:[]}];
  else if(!included && exists) next = list.filter(x=>x.refId!==refId);
  else next = list;
  return {...version, selection:{...version.selection, [kind]:next}};
}
function versionToggleBullet(version, kind, refId, bulletId, included){
  const list = version.selection[kind].map(x=>{
    if(x.refId!==refId) return x;
    const has = x.bulletIds.includes(bulletId);
    let bulletIds;
    if(included && !has) bulletIds = [...x.bulletIds, bulletId];
    else if(!included && has) bulletIds = x.bulletIds.filter(b=>b!==bulletId);
    else bulletIds = x.bulletIds;
    return {...x, bulletIds};
  });
  return {...version, selection:{...version.selection, [kind]:list}};
}

// "Fill in with tag" -- a one-off bulk-include action, not a persistent mode (unlike
// skillGroupId/summaryId's own "pick a saved item, replacing manual toggles" pattern -- there's
// deliberately no selection.fillTagId field; nothing is remembered about which tag was picked).
// Every bullet across experience/projects/customSections carrying `tagId`, plus its parent
// entry, gets switched on; every skill category carrying it gets switched on too, unless the
// version is currently driven by a Skill Set (selection.skillGroupId set) rather than manual
// per-category toggles, in which case there's nothing for a per-category toggle to mean and
// skills are left untouched. Purely additive for all of the above -- never removes anything
// already included, so picking a tag is always safe to try.
//
// Summaries are the one exception to "additive, never overwrites" -- on request ("replace the
// label in the summary in library with our tags... single pick will be good"), a tagged summary
// is a genuine single-pick: if any library summary carries `tagId`, the first one (by array
// order -- summaries have no other natural ordering) becomes this version's active summary
// (selection.summaryId), the exact same field the dropdown above Summary already writes to.
// This DOES overwrite whatever summary was previously selected, deliberately -- unlike a
// bullet's inclusion (a checkbox that can be independently true for many bullets at once), a
// version only ever has one active summary, so "pick the one tagged X" has nothing to be
// additive *with*. Left untouched (not cleared) when no library summary carries the tag at
// all, so filling by a tag that only matches bullets/skills doesn't blank out an
// already-chosen summary that has nothing to do with this tag.
// Shared by versionFillByTag()/versionRemoveByTag() below and by versionSelectSummaryByTag()
// (the Summary section's own tag-filter picker) -- "first by array order" since summaries have
// no other natural ordering; summaries being single-pick means there's no "select all matches"
// concept the way bullets/skill categories have.
function findSummaryByTag(library, tagId){
  return (library.summaries||[]).find(s=>(s.tags||[]).includes(tagId)) || null;
}
function versionFillByTag(version, library, tagId){
  let v = version;
  ['experience','projects','customSections'].forEach(kind=>{
    (library[kind]||[]).forEach(entry=>{
      if(!entry.bullets) return;
      const matchingBullets = entry.bullets.filter(b=>(b.tags||[]).includes(tagId));
      if(!matchingBullets.length) return;
      v = versionToggleRef(v, kind, entry.id, true);
      matchingBullets.forEach(b=>{ v = versionToggleBullet(v, kind, entry.id, b.id, true); });
    });
  });
  if(!v.selection.skillGroupId){
    (library.skills||[]).forEach(cat=>{
      if((cat.tags||[]).includes(tagId)) v = versionToggleRef(v, 'skills', cat.id, true);
    });
  }
  const taggedSummary = findSummaryByTag(library, tagId);
  if(taggedSummary) v = {...v, selection:{...v.selection, summaryId:taggedSummary.id}};
  return v;
}
// The reverse of versionFillByTag() -- a real, reported gap: clearing the "Fill in with tag"
// chip only ever forgot which tag had been picked (selection.lastFillTagId), it never actually
// un-included anything that fill had switched on, so repeatedly trying different tags just kept
// piling their content on top of each other with no way back except manually unchecking every
// box. Every bullet carrying `tagId` gets switched off; if that empties out an entry's
// bulletIds entirely, the entry ref itself is switched off too (mirroring what fill would have
// done to *include* it in the first place -- fill only ever included an entry because it had a
// matching bullet). An entry with OTHER bullets still included (toggled on manually, or by a
// different tag) is left included, just without this tag's bullets -- this only undoes what
// this specific tag is responsible for, not a wholesale "start over". Skill categories mirror
// versionFillByTag()'s own skillGroupId guard (skipped when the version is driven by a Skill
// Set instead of manual per-category toggles). Composed entirely from
// versionToggleRef()/versionToggleBullet(), same as versionFillByTag(), for the same reason:
// it can never produce a state manually toggling the same checkboxes couldn't.
function versionRemoveByTag(version, library, tagId){
  let v = version;
  ['experience','projects','customSections'].forEach(kind=>{
    (library[kind]||[]).forEach(entry=>{
      if(!entry.bullets) return;
      const matchingBullets = entry.bullets.filter(b=>(b.tags||[]).includes(tagId));
      if(!matchingBullets.length) return;
      matchingBullets.forEach(b=>{ v = versionToggleBullet(v, kind, entry.id, b.id, false); });
      const sel = v.selection[kind].find(s=>s.refId===entry.id);
      if(sel && sel.bulletIds.length===0) v = versionToggleRef(v, kind, entry.id, false);
    });
  });
  if(!v.selection.skillGroupId){
    (library.skills||[]).forEach(cat=>{
      if((cat.tags||[]).includes(tagId)) v = versionToggleRef(v, 'skills', cat.id, false);
    });
  }
  // Mirrors versionFillByTag()'s own summary branch: only clears selection.summaryId if it's
  // still actually pointing at a summary carrying this tag -- if the user picked a different
  // summary by hand since the fill, that manual choice is left alone. Never touches
  // customSummaryText -- an empty summaryId just falls back to whatever free text was already
  // there, same as the summary picker's own "(custom text below)" mode always has.
  if(v.selection.summaryId){
    // Deliberately NOT findSummaryByTag() here -- that resolves to the *first* summary
    // carrying tagId, which could silently miss clearing a currently-selected summary that
    // carries the tag but isn't first in library order (a real bug this exact substitution
    // would have introduced). Checking the current summary's own tags directly is correct
    // regardless of which one fill picked or the user later chose by hand.
    const current = (library.summaries||[]).find(s=>s.id===v.selection.summaryId);
    if(current && (current.tags||[]).includes(tagId)) v = {...v, selection:{...v.selection, summaryId:null}};
  }
  return v;
}

/* Per-version field/bullet-text overrides -- the "only this version" half of the editor's
   entry-edit dialog (js/06_app.js's saveEntryEditModal()). A version has never stored copies
   of Library text before this (see CLAUDE.md: "a version stores references... never copies
   of the text itself") -- these are additive, optional shadow values on top of that existing
   reference-only model, not a replacement for it. `overrides` holds whole-field replacements
   (e.g. {company:'Acme (contract)'}); `bulletOverrides` holds replacement text keyed by
   bullet id, since a bullet has no other addressable field. Both are absent/undefined on any
   sel object until first used -- resolveVersion() below treats a missing overrides object
   exactly like an empty one, so every pre-existing saved version (no overrides at all) still
   resolves identically to before this feature existed. */
function versionSetOverride(version, kind, refId, field, value){
  const list = version.selection[kind].map(x=> x.refId===refId ? {...x, overrides:{...(x.overrides||{}), [field]:value}} : x);
  return {...version, selection:{...version.selection, [kind]:list}};
}
function versionClearOverride(version, kind, refId, field){
  const list = version.selection[kind].map(x=>{
    if(x.refId!==refId || !x.overrides || !(field in x.overrides)) return x;
    const overrides = {...x.overrides}; delete overrides[field];
    return {...x, overrides};
  });
  return {...version, selection:{...version.selection, [kind]:list}};
}
function versionSetBulletOverride(version, kind, refId, bulletId, text){
  const list = version.selection[kind].map(x=> x.refId===refId ? {...x, bulletOverrides:{...(x.bulletOverrides||{}), [bulletId]:text}} : x);
  return {...version, selection:{...version.selection, [kind]:list}};
}
function versionClearBulletOverride(version, kind, refId, bulletId){
  const list = version.selection[kind].map(x=>{
    if(x.refId!==refId || !x.bulletOverrides || !(bulletId in x.bulletOverrides)) return x;
    const bulletOverrides = {...x.bulletOverrides}; delete bulletOverrides[bulletId];
    return {...x, bulletOverrides};
  });
  return {...version, selection:{...version.selection, [kind]:list}};
}
// A Skill Set's own equivalent of versionSetOverride/versionSetBulletOverride above -- added
// on request ("include Skill Sets membership") specifically because a skill set has no
// per-item field to override; what's overridden is *which categories* the set resolves to
// for this one version, a frozen categoryIds snapshot rather than a frozen text value. Checked
// first in resolveVersion()'s resolveSkills() below, same "override shadows the live value"
// pattern every other kind already uses.
function versionSetSkillGroupOverride(version, groupId, categoryIds){
  return {...version, selection:{...version.selection, skillGroupOverrides:{...(version.selection.skillGroupOverrides||{}), [groupId]:categoryIds}}};
}
function versionClearSkillGroupOverride(version, groupId){
  if(!version.selection.skillGroupOverrides || !(groupId in version.selection.skillGroupOverrides)) return version;
  const skillGroupOverrides = {...version.selection.skillGroupOverrides}; delete skillGroupOverrides[groupId];
  return {...version, selection:{...version.selection, skillGroupOverrides}};
}

// Answers "how many (and which) versions currently use this Library item" -- added on
// request, to warn before a Library edit silently changes what several versions print.
// versionsFull: [{id, name, selection}], one entry per non-deleted version, `selection` being
// exactly the same shape resolveVersion() already reads (version.selection). Pure, no DOM/
// network -- the caller (js/06_app.js's refreshLibraryUsageIndex()) is what fetches the real
// data via DB.listVersionSelections().
//
// Three usage maps, not one, because "used" means something different at each granularity:
// - entryUsage: versions that include this entry at all (kind+refId) -- relevant for any
//   entry-level field (company/role/dates/location/label/text/etc), since those print
//   whenever the entry itself is included, regardless of which bullets are selected.
// - bulletUsage: versions that include this *specific* bullet (kind+refId+bulletId) --
//   relevant for a single bullet's own text.
// - skillGroupUsage / summaryUsage: versions currently driven by this Skill Set / this saved
//   summary (selection.skillGroupId / selection.summaryId), not a list membership the way
//   the other two are.
// Tags are deliberately absent here -- a tag is never printed on a resume (see CLAUDE.md's
// "Tags" section), so there's no "N versions would change" question to answer for a tag edit;
// nothing about any version's output depends on a tag's label or a bullet's tags[] array.
function buildUsageIndex(versionsFull){
  const entryUsage = {}, bulletUsage = {}, skillGroupUsage = {}, summaryUsage = {};
  const push = (map, key, v) => { (map[key] = map[key]||[]).push({id:v.id, name:v.name}); };
  (versionsFull||[]).forEach(v=>{
    const sel = v.selection;
    if(!sel) return;
    ['experience','projects','education','skills','references','customSections'].forEach(kind=>{
      (sel[kind]||[]).forEach(entry=>{
        const entryKey = kind+':'+entry.refId;
        push(entryUsage, entryKey, v);
        (entry.bulletIds||[]).forEach(bid=> push(bulletUsage, entryKey+':'+bid, v));
      });
    });
    if(sel.skillGroupId) push(skillGroupUsage, sel.skillGroupId, v);
    if(sel.summaryId) push(summaryUsage, sel.summaryId, v);
  });
  return { entryUsage, bulletUsage, skillGroupUsage, summaryUsage };
}

/* Resolve a version's selection against the library into a flat render-ready structure.
   Silently drops references to deleted library items (returns which were dropped for UI notice). */
function resolveVersion(library, version){
  const dropped = [];
  function resolveKind(kind){
    return version.selection[kind].map(sel=>{
      const entry = library[kind].find(e=>e.id===sel.refId);
      if(!entry){ dropped.push(kind+':'+sel.refId); return null; }
      let resolved = sel.overrides ? {...entry, ...sel.overrides} : entry;
      if(sel.bulletIds){
        const bullets = sel.bulletIds.map(bid=>{
          const b = entry.bullets.find(x=>x.id===bid);
          if(!b) return null;
          const ov = sel.bulletOverrides && sel.bulletOverrides[bid];
          return ov!=null ? {...b, text:ov} : b;
        }).filter(Boolean);
        resolved = {...resolved, bullets};
      }
      return resolved;
    }).filter(Boolean);
  }
  // Skill Sets: a real skillGroupId resolves skills from that set's categoryIds instead of
  // the per-category selection.skills toggles -- see the field's own comment in
  // blankVersion() above. Old saved versions have skillGroupId===undefined, which is
  // falsy, so they fall straight into the unchanged resolveKind('skills') branch.
  function resolveSkills(){
    const groupId = version.selection.skillGroupId;
    if(!groupId) return resolveKind('skills');
    // A frozen categoryIds snapshot (versionSetSkillGroupOverride() above) shadows the set's
    // live membership for this one version, same "override wins" pattern every other kind
    // already has -- the version doesn't care if the live set (or even the set itself) later
    // changes, only that these specific category ids still resolve.
    const override = version.selection.skillGroupOverrides && version.selection.skillGroupOverrides[groupId];
    const group = (library.skillGroups||[]).find(g=>g.id===groupId);
    const categoryIds = override || (group && group.categoryIds);
    if(!categoryIds){ dropped.push('skillGroups:'+groupId); return []; }
    return categoryIds.map(cid=>{
      const cat = library.skills.find(c=>c.id===cid);
      if(!cat){ dropped.push('skills:'+cid); return null; }
      return cat;
    }).filter(Boolean);
  }
  const summary = version.selection.summaryId
    ? (library.summaries.find(s=>s.id===version.selection.summaryId)||{}).text || version.selection.customSummaryText
    : version.selection.customSummaryText;
  return {
    summary,
    summaryHeading: version.selection.summaryHeading || 'Summary',
    experience: resolveKind('experience'),
    projects: resolveKind('projects'),
    education: resolveKind('education'),
    skills: resolveSkills(),
    references: resolveKind('references'),
    customSections: resolveKind('customSections'),
    dropped
  };
}

// "Import as separate version(s)" -- on request, a third choice alongside Replace-everything/
// Review & merge (see showImportChoiceDialog() in js/06_app.js): the incoming file's own
// library content never touches the account's shared LIBRARY at all, staying instead as a
// private, self-contained copy embedded directly on the new version
// (version.embeddedLibrary). This is a deliberate, narrow exception to this app's usual
// "a version stores references, never copies" rule (see CLAUDE.md) -- exactly one feature
// needs it, and it's opt-in. libraryFor() is the one place that decides which library a given
// version resolves against; every render/resolve call site in js/06_app.js goes through it
// (as libraryFor(LIBRARY, CURRENT_VERSION)) rather than assuming the global LIBRARY directly,
// which is what makes the rest of the editor (preview, pagination, PDF/DOCX export, the
// entry-edit modal, tag pickers, "Fill in with tag") work unmodified for a standalone version
// -- they already take a library as a parameter or read one from this function, never the
// global directly.
function libraryFor(library, version){
  return (version && version.standalone && version.embeddedLibrary) ? version.embeddedLibrary : library;
}
// Builds a complete, self-contained library-shaped object from an imported file's own
// `library` blob -- defensively filled out against emptyLibrary() (an old/hand-built export
// can be missing keys this app now expects) and run through the exact same migrateTagOptions()
// every other import path already uses, so an incoming file's raw free-text tags become real
// (locally-scoped, not shared with the account's own pool) tag ids the chip-input picker can
// work with, same as everywhere else.
function buildEmbeddedLibrary(incomingLibrary){
  const base = emptyLibrary();
  const src = incomingLibrary || {};
  let lib = { ...base, ...src, meta: { ...base.meta, ...(src.meta||{}) } };
  // migrateTagOptions() only migrates when tagOptions is entirely absent -- the spread above
  // already backfilled it to [] from emptyLibrary() for any source missing the key, which
  // would look exactly like "already migrated, nothing to do" (an empty array is truthy) and
  // skip real free-text tags sitting on this same incoming data. Delete it first unless the
  // source really did provide its own tagOptions array, so absence still looks like absence.
  if(!('tagOptions' in src)) delete lib.tagOptions;
  lib = migrateTagOptions(lib);
  if(!lib.tagOptions) lib.tagOptions = [];
  return lib;
}
// Turns one raw version blob from an imported file's `payload.versions[id]` into a brand-new,
// standalone version: a fresh id (never the source file's own -- there's no "same file
// imported twice" concept to reconcile against, same reasoning applyImportReviewAndFinish()
// already documents for its own version creation), main:false (pinning is a per-account
// decision, not something an import should assert), and the file's own library content carried
// along as embeddedLibrary rather than merged into anything. The version's own selection
// (refIds/bulletIds) is left completely untouched -- it already matches embeddedLibrary's own
// entry/bullet ids verbatim, since embeddedLibrary is that same file's library, unlike Review &
// merge's remap table which exists specifically because *that* path lands entries in a
// different id space (the account's own Library).
function buildStandaloneVersion(rawVersionData, incomingLibrary){
  const cloned = JSON.parse(JSON.stringify(rawVersionData || {}));
  return {
    ...cloned,
    id: uid(),
    standalone: true,
    embeddedLibrary: buildEmbeddedLibrary(incomingLibrary),
    createdAt: Date.now(), updatedAt: Date.now(), main: false
  };
}
// The "Add to Library" escape hatch inside the entry-edit modal, for a standalone version --
// copies one whole entry (fresh id, and fresh bullet ids so undo/redo and future edits on the
// copy can never alias back to the embedded original) into the account's real, shared LIBRARY.
// Tags are deliberately stripped on the copy: embedded tag ids reference embeddedLibrary's own
// local tag pool, which has no relationship to the account's shared tagOptions pool, and there's
// no reliable way to map one onto the other automatically (a matching label could exist, could
// not, or could collide with an unrelated tag of the same name) -- silently carrying over an id
// that resolves to nothing (or worse, something else) would be a real, confusing bug. Pure: the
// caller (addStandaloneEntryToLibrary() in js/06_app.js) does the actual LIBRARY assignment/save.
function copyEntryForLibrary(entry){
  const copy = JSON.parse(JSON.stringify(entry));
  copy.id = uid();
  if(copy.bullets) copy.bullets = copy.bullets.map(b=>({...b, id: uid(), tags: []}));
  if('tags' in copy) copy.tags = [];
  return copy;
}

/* Section ordering -- a flat array of tokens: the 5 built-in kind names,
   or 'custom:'+refId for a custom section. Kept as pure functions so old
   saved versions (no sectionOrder field) and versions whose customSections
   selection outpaces a stale order array both self-heal instead of
   silently dropping content. */
function resolveSectionOrder(version){
  let order = Array.isArray(version.sectionOrder) ? version.sectionOrder.slice() : BUILTIN_SECTION_ORDER.slice();
  BUILTIN_SECTION_ORDER.forEach(k=>{ if(!order.includes(k)) order.push(k); });
  (version.selection.customSections||[]).forEach(sel=>{
    const tok = 'custom:'+sel.refId;
    if(!order.includes(tok)) order.push(tok);
  });
  return order;
}
function sectionOrderAdd(version, token){
  // Deliberately checks the RAW stored order, not resolveSectionOrder()'s self-healed
  // view -- self-heal already treats a just-selected custom section's token as
  // "present" (derived from version.selection.customSections), which would make this
  // a no-op right when it's needed most: immediately after toggling that same
  // selection on. Writing the resolved order back (with the token appended) is what
  // actually persists it into version.sectionOrder for the reorder UI to operate on.
  const raw = Array.isArray(version.sectionOrder) ? version.sectionOrder : BUILTIN_SECTION_ORDER;
  if(raw.includes(token)) return version;
  const healed = resolveSectionOrder(version);
  const next = healed.includes(token) ? healed : [...healed, token];
  return {...version, sectionOrder: next};
}
function sectionOrderRemove(version, token){
  const order = resolveSectionOrder(version).filter(t=>t!==token);
  return {...version, sectionOrder:order};
}
function moveSectionOrder(version, token, dir){
  const order = resolveSectionOrder(version);
  const i = order.indexOf(token); if(i<0) return version;
  const j = dir==='up'?i-1:i+1;
  if(j<0||j>=order.length) return version;
  const next = order.slice(); [next[i],next[j]]=[next[j],next[i]];
  return {...version, sectionOrder: next};
}

if(typeof module !== 'undefined') module.exports = {
  emptyLibrary, defaultStyle, normalizeFontFamily, blankVersion, newLibraryEntry, newBullet,
  libAddEntry, libRemoveEntry, libAddBullet, libRemoveBullet, libEditEntry, libEditBullet, libToggleSkillGroupCategory,
  libRemoveTagOption, resolveTagLabels, migrateTagOptions,
  versionToggleRef, versionToggleBullet, versionFillByTag, versionRemoveByTag,
  findSummaryByTag, resolveVersion,
  versionSetOverride, versionClearOverride, versionSetBulletOverride, versionClearBulletOverride,
  versionSetSkillGroupOverride, versionClearSkillGroupOverride, buildUsageIndex,
  resolveSectionOrder, sectionOrderAdd, sectionOrderRemove, moveSectionOrder,
  BUILTIN_SECTION_ORDER,
  libraryFor, buildEmbeddedLibrary, buildStandaloneVersion, copyEntryForLibrary
};
