'use strict';
/**
 * S1 五条件引导 + 各站画面/角色/天桥正路径（隔离端口 19011）。
 * 勿碰课堂 8797 / 8766。
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core');

const output = __dirname;
const base = process.env.TEST_BASE_URL || 'http://172.30.0.2:19011';
const chrome = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const report = {
  startedAtShanghai: new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }).replace(' ', 'T') + '+08:00 Asia/Shanghai',
  base,
  dataDir: process.env.DATA_DIR || '/tmp/g5l7-five-19011',
  checks: [],
  failures: [],
  pageErrors: [],
  shots: [],
  studentId: '',
  notes: [],
};
const write = () => fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
write();

(async () => {
  const browser = await chromium.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();
  let token = '';
  let studentId = '';
  const fakeName = '五条件验证_' + Date.now();

  page.on('pageerror', (e) => { report.pageErrors.push(e.message); write(); });

  const record = (name, passed, detail = '') => {
    report.checks.push({ name, passed, detail });
    if (!passed) report.failures.push({ name, detail });
    write();
    console.log(passed ? 'PASS' : 'FAIL', name, detail || '');
  };
  const check = async (name, fn) => {
    try { await fn(); record(name, true); }
    catch (e) { record(name, false, String(e && e.message || e)); throw e; }
  };
  const until = async (fn, t = 16000) => {
    const start = Date.now();
    while (Date.now() - start < t) { if (await fn()) return; await page.waitForTimeout(120); }
    throw new Error('timed out waiting');
  };
  const shot = async (name) => {
    const file = `${name}.png`;
    const dest = path.join(output, file);
    await page.screenshot({ path: dest, fullPage: false });
    report.shots.push(file);
    write();
    return dest;
  };
  const headers = () => (token ? { Authorization: 'Bearer ' + token } : {});
  const state = async () => {
    const r = await page.request.get(base + '/api/state?studentId=' + encodeURIComponent(studentId), { headers: headers() });
    assert.equal(r.status(), 200);
    return (await r.json()).state;
  };
  const closeLearn = async () => {
    const button = page.getByRole('button', { name: '关闭先学卡', exact: true });
    if (await button.count()) await button.click();
    await page.waitForTimeout(200);
  };
  const closeStories = async () => {
    for (let i = 0; i < 16; i++) {
      const next = page.locator('.web-story-controls button');
      if (!(await next.count())) break;
      await next.click();
      await page.waitForTimeout(80);
    }
  };
  const finishRun = async (text, timeout = 25000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await page.getByText(text).count()) return;
      const stepBtn = page.getByRole('button', { name: '单步', exact: true });
      if (await stepBtn.isEnabled()) await stepBtn.click();
      else await page.waitForTimeout(120);
    }
    throw new Error('playback did not reach: ' + text);
  };
  const edgeClick = async (id) => {
    const edge = page.locator(`.comparison-card.is-selected .react-flow__edge[data-id="${id}"] .react-flow__edge-interaction, .react-flow__edge[data-id="${id}"] .react-flow__edge-interaction`).first();
    await edge.waitFor({ timeout: 10000 });
    for (let attempt = 0; attempt < 4; attempt++) {
      await page.waitForTimeout(200);
      const along = 0.35 + attempt * 0.15;
      const p = await edge.evaluate((el, t) => {
        const len = el.getTotalLength();
        const a = el.getPointAtLength(len * t);
        const m = el.getScreenCTM();
        return { x: m.a * a.x + m.c * a.y + m.e, y: m.b * a.x + m.d * a.y + m.f };
      }, along);
      await page.mouse.click(p.x, p.y);
      await page.waitForTimeout(200);
      if (!(await page.getByRole('button', { name: '检查我的判断' }).isDisabled())) return;
    }
  };

  try {
    await check('login-and-intro', async () => {
      await page.goto(base, { waitUntil: 'networkidle' });
      assert.equal(page.url().startsWith('http://'), true, 'must use non-secure context for Web path');
      await page.getByRole('button', { name: '名单外手动输入' }).click();
      await page.getByPlaceholder('请输入姓名（如：张三）').fill(fakeName);
      const pending = page.waitForResponse((r) => r.url().endsWith('/api/login') && r.request().method() === 'POST');
      await page.getByRole('button', { name: '穿上小交警马甲，进入路口' }).click();
      const r = await pending;
      assert.equal(r.status(), 200);
      const data = await r.json();
      token = data.sessionToken;
      studentId = data.student.studentId;
      report.studentId = studentId;
      await page.locator('.web-story').waitFor({ timeout: 8000 });
      const closeBtn = page.getByRole('button', { name: '关闭剧情', exact: true });
      if (await closeBtn.count()) {
        await closeBtn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(300);
        assert.ok(await page.locator('.web-story').count(), 'first-view intro must not close');
      }
      await closeStories();
      await page.getByRole('button', { name: '前往行人引导台', exact: true }).waitFor({ timeout: 8000 });
    });

    await check('s1-five-condition-trials-and-bridge-walk', async () => {
      await page.getByRole('button', { name: '前往行人引导台', exact: true }).click();
      await closeStories();
      await closeLearn();
      await page.locator('.crossing-scene .scene-backdrop').waitFor({ timeout: 8000 });
      assert.ok((await page.locator('.crossing-scene .scene-backdrop').getAttribute('src') || '').includes('scene_s1_crossing_bridge'));
      assert.equal(await page.locator('.crossing-alian img').count(), 1);
      assert.equal(await page.locator('.crossing-player img').count(), 1);
      assert.equal(await page.getByRole('button', { name: '完成引导台', exact: true }).count(), 0);
      await shot('01-s1-opening-bridge-and-cast');

      const trials = [
        ['有可用天桥？', '走了天桥，这是选路，不是再等一次。', '02-s1-bridge-walk'],
        ['已经等了三次？', '数满三次就停了，没问灯还红不红。', '03-s1-count'],
        ['原地观察红绿灯', '这是动作，不能回答“是”或“否”。', '04-s1-action'],
        ['到达对面了吗？', '人还在路沿，这个问题问早了。', '05-s1-arrive'],
        ['绿灯未亮起？', '五种走法都看过了，选出能说明「还要再等」的条件，自己连好「是／否」。', '06-s1-phase-b'],
      ];
      for (const [card, feedback, shotName] of trials) {
        const nextGuide = await page.locator('.station-panel').getAttribute('data-guide-target');
        if (card !== '有可用天桥？') assert.ok(['nextCondition', 'run', 'playback'].includes(nextGuide || ''), 'guide ' + nextGuide);
        await page.getByRole('button', { name: card }).click();
        if (card === '有可用天桥？') {
          await until(async () => page.locator('.crossing-scene.bridge-lit').count());
        }
        await until(async () => (await page.locator('.station-panel').getAttribute('data-guide-target')) === 'run' || (await page.getByRole('button', { name: '运行', exact: true }).isEnabled()));
        await page.getByRole('button', { name: '运行', exact: true }).click();
        if (card === '有可用天桥？') {
          await until(async () => page.locator('.crossing-player.is-on-bridge').count(), 12000);
          await until(async () => page.locator('.crossing-player.is-on-bridge.stage-2, .crossing-player.is-on-bridge.stage-3').count(), 8000);
          await shot(shotName);
        }
        await finishRun(feedback);
        if (card !== '有可用天桥？') await shot(shotName);
        assert.equal(await page.getByRole('button', { name: '完成引导台', exact: true }).count(), 0);
      }
      assert.equal(await page.locator('.condition-choices .is-tested').count(), 5);
    });

    await check('s1-formalize-and-verify-both-lights', async () => {
      // Condition may already be 绿灯未亮起； arrows were cleared.
      if (!(await page.locator('.condition-choices .lesson-choice.selected').innerText()).includes('绿灯未亮起')) {
        await page.getByRole('button', { name: '绿灯未亮起？' }).click();
      }
      await page.getByRole('button', { name: '连接是的箭头' }).click();
      await page.locator('[data-node-id="observe"]').click();
      await page.getByRole('button', { name: '连接否的箭头' }).click();
      await page.locator('[data-node-id="cross"]').click();
      // Ensure we run a first light, then the other.
      const greenBtn = page.getByRole('button', { name: /到达时已是绿灯/ });
      const redBtn = page.getByRole('button', { name: /先红灯，后来变绿/ });
      if (!(await greenBtn.getAttribute('class') || '').includes('selected')) await greenBtn.click();
      await page.getByRole('button', { name: '运行', exact: true }).click();
      await finishRun('这个情形已运行。换另一种灯色情形试试。');
      await redBtn.click();
      await page.getByRole('button', { name: '运行', exact: true }).click();
      await page.getByRole('button', { name: '完成引导台', exact: true }).waitFor({ timeout: 25000 });
      await shot('07-s1-both-lights-complete');
      await page.getByRole('button', { name: '完成引导台', exact: true }).click();
      await until(async () => (await state()).stations.s2_rewrite === true, 20000);
      const ev = (await state()).evidenceHistory.filter((e) => e.taskId === 's2_rewrite' && e.eventType === 'evidence_lock');
      assert.ok(ev.length, 'S1 evidence_lock missing');
      const tested = ev.at(-1).payload && ev.at(-1).payload.testedConditions;
      assert.ok(Array.isArray(tested) && tested.length === 5, 'testedConditions should be stored, got ' + JSON.stringify(tested));
    });

    await check('s1-refresh-keeps-server-completion', async () => {
      const before = await state();
      assert.equal(before.stations.s2_rewrite, true);
      await page.reload({ waitUntil: 'networkidle' });
      if (await page.getByRole('button', { name: '名单外手动输入' }).count()) {
        await page.getByRole('button', { name: '名单外手动输入' }).click();
        await page.getByPlaceholder('请输入姓名（如：张三）').fill(fakeName);
        const pending = page.waitForResponse((r) => r.url().endsWith('/api/login') && r.request().method() === 'POST');
        await page.getByRole('button', { name: '穿上小交警马甲，进入路口' }).click();
        const r = await pending;
        assert.equal(r.status(), 200);
        const data = await r.json();
        token = data.sessionToken;
        assert.equal(data.student.studentId, studentId);
      }
      await closeStories();
      await page.getByRole('button', { name: '前往信号拆解台', exact: true }).waitFor({ timeout: 10000 });
      const st = await state();
      assert.equal(st.stations.s2_rewrite, true);
      assert.ok(st.evidenceHistory.some((e) => e.taskId === 's2_rewrite' && e.eventType === 'evidence_lock'));
      const lock = st.evidenceHistory.filter((e) => e.taskId === 's2_rewrite' && e.eventType === 'evidence_lock').at(-1);
      assert.ok(Array.isArray(lock.payload.testedConditions) && lock.payload.testedConditions.length === 5);
      await shot('08-map-after-refresh');
    });

    await check('s2b-both-diagrams-and-cast', async () => {
      await page.getByRole('button', { name: '前往信号拆解台', exact: true }).click();
      await closeStories();
      await closeLearn();
      assert.equal(await page.locator('.comparison-cast img').count(), 2);
      assert.equal(await page.locator('.skybridge-thumb').count(), 1);
      assert.ok((await page.locator('.skybridge-thumb').getAttribute('src') || '').includes('icon_skybridge'));
      await page.getByRole('button', { name: '方案甲', exact: true }).click();
      await finishRun('再运行另一张图，比较循环和天桥分支。');
      await shot('09-s2b-loop-and-cast');
      assert.equal(await page.getByRole('button', { name: '检查我的判断' }).isDisabled(), true, 'check must stay disabled until both diagrams are run');
      await page.getByRole('button', { name: '方案乙', exact: true }).click();
      await finishRun('两张图都运行过了。可以标出依据，再检查判断。');
      await shot('10-s2b-branch-skybridge');
      await page.getByRole('button', { name: '方案甲', exact: true }).click();
      await until(async () => page.getByRole('button', { name: '单步', exact: true }).isEnabled(), 8000);
      await until(async () => !(await page.getByRole('button', { name: '单步', exact: true }).isEnabled()), 20000);
      await edgeClick('back');
      await until(async () => !(await page.getByRole('button', { name: '检查我的判断' }).isDisabled()), 16000);
      await page.getByRole('button', { name: '检查我的判断' }).click();
      await page.getByRole('button', { name: '继续看热水壶' }).waitFor({ timeout: 8000 });
      await page.getByRole('button', { name: '继续看热水壶' }).click();
    });

    await check('s2c-two-temps-and-characters', async () => {
      await closeLearn();
      await page.locator('.kettle-scene .scene-backdrop').waitFor({ timeout: 8000 });
      assert.ok((await page.locator('.kettle-scene .scene-backdrop').getAttribute('src') || '').includes('scene_s2_kettle'));
      assert.equal(await page.locator('.kettle-alian img').count(), 1);
      assert.equal(await page.locator('.kettle-player img').count(), 1);
      const readout = await page.locator('.temperature-cover .temperature-readout').innerText();
      assert.ok(readout.includes('80') && !readout.includes('85'), readout);
      await page.getByRole('button', { name: '运行 80℃', exact: true }).click();
      await finishRun('水温不足时才加热，然后再次读取判断。');
      await shot('11-s2c-80-cast');
      await page.getByRole('button', { name: '开始时 100℃' }).click();
      const readout100 = await page.locator('.temperature-cover .temperature-readout').innerText();
      assert.ok(readout100.includes('100') && !readout100.includes('85'), readout100);
      await page.getByRole('button', { name: '运行 100℃', exact: true }).click();
      await finishRun('已经100℃时，先读取判断，没有加热。');
      await shot('12-s2c-100-cast');
      await page.getByRole('button', { name: '读取水温', exact: true }).click();
      await page.getByRole('button', { name: '下一项', exact: true }).click();
      await page.getByRole('button', { name: '达到100℃时', exact: true }).click();
      await page.getByRole('button', { name: '下一项', exact: true }).click();
      await page.getByRole('button', { name: '比较：先检查，还是先擦一下？', exact: true }).click();
      await page.getByRole('button', { name: '我预测：甲可能不擦', exact: true }).click();
      await page.getByRole('button', { name: '运行对比', exact: true }).click();
      await page.getByRole('button', { name: '回到热水壶', exact: true }).waitFor({ timeout: 20000 });
      await page.getByRole('button', { name: '回到热水壶', exact: true }).click();
      await page.getByRole('button', { name: '检查我的选择', exact: true }).click();
      await page.getByRole('button', { name: '完成拆解台', exact: true }).click();
    });

    await check('s3-baseline-then-duration-and-cast', async () => {
      await closeStories();
      await closeLearn();
      if (!(await page.locator('.traffic-scene').count())) {
        await page.getByRole('button', { name: '前往路口调度台', exact: true }).click();
        await closeStories();
        await closeLearn();
      }
      await page.locator('.traffic-scene .scene-backdrop').waitFor({ timeout: 8000 });
      assert.ok((await page.locator('.traffic-scene .scene-backdrop').getAttribute('src') || '').includes('scene_s3_booth'));
      assert.equal(await page.locator('.traffic-alian img').count(), 1);
      assert.equal(await page.locator('.traffic-player img').count(), 1);
      assert.equal(await page.locator('.traffic-leader img').count(), 1);
      await shot('13-s3-opening-cast-bridge');
      await page.getByRole('button', { name: '运行原方案', exact: true }).click();
      await finishRun('原方案还等9辆。现在选时长和理由，再比较。');
      await shot('14-s3-baseline');
      await page.getByRole('button', { name: '绿灯 6 格', exact: true }).click();
      await page.getByRole('button', { name: '让等待较多的这一侧多通行一些', exact: true }).click();
      await page.getByRole('button', { name: '运行', exact: true }).click();
      await page.getByRole('button', { name: '完成调度台', exact: true }).waitFor({ timeout: 20000 });
      await shot('15-s3-adjusted');
      await page.getByRole('button', { name: '完成调度台', exact: true }).click();
      await until(async () => (await state()).stations.s3_timing === true, 20000);
    });

    record('page-errors', report.pageErrors.length === 0, report.pageErrors.join(' | '));
  } catch (e) {
    report.fatal = String(e && e.stack || e);
    try { await shot('fatal'); } catch {}
    write();
    console.error(e);
  } finally {
    report.finishedAtShanghai = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }).replace(' ', 'T') + '+08:00 Asia/Shanghai';
    write();
    await browser.close();
    const failed = report.failures.length;
    console.log(JSON.stringify({ passed: report.checks.filter((c) => c.passed).length, failed, shots: report.shots }, null, 2));
    process.exit(failed || report.fatal ? 1 : 0);
  }
})();
