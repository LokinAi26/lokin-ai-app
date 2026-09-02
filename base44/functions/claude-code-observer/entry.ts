import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';

const txt=(v:any,n=2000)=>String(v??'').trim().slice(0,n);
function equal(a:string,b:string){if(!a||!b||a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0}

export default async function(req:Request){
 try{
  const expected=txt(secrets.get('LOKIN_AGENT_OBSERVER_TOKEN'),500);
  const supplied=txt(req.headers.get('x-lokin-agent-token'),500);
  if(!expected)return Response.json({error:'SETUP_REQUIRED',required:'LOKIN_AGENT_OBSERVER_TOKEN'},{status:503});
  if(!equal(expected,supplied))return Response.json({error:'UNAUTHORIZED'},{status:401});
  const body:any=await req.json().catch(()=>({}));
  const allowed=new Set(['CORRECTION','GAP','PATTERN','BLIND_SPOT','TASK_STARTED','TASK_COMPLETED','TOOL_FAILURE','POLICY_BLOCK']);
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
  return Response.json({accepted:true,observation_id:row.id,auto_apply:false});
 }catch(e:any){return Response.json({error:txt(e?.message||e,1000)},{status:500})}
}
