// Ocean Desk account sync: opt-in read-only Supabase Auth connection.
// This module is intentionally dormant until a publishable key and URL are configured.
// No local demo balances are ever uploaded to Supabase.
const config=window.OD_SUPABASE_CONFIG || {};
const qs=id=>document.getElementById(id);
const accountButton=qs('odAccountButton');
const accountDialog=qs('odAccountDialog');
const status=qs('odAccountStatus');
const emailInput=qs('odAccountEmail');
const login=qs('odLoginButton');
const googleLogin=qs('odGoogleLoginButton');
const logout=qs('odLogoutButton');
const refresh=qs('odRefreshButton');
const initWallet=qs('odInitWalletButton');
const balance=qs('odServerBalance');
const sceneList=qs('odServerScenes');
const sessionsList=qs('odServerSessions');
const configured=Boolean(config.enabled && /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(config.url||'')
 && typeof config.publishableKey==='string' && /^(sb_publishable_|eyJ)/.test(config.publishableKey));
let client=null;
let unsubscribe=null;
const setStatus=(message)=>{status.textContent=message};
const clearServer=()=>{
  balance.textContent='서버 퍼즐·티켓: 로그인 후 조회';
  sceneList.replaceChildren();
  sessionsList?.replaceChildren();
};
accountButton.addEventListener('click',()=>accountDialog.showModal());
qs('odAccountClose').addEventListener('click',()=>accountDialog.close());
if(!configured){
  login.disabled=true;googleLogin.disabled=true;refresh.disabled=true;logout.disabled=true;initWallet.disabled=true;
  setStatus('계정 연동은 아직 비활성화 상태입니다. 로컬 퍼즐·티켓은 테스트 기록입니다.');
}else{
  try{
    // Pinned SDK ESM version. Keep the import off until a deployment is explicitly configured.
    const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2.49.4?bundle');
    client=createClient(config.url,config.publishableKey,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'}
    });
    window.odAccountGetAccessToken=async()=>{
      const {data:{session},error}=await client.auth.getSession();
      return error?null:(session?.access_token||null);
    };
    const onAuth=async()=>{
      const {data:{user},error}=await client.auth.getUser();
      if(error||!user){
        clearServer();logout.disabled=true;refresh.disabled=true;initWallet.disabled=true;login.disabled=false;googleLogin.disabled=!config.googleEnabled;
        setStatus('로그인되지 않았습니다. 이메일로 로그인 링크를 받을 수 있습니다.');
        window.dispatchEvent(new CustomEvent('od:account-session',{detail:{loggedIn:false}}));
        return;
      }
      login.disabled=true;googleLogin.disabled=true;logout.disabled=false;refresh.disabled=false;initWallet.disabled=false;
      setStatus('로그인: '+(user.email || '사용자')+' · 서버 기록 읽기 전용');
      window.dispatchEvent(new CustomEvent('od:account-session',{detail:{loggedIn:true}}));
      await readServer(user.id);
    };
    async function readServer(userId){
      clearServer();
      const [walletResult,ownedResult,sessionsResult]=await Promise.all([
        client.from('od_wallets').select('pieces,tickets').eq('user_id',userId).maybeSingle(),
        client.from('od_owned_environments').select('environment_id,acquired_at').eq('user_id',userId),
        client.from('od_focus_attempts').select('id,planned_minutes,started_at,completed_at,status').eq('user_id',userId).order('started_at',{ascending:false}).limit(10)
      ]);
      if(walletResult.error||ownedResult.error||sessionsResult.error){
        setStatus('서버 기록 조회에 실패했습니다. DB 스키마·권한 적용 상태를 확인해 주세요.');
        return;
      }
      if(!walletResult.data)balance.textContent='서버 지갑이 아직 생성되지 않았습니다.';
      else balance.textContent='서버 퍼즐 '+walletResult.data.pieces+'/10 · 여행 티켓 '+walletResult.data.tickets+'장';
      const ids=new Set((ownedResult.data||[]).map(x=>x.environment_id));
      for(const id of ids){
        const item=document.createElement('li');item.textContent=id;sceneList.appendChild(item);
      }
      if(!ids.size){
        const item=document.createElement('li');item.textContent='아직 서버에서 획득한 공간이 없습니다.';sceneList.appendChild(item);
      }
      const records=sessionsResult.data||[];
      for(const record of records){
        const item=document.createElement('li');
        const time=new Date(record.started_at);
        const label=record.status==='completed'?'완료':record.status==='active'?'진행 중':'종료';
        item.textContent=`${Number(record.planned_minutes)}분 · ${label} · ${Number.isNaN(time.getTime())?'시간 미확인':time.toLocaleString('ko-KR')}`;
        sessionsList?.appendChild(item);
      }
      if(!records.length){const item=document.createElement('li');item.textContent='서버에 저장된 집중 기록이 없습니다.';sessionsList?.appendChild(item)}
    }
    googleLogin.addEventListener('click',async()=>{
      if(!config.googleEnabled){setStatus('Google 로그인 설정 전입니다.');return}
      googleLogin.disabled=true;
      try{
        const destination=new URL(window.location.pathname,window.location.origin).href;
        const {error}=await client.auth.signInWithOAuth({
          provider:'google',
          options:{redirectTo:destination}
        });
        if(error)throw error;
      }catch(e){setStatus('Google 로그인 실패: '+(e?.message||'오류'));googleLogin.disabled=false}
    });
    login.addEventListener('click',async()=>{
      const email=emailInput.value.trim();
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return setStatus('올바른 이메일 주소를 입력해 주세요.');
      login.disabled=true;
      try{
        const {error}=await client.auth.signInWithOtp({
          email,
          options:{emailRedirectTo:new URL(window.location.pathname,window.location.origin).href}
        });
        if(error)throw error;
        setStatus('이메일로 로그인 링크를 요청했습니다. 메일을 확인해 주세요.');
      }catch(e){setStatus('로그인 링크 발송 실패: '+(e?.message||'오류'));}
      finally{login.disabled=false}
    });
    initWallet.addEventListener('click',async()=>{
      // Explicit action only, never automatic. No demo balance is copied to server.
      initWallet.disabled=true;
      setStatus('서버 지갑 초기화 요청 중입니다.');
      try {
        const {data:{session},error:sessionError}=await client.auth.getSession();
        if(sessionError||!session?.access_token)throw new Error('로그인이 필요합니다.');
        const response=await fetch(config.url+'/functions/v1/od-wallet-initialize',{
          method:'POST',
          headers:{'authorization':'Bearer '+session.access_token,
                   'apikey':config.publishableKey,'content-type':'application/json'},
          body:'{}'
        });
        if(!response.ok)throw new Error('서버 지갑 초기화에 실패했습니다.');
        const {data:{user}}=await client.auth.getUser();
        if(user?.id)await readServer(user.id);
      }catch(e){setStatus('지갑 준비 실패: '+(e?.message||'오류'))}
      finally{initWallet.disabled=false}
    });
    logout.addEventListener('click',async()=>{
      const {error}=await client.auth.signOut();
      if(error)setStatus('로그아웃 실패: '+error.message);
      else await onAuth();
    });
    refresh.addEventListener('click',()=>onAuth());
    const authListener=client.auth.onAuthStateChange(()=>{
      // Deferred to avoid calling Supabase APIs synchronously inside auth callback.
      queueMicrotask(()=>{void onAuth()});
    });
    unsubscribe=()=>authListener.data.subscription.unsubscribe();
    await onAuth();
  }catch(e){
    login.disabled=true;googleLogin.disabled=true;logout.disabled=true;refresh.disabled=true;initWallet.disabled=true;
    setStatus('계정 모듈을 불러오지 못했습니다. 설정 또는 네트워크를 확인해 주세요.');
    console.warn('Ocean Desk auth module init failed',e);
  }
}
window.addEventListener('pagehide',()=>unsubscribe?.());
