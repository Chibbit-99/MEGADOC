Mammoth browser bundle
======================

The checked-in bundle is built from Mammoth 1.13.0 and its npm dependencies,
using browserify 17.0.1 and terser 5. At build time the resolved XML parser is
@xmldom/xmldom 0.8.15 and the ZIP reader is jszip 3.10.2. The bundled module
versions and licenses are listed in THIRD_PARTY_LICENSES.

Example rebuild outside the repository:

    npm install --prefix /tmp/megadoc-mammoth mammoth@1.13.0 browserify@17.0.1 terser@5
    /tmp/megadoc-mammoth/node_modules/.bin/browserify /tmp/megadoc-mammoth/node_modules/mammoth/lib/index.js --standalone mammoth | /tmp/megadoc-mammoth/node_modules/.bin/terser -c -m -o vendor/mammoth/mammoth.browser.min.js

Review resolved dependency security and licenses when rebuilding; npm version
ranges may resolve to different versions. Regenerate THIRD_PARTY_LICENSES and run
the DOCX-import regression tests after any update.
