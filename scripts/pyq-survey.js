/** Reports which downloaded papers yield extractable text and which need OCR. */
const fs=require('fs');const path=require('path');const pdf=require('pdf-parse');
const root=path.join(__dirname,'..');
const res=JSON.parse(fs.readFileSync(path.join(root,'research/boards/batches/pyq-window_results.json'),'utf8'));
const MIN_CHARS=2000; // a full board paper well under this is effectively a scan
(async()=>{
 const rows=[];
 for(const doc of res.documents.filter(d=>d.status==='downloaded')){
  const dir=path.join(root,doc.pdf_dir);
  for(const f of fs.readdirSync(dir).filter(x=>x.endsWith('.pdf'))){
   let chars=0,pages=0,err=null;
   try{const d=await pdf(fs.readFileSync(path.join(dir,f)));chars=d.text.replace(/\s+/g,' ').trim().length;pages=d.numpages;}
   catch(e){err=e.message;}
   rows.push({board:doc.board,class:doc.class,year:doc.year,subject:doc.subject,file:f,dir:doc.pdf_dir,chars,pages,err,text_ok:!err&&chars>=MIN_CHARS});
  }
 }
 fs.writeFileSync(path.join(root,'research/boards/batches/pyq-survey.json'),JSON.stringify(rows,null,2));
 const agg={};
 for(const r of rows){const k=`${r.board} ${r.class} ${r.year}`;(agg[k]=agg[k]||{ok:0,scan:0})[r.text_ok?'ok':'scan']++;}
 console.log('BOARD CLASS YEAR            text  scan');
 for(const [k,v] of Object.entries(agg).sort())console.log(k.padEnd(24),String(v.ok).padStart(4),String(v.scan).padStart(5));
 const t=rows.filter(r=>r.text_ok).length;
 console.log(`\nTOTAL ${t}/${rows.length} papers have extractable text`);
})();
