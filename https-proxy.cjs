'use strict';
/**
 * HTTPS 前置代理（为 Godot Web 导出提供安全上下文）
 *
 * 背景：Godot 4 的 Web 导出强制要求 Secure Context。
 *   http://localhost / 127.0.0.1 属安全上下文，明文 HTTP + 私有 IP 不是。
 *   因此学生机用 http://10.x.x.x:8797 打开会报
 *   "Secure Context - Check web server configuration (use HTTPS)"。
 *
 * 做法：本文件在 8443 上终止 TLS，再把请求原样转发给 127.0.0.1:8797。
 *   1. 不产生第二个服务实例，SQLite 只有一个写入方
 *   2. 保留原始 Host 头，server.cjs 的同源校验（origin.host === host）可正常通过
 *   3. 证书缺失、过期或 IP 变化时自动重签
 */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const https = require('node:https');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const BASE = __dirname;
const CERT_DIR = path.join(BASE, '.certs');
const CERT_FILE = path.join(CERT_DIR, 'cert.pem');
const KEY_FILE = path.join(CERT_DIR, 'key.pem');
const META_FILE = path.join(CERT_DIR, 'meta.json');
const CERT_DAYS = 825;
const RENEW_MARGIN_DAYS = 30;

function lanIps() {
  const isPrivate = (ip) =>
    /^10\./.test(ip) || /^192\.168\./.test(ip) || /^172\.(1[6-9]|2\d|3[01])\./.test(ip);
  const all = Object.values(os.networkInterfaces())
    .flat()
    .filter((item) => item && (item.family === 'IPv4' || item.family === 4) && !item.internal)
    .map((item) => item.address);
  return [...new Set([...all.filter(isPrivate), ...all])];
}

function findOpenssl() {
  const candidates = [
    'openssl',
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Git', 'usr', 'bin', 'openssl.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Git', 'usr', 'bin', 'openssl.exe'),
    path.join(
      process.env.LOCALAPPDATA || '',
      'Programs',
      'WorkBuddy',
      'resources',
      'vendor',
      'PortableGit',
      'usr',
      'bin',
      'openssl.exe'
    ),
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      execFileSync(candidate, ['version'], { stdio: 'ignore', timeout: 10000 });
      return candidate;
    } catch {
      /* 试下一个 */
    }
  }
  return null;
}

function certFresh(ips) {
  if (!fs.existsSync(CERT_FILE) || !fs.existsSync(KEY_FILE) || !fs.existsSync(META_FILE)) return false;
  try {
    const meta = JSON.parse(fs.readFileSync(META_FILE, 'utf8'));
    if (!Array.isArray(meta.ips) || meta.ips.join(',') !== ips.join(',')) return false;
    const ageDays = (Date.now() - Date.parse(meta.createdAt)) / 86400000;
    return Number.isFinite(ageDays) && ageDays < CERT_DAYS - RENEW_MARGIN_DAYS;
  } catch {
    return false;
  }
}

function ensureCert(ips) {
  if (certFresh(ips)) return { reused: true };
  const openssl = findOpenssl();
  if (!openssl) throw new Error('未找到 openssl，无法生成证书（可安装 Git for Windows 后重试）');

  fs.mkdirSync(CERT_DIR, { recursive: true });
  const san = ['DNS:localhost', 'IP:127.0.0.1', ...ips.map((ip) => 'IP:' + ip)].join(',');
  execFileSync(
    openssl,
    [
      'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
      '-keyout', KEY_FILE,
      '-out', CERT_FILE,
      '-days', String(CERT_DAYS),
      '-subj', '/CN=lotus-crossing-5-07',
      '-addext', 'subjectAltName=' + san,
      '-addext', 'basicConstraints=CA:FALSE',
    ],
    { cwd: CERT_DIR, stdio: 'pipe', timeout: 60000 }
  );
  fs.writeFileSync(META_FILE, JSON.stringify({ ips, createdAt: new Date().toISOString(), san }, null, 2));
  return { reused: false, san };
}

/**
 * 启动 TLS 前置代理
 * @param {{targetPort?: number, listenPort?: number, host?: string}} options
 */
function startHttpsProxy(options = {}) {
  const targetPort = Number(options.targetPort || process.env.HTTP_PORT || 8797);
  const listenPort = Number(options.listenPort || process.env.HTTPS_PORT || 8443);
  const host = options.host || '0.0.0.0';

  const ips = lanIps();
  const certInfo = ensureCert(ips);

  const server = https.createServer(
    {
      key: fs.readFileSync(KEY_FILE),
      cert: fs.readFileSync(CERT_FILE),
      minVersion: 'TLSv1.2',
    },
    (req, res) => {
      const upstream = http.request(
        {
          host: '127.0.0.1',
          port: targetPort,
          method: req.method,
          path: req.url,
          // 透传原始 Host，server.cjs 的 checkOrigin 依赖 origin.host === host
          headers: req.headers,
        },
        (upstreamRes) => {
          res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
          upstreamRes.pipe(res);
        }
      );

      upstream.on('error', (error) => {
        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
        }
        res.end('课堂服务未在 ' + targetPort + ' 端口运行：' + error.message);
      });

      req.on('aborted', () => upstream.destroy());
      req.pipe(upstream);
    }
  );

  return new Promise((resolve, reject) => {
    server.once('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        reject(new Error('端口 ' + listenPort + ' 已被占用'));
      } else {
        reject(error);
      }
    });
    server.listen(listenPort, host, () => {
      resolve({ server, port: listenPort, ips, certInfo, close: () => new Promise((r) => server.close(r)) });
    });
  });
}

module.exports = { startHttpsProxy, ensureCert, findOpenssl, lanIps, CERT_DIR };

if (require.main === module) {
  startHttpsProxy()
    .then(({ port, ips, certInfo }) => {
      console.log('HTTPS 代理已启动： https://' + (ips[0] || 'localhost') + ':' + port);
      console.log(certInfo.reused ? '沿用已有证书' : '已生成新证书（IP 或期限变化）');
    })
    .catch((error) => {
      console.error('HTTPS 代理启动失败：' + error.message);
      process.exit(1);
    });
}
