'use strict';
/**
 * 五年级第7课《重复操作用循环》全流程交互／控件／引导／焦点／剧情检测
 * 隔离服：PORT=18997 + 临时 DATA_DIR；勿碰课堂 8797。
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');

const output = __dirname;
const base = process.env.TEST_BASE_URL || 'http://192.168.0.14:18997'; // 须非 secure context，否则走 Godot iframe
const chrome = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const startedAt = new Date().toISOString();
const shanghaiLabel = () => {
  const s = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' });
  return s.replace(' ', 'T') + '+08:00 Asia/Shanghai';
};

const report = {
  startedAt,
  startedAtShanghai: shanghaiLabel(),
  base,
  commit: process.env.APP_COMMIT || '6a45b2fb2e31',
  dataDir: process.env.DATA_DIR || '',
  checks: [],
  failures: [],
  pageErrors: [],
  notes: [],
  storyImages: [],
  guideSequence: [],
  introFirstViewSkippable: null,
  teacher: {},
  examScore: null,
  studentId: '',
  fakeName: '',
};

const write = () => fs.writeFileSync(path.join(output, 'fullflow-report.json'), JSON.stringify(report, null, 2));
write();

(async () => {
  const browser = await chromium.launch({
    executablePath: chrome,
    headless: true,
    args: ['--no-sandbox'],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  let token = '';
  let studentId = '';
  const fakeName = '全流程QA_' + Date.now();
  report.fakeName = fakeName;

  page.on('pageerror', (e) => {
    report.pageErrors.push(e.message);
    write();
  });

  const shot = async (n) => {
    const file = `shot-${n}.png`;
    await page.screenshot({ path: path.join(output, file), fullPage: true });
    return file;
  };

  const recordCheck = (name, passed, detail = '') => {
    const item = { name, passed, detail };
    report.checks.push(item);
    if (!passed) report.failures.push({ name, detail });
    write();
    console.log(passed ? 'PASS' : 'FAIL', name, detail || '');
  };

  const check = async (name, fn) => {
    try {
      await fn();
      recordCheck(name, true);
    } catch (e) {
      recordCheck(name, false, String(e.message || e));
      throw e;
    }
  };

  const softCheck = async (name, fn) => {
    try {
      await fn();
      recordCheck(name, true);
      return true;
    } catch (e) {
      recordCheck(name, false, String(e.message || e));
      try { await shot(`fail-${name.replace(/[^\w\u4e00-\u9fff-]+/g, '_').slice(0, 40)}`); } catch {}
      return false;
    }
  };

  const until = async (fn, t = 16000) => {
    const start = Date.now();
    while (Date.now() - start < t) {
      if (await fn()) return;
      await page.waitForTimeout(150);
    }
    throw new Error('timed out waiting for result');
  };

  const headers = () => (token ? { Authorization: 'Bearer ' + token } : {});
  const state = async () => {
    const r = await page.request.get(base + '/api/state?studentId=' + encodeURIComponent(studentId), { headers: headers() });
    assert.equal(r.status(), 200);
    return (await r.json()).state;
  };

  const loginAs = async (name) => {
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: '名单外手动输入' }).click();
    await page.getByPlaceholder('请输入姓名（如：张三）').fill(name);
    const pending = page.waitForResponse((r) => r.url().endsWith('/api/login') && r.request().method() === 'POST');
    await page.getByRole('button', { name: '穿上小交警马甲，进入路口' }).click();
    const r = await pending;
    assert.equal(r.status(), 200);
    const data = await r.json();
    token = data.sessionToken;
    studentId = data.student.studentId;
    assert.ok(typeof token === 'string' && token.length === 64);
    report.studentId = studentId;
    await page.locator('.web-lesson-host').waitFor({ timeout: 10000 });
  };

  const storyImage = async () => {
    if (await page.locator('.web-story-picture img').count()) {
      const src = await page.locator('.web-story-picture img').getAttribute('src');
      if (src && !report.storyImages.includes(src)) report.storyImages.push(src);
      await until(() => page.locator('.web-story-picture img').evaluate((e) => e.complete && e.naturalWidth > 0), 8000);
      assert.equal(await page.locator('.web-story-picture img').evaluate((e) => e.complete && e.naturalWidth > 0), true);
      return src;
    }
    return null;
  };

  const closeStories = async () => {
    for (let i = 0; i < 6; i++) {
      const button = page.getByRole('button', { name: '关闭剧情', exact: true });
      if (!(await button.count())) break;
      await storyImage();
      await button.click();
      await page.waitForTimeout(180);
    }
  };

  const closeLearn = async () => {
    const button = page.getByRole('button', { name: '关闭先学卡', exact: true });
    if (await button.count()) {
      await until(() => page.locator('.lesson-learn img').evaluate((e) => e.complete && e.naturalWidth > 0), 8000).catch(() => {});
      await button.click();
      await page.waitForTimeout(120);
    }
  };

  const dismissOverlays = async () => {
    for (let i = 0; i < 4; i++) {
      const help = page.getByRole('button', { name: '关闭帮助', exact: true });
      if (await help.count()) { await help.click(); await page.waitForTimeout(120); continue; }
      const tryBtn = page.getByRole('button', { name: '我来试试', exact: true });
      if (await tryBtn.count()) { await tryBtn.click(); await page.waitForTimeout(120); continue; }
      const learn = page.getByRole('button', { name: '关闭先学卡', exact: true });
      if (await learn.count()) { await learn.click(); await page.waitForTimeout(120); continue; }
      const story = page.getByRole('button', { name: '关闭剧情', exact: true });
      if (await story.count()) { await story.click(); await page.waitForTimeout(120); continue; }
      break;
    }
  };

  const readGuide = async () => {
    const panel = page.locator('.station-panel');
    if (!(await panel.count())) return null;
    const target = await panel.getAttribute('data-guide-target');
    const cls = (await panel.getAttribute('class')) || '';
    const guideClasses = cls.split(/\s+/).filter((c) => c.startsWith('guide-'));
    const info = {
      at: shanghaiLabel(),
      target,
      guideClasses,
      hasGuide: cls.includes('has-guide'),
      unique: guideClasses.length <= 1,
    };
    report.guideSequence.push(info);
    write();
    return info;
  };

  const assertUniqueGuide = async (expectTarget) => {
    const g = await readGuide();
    assert.ok(g, 'station-panel missing');
    assert.equal(g.hasGuide, true, 'missing has-guide');
    assert.ok(g.target, 'missing data-guide-target');
    assert.equal(g.unique, true, 'multiple guide-* classes: ' + g.guideClasses.join(','));
    assert.ok(clsIncludesGuide(g, g.target), 'class guide-' + g.target + ' missing');
    if (expectTarget) assert.equal(g.target, expectTarget, `expected guide ${expectTarget}, got ${g.target}`);
    return g;
  };

  const clsIncludesGuide = (g, target) => g.guideClasses.includes('guide-' + target);

  const edgeClick = async (id) => {
    const edge = page.locator(`.react-flow__edge[data-id="${id}"] .react-flow__edge-interaction`).first();
    await edge.waitFor({ timeout: 10000 });
    await page.waitForTimeout(200);
    const p = await edge.evaluate((el) => {
      const a = el.getPointAtLength(el.getTotalLength() * 0.5);
      const m = el.getScreenCTM();
      return { x: m.a * a.x + m.c * a.y + m.e, y: m.b * a.x + m.d * a.y + m.f };
    });
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(150);
  };

  const advanceIntroByNext = async () => {
    for (let i = 0; i < 12; i++) {
      const next = page.locator('.web-story-controls button');
      if (!(await next.count())) break;
      await storyImage();
      await next.click();
      await page.waitForTimeout(120);
    }
    await until(async () => (await state()).evidenceHistory.some((e) => e.taskId === 'intro'));
  };

  try {
    // ---------- A0: probe intro first-view skippability with a throwaway student ----------
    await softCheck('A0-intro-first-view-skippable-probe', async () => {
      await loginAs('首刷跳过探针_' + Date.now());
      await page.locator('.web-story').waitFor({ timeout: 8000 });
      await storyImage();
      await shot('01-intro-first-frame');
      const closeBtn = page.getByRole('button', { name: '关闭剧情', exact: true });
      // 规范：首次完整看过前不可关。首刷可隐藏关闭钮；若仍显示则点击/Esc 都不得关。
      let skippable = false;
      if (await closeBtn.count()) {
        await closeBtn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(400);
        skippable = (await page.locator('.web-story').count()) === 0;
      }
      if (!skippable) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(400);
        skippable = (await page.locator('.web-story').count()) === 0;
      }
      report.introFirstViewSkippable = skippable;
      write();
      if (skippable) {
        throw new Error('intro-first-view-skippable: 首刷可通过「关闭剧情」/Esc 直接关闭（规范要求仅回放可关）');
      }
    });
    // Rename the soft-check failure to the required id for readability
    const skipFail = report.checks.find((c) => c.name === 'A0-intro-first-view-skippable-probe' && !c.passed);
    if (skipFail) {
      skipFail.name = 'intro-first-view-skippable';
      const f = report.failures.find((x) => x.name === 'A0-intro-first-view-skippable-probe');
      if (f) f.name = 'intro-first-view-skippable';
      write();
    } else if (report.introFirstViewSkippable === false) {
      recordCheck('intro-first-view-skippable', true, '首刷不可跳过（符合规范）');
    }

    // ---------- A: real full-path login + intro via 下句 ----------
    await check('A-login-manual-name-sessionToken', async () => {
      await loginAs(fakeName);
      assert.ok(token.length === 64);
      assert.ok(studentId);
      await shot('02-logged-in-intro');
    });

    await check('A-intro-story-cg-loads', async () => {
      await page.locator('.web-story').waitFor({ timeout: 8000 });
      const src = await storyImage();
      assert.ok(src && src.includes('cg_'), 'intro 配图应为 cg_*，实际: ' + src);
      await shot('03-intro-cg');
    });

    await check('A-intro-complete-via-next-enter-map', async () => {
      await advanceIntroByNext();
      await page.getByRole('button', { name: '前往行人引导台', exact: true }).waitFor({ timeout: 8000 });
      const mission = await page.locator('.story-map-mission').innerText();
      assert.ok(mission.includes('前往行人引导台') || mission.includes('行人引导台'), mission);
      const s1 = page.locator('.map-workstation-s1');
      const cls = (await s1.getAttribute('class')) || '';
      assert.ok(cls.includes('is-next'), 'map-workstation-s1 应有 is-next');
      await shot('04-map-after-intro');
    });

    // ---------- B+C: S1 ----------
    await page.getByRole('button', { name: '前往行人引导台', exact: true }).click();
    await check('C-s1-story-image', async () => {
      await storyImage();
      await shot('05-s1-story');
    });
    await closeStories();

    await check('B-s1-learn-card-then-unique-guide', async () => {
      await page.getByRole('button', { name: '关闭先学卡', exact: true }).waitFor({ timeout: 8000 });
      await until(() => page.locator('.lesson-learn img').evaluate((e) => e.complete && e.naturalWidth > 0), 8000);
      await shot('06-s1-learn');
      await page.getByRole('button', { name: '关闭先学卡', exact: true }).click();
      await page.waitForTimeout(200);
      const g = await assertUniqueGuide('conditions');
      assert.equal(g.target, 'conditions');
      // 未作答前不应有 selected 正确答案高亮
      assert.equal(await page.locator('.condition-choices .selected').count(), 0);
      await shot('07-s1-guide-conditions');
    });

    await page.getByRole('button', { name: '绿灯未亮起？', exact: true }).click();
    await readGuide();
    await page.getByRole('button', { name: '连接是的箭头' }).click();
    await page.locator('[data-node-id="observe"]').click();
    await page.getByRole('button', { name: '连接否的箭头' }).click();
    await page.locator('[data-node-id="cross"]').click();
    await readGuide();

    await check('C-s1-step-pause-stable-two-cases', async () => {
      await page.getByRole('button', { name: '单步', exact: true }).click();
      const pos = await page.locator('.trace-count').innerText();
      await page.waitForTimeout(900);
      assert.equal(await page.locator('.trace-count').innerText(), pos);
      await page.getByRole('button', { name: '继续', exact: true }).click();
      await page.getByText('这个情形已运行。换另一种灯色情形试试。', { exact: true }).waitFor({ timeout: 14000 });
      await readGuide();
      await page.getByRole('button', { name: '先红灯，后来变绿' }).click();
      await page.getByRole('button', { name: '运行', exact: true }).click();
      await page.getByRole('button', { name: '完成引导台', exact: true }).waitFor({ timeout: 20000 });
      await readGuide();
      await shot('08-s1-two-cases');
      await page.getByRole('button', { name: '完成引导台', exact: true }).click();
      await until(async () => (await state()).stations.s2_rewrite === true);
      assert.ok((await state()).evidenceHistory.some((e) => e.taskId === 's1_order' || e.taskId === 's2_rewrite'));
      await storyImage();
      await shot('09-s1-success-story');
    });
    await closeStories();
    await closeLearn();

    // ---------- C: S2 scaffold 乙→1/2/3 then 甲 ----------
    await check('C-s2-scheme-yi-scaffold-1-2-3', async () => {
      await page.getByRole('button', { name: '方案乙', exact: true }).click();
      // 选图后会自动播放；须等 comparisonViewed 后再点箭头，否则 pickComparisonEdge 会直接 return
      await page.getByText('这一图已运行完。可以标出依据，也可以再看另一张。', { exact: true }).waitFor({ timeout: 20000 });
      await until(async () => !(await page.locator('.station-panel').evaluate((el) => el.classList.contains('guide-comparisonReplay') || el.getAttribute('data-guide-target') === 'comparisonReplay').catch(() => false)), 5000).catch(() => {});
      await edgeClick('branch_yes');
      await until(async () => {
        const g = await page.locator('.station-panel').getAttribute('data-guide-target');
        return g === 'check' || !(await page.getByRole('button', { name: '检查我的判断' }).isDisabled());
      }, 8000);
      for (let i = 1; i <= 3; i++) {
        await page.getByRole('button', { name: '检查我的判断' }).click({ timeout: 15000 });
        await until(async () => (await page.locator('.station-feedback').getAttribute('data-scaffold-level')) === String(i));
        await readGuide();
      }
      await shot('10-s2-scaffold3');
      await until(async () => (await state()).evidenceHistory.filter((e) => e.taskId === 's2_vs_branch' && e.payload?.kind === 'error_scaffold').length >= 3);
    });

    await page.getByRole('button', { name: '返回路口', exact: true }).click();
    await page.getByRole('button', { name: '前往信号拆解台', exact: true }).click();
    await closeStories();
    await closeLearn();

    await check('C-s2-scheme-jia-success-kettle-timing', async () => {
      await page.getByRole('button', { name: '方案甲', exact: true }).click();
      await page.getByText('这一图已运行完。可以标出依据，也可以再看另一张。', { exact: true }).waitFor({ timeout: 20000 });
      await edgeClick('back');
      await until(async () => !(await page.getByRole('button', { name: '检查我的判断' }).isDisabled()), 8000);
      await page.getByRole('button', { name: '检查我的判断' }).click();
      await page.getByRole('button', { name: '继续看热水壶' }).click();
      await closeLearn();
      await until(async () => (await state()).evidenceHistory.some((e) => e.taskId === 's2_vs_branch' && e.eventType === 'evidence_lock'));
      const last = (await state()).evidenceHistory.filter((e) => e.taskId === 's2_vs_branch' && e.eventType === 'evidence_lock').at(-1);
      assert.equal(last.payload.supportUsed, true);
      assert.equal(last.attemptKind, 'revision');

      await assertUniqueGuide();
      await page.getByRole('button', { name: '运行 80℃', exact: true }).click();
      await page.getByText('水温不足时才加热，然后再次读取判断。', { exact: true }).waitFor({ timeout: 18000 });
      await page.getByRole('button', { name: '开始时 100℃' }).click();
      await page.getByRole('button', { name: '运行 100℃', exact: true }).click();
      await page.getByText('已经100℃时，先读取判断，没有加热。', { exact: true }).waitFor({ timeout: 12000 });
      await page.getByRole('button', { name: '读取水温', exact: true }).click();
      await page.getByRole('button', { name: '下一项', exact: true }).click();
      await page.getByRole('button', { name: '达到100℃时', exact: true }).click();
      await page.getByRole('button', { name: '下一项', exact: true }).click();

      await page.getByRole('button', { name: '比较：先检查，还是先擦一下？', exact: true }).click();
      await page.getByRole('button', { name: '我预测：甲可能不擦', exact: true }).click();
      await page.getByRole('button', { name: '运行对比', exact: true }).click();
      await page.getByText(/甲擦了0次，乙擦了1次/).waitFor({ timeout: 12000 });
      assert.equal(await page.locator('.timing-counter').nth(0).innerText(), '已经擦了 0 次');
      assert.equal(await page.locator('.timing-counter').nth(1).innerText(), '已经擦了 1 次');
      await shot('11-s2-timing');
      await page.getByRole('button', { name: '回到热水壶', exact: true }).click();
      await page.getByRole('button', { name: '检查我的选择', exact: true }).click();
      await page.getByRole('button', { name: '完成拆解台', exact: true }).waitFor({ timeout: 12000 });
      await shot('12-s2-ready-complete');
      await page.getByRole('button', { name: '完成拆解台', exact: true }).click();
    });

    // ---------- C: S3 ----------
    await storyImage();
    await shot('13-s3-story');
    await closeStories();
    await closeLearn();

    await check('B-s3-relic-focus-real-next', async () => {
      await dismissOverlays();
      await assertUniqueGuide('run');
      const before = (await state()).relics.remaining;
      await page.getByRole('button', { name: /通关法宝/ }).click();
      await until(async () => (await state()).relics.remaining === before - 1, 10000);
      await dismissOverlays();
      const g = await assertUniqueGuide('run');
      assert.equal(g.target, 'run');
      await shot('14-s3-relic-guide');
    });

    await check('C-s3-path-and-optional-reset', async () => {
      await dismissOverlays();
      await page.getByRole('button', { name: '运行原方案', exact: true }).click();
      await page.getByText('原方案还等9辆。现在选时长和理由，再比较。', { exact: true }).waitFor({ timeout: 18000 });
      await readGuide();
      await page.getByRole('button', { name: '绿灯 6 格', exact: true }).click();
      await page.getByRole('button', { name: '让等待较多的这一侧多通行一些', exact: true }).click();
      await until(async () => (await state()).evidenceHistory.some((e) => e.taskId === 's3_timing' && e.eventType === 'simulation_run'));
      const historyBefore = (await state()).evidenceHistory.length;
      await page.getByRole('button', { name: '重做本关', exact: true }).click();
      await dismissOverlays();
      await closeLearn();
      await dismissOverlays();
      await page.getByRole('button', { name: '运行原方案', exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: '绿灯 6 格', exact: true }).isDisabled(), true);
      await until(async () => (await state()).evidenceHistory.some((e) => e.taskId === 's3_timing' && e.eventType === 'station_reset'));
      assert.ok((await state()).evidenceHistory.length > historyBefore);
      await shot('15-s3-reset');

      await page.getByRole('button', { name: '运行原方案', exact: true }).click();
      await page.getByText('原方案还等9辆。现在选时长和理由，再比较。', { exact: true }).waitFor({ timeout: 18000 });
      await page.getByRole('button', { name: '绿灯 6 格', exact: true }).click();
      await page.getByRole('button', { name: '让等待较多的这一侧多通行一些', exact: true }).click();
      await page.getByRole('button', { name: '运行', exact: true }).click();
      await page.getByRole('button', { name: '完成调度台', exact: true }).waitFor({ timeout: 20000 });
      await readGuide();
      await shot('16-s3-verified');
      await page.getByRole('button', { name: '完成调度台', exact: true }).click();
    });

    await check('C-exam-opens-after-three-stations', async () => {
      await storyImage();
      await shot('17-exam-story');
      await closeStories();
      await page.getByRole('heading', { name: '临时小交警 · 课堂综合检测' }).waitFor({ timeout: 10000 });
      assert.equal((await state()).examOpen, true);
      const uniq = [...new Set(report.storyImages)];
      assert.ok(uniq.length >= 4, 'storyImages 应覆盖 intro+s1+s2+s3 等，实际 ' + uniq.length + ': ' + uniq.join(','));
      await shot('18-exam-open');
    });

    // ---------- D: exam + replay ----------
    const chooseArbitrary = async () => {
      // matching：每个 fieldset 点一个选项
      const fieldsets = page.locator('section fieldset');
      if (await fieldsets.count()) {
        for (let i = 0; i < (await fieldsets.count()); i++) {
          const btn = fieldsets.nth(i).locator('button[type="button"]').first();
          if (await btn.count()) await btn.click();
        }
        return;
      }
      // 普通／策略／点选：题干区 grid 选项；拖放题：先拿卡片再点虚线槽
      // 注意：槽位 aria-label 是「菱形判断槽」等，不含「放入」；可见文案才是「放入…」
      const grid = page.locator('section div.grid button[type="button"]');
      assert.ok(await grid.count(), '本题未见可选按钮');
      await grid.first().click();
      const slot = page.locator('button').filter({ hasText: /^放入/ });
      if (await slot.count()) await slot.first().click();
      await page.waitForTimeout(80);
    };

    await check('D-base-exam-submit-score', async () => {
      for (let i = 0; i < 16; i++) {
        await chooseArbitrary();
        await until(async () => {
          const cur = page.locator('nav[aria-label="题号跳转"] button[aria-current="step"]');
          const answered = await cur.getAttribute('data-answered');
          const title = await cur.getAttribute('title');
          return answered === 'true' || title === '已答完整';
        }, 8000);
        if (i < 15) await page.getByRole('button', { name: '下一题 →', exact: true }).click();
      }
      await page.getByRole('button', { name: /提交基础关答卷/ }).click();
      await page.getByText(/基础层(首次)?得分/).waitFor({ timeout: 15000 });
      const saved = await state();
      assert.equal(saved.stations.exam, true);
      assert.ok(saved.examResult);
      report.examScore = { base: saved.examResult.baseScore, total: saved.examResult.baseTotal };
      await shot('19-base-submitted');
    });

    await softCheck('D-challenge-enter-partial', async () => {
      await page.getByRole('button', { name: '进入挑战关 →', exact: true }).click();
      await page.waitForTimeout(500);
      await chooseArbitrary();
      const next = page.getByRole('button', { name: '下一题 →', exact: true });
      if (await next.count()) await next.click();
      await shot('20-challenge-partial');
      // 返回：优先找返回按钮
      const back = page.getByRole('button', { name: '← 返回路口', exact: true });
      if (await back.count()) await back.click();
      else {
        // 可能需要先提交或找其他返回
        const back2 = page.getByRole('button', { name: /返回/ });
        if (await back2.count()) await back2.first().click();
      }
    });

    await check('D-replay-first-frame-closable', async () => {
      // 确保在路口
      if (await page.getByRole('button', { name: '剧情回放', exact: true }).count() === 0) {
        const back = page.getByRole('button', { name: '← 返回路口', exact: true });
        if (await back.count()) await back.click();
      }
      await page.getByRole('button', { name: '剧情回放', exact: true }).click();
      await page.getByRole('button', { name: '关闭剧情', exact: true }).waitFor();
      await shot('21-replay-first-frame');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      assert.equal(await page.locator('.web-story').count(), 0);
      await page.getByRole('button', { name: '再次检测', exact: true }).waitFor({ timeout: 8000 });
    });

    // ---------- E: teacher ----------
    await check('E-teacher-noauth-and-student-no-link', async () => {
      // 学生首页 DOM 不暴露教师入口导航
      await page.goto(base, { waitUntil: 'networkidle' });
      // 可能回到登录；重新登录到地图
      if (await page.getByRole('button', { name: '名单外手动输入' }).count()) {
        await page.getByRole('button', { name: '名单外手动输入' }).click();
        await page.getByPlaceholder('请输入姓名（如：张三）').fill(fakeName);
        await page.getByRole('button', { name: '穿上小交警马甲，进入路口' }).click();
        await page.locator('.web-lesson-host').waitFor({ timeout: 10000 });
        // 可能再出 intro（已知 intro）— 若有剧情且是回放可关
        if (await page.locator('.web-story').count()) {
          await page.getByRole('button', { name: '关闭剧情', exact: true }).click().catch(() => {});
          await page.waitForTimeout(200);
        }
      }
      const studentHasTeacherNav = await page.evaluate(() => {
        const links = [...document.querySelectorAll('a,button')];
        return links.some((el) => {
          const href = (el.getAttribute('href') || '') + ' ' + (el.textContent || '');
          return /\/teacher|教师大屏|老师大屏/.test(href);
        });
      });
      assert.equal(studentHasTeacherNav, false, '学生端不应有教师入口导航');

      const teacherPage = await context.newPage();
      const terr = [];
      teacherPage.on('pageerror', (e) => terr.push(e.message));
      await teacherPage.goto(base + '/teacher', { waitUntil: 'networkidle' });
      await teacherPage.waitForTimeout(800);
      await teacherPage.screenshot({ path: path.join(output, 'shot-22-teacher.png'), fullPage: true });
      const body = await teacherPage.locator('body').innerText();
      const hasClass = /班级|选择班级|class/i.test(body) || (await teacherPage.locator('select, [role="combobox"], button').count()) > 0;
      const csv = teacherPage.locator('a[href*="export.csv"], a[href*="/api/teacher/export"]');
      const hasCsv = (await csv.count()) > 0 || body.includes('导出') || body.includes('CSV') || body.includes('csv');
      // API 抽查
      const api = await teacherPage.request.get(base + '/api/teacher');
      assert.equal(api.status(), 200);
      const apiData = await api.json();
      const exportRes = await teacherPage.request.get(base + '/api/teacher/export.csv');
      assert.ok([200, 204].includes(exportRes.status()) || exportRes.headers()['content-type']?.includes('csv') || exportRes.status() === 200);

      let studentSeen = false;
      const blob = JSON.stringify(apiData) + body;
      if (blob.includes(fakeName) || blob.includes(studentId)) studentSeen = true;
      // 翻班级列表再找
      if (!studentSeen && apiData && typeof apiData === 'object') {
        const flat = JSON.stringify(apiData);
        studentSeen = flat.includes(fakeName) || flat.includes(studentId);
      }

      report.teacher = {
        http200: true,
        hasClassSelect: hasClass,
        hasCsvExport: hasCsv || exportRes.status() === 200,
        studentTraceVisible: studentSeen,
        pageErrors: terr,
      };
      write();
      assert.equal(terr.length, 0, 'teacher pageErrors: ' + terr.join(';'));
      assert.ok(hasClass, '教师大屏应有班级选择相关 UI');
      assert.ok(hasCsv || exportRes.status() === 200, '应有导出 CSV');
      await teacherPage.close();
      await shot('23-student-no-teacher-nav');
    });

    // ---------- F: controls health ----------
    await check('F-pageErrors-empty-and-key-controls', async () => {
      assert.equal(report.pageErrors.length, 0, report.pageErrors.join(' | '));
      // 回路口关键按钮存在性抽查
      await page.goto(base, { waitUntil: 'networkidle' });
      if (await page.getByRole('button', { name: '名单外手动输入' }).count()) {
        await page.getByRole('button', { name: '名单外手动输入' }).click();
        await page.getByPlaceholder('请输入姓名（如：张三）').fill(fakeName);
        await page.getByRole('button', { name: '穿上小交警马甲，进入路口' }).click();
        await page.locator('.web-lesson-host').waitFor({ timeout: 10000 });
        if (await page.locator('.web-story').count()) {
          await page.getByRole('button', { name: '关闭剧情', exact: true }).click().catch(() => {});
        }
      }
      assert.ok(await page.getByRole('button', { name: '再次检测', exact: true }).count(), '再次检测');
      assert.ok(await page.getByRole('button', { name: '剧情回放', exact: true }).count(), '剧情回放');
      // 进一站看撤回／先学卡／帮助
      await page.getByRole('button', { name: /行人引导台|前往行人引导台/ }).first().click();
      await closeStories();
      if (await page.getByRole('button', { name: '关闭先学卡', exact: true }).count()) {
        await page.getByRole('button', { name: '关闭先学卡', exact: true }).click();
      }
      assert.ok(await page.getByRole('button', { name: '撤回上一步', exact: true }).count(), '撤回上一步');
      await page.getByRole('button', { name: '操作帮助', exact: true }).click();
      await page.getByRole('button', { name: '关闭帮助', exact: true }).click();
      await page.getByRole('button', { name: '返回路口', exact: true }).click();
      await shot('24-controls-ok');
    });

    report.completedAt = new Date().toISOString();
    report.completedAtShanghai = shanghaiLabel();
    report.guideUniqueAlways = report.guideSequence.every((g) => g.unique !== false);
    write();
  } catch (e) {
    report.failure = String(e.stack || e);
    write();
    try { await shot('failure'); } catch {}
    throw e;
  } finally {
    await browser.close();
  }
})().catch((e) => {
  report.failure = report.failure || String(e.stack || e);
  write();
  console.error(e);
}).finally(() => {
  try {
    const mdPath = path.join(output, 'FULLFLOW-20261110.md');
    const pass = report.checks.filter((c) => c.passed).length;
    const fail = report.checks.filter((c) => !c.passed).length;
    const blocking = report.failures.filter((f) => f.name !== 'intro-first-view-skippable');
    let verdict = '通过';
    if (report.failure || blocking.length > 0) verdict = '不通过';
    else if (fail > 0) verdict = '有条件通过';
    report.verdict = verdict;
    write();
    const shots = fs.readdirSync(output).filter((f) => f.startsWith('shot-') && f.endsWith('.png')).sort();
    const lines = [];
    lines.push('# 五年级第7课《重复操作用循环》全流程检测简报');
    lines.push('');
    lines.push(`## 结论：${verdict}`);
    lines.push('');
    lines.push(`- PASS ${pass} / FAIL ${fail}`);
    lines.push(`- intro 首刷可跳过：${report.introFirstViewSkippable === true ? '是（规范 FAIL）' : report.introFirstViewSkippable === false ? '否（符合规范）' : '未测'}`);
    lines.push(`- 引导焦点全程唯一：${report.guideUniqueAlways ? '是' : '否／未完整'}`);
    lines.push(`- pageErrors：${report.pageErrors.length ? report.pageErrors.join('；') : '无'}`);
    lines.push('');
    lines.push('## 环境');
    lines.push('');
    lines.push(`- commit：${report.commit}`);
    lines.push(`- PORT／BASE：${report.base}`);
    lines.push(`- DATA_DIR：${report.dataDir || '(见启动环境)'}`);
    lines.push(`- 开始：${report.startedAtShanghai || report.startedAt}`);
    lines.push(`- 结束：${report.completedAtShanghai || report.completedAt || shanghaiLabel()}`);
    lines.push(`- 虚构学生：${report.fakeName}（${report.studentId}）`);
    lines.push('');
    lines.push('## 检查表');
    lines.push('');
    lines.push('| 项 | 结果 | 说明 |');
    lines.push('|---|---|---|');
    for (const c of report.checks) {
      lines.push(`| ${c.name} | ${c.passed ? 'PASS' : 'FAIL'} | ${(c.detail || '').replace(/\|/g, '／').slice(0, 160)} |`);
    }
    lines.push('');
    lines.push('## 引导焦点序列摘要');
    lines.push('');
    if (!report.guideSequence.length) lines.push('（无记录）');
    else {
      const seq = report.guideSequence.map((g) => g.target || '?').join(' → ');
      lines.push('`' + seq + '`');
      lines.push('');
      lines.push(`共 ${report.guideSequence.length} 次采样；多引导类冲突：${report.guideSequence.filter((g) => !g.unique).length} 次`);
    }
    lines.push('');
    lines.push('## 剧情配图清单');
    lines.push('');
    for (const src of report.storyImages) lines.push(`- ${src}`);
    if (!report.storyImages.length) lines.push('- （无）');
    lines.push('');
    lines.push('## 缺陷清单');
    lines.push('');
    if (!report.failures.length && !report.failure) lines.push('- 无');
    else {
      for (const f of report.failures) {
        const block = f.name === 'intro-first-view-skippable' ? '否（规范项，不阻断正路径上课，建议修）' : '可能影响验收／体验';
        lines.push(`- **${f.name}**：${(f.detail || '').slice(0, 200)}；是否阻塞上课：${block}`);
      }
      if (report.failure) lines.push(`- **脚本中断**：${String(report.failure).split('\n')[0].slice(0, 240)}；是否阻塞上课：是（检测未跑完）`);
    }
    lines.push('');
    lines.push('## 教师大屏');
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(report.teacher, null, 2));
    lines.push('```');
    lines.push('');
    lines.push('## 截图文件名列表');
    lines.push('');
    for (const s of shots) lines.push(`- ${s}`);
    lines.push('');
    lines.push('## 说明');
    lines.push('');
    lines.push('- 本检测在隔离 PORT=18997 与临时 DATA_DIR 上完成，未改动课堂 8797 进程及其 runtime。');
    lines.push('- 所有作答均为虚构身份模拟，不是教学效果评价。');
    for (const n of report.notes) lines.push(`- ${n}`);
    fs.writeFileSync(mdPath, lines.join('\n'));
    console.log('MD', mdPath);
    console.log('VERDICT', verdict, 'PASS', pass, 'FAIL', fail);
    if (report.failure || blocking.length > 0) process.exitCode = 1;
  } catch (err) {
    console.error('failed to write markdown', err);
    process.exitCode = 1;
  }
});
