import { test, expect } from '@playwright/test';

test('Bali gallery enters original 25-minute timer with waves and awards one test puzzle', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/');
  await page.locator('#odGalleryOpen').click();
  await expect(page.getByRole('dialog', { name: '나의 갤러리' })).toBeVisible();
  await page.getByRole('button', { name: '이 공간에서 공부하기' }).click();
  await expect(page.locator('#oceanOverlay')).toHaveClass(/active/);
  await expect(page.locator('#oceanOverlay')).toHaveClass(/od-bali/);
  await expect(page.locator('#oceanSeatLabel')).toContainText('발리 오션카페');
  await expect(page.locator('#timerText')).toContainText('25:');
  await expect(page.locator('#soundToggle')).toHaveAttribute('aria-checked', 'true');
  await page.evaluate(() => {
    state.timerStart = Date.now() - (25 * 60 + 1) * 1000;
    timerRender();
  });
  await expect(page.getByRole('dialog', { name: '집중 완료와 퍼즐 보상' })).toBeVisible();
  await page.getByRole('button', { name: '테스트 퍼즐 1조각 받기' }).click();
  await expect(page.locator('#odProgress')).toHaveText('퍼즐 1 / 10');
  await expect(page.locator('#odClaim')).toBeDisabled();
  await page.getByRole('button', { name: '갤러리로 돌아가기' }).click();
  await expect(page.getByRole('dialog', { name: '나의 갤러리' })).toBeVisible();
});

test('ten unique test sessions produce ticket; region unlock has no duplicates', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/');
  for (let i = 0; i < 10; i++) {
    await page.evaluate(i => window.dispatchEvent(new CustomEvent('od:focus-complete', { detail: { minutes: 25, sessionId: 'test-' + i } })), i);
    await page.getByRole('button', { name: '테스트 퍼즐 1조각 받기' }).click();
    await page.locator('#odRewardClose').click();
  }
  await page.locator('#odGalleryOpen').click();
  await page.getByRole('button', { name: /세계지도/ }).click();
  await expect(page.locator('#odMapTickets')).toContainText('1장');
  await page.locator('#odRegions button').filter({ hasText: '제주' }).click();
  await expect(page.locator('#odTravelResult')).toContainText('새로운 공간 획득');
  await expect(page.locator('#odMapTickets')).toContainText('0장');
  const initial = await page.evaluate(() => JSON.parse(localStorage.getItem('od-mvp-local-rewards-v1')));
  expect(initial.owned).toHaveLength(1);
  expect(initial.owned[0]).toMatch(/^jeju-/);
  await page.reload();
  await page.locator('#odGalleryOpen').click();
  await expect(page.locator('#odGalleryCount')).toContainText('3 / 9');
  await page.getByRole('button', { name: /세계지도/ }).click();
  await expect(page.locator('#odMapTickets')).toContainText('0장');
});

test('mobile gallery supports 50-minute silent focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:4173/');
  await page.locator('#odGalleryOpen').click();
  await expect(page.locator('#odGallery')).toBeVisible();
  await page.locator('#od50').click();
  await page.locator('#odMute').click();
  await page.locator('#odStudy').click();
  await expect(page.locator('#oceanOverlay')).toHaveClass(/active/);
  await expect(page.locator('#timerText')).toContainText('50:');
  await expect(page.locator('#soundToggle')).toHaveAttribute('aria-checked', 'false');
});

test('regional travel draw prevents duplicate spaces and ticket loss', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/');
  await page.evaluate(() => {
    localStorage.setItem('od-mvp-local-rewards-v1', JSON.stringify({
      pieces: 0, tickets: 5, claims: [], owned: []
    }));
  });
  await page.reload();
  await page.locator('#odGalleryOpen').click();
  await page.locator('#odMapOpen').click();
  await expect(page.locator('#odMapTickets')).toContainText('5장');
  const bali = page.locator('#odRegions button').filter({ hasText: '발리' });
  await bali.click();
  await bali.click();
  await expect(bali).toBeDisabled(); // Bali café is already unlocked, so only two draws remain.
  await expect(page.locator('#odMapTickets')).toContainText('3장');
  const owned = await page.evaluate(() => JSON.parse(localStorage.getItem('od-mvp-local-rewards-v1')));
  expect(new Set(owned.owned).size).toBe(2);
  expect(owned.owned).toEqual(expect.arrayContaining(['bali-sunset','bali-forest']));
  await page.reload();
  await page.locator('#odGalleryOpen').click();
  await page.locator('#odMapOpen').click();
  await expect(page.locator('#odMapTickets')).toContainText('3장');
  await expect(page.locator('#odRegions button').filter({ hasText: '발리' })).toBeDisabled();
});

test('account module defaults to disabled and never imports demo rewards into server', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/');
  await page.locator('#odAccountButton').click();
  await expect(page.getByRole('dialog', { name: '내 계정과 서버 수집 기록' })).toBeVisible();
  await expect(page.locator('#odAccountStatus')).toContainText('계정 연동은 아직 비활성화');
  await expect(page.locator('#odLoginButton')).toBeDisabled();
  await expect(page.locator('#odGoogleLoginButton')).toBeDisabled();
  await expect(page.locator('#odServerSessions li')).toHaveCount(0);
  await expect(page.locator('#odRefreshButton')).toBeDisabled();
  await expect(page.locator('#odInitWalletButton')).toBeDisabled();
  await expect(page.locator('#odLogoutButton')).toBeDisabled();
  await expect(page.locator('#odServerBalance')).toContainText('로그인 후 조회');
  await expect(page.locator('#odServerScenes li')).toHaveCount(0);
  const raw = await page.evaluate(() => localStorage.getItem('od-mvp-local-rewards-v1'));
  expect(raw).toBeNull();
});

test('server focus sync stays disabled in default demo mode', async ({ page }) => {
  const calls=[];
  page.on('request',request=>{
    if(request.url().includes('/functions/v1/od-focus-session'))calls.push(request.url());
  });
  await page.goto('http://127.0.0.1:4173/');
  await page.locator('#odAccountButton').click();
  await expect(page.locator('#odServerFocusStatus')).toContainText('비활성화');
  await page.locator('#odAccountClose').click();
  await page.locator('#odGalleryOpen').click();
  await page.locator('#odStudy').click();
  await expect(page.locator('#oceanOverlay')).toHaveClass(/active/);
  await page.evaluate(() => {document.getElementById('timerStart').click(); document.getElementById('timerReset').click()});
  expect(calls).toHaveLength(0);
});

test('explicit server recovery event restores existing timer without awarding reward', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/');
  const before = await page.evaluate(() => {
    let result = null;
    window.addEventListener('od:restore-result', e => {result=e.detail.ok}, {once:true});
    window.dispatchEvent(new CustomEvent('od:restore-server-focus',{detail:{minutes:50,elapsed:123}}));
    return result;
  });
  expect(before).toBe(false);
  await page.locator('#odGalleryOpen').click();
  await page.locator('#odStudy').click();
  await expect(page.locator('#oceanOverlay')).toHaveClass(/active/);
  const accepted = await page.evaluate(() => {
    let result = null;
    window.addEventListener('od:restore-result',e=>{result=e.detail.ok},{once:true});
    window.dispatchEvent(new CustomEvent('od:restore-server-focus',{detail:{minutes:50,elapsed:123}}));
    return result;
  });
  expect(accepted).toBe(true);
  await expect(page.locator('#timerText')).toHaveText('47:57');
  await expect(page.locator('#timerStart')).toContainText('일시정지');
  await expect(page.locator('#odAccountButton')).toBeAttached();
});

test('server collection snapshot never merges or spends local demo progress', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/');
  await page.evaluate(()=>{
    localStorage.setItem('od-mvp-local-rewards-v1',JSON.stringify({pieces:6,tickets:5,owned:['jeju-forest'],claims:[]}));
    window.dispatchEvent(new CustomEvent('od:server-collection',{detail:{
      active:true,userId:'test-user',ready:true,pieces:3,tickets:2,owned:['bali-sunset']
    }}));
  });
  await page.locator('#odGalleryOpen').click();
  await expect(page.locator('#odServerCollectionMode')).toContainText('서버 컬렉션');
  await expect(page.locator('#odGalleryCount')).toContainText('서버 계정');
  await expect(page.locator('#odGalleryCount')).toContainText('3 / 9');
  await expect(page.locator('#odFrames button').filter({hasText:'발리 선셋룸'})).toBeEnabled();
  await expect(page.locator('#odFrames button').filter({hasText:'제주 숲속서재'})).toBeDisabled();
  await page.locator('#odMapOpen').click();
  await expect(page.locator('#odMapTickets')).toContainText('2장');
  await expect(page.locator('#odRegions button').filter({hasText:'발리'})).toBeDisabled();
  const untouched=await page.evaluate(()=>JSON.parse(localStorage.getItem('od-mvp-local-rewards-v1')));
  expect(untouched).toMatchObject({pieces:6,tickets:5,owned:['jeju-forest']});
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('od:server-collection',{detail:{active:false}})));
  await expect(page.locator('#odMapTickets')).toContainText('5장');
  await expect(page.locator('#odRegions button').filter({hasText:'발리'})).toBeEnabled();
  await expect(page.locator('#odGalleryCount')).toContainText('로컬 데모');
});


test('changing timer duration preserves partial local focus without granting a puzzle',async({page})=>{
  await page.goto('http://127.0.0.1:4173/');
  await page.locator('#odGalleryOpen').click();
  await page.locator('#odStudy').click();
  const result=await page.evaluate(()=>{
    state.timerStart=Date.now()-92*1000;
    timerRender();
    document.querySelector('[data-min="50"]').click();
    return {total:state.completedSeconds,accum:state.timerAccum,
      running:state.running,minutes:state.timerMin,
      current:document.getElementById('timerText').textContent};
  });
  expect(result.total).toBeGreaterThanOrEqual(91);
  expect(result.total).toBeLessThanOrEqual(95);
  expect(result).toMatchObject({accum:0,running:false,minutes:50,current:'50:00'});
  await expect(page.locator('#odReward')).not.toBeVisible();
  await expect(page.locator('#totalFocus')).toContainText('01분');
});

test('switching duration after pausing retains accumulated time exactly once',async({page})=>{
  await page.goto('http://127.0.0.1:4173/');
  await page.locator('#odGalleryOpen').click();
  await page.locator('#odStudy').click();
  const result=await page.evaluate(()=>{
    state.timerStart=Date.now()-63*1000;
    document.getElementById('timerStart').click(); // pause
    const before=state.completedSeconds;
    document.querySelector('[data-min="50"]').click();
    const once=state.completedSeconds;
    document.querySelector('[data-min="50"]').click();
    return {before,once,twice:state.completedSeconds,running:state.running};
  });
  expect(result.once-result.before).toBeGreaterThanOrEqual(62);
  expect(result.once-result.before).toBeLessThanOrEqual(65);
  expect(result.twice).toBe(result.once);
  expect(result.running).toBe(false);
  await expect(page.locator('#odReward')).not.toBeVisible();
});


test('newly unlocked map room opens directly in gallery and stale result clears on reopen', async ({page})=>{
  await page.goto('http://127.0.0.1:4173/');
  await page.evaluate(()=>localStorage.setItem('od-mvp-local-rewards-v1',JSON.stringify({
    pieces:0,tickets:1,claims:[],owned:[]
  })));
  await page.reload();
  await page.locator('#odGalleryOpen').click();
  await page.locator('#odMapOpen').click();
  await expect(page.locator('#odNewRoomOpen')).toBeHidden();
  await page.locator('#odRegions button').filter({hasText:'제주'}).click();
  const drawn=await page.evaluate(()=>JSON.parse(localStorage.getItem('od-mvp-local-rewards-v1')).owned[0]);
  await expect(page.locator('#odNewRoomOpen')).toBeVisible();
  await page.locator('#odNewRoomOpen').click();
  await expect(page.locator('#odGallery')).toBeVisible();
  const chosen=await page.evaluate(()=>document.querySelector('#odFrames .od-frame.selected .od-frame-text strong')?.textContent);
  expect(chosen).toBeTruthy();
  await expect(page.locator('#odMap')).not.toBeVisible();
  await page.locator('#odMapOpen').click();
  await expect(page.locator('#odNewRoomOpen')).toBeHidden();
  await expect(page.locator('#odTravelResult')).toHaveText('');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('od-mvp-local-rewards-v1')).owned[0]);
  expect(saved).toBe(drawn);
});

test('map direct-room action remains unavailable for signed-in server collection',async({page})=>{
  await page.goto('http://127.0.0.1:4173/');
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('od:server-collection',{detail:{
    active:true,userId:'test-account',pieces:0,tickets:3,owned:['jeju-forest']
  }})));
  await page.locator('#odGalleryOpen').click();
  await page.locator('#odMapOpen').click();
  await expect(page.locator('#odNewRoomOpen')).toBeHidden();
  await expect(page.locator('#odRegions button').filter({hasText:'제주'})).toBeDisabled();
});


test('gallery filters show owned and locked cards with accessible selection on mobile',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('http://127.0.0.1:4173/');
 await page.locator('#odGalleryOpen').click();
 await expect(page.locator('#odFrames button')).toHaveCount(9);
 await page.locator('[data-gallery-filter="owned"]').click();
 await expect(page.locator('#odFrames button')).toHaveCount(2);
 await expect(page.locator('#odGalleryFilterStatus')).toContainText('획득한 공간 2개');
 await expect(page.locator('[data-gallery-filter="owned"]')).toHaveAttribute('aria-pressed','true');
 await page.locator('[data-gallery-filter="locked"]').click();
 await expect(page.locator('#odFrames button')).toHaveCount(7);
 await expect(page.locator('#odGalleryFilterStatus')).toContainText('잠긴 공간 7개');
 await expect(page.locator('#odFrames button:enabled')).toHaveCount(0);
 await page.locator('[data-gallery-filter="all"]').click();
 await expect(page.locator('#odFrames button')).toHaveCount(9);
 await expect(page.locator('#odFrames button[aria-pressed="true"]')).toHaveCount(1);
});
test('world region progress is dynamic and shows count and visual progress',async({page})=>{
 await page.goto('http://127.0.0.1:4173/');
 await page.evaluate(()=>localStorage.setItem('od-mvp-local-rewards-v1',JSON.stringify({
  pieces:0,tickets:1,claims:[],owned:['jeju-forest']
 })));
 await page.reload();
 await page.locator('#odGalleryOpen').click();
 await page.locator('#odMapOpen').click();
 const jeju=page.locator('#odRegions button').filter({hasText:'제주'});
 await expect(jeju).toHaveAttribute('aria-label',/1개 \/ 3개 수집/);
 await expect(jeju.locator('.od-region-fill')).toHaveAttribute('style',/width: 33%/);
 await jeju.click();
 await expect(jeju).toHaveAttribute('aria-label',/2개 \/ 3개 수집/);
 await expect(page.locator('#odRegions .od-region-track')).toHaveCount(3);
});


test('selected unlocked scenery retains its description across view modes and preserves running focus',async({page})=>{
  await page.goto('http://127.0.0.1:4173/');
  await page.evaluate(()=>localStorage.setItem('od-mvp-local-rewards-v1',JSON.stringify({pieces:0,tickets:0,claims:[],owned:['jeju-forest']})));
  await page.reload();
  await page.locator('#odGalleryOpen').click();
  await page.locator('#odFrames button').filter({hasText:'제주 숲속서재'}).click();
  await page.locator('#odStudy').click();
  await expect(page.locator('#oceanOverlay')).toHaveClass(/active/);
  await expect(page.locator('#oceanSeatLabel')).toContainText('제주 숲속서재');
  const initial=await page.evaluate(()=>({running:state.running,audio:state.audioOn,minutes:state.timerMin}));
  expect(initial.running).toBe(true);
  await page.locator('#viewScene').click();
  await expect(page.locator('#viewModeHint')).toContainText('숲속의 책상');
  await page.locator('#viewRead').click();
  await expect(page.locator('#viewModeHint')).toContainText('숲속의 책상');
  await page.locator('#viewFocus').click();
  await expect(page.locator('#viewModeHint')).toContainText('숲속의 책상');
  await expect(page.locator('#photoView')).toHaveAttribute('aria-label',/제주 숲속서재/);
  const after=await page.evaluate(()=>({running:state.running,audio:state.audioOn,minutes:state.timerMin}));
  expect(after).toEqual(initial);
});

test('mobile focus controls and timer fit the narrow viewport',async({page})=>{
  await page.setViewportSize({width:360,height:740});
  await page.goto('http://127.0.0.1:4173/');
  await page.locator('#odGalleryOpen').click();
  await page.locator('#odStudy').click();
  const layout=await page.evaluate(()=>{
    const ids=['viewSide','oceanFocusHud','oceanFoot'];
    return {width:innerWidth,
      boxes:ids.map(id=>({id,left:document.getElementById(id).getBoundingClientRect().left,right:document.getElementById(id).getBoundingClientRect().right})),
      running:state.running};
  });
  expect(layout.running).toBe(true);
  for(const rect of layout.boxes){
    expect(rect.left).toBeGreaterThanOrEqual(-1);
    expect(rect.right).toBeLessThanOrEqual(layout.width+1);
  }
  await page.evaluate(()=>{state.timerStart=Date.now()-3000;timerRender()});
  await page.locator('#viewPause').click();
  await expect(page.locator('#timerStart')).toContainText('이어 집중하기');
  await page.locator('#viewWaves').click();
  await expect(page.locator('#viewWaves')).toHaveAttribute('aria-pressed','false');
});
