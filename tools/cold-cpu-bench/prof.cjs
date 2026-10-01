// node prof.cjs <bundle.mjs> <map> <path> <seed|-> [runs]: self & inclusive time of the first request by source function.
const fs=require('fs'),{execFileSync}=require('child_process');const {SourceMapConsumer}=require('../../node_modules/source-map-js');
const [bundle,map,path,seed,runs='10']=process.argv.slice(2);const smc=new SourceMapConsumer(JSON.parse(fs.readFileSync(map,'utf8')));
const self={},incl={};let total=0;
for(let i=0;i<+runs;i++){const pf=require('path').join(require('os').tmpdir(),`cold-cpu-prof-${i}.json`);execFileSync('node',[__dirname+'/child.mjs',fs.realpathSync(bundle),path,seed,'0'],{env:{...process.env,PROF:pf},stdio:'ignore'});
 const p=JSON.parse(fs.readFileSync(pf));const byId=new Map(p.nodes.map(n=>[n.id,n]));const parent=new Map();for(const n of p.nodes)for(const c of n.children||[])parent.set(c,n.id);
 const label=n=>{const cf=n.callFrame;if(cf.url.includes(bundle.split('/').pop())){const o=smc.originalPositionFor({line:cf.lineNumber+1,column:cf.columnNumber+1});return (o.source||'?').replace(/.*functions\//,'').replace(/.*node_modules\//,'nm/')+':'+o.line+' '+(cf.functionName||'(anon)');}return '['+(cf.url.replace(/.*\//,'')||'native')+'] '+cf.functionName;};
 p.samples.forEach((id,k)=>{const us=p.timeDeltas[k]||0;total+=us;let n=byId.get(id);const l=label(n);self[l]=(self[l]||0)+us;const seen=new Set();for(let x=id;x!==undefined;x=parent.get(x)){const lx=label(byId.get(x));if(!seen.has(lx)){seen.add(lx);incl[lx]=(incl[lx]||0)+us;}}});}
const top=(o,n)=>Object.entries(o).sort((a,b)=>b[1]-a[1]).slice(0,n).map(([k,v])=>(v/runs/1000).toFixed(2).padStart(6)+'ms '+k).join('\n');
console.log('first request total',(total/runs/1000).toFixed(1),'ms\n== self\n'+top(self,25)+'\n== inclusive (bundle functions)\n'+top(Object.fromEntries(Object.entries(incl).filter(([k])=>!k.startsWith('['))),30));
