// Conservative check of repository source size; deployed/build artifacts must
// also be checked separately if a future Pages workflow generates new files.
const {execFileSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root}).toString().split('\0').filter(Boolean);
let bytes=0;for(const file of new Set(files)){try{const stat=fs.lstatSync(path.join(root,file));if(stat.isFile())bytes+=stat.size}catch(error){if(error.code!=='ENOENT')throw error}}
assert.ok(bytes<1_000_000_000,`Repository source is ${bytes} bytes, over the 1 GB Pages site limit`);
console.log(`Repository source size: ${(bytes/1_000_000).toFixed(2)} MB, below 1 GB (generated deployment output not included)`);
