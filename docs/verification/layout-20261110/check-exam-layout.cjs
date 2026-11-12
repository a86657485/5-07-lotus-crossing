'use strict';
/**
 * 五年级第7课考核／探究版式自检（隔离 PORT=18997 + 临时 DATA_DIR）。
 * 视口：1440×900、1366×768。勿碰课堂 8797。
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');

const output = __dirname;
const base = process.env.TEST_BASE_URL || 'http://192.168.0.14:18997';
const chrome = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const viewports = [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1366x768', width: 1366, height: 768 },
];

const shanghaiLabel = () => {
  const s = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' });
  return s.replace(' ', 'T') + '+08:00 Asia/Shanghai';
};

const report = {
  startedAtShanghai: shanghaiLabel(),
  base,
  commit: process.env.APP_COMMIT || '',
  dataDir: process.env.DATA_DIR || '',
  checks: [],
  failures: [],
  pageErrors: [],
  shots: [],
  metrics: [],
  notes: [],
  studentId: '',
  fakeName: '',
};

const write = () => fs.writeFileSync(path.join(output, 'layout-report.json'), JSON.stringify(report, null, 2));
write();

const BASE_PAPER = {
  B01: '到达路口',
  B02: '灯在选两条不同的路',
  B03: '必须先知道次数',
  B04: { diamond: '绿灯未亮？' },
  B05: { repeatRect: '原地观察红绿灯' },
  B06: '接回「原地观察」',
  B07: '只在等待框写「重复3次」',
  B08: '图甲',
  B09: '两条路都向后续步骤走，没有返回先前步骤',
  B10: { condition: '水温还低于设定？' },
  B11: '先问再做',
  B12: '菱形里应是可答是／否的条件，不是动作',
  B13: '适当增加车多方向的放行时间',
  B14: '乙使第一侧少等，也使第二侧多等',
  B15: '加长行人通行时间',
  B16: {
    '等绿灯过街': '原地观察／绿灯亮停',
    '保温壶加热': '继续加热／达设定停',
    '红绿黄交替': '按序换灯色／一轮后再来',
  },
};

function isYellowish(color) {
  const m = String(color || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!m) return false;
  const r = Number(m[1]), g = Number(m[2]), b = Number(m[3]);
  const a = /rgba/.test(color) ? Number((color.match(/,\s*([0-9.]+)\)$/) || [1, 1])[1]) : 1;
  if (a < 0.12) return false;
  return r > 180 && g > 120 && b < 120 && r >= g && (r - b) > 60;
}

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
  const fakeName = '版式QA_' + Date.now();
  report.fakeName = fakeName;

  page.on('pageerror', (e) => {
    report.pageErrors.push(e.message);
    write();
  });

  const record = (name, passed, detail = '') => {
    report.checks.push({ name, passed, detail });
    if (!passed) report.failures.push({ name, detail });
    write();
    console.log(passed ? 'PASS' : 'FAIL', name, detail || '');
  };

  const shot = async (name) => {
    const file = `after-${name}.png`;
    const dest = path.join(output, file);
    await page.screenshot({ path: dest, fullPage: false });
    report.shots.push({ file, dest, viewport: page.viewportSize() });
    write();
    return dest;
  };

  const until = async (fn, t = 16000) => {
    const start = Date.now();
    while (Date.now() - start < t) {
      if (await fn()) return;
      await page.waitForTimeout(120);
    }
    throw new Error('timed out waiting for result');
  };

  const headers = () => (token ? { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' });

  const measureExam = async (label) => {
    const metrics = await page.evaluate((isYellowishSrc) => {
      const fn = new Function('color', isYellowishSrc + '; return isYellowish(color);');
      const box = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { top: r.top, right: r.right, bottom: r.bottom, left: r.left, width: r.width, height: r.height };
      };
      const inView = (el, vh) => {
        const r = box(el);
        return !!r && r.top >= -4 && r.bottom <= vh + 4 && r.height > 0;
      };
      const shell = document.querySelector('.exam-shell');
      const stage = document.querySelector('.exam-stage');
      const workspace = document.querySelector('.exam-workspace');
      const visual = document.querySelector('.exam-visual');
      const prompt = document.querySelector('.exam-prompt');
      const footer = document.querySelector('.exam-footer');
      const stem = document.querySelector('.exam-stem');
      const canvas = document.querySelector('.question-figure-canvas');
      const recall = document.querySelector('.exam-recall img');
      const options = [...document.querySelectorAll('.exam-answers button, .exam-options button, .exam-match-choices button')];
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      const fb = box(footer);
      const unselectedYellow = options.filter((o) => o.getAttribute('aria-pressed') !== 'true').filter((o) => {
        const s = getComputedStyle(o);
        return fn(s.backgroundColor) || fn(s.borderColor) || fn(s.color);
      }).map((o) => (o.textContent || '').trim());
      return {
        vw, vh,
        question: stage && stage.getAttribute('data-exam-question'),
        visualType: stage && stage.getAttribute('data-exam-visual'),
        shellH: shell && shell.clientHeight,
        workspaceH: workspace && workspace.clientHeight,
        visual: box(visual),
        prompt: box(prompt),
        canvasH: canvas && canvas.clientHeight,
        canvasW: canvas && canvas.clientWidth,
        recallLoaded: recall ? (recall.complete && recall.naturalWidth > 0 && recall.clientHeight > 120) : null,
        recallSrc: recall ? recall.getAttribute('src') : null,
        stemInView: inView(stem, vh),
        footerInView: inView(footer, vh),
        visualInView: inView(visual, vh),
        gapBelowFooter: fb ? Math.max(0, Math.round(vh - fb.bottom)) : null,
        workspaceFillRatio: shell && workspace ? +(workspace.clientHeight / shell.clientHeight).toFixed(3) : 0,
        optionCount: options.length,
        optionsInView: options.every((o) => {
          const r = o.getBoundingClientRect();
          return r.height > 0 && r.top >= -4 && r.bottom <= vh + 4;
        }),
        gapBelowOptions: (() => {
          const area = document.querySelector('.exam-answers') || document.querySelector('.exam-prompt');
          if (!area || !options.length) return null;
          const last = options[options.length - 1].getBoundingClientRect();
          return Math.max(0, Math.round(area.getBoundingClientRect().bottom - last.bottom));
        })(),
        optionMinHeight: options.length ? Math.round(Math.min(...options.map((o) => o.getBoundingClientRect().height))) : null,
        figureClips: [...document.querySelectorAll('[data-figure-name]')].map((card) => {
          const canvas = card.querySelector('.question-figure-canvas') || card;
          const cr = canvas.getBoundingClientRect();
          const slack = 1.5;
          const hits = [];
          for (const el of card.querySelectorAll('.edge-word, .react-flow__edge-path, .lesson-node')) {
            const r = el.getBoundingClientRect();
            if (r.width < 1 || r.height < 1) continue;
            if (r.left < cr.left - slack || r.right > cr.right + slack || r.top < cr.top - slack || r.bottom > cr.bottom + slack) {
              hits.push({
                kind: el.className && el.className.baseVal || el.className || el.tagName,
                text: (el.textContent || '').trim().slice(0, 12),
                overflow: {
                  left: Math.round(cr.left - r.left),
                  right: Math.round(r.right - cr.right),
                  top: Math.round(cr.top - r.top),
                  bottom: Math.round(r.bottom - cr.bottom),
                },
              });
            }
          }
          return { name: card.getAttribute('data-figure-name'), clips: hits };
        }),
        unselectedYellow,
        overflowY: document.documentElement.scrollHeight - vh,
        promptScroll: prompt ? Math.max(0, prompt.scrollHeight - prompt.clientHeight) : 0,
      };
    }, isYellowish.toString());
    metrics.label = label;
    metrics.at = shanghaiLabel();
    report.metrics.push(metrics);
    write();

    const tightFooter = metrics.gapBelowFooter !== null && metrics.gapBelowFooter <= 20;
    const filled = metrics.workspaceFillRatio >= 0.52;
    const visualTall = metrics.visual && metrics.visual.height >= (metrics.vh >= 860 ? 360 : 260);
    const noLeak = (metrics.unselectedYellow || []).length === 0;
    const oneScreen = metrics.stemInView && metrics.footerInView && metrics.visualInView && metrics.optionsInView && metrics.promptScroll <= 24;
    const optionsFill = metrics.gapBelowOptions === null || metrics.gapBelowOptions <= 28;
    const figureClipOk = !metrics.figureClips || metrics.figureClips.every((item) => !item.clips.length);
    const figureOk = metrics.visualType !== 'figure' || (metrics.canvasH && metrics.canvasH >= (metrics.vh >= 860 ? 300 : 220));
    const recallOk = metrics.visualType !== 'recall' || metrics.recallLoaded === true;
    const pass = tightFooter && filled && visualTall && noLeak && oneScreen && optionsFill && figureOk && figureClipOk && recallOk && metrics.overflowY <= 8;
    const detail = JSON.stringify({
      q: metrics.question,
      type: metrics.visualType,
      fill: metrics.workspaceFillRatio,
      visualH: metrics.visual && Math.round(metrics.visual.height),
      canvasH: metrics.canvasH,
      gapBelowFooter: metrics.gapBelowFooter,
      promptScroll: metrics.promptScroll,
      gapBelowOptions: metrics.gapBelowOptions,
      optionMinHeight: metrics.optionMinHeight,
      figureClips: metrics.figureClips,
      overflowY: metrics.overflowY,
      unselectedYellow: metrics.unselectedYellow,
      recallSrc: metrics.recallSrc,
      stemInView: metrics.stemInView,
      footerInView: metrics.footerInView,
    });
    record('layout-' + label, pass, detail);
    return metrics;
  };


  const dismissOverlays = async () => {
    for (let i = 0; i < 6; i++) {
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

  const setViewport = async (vp) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(250);
  };

  const gotoQuestion = async (id) => {
    const current = await page.locator('.exam-stage').getAttribute('data-exam-question');
    if (current === id) return;
    const buttons = page.locator('nav[aria-label="题号跳转"] button');
    const count = await buttons.count();
    for (let i = 0; i < count; i++) {
      await buttons.nth(i).click();
      await page.waitForTimeout(80);
      if ((await page.locator('.exam-stage').getAttribute('data-exam-question')) === id) return;
    }
    throw new Error('cannot jump to ' + id);
  };

  const captureQuestion = async (id) => {
    await gotoQuestion(id);
    await until(async () => (await page.locator('.exam-stage').getAttribute('data-exam-question')) === id);
    if (await page.locator('.exam-recall img').count()) {
      await until(() => page.locator('.exam-recall img').evaluate((e) => e.complete && e.naturalWidth > 0), 8000);
    }
    if (await page.locator('.question-figure-canvas').count()) {
      await page.waitForTimeout(400); // allow React Flow fitView
    }
    for (const vp of viewports) {
      await setViewport(vp);
      if (await page.locator('.question-figure-canvas').count()) await page.waitForTimeout(350);
      await shot(`${id}-${vp.name}`);
      await measureExam(`${id}-${vp.name}`);
    }
  };

  try {
    await setViewport(viewports[0]);
    await page.goto(base, { waitUntil: 'networkidle' });
    await shot('login-1440x900');
    await setViewport(viewports[1]);
    await shot('login-1366x768');
    await setViewport(viewports[0]);

    await page.getByRole('button', { name: '名单外手动输入' }).click();
    await page.getByPlaceholder('请输入姓名（如：张三）').fill(fakeName);
    const pending = page.waitForResponse((r) => r.url().endsWith('/api/login') && r.request().method() === 'POST');
    await page.getByRole('button', { name: '穿上小交警马甲，进入路口' }).click();
    const loginRes = await pending;
    assert.equal(loginRes.status(), 200);
    const loginData = await loginRes.json();
    token = loginData.sessionToken;
    studentId = loginData.student.studentId;
    report.studentId = studentId;
    write();
    record('login', true, studentId);

    await page.locator('.web-lesson-host').waitFor({ timeout: 12000 });
    await page.locator('.web-story').waitFor({ timeout: 8000 }).catch(() => {});
    // Finish first-view intro (cannot skip).
    for (let i = 0; i < 8; i++) {
      const next = page.getByRole('button', { name: /下句|好的/ });
      if (!(await next.count())) break;
      await next.click();
      await page.waitForTimeout(180);
    }
    await page.locator('.story-map-main').waitFor({ timeout: 8000 });
    await shot('map-1440x900');
    await setViewport(viewports[1]);
    await shot('map-1366x768');
    await setViewport(viewports[0]);
    record('map-visible', true);

    await page.getByRole('button', { name: /前往行人引导台/ }).click();
    for (let i = 0; i < 4; i++) {
      const next = page.getByRole('button', { name: /下句|好的/ });
      if (!(await next.count())) break;
      await next.click();
      await page.waitForTimeout(180);
    }
    await page.locator('.station-panel').waitFor({ timeout: 8000 });
    await dismissOverlays();
    await shot('s1-1440x900');
    await setViewport(viewports[1]);
    await shot('s1-1366x768');
    await setViewport(viewports[0]);
    const s1 = await page.evaluate(() => {
      const panel = document.querySelector('.station-panel');
      const workspace = document.querySelector('.station-workspace');
      const bottom = document.querySelector('.station-bottom');
      const vh = window.innerHeight;
      const bb = bottom && bottom.getBoundingClientRect();
      return {
        workspaceH: workspace && workspace.clientHeight,
        gapBelowBottom: bb ? Math.max(0, Math.round(vh - bb.bottom)) : null,
        panelH: panel && panel.clientHeight,
      };
    });
    report.metrics.push({ label: 's1-station', ...s1 });
    record('s1-station-fill', s1.gapBelowBottom !== null && s1.gapBelowBottom <= 24 && s1.workspaceH >= 300, JSON.stringify(s1));
    await page.getByRole('button', { name: '返回路口' }).click();
    await page.locator('.story-map-main').waitFor({ timeout: 8000 });

    const progress = await page.request.post(base + '/api/progress', {
      headers: headers(),
      data: {
        studentId,
        stations: {
          s1_order: true,
          s2_rewrite: true,
          s2_vs_branch: true,
          s2_kettle: true,
          s3_timing: true,
        },
        s3Detail: {
          faultObserved: true,
          scenario: 'car_heavy',
          strategy: 'extend',
          reason: 'queue',
          ruleChanged: true,
          revalidateOk: true,
        },
      },
    });
    assert.equal(progress.status(), 200, await progress.text());
    const progressBody = await progress.json();
    assert.equal(progressBody.state.examOpen, true, 'examOpen should be true after stations');
    record('unlock-exam-via-api', true);

    // Session lives in React memory, so reload would drop the login. Sign in again with the same name to pick up examOpen.
    const loginAgain = async () => {
      await page.goto(base, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: '名单外手动输入' }).click();
      await page.getByPlaceholder('请输入姓名（如：张三）').fill(fakeName);
      const pendingAgain = page.waitForResponse((r) => r.url().endsWith('/api/login') && r.request().method() === 'POST');
      await page.getByRole('button', { name: '穿上小交警马甲，进入路口' }).click();
      const again = await pendingAgain;
      assert.equal(again.status(), 200);
      const data = await again.json();
      token = data.sessionToken;
      studentId = data.student.studentId;
      await page.locator('.web-lesson-host').waitFor({ timeout: 12000 });
      // Progress already recorded, so intro should be skipped.
      await page.locator('.story-map-main').waitFor({ timeout: 10000 });
    };
    await loginAgain();
    await page.getByRole('button', { name: /进入当课检测|再次检测|继续检测/ }).click();
    await page.locator('.exam-shell').waitFor({ timeout: 8000 });
    record('exam-open', true);

    await captureQuestion('B01');
    await captureQuestion('B08');

    const submit = await page.request.post(base + '/api/exam/submit', {
      headers: headers(),
      data: {
        studentId,
        tier: 'base',
        eventId: 'exam-layout-qa-' + Date.now(),
        answers: BASE_PAPER,
      },
    });
    if (submit.status() !== 200) {
      record('submit-base-for-challenge', false, submit.status() + ' ' + await submit.text());
      throw new Error('base submit failed');
    }
    record('submit-base-for-challenge', true);

    await page.getByRole('button', { name: '← 返回路口' }).click();
    await page.locator('.story-map-main').waitFor({ timeout: 8000 });
    await page.getByRole('button', { name: /进入当课检测|再次检测|继续检测/ }).click();
    await page.locator('.exam-shell').waitFor({ timeout: 8000 });
    await page.getByRole('button', { name: /挑战关/ }).first().click();
    await until(async () => (await page.locator('.exam-stage').getAttribute('data-exam-question') || '').startsWith('C'));
    record('challenge-unlocked', true);

    await captureQuestion('C01');
    await captureQuestion('C02');
    await captureQuestion('C03');
    await captureQuestion('C05');

    record('pageErrors-empty', report.pageErrors.length === 0, report.pageErrors.join(' | '));
  } catch (error) {
    record('script-error', false, String(error && error.stack || error));
    try { await shot('script-error'); } catch {}
  } finally {
    const md = [];
    md.push('# 五年级第7课考核版式自检 LAYOUT-QA-20261110');
    md.push('');
    md.push(`- 检测时间：${report.startedAtShanghai}`);
    md.push(`- 提交时间：${shanghaiLabel()}`);
    md.push(`- 隔离地址：${base}`);
    md.push(`- 提交：${report.commit || '（启动时写入）'}`);
    md.push(`- 临时 DATA_DIR：${report.dataDir || '（启动环境）'}`);
    md.push(`- 测试身份：${report.fakeName} / ${report.studentId}`);
    md.push(`- 结论：${report.failures.length ? '未通过，需继续改' : '通过，可交老师审'}`);
    md.push(`- 检查：${report.checks.filter((c) => c.passed).length} 过 / ${report.checks.filter((c) => !c.passed).length} 不过`);
    md.push('');
    md.push('## 改动要点');
    md.push('- 考核页改为占满 `100vh` 的纵向 flex 壳，题目区 `flex:1`，底栏贴题目区底部，不再靠大块空白把「上一题／下一题」推下去。');
    md.push('- 宽屏（≥1100px）左右分栏：有流程图时左图右题，画布高度随可用空间伸展，去掉写死的 365–410px。');
    md.push('- 无流程图题在左侧放本课已有剧情配图作「情景回忆」（中性标题，不圈选项、不暗示答案），右侧放大题干与选项。');
    md.push('- 双流程图（B08/C02）在左栏左右并列并填满高度。积木题（C05）拼装区加大。');
    md.push('- 窄屏改为上图下题（约 45/55）。探究站 workspace 取消过矮的 max-height 封顶，让主工作区填满站面板。');
    md.push('- 未改题干、选项、判分、引导与焦点逻辑；未作答选项仍是深色边，只有已选才用琥珀色。');
    md.push('');
    md.push('## 各视口是否饱满');
    for (const m of report.metrics) {
      md.push(`- **${m.label}**：workspace 占比 ${m.workspaceFillRatio ?? '-'}，画面高度 ${m.visual && Math.round(m.visual.height) || m.workspaceH || '-'}，底栏距视窗下沿 ${m.gapBelowFooter ?? m.gapBelowBottom ?? '-'}px，题干在屏内 ${m.stemInView ?? '-'}，回忆图 ${m.recallSrc || (m.visualType === 'figure' ? '流程图' : '-')}。`);
    }
    md.push('');
    md.push('## 检查明细');
    for (const c of report.checks) {
      md.push(`- ${c.passed ? '通过' : '不通过'} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
    }
    md.push('');
    md.push('## 截图');
    for (const s of report.shots) md.push(`- \`${s.dest}\``);
    if (report.pageErrors.length) {
      md.push('');
      md.push('## 页面错误');
      for (const e of report.pageErrors) md.push(`- ${e}`);
    }
    md.push('');
    md.push('未改答题与判分逻辑。本检测在隔离端口完成，未改课堂 8797 数据。');
    fs.writeFileSync(path.join(output, 'LAYOUT-QA-20261110.md'), md.join('\n'));
    write();
    await browser.close();
    const failed = report.failures.length;
    console.log('MD', path.join(output, 'LAYOUT-QA-20261110.md'));
    console.log('VERDICT', failed ? 'FAIL ' + failed : 'PASS', 'checks', report.checks.length);
    process.exit(failed ? 1 : 0);
  }
})();
