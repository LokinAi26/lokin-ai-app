export const ADAPTER_CONTROL_VERSION='LOKIN_EXTERNAL_ADAPTERS_V1';

const cleanOrigin=(value='')=>String(value||'').trim().replace(/\/+$/,'');
export function adapterStatus(config={}){
 const omniOrigin=cleanOrigin(config.omniroute_base_url);
 const headroomOrigin=cleanOrigin(config.headroom_base_url);
 const omniroute=Boolean(omniOrigin&&config.omniroute_token);
 const headroom=Boolean(headroomOrigin&&config.headroom_token);
 return{
  version:ADAPTER_CONTROL_VERSION,
  omniroute:{status:omniroute?'READY':'SETUP_REQUIRED',mode:'OPTIONAL_GATEWAY',base_url_configured:Boolean(omniOrigin),token_configured:Boolean(config.omniroute_token),automatic_primary:false},
  headroom:{status:headroom?'READY':'SETUP_REQUIRED',mode:headroom?'AUDIT':'DISABLED',base_url_configured:Boolean(headroomOrigin),token_configured:Boolean(config.headroom_token),transforms_enabled:false},
  claude_mem:{status:'NATIVE_PATTERN',mode:'LOKIN_CONTROL_PLANE',package_embedded:false,reason:'CLAUDE_MEM_LOCAL_WORKER_NOT_BASE44_SERVERLESS_RUNTIME'}
 };
}
export function buildGatewayPlan(config={},request={}){
 const status=adapterStatus(config);
 const stages=[];
 if(status.headroom.status==='READY')stages.push({stage:'context_compression',provider:'headroom',mode:'audit'});
 if(status.omniroute.status==='READY')stages.push({stage:'model_gateway',provider:'omniroute',mode:'evaluation_only'});
 stages.push({stage:'capability_broker',provider:'lokin',mode:'enforce'});
 stages.push({stage:'model_evaluation',provider:'lokin',mode:'no_auto_promotion'});
 return{status:stages.some(x=>x.provider==='omniroute')?'READY':'SETUP_REQUIRED',stages,requested_capability:String(request.capability||'ai.infer'),version:ADAPTER_CONTROL_VERSION};
}
