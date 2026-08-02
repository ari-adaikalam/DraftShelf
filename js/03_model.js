function emptyLibrary(){
  return {
    meta:{name:'',phone:'',email:'',location:'',linkedin:'',github:'',portfolio:''},
    experience:[], projects:[], education:[], skills:[], summaries:[], references:[], customSections:[]
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
    bold:{ company:true, role:true, project:true, university:true, skillsLabel:true, referenceName:true, dates:false }
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
    case 'skills': return {id,label:'',text:''};
    case 'summaries': return {id,label:'',text:'',tags:[]};
    case 'references': return {id,name:'',title:'',contact:'',tags:[]};
    // subheading/dates/location mirror experience's tag/dates/location -- optional context
    // above the section's content (e.g. an issuing organization + date for a certification).
    // Library-level fields, not per-version-overridable, same as experience's own fields --
    // only `heading` gets a per-version override (see sectionHeadingFieldHtml() in
    // js/06_app.js), for consistency with how every other section type works.
    case 'customSections': return {id,heading:'',subheading:'',dates:'',location:'',contentType:'bullets',bullets:[],text:''};
    default: throw new Error('unknown kind '+kind);
  }
}
function newBullet(){ return {id:uid(), text:'', tags:[]}; }

/* Reducers -- pure, return new state (shallow-mutate copies) for testability */
function libAddEntry(library, kind){
  const next = {...library, [kind]: [...library[kind], newLibraryEntry(kind)]};
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
  const summary = version.selection.summaryId
    ? (library.summaries.find(s=>s.id===version.selection.summaryId)||{}).text || version.selection.customSummaryText
    : version.selection.customSummaryText;
  return {
    summary,
    summaryHeading: version.selection.summaryHeading || 'Summary',
    experience: resolveKind('experience'),
    projects: resolveKind('projects'),
    education: resolveKind('education'),
    skills: resolveKind('skills'),
    references: resolveKind('references'),
    customSections: resolveKind('customSections'),
    dropped
  };
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
  libAddEntry, libRemoveEntry, libAddBullet, libRemoveBullet,
  versionToggleRef, versionToggleBullet, resolveVersion,
  versionSetOverride, versionClearOverride, versionSetBulletOverride, versionClearBulletOverride,
  resolveSectionOrder, sectionOrderAdd, sectionOrderRemove, moveSectionOrder,
  BUILTIN_SECTION_ORDER
};
