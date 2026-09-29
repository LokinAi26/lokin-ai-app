import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import * as circuit from '../base44/shared/agentCircuitBreaker.js';
import { authorizeCapability } from '../base44/shared/capabilityBroker.js';
import { authorizeAgentTarget } from '../base44/shared/agentTargetScope.js';
import { summarizeTaskCosts, TASK_COST_CATEGORIES } from '../base44/shared/taskCostAccounting.js';
const flags={is_write:true,external_communication:true};
const events=[
 {event_type:'ACTION_REQUESTED',metadata:flags},
 {event_type:'ACTION_DECIDED',decision:'FREEZE',metadata:flags},
 {event_type:'SESSION_FROZEN',decision:'FREEZE',metadata:flags}
];
const counts=circuit.summarizeAgentEvents(events);
assert.equal(counts.writes,1);assert.equal(counts.external_communications,1);assert.equal(counts.denials,1);
const session={id:'s',session_id:'s',owner_user_id:'u',status:'ACTIVE',created_at:new Date().toISOString(),granted_scopes:['data:write'],budgets:{max_writes:0}};
assert.equal(circuit.evaluateAgentSession(session,[],{capability:'data.write'},{allowed:true}).reason,'WRITE_BUDGET_EXCEEDED');
assert.equal(circuit.evaluateAgentSession({...session,status:undefined},[],{}, {allowed:true}).allowed,false);
const target={capability:'data.write',target_type:'record',target_id:'one'};
session.metadata={authorized_targets:[target]};
assert.equal(authorizeAgentTarget(session,target).allowed,true);
assert.equal(authorizeAgentTarget(session,{...target,target_id:'two'}).allowed,false);
assert.equal(authorizeAgentTarget({},target).allowed,false);
for(const name of ['AgentExecutionSession','AgentExecutionEvent']){
 const schema=JSON.parse(fs.readFileSync('base44/entities/'+name+'.jsonc','utf8'));
 for(const op of ['create','update','delete'])assert.equal(schema.rls[op],false);
}
assert.equal(summarizeTaskCosts([],1).total_cost_usd,null);
const costs=TASK_COST_CATEGORIES.map((category,index)=>({entry_id:String(index),category,amount_usd:1}));
assert.equal(summarizeTaskCosts(costs,2).cost_per_successful_task_usd,3.5);
assert.equal(summarizeTaskCosts(costs,0).cost_per_successful_task_usd,null);
assert.throws(()=>summarizeTaskCosts([...costs,costs[0]],1));
assert.throws(()=>summarizeTaskCosts([{entry_id:'x',category:'cpu',amount_usd:-1}],1));

// Execute the real handler with a mocked SDK; no network calls or provider spend.
let source=fs.readFileSync('base44/functions/lokin-policy-control/entry.ts','utf8').replace(/^import .*;$/gm,'');
source=source.replace('export default async function(req:Request)','async function handler(req:Request)');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
function handlerFor(client){
 return new Function('createClientFromRequest','authorizeCapability','evaluateAgentSession','defaultAgentBudgets','authorizeAgentTarget','summarizeTaskCosts','console',js+'; return handler;')(
 ()=>client,authorizeCapability,circuit.evaluateAgentSession,circuit.defaultAgentBudgets,authorizeAgentTarget,summarizeTaskCosts,{error(){}});
}
function clientFor({status='ACTIVE',historyError=false,prior=false,saturated=false}={}){
 let writes=0;
 return {auth:{me:async()=>({id:'u'})},asServiceRole:{entities:{
  AgentExecutionSession:{filter:async()=>[{...session,status}],update:async()=>{writes++;return session;}},
  AgentExecutionEvent:{filter:async q=>{
    if(q.request_id)return prior?[{event_type:'ACTION_DECIDED',decision:'ALLOW'}]:[];
    if(historyError)throw new Error('database unavailable');
    return saturated?Array(600).fill({}):[];
   },create:async()=>{writes++;return {};}}
 }},writes:()=>writes};
}
for(const [options,status] of [[{status:'FROZEN',prior:true},403],[{prior:true},409],[{historyError:true},500],[{saturated:true},500]]){
 const client=clientFor(options);
 const response=await handlerFor(client)(new Request('https://test.invalid',{method:'POST',body:JSON.stringify({action:'authorize_agent_action',session_id:'s',request_id:'r',...target})}));
 assert.equal(response.status,status);assert.equal(client.writes(),0);
}
console.log('Agent policy hardening and task cost tests PASS');
