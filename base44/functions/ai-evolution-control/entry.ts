import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import { createFreshEvaluationSuite } from '../../shared/dynamicEvaluation.js';
import { evaluateResponse, routeModel, MODEL_ROUTER_VERSION } from '../../shared/modelRouter.js';
import { chooseSpeechProvider, SPEECH_ROUTER_VERSION } from '../../shared/speechRouter.js';
import { authorizeCapability, listCapabilityPolicies, CAPABILITY_BROKER_VERSION } from '../../shared/capabilityBroker.js';
import { adapterStatus, buildGatewayPlan } from '../../shared/externalIntelligenceAdapters.js';
import { searchMemoryRows, memoryTimeline, getMemoryObservations, MEMORY_RETRIEVAL_VERSION } from '../../shared/memoryRetrieval.js';
import { createEvaluationCircuit, advanceEvaluationCircuit, estimateEvaluationCost, summarizeEvaluationCost } from '../../shared/evaluationSafety.js';
import { invokeLLMWithAdmission } from '../../shared/ecosystemAdmission.js';

const txt=(v:any,n=4000)=>String(v??'').trim().slice(0,n);
const admin=(u:any)=>String(u?.role||'').toLowerCase()==='admin';
const p95=(xs:number[])=>{if(!xs.length)return 0;const s=[...xs].sort((a,b)=>a-b);return s[Math.min(s.length-1,Math.ceil(s.length*.95)-1)]};

export default async function(req:Request){
 const base44:any=createClientFromRequest(req);
 try{
  const user:any=await base44.auth.me().catch(()=>null);
  if(!user)return Response.json({error:'UNAUTHORIZED'},{status:401});
  const body:any=await req.json().catch(()=>({}));
  const action=txt(body.action,80)||'status';

  if(action==='status'){
   const [speech,evaluations]=await Promise.all([
    base44.asServiceRole.entities.SpeechProviderState.list('-last_checked_at',25).catch(()=>[]),
    base44.asServiceRole.entities.AIModelEvaluation.list('-created_at',25).catch(()=>[])
   ]);
   const configured=speech.filter((x:any)=>x.configured===true&&x.enabled!==false);
   const adapters=adapterStatus({
    omniroute_base_url:secrets.get('OMNIROUTE_BASE_URL'),omniroute_token:secrets.get('OMNIROUTE_TOKEN'),
    headroom_base_url:secrets.get('HEADROOM_BASE_URL'),headroom_token:secrets.get('HEADROOM_API_KEY'),
    claude_code_observer_token:secrets.get('LOKIN_AGENT_OBSERVER_TOKEN')
   });
   return Response.json({status:'READY',versions:{model_router:MODEL_ROUTER_VERSION,speech_router:SPEECH_ROUTER_VERSION,capability_broker:CAPABILITY_BROKER_VERSION,memory_retrieval:MEMORY_RETRIEVAL_VERSION},model_evaluation:{status:evaluations.length?'READY':'NO_EVALUATION_DATA',recent:evaluations},speech:{status:configured.length?'READY':'SETUP_REQUIRED',providers:speech},external_adapters:adapters,gateway_plan:buildGatewayPlan({omniroute_base_url:secrets.get('OMNIROUTE_BASE_URL'),omniroute_token:secrets.get('OMNIROUTE_TOKEN'),headroom_base_url:secrets.get('HEADROOM_BASE_URL'),headroom_token:secrets.get('HEADROOM_API_KEY'),claude_code_observer_token:secrets.get('LOKIN_AGENT_OBSERVER_TOKEN')},{capability:'ai.infer'}),capabilities:listCapabilityPolicies(),automatic_promotion:false,arbitrary_shell:false});
  }

  if(action==='generate_dynamic_suite'){
   const suite=createFreshEvaluationSuite({seed:body.seed});
   await base44.asServiceRole.entities.DynamicEvaluationRun.create({suite_id:suite.suite_id,seed:suite.seed,domain:'LOKIN_AI',status:'GENERATED',tasks:{items:suite.tasks},summary:{task_count:suite.tasks.length},version:suite.version,created_at:new Date().toISOString()});
   return Response.json(suite);
  }

  if(action==='route_model')return Response.json(routeModel(Array.isArray(body.candidates)?body.candidates.slice(0,20):[],body.policy||{}));

  if(action==='speech_route'){
   const providers=await base44.asServiceRole.entities.SpeechProviderState.list('-last_checked_at',50).catch(()=>[]);
   const route=chooseSpeechProvider(providers,{language:txt(body.language,20)||'en',streaming:body.streaming!==false});
   return Response.json(route.selected?{status:'READY',...route}:{status:'SETUP_REQUIRED',...route});
  }

  if(action==='authorize_capability'){
   const scopes=admin(user)&&Array.isArray(body.actor_scopes)?body.actor_scopes.map(String):[];
   const decision=authorizeCapability({capability:body.capability,target_locked:body.target_locked===true,approval_verified:false},{scopes});
   await base44.asServiceRole.entities.CapabilityDecision.create({request_id:crypto.randomUUID(),capability:txt(body.capability,160),actor_user_id:user.id,decision:decision.decision,reason:decision.reason,risk:decision.risk||'UNKNOWN',target_type:txt(body.target_type,100),target_id:txt(body.target_id,180),details:decision,occurred_at:new Date().toISOString()});
   return Response.json(decision,{status:decision.allowed?200:403});
  }

  if(['memory_search','memory_timeline','memory_get'].includes(action)){
   const [memories,events]=await Promise.all([
    base44.asServiceRole.entities.LokinLearningMemory.filter({user_id:user.id,active:true},'-updated_date',200).catch(()=>[]),
    admin(user)?base44.asServiceRole.entities.LokinControlEvent.list('-occurred_at',200).catch(()=>[]):base44.asServiceRole.entities.LokinControlEvent.filter({owner_user_id:user.id},'-occurred_at',200).catch(()=>[])
   ]);
   const rows=[...memories,...events];
   if(action==='memory_search')return Response.json({version:MEMORY_RETRIEVAL_VERSION,results:searchMemoryRows(rows,body.query,body.limit)});
   if(action==='memory_timeline')return Response.json({version:MEMORY_RETRIEVAL_VERSION,results:memoryTimeline(rows,txt(body.anchor_id,180),body.radius)});
   return Response.json({version:MEMORY_RETRIEVAL_VERSION,results:getMemoryObservations(rows,body.ids)});
  }

  if(action==='list_task_observations'){
   const rows=admin(user)?await base44.asServiceRole.entities.TaskObservation.list('-occurred_at',100).catch(()=>[]):await base44.asServiceRole.entities.TaskObservation.filter({owner_user_id:user.id},'-occurred_at',100).catch(()=>[]);
   return Response.json({status:'READY',auto_apply:false,observations:rows});
  }

  if(action==='run_model_evaluation'){
   if(!admin(user))return Response.json({error:'ADMIN_REQUIRED'},{status:403});
   const models=(Array.isArray(body.models)?body.models:[]).slice(0,4).map((m:any)=>({provider:txt(m.provider,80)||'base44_core',model:txt(m.model,160),input_rate:m.input_rate,output_rate:m.output_rate})).filter((m:any)=>m.model);
   if(!models.length)return Response.json({error:'CONFIGURED_MODEL_LIST_REQUIRED',status:'SETUP_REQUIRED'},{status:400});
   const suite=createFreshEvaluationSuite({seed:body.seed}),summaries:any[]=[];
   let circuit=createEvaluationCircuit();
   for(const candidate of models){
    if(circuit.status==='FROZEN')break;
    const results:any[]=[];
    for(const task of suite.tasks){
     circuit=advanceEvaluationCircuit(circuit,'CALL');
     if(circuit.status==='FROZEN')break;
     const started=Date.now();
     try{
      const response:any=await invokeLLMWithAdmission(base44,{prompt:task.prompt,model:candidate.model},{sourceApp:'LOKIN AI',domain:'evaluation',priority:35,estimatedCost:0,tags:['model-evaluation','owned-gpu']});
      const raw=typeof response==='string'?response:JSON.stringify(response);
      const estimated=estimateEvaluationCost(task.prompt,raw,candidate.input_rate,candidate.output_rate);
      results.push({...evaluateResponse(task,raw,Date.now()-started,estimated,''),estimated_cost_usd:estimated});
      circuit=advanceEvaluationCircuit(circuit,'CHECK');
     }catch(e:any){
      results.push({...evaluateResponse(task,'',Date.now()-started,0,txt(e?.code||'INFERENCE_FAILED',100)),estimated_cost_usd:null});
      circuit=advanceEvaluationCircuit(circuit,e?.code==='LOKIN_ECOSYSTEM_ADMISSION_DENIED'?'POLICY_DENIAL':'ERROR');
     }
     if(circuit.status==='FROZEN')break;
    }
    if(!results.length)break;
    const failures=results.filter((x:any)=>!x.pass).length;
    const costSummary=summarizeEvaluationCost(results);
    const summary={requested_provider:candidate.provider,requested_model:candidate.model,provider:'admission_router',model:'UNVERIFIED',identity_status:'UNVERIFIED',completed_tasks:results.length,expected_tasks:suite.tasks.length,circuit:{...circuit},quality_score:results.reduce((s:number,x:any)=>s+Number(x.quality||0),0)/results.length,failure_rate:failures/results.length,p95_latency_ms:p95(results.map((x:any)=>x.latency_ms)),...costSummary,results};
    summaries.push(summary);
    await base44.asServiceRole.entities.AIModelEvaluation.create({suite_id:suite.suite_id,model:'UNVERIFIED',provider:'admission_router',status:failures||results.length!==suite.tasks.length?'FAIL':'PASS',quality_score:summary.quality_score,failure_rate:summary.failure_rate,p95_latency_ms:summary.p95_latency_ms,...(summary.estimated_cost_usd===null?{}:{estimated_cost_usd:summary.estimated_cost_usd}),results:{items:results,requested_provider:candidate.provider,requested_model:candidate.model,identity_status:'UNVERIFIED',cost:costSummary,circuit:{...circuit}},router_version:MODEL_ROUTER_VERSION,created_at:new Date().toISOString()});
   }
   // Admission may select a local model or fallback without returning model identity.
   // Scored outputs cannot establish which candidate actually executed.
   const recommendation=null;
   return Response.json({suite_id:suite.suite_id,summaries,recommendation,recommendation_status:'BLOCKED_UNVERIFIED_MODEL_IDENTITY',circuit,circuit_scope:'THIS_SEQUENTIAL_EVALUATION_ONLY',promotion_applied:false});
  }

  return Response.json({error:'UNKNOWN_ACTION'},{status:400});
 }catch(e:any){return Response.json({error:txt(e?.message||e,1200)},{status:500})}
}
