// Ocean Desk 2.0 — opt-in server focus lifecycle adapter.
// This module never changes the legacy timer or generates puzzle rewards.
// Server focus is disabled by default; only manually enabled staging can call it.
const config=window.OD_SUPABASE_CONFIG||{};
const enabled=config.enabled===true&&config.serverFocusEnabled===true&&
  /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(config.url||'');
const state={pending:null,session:null,epoch:0,needsReset:false};
const $=id=>document.getElementById(id);
const status=$('odServerFocusStatus');
const say=(s)=>{if(status)status.textContent=s};
const valid=()=>enabled&&typeof window.odAccountGetAccessToken==='function';
const endpoint=()=>config.url+'/functions/v1/od-focus-session';
async function post(action,options={}){
  const token=await window.odAccountGetAccessToken?.();
  if(!token)throw Error('로그인되지 않았습니다.');
  const res=await fetch(endpoint(),{
    method:'POST',
    headers:{'authorization':'Bearer '+token,'apikey':config.publishableKey,'content-type':'application/json'},
    body:JSON.stringify({action,...options})
  });
  const data=await res.json().catch(()=>({}));
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
    say('서버 집중 완료 확인 실패. 로컬 타이머 기록은 유지됩니다.');
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
