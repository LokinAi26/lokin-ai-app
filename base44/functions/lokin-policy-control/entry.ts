import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { authorizeCapability, CAPABILITY_BROKER_VERSION } from '../../shared/capabilityBroker.js';
import { AGENT_CIRCUIT_BREAKER_VERSION, AGENT_SESSION_STATUS, defaultAgentBudgets, evaluateAgentSession, summarizeAgentEvents } from '../../shared/agentCircuitBreaker.js';
import { normalizeOffer, pruneNulls, OFFER_NORMALIZER_VERSION } from '../../shared/offerNormalizer.js';
import { authorizePhysicalCapability, listPhysicalCapabilityPolicies, PHYSICAL_CAPABILITY_BROKER_VERSION } from '../../shared/physicalCapabilityBroker.js';
import { offerVisibleToUser } from '../../shared/offerAccess.js';

const txt=(v:any,n=500)=>String(v??'').trim().slice(0,n);
const now=()=>new Date().toISOString();
const admin=(u:any)=>String(u?.role||'').toLowerCase()==='admin';
const SAFE_SCOPE_BY_CAPABILITY:any=Object.freeze({
  'ai.infer':['ai:invoke'],
  'speech.transcribe':['speech:transcribe'],
  'data.read':['data:read'],
  'data.write':['data:write'],
  'production.preview':['production:preview'],
  'agent.external_communication':['external:communicate'],
});

function safeScopes(capabilities:any){
  const result=new Set<string>();
  for(const capability of Array.isArray(capabilities)?capabilities:[]){
    for(const scope of SAFE_SCOPE_BY_CAPABILITY[txt(capability,180)]||[])result.add(scope);
  }
  return [...result];
}

async function getSession(base44:any,user:any,sessionId:string){
  const rows=await base44.asServiceRole.entities.AgentExecutionSession.filter({session_id:sessionId,owner_user_id:user.id},'-created_at',2).catch(()=>[]);
  return rows?.[0]||null;
}

async function getEvents(base44:any,user:any,sessionId:string){
  return await base44.asServiceRole.entities.AgentExecutionEvent.filter({session_id:sessionId,owner_user_id:user.id},'occurred_at',600).catch(()=>[]);
}

async function appendEvent(base44:any,user:any,session:any,input:any){
  return await base44.asServiceRole.entities.AgentExecutionEvent.create({
    event_id:crypto.randomUUID(),request_id:txt(input.request_id,180),session_id:session.session_id,
    owner_user_id:user.id,agent_id:txt(session.agent_id,180),task_id:txt(session.task_id,180),
    event_type:input.event_type,capability:txt(input.capability,180),decision:input.decision||'INFO',
    reason:txt(input.reason,500),target_type:txt(input.target_type,120),target_id:txt(input.target_id,240),
    metadata:input.metadata&&typeof input.metadata==='object'?input.metadata:{},occurred_at:now(),
  });
}

export default async function(req:Request){
  const base44:any=createClientFromRequest(req);
  try{
    if(req.method!=='POST')return Response.json({error:'METHOD_NOT_ALLOWED'},{status:405});
    const user:any=await base44.auth.me().catch(()=>null);
    if(!user)return Response.json({error:'UNAUTHORIZED'},{status:401});
    const body:any=await req.json().catch(()=>({}));
    const action=txt(body.action,80).toLowerCase()||'status';

    if(action==='status'){
      return Response.json({
        status:'READY',
        versions:{capability_broker:CAPABILITY_BROKER_VERSION,agent_circuit_breaker:AGENT_CIRCUIT_BREAKER_VERSION,offer_normalizer:OFFER_NORMALIZER_VERSION,physical_capability_broker:PHYSICAL_CAPABILITY_BROKER_VERSION},
        controls:{persistent_agent_sessions:true,append_only_agent_events:true,automatic_high_risk_approval:false,direct_hardware_execution:false,automatic_platform_action:false},
        concurrency_note:'Base44 entity mutations are serialized through this endpoint but are not represented as a transactional atomic-counter primitive. Authorization derives counters from append-only events and fails closed; strict distributed single-flight execution remains an executor responsibility.',
        physical_policies:listPhysicalCapabilityPolicies(),
      });
    }

    if(action==='create_agent_session'){
      const agentId=txt(body.agent_id,180),taskId=txt(body.task_id,180);
      if(!agentId)return Response.json({error:'AGENT_ID_REQUIRED'},{status:400});
      const sessionId=crypto.randomUUID();
      const createdAt=now();
      const budgets=defaultAgentBudgets(body.budgets||{});
      const scopes=safeScopes(body.capabilities);
      const session=await base44.asServiceRole.entities.AgentExecutionSession.create({
        session_id:sessionId,owner_user_id:user.id,agent_id:agentId,agent_type:txt(body.agent_type,80)||'REMOTE_AGENT',task_id:taskId,
        status:AGENT_SESSION_STATUS.ACTIVE,risk_tier:['LOW','MEDIUM','HIGH'].includes(String(body.risk_tier||'').toUpperCase())?String(body.risk_tier).toUpperCase():'MEDIUM',
        budgets,granted_scopes:scopes,created_at:createdAt,updated_at:createdAt,
        expires_at:new Date(Date.now()+budgets.max_duration_ms).toISOString(),metadata:body.metadata&&typeof body.metadata==='object'?body.metadata:{},
      });
      await appendEvent(base44,user,session,{event_type:'SESSION_CREATED',decision:'INFO',reason:'OWNER_CREATED_SESSION',metadata:{granted_scopes:scopes,budgets}});
      return Response.json({ok:true,session});
    }

    if(action==='get_agent_session'){
      const session=await getSession(base44,user,txt(body.session_id,180));
      if(!session)return Response.json({error:'SESSION_NOT_FOUND'},{status:404});
      const events=await getEvents(base44,user,session.session_id);
      return Response.json({session,counters:summarizeAgentEvents(events),events:events.slice(-100)});
    }

    if(['freeze_agent_session','revoke_agent_session','complete_agent_session'].includes(action)){
      const session=await getSession(base44,user,txt(body.session_id,180));
      if(!session)return Response.json({error:'SESSION_NOT_FOUND'},{status:404});
      const status=action==='freeze_agent_session'?AGENT_SESSION_STATUS.FROZEN:action==='revoke_agent_session'?AGENT_SESSION_STATUS.REVOKED:AGENT_SESSION_STATUS.COMPLETED;
      const reason=txt(body.reason,500)||`OWNER_${status}`;
      const updated=await base44.asServiceRole.entities.AgentExecutionSession.update(session.id,{status,freeze_reason:status===AGENT_SESSION_STATUS.FROZEN?reason:session.freeze_reason||'',updated_at:now()});
      await appendEvent(base44,user,updated,{event_type:status===AGENT_SESSION_STATUS.FROZEN?'SESSION_FROZEN':status===AGENT_SESSION_STATUS.REVOKED?'SESSION_REVOKED':'SESSION_COMPLETED',decision:status===AGENT_SESSION_STATUS.FROZEN?'FREEZE':'INFO',reason});
      return Response.json({ok:true,session:updated});
    }

    if(action==='authorize_agent_action'){
      const session=await getSession(base44,user,txt(body.session_id,180));
      if(!session)return Response.json({error:'SESSION_NOT_FOUND'},{status:404});
      const requestId=txt(body.request_id,180)||crypto.randomUUID();
      const prior=await base44.asServiceRole.entities.AgentExecutionEvent.filter({session_id:session.session_id,owner_user_id:user.id,request_id:requestId},'-occurred_at',3).catch(()=>[]);
      const priorDecision=prior.find((x:any)=>x.event_type==='ACTION_DECIDED');
      if(priorDecision)return Response.json({idempotent:true,decision:priorDecision.decision,reason:priorDecision.reason,details:priorDecision.metadata});

      const capability=txt(body.capability,180);
      const events=await getEvents(base44,user,session.session_id);
      const capabilityDecision=authorizeCapability({capability,target_locked:body.target_locked===true,approval_verified:false},{scopes:Array.isArray(session.granted_scopes)?session.granted_scopes:[]});
      const breaker=evaluateAgentSession(session,events,{
        capability,is_write:body.is_write===true,external_communication:body.external_communication===true,
        unexpected_external_communication:body.unexpected_external_communication===true,credential_access:body.credential_access===true,
        privilege_escalation:body.privilege_escalation===true,persistent_instruction_write:body.persistent_instruction_write===true,
        instruction_validation_passed:body.instruction_validation_passed===true,
      },capabilityDecision);
      const metadata={...breaker.flags,counters:breaker.counters||{},budgets:breaker.budgets||session.budgets||{},capability_decision:capabilityDecision};
      await appendEvent(base44,user,session,{request_id:requestId,event_type:'ACTION_REQUESTED',decision:'INFO',reason:'ACTION_REQUESTED',capability,target_type:body.target_type,target_id:body.target_id,metadata:breaker.flags||{}});
      await appendEvent(base44,user,session,{request_id:requestId,event_type:'ACTION_DECIDED',decision:breaker.decision,reason:breaker.reason,capability,target_type:body.target_type,target_id:body.target_id,metadata});
      if(breaker.freeze){
        await base44.asServiceRole.entities.AgentExecutionSession.update(session.id,{status:AGENT_SESSION_STATUS.FROZEN,freeze_reason:breaker.reason,updated_at:now()});
        await appendEvent(base44,user,{...session,status:AGENT_SESSION_STATUS.FROZEN},{request_id:requestId,event_type:'SESSION_FROZEN',decision:'FREEZE',reason:breaker.reason,capability,metadata});
      }
      await base44.asServiceRole.entities.TaskObservation.create({owner_user_id:user.id,source:'AGENT_CIRCUIT_BREAKER',session_id:session.session_id,task_id:session.task_id||'',event_type:breaker.allowed?'TASK_PROGRESS':'POLICY_BLOCK',status:'OBSERVED',summary:`${breaker.decision}: ${breaker.reason}`,affected_components:['capability-broker','agent-circuit-breaker'],details:{request_id:requestId,capability,breaker},occurred_at:now()}).catch(()=>null);
      return Response.json({allowed:breaker.allowed,decision:breaker.decision,reason:breaker.reason,session_status:breaker.freeze?AGENT_SESSION_STATUS.FROZEN:session.status,request_id:requestId,details:metadata},{status:breaker.allowed?200:breaker.decision==='REQUIRE_APPROVAL'?409:403});
    }

    if(action==='normalize_offer'){
      let offer:any=body.offer&&typeof body.offer==='object'?body.offer:null;
      if(!offer&&body.offer_id){
        offer=await base44.asServiceRole.entities.Offer.get(txt(body.offer_id,180)).catch(()=>null);
        if(!offer||!offerVisibleToUser(offer,user.id))return Response.json({error:'OFFER_NOT_FOUND'},{status:404});
      }
      if(!offer)return Response.json({error:'OFFER_REQUIRED'},{status:400});
      const normalized=normalizeOffer(offer,{...(body.context||{}),owner_user_id:user.id});
      if(body.persist===true){
        const created=await base44.asServiceRole.entities.NormalizedOffer.create(pruneNulls({...normalized,owner_user_id:user.id,visibility:'private'}));
        return Response.json({ok:true,normalized:created});
      }
      return Response.json({ok:true,normalized});
    }

    if(action==='authorize_physical_action'){
      const decision=authorizePhysicalCapability(body.request||{capability:body.capability},{...(body.context||{})});
      await base44.asServiceRole.entities.PhysicalCapabilityDecision.create({request_id:txt(body.request_id,180)||crypto.randomUUID(),owner_user_id:user.id,device_id:txt(body.device_id,180),capability:txt((body.request||{}).capability||body.capability,180),decision:decision.decision,reason:decision.reason,risk:decision.risk||'UNKNOWN',context:body.context&&typeof body.context==='object'?body.context:{},details:decision,occurred_at:now()});
      return Response.json({...decision,direct_hardware_execution:false},{status:decision.allowed?200:decision.decision.startsWith('REQUIRE_')?409:403});
    }

    return Response.json({error:'UNKNOWN_ACTION'},{status:400});
  }catch(error:any){
    console.error('lokin-policy-control',error);
    return Response.json({error:txt(error?.message||error,1200)||'POLICY_CONTROL_FAILED'},{status:500});
  }
}
