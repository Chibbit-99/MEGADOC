// ODT conversion stays local in a disposable worker; generated HTML is still
// untrusted and must be sanitized by the caller before it enters the editor.
importScripts('office-zip-check.js','../vendor/odf-kit/odf.min.js');
self.onmessage = async event => {
  try {
    const {operation, buffer, html, options} = event.data;
    if (operation === 'import') {
      checkOfficeArchive(buffer);
      const result = odfKit.odtToHtml(new Uint8Array(buffer), {fragment:true});
      if (result.length > 20 * 1024 * 1024) throw new Error('Converted document exceeds 20 MB');
      self.postMessage({html:result});
    } else if (operation === 'export') {
      const result = await odfKit.htmlToOdt(html, options);
      if (result.byteLength > 30 * 1024 * 1024) throw new Error('Converted document exceeds 30 MB');
      const copy = result.slice(); self.postMessage({buffer:copy.buffer}, [copy.buffer]);
    } else throw new Error('Unknown conversion');
  } catch (err) { self.postMessage({error:err?.message || 'Could not convert the OpenDocument file'}); }
};
