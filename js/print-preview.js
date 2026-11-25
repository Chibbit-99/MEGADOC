/* Runs in a separate same-origin frame. Only sanitized content and validated
   page settings arrive from the editor; this frame never writes document data. */
window.renderMegaDocPreview = async function(snapshot) {
  const template = document.createElement('template');
  template.innerHTML = snapshot.html;
  const notes = [];
  for (const ref of template.content.querySelectorAll('a[data-megadoc-footnote]')) {
    const number = Number(ref.dataset.footnoteNumber), text = ref.dataset.footnoteText;
    if (!Number.isSafeInteger(number) || number < 1 || number > 1000000 || typeof text !== 'string' || text.length > 20000) throw new Error('A footnote has invalid or excessively long data');
    const note = document.createElement('span'); note.className = `print-footnote note-number-${number}`; note.textContent = text; ref.replaceWith(note); notes.push(number);
  }
  const wrapper = document.createElement('div'); wrapper.className = 'print-document'; wrapper.append(template.content);
  const style = snapshot.css + [...new Set(notes)].map(n => `.note-number-${n}::footnote-call{content:'[${n}]'} .note-number-${n}::footnote-marker{content:'${n}. '}`).join('\n');
  await document.fonts.ready;
  const previewer = new PagedModule.Previewer(), resizeObserver = window.ResizeObserver;
  // This snapshot never changes. Paged.js 0.4.3 can otherwise try to
  // repaginate detached nodes during footnote layout and throw asynchronously.
  window.ResizeObserver = undefined;
  try {
    await previewer.preview(wrapper, [{[location.href]:style}], document.querySelector('#preview'));
    previewer.chunker.pages.forEach(page => page.removeListeners());
    const pages = [...document.querySelectorAll('.pagedjs_page')];
    for (const page of pages) {
      const area = page.querySelector('.pagedjs_area'), notes = page.querySelector('.pagedjs_footnote_area');
      if (area && notes && notes.getBoundingClientRect().height > area.getBoundingClientRect().height + 1) throw new Error('A footnote is too long to fit on a page; shorten it before printing');
    }
    return pages.length;
  } finally { window.ResizeObserver = resizeObserver; }
};

// A direct download is a raster approximation, separate from browser printing.
// Printing is recommended when selectable text and highest fidelity matter.
window.exportMegaDocPDF = async function(name, progress, cancelled) {
  const pages = [...document.querySelectorAll('.pagedjs_page')];
  if (!pages.length || pages.length > 20) throw new Error('Direct PDF supports 1–20 pages; use Print / Save as PDF for longer documents');
  for (const img of document.querySelectorAll('.pagedjs_page img')) {
    const source = img.currentSrc || img.src;
    if (!img.complete || !img.naturalWidth) throw new Error('An image did not load; use Print / Save as PDF instead');
    if (source && !source.startsWith('data:') && !source.startsWith('blob:') && new URL(source,location.href).origin !== location.origin) throw new Error('Cross-origin images cannot be safely captured; use Print / Save as PDF instead');
  }
  const rect = pages[0].getBoundingClientRect(), widthPt = rect.width * .75, heightPt = rect.height * .75;
  const pdf = new jspdf.jsPDF({orientation:widthPt > heightPt ? 'landscape':'portrait',unit:'pt',format:[widthPt,heightPt],compress:true});
  for (let i=0;i<pages.length;i++) {
    if (cancelled()) throw new Error('Cancelled');
    progress(i+1,pages.length);
    const r=pages[i].getBoundingClientRect(), w=Math.round(r.width), h=Math.round(r.height);
    const canvas=await html2canvas(pages[i],{scale:1.5,backgroundColor:'#fff',logging:false,windowWidth:w,windowHeight:h,scrollX:0,scrollY:0,onclone:(doc,selected)=>{
      const preview=doc.querySelector('#preview'); preview.style.cssText=`padding:0;width:${w}px;min-width:0`; doc.documentElement.style.cssText=`width:${w}px`; doc.body.style.cssText=`margin:0;width:${w}px;background:white`;
      doc.querySelectorAll('.pagedjs_page').forEach(node=>{if(node!==selected)node.style.display='none';else{node.style.margin='0';node.style.boxShadow='none';}});
      selected.querySelectorAll('[data-footnote-marker]').forEach(note=>{const match=[...note.classList].find(c=>/^note-number-\d+$/.test(c));if(match){const marker=doc.createElement('span');marker.textContent=match.slice('note-number-'.length)+'. ';marker.style.fontWeight='bold';note.style.listStyle='none';note.prepend(marker);}});
    }});
    if (cancelled()) throw new Error('Cancelled');
    if (i) pdf.addPage([widthPt,heightPt],widthPt>heightPt?'landscape':'portrait');
    pdf.addImage(canvas.toDataURL('image/jpeg',.92),'JPEG',0,0,widthPt,heightPt,undefined,'FAST'); canvas.width=1;canvas.height=1;
  }
  if (cancelled()) throw new Error('Cancelled');
  pdf.save(`${name.replace(/[\\/:*?"<>|\x00-\x1f]/g,'_') || 'MegaDoc tab'}.pdf`);
};
