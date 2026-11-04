import { test, expect } from '@playwright/test';

test('Bali gallery enters original 25-minute timer with waves and awards one test puzzle', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/');
  await page.getByRole('button', { name: '갤러리', exact: true }).click();
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
  await page.getByRole('button', { name: '갤러리', exact: true }).click();
  await page.getByRole('button', { name: /세계지도/ }).click();
  await expect(page.locator('#odMapTickets')).toContainText('1장');
  await page.locator('#odRegions button').filter({ hasText: '제주' }).click();
  await expect(page.locator('#odTravelResult')).toContainText('새로운 공간 획득');
  await expect(page.locator('#odMapTickets')).toContainText('0장');
  const initial = await page.evaluate(() => JSON.parse(localStorage.getItem('od-mvp-local-rewards-v1')));
  expect(initial.owned).toHaveLength(1);
  expect(initial.owned[0]).toMatch(/^jeju-/);
  await page.reload();
  await page.getByRole('button', { name: '갤러리', exact: true }).click();
  await expect(page.locator('#odGalleryCount')).toContainText('3 / 9');
  await page.getByRole('button', { name: /세계지도/ }).click();
  await expect(page.locator('#odMapTickets')).toContainText('0장');
});
