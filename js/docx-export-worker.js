// Converts an HTML snapshot to Word locally, without fetching remote images.
importScripts('../vendor/docx/index.min.js','../vendor/docx/math.min.js','../vendor/docx/html.min.js');
self.onmessage = async event => {
  try {
    const warnings = [];
    const children = docxHtml.htmlToContent(event.data.html, {onWarning:w => warnings.push(w.message)});
    const setup = event.data.setup;
    const page = {size:{width:Math.round(setup.width * 15),height:Math.round(setup.height * 15),orientation:setup.orientation},margin:{top:1080,bottom:1080,left:Math.round(setup.left*15),right:Math.round(setup.right*15)}};
    const document = new docx.Document({sections:[{properties:{page},children}]});
    const blob = await docx.Packer.toBlob(document);
    if (blob.size > 30 * 1024 * 1024) throw new Error('Converted document exceeds 30 MB');
    self.postMessage({blob,warnings:warnings.slice(0,20)});
  } catch (err) { self.postMessage({error:err?.message || 'Could not create the Word document'}); }
};
