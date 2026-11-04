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
