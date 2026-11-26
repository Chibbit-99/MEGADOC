'use strict';
const assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm'), crypto=require('node:crypto');
let stage, batches, marker, failAt, changed, badShape, noRevision;
const blank=index=>({startIndex:index,endIndex:index+1,paragraph:{elements:[{textRun:{content:'\n'}}]}});
const ctx={Utilities:{getUuid:()=>crypto.randomUUID()},Docs:{Documents:{
  create(){return {documentId:'created123456789'}},
  get(){
    let content=[];
    if (stage===1) content=[{startIndex:5,paragraph:{elements:[{textRun:{content:marker+'\n'}}]}}];
    if (stage===2) content=[{startIndex:6,table:{tableRows:[{tableCells:[{content:[blank(9)]},{content:[blank(11)]}]}, {tableCells:badShape ? [] : [{content:[blank(14)]},{content:[blank(16)]}]}]}}];
    return {revisionId:changed && stage===2 ? 'collaborator' : 'r'+stage,body:{content}};
  },
  batchUpdate(body){
    batches.push(body); assert.equal(body.writeControl.requiredRevisionId,'r'+stage);
    if (stage===failAt) throw Error('failure');
    if (stage===0) marker=body.requests[0].insertText.text.match(/MEGADOCTABLE[a-f0-9]+X0END/)[0];
    stage++; return noRevision ? {} : {writeControl:{requiredRevisionId:'r'+stage}};
  }
}}};
vm.createContext(ctx); vm.runInContext(fs.readFileSync('google-apps-script/Code.gs','utf8'),ctx);
const p=(text,style={})=>({kind:'NORMAL_TEXT',runs:text ? [{text,style}] : []});
const table={kind:'TABLE',widths:[90,null],heights:[null,24],rows:[[{backgroundColor:'#ff0000',blocks:[p('😀A',{bold:true})]},{blocks:[p('B')]}],[{blocks:[p('C'),p('Next',{italic:true})]},{blocks:[p('')]}]]};
const payload={version:1,title:'Tables',blocks:[p('before'),table,p('after')]};
function reset(){stage=0;batches=[];failAt=-1;changed=false;badShape=false;noRevision=false;}
reset(); let result=ctx.createDocument(payload); assert.equal(result.ok,true); assert.equal(batches.length,3);
assert.equal(batches[1].requests[0].deleteContentRange.range.startIndex,5); assert.equal(batches[1].requests[1].insertTable.location.index,5);
const requests=batches[2].requests; assert.equal(requests[0].updateTableColumnProperties.tableStartLocation.index,6); assert.equal(requests[0].updateTableColumnProperties.tableColumnProperties.width.magnitude,90);
assert.equal(requests[1].updateTableRowStyle.tableRowStyle.minRowHeight.magnitude,24);
assert.equal(requests[2].updateTableCellStyle.tableRange.tableCellLocation.rowIndex,0); assert.equal(requests[2].updateTableCellStyle.tableCellStyle.backgroundColor.color.rgbColor.red,1);
const inserts=requests.filter(x=>x.insertText).map(x=>x.insertText); assert.equal(Array.from(inserts,x=>x.location.index).join(','),'14,11,9'); assert.equal(inserts[0].text,'C\nNext'); assert.equal(inserts[2].text,'😀A');
const bold=requests.find(x=>x.updateTextStyle?.textStyle.bold === true).updateTextStyle; assert.equal(bold.range.startIndex,9); assert.equal(bold.range.endIndex,12);
assert.throws(()=>ctx.prepareOverwrite('someexistingdocumentid',payload),/only be exported to a new/);
assert.throws(()=>ctx.validatePayload_({...payload,blocks:[{...table,rows:[[table.rows[0][0]]]}]}),/dimensions/);
assert.throws(()=>ctx.validatePayload_({...payload,blocks:[{...table,rows:[[{blocks:[table]},table.rows[0][1]],table.rows[1]]}]}),/Invalid table/);
for (const mode of ['fail','change','shape','revision']) {
  reset(); if(mode==='fail') failAt=2; if(mode==='change') changed=true; if(mode==='shape') badShape=true; if(mode==='revision') noRevision=true;
  result=ctx.createDocument(payload); assert.equal(result.ok,false); assert.match(result.url,/created123456789/); assert.match(result.message,/incomplete/);
  if(mode==='change' || mode==='shape') assert.equal(batches.length,2);
  if(mode==='revision') assert.equal(batches.length,1);
}
console.log('Apps Script staged table tests passed');
