export const MEMORY_RETRIEVAL_VERSION='LOKIN_MEMORY_RETRIEVAL_V1';
const text=(v,max=1000)=>String(v??'').trim().slice(0,max);
const searchable=(row)=>[row.memory_type,row.topic,row.summary,row.canonical_key,row.event_type,row.result,JSON.stringify(row.content||{}),JSON.stringify(row.details||{})].map(x=>text(x,2000).toLowerCase()).join(' ');
export function searchMemoryRows(rows=[],query='',limit=20){
 const terms=text(query,500).toLowerCase().split(/\s+/).filter(x=>x.length>1);
 return rows.map(row=>({row,score:terms.reduce((n,t)=>n+(searchable(row).includes(t)?1:0),0)})).filter(x=>terms.length===0||x.score>0).sort((a,b)=>b.score-a.score||Date.parse(b.row.updated_date||b.row.occurred_at||0)-Date.parse(a.row.updated_date||a.row.occurred_at||0)).slice(0,Math.max(1,Math.min(50,Number(limit)||20))).map(({row,score})=>({id:row.id,score,type:row.memory_type||row.event_type||row.state_type||'memory',topic:text(row.topic||row.canonical_key||row.event_type,180),summary:text(row.summary||row.result||JSON.stringify(row.content||row.details||{}),500),occurred_at:row.occurred_at||row.updated_date||row.created_date||''}));
}
export function memoryTimeline(rows=[],anchorId='',radius=5){
 const sorted=[...rows].sort((a,b)=>Date.parse(a.occurred_at||a.updated_date||a.created_date||0)-Date.parse(b.occurred_at||b.updated_date||b.created_date||0));
 const index=Math.max(0,sorted.findIndex(x=>x.id===anchorId));
 const r=Math.max(1,Math.min(20,Number(radius)||5));
 return sorted.slice(Math.max(0,index-r),Math.min(sorted.length,index+r+1));
}
export function getMemoryObservations(rows=[],ids=[]){
 const wanted=new Set((Array.isArray(ids)?ids:[]).slice(0,25).map(String));
 return rows.filter(x=>wanted.has(String(x.id))).map(x=>({id:x.id,type:x.memory_type||x.event_type||x.state_type||'memory',topic:x.topic||x.canonical_key||'',summary:x.summary||x.result||'',content:x.content||x.details||{},confidence:Number(x.confidence||0),evidence_count:Number(x.evidence_count||0),occurred_at:x.occurred_at||x.updated_date||x.created_date||''}));
}
