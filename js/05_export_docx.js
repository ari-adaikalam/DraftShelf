function buildDocxDocument(docxLib, resolved, style, pageSize, meta, referencesMode, sectionOrder){
  const { Document, Paragraph, TextRun, ExternalHyperlink, AlignmentType, TabStopType, convertInchesToTwip } = docxLib;

  const pageInches = pageSize === 'Letter' ? {w:8.5, h:11} : {w:8.27, h:11.69};
  const usableWidthTwips = convertInchesToTwip(pageInches.w - style.marginLeft - style.marginRight);

  const FONT = style.fontFamily.replace(/["']/g,'').split(',')[0].trim() || 'Times New Roman';
  const pt2half = pt => Math.round(pt*2);
  const bodyAlignment = style.bodyAlign === 'left' ? AlignmentType.LEFT : AlignmentType.JUSTIFIED;
  const order = Array.isArray(sectionOrder) && sectionOrder.length ? sectionOrder : ['experience','projects','education','skills','references','publications','certifications'];

  // Italic mirrors Bold's own flag keys (see defaultStyle()'s comment, js/03_model.js) --
  // style.italic may be absent on a version saved before this existed, guarded the same way
  // style.bold's own absence never was (bold has always been required), no migration needed.
  function bd(text, flagKey){ return { text: text||'', bold: !!(style.bold && style.bold[flagKey]), italics: !!(style.italic && style.italic[flagKey]) }; }

  function splitBoldRuns(text, sizePt){
    return parseInlineBold(text).map(seg => new TextRun({ text: seg.text, bold: seg.bold, italics: seg.italic, font: FONT, size: pt2half(sizePt) }));
  }

  function headingParagraph(text){
    const runs = [ new TextRun({ text: style.headingUppercase ? text.toUpperCase() : text, bold:true, font:FONT, size: pt2half(style.fsHeading) }) ];
    return new Paragraph({
      children: runs,
      alignment: style.headingAlign === 'center' ? AlignmentType.CENTER : AlignmentType.LEFT,
      spacing: { before: style.headingGapAbove*20, after: style.headingGapBelow*20 },
      border: style.headingUnderline ? { bottom: { color:'000000', space:1, style:'single', size: Math.max(2, style.headingUnderlineThickness*4) } } : undefined
    });
  }

  function rowParagraph(leftRuns, rightText, sizePt){
    const children = [...leftRuns];
    if(rightText){
      children.push(new TextRun({ text:'\t'+rightText, font:FONT, size: pt2half(sizePt) }));
    }
    return new Paragraph({
      children,
      tabStops: [{ type: TabStopType.RIGHT, position: usableWidthTwips }],
      spacing: { after: 20 }
    });
  }

  function bulletParagraph(text, sizePt, indentLevel){
    const base = 0.22 + (indentLevel||0)*0.22;
    return new Paragraph({
      children: [ new TextRun({ text: style.bulletMarker+'  ', font:FONT, size: pt2half(sizePt) }), ...splitBoldRuns(text, sizePt) ],
      alignment: bodyAlignment,
      indent:{ left: convertInchesToTwip(base), hanging: convertInchesToTwip(0.18) },
      spacing:{ after: style.gapBullet*20 }
    });
  }
  // Emits one bulletParagraph per bullet, plus one more per child directly after its parent,
  // indented one level further -- mirrors buildBulletListInner()'s js/06_app.js live-preview
  // treatment (one level of sub-bullets, never nested deeper).
  function bulletParagraphs(bullets, sizePt){
    const out = [];
    (bullets||[]).forEach(b=>{
      out.push(bulletParagraph(b.text, sizePt, 0));
      (b.children||[]).forEach(c=> out.push(bulletParagraph(c.text, sizePt, 1)));
    });
    return out;
  }

  function paragraphBlock(text, sizePt, afterPt){
    return new Paragraph({ alignment: bodyAlignment, spacing:{after:afterPt*20}, children: splitBoldRuns(text, sizePt) });
  }

  // Citation-style link, matching buildCitationLinkNode()'s live-preview/PDF treatment
  // (normalizeUrl(), the standard hyperlink-blue Word "Hyperlink" style) -- shared by the
  // Publications/Certifications branches below.
  function citationLinkParagraph(url, label, sizePt){
    return new Paragraph({ spacing:{after:2*20}, children:[
      new ExternalHyperlink({ link: normalizeUrl(url), children:[ new TextRun({ text: label||url, style:'Hyperlink', font:FONT, size: pt2half(sizePt) }) ] })
    ]});
  }

  const children = [];
  children.push(new Paragraph({ alignment:AlignmentType.CENTER, spacing:{after:20},
    children:[ new TextRun({ text: meta.name||'Your Name', bold:true, font:FONT, size: pt2half(style.fsName) }) ] }));

  // Order: Location, Phone, Email, LinkedIn, GitHub, Portfolio -- on request, matching
  // buildHeaderNode()'s own js/06_app.js order exactly.
  const contactRuns = [];
  const contactSep = () => new TextRun({ text:'   |   ', font:FONT, size: pt2half(style.fsContact) });
  if(meta.location) contactRuns.push(new TextRun({ text: meta.location, font:FONT, size: pt2half(style.fsContact) }));
  if(meta.phone){
    if(contactRuns.length) contactRuns.push(contactSep());
    contactRuns.push(new TextRun({ text: meta.phone, font:FONT, size: pt2half(style.fsContact) }));
  }
  if(meta.email){
    if(contactRuns.length) contactRuns.push(contactSep());
    contactRuns.push(new ExternalHyperlink({
      link: 'mailto:'+meta.email,
      children: [ new TextRun({ text: meta.email, style:'Hyperlink', font:FONT, size: pt2half(style.fsContact) }) ]
    }));
  }
  [['LinkedIn', meta.linkedin], ['GitHub', meta.github], ['Portfolio', meta.portfolio]].forEach(([label, val]) => {
    if(!val) return;
    if(contactRuns.length) contactRuns.push(contactSep());
    contactRuns.push(new ExternalHyperlink({
      link: normalizeUrl(val),
      children: [ new TextRun({ text: label, style:'Hyperlink', font:FONT, size: pt2half(style.fsContact) }) ]
    }));
  });
  children.push(new Paragraph({ alignment:AlignmentType.CENTER, spacing:{after:style.gapSection*20}, children: contactRuns }));

  if(resolved.summary && resolved.summary.trim()){
    children.push(headingParagraph(resolved.summaryHeading || 'Summary'));
    children.push(paragraphBlock(resolved.summary, style.fsBody, style.gapSection));
  }

  order.forEach(token=>{
    if(token === 'experience'){
      if(!resolved.experience.length) return;
      children.push(headingParagraph('Work Experience'));
      resolved.experience.forEach(e=>{
        // e.tag ("Note (optional)" in the Library tab -- company/role/dates/location's own
        // sibling field, predates the separate tags[] system) prints in the live preview/PDF
        // as "Company (tag)" (buildExperienceEntryNode(), js/06_app.js) but was missing here
        // entirely -- a real, documented gap (CLAUDE.md's "Skill Sets" section notes it under
        // "still missing from DOCX export"). Appended as its own non-bold run, matching the
        // preview's `font-weight:400` treatment regardless of whether Company itself is bold.
        const companyRuns = [ new TextRun({...bd(e.company,'company'), font:FONT, size:pt2half(style.fsBody)}) ];
        if(e.tag) companyRuns.push(new TextRun({ text:' ('+e.tag+')', font:FONT, size:pt2half(style.fsBody) }));
        // Multiple positions under one shared company -- the company/tag row prints once,
        // then each position's own role/dates/bullets, matching buildExperiencePositionNode()
        // in js/06_app.js exactly (heading glued to the first position there is purely a
        // pagination concern; DOCX has no page-break engine of its own, so every position
        // just prints in order with no special-casing needed for "first").
        if(e.positions && e.positions.length){
          // Same location/dates fallback as the flat branch below, computed against the
          // *first* position only -- a later position has no location row of its own to fall
          // back into (only the first position's row glues to the shared company row), same
          // as buildExperiencePositionNode()'s own js/06_app.js treatment.
          const firstSlots = locationDatesSlots(e.positions[0].location||e.location, e.positions[0].dates);
          children.push(rowParagraph(companyRuns, firstSlots.row1Right, style.fsBody));
          e.positions.forEach((p,i)=>{
            const dateText = i===0 ? firstSlots.row2Right : p.dates;
            children.push(rowParagraph([ new TextRun({...bd(p.role,'role'), font:FONT, size:pt2half(style.fsBody)}) ], dateText, style.fsBody));
            bulletParagraphs(p.bullets, style.fsBody).forEach(par=> children.push(par));
          });
        } else {
          const slots = locationDatesSlots(e.location, e.dates);
          children.push(rowParagraph(companyRuns, slots.row1Right, style.fsBody));
          children.push(rowParagraph([ new TextRun({...bd(e.role,'role'), font:FONT, size:pt2half(style.fsBody)}) ], slots.row2Right, style.fsBody));
          bulletParagraphs(e.bullets, style.fsBody).forEach(par=> children.push(par));
        }
      });
    } else if(token === 'projects'){
      if(!resolved.projects.length) return;
      children.push(headingParagraph('Projects'));
      resolved.projects.forEach(p=>{
        children.push(rowParagraph([ new TextRun({...bd(p.title,'project'), font:FONT, size:pt2half(style.fsBody)}) ], p.dates, style.fsBody));
        bulletParagraphs(p.bullets, style.fsBody).forEach(par=> children.push(par));
      });
    } else if(token === 'education'){
      if(!resolved.education.length) return;
      children.push(headingParagraph('Education'));
      resolved.education.forEach(ed=>{
        const slots = locationDatesSlots(ed.location, ed.dates);
        children.push(rowParagraph([ new TextRun({...bd(ed.school,'university'), font:FONT, size:pt2half(style.fsBody)}) ], slots.row1Right, style.fsBody));
        children.push(new Paragraph({ spacing:{after:style.gapEntry*20},
          children:[ new TextRun({ text: ed.degree+(slots.row2Right?('   '+slots.row2Right):''), font:FONT, size:pt2half(style.fsBody) }) ] }));
      });
    } else if(token === 'skills'){
      if(!resolved.skills.length) return;
      children.push(headingParagraph('Skills'));
      resolved.skills.forEach(s=>{
        children.push(new Paragraph({ spacing:{after:style.gapEntry*20},
          children:[ new TextRun({...bd(s.label+': ','skillsLabel'), font:FONT, size:pt2half(style.fsBody)}),
                     new TextRun({ text:s.text, font:FONT, size:pt2half(style.fsBody) }) ] }));
      });
    } else if(token === 'references'){
      if(referencesMode === 'none') return;
      if(referencesMode === 'onrequest'){
        children.push(headingParagraph('References'));
        children.push(new Paragraph({ children:[ new TextRun({text:'Available upon request', font:FONT, size:pt2half(style.fsBody)}) ] }));
      } else if(referencesMode === 'full' && resolved.references.length){
        children.push(headingParagraph('References'));
        resolved.references.forEach(r=>{
          children.push(new Paragraph({ spacing:{after:2*20},
            children:[ new TextRun({...bd(r.name,'referenceName'), font:FONT, size:pt2half(style.fsBody)}),
                       new TextRun({ text: r.title?('  -  '+r.title):'', font:FONT, size:pt2half(style.fsBody) }) ] }));
          children.push(new Paragraph({ spacing:{after:style.gapEntry*20},
            children:[ new TextRun({ text:r.contact||'', font:FONT, size:pt2half(style.fsBody) }) ] }));
        });
      }
    } else if(token === 'publications'){
      if(!(resolved.publications||[]).length) return;
      children.push(headingParagraph('Publications'));
      (resolved.publications||[]).forEach(pub=>{
        // Bold via the existing 'project' toggle -- matches buildPublicationNode()'s own
        // js/06_app.js treatment (reusing an existing checkbox, not a dedicated one).
        children.push(new Paragraph({ spacing:{after:2*20},
          children:[ new TextRun({...bd(pub.title||'', 'project'), italics:true, font:FONT, size:pt2half(style.fsBody) }) ] }));
        const metaBits = [pub.authors, pub.venue, pub.date].filter(Boolean).join(', ');
        if(metaBits){
          children.push(new Paragraph({ spacing:{after:2*20},
            children:[ new TextRun({ text: metaBits, font:FONT, size:pt2half(style.fsBody) }) ] }));
        }
        if(pub.url) children.push(citationLinkParagraph(pub.url, pub.url, style.fsBody));
        bulletParagraphs(pub.bullets, style.fsBody).forEach(par=> children.push(par));
      });
    } else if(token === 'certifications'){
      if(!(resolved.certifications||[]).length) return;
      children.push(headingParagraph('Certifications'));
      (resolved.certifications||[]).forEach(cert=>{
        const nameRuns = [ new TextRun({...bd(cert.name,'company'), font:FONT, size:pt2half(style.fsBody)}) ];
        if(cert.issuer) nameRuns.push(new TextRun({ text:' - '+cert.issuer, font:FONT, size:pt2half(style.fsBody) }));
        children.push(rowParagraph(nameRuns, cert.date||'', style.fsBody));
        if(cert.credentialId){
          children.push(new Paragraph({ spacing:{after:2*20},
            children:[ new TextRun({ text:'Credential ID: '+cert.credentialId, font:FONT, size:pt2half(style.fsBody) }) ] }));
        }
        if(cert.url) children.push(citationLinkParagraph(cert.url, 'Verify', style.fsBody));
      });
    } else if(token.indexOf('custom:') === 0){
      const refId = token.slice(7);
      const cs = (resolved.customSections||[]).find(c=>c.id===refId);
      if(!cs) return;
      if(cs.positions && cs.positions.length){
        children.push(headingParagraph(cs.heading||'Untitled'));
        // Each position prints its own subheading/dates/location + content, exactly matching
        // buildCustomSectionPositionNode() -- no shared header row here (unlike Experience's
        // company row), since the section heading above already covers that role.
        cs.positions.forEach(p=>{
          // Mirrors buildCustomSectionPositionNode()'s own js/06_app.js treatment exactly --
          // Organization bold via the existing 'company' toggle, Subheading bold via the
          // existing 'role' toggle (on request, reusing the Style panel's own checkboxes
          // instead of dedicated ones). The org row is gated strictly on p.org itself (not the
          // location/dates fallback), so a position with no organization set never shows dates
          // floating on a row with nothing on the left; it just prints Subheading+Dates
          // directly instead.
          if(p.org && p.org.trim()){
            const slots = locationDatesSlots(p.location, p.dates);
            children.push(rowParagraph([ new TextRun({...bd(p.org,'company'), font:FONT, size:pt2half(style.fsBody)}) ], slots.row1Right, style.fsBody));
            if(p.subheading || slots.row2Right){
              children.push(rowParagraph([ new TextRun({...bd(p.subheading||'','role'), font:FONT, size:pt2half(style.fsBody)}) ], slots.row2Right, style.fsBody));
            }
          } else if(p.subheading || p.dates){
            children.push(rowParagraph([ new TextRun({...bd(p.subheading||'','role'), font:FONT, size:pt2half(style.fsBody)}) ], p.dates||'', style.fsBody));
          }
          if(p.contentType === 'paragraph') children.push(paragraphBlock(p.text, style.fsBody, style.gapEntry));
          else bulletParagraphs(p.bullets, style.fsBody).forEach(par=> children.push(par));
        });
        return;
      }
      const hasBody = cs.contentType === 'paragraph' ? (cs.text && cs.text.trim()) : (cs.bullets && cs.bullets.length);
      if(!hasBody) return;
      children.push(headingParagraph(cs.heading||'Untitled'));
      // subheading/location/dates mirror the education branch above -- optional context
      // rows above the section's own content, matching buildCustomSectionBodyNode() in
      // js/06_app.js so DOCX and the live preview/PDF stay in lockstep.
      const csSlots = locationDatesSlots(cs.location, cs.dates);
      if(cs.subheading || csSlots.row1Right){
        children.push(rowParagraph([ new TextRun({...bd(cs.subheading||'','role'), font:FONT, size:pt2half(style.fsBody)}) ], csSlots.row1Right, style.fsBody));
      }
      if(csSlots.row2Right){
        children.push(rowParagraph([], csSlots.row2Right, style.fsBody));
      }
      if(cs.contentType === 'paragraph'){
        children.push(paragraphBlock(cs.text, style.fsBody, style.gapSection));
      } else {
        bulletParagraphs(cs.bullets, style.fsBody).forEach(par=> children.push(par));
      }
    }
  });

  return new Document({
    sections:[{
      properties:{ page:{
        size:{ width:convertInchesToTwip(pageInches.w), height:convertInchesToTwip(pageInches.h) },
        margin:{ top:convertInchesToTwip(style.marginTop), right:convertInchesToTwip(style.marginRight),
                 bottom:convertInchesToTwip(style.marginBottom), left:convertInchesToTwip(style.marginLeft) }
      }},
      children
    }]
  });
}

if(typeof module !== 'undefined') module.exports = { buildDocxDocument };
