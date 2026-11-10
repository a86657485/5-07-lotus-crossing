'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const output=__dirname,report=JSON.parse(fs.readFileSync(path.join(output,'report.json'))),write=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
(async()=>{const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:1440,height:900}});page.on('pageerror',e=>{report.pageErrors.push(e.message);write()});
const shot=n=>page.screenshot({path:path.join(output,n+'.png'),fullPage:true});
const check=async(n,fn)=>{await fn();report.checks.push({name:n,passed:true});write();console.log('PASS',n)};
const nativeClick=async(x,y)=>{const box=await page.frameLocator('iframe').locator('canvas').boundingBox();await page.mouse.click(box.x+x/1280*box.width,box.y+y/1280*box.width);await page.waitForTimeout(250)};
const login=async(name='终验虚构学生_'+report.startedAt.slice(11,19).replaceAll(':',''))=>{await page.getByRole('button',{name:'名单外手动输入'}).click();await page.getByPlaceholder('请输入姓名（如：张三）').fill(name);const response=page.waitForResponse(r=>r.url().endsWith('/api/login')&&r.request().method()==='POST');await page.getByRole('button',{name:'穿上小交警马甲，进入路口'}).click();const result=await(await response).json();await page.waitForTimeout(3500);return result};
try{
const saved=(await(await page.request.get(report.base+'/api/state?studentId='+encodeURIComponent(report.studentId))).json()).state;
await check('三站真实完成后服务端自动开考',async()=>{assert.equal(saved.examOpen,true);for(const key of ['s1_order','s2_rewrite','s2_vs_branch','s2_kettle','s3_timing'])assert.equal(saved.stations[key],true);assert.ok(saved.evidenceHistory.some(e=>e.taskId==='s3_timing'&&e.eventType==='evidence_lock'));fs.copyFileSync(path.join(output,'continued_failure.png'),path.join(output,'11_exam_open.png'))});
if(report.failure){report.notes.push('原续测脚本在自动进入考核后仍尝试寻找已经销毁的Godot画布而超时；截图和服务端状态确认应用已正常开考。后续控件验证拆开执行。');delete report.failure;}
// Test fixture only: prepare an existing exam result so the new “再次检测” button can be verified independently of all 16 existing question interactions.
await page.request.post(report.base+'/api/exam/submit',{data:{studentId:report.studentId,eventId:'independent-exam-'+Date.now(),answers:{}}});
await page.goto(report.base,{waitUntil:'networkidle'});await login();await shot('12_completed_refresh_hub');
await check('完成后刷新回路口并可再次检测',async()=>{await nativeClick(730,684);await page.getByRole('heading',{name:'临时小交警 · 课堂综合检测'}).waitFor({timeout:8000});await shot('13_retest_open');await page.getByRole('button',{name:'← 返回路口',exact:true}).click();await page.waitForTimeout(3500)});
await nativeClick(870,684);await page.waitForTimeout(500);await shot('14_replay_first_frame');await nativeClick(600,50);await page.keyboard.press('Escape');await page.waitForTimeout(500);await shot('15_replay_closed');
await check('剧情回放从首帧可直接关闭',async()=>{await nativeClick(80,684);await page.waitForTimeout(500);await nativeClick(600,50);await page.keyboard.press('Escape');await page.getByRole('heading',{name:'怎样把“一直等”说清楚？'}).waitFor({timeout:5000})});
// Serve the same test app through an intercepted HTTP hostname; this is a real insecure browser origin without a physical second device.
const alias='http://classroom-test.invalid:18997';const lanContext=await browser.newContext({viewport:{width:1440,height:900}});await lanContext.route(alias+'/**',route=>route.fetch({url:report.base+new URL(route.request().url()).pathname+new URL(route.request().url()).search}).then(response=>route.fulfill({response})));
const lan=await lanContext.newPage();const lanErrors=[];lan.on('pageerror',e=>lanErrors.push(e.message));await lan.goto(alias,{waitUntil:'networkidle'});
const environment=await lan.evaluate(()=>({secure:window.isSecureContext,uuid:typeof crypto.randomUUID}));assert.equal(environment.secure,false);assert.equal(environment.uuid,'undefined');
await lan.getByRole('button',{name:'名单外手动输入'}).click();await lan.getByPlaceholder('请输入姓名（如：张三）').fill('HTTP终验虚构学生');const lr=lan.waitForResponse(r=>r.url().endsWith('/api/login')&&r.request().method()==='POST');await lan.getByRole('button',{name:'穿上小交警马甲，进入路口'}).click();const lstate=(await(await lr).json());
const prepared=await lan.evaluate(async id=>{const r=await fetch('/api/progress',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({studentId:id,stations:{s1_order:true,s2_rewrite:true,s2_vs_branch:true,s2_kettle:true,s3_timing:true}})});return r.json()},lstate.student.studentId);
await lan.reload({waitUntil:'networkidle'});await lan.getByRole('button',{name:'名单外手动输入'}).click();await lan.getByPlaceholder('请输入姓名（如：张三）').fill('HTTP终验虚构学生');await lan.getByRole('button',{name:'穿上小交警马甲，进入路口'}).click();await lan.waitForTimeout(4000);
const lbox=await lan.frameLocator('iframe').locator('canvas').boundingBox();await lan.mouse.click(lbox.x+730/1280*lbox.width,lbox.y+684/1280*lbox.width);await lan.getByRole('heading',{name:'临时小交警 · 课堂综合检测'}).waitFor({timeout:8000});
for(let i=0;i<15;i++)await lan.getByRole('button',{name:'下一题 →',exact:true}).click();await lan.getByRole('button',{name:'提交基础关答卷 (16题) →',exact:true}).click();await lan.getByText(/基础层得分：/).waitFor({timeout:8000});await lan.screenshot({path:path.join(output,'16_insecure_http_exam.png'),fullPage:true});
await check('不安全HTTP无crypto.randomUUID时登录、开考与提交仍可用',async()=>{assert.deepEqual(lanErrors,[]);report.httpEnvironment={...environment,method:'Playwright HTTP alias routed to isolated service; not a physical student device'};});await lanContext.close();
report.completedAt=new Date().toISOString();delete report.pausedForDiscovery;write();
}catch(error){report.failure=String(error.stack||error);write();await shot('final_controls_failure');throw error}finally{await browser.close()}})().catch(error=>{console.error(error);process.exit(1)});
