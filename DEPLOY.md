# Linux 服务器部署

以下方案适用于 Ubuntu 24.04、Node.js 24、Nginx 和 HTTPS 域名。

## 1. 准备项目

将整个项目上传到服务器，例如：

```text
/opt/phone-profile-system
```

在项目目录执行：

```bash
npm ci
npm run build
```

创建 `.env`：

```dotenv
PORT=5173
HOST=127.0.0.1
ADMIN_PASSWORD_1=替换为第一个至少16位的随机密码
ADMIN_PASSWORD_2=替换为第二个至少16位的随机密码
ADMIN_PASSWORD_3=替换为第三个至少16位的随机密码
ADMIN_PASSWORD_4=替换为第四个至少16位的随机密码
ADMIN_PASSWORD_5=替换为第五个至少16位的随机密码
PUBLIC_BASE_URL=https://number.example.com
DATA_FILE=/var/lib/phone-profile-system/links.json
```

创建持久化目录并赋予运行账户写权限：

```bash
sudo mkdir -p /var/lib/phone-profile-system
sudo chown -R www-data:www-data /var/lib/phone-profile-system
```

## 2. systemd 服务

创建 `/etc/systemd/system/phone-profile-system.service`：

```ini
[Unit]
Description=Phone Profile Link System
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/phone-profile-system
ExecStart=/usr/bin/node server.mjs --production
Restart=always
RestartSec=3
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

启动：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now phone-profile-system
sudo systemctl status phone-profile-system
```

## 3. Nginx 反向代理

站点配置：

```nginx
server {
    listen 80;
    server_name number.example.com;

    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

启用站点后使用 Certbot 配置 HTTPS。PWA、Service Worker 和安全会话在正式公网使用时都应通过 HTTPS 提供。

## 4. 上线检查

- `/api/health` 返回 `{"ok":true,"version":"1.0.0"}`
- 未登录访问 `/api/admin/links` 返回 401
- 管理端密码可以登录，错误密码无法登录
- 创建链接后完整号码为 11 位且后四位正确
- 手机扫码可访问，访问次数增加
- 停用链接或到期后手机端返回失效页面
- Safari/Chrome 可以添加到主屏幕
- 已备份 `/var/lib/phone-profile-system/links.json`
