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

/* Chromium's print-to-PDF pipeline (pdf-service, see CLAUDE.md's "PDF export" section)
   sometimes measures the same rendered content a few percent taller than the browser's own
   on-screen getBoundingClientRect() measurement that paginate() uses to pack pages. Packing
   pages flush to the exact page height risks a real, reproduced bug: the live preview shows
   N pages while the actual exported PDF spills a line or two onto page N+1, because the
   print engine's slightly-taller rendering no longer fits what the screen said would fit.
   This trims the packing capacity slightly so pages always have a little slack to absorb
   that gap -- applied once, at the capacity passed into packUnits(), not to any element's
   actual on-screen size (so the live preview's layout is untouched; only how much content
   paginate() is willing to pack onto one page changes). */
const PAGE_PRINT_SAFETY_FACTOR = 0.965;
function applyPrintSafety(usableHeightPx){
  return usableHeightPx * PAGE_PRINT_SAFETY_FACTOR;
}

if(typeof module !== 'undefined') module.exports = { packUnits, glueHeadings, applyPrintSafety, PAGE_PRINT_SAFETY_FACTOR };
