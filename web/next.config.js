module.exports = {
  reactStrictMode: true,
  // 允许局域网设备（手机/平板）在 dev 模式下访问 _next/* 资源
  // Next 15+ 会强制要求；14.x 已开始提示
  allowedDevOrigins: [
    "192.168.0.43",
    "192.168.*.*",
    "10.*.*.*",
    "172.16.*.*",
    "*.local",
    // 公网穿透 (cloudflared quick tunnel) 域名
    "*.trycloudflare.com",
    // 自有域名 (cloudflared named tunnel)
    "*.lf.edu.kg",
  ],
};