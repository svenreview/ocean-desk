// Ocean Desk 2.0 — opt-in server focus lifecycle adapter.
// This module never changes the legacy timer or generates puzzle rewards.
// Server focus is disabled by default; only manually enabled staging can call it.
import {validateRuntimeConfig} from './od-config-validator.mjs';
const validation=validateRuntimeConfig(window.OD_SUPABASE_CONFIG,window.location.origin);
const config=validation.config;
const enabled=validation.ok&&config.enabled===true&&config.serverFocusEnabled===true;
const state={pending:null,session:null,epoch:0,needsReset:false};
const $=id=>document.getElementById(id);
const status=$('odServerFocusStatus');
const checkButton=$('odCheckFocusButton');
const restoreButton=$('odRestoreFocusButton');
let recovery=null;
let activeUserId=null;
let identityVersion=0;
const say=(s)=>{if(status)status.textContent=s};
const valid=()=>enabled&&Boolean(activeUserId)&&typeof window.odAccountGetAccessToken==='function';
const endpoint=()=>config.url+'/functions/v1/od-focus-session';
async function post(action,options={}){
  if(!valid())throw Error('로그인되지 않았습니다.');
  const owner=activeUserId,version=identityVersion;
  const stillOwner=()=>activeUserId===owner&&identityVersion===version;
  const token=await window.odAccountGetAccessToken?.();
  if(!token||!stillOwner())throw Error('로그인 계정이 변경됐습니다.');
  const res=await fetch(endpoint(),{
    method:'POST',
    headers:{'authorization':'Bearer '+token,'apikey':config.publishableKey,'content-type':'application/json'},
    body:JSON.stringify({action,...options})
  });
  const data=await res.json().catch(()=>({}));
  if(!stillOwner())throw Error('로그인 계정이 변경됐습니다.');
  if(!res.ok)throw Error(data.error||'server_unavailable');
  return data;
}
async function cancelCurrent(){
  state.epoch++;
  const pending=state.pending;
  const session=state.session;
  state.pending=null;state.session=null;
  if(!valid())return;
  try{
    const started=pending?await pending:session;
    if(started?.session_id)await post('cancel',{session_id:started.session_id});
  }catch(e){say('서버 세션 취소 확인 실패. 세션은 만료 전 보상에 사용하지 마세요.')}
}
async function begin(minutes,accumulated){
  if(!valid())return;
  if(accumulated>0){
    state.needsReset=true;
    say('이어 집중하기는 로컬 타이머만 지원합니다. 서버 검증은 초기화 후 새 세션부터 가능합니다.');
    return;
  }
  if(state.needsReset){say('서버 검증을 시작하려면 타이머를 초기화해 주세요.');return}
  if(minutes!==25&&minutes!==50)return;
  const nonce=++state.epoch;
  const request_id=crypto.randomUUID();
  state.session=null;
  state.pending=post('start',{request_id,minutes});
  try{
    const result=await state.pending;
    if(nonce!==state.epoch){
      // Explicit restore may adopt this exact session while start is pending.
      if(state.session?.session_id!==result.session_id)
        await post('cancel',{session_id:result.session_id}).catch(()=>{});
      return;
    }
    state.session=result;
    say(minutes+'분 서버 집중 세션 시작 · 서버 시간으로 검증합니다.');
  }catch(e){
    if(nonce===state.epoch){state.needsReset=true;say('서버 시작 실패. 이번 집중은 로컬 기록만 저장됩니다.')}
  }finally{if(nonce===state.epoch)state.pending=null}
}
async function finish(minutes){
  if(!valid())return;
  if(state.needsReset){say('이번 집중은 서버 보상 대상이 아닙니다.');return}
  const nonce=state.epoch;
  try{
    const started=state.pending?await state.pending:state.session;
    if(nonce!==state.epoch||!started?.session_id)return;
    const result=await post('finish',{session_id:started.session_id});
    if(nonce!==state.epoch)return;
    if(result.verified===true)say('서버 집중 시간 확인 완료 · 광고 완료 검증 후 보상 신청 가능');
    else say('서버 집중 기록이 만료되어 보상 대상이 아닙니다.');
  }catch(e){
    if(nonce===state.epoch)say('서버 집중 완료 확인 실패. 로컬 타이머 기록은 유지됩니다.');
  }finally{if(nonce===state.epoch){state.session=null;state.pending=null;state.needsReset=true}}
}
window.addEventListener('od:timer-state',e=>{
  const {action,minutes,accumulated}=e.detail||{};
  if(action==='start')void begin(minutes,accumulated);
  if(action==='pause'){state.needsReset=true;void cancelCurrent()}
  if(action==='reset'){state.needsReset=false;void cancelCurrent();say(valid()?'새로운 서버 집중 세션을 시작할 수 있습니다.':'서버 집중 기록 미연결 · 로컬 타이머 사용 중')}
});
window.addEventListener('od:focus-complete',e=>{void finish(e.detail?.minutes)});
if(!enabled)say('서버 집중 검증 비활성화 · 기존 로컬 타이머를 사용 중입니다.');
else say('로그인 후 새 집중을 시작하면 서버 검증을 시도합니다.');


// Recovery lookup is manual, and never imports local reward data.
function setRecoveryButtons(loggedIn){
  if(checkButton)checkButton.disabled=!valid()||!loggedIn;
  if(restoreButton)restoreButton.disabled=true;
  recovery=null;
}
window.addEventListener('od:account-session',e=>{
  const incoming=e.detail?.loggedIn===true?e.detail?.userId:null;
  const nextUser=typeof incoming==='string'&&incoming?incoming:null;
  if(nextUser!==activeUserId){
    identityVersion++;
    state.session=null;state.pending=null;state.needsReset=true;state.epoch++;
    activeUserId=nextUser;
    setRecoveryButtons(Boolean(nextUser));
  }
  // Same-account token refresh preserves active session and recovery candidate.
});
checkButton?.addEventListener('click',async()=>{
  if(!valid())return;
  checkButton.disabled=true;
  restoreButton.disabled=true;
  const version=identityVersion;
  try{
    const result=await post('status');
    if(version!==identityVersion)return;
    recovery=result;
    if(!recovery.active){
      say(recovery.expired?'서버 집중 세션이 만료됐습니다. 새로 시작해 주세요.':'진행 중인 서버 집중 세션이 없습니다.');
      return;
    }
    const remaining=Math.max(0,Number(recovery.remaining_seconds)||0);
    say(remaining===0?'서버 집중 시간이 끝났습니다. 완료 확인을 선택할 수 있습니다.':`서버 세션 발견 · ${recovery.planned_minutes}분 · 남은 시간 ${Math.ceil(remaining/60)}분`);
    restoreButton.textContent=remaining===0?'완료 확인':'이어하기';
    restoreButton.disabled=false;
  }catch(e){recovery=null;say('서버 집중 상태를 확인하지 못했습니다. 로그인과 네트워크를 확인해 주세요.')}
  finally{checkButton.disabled=false}
});
restoreButton?.addEventListener('click',async()=>{
  if(!valid()||!recovery?.active)return;
  restoreButton.disabled=true;
  const version=identityVersion;
  try{
    // Always re-check server time before restoring, never reuse stale timestamps.
    const latest=await post('status');
    if(version!==identityVersion)return;
    if(!latest.active||latest.session_id!==recovery.session_id){
      recovery=null;say('서버 집중 상태가 변경되었습니다. 다시 확인해 주세요.');return;
    }
    const left=Math.max(0,Number(latest.remaining_seconds)||0);
    if(left===0){
      const result=await post('finish',{session_id:latest.session_id});
      if(version!==identityVersion)return;
      say(result.verified?'서버 집중 완료가 확인되었습니다. 광고 검증은 별도입니다.':'집중 완료를 확인할 수 없습니다.');
      recovery=null;state.session=null;state.pending=null;state.needsReset=true;
      return;
    }
    // Don't mutate timer until a user explicitly enters the study area.
    let accepted=false;
    const receive=e=>{accepted=Boolean(e.detail?.ok)};
    window.addEventListener('od:restore-result',receive,{once:true});
    window.dispatchEvent(new CustomEvent('od:restore-server-focus',{
      detail:{minutes:Number(latest.planned_minutes),elapsed:Number(latest.elapsed_seconds)}
    }));
    if(!accepted){
      say('먼저 공부 공간에 입장하고, 이전의 일시정지 기록은 초기화한 뒤 이어하기를 선택해 주세요.');
      return;
    }
    state.epoch++;
    state.session=latest;state.pending=null;state.needsReset=false;
    say('서버 집중 기록을 복구했습니다. 같은 세션의 남은 시간을 이어갑니다.');
    $('odAccountDialog')?.close();
    recovery=null;
  }catch(e){say('집중 기록 복구 실패. 서버 상태를 다시 확인해 주세요.')}
  finally{restoreButton.disabled=!recovery}
});
