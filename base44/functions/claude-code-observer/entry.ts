import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';

const txt=(v:any,n=2000)=>String(v??'').trim().slice(0,n);
const pct=(v:any,f=0)=>Number.isFinite(Number(v))?Math.max(0,Math.min(100,Number(v))):f;
function equal(a:string,b:string){if(!a||!b||a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0}

const EVENT_STATUS:any={
 TASK_QUEUED:'queued',TASK_STARTED:'running',TASK_PROGRESS:'running',TASK_COMPLETED:'completed',
 TASK_BLOCKED:'blocked',POLICY_BLOCK:'blocked',TASK_FAILED:'failed',TOOL_FAILURE:'failed',TASK_CANCELED:'canceled'
};
const VALID_SOURCES=new Set(['CHATGPT','BASE44_EDITOR','CLAUDE_CODE','REMOTE_AGENT','SYSTEM']);

async function syncBuildTask(base44:any, body:any, eventType:string, summary:string){
 const taskKey=txt(body.task_id,180);
 if(!taskKey||!EVENT_STATUS[eventType])return null;
 const owner=txt(body.owner_user_id,180);
 const query:any={task_key:taskKey};
 if(owner)query.owner_user_id=owner;
 const prior=await base44.asServiceRole.entities.Base44BuildTask.filter(query,'-updated_date',1).catch(()=>[]);
 const current=prior?.[0]||null;
 const status=EVENT_STATUS[eventType];
 const details=body.details&&typeof body.details==='object'?body.details:{};
 const progress=status==='completed'?100:pct(body.progress_percent??details.progress_percent,current?.progress_percent||0);
 const patch:any={
  status,progress_percent:progress,heartbeat_at:new Date().toISOString(),
  details:{...(current?.details||{}),...details,last_observation:eventType,last_observation_summary:summary}
 };
 if(status==='running'&&!current?.started_at)patch.started_at=new Date().toISOString();
 if(['completed','failed','canceled'].includes(status))patch.completed_at=new Date().toISOString();
 if(status==='completed')patch.estimated_seconds_remaining=0;
 if(body.estimated_seconds_remaining!==undefined){patch.estimated_seconds_remaining=Math.max(0,Math.floor(Number(body.estimated_seconds_remaining)||0));patch.eta_basis='explicit';}
 if(['failed','blocked'].includes(status))patch.last_error=txt(body.error||details.error||summary,2000);
 if(current)return base44.asServiceRole.entities.Base44BuildTask.update(current.id,patch);
 const rawSource=txt(body.source,40).toUpperCase()||'CLAUDE_CODE';
 const source=VALID_SOURCES.has(rawSource)?rawSource:'REMOTE_AGENT';
 return base44.asServiceRole.entities.Base44BuildTask.create({
  owner_user_id:owner,task_key:taskKey,batch_id:txt(body.batch_id||details.batch_id,180),source,
  title:txt(body.title||summary,500),description:txt(body.description,4000),status,progress_percent:progress,
  work_units_total:Math.max(0,Math.floor(Number(body.work_units_total||details.work_units_total)||0)),
  work_units_completed:Math.max(0,Math.floor(Number(body.work_units_completed||details.work_units_completed)||0)),
  estimated_seconds_remaining:Math.max(0,Math.floor(Number(body.estimated_seconds_remaining||details.estimated_seconds_remaining)||0)),
  eta_basis:body.estimated_seconds_remaining!==undefined||details.estimated_seconds_remaining!==undefined?'explicit':'unavailable',
  source_reference:txt(body.session_id,500),last_error:['failed','blocked'].includes(status)?txt(body.error||details.error||summary,2000):'',
  details:{...details,last_observation:eventType,last_observation_summary:summary},submitted_at:new Date().toISOString(),
  ...(status==='running'?{started_at:new Date().toISOString()}:{}),heartbeat_at:new Date().toISOString(),
  ...(['completed','failed','canceled'].includes(status)?{completed_at:new Date().toISOString()}:{}),
 });
}

export default async function(req:Request){
 try{
  const expected=txt(secrets.get('LOKIN_AGENT_OBSERVER_TOKEN'),500);
  const supplied=txt(req.headers.get('x-lokin-agent-token'),500);
  if(!expected)return Response.json({error:'SETUP_REQUIRED',required:'LOKIN_AGENT_OBSERVER_TOKEN'},{status:503});
  if(!equal(expected,supplied))return Response.json({error:'UNAUTHORIZED'},{status:401});
  const body:any=await req.json().catch(()=>({}));
  const allowed=new Set(['CORRECTION','GAP','PATTERN','BLIND_SPOT','TASK_QUEUED','TASK_STARTED','TASK_PROGRESS','TASK_COMPLETED','TASK_BLOCKED','TASK_FAILED','TASK_CANCELED','TOOL_FAILURE','POLICY_BLOCK']);
  const eventType=txt(body.event_type,40).toUpperCase();
  const summary=txt(body.summary,1200);
  if(!allowed.has(eventType)||!summary)return Response.json({error:'INVALID_OBSERVATION'},{status:400});
  const base44:any=createClientFromRequest(req);
  const row=await base44.asServiceRole.entities.TaskObservation.create({
   owner_user_id:txt(body.owner_user_id,180),source:txt(body.source,80)||'CLAUDE_CODE',
   session_id:txt(body.session_id,180),task_id:txt(body.task_id,180),event_type:eventType,
   status:'OBSERVED',summary,affected_components:(Array.isArray(body.affected_components)?body.affected_components:[]).slice(0,30).map((x:any)=>txt(x,160)),
   details:body.details&&typeof body.details==='object'?body.details:{},occurred_at:new Date().toISOString()
  });
  const task=await syncBuildTask(base44,body,eventType,summary).catch(()=>null);
  return Response.json({accepted:true,observation_id:row.id,task_id:task?.id||null,task_status:task?.status||null,auto_apply:false});
 }catch(e:any){return Response.json({error:txt(e?.message||e,1000)},{status:500})}
}
