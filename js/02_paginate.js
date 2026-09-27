/* Packs measured units into pages.
   units: [{height:Number, gapBefore:Number}]  -- gapBefore only applied if NOT first on a page
   usableHeightPx: Number
   returns: [[unitIndex,...], ...] one array of indices per page
   Guarantees: every unit appears exactly once; a unit that alone exceeds
   the page height is still placed alone on its own page (never dropped). */
function packUnits(units, usableHeightPx){
  const pages = [];
  let current = [];
  let remaining = usableHeightPx;
  for(let i=0;i<units.length;i++){
    const u = units[i];
    const needed = u.height + (current.length>0 ? u.gapBefore : 0);
    if(current.length===0 || needed <= remaining){
      current.push(i);
      remaining -= needed;
    } else {
      pages.push(current);
      current = [i];
      remaining = usableHeightPx - u.height;
    }
  }
  if(current.length) pages.push(current);
  return pages;
}

/* Merge a heading unit with the first content unit of its section so they
   never separate (orphan-heading protection). Returns a new units array
   with the same total unit "identity" preserved via the `refs` field so
   callers can map back to DOM nodes: each output unit has refs:[origIndex,...] */
function glueHeadings(rawUnits){
  const out = [];
  let i = 0;
  while(i < rawUnits.length){
    const u = rawUnits[i];
    if(u.isHeading && i+1 < rawUnits.length){
      const next = rawUnits[i+1];
      out.push({
        height: u.height + next.height + (u.headingGap||0),
        gapBefore: u.gapBefore,
        refs: [i, i+1]
      });
      i += 2;
    } else {
      out.push({ height:u.height, gapBefore:u.gapBefore, refs:[i] });
      i += 1;
    }
  }
  return out;
}

/* Which pages, out of paginate()'s own per-page fill ratios (content height / true usable
   height -- see paginate()'s own PAGE_FILL_RATIOS comment, js/06_app.js), are close enough to
   full that a real screen-vs-print measurement gap could plausibly tip them over the true page
   boundary -- and so are worth a real server-side verification pass (pdf-service's own /measure
   endpoint) rather than trusting the local, in-browser measurement blindly. The threshold (0.90
   by default) is deliberately well above the known historical screen-vs-print variance (~3-5%)
   -- a page comfortably under it has enough headroom that even that variance can't push its
   real content past the true page height, so it's safe to trust without ever paying for a round
   trip. Returns page indices (0-based, into the same array PAGE_UNIT_MAP/PAGE_FILL_RATIOS use),
   not the ratios themselves.
   Neither this threshold nor packUnits() itself apply any capacity-shrinking safety margin of
   their own -- an earlier applyPrintSafety()/PAGE_PRINT_SAFETY_FACTOR (a 3.5% shrink, applied
   both here in local packing and inside /measure) was removed entirely on direct request, once
   every export path was made to force a real, awaited call to /measure before trusting local
   pagination at all (downloadPdf()'s runLayoutReconciliation(), js/06_app.js) -- with two
   independent pdf-service hosts, that real Chromium check is trusted as the actual ground truth
   rather than hedged against with a shrink anywhere in the pipeline. */
const PAGE_RISK_THRESHOLD = 0.90;
function pagesAtRisk(fillRatios, threshold){
  const t = threshold==null ? PAGE_RISK_THRESHOLD : threshold;
  const out = [];
  for(let i=0;i<fillRatios.length;i++) if(fillRatios[i] >= t) out.push(i);
  return out;
}

if(typeof module !== 'undefined') module.exports = { packUnits, glueHeadings, pagesAtRisk, PAGE_RISK_THRESHOLD };
