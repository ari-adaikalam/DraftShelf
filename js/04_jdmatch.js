const STOPWORDS = new Set(('a an the and or but if then else for of to in on at by with from as is are was were be been being '+
  'this that these those it its you your we our they their he she his her will would can could should must shall may might '+
  'not no nor do does did have has had having i me my mine s t ll re ve d job role team work experience years etc using use used').split(' '));

function tokenize(text){
  // letters/digits, allowing internal . + # - (e.g. node.js, c++, c#) but never trailing punctuation
  return (text||'').toLowerCase().match(/[a-z][a-z0-9]*(?:[.+#-][a-z0-9]+)*/g) || [];
}

function extractKeywords(jdText, topN){
  topN = topN || 25;
  const freq = {};
  tokenize(jdText).forEach(w=>{
    if(STOPWORDS.has(w) || w.length<3) return;
    freq[w] = (freq[w]||0)+1;
  });
  return Object.entries(freq)
    .sort((a,b)=> b[1]-a[1] || a[0].localeCompare(b[0]))
    .slice(0, topN)
    .map(([word,count])=>({word,count}));
}

/* corpusText: concatenation of everything currently selected (summary+bullets+skills)
   returns {matched:[{word,count}], missing:[{word,count}]} */
function matchKeywords(jdText, corpusText){
  const keywords = extractKeywords(jdText);
  const corpusWords = new Set(tokenize(corpusText));
  const matched = [], missing = [];
  keywords.forEach(k=>{
    (corpusWords.has(k.word) ? matched : missing).push(k);
  });
  return { matched, missing, keywords };
}

if(typeof module !== 'undefined') module.exports = { tokenize, extractKeywords, matchKeywords, STOPWORDS };
