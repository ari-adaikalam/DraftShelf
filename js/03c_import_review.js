/* ===== Import Review -- pure reconciliation engine for merging an imported JSON file's
   Library content into an existing account's Library, instead of replacing it wholesale
   (see js/06_app.js's onImportFile()/openImportReview() for the DOM/wiring half). Kept in
   its own file, independent of any rendering, so the matching/apply logic is testable with
   plain require() and so a future alternate review UI (e.g. a step-by-step wizard) could
   reuse it without re-deriving any of this. =====

   Kinds are always processed in this order -- skillGroups depends on skills having already
   been reconciled in the same applyImportReview() call, since a skill set's categoryIds
   need remapping through the skills remap table built one step earlier. */
const IMPORT_REVIEW_KINDS = ['experience','projects','education','skills','skillGroups','summaries','references','customSections'];
// summaries:'text' -- not 'label'. Summaries no longer have a label field at all (replaced by
// the shared tags[] system, see newLibraryEntry('summaries') in js/03_model.js); the only
// remaining identifying content is the summary's own text, so that's what an incoming summary
// is matched against an existing one by (exact, case-insensitive, trimmed -- same as every
// other kind here).
const IMPORT_REVIEW_MATCH_FIELD = {
  experience:'company', projects:'title', education:'school', skills:'label',
  skillGroups:'label', summaries:'text', references:'name', customSections:'heading'
};
// Fixed allowlist for buildImportReview()'s header/meta diffing below -- library.meta's own
// shape (see emptyLibrary() in 03_model.js) has exactly these 7 keys. Without this, an
// untrusted incoming file with an unexpected extra key on its `meta` object (typo, a field
// from a future schema version, or a hand-crafted file) would surface as a diffed field the
// user could choose "Use imported" for, writing an arbitrary key onto LIBRARY.meta that
// nothing else in the app expects.
const IMPORT_REVIEW_META_ALLOWLIST = ['name','phone','email','location','linkedin','github','portfolio'];
// Kinds/entries that carry bullets worth reviewing one-by-one when merged into an existing
// entry -- customSections only when contentType is 'bullets' (a paragraph section has none).
function importReviewEntryHasBullets(kind, entry){
  if(kind==='experience' || kind==='projects') return true;
  if(kind==='customSections') return entry.contentType==='bullets';
  return false;
}
function matchKey(v){ return (v||'').trim().toLowerCase(); }

// Resolves an incoming (untrusted, plain-text) bullet's own tags against the account's
// existing tag pool by exact, case-insensitive label match -- used both to pre-check the
// Import Review picker (an incoming tag with no matching pool label simply isn't pre-checked,
// not auto-created -- Manage Tags remains the only place a new pool entry is created) and, for
// a whole "new entry" import (no per-bullet review UI at all -- see applyImportReview() below),
// to resolve its bullets' tags directly at apply time.
function resolveIncomingTagIds(tagOptions, incomingTags){
  const pool = tagOptions||[];
  return (incomingTags||[]).map(t=>{
    const key = matchKey(t);
    const found = pool.find(o=>matchKey(o.label)===key);
    return found ? found.id : null;
  }).filter(Boolean);
}

// Suggests a decision for each of an incoming entry's bullets against an already-matched
// existing entry's bullets -- exact, case-insensitive, trimmed text match only (no fuzzy
// matching, an explicit v1 boundary). Shared by buildImportReview() below and by the
// editor's own "re-suggest bullets when the user manually changes the merge target"
// handling (js/06_app.js).
function suggestBulletDecisions(sourceBullets, targetBullets, tagOptions){
  return (sourceBullets||[]).map(b=>{
    const key = matchKey(b.text);
    const match = (targetBullets||[]).find(tb=>matchKey(tb.text)===key);
    return { incomingId:b.id, action: match?'same':'add', sameAsBulletId: match?match.id:null, tags: resolveIncomingTagIds(tagOptions, b.tags) };
  });
}

/* Builds the suggested review state for one imported file against the account's current
   library -- pure, no mutation of either argument. UI code (js/06_app.js) renders this,
   lets the user change any decision, then passes the (possibly-edited) `sections` back into
   applyImportReview() (Task 2). */
function buildImportReview(library, incomingLibrary){
  const metaFields = [];
  if(incomingLibrary.meta){
    IMPORT_REVIEW_META_ALLOWLIST.forEach(key=>{
      const incomingValue = incomingLibrary.meta[key];
      const currentValue = (library.meta||{})[key] || '';
      if(incomingValue && incomingValue !== currentValue) metaFields.push({key, currentValue, incomingValue});
    });
  }
  const sections = {};
  IMPORT_REVIEW_KINDS.forEach(kind=>{
    const field = IMPORT_REVIEW_MATCH_FIELD[kind];
    const existing = library[kind]||[];
    const incoming = incomingLibrary[kind]||[];
    sections[kind] = incoming.map(entry=>{
      const key = matchKey(entry[field]);
      // A real, reported gap: if more than one existing entry shares the same matchKey (two
      // "Acme Corp" experience entries, say), the old `.find()` silently picked whichever
      // happened to come first -- an arbitrary, possibly-wrong merge target with no signal to
      // the user that a choice was even made. Ambiguous now suggests "New" instead (the safe
      // default -- nothing gets silently merged into the wrong entry); the entry's merge
      // dropdown still lists every candidate, so the user can pick the right one by hand.
      const candidates = key ? existing.filter(e=>matchKey(e[field])===key) : [];
      const match = candidates.length===1 ? candidates[0] : null;
      const action = match ? 'merge' : 'new';
      const bullets = (action==='merge' && importReviewEntryHasBullets(kind, entry))
        ? suggestBulletDecisions(entry.bullets, match.bullets, library.tagOptions)
        : [];
      return { incomingId:entry.id, action, mergeTargetId: match?match.id:null, bullets };
    });
  });
  return { metaFields, sections };
}

// Copies every field from `source` onto `target` except the ones in `skip` -- used to fill a
// freshly-created blank library entry with an imported entry's real values without having to
// hardcode each kind's own field list (which differ per kind).
function copyEntryFields(target, source, skip){
  Object.keys(source).forEach(k=>{ if(skip.indexOf(k)===-1) target[k] = source[k]; });
}

/* Applies a (possibly user-edited) review's decisions: creates/merges real Library rows via
   the existing pure reducers (libAddEntry/libAddBullet/libToggleSkillGroupCategory), and
   builds a remap table (incoming id -> real id, or null if discarded) for every entry and
   bullet processed. `includeMap` is {kind: boolean} -- a kind not included is skipped
   entirely (nothing created, no remap entries at all for it), so any version selection
   pointing into it resolves through remapVersionSelection() (Task 3) as a dropped reference,
   the same tolerance every other dangling reference in this app already has.
   `incomingLibrary` is only ever read, never mutated. Returns {library, remap}. */
function applyImportReview(library, incomingLibrary, sections, includeMap){
  let lib = library;
  const remap = {};
  IMPORT_REVIEW_KINDS.forEach(kind=>{
    if(!includeMap[kind]) return;
    const incomingEntries = incomingLibrary[kind]||[];
    const decisions = sections[kind]||[];
    decisions.forEach(decision=>{
      const source = incomingEntries.find(e=>e.id===decision.incomingId);
      if(!source) return;
      let targetId;
      if(decision.action==='new'){
        lib = libAddEntry(lib, kind);
        const created = lib[kind][lib[kind].length-1];
        // 'tags' always skipped by copyEntryFields, then resolved separately below -- the same
        // raw-text-must-become-pool-ids fix already applied to bullet tags (see
        // resolveIncomingTagIds()'s own comment) applies equally to a skill category's or
        // summary's own top-level tags[] field; copying it verbatim here would leak untrusted
        // raw text into a field every other part of the app expects to hold only pool ids.
        const skip = kind==='skillGroups' ? ['id','categoryIds'] : ['id','bullets','tags'];
        copyEntryFields(created, source, skip);
        if('tags' in created) created.tags = resolveIncomingTagIds(library.tagOptions, source.tags);
        targetId = created.id;
        if(kind==='skillGroups'){
          (source.categoryIds||[]).forEach(catId=>{
            const realCatId = remap['skills:'+catId];
            if(realCatId) lib = libToggleSkillGroupCategory(lib, targetId, realCatId, true);
          });
        } else if(importReviewEntryHasBullets(kind, source)){
          (source.bullets||[]).forEach(b=>{
            lib = libAddBullet(lib, kind, targetId);
            const target = lib[kind].find(e=>e.id===targetId);
            const createdBullet = target.bullets[target.bullets.length-1];
            createdBullet.text = b.text; createdBullet.tags = resolveIncomingTagIds(library.tagOptions, b.tags);
            remap[kind+':bullet:'+b.id] = createdBullet.id;
          });
        }
      } else { // 'merge'
        targetId = decision.mergeTargetId;
        if(kind==='skillGroups'){
          (source.categoryIds||[]).forEach(catId=>{
            const realCatId = remap['skills:'+catId];
            if(realCatId) lib = libToggleSkillGroupCategory(lib, targetId, realCatId, true);
          });
        } else if(importReviewEntryHasBullets(kind, source)){
          (decision.bullets||[]).forEach(bd=>{
            if(bd.action==='discard'){ remap[kind+':bullet:'+bd.incomingId] = null; return; }
            if(bd.action==='same'){ remap[kind+':bullet:'+bd.incomingId] = bd.sameAsBulletId; return; }
            const b = (source.bullets||[]).find(x=>x.id===bd.incomingId);
            if(!b) return;
            lib = libAddBullet(lib, kind, targetId);
            const target = lib[kind].find(e=>e.id===targetId);
            const createdBullet = target.bullets[target.bullets.length-1];
            createdBullet.text = b.text; createdBullet.tags = (bd.tags||[]).slice();
            remap[kind+':bullet:'+b.id] = createdBullet.id;
          });
        }
      }
      remap[kind+':'+source.id] = targetId;
    });
  });
  return { library: lib, remap };
}

/* Rewrites a version's selection through an applyImportReview() remap table -- every refId
   and bulletIds entry is looked up; a missing/null result (discarded, or its kind was
   excluded this round) is simply dropped from the resulting array, the same tolerance
   resolveVersion() already has for any other dangling reference. skillGroupId and summaryId
   are remapped the same way, through their respective 'skillGroups:' and 'summaries:'
   prefixes; a version with no skill set/summary selected stays null. */
function remapVersionSelection(selection, remap){
  const next = {...selection};
  IMPORT_REVIEW_KINDS.filter(k=>k!=='skillGroups' && k!=='summaries').forEach(kind=>{
    const list = selection[kind]||[];
    next[kind] = list.map(sel=>{
      const realId = remap[kind+':'+sel.refId];
      if(!realId) return null;
      const out = {...sel, refId:realId};
      if(sel.bulletIds) out.bulletIds = sel.bulletIds.map(bid=>remap[kind+':bullet:'+bid]).filter(Boolean);
      return out;
    }).filter(Boolean);
  });
  if(selection.skillGroupId){
    next.skillGroupId = remap['skillGroups:'+selection.skillGroupId] || null;
  }
  if(selection.summaryId){
    next.summaryId = remap['summaries:'+selection.summaryId] || null;
  }
  return next;
}

/* Applies the user's chosen header/contact field values (see buildImportReview()'s
   metaFields) onto a library's meta object -- pure, returns a new library, does not mutate
   the one passed in. `chosen` is {key: 'current'|'imported'}; any key not present in it (the
   user never made a choice, or the field never differed to begin with) keeps its current
   value -- "keep current" is the safe default throughout. */
function applyImportMetaDecisions(library, incomingMeta, metaFields, chosen){
  const meta = {...library.meta};
  metaFields.forEach(f=>{
    if(chosen[f.key]==='imported') meta[f.key] = incomingMeta[f.key];
  });
  return {...library, meta};
}

if(typeof module !== 'undefined') module.exports = {
  IMPORT_REVIEW_KINDS, IMPORT_REVIEW_MATCH_FIELD, IMPORT_REVIEW_META_ALLOWLIST, importReviewEntryHasBullets,
  suggestBulletDecisions, resolveIncomingTagIds, buildImportReview, applyImportReview,
  remapVersionSelection, applyImportMetaDecisions
};
