'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const {execFileSync}=require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/Users/jun/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output = __dirname, prior = JSON.parse(fs.readFileSync(path.join(output, 'final-lan-report.json')));
const reportPath = path.join(output, 'assessment-finish-20261107.json');
const report = JSON.parse(fs.readFileSync(reportPath));
(async () => {
 const browser = await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox']});
 const page = await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror', e => report.pageErrors.push(e.message));
 await page.addInitScript(() => {
   window.__qaEvents = [];
   window.addEventListener('message', e => { if(e.data?.source === 'g5l7-godot') window.__qaEvents.push({event:e.data.event,panelId:e.data.payload?.panelId}); });
 });
 const shot = name => page.screenshot({path:path.join(output,'finish-native-'+name+'.png'),fullPage:true});
 try {
  await page.goto('http://localhost:18997',{waitUntil:'networkidle'});
  await page.getByRole('button',{name:'名单外手动输入',exact:true}).click();
  await page.getByPlaceholder('请输入姓名（如：张三）').fill(prior.fakeName);
  await page.getByRole('button',{name:'穿上小交警马甲，进入路口'}).click();
  const frame=page.frameLocator('iframe[title="g5l7-godot"]');
  const canvas=frame.locator('canvas');
  await canvas.waitFor();
  await page.waitForFunction(() => {
    const b=document.querySelector('iframe')?.contentWindow?.G5L7Classroom;
    return b?._godotReady && b.getProgress()?.webPanels === true && b.getProgress()?.introSeen === true;
  },null,{timeout:30000});
  await shot('hub');
  const box=await canvas.boundingBox();
  await page.mouse.click(box.x+104/1280*box.width,box.y+684/1280*box.width);
  // Read compositor screenshots, not the transient/unpreserved WebGL backing buffer.
  let storyVisible=false;const deadline=Date.now()+12000;
  while(Date.now()<deadline){
    const buffer=await page.screenshot({clip:{x:box.x+250/1280*box.width,y:box.y+550/1280*box.width,width:8,height:8}});
    const [r,g,b]=JSON.parse(execFileSync('python3',['-c','from PIL import Image,ImageStat; import sys,json; print(json.dumps(ImageStat.Stat(Image.open(sys.stdin.buffer).convert("RGB")).mean))'],{input:buffer}).toString());
    if(r>235&&g>225&&b>195){storyVisible=true;break;}
  }
  assert.equal(storyVisible,true,'The actual cream story panel must be visible before closing it');
  await shot('story-open');
  await page.mouse.click(box.x+237/1280*box.width,box.y+482/1280*box.width);
  await page.getByRole('heading',{name:'怎样把“一直等”说清楚？',exact:true}).waitFor({timeout:15000});
  const learn=page.getByRole('button',{name:'关闭先学卡',exact:true});if(await learn.count())await learn.click();
  await shot('react-station');
  assert.deepEqual(report.pageErrors,[]);
  report.nativeEvents=await page.evaluate(()=>window.__qaEvents);
  report.checks.push({name:'Secure localhost Godot bridge resumes known progress and opens a React task',passed:true});
  report.notes=['Only an existing virtual identity and isolated 18997 service were used.','Native approach animation is awaited via compositor story-panel pixels before clicking the actual close button.','B08/C02 768 screenshots were opened and visually inspected: diagrams stack vertically, labels are clear and nodes are not cut off.'];
  report.status='passed';delete report.failure;report.completedAt=new Date().toISOString();
  fs.writeFileSync(reportPath,JSON.stringify(report,null,2));console.log('PASS localhost Godot bridge and React station');
 }catch(error){report.status='failed';report.failure=String(error.stack||error);report.nativeEvents=await page.evaluate(()=>window.__qaEvents);fs.writeFileSync(reportPath,JSON.stringify(report,null,2));await shot('failure');throw error;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
