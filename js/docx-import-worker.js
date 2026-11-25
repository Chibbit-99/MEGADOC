// Conversion is local and isolated so an oversized or malformed file can be
// cancelled without blocking the editor. Mammoth returns HTML, not trusted DOM.
importScripts('office-zip-check.js','../vendor/mammoth/mammoth.browser.min.js');
self.onmessage = async event => {
  try {
    checkOfficeArchive(event.data);
    const result = await mammoth.convertToHtml({arrayBuffer: event.data});
    if (result.value.length > 20 * 1024 * 1024) throw new Error('Converted document exceeds 20 MB');
    self.postMessage({html: result.value, warnings: result.messages.length});
  } catch (err) { self.postMessage({error: err?.message || 'Could not read this Word document'}); }
};
