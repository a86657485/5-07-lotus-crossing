'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');

const BASE = process.env.TEST_BASE_URL || 'http://192.168.0.14:8797';
const OUT = path.join(__dirname, 'retest-intro-no-skip-report.json');
const report = { base: BASE, startedAt: new Date().toISOString(), checks: [], failures: [] };

function record(name, passed, detail) {
  report.checks.push({ name, passed, detail: detail || '' });
  if (!passed) report.failures.push({ name, detail });
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
}

async function main() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage();
  const name = 'IntroNoSkip_' + Date.now();
  try {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: '名单外手动输入' }).click();
    await page.getByPlaceholder('请输入姓名（如：张三）').fill(name);
    await page.getByRole('button', { name: '穿上小交警马甲，进入路口' }).click();
    await page.locator('.web-lesson-host').waitFor({ timeout: 12000 });
    await page.locator('.web-story').waitFor({ timeout: 12000 });

    const closeCount = await page.getByRole('button', { name: '关闭剧情', exact: true }).count();
    record('first-view-close-hidden', closeCount === 0, `closeCount=${closeCount}`);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(450);
    record('first-view-esc-noop', (await page.locator('.web-story').count()) === 1);

    for (let i = 0; i < 12; i++) {
      if (!(await page.locator('.web-story').count())) break;
      const btn = page.getByRole('button', { name: /^(下句|好的)$/ }).first();
      await btn.click();
      await page.waitForTimeout(160);
    }
    await page.waitForTimeout(400);
    const storyGone = (await page.locator('.web-story').count()) === 0;
    const mapOk = (await page.locator('.story-map-main').count()) > 0;
    record('first-view-complete-enters-map', storyGone && mapOk, `storyGone=${storyGone} map=${mapOk}`);

    await page.getByRole('button', { name: '剧情回放', exact: true }).click();
    await page.locator('.web-story').waitFor({ timeout: 8000 });
    await page.getByRole('button', { name: '关闭剧情', exact: true }).click();
    await page.waitForTimeout(400);
    record('replay-close-works', (await page.locator('.web-story').count()) === 0);

    await page.getByRole('button', { name: '剧情回放', exact: true }).click();
    await page.locator('.web-story').waitFor({ timeout: 8000 });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    record('replay-esc-works', (await page.locator('.web-story').count()) === 0);
  } catch (err) {
    record('retest-crashed', false, String(err && err.stack || err));
  } finally {
    report.finishedAt = new Date().toISOString();
    report.pass = report.failures.length === 0;
    fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
    await browser.close();
    console.log(JSON.stringify({ pass: report.pass, checks: report.checks.length, failures: report.failures.length }, null, 2));
    process.exit(report.pass ? 0 : 1);
  }
}

main();
