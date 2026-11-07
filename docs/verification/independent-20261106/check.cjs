'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const output=__dirname;
const report={startedAt:new Date().toISOString(),base:process.env.TEST_BASE_URL||'http://127.0.0.1:18997',checks:[],pageErrors:[],notes:[]};
const write=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
(async()=>{
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1440,height:900}});
const page=await context.newPage();page.on('pageerror',e=>{report.pageErrors.push(e.message);write()});
const shot=async(name)=>page.screenshot({path:path.join(output,name+'.png'),fullPage:true});
const check=async(name,fn)=>{await fn();report.checks.push({name,passed:true});write();console.log('PASS',name)};
const nativeClick=async(x,y)=>{const box=await page.frameLocator('iframe').locator('canvas').boundingBox();await page.mouse.click(box.x+x/1280*box.width,box.y+y/1280*box.width);await page.waitForTimeout(250)};
const login=async()=>{await page.getByRole('button',{name:'名单外手动输入'}).click();await page.getByPlaceholder('请输入姓名（如：张三）').fill('终验虚构学生_'+report.startedAt.slice(11,19).replaceAll(':',''));const response=page.waitForResponse(r=>r.url().endsWith('/api/login')&&r.request().method()==='POST');await page.getByRole('button',{name:'穿上小交警马甲，进入路口'}).click();const result=await(await response).json();report.studentId=result.student.studentId;await page.waitForTimeout(3500);return result};
const state=async()=>{const res=await page.request.get(report.base+'/api/state?studentId='+encodeURIComponent(report.studentId));return(await res.json()).state};
const until=async(fn,timeout=15000)=>{const start=Date.now();while(Date.now()-start<timeout){if(await fn())return;await page.waitForTimeout(150)}throw Error('timed out waiting for state')};
const pending=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('g5l7.pendingEvidence.v1')||'[]'));
const runButton=()=>page.getByRole('button',{name:'运行',exact:true});
const chooseS1=async()=>{await page.getByRole('button',{name:'绿灯未亮起？',exact:true}).click();await page.getByRole('button',{name:'连接是的箭头'}).click();await page.locator('[data-node-id="observe"]').click();await page.getByRole('button',{name:'连接否的箭头'}).click();await page.locator('[data-node-id="cross"]').click()};
try{
await page.goto(report.base,{waitUntil:'networkidle'});await login();
await check('原剧情图加载且开场可逐句完成',async()=>{await shot('01_intro');for(let i=0;i<6;i++)await nativeClick(245,482);await until(async()=>(await state()).evidenceHistory.some(e=>e.taskId==='intro'));await shot('02_hub')});
await nativeClick(80,684);await page.waitForTimeout(700);await nativeClick(600,50);await page.keyboard.press('Escape');await page.getByRole('heading',{name:'怎样把“一直等”说清楚？'}).waitFor();
await chooseS1();
let failedRequests=0;await page.route('**/api/evidence',route=>{failedRequests++;return route.abort('connectionrefused')});
await runButton().click();await page.getByText('这个情形已运行。换另一种灯色情形试试。',{exact:true}).waitFor({timeout:20000});
await check('服务不可达但浏览器在线时自动重试并本机暂存',async()=>{assert.equal(await page.evaluate(()=>navigator.onLine),true);await until(()=>failedRequests>=2,7000);assert.ok((await pending()).length>0);report.offlineRequests=failedRequests;await shot('03_offline_pending')});
const pendingIds=(await pending()).map(e=>e.evidence.eventId);
await page.reload({waitUntil:'networkidle'});await login();
await check('刷新后待传记录保留且不强制重看已完成开场',async()=>{assert.ok((await pending()).some(e=>pendingIds.includes(e.evidence.eventId)));await shot('04_refresh_hub');await nativeClick(80,684);await page.waitForTimeout(600);await nativeClick(600,50);await page.keyboard.press('Escape');await page.getByRole('heading',{name:'怎样把“一直等”说清楚？'}).waitFor({timeout:4000})});
await page.unroute('**/api/evidence');
await check('服务恢复后补传且不重复保存',async()=>{await until(async()=>(await pending()).length===0,10000);const saved=await state();for(const id of pendingIds)assert.equal(saved.evidenceHistory.filter(e=>e.eventId===id).length,1)});
await chooseS1();await runButton().click();await page.getByText('这个情形已运行。换另一种灯色情形试试。',{exact:true}).waitFor({timeout:20000});await page.getByRole('button',{name:'先红灯，后来变绿'}).click();await runButton().click();await page.getByRole('button',{name:'完成引导台'}).waitFor({timeout:25000});await shot('05_s1_both');await page.getByRole('button',{name:'完成引导台'}).click();await page.waitForTimeout(700);await nativeClick(600,50);await page.keyboard.press('Escape');await page.waitForTimeout(700);await shot('06_s2_learn');
report.pausedForDiscovery=true;write();
} catch(error){report.failure=String(error.stack||error);write();await shot('failure');throw error}
finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
