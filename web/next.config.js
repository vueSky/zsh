module.exports = {
  reactStrictMode: true,
  // 允许局域网设备（手机/平板）在 dev 模式下访问 _next/* 资源
  // Next 14 的 matchWildcardDomain 仅对最后两段之外的部分支持 *，
  // 因此 IP 通配符（如 192.168.*.*）无效，必须填写精确 IP。
  allowedDevOrigins: [
    // LAN 设备 IP（精确匹配，IP 通配符在 Next.js 14 中不生效）
    "192.168.0.43",
    "192.168.1.8",
    // mDNS 主机名（*.local 通配符有效）
    "*.local",
    // 公网穿透
    "*.trycloudflare.com",
    "*.lf.edu.kg",
  ],
};