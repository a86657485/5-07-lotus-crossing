'use strict';
/**
 * 课堂服务启动器（供「启动课堂服务.bat」调用）
 * 作用：检查构建产物 → 打印局域网地址 → 启动 server.cjs 的服务
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createService } = require('./server.cjs');

const BASE = __dirname;
const PORT = Number(process.env.PORT || 8797);
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = process.env.DATA_DIR || path.join(BASE, 'runtime');

const bar = '  ' + '='.repeat(58);
const line = '  ' + '-'.repeat(58);

function fail(message) {
  console.error('');
  console.error('  [启动失败] ' + message);
  console.error('');
  process.exitCode = 1;
}

function lanAddresses() {
  const isPrivate = (ip) =>
    /^10\./.test(ip) ||
    /^192\.168\./.test(ip) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip);
  const ipv4 = Object.values(os.networkInterfaces())
    .flat()
    .filter((item) => item && (item.family === 'IPv4' || item.family === 4) && !item.internal)
    .map((item) => item.address);
  return { primary: ipv4.find(isPrivate) || ipv4[0] || '', extras: ipv4 };
}

if (!fs.existsSync(path.join(BASE, 'dist', 'index.html'))) {
  fail('未找到 dist/index.html，请先构建前端：npm install 然后 npm run build');
  return;
}

let service;
try {
  service = createService();
} catch (error) {
  fail('读取名单或初始化数据库失败：' + error.message);
  return;
}

const { primary, extras } = lanAddresses();
const others = extras.filter((ip) => ip !== primary);

service.server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    fail('端口 ' + PORT + ' 已被占用。请关闭已运行的课堂服务窗口，或换个端口后重试。');
  } else {
    fail('服务启动异常：' + error.message);
  }
  process.exit(1);
});

service.server.listen(PORT, HOST, () => {
  console.log('');
  console.log(bar);
  console.log('  五年级第7课《重复操作用循环》· 莲花山智慧路口');
  console.log(bar);
  console.log('  学生端（局域网）   ' + (primary ? 'http://' + primary + ':' + PORT : '未获取到局域网 IP'));
  console.log('  教师大屏（局域网） ' + (primary ? 'http://' + primary + ':' + PORT + '/teacher' : '-'));
  for (const ip of others) {
    console.log('  备用地址           http://' + ip + ':' + PORT);
  }
  console.log('  本机自测           http://127.0.0.1:' + PORT);
  console.log(line);
  console.log('  数据目录           ' + DATA_DIR);
  console.log('  教师大屏免密，仅对局域网开放');
  console.log(line);
  console.log('  上课期间请勿关闭本窗口；关闭窗口即停止服务。');
  console.log(bar);
  console.log('');
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    service.close().then(() => process.exit(0)).catch(() => process.exit(1));
  });
}
