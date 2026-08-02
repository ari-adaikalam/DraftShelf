function buildDocxDocument(docxLib, resolved, style, pageSize, meta, referencesMode, sectionOrder){
  const { Document, Paragraph, TextRun, ExternalHyperlink, AlignmentType, TabStopType, convertInchesToTwip } = docxLib;

  const pageInches = pageSize === 'Letter' ? {w:8.5, h:11} : {w:8.27, h:11.69};
  const usableWidthTwips = convertInchesToTwip(pageInches.w - style.marginLeft - style.marginRight);

  const FONT = style.fontFamily.replace(/["']/g,'').split(',')[0].trim() || 'Times New Roman';
  const pt2half = pt => Math.round(pt*2);
  const bodyAlignment = style.bodyAlign === 'left' ? AlignmentType.LEFT : AlignmentType.JUSTIFIED;
  const order = Array.isArray(sectionOrder) && sectionOrder.length ? sectionOrder : ['experience','projects','education','skills','references'];

  function bd(text, flagKey){ return { text: text||'', bold: !!(style.bold && style.bold[flagKey]) }; }

  function splitBoldRuns(text, sizePt){
    return parseInlineBold(text).map(seg => new TextRun({ text: seg.text, bold: seg.bold, font: FONT, size: pt2half(sizePt) }));
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

  function bulletParagraph(text, sizePt){
    return new Paragraph({
      children: [ new TextRun({ text: style.bulletMarker+'  ', font:FONT, size: pt2half(sizePt) }), ...splitBoldRuns(text, sizePt) ],
      alignment: bodyAlignment,
      indent:{ left: convertInchesToTwip(0.22), hanging: convertInchesToTwip(0.18) },
      spacing:{ after: style.gapBullet*20 }
    });
  }

  function paragraphBlock(text, sizePt, afterPt){
    return new Paragraph({ alignment: bodyAlignment, spacing:{after:afterPt*20}, children: splitBoldRuns(text, sizePt) });
  }

  const children = [];
  children.push(new Paragraph({ alignment:AlignmentType.CENTER, spacing:{after:20},
    children:[ new TextRun({ text: meta.name||'Your Name', bold:true, font:FONT, size: pt2half(style.fsName) }) ] }));

  const contactRuns = [];
  const contactSep = () => new TextRun({ text:'   |   ', font:FONT, size: pt2half(style.fsContact) });
  if(meta.phone) contactRuns.push(new TextRun({ text: meta.phone, font:FONT, size: pt2half(style.fsContact) }));
  if(meta.email){
    if(contactRuns.length) contactRuns.push(contactSep());
    contactRuns.push(new ExternalHyperlink({
      link: 'mailto:'+meta.email,
      children: [ new TextRun({ text: meta.email, style:'Hyperlink', font:FONT, size: pt2half(style.fsContact) }) ]
    }));
  }
  if(meta.location){
    if(contactRuns.length) contactRuns.push(contactSep());
    contactRuns.push(new TextRun({ text: meta.location, font:FONT, size: pt2half(style.fsContact) }));
  }
  [['LinkedIn', meta.linkedin], ['GitHub', meta.github], ['Portfolio', meta.portfolio]].forEach(([label, val]) => {
    if(!val) return;
    if(contactRuns.length) contactRuns.push(contactSep());
    contactRuns.push(new ExternalHyperlink({
      link: val,
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
        children.push(rowParagraph([ new TextRun({...bd(e.company,'company'), font:FONT, size:pt2half(style.fsBody)}) ], e.location, style.fsBody));
        children.push(rowParagraph([ new TextRun({...bd(e.role,'role'), font:FONT, size:pt2half(style.fsBody)}) ], e.dates, style.fsBody));
        e.bullets.forEach(b=> children.push(bulletParagraph(b.text, style.fsBody)));
      });
    } else if(token === 'projects'){
      if(!resolved.projects.length) return;
      children.push(headingParagraph('Projects'));
      resolved.projects.forEach(p=>{
        children.push(rowParagraph([ new TextRun({...bd(p.title,'project'), font:FONT, size:pt2half(style.fsBody)}) ], p.dates, style.fsBody));
        p.bullets.forEach(b=> children.push(bulletParagraph(b.text, style.fsBody)));
      });
    } else if(token === 'education'){
      if(!resolved.education.length) return;
      children.push(headingParagraph('Education'));
      resolved.education.forEach(ed=>{
        children.push(rowParagraph([ new TextRun({...bd(ed.school,'university'), font:FONT, size:pt2half(style.fsBody)}) ], ed.location, style.fsBody));
        children.push(new Paragraph({ spacing:{after:style.gapEntry*20},
          children:[ new TextRun({ text: ed.degree+(ed.dates?('   '+ed.dates):''), font:FONT, size:pt2half(style.fsBody) }) ] }));
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
                       new TextRun({ text: r.title?('  —  '+r.title):'', font:FONT, size:pt2half(style.fsBody) }) ] }));
          children.push(new Paragraph({ spacing:{after:style.gapEntry*20},
            children:[ new TextRun({ text:r.contact||'', font:FONT, size:pt2half(style.fsBody) }) ] }));
        });
      }
    } else if(token.indexOf('custom:') === 0){
      const refId = token.slice(7);
      const cs = (resolved.customSections||[]).find(c=>c.id===refId);
      if(!cs) return;
      const hasBody = cs.contentType === 'paragraph' ? (cs.text && cs.text.trim()) : (cs.bullets && cs.bullets.length);
      if(!hasBody) return;
      children.push(headingParagraph(cs.heading||'Untitled'));
      // subheading/location/dates mirror the education branch above -- optional context
      // rows above the section's own content, matching buildCustomSectionBodyNode() in
      // js/06_app.js so DOCX and the live preview/PDF stay in lockstep.
      if(cs.subheading || cs.location){
        children.push(rowParagraph([ new TextRun({...bd(cs.subheading||'','company'), font:FONT, size:pt2half(style.fsBody)}) ], cs.location||'', style.fsBody));
      }
      if(cs.dates){
        children.push(rowParagraph([], cs.dates, style.fsBody));
      }
      if(cs.contentType === 'paragraph'){
        children.push(paragraphBlock(cs.text, style.fsBody, style.gapSection));
      } else {
        cs.bullets.forEach(b=> children.push(bulletParagraph(b.text, style.fsBody)));
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
