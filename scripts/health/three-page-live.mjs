// Read-only production checks. No account, listing, email, AI inference or database writes.
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const origin = 'https://www.rega24.com';
const out = 'three-page-live';
const routes = [['for-business', 'premium-business'], ['ai', 'premium-ai'], ['locations', 'premium-cities']];
const locales = ['ckb', 'kmr', 'de', 'en', 'ar', 'tr', 'fa'];
mkdirSync(out, {recursive:true});
const results = [];
const note = (ok, check, detail) => results.push({ok, check, ...(detail === undefined ? {} : {detail})});
const browser = await chromium.launch({headless:true});
const context = await browser.newContext({reducedMotion:'reduce'});
const page = await context.newPage();
try {
  const health = await context.request.get(`${origin}/api/v1/health`);
  const h = await health.json();
  note(health.status() === 200 && h.ok === true, 'production health', {status:health.status(), database:h.checks?.database, missingEnv:h.checks?.missingEnv});
  for (const locale of locales) for (const [route, marker] of routes) {
    const path = `/${locale}/${route}`;
    const response = await page.goto(`${origin}${path}`, {waitUntil:'networkidle'});
    note(response?.status() === 200, `${path} HTTPS response`);
    note(await page.getByTestId(marker).count() === 1, `${path} deployed migration marker`);
    note(await page.locator('h1').count() === 1, `${path} single h1`);
    note(await page.locator('html').getAttribute('dir') === (['ckb','ar','fa'].includes(locale) ? 'rtl' : 'ltr'), `${path} direction`);
    note(await page.locator('link[rel="canonical"]').getAttribute('href') === `${origin}${path}`, `${path} canonical`);
    note(await page.locator('link[rel="alternate"][hreflang]').count() === 8, `${path} language alternates`);
    note(Boolean(await page.locator('meta[name="description"]').getAttribute('content')), `${path} description`);
    for (const width of [320,375,768,1440]) {
      await page.setViewportSize({width,height:960});
      note(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth), `${path} overflow at ${width}`);
      note(await page.locator('header img[src="/brand/rega-mark-512.webp"]').first().isVisible(), `${path} original logo at ${width}`);
    }
    const axe = await new AxeBuilder({page}).include('main').analyze();
    note(axe.violations.length === 0, `${path} accessibility light`, axe.violations.map(v=>({id:v.id,impact:v.impact})));
    await page.evaluate(()=>{document.documentElement.dataset.theme='dark';});
    const dark = await new AxeBuilder({page}).include('main').analyze();
    note(dark.violations.length === 0, `${path} accessibility dark`, dark.violations.map(v=>({id:v.id,impact:v.impact})));
    await page.evaluate(()=>{document.documentElement.dataset.theme='light';});
    if (['en','ckb'].includes(locale)) {
      await page.screenshot({path:`${out}/${locale}-${route}-desktop.png`,fullPage:true});
      await page.setViewportSize({width:320,height:850});
      await page.screenshot({path:`${out}/${locale}-${route}-mobile.png`,fullPage:true});
    }
    note(await page.locator('main').getByText('Demo only', {exact:false}).count() === 0, `${path} demo submission removed`);
  }
  await page.goto(`${origin}/en/locations?city=`, {waitUntil:'networkidle'});
  const city = page.locator('#citylist a[href*="city="]').first();
  const href = await city.getAttribute('href');
  note(Boolean(href), 'real initial city links');
  if (href) {
    await city.click();
    await page.waitForLoadState('networkidle');
    const cityId = new URL(href,origin).searchParams.get('city');
    note(new URL(page.url()).searchParams.get('city') === cityId, 'city URL filter');
    const select = page.locator('select[name="category"]');
    const category = await select.locator('option').nth(1).getAttribute('value');
    if (category) {
      await select.selectOption(category);
      await page.locator('form[role="search"] button[type="submit"]').click();
      await page.waitForLoadState('networkidle');
      const q = new URL(page.url()).searchParams;
      note(q.get('category') === category && q.get('city') === cityId, 'combined real city/category filters');
    }
  }
  await page.goto(`${origin}/en/ai`, {waitUntil:'networkidle'});
  note(await page.locator('a[href="#assistant"]').count() > 0 && await page.locator('#assistant form').count() === 1, 'existing AI interface reachable without inference');
  await page.goto(`${origin}/en/for-business`, {waitUntil:'networkidle'});
  note(await page.locator('main a[href*="/register?next="]').count() > 0, 'registration uses existing authenticated workflow');
  const admin = await page.goto(`${origin}/dr`, {waitUntil:'networkidle'});
  note(admin?.status() === 200 && await page.locator('input[type="email"]').count() > 0, 'anonymous admin authentication gate');
} catch (error) {
  note(false, 'browser exception', error instanceof Error ? error.message.slice(0,200) : 'Unknown error');
} finally {
  await browser.close();
  const summary = {origin, measuredAt:new Date().toISOString(), checks:results.length, failures:results.filter(r=>!r.ok).length, results,
    limitations:['Read-only: authenticated registration/admin approval is covered in CI, not submitted on production.', 'AI navigation checked without paid inference.', 'Lighthouse measurements are separate JSON artifacts.']};
  writeFileSync(`${out}/report.json`, JSON.stringify(summary,null,2));
  console.log(JSON.stringify({checks:summary.checks,failures:summary.failures}));
  if (summary.failures) process.exitCode=1;
}
