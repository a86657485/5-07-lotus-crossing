'use strict';
/**
 * 课堂服务启动器（供「启动课堂服务.bat」调用）
 * 作用：检查构建产物 → 打印局域网地址 → 启动 server.cjs 的服务
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createService } = require('./server.cjs');
const { startHttpsProxy } = require('./https-proxy.cjs');

const BASE = __dirname;
const PORT = Number(process.env.PORT || 8797);
const HTTPS_PORT = Number(process.env.HTTPS_PORT || 8443);
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
  // 198.18.0.0/15 是 RFC 2544 基准测试保留段，被 Clash 等代理的 TUN 网卡占用；
  // 它不属于课堂局域网，纳入会导致每次开关代理都误判"IP 变化"并重签证书。
  const isProxyTun = (ip) => /^198\.18\./.test(ip) || /^169\.254\./.test(ip);
  const ipv4 = Object.values(os.networkInterfaces())
    .flat()
    .filter((item) => item && (item.family === 'IPv4' || item.family === 4) && !item.internal)
    .map((item) => item.address);
  const usable = ipv4.filter((ip) => !isProxyTun(ip));
  return {
    primary: usable.find(isPrivate) || usable[0] || '',
    extras: usable,
    ignored: ipv4.filter(isProxyTun),
  };
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

const { primary, extras, ignored } = lanAddresses();
const others = extras.filter((ip) => ip !== primary);

service.server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    fail('端口 ' + PORT + ' 已被占用。请关闭已运行的课堂服务窗口，或换个端口后重试。');
  } else {
    fail('服务启动异常：' + error.message);
  }
  process.exit(1);
});

service.server.listen(PORT, HOST, async () => {
  let https = null;
  let httpsError = '';
  try {
    https = await startHttpsProxy({ targetPort: PORT, listenPort: HTTPS_PORT, host: HOST });
  } catch (error) {
    httpsError = error.message;
  }

  console.log('');
  console.log(bar);
  console.log('  五年级第7课《重复操作用循环》· 莲花山智慧路口');
  console.log(bar);
  console.log(
    '  学生端（推荐）    ' +
      (https && primary ? 'https://' + primary + ':' + HTTPS_PORT : httpsError ? '（HTTPS 未启动，见下方提示）' : '未获取到局域网 IP')
  );
  console.log(
    '  学生端（备用）    ' +
      (primary ? 'http://' + primary + ':' + PORT + '  （Godot 关卡不可用）' : '-')
  );
  console.log(
    '  教师大屏          ' +
      (primary ? (https ? 'https://' + primary + ':' + HTTPS_PORT + '/teacher' : 'http://' + primary + ':' + PORT + '/teacher') : '-')
  );
  for (const ip of others) {
    console.log('  备用地址          ' + (https ? 'https://' + ip + ':' + HTTPS_PORT : 'http://' + ip + ':' + PORT));
  }
  console.log('  本机自测          ' + (https ? 'https://127.0.0.1:' + HTTPS_PORT : 'http://127.0.0.1:' + PORT));
  if (ignored.length) {
    console.log('  已忽略代理网卡      ' + ignored.join(', ') + '  （代理 TUN 保留段，非课堂局域网地址）');
  }
  console.log(line);
  console.log('  数据目录          ' + DATA_DIR);
  console.log('  教师大屏免密，仅对局域网开放');
  if (https) {
    console.log('  HTTPS 证书        ' + (https.certInfo.reused ? '沿用已有自签证书' : '已按当前 IP 重新签发'));
    console.log('  首次访问会提示"证书不受信任"，点 高级 → 继续前往 即可');
    console.log('  Godot 关卡必须在 https 下打开，http 会报 Secure Context 错误');
  } else {
    console.log('  [注意] HTTPS 未启动：' + httpsError);
    console.log('         学生端进入 Godot 关卡会报 Secure Context 错误');
  }
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
