function emptyLibrary(){
  return {
    meta:{name:'',phone:'',email:'',location:'',linkedin:'',github:'',portfolio:''},
    experience:[], projects:[], education:[], skills:[], summaries:[], references:[], customSections:[],
    // Publications/Certifications -- real, first-class Library kinds (peers of experience/
    // projects, not generic custom sections), added alongside the positions/sub-bullets
    // feature below. See newLibraryEntry()'s own cases for field shapes. Absent on any
    // library saved before this feature; every read site treats that the same as [].
    publications:[], certifications:[],
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
    bold:{ company:true, role:true, project:true, university:true, skillsLabel:true, referenceName:true },
    // Italic fields, added alongside Bold on request -- same identifying-field set, same flag
    // keys (so a field already reusing an existing bold flag, e.g. Custom Sections' org/
    // subheading -> 'company'/'role', or Publications' title -> 'project', gets italic support
    // for free too, no new mapping needed). Defaults to all-off, unlike Bold's mostly-on
    // defaults -- italic isn't a typical resume convention for these fields the way bold is,
    // so this is opt-in. Absent entirely on any version/preference saved before this existed;
    // bd() (js/06_app.js) and its DOCX-export/Deno-mirror counterparts all tolerate that via a
    // `style.italic && style.italic[flagKey]` guard, no migration needed.
    italic:{ company:false, role:false, project:false, university:false, skillsLabel:false, referenceName:false }
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
// Cambria isn't part of Microsoft's freely-licensed "Core Fonts for the Web" package either
// (same reason Calibri needed Carlito, above) -- substituted with Caladea, Google's own
// metric-compatible match for Cambria (the sibling font to Carlito; both ship together as the
// "crosextra" pair, installed server-side via the same fonts-crosextra-caladea Debian package
// alongside fonts-crosextra-carlito -- see pdf-service/Dockerfile). Old saved data with the raw
// "Cambria" string (there never was a real UI path to it before this, but tolerated the same
// way the Calibri substitution already is) normalizes the same way.
function normalizeFontFamily(raw){
  if(typeof raw!=='string') return raw;
  if(raw.indexOf('Calibri')!==-1) return '"Carlito", sans-serif';
  if(raw.indexOf('Cambria')!==-1) return '"Caladea", serif';
  return raw;
}

// Publications/Certifications are real peers of the original 5 -- always present in the
// order array (self-healed by resolveSectionOrder() below, same as the original 5), not an
// opt-in "custom:" token. An empty section (resolveKind() returns []) simply renders nothing,
// same tolerance skills/references already have when unused.
const BUILTIN_SECTION_ORDER = ['experience','projects','education','skills','references','publications','certifications'];

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
    sectionHeadings:{experience:'Work Experience', projects:'Projects', education:'Education', skills:'Skills', references:'References', publications:'Publications', certifications:'Certifications'},
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
      experience:[], projects:[], education:[], skills:[], references:[], customSections:[],
      publications:[], certifications:[]
      // each entry: {refId, bulletIds:[...]}  (bulletIds omitted for education/skills/references/certifications)
      // For an entry whose library item has `positions` (experience/customSections -- see
      // newPosition() below): `excludedPositionIds:[...]` (absent/[] = every position included,
      // the same "everything on by default" convention new content already gets elsewhere) and
      // `positionOverrides:{[positionId]:{field:value}}` (the per-position "only this version"
      // override, parallel to `overrides`/`bulletOverrides` above but addressed one level down).
    }
  };
}

// A real version saved before publications/certifications (or any future selection kind)
// existed has no such key on its own `selection` object at all -- every reducer in this file
// that does `version.selection[kind].map(...)`/`.find(...)` directly would throw on one,
// rather than treating it as "nothing selected yet" the way every other absent-kind case in
// this app already tolerates. Rather than adding a defensive `||[]` to every one of those call
// sites (easy to miss one), this is called once at every point a version enters memory from an
// external/raw source (a DB fetch, a standalone import, Import Review's own version creation)
// -- mirrors migrateTagOptions()'s own "normalize once at the boundary" shape for LIBRARY.
function ensureVersionSelectionShape(version){
  if(!version || !version.selection) return version;
  const missing = ['publications','certifications'].filter(k=> !version.selection[k]);
  if(!missing.length) return version;
  const patch = {};
  missing.forEach(k=> patch[k]=[]);
  return {...version, selection:{...version.selection, ...patch}};
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
    // Real, first-class kinds (peers of experience/projects), not generic custom sections --
    // see the "Publications & Certifications as real sections" pass. `tags` on the entry
    // itself (not per-bullet) is what "Fill in with tag" matches against for the whole
    // citation, same granularity skills categories already use; publications additionally
    // carries optional `bullets` for a short abstract/description note, which DO carry their
    // own tags for finer-grained fill (see versionFillByTag() below).
    case 'publications': return {id,title:'',authors:'',venue:'',date:'',url:'',bullets:[],tags:[]};
    case 'certifications': return {id,name:'',issuer:'',date:'',credentialId:'',url:'',tags:[]};
    case 'skillGroups': return {id,label:'',categoryIds:[]};
    case 'tagOptions': return {id,label:''};
    default: throw new Error('unknown kind '+kind);
  }
}
function newBullet(){ return {id:uid(), text:'', tags:[]}; }
// One level of nested/indented bullets -- a bullet's own optional `children` array holds more
// bullets of this exact same shape (never a third level; resolveVersion()/the DOCX export/the
// live preview all only ever look one level deep). Absent on every bullet that predates this
// feature, which is what makes it a no-op everywhere a bullet is read without checking for it.
function newSubBullet(){ return {id:uid(), text:'', tags:[]}; }

// Multiple positions/sub-entries under one shared heading -- e.g. three roles held at one
// company ("Engineering Experience"), or three certifications-shaped sub-entries under one
// custom section. Optional, on `entry.positions` (experience or customSections entries only);
// absent means "flat", today's exact single-role/single-entry rendering, unchanged, no
// migration. When present, the entry's own role/dates/location/bullets (experience) or
// subheading/dates/location/contentType/bullets/text (customSections) are simply unused --
// company/tag (experience) or heading (customSections) stay shared across every position.
function newPosition(kind){
  const id = uid();
  if(kind==='experience') return {id, role:'', dates:'', location:'', bullets:[], tags:[]};
  // customSections positions have no natural shared "company" the way Experience's positions
  // do (Experience's Company lives once, at the entry level, since every position under one
  // entry is definitionally at the same company) -- a custom section's own sub-entries can
  // genuinely belong to different organizations (e.g. certifications from different bodies
  // under one "Certifications" heading), so `org` is per-position here, on request, mirroring
  // Experience's Company+Role pair but scoped one level down. `subheading` is still the
  // title/role-equivalent field.
  return {id, subheading:'', org:'', dates:'', location:'', contentType:'bullets', bullets:[], text:'', tags:[]};
}
function libAddPosition(library, kind, entryId){
  return {...library, [kind]: library[kind].map(e=> e.id===entryId ? {...e, positions:[...(e.positions||[]), newPosition(kind)]} : e)};
}
function libRemovePosition(library, kind, entryId, positionId){
  return {...library, [kind]: library[kind].map(e=> e.id===entryId ? {...e, positions:(e.positions||[]).filter(p=>p.id!==positionId)} : e)};
}
function libMovePosition(library, kind, entryId, positionId, dir){
  return {...library, [kind]: library[kind].map(e=>{
    if(e.id!==entryId) return e;
    const positions = (e.positions||[]).slice();
    const i = positions.findIndex(p=>p.id===positionId); if(i<0) return e;
    const j = dir==='up'?i-1:i+1;
    if(j<0||j>=positions.length) return e;
    [positions[i],positions[j]] = [positions[j],positions[i]];
    return {...e, positions};
  })};
}
// One-time convenience for turning a plain, single-role entry into the first position of a
// positioned one -- carries the entry's own existing role/dates/location/bullets (experience)
// or subheading/dates/location/contentType/text/bullets (customSections) into a real first
// position, rather than starting that position blank. The old top-level fields are left
// exactly as they are (not blanked) -- harmless once `positions` exists (every render/resolve
// site already treats them as simply unused, see newPosition()'s own comment above), and it
// means removing every position later still leaves the original content recoverable rather
// than silently lost.
function libConvertEntryToPositions(library, kind, entryId){
  return {...library, [kind]: library[kind].map(e=>{
    if(e.id!==entryId || (e.positions && e.positions.length)) return e;
    const first = kind==='experience'
      ? {id:uid(), role:e.role||'', dates:e.dates||'', location:e.location||'', bullets:e.bullets||[], tags:[]}
      : {id:uid(), subheading:e.subheading||'', org:'', dates:e.dates||'', location:e.location||'', contentType:e.contentType||'bullets', bullets:e.bullets||[], text:e.text||'', tags:[]};
    return {...e, positions:[first]};
  })};
}

// Shared plumbing for every bullet reducer below: an optional positionId routes the read/write
// to that position's own bullets array (entry.positions[i].bullets) instead of the entry's flat
// `bullets` array. Every existing call site keeps calling these with no positionId at all,
// which is exactly today's flat-bullets behavior -- these two helpers are the only place that
// distinction lives, so the reducers themselves don't need an if/else of their own.
function getBulletsArray(entry, positionId){
  if(positionId){
    const pos = (entry.positions||[]).find(p=>p.id===positionId);
    return pos ? (pos.bullets||[]) : [];
  }
  return entry.bullets||[];
}
function setBulletsArray(entry, positionId, bullets){
  if(positionId){
    return {...entry, positions:(entry.positions||[]).map(p=> p.id===positionId ? {...p, bullets} : p)};
  }
  return {...entry, bullets};
}

/* Reducers -- pure, return new state (shallow-mutate copies) for testability */
function libAddEntry(library, kind){
  const next = {...library, [kind]: [...(library[kind]||[]), newLibraryEntry(kind)]};
  return next;
}
function libRemoveEntry(library, kind, id){
  return {...library, [kind]: library[kind].filter(e=>e.id!==id)};
}
function libAddBullet(library, kind, entryId, positionId){
  return {...library, [kind]: library[kind].map(e=>{
    if(e.id!==entryId) return e;
    return setBulletsArray(e, positionId, [...getBulletsArray(e, positionId), newBullet()]);
  })};
}
function libRemoveBullet(library, kind, entryId, bulletId, positionId){
  return {...library, [kind]: library[kind].map(e=>{
    if(e.id!==entryId) return e;
    return setBulletsArray(e, positionId, getBulletsArray(e, positionId).filter(b=>b.id!==bulletId));
  })};
}
// Sub-bullets -- one level of indented children under a specific parent bullet, in either a
// flat entry's bullets or a specific position's bullets (same optional positionId convention
// as libAddBullet/libRemoveBullet above).
function libAddSubBullet(library, kind, entryId, parentBulletId, positionId){
  return {...library, [kind]: library[kind].map(e=>{
    if(e.id!==entryId) return e;
    const bullets = getBulletsArray(e, positionId).map(b=>
      b.id===parentBulletId ? {...b, children:[...(b.children||[]), newSubBullet()]} : b);
    return setBulletsArray(e, positionId, bullets);
  })};
}
function libRemoveSubBullet(library, kind, entryId, parentBulletId, childId, positionId){
  return {...library, [kind]: library[kind].map(e=>{
    if(e.id!==entryId) return e;
    const bullets = getBulletsArray(e, positionId).map(b=>
      b.id===parentBulletId ? {...b, children:(b.children||[]).filter(c=>c.id!==childId)} : b);
    return setBulletsArray(e, positionId, bullets);
  })};
}
// Reordering a bullet -- a real, meaningful change, not just cosmetic: resolveVersion()'s own
// resolveBulletArray() filters a positioned/flat entry's bullets down to the included set
// while preserving THIS array's own order (not selection.bulletIds' order), so moving a bullet
// here changes print order exactly the way reordering a whole entry/position already does.
// Same optional positionId convention every other bullet reducer here already has.
function libMoveBullet(library, kind, entryId, bulletId, dir, positionId){
  return {...library, [kind]: library[kind].map(e=>{
    if(e.id!==entryId) return e;
    const bullets = getBulletsArray(e, positionId).slice();
    const i = bullets.findIndex(b=>b.id===bulletId); if(i<0) return e;
    const j = dir==='up'?i-1:i+1;
    if(j<0||j>=bullets.length) return e;
    [bullets[i],bullets[j]] = [bullets[j],bullets[i]];
    return setBulletsArray(e, positionId, bullets);
  })};
}
// Same idea, one level down -- reordering a bullet's own sub-bullet children.
function libMoveSubBullet(library, kind, entryId, parentBulletId, childId, dir, positionId){
  return {...library, [kind]: library[kind].map(e=>{
    if(e.id!==entryId) return e;
    const bullets = getBulletsArray(e, positionId).map(b=>{
      if(b.id!==parentBulletId) return b;
      const children = (b.children||[]).slice();
      const i = children.findIndex(c=>c.id===childId); if(i<0) return b;
      const j = dir==='up'?i-1:i+1;
      if(j<0||j>=children.length) return b;
      [children[i],children[j]] = [children[j],children[i]];
      return {...b, children};
    });
    return setBulletsArray(e, positionId, bullets);
  })};
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
// Scrubs a tag id out of a flat bullets array, including one level of sub-bullet children --
// shared by libRemoveTagOption()/migrateTagOptions() below so the same nesting-aware walk
// isn't duplicated between them.
function scrubBulletsTags(bullets, scrub){
  return (bullets||[]).map(b=>({
    ...b, tags: scrub(b.tags),
    children: b.children ? b.children.map(c=>({...c, tags: scrub(c.tags)})) : b.children
  }));
}
function libRemoveTagOption(library, id){
  const scrub = arr => (arr||[]).filter(tagId=>tagId!==id);
  const next = { ...library, tagOptions: library.tagOptions.filter(t=>t.id!==id) };
  // publications has both entry-level tags (fill-by-tag for the whole citation) and per-bullet
  // tags (its optional description bullets) -- both scrubbed here, alongside
  // experience/projects/customSections' own bullet (and position/sub-bullet) tags.
  ['experience','projects','customSections','publications'].forEach(kind=>{
    next[kind] = (library[kind]||[]).map(e=>{
      let ne = 'tags' in e ? {...e, tags:scrub(e.tags)} : e;
      if(ne.bullets) ne = {...ne, bullets: scrubBulletsTags(ne.bullets, scrub)};
      if(ne.positions) ne = {...ne, positions: ne.positions.map(p=>({...p, tags:scrub(p.tags), bullets: scrubBulletsTags(p.bullets, scrub)}))};
      return ne;
    });
  });
  next.skills = (library.skills||[]).map(s=>({...s, tags:scrub(s.tags)}));
  next.certifications = (library.certifications||[]).map(c=>({...c, tags:scrub(c.tags)}));
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
  // Positions/sub-bullets/publications didn't exist before this migration was written, so any
  // library old enough to still need migrating can't have raw free-text tags sitting on them --
  // nothing to remap there. publications' own bullets/entry-level tags are included below
  // defensively (a hand-built import could still carry raw text there), same reasoning
  // libRemoveTagOption() above uses.
  ['experience','projects','customSections','publications'].forEach(kind=>{
    next[kind] = (library[kind]||[]).map(e=>{
      let ne = 'tags' in e ? {...e, tags:remap(e.tags)} : e;
      if(ne.bullets) ne = {...ne, bullets: ne.bullets.map(b=>({...b, tags:remap(b.tags)}))};
      return ne;
    });
  });
  next.skills = (library.skills||[]).map(s=>({...s, tags:remap(s.tags)}));
  next.certifications = (library.certifications||[]).map(c=>({...c, tags:remap(c.tags)}));
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
// Per-position include/exclude, independent of the whole entry being included -- e.g. show
// 2 of 3 roles at a company on a shorter resume. Tracked as `excludedPositionIds` (which
// positions are turned OFF) rather than an included-list, deliberately: a newly added position
// should default to included with no action needed, which "absent from an excluded list"
// gives for free -- an included-list would need every new position actively added to a
// whitelist the moment it's created, which is the wrong default here.
function versionSetPositionIncluded(version, kind, refId, positionId, included){
  const list = version.selection[kind].map(x=>{
    if(x.refId!==refId) return x;
    const excluded = x.excludedPositionIds || [];
    const has = excluded.includes(positionId);
    let excludedPositionIds;
    if(!included && !has) excludedPositionIds = [...excluded, positionId];
    else if(included && has) excludedPositionIds = excluded.filter(id=>id!==positionId);
    else excludedPositionIds = excluded;
    return {...x, excludedPositionIds};
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
// Walks a flat bullets array (including one level of sub-bullet children) and toggles on every
// bullet/child carrying tagId, via the caller's own toggle function -- shared by
// versionFillByTag()/versionRemoveByTag() below (`included` picks the direction). Returns
// {v, matched} so the caller knows whether anything in this array actually matched, since that
// decides whether the *entry* (or position) itself needs including/excluding too.
function bulletsHaveTag(bullets, tagId){
  return (bullets||[]).some(b=> (b.tags||[]).includes(tagId) || (b.children||[]).some(c=>(c.tags||[]).includes(tagId)));
}
function walkBulletsForTag(v, kind, entryId, bullets, tagId, included){
  (bullets||[]).forEach(b=>{
    if((b.tags||[]).includes(tagId)) v = versionToggleBullet(v, kind, entryId, b.id, included);
    (b.children||[]).forEach(c=>{
      if((c.tags||[]).includes(tagId)) v = versionToggleBullet(v, kind, entryId, c.id, included);
    });
  });
  return v;
}
function versionFillByTag(version, library, tagId){
  let v = version;
  // publications' own optional bullets participate in the same per-bullet tag matching
  // experience/projects/customSections bullets already do; certifications has no bullets at
  // all, so it's handled separately below alongside its entry-level tag only.
  //
  // Order matters here: versionToggleRef() must run BEFORE any versionToggleBullet()/
  // versionSetPositionIncluded() call for this entry -- both of those are no-ops against a ref
  // that isn't in version.selection[kind] yet (they .map() the existing list looking for a
  // match), so the ref has to exist first. bulletsHaveTag()/entry.tags/position.tags are
  // checked read-only first specifically to decide whether the ref belongs in the version at
  // all *before* touching anything -- only once that's settled do the actual toggles run.
  ['experience','projects','customSections','publications'].forEach(kind=>{
    (library[kind]||[]).forEach(entry=>{
      const flatMatch = bulletsHaveTag(entry.bullets, tagId);
      const matchingPositions = (entry.positions||[]).filter(pos=>
        (pos.tags||[]).includes(tagId) || bulletsHaveTag(pos.bullets, tagId));
      const matched = flatMatch || matchingPositions.length>0 || (entry.tags||[]).includes(tagId);
      if(!matched) return;
      v = versionToggleRef(v, kind, entry.id, true);
      v = walkBulletsForTag(v, kind, entry.id, entry.bullets, tagId, true);
      matchingPositions.forEach(pos=>{
        v = versionSetPositionIncluded(v, kind, entry.id, pos.id, true);
        v = walkBulletsForTag(v, kind, entry.id, pos.bullets, tagId, true);
      });
    });
  });
  (library.certifications||[]).forEach(entry=>{
    if((entry.tags||[]).includes(tagId)) v = versionToggleRef(v, 'certifications', entry.id, true);
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
  ['experience','projects','customSections','publications'].forEach(kind=>{
    (library[kind]||[]).forEach(entry=>{
      v = walkBulletsForTag(v, kind, entry.id, entry.bullets, tagId, false);
      (entry.positions||[]).forEach(pos=>{
        v = walkBulletsForTag(v, kind, entry.id, pos.bullets, tagId, false);
        if((pos.tags||[]).includes(tagId)) v = versionSetPositionIncluded(v, kind, entry.id, pos.id, false);
      });
      // Mirrors the original single-level rule: if this entry ends up with nothing left
      // selected at all (no bullets, and -- for a positioned entry -- every position now
      // excluded), drop the ref itself too, same as fill only ever included it because it had
      // matching content in the first place.
      const sel = v.selection[kind].find(s=>s.refId===entry.id);
      if(sel){
        const noBullets = !sel.bulletIds || sel.bulletIds.length===0;
        const posCount = (entry.positions||[]).length;
        const allPosExcluded = posCount>0 && (sel.excludedPositionIds||[]).length===posCount;
        if(noBullets && (posCount===0 || allPosExcluded)) v = versionToggleRef(v, kind, entry.id, false);
      }
    });
  });
  (library.certifications||[]).forEach(entry=>{
    if((entry.tags||[]).includes(tagId)) v = versionToggleRef(v, 'certifications', entry.id, false);
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
// A position's own equivalent of versionSetOverride/versionClearOverride above, addressed one
// level down: `field` is one of a position's own fields (role/dates/location/subheading/
// contentType/text -- deliberately never `bullets`, which is addressed via
// versionSetBulletOverride() itself, unchanged, since a bullet's own overrides don't care
// which position it lives under). Stored as `positionOverrides:{[positionId]:{field:value}}`,
// parallel to but separate from the entry-level `overrides` object -- keeping the two apart
// means resolveVersion() below never has to guess which level a given override key belongs to.
function versionSetPositionOverride(version, kind, refId, positionId, field, value){
  const list = version.selection[kind].map(x=>{
    if(x.refId!==refId) return x;
    const positionOverrides = {...(x.positionOverrides||{})};
    positionOverrides[positionId] = {...(positionOverrides[positionId]||{}), [field]:value};
    return {...x, positionOverrides};
  });
  return {...version, selection:{...version.selection, [kind]:list}};
}
function versionClearPositionOverride(version, kind, refId, positionId, field){
  const list = version.selection[kind].map(x=>{
    if(x.refId!==refId || !x.positionOverrides || !x.positionOverrides[positionId] || !(field in x.positionOverrides[positionId])) return x;
    const positionOverrides = {...x.positionOverrides};
    const fields = {...positionOverrides[positionId]};
    delete fields[field];
    if(Object.keys(fields).length) positionOverrides[positionId] = fields; else delete positionOverrides[positionId];
    return {...x, positionOverrides};
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
    ['experience','projects','education','skills','references','customSections','publications','certifications'].forEach(kind=>{
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
  // Resolves one flat bullets array (used for both a flat entry's own `bullets` and a single
  // position's own `bullets`) against `sel.bulletIds`/`sel.bulletOverrides` -- bulletIds stays
  // one flat array of globally-unique bullet ids regardless of which position a bullet lives
  // under, so this needs no positionId of its own; it's simply called once per array. One level
  // of sub-bullet `children` is resolved the same way, recursively-in-spirit but only one level
  // deep (children never have their own children).
  function resolveBulletArray(sel, bullets){
    if(!sel.bulletIds) return bullets;
    return (bullets||[]).filter(b=>sel.bulletIds.includes(b.id)).map(b=>{
      const ov = sel.bulletOverrides && sel.bulletOverrides[b.id];
      let rb = ov!=null ? {...b, text:ov} : b;
      if(rb.children && rb.children.length){
        rb = {...rb, children: rb.children.filter(c=>sel.bulletIds.includes(c.id)).map(c=>{
          const cov = sel.bulletOverrides && sel.bulletOverrides[c.id];
          return cov!=null ? {...c, text:cov} : c;
        })};
      }
      return rb;
    });
  }
  function resolveKind(kind){
    // Both sides tolerate absence: a version saved before publications/certifications (or any
    // future kind) existed has no such key on its own selection object at all, same as a
    // library saved before this feature has no such array either -- both read as "nothing
    // selected yet" rather than throwing, no migration required for either side.
    return (version.selection[kind]||[]).map(sel=>{
      const entry = (library[kind]||[]).find(e=>e.id===sel.refId);
      if(!entry){ dropped.push(kind+':'+sel.refId); return null; }
      let resolved = sel.overrides ? {...entry, ...sel.overrides} : entry;
      if(entry.positions){
        // Positioned entry: excludedPositionIds drops whichever positions this version turned
        // off (#5), positionOverrides shadows a position's own field(s) for this version alone
        // (the per-position "only this version" scope), and each surviving position's own
        // bullets resolve through the exact same flat-bulletIds mechanism a non-positioned
        // entry's bullets always have.
        const excluded = sel.excludedPositionIds || [];
        resolved = {...resolved, positions: entry.positions
          .filter(p=>!excluded.includes(p.id))
          .map(p=>{
            const posOv = sel.positionOverrides && sel.positionOverrides[p.id];
            const rp = posOv ? {...p, ...posOv} : p;
            return {...rp, bullets: resolveBulletArray(sel, p.bullets)};
          })};
      } else if(sel.bulletIds){
        resolved = {...resolved, bullets: resolveBulletArray(sel, entry.bullets)};
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
    publications: resolveKind('publications'),
    certifications: resolveKind('certifications'),
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
  return ensureVersionSelectionShape({
    ...cloned,
    id: uid(),
    standalone: true,
    embeddedLibrary: buildEmbeddedLibrary(incomingLibrary),
    createdAt: Date.now(), updatedAt: Date.now(), main: false
  });
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
// Fresh ids for a bullets array and, one level deep, its own sub-bullet children -- shared by
// the top-level bullets case and the positions case below, so copyEntryForLibrary()'s own
// "never alias back to the embedded original" guarantee holds at every level, not just the
// entry itself.
function freshBulletsForLibrary(bullets){
  return (bullets||[]).map(b=>({
    ...b, id: uid(), tags: [],
    children: b.children ? b.children.map(c=>({...c, id: uid(), tags: []})) : b.children
  }));
}
function copyEntryForLibrary(entry){
  const copy = JSON.parse(JSON.stringify(entry));
  copy.id = uid();
  if(copy.bullets) copy.bullets = freshBulletsForLibrary(copy.bullets);
  // Positions carry their own id, own tags, and own bullets (which need the exact same fresh-id
  // treatment) -- without this, a copied positioned entry would keep the embedded original's
  // position/bullet ids verbatim, exactly the aliasing risk this function exists to prevent.
  if(copy.positions) copy.positions = copy.positions.map(p=>({...p, id: uid(), tags: [], bullets: freshBulletsForLibrary(p.bullets)}));
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
  emptyLibrary, defaultStyle, normalizeFontFamily, blankVersion, newLibraryEntry, newBullet, newSubBullet,
  newPosition, libAddPosition, libRemovePosition, libMovePosition, libConvertEntryToPositions,
  libAddEntry, libRemoveEntry, libAddBullet, libRemoveBullet, libAddSubBullet, libRemoveSubBullet,
  libMoveBullet, libMoveSubBullet,
  libEditEntry, libEditBullet, libToggleSkillGroupCategory,
  libRemoveTagOption, resolveTagLabels, migrateTagOptions,
  versionToggleRef, versionToggleBullet, versionSetPositionIncluded, versionFillByTag, versionRemoveByTag,
  findSummaryByTag, resolveVersion,
  versionSetOverride, versionClearOverride, versionSetBulletOverride, versionClearBulletOverride,
  versionSetPositionOverride, versionClearPositionOverride,
  versionSetSkillGroupOverride, versionClearSkillGroupOverride, buildUsageIndex,
  resolveSectionOrder, sectionOrderAdd, sectionOrderRemove, moveSectionOrder,
  BUILTIN_SECTION_ORDER,
  libraryFor, buildEmbeddedLibrary, buildStandaloneVersion, copyEntryForLibrary,
  ensureVersionSelectionShape
};
