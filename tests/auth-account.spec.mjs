import {test,expect} from '@playwright/test';

test.beforeEach(async({page})=>{
  await page.addInitScript(()=>{
    const settings={enabled:true,googleEnabled:true,serverFocusEnabled:false,
      autoInitializeWallet:false,url:'https://staging.supabase.co',publishableKey:'sb_publishable_test',
      allowedOrigins:['http://127.0.0.1:4173']};
    Object.defineProperty(window,'OD_SUPABASE_CONFIG',{
      configurable:true,get(){return settings},set(){/* ignore disabled production default in fixture */ }
    });
  });
  await page.addInitScript({path:'tests/fixtures/supabase-auth-browser-mock.js'});
  await page.route('https://esm.sh/@supabase/supabase-js@2.49.4?bundle',route=>route.fulfill({
    status:200,contentType:'text/javascript',
    body:'export const createClient = () => window.__odMockClient;'
  }));
  await page.goto('http://127.0.0.1:4173/');
  await page.locator('#odAccountButton').click();
  await expect(page.locator('#odGoogleLoginButton')).toBeEnabled();
});

test('Google OAuth uses correct provider and registered return path',async({page})=>{
  await page.locator('#odGoogleLoginButton').click();
  const request=await page.evaluate(()=>window.__odAuthMock.lastOAuth);
  expect(request).toEqual({provider:'google',options:{redirectTo:'http://127.0.0.1:4173/'}});
});

test('account A and B have isolated gallery, wallet and focus identity',async({page})=>{
  await page.evaluate(()=>window.__odAuthMock.signIn('alpha'));
  await expect(page.locator('#odServerBalance')).toHaveText('서버 퍼즐 4/10 · 여행 티켓 2장');
  await expect(page.locator('#odServerScenes')).toContainText('bali-sunset');
  await expect(page.locator('#odServerScenes')).not.toContainText('jeju-forest');

  await page.evaluate(()=>window.__odAuthMock.switchTo('beta'));
  await expect(page.locator('#odServerBalance')).toHaveText('서버 퍼즐 8/10 · 여행 티켓 7장');
  await expect(page.locator('#odServerScenes')).toContainText('jeju-forest');
  await expect(page.locator('#odServerScenes')).not.toContainText('bali-sunset');
  await page.locator('#odAccountClose').click();
  await page.locator('#odGalleryOpen').click();
  await expect(page.locator('#odFrames button').filter({hasText:'제주 숲속서재'})).toBeEnabled();
  await expect(page.locator('#odFrames button').filter({hasText:'발리 선셋룸'})).toBeDisabled();
});

test('logout discards server collection and returns to local demo without overwrite',async({page})=>{
  await page.evaluate(()=>{
    localStorage.setItem('od-mvp-local-rewards-v1',JSON.stringify({pieces:2,tickets:1,claims:[],owned:['bali-forest']}));
    window.__odAuthMock.signIn('alpha');
  });
  await expect(page.locator('#odServerBalance')).toHaveText('서버 퍼즐 4/10 · 여행 티켓 2장');
  await page.locator('#odLogoutButton').click();
  await expect(page.locator('#odServerBalance')).toContainText('로그인 후 조회');
  await page.locator('#odAccountClose').click();
  await page.locator('#odGalleryOpen').click();
  await expect(page.locator('#odGalleryCount')).toContainText('로컬 데모');
  await expect(page.locator('#odFrames button').filter({hasText:'발리 레인포레스트 카페'})).toBeEnabled();
  const demo=await page.evaluate(()=>JSON.parse(localStorage.getItem('od-mvp-local-rewards-v1')));
  expect(demo).toMatchObject({pieces:2,tickets:1,owned:['bali-forest']});
});


test('same-account token renewal does not emit logout or discard active focus identity', async ({page})=>{
  await page.evaluate(()=>window.__odAuthMock.signIn('alpha'));
  await expect(page.locator('#odServerBalance')).toHaveText('서버 퍼즐 4/10 · 여행 티켓 2장');
  const details=await page.evaluate(async()=>{
    const events=[];
    const cb=e=>events.push(e.detail);
    window.addEventListener('od:account-session',cb);
    window.__odAuthMock.switchTo('alpha');
    await new Promise(resolve=>setTimeout(resolve,120));
    window.removeEventListener('od:account-session',cb);
    return events;
  });
  expect(details.filter(e=>e.loggedIn===false)).toHaveLength(0);
  await expect(page.locator('#odServerBalance')).toHaveText('서버 퍼즐 4/10 · 여행 티켓 2장');
});

test('account change emits logout before loading next account details',async({page})=>{
  await page.evaluate(()=>window.__odAuthMock.signIn('alpha'));
  await expect(page.locator('#odServerBalance')).toHaveText('서버 퍼즐 4/10 · 여행 티켓 2장');
  const states=await page.evaluate(async()=>{
    const states=[];
    const cb=e=>states.push(e.detail?.loggedIn);
    window.addEventListener('od:account-session',cb);
    window.__odAuthMock.switchTo('beta');
    await new Promise(resolve=>setTimeout(resolve,120));
    window.removeEventListener('od:account-session',cb);
    return states;
  });
  expect(states).toContain(false);
  await expect(page.locator('#odServerBalance')).toHaveText('서버 퍼즐 8/10 · 여행 티켓 7장');
});


test('in-flight server focus lookup cannot show previous account result after switch',async({page})=>{
  // Account mock supplies users, browser route supplies a deliberately delayed focus response.
  await page.evaluate(()=>{
    window.OD_SUPABASE_CONFIG.serverFocusEnabled=true;
  });
  // Runtime config is immutable once the module loads: reload with enabled config.
  await page.addInitScript(()=>{
    const prior=window.OD_SUPABASE_CONFIG;
    if(prior)prior.serverFocusEnabled=true;
  });
  await page.reload();
  await page.locator('#odAccountButton').click();
  await page.evaluate(()=>window.__odAuthMock.signIn('alpha'));
  await expect(page.locator('#odServerBalance')).toContainText('퍼즐 4/10');
  let unblock;
  const pending=new Promise(resolve=>{unblock=resolve});
  await page.route('https://staging.supabase.co/functions/v1/od-focus-session',async route=>{
    await pending;
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      active:true,session_id:'aaaa0000-0000-4000-8000-000000000001',
      planned_minutes:25,remaining_seconds:500,elapsed_seconds:1000
    })});
  });
  await page.locator('#odCheckFocusButton').click();
  await page.evaluate(()=>window.__odAuthMock.switchTo('beta'));
  await expect(page.locator('#odServerBalance')).toContainText('퍼즐 8/10');
  unblock();
  await expect(page.locator('#odRestoreFocusButton')).toBeDisabled();
  await expect(page.locator('#odServerFocusStatus')).not.toContainText('서버 세션 발견');
});
