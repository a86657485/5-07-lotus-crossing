'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/Users/jun/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output = __dirname;
const prior = JSON.parse(fs.readFileSync(path.join(output, 'final-lan-report.json')));
const base = process.env.BASE_URL || 'http://192.168.0.14:18997';
const report = { checkedDate: '2026-11-07', base, scope: 'Continuation after the prior 11 passing LAN checks; no repeated station journey', checks: [], pageErrors: [], figures: [] };
const write = () => fs.writeFileSync(path.join(output, 'assessment-finish-20261107.json'), JSON.stringify(report, null, 2));

(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', error => report.pageErrors.push(error.message));
  let token = '';
  const check = async (name, fn) => { await fn(); report.checks.push({ name, passed: true }); write(); console.log('PASS', name); };
  const shot = name => page.screenshot({ path: path.join(output, 'finish-' + name + '.png'), fullPage: true });
  const login = async url => {
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: '名单外手动输入', exact: true }).click();
    await page.getByPlaceholder('请输入姓名（如：张三）').fill(prior.fakeName);
    const [response] = await Promise.all([
      page.waitForResponse(r => r.url().endsWith('/api/login') && r.request().method() === 'POST'),
      page.getByRole('button', { name: '穿上小交警马甲，进入路口' }).click(),
    ]);
    const result = await response.json();
    assert.equal(result.student.studentId, prior.studentId);
    assert.equal(typeof result.sessionToken, 'string');
    token = result.sessionToken;
    return result;
  };
  const getState = async () => {
    const response = await page.request.get(`${base}/api/state?studentId=${encodeURIComponent(prior.studentId)}`, { headers: { Authorization: 'Bearer ' + token } });
    assert.equal(response.status(), 200);
    return (await response.json()).state;
  };
  const waitFigures = async id => {
    const figure = page.locator(`[data-question-figure="${id}"]`);
    await figure.waitFor();
    await page.waitForFunction(qid => {
      const root = document.querySelector(`[data-question-figure="${qid}"]`);
      if (!root || ![...root.querySelectorAll('.node-label')].every(label => label.getBoundingClientRect().height > 5)) return false;
      const geometry = [];
      let contained = true;
      for (const canvas of root.querySelectorAll('[data-readonly-diagram]')) {
        const r = canvas.getBoundingClientRect();
        geometry.push(r.x, r.y, r.width, r.height);
        for (const node of canvas.querySelectorAll('.react-flow__node')) {
          const n = node.getBoundingClientRect();
          geometry.push(n.x, n.y, n.width, n.height);
          if (n.left < r.left - 2 || n.right > r.right + 2 || n.top < r.top - 2 || n.bottom > r.bottom + 2) contained = false;
        }
      }
      const signature = geometry.map(value => value.toFixed(1)).join(',');
      const cache = window.__qaFigureGeometry || (window.__qaFigureGeometry = {});
      const previous = cache[qid];
      cache[qid] = { signature, stable: previous?.signature === signature ? previous.stable + 1 : 0 };
      return contained && cache[qid].stable >= 3;
    }, id, { polling: 'raf', timeout: 10000 });
    return figure;
  };
  const measureFigures = async id => {
    await waitFigures(id);
    const metrics = await page.locator(`[data-question-figure="${id}"]`).evaluate(root => ({
      id: root.dataset.questionFigure,
      count: root.querySelectorAll('[data-readonly-diagram]').length,
      labels: [...root.querySelectorAll('.node-label')].map(label => ({ text: label.textContent, width: +label.getBoundingClientRect().width.toFixed(1), height: +label.getBoundingClientRect().height.toFixed(1) })),
      clipped: [...root.querySelectorAll('[data-readonly-diagram]')].flatMap(canvas => {
        const r = canvas.getBoundingClientRect();
        return [...canvas.querySelectorAll('.react-flow__node')].filter(node => {
          const n = node.getBoundingClientRect();
          return n.left < r.left - 2 || n.right > r.right + 2 || n.top < r.top - 2 || n.bottom > r.bottom + 2;
        }).map(node => node.textContent);
      }),
    }));
    report.figures.push({ viewport: page.viewportSize(), ...metrics });
    write();
    return metrics;
  };

  try {
    const logged = await login(base);
    await page.getByRole('button', { name: '再次检测', exact: true }).waitFor();
    report.environment = await page.evaluate(() => ({ secure: isSecureContext, randomUUID: typeof crypto.randomUUID }));
    await check('LAN identity restores the already submitted first and latest base result', async () => {
      assert.equal(report.environment.secure, false);
      assert.equal(report.environment.randomUUID, 'undefined');
      assert.equal(logged.state.stations.exam, true);
      assert.ok(logged.state.examFirstResult && logged.state.examLatestResult);
      report.baseResult = { first: logged.state.examFirstResult.baseScore, latest: logged.state.examLatestResult.baseScore, total: logged.state.examFirstResult.baseTotal };
      await shot('map-restored');
    });
    await page.getByRole('button', { name: '再次检测', exact: true }).click();
    await page.getByText(/基础层首次得分：/).waitFor();
    await check('Saved assessment result is visible with the new first-score label', () => shot('base-restored'));
    await page.getByRole('button', { name: '8', exact: true }).click();
    await check('B08 has two actual read-only diagrams at desktop width', async () => {
      const metric = await measureFigures('B08');
      assert.equal(metric.count, 2);
      assert.deepEqual(metric.clipped, []);
      await shot('B08-desktop');
    });
    await page.setViewportSize({ width: 768, height: 1024 });
    await measureFigures('B08');
    await shot('B08-768');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole('button', { name: '进入挑战关 →', exact: true }).click();
    for (let i = 0; i < 6; i++) {
      const id = `C0${i + 1}`;
      await page.getByText(`题号：${id}`, { exact: true }).waitFor();
      const expected = ['C01', 'C02', 'C04', 'C06'].includes(id);
      if (expected) {
        const metric = await measureFigures(id);
        assert.equal(metric.count, id === 'C02' ? 2 : 1);
        assert.deepEqual(metric.clipped, []);
      }
      await shot(id + '-desktop');
      if (id === 'C02') {
        await page.setViewportSize({ width: 768, height: 1024 });
        await measureFigures(id);
        await shot('C02-768');
        await page.setViewportSize({ width: 1440, height: 900 });
      }
      await page.locator('button[class*="p-3.5"]').first().click();
      if (i < 5) await page.getByRole('button', { name: '下一题 →', exact: true }).click();
    }
    await check('All six challenge questions are reachable and the required figures render', async () => assert.equal(report.pageErrors.length, 0));
    const submission = page.waitForResponse(r => r.url().endsWith('/api/exam/submit') && r.request().method() === 'POST');
    await page.getByRole('button', { name: '提交挑战加分答卷 →', exact: true }).click();
    assert.equal((await submission).status(), 200);
    await page.getByText(/挑战首答：/).waitFor();
    await check('Challenge submission persists separately without changing first base marks', async () => {
      const state = await getState();
      assert.ok(state.challengeFirstResult);
      assert.equal(state.examFirstResult.baseScore, report.baseResult.first);
      await shot('challenge-submitted');
    });
    await page.getByRole('button', { name: '← 返回路口', exact: true }).click();
    await page.getByRole('button', { name: '剧情回放', exact: true }).click();
    await page.getByRole('button', { name: '关闭剧情', exact: true }).waitFor();
    await shot('replay-first-frame');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '关闭剧情', exact: true }).waitFor({ state: 'detached' });
    await page.getByRole('button', { name: '再次检测', exact: true }).click();
    await check('Replay closes from its first frame with Esc and assessment can be reopened', async () => {
      await page.getByRole('heading', { name: '临时小交警 · 课堂综合检测', exact: true }).waitFor();
      assert.equal(report.pageErrors.length, 0);
    });

    await context.close();
    report.status = 'passed';
    report.completedAt = new Date().toISOString();
    report.notes = ['Only the previously created virtual identity and isolated 18997 database were used.', 'LAN source used a real local IP on this same computer; no second physical student device was tested.', 'The separate finish-localhost-20261107.cjs performs the optional secure-context bridge continuation.'];
    write();
  } catch (error) {
    report.status = 'failed';
    report.failure = String(error.stack || error);
    write();
    if (!page.isClosed()) await shot('failure');
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
