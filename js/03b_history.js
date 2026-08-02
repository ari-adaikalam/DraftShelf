/* ===== undo/redo history: pure, whole-snapshot stacks (runtime-only -- never persisted,
   never synced to Supabase; see the migration plan's requirement 5). Every reducer in
   03_model.js already produces a full new state object per mutation, so snapshotting the
   whole object costs nothing extra to produce -- historyCap() bounds the only real cost,
   memory, by entry count and total JSON size. ===== */
function historyCreate(){ return { past: [], future: [] }; }

function historyPush(hist, snapshot){
  return { past: hist.past.concat([snapshot]), future: [] };
}

function historyUndo(hist, current){
  if(!hist.past.length) return { hist, current };
  const prev = hist.past[hist.past.length - 1];
  const past = hist.past.slice(0, -1);
  const future = hist.future.concat([current]);
  return { hist: { past, future }, current: prev };
}

function historyRedo(hist, current){
  if(!hist.future.length) return { hist, current };
  const next = hist.future[hist.future.length - 1];
  const future = hist.future.slice(0, -1);
  const past = hist.past.concat([current]);
  return { hist: { past, future }, current: next };
}

function historyCap(hist, { maxEntries, maxBytes } = {}){
  let past = hist.past;
  if(maxEntries != null && past.length > maxEntries){
    past = past.slice(past.length - maxEntries);
  }
  if(maxBytes != null){
    let total = past.reduce((sum, s) => sum + JSON.stringify(s).length, 0);
    let start = 0;
    while(total > maxBytes && start < past.length - 1){
      total -= JSON.stringify(past[start]).length;
      start++;
    }
    if(start > 0) past = past.slice(start);
  }
  return { past, future: hist.future };
}

if(typeof module !== 'undefined') module.exports = { historyCreate, historyPush, historyUndo, historyRedo, historyCap };
