export const PHYSICAL_CAPABILITY_BROKER_VERSION = 'LOKIN_PHYSICAL_CAPABILITY_BROKER_V1';

const POLICIES = Object.freeze({
  'vision.vehicle_speed.read': { risk:'READ_ONLY', requirement:'AUTO', moving_allowed:true },
  'vision.hud.mode.change': { risk:'LOW', requirement:'AUTO', moving_allowed:true },
  'vision.navigation.start': { risk:'MEDIUM', requirement:'CONDITIONAL_CONFIRMATION', moving_allowed:true },
  'vision.navigation.destination.change': { risk:'MEDIUM', requirement:'EXPLICIT_CONFIRMATION', moving_allowed:true },
  'vision.safety_system.modify': { risk:'PROHIBITED', requirement:'PROHIBITED', moving_allowed:false },
  'vision.financial_transaction.execute': { risk:'HIGH', requirement:'EXPLICIT_CONFIRMATION', moving_allowed:false },
  'vision.vehicle.unlock': { risk:'HIGH', requirement:'HARDWARE_BACKED_AUTH', moving_allowed:false },
  'vision.vehicle.start': { risk:'HIGH', requirement:'HARDWARE_BACKED_AUTH', moving_allowed:false },
});

const text=(v,max=300)=>String(v??'').trim().slice(0,max);

export function authorizePhysicalCapability(request = {}, context = {}) {
  const capability=text(request.capability,160);
  const policy=POLICIES[capability];
  if(!policy)return {allowed:false,decision:'DENY',reason:'UNKNOWN_PHYSICAL_CAPABILITY',capability,version:PHYSICAL_CAPABILITY_BROKER_VERSION};
  if(policy.requirement==='PROHIBITED')return {allowed:false,decision:'DENY',reason:'CAPABILITY_PROHIBITED',capability,risk:policy.risk,version:PHYSICAL_CAPABILITY_BROKER_VERSION};

  const moving=context.vehicle_moving===true || Number(context.speed_mph||0)>0;
  if(moving && policy.moving_allowed!==true){
    return {allowed:false,decision:'DENY',reason:'NOT_ALLOWED_WHILE_MOVING',capability,risk:policy.risk,version:PHYSICAL_CAPABILITY_BROKER_VERSION};
  }

  if(capability==='vision.navigation.start'){
    const destinationChanged=request.destination_changed===true;
    const intentVerified=request.user_intent_verified===true;
    if(!intentVerified || (moving && destinationChanged && request.explicit_confirmation!==true)){
      return {allowed:false,decision:'REQUIRE_CONFIRMATION',reason:!intentVerified?'VERIFIED_USER_INTENT_REQUIRED':'MOVING_DESTINATION_CHANGE_REQUIRES_CONFIRMATION',capability,risk:policy.risk,version:PHYSICAL_CAPABILITY_BROKER_VERSION};
    }
  }

  if(policy.requirement==='EXPLICIT_CONFIRMATION' && request.explicit_confirmation!==true){
    return {allowed:false,decision:'REQUIRE_CONFIRMATION',reason:'EXPLICIT_CONFIRMATION_REQUIRED',capability,risk:policy.risk,version:PHYSICAL_CAPABILITY_BROKER_VERSION};
  }
  if(policy.requirement==='HARDWARE_BACKED_AUTH' && request.hardware_auth_verified!==true){
    return {allowed:false,decision:'REQUIRE_HARDWARE_AUTH',reason:'HARDWARE_BACKED_AUTH_REQUIRED',capability,risk:policy.risk,version:PHYSICAL_CAPABILITY_BROKER_VERSION};
  }

  return {
    allowed:true,
    decision:'ALLOW',
    reason:'PHYSICAL_POLICY_PASS',
    capability,
    risk:policy.risk,
    requirement:policy.requirement,
    constraints:{minimum_distraction:moving,audit_required:true,direct_hardware_execution:false},
    version:PHYSICAL_CAPABILITY_BROKER_VERSION,
  };
}

export function listPhysicalCapabilityPolicies(){
  return Object.entries(POLICIES).map(([capability,policy])=>({capability,...policy}));
}
