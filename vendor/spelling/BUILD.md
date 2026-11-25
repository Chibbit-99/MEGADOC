Local spelling assets
=====================

The browser-worker bundle uses nspell 2.1.5 and is-buffer 2.0.5 (MIT).
The bundled Hunspell word lists are dictionary-en 4.0.0 and
dictionary-en-au 3.0.0 (SCOWL-based; see both included license files).
The versions used here have identical affix files; `en.aff` is the US copy.
The worker creates two independent spellcheckers so that both common US and
Australian spellings are accepted. No words or dictionary requests are sent to
a third-party service.

Example reproducible build outside the repository:

    npm install --prefix /tmp/megadoc-spell nspell@2.1.5 dictionary-en@4.0.0 dictionary-en-au@3.0.0 esbuild@0.28.2
    printf "import nspell from 'nspell'; self.nspell = nspell;\n" > /tmp/megadoc-spell/entry.js
    /tmp/megadoc-spell/node_modules/.bin/esbuild /tmp/megadoc-spell/entry.js --bundle --minify --platform=browser --target=es2020 --outfile=vendor/spelling/nspell.min.js
    cp /tmp/megadoc-spell/node_modules/dictionary-en/index.aff vendor/spelling/en.aff
    cp /tmp/megadoc-spell/node_modules/dictionary-en/index.dic vendor/spelling/en-us.dic
    cp /tmp/megadoc-spell/node_modules/dictionary-en-au/index.dic vendor/spelling/en-au.dic

Check dependency versions and retain the corresponding license notices when
updating. Test worker loading, resource size and suggestions before shipping.
