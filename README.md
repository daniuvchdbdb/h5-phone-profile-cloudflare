# 号码链接管理系统

面向手机端的固定尾号展示与分发系统。管理端通过密码登录，可指定手机号后四位、批量生成独立链接、设置精确失效时间并管理链接状态；用户扫码后直接进入仿 iOS 设置页面，添加到桌面后仍然进入同一条固定链接。

## 已实现功能

### 独立管理端

- 5 个独立管理密码、并发登录互不顶号、HttpOnly 会话 Cookie、登录频率限制
- 指定手机号后四位，前 7 位随机生成合法格式的 11 位号码
- 单批生成 1–50 条互相独立的分发链接
- 精确设置每批链接的失效日期和时间
- 修改已有链接的失效时间
- 提前停用、重新启用未到期链接
- 编辑备注、复制、保存修改及永久删除
- 手机管理端以卡片显示尾号和实时剩余分钟
- 有效、到期、停用状态统计
- 访问次数和最近访问时间持久化
- 二维码预览、下载、复制链接
- 批量复制和 CSV 分发包导出

### 手机端

- 链接路径包含指定后四位，同时带不可猜测随机码
- 完整号码、尾号和有效期全部由服务器返回，无法通过改网址篡改
- 过期、停用和无效链接分别显示明确状态
- 扫码校验通过后直接显示仿 iOS“设置”首页，不再设置安装拦截页
- 设置列表中只有“蜂窝网络”可进入，其他模块只展示外观且点击无反应
- 号码页完整显示后台生成并固定保存的 11 位号码
- 每条手机号链接自动生成并永久绑定一个不同的中文用户名，历史链接启动时自动补齐用户名
- 页面底部提供“添加到主屏幕”入口，iOS 显示 Safari 操作说明，Android 优先调用原生安装提示
- 桌面书签使用苹果“设置”灰色齿轮图标，标题为“设置”
- 添加到主屏幕后以独立窗口启动，并固定进入原链接
- 固定浅色 iOS 风格、手机安全区域适配，电脑端居中显示手机画布
- Service Worker 缓存页面资源，但号码状态 API 始终向服务器实时校验

## 本地启动

安装依赖：

```powershell
cd LOCAL_PROJECT_PATH
npm install
```

开发运行：

```powershell
npm run dev
```

开发环境提供五个临时密码 `demo1001`、`demo1002`、`demo1003`、`demo1004`、`demo1005`，仅用于本机开发；五个密码可以同时登录。访问：

- 管理端：`http://localhost:5173/admin.html`
- 手机端：必须先在管理端生成链接

要让同一 Wi-Fi 下的手机扫码，请在电脑浏览器中通过终端显示的局域网地址进入管理端，例如：

```text
http://192.168.x.x:5173/admin.html
```

这样生成的二维码才会包含手机可访问的局域网 IP，而不是 `localhost`。

## 生产运行

复制 `.env.example` 为 `.env`，至少设置：

```dotenv
ADMIN_PASSWORD_1=第一个足够长且唯一的管理密码
ADMIN_PASSWORD_2=第二个足够长且唯一的管理密码
ADMIN_PASSWORD_3=第三个足够长且唯一的管理密码
ADMIN_PASSWORD_4=第四个足够长且唯一的管理密码
ADMIN_PASSWORD_5=第五个足够长且唯一的管理密码
PUBLIC_BASE_URL=https://实际域名
```

然后执行：

```powershell
npm run build
npm start
```

正式模式没有配置完整的五个管理密码时会拒绝启动，防止管理后台以开发密码上线。完整服务器部署步骤见 [DEPLOY.md](./DEPLOY.md)。

## 数据与备份

数据默认保存在 `data/links.json`。服务器使用临时文件加原子替换保存，适合单台服务器部署。备份时复制此文件即可；恢复时先停止服务，再将备份文件放回原位置。

可通过 `DATA_FILE` 环境变量把数据文件放到服务器专用持久化目录。

## 平台限制

- iPhone Safari 不允许普通网页自动强制全屏，也不允许网页静默创建桌面图标。
- 用户首次需要在 Safari 分享菜单中确认“添加到主屏幕”；之后从桌面打开会以独立窗口显示。
- Android 浏览器支持时可以直接触发“安装应用”，不支持时显示标准手动添加步骤。
- 页面是网页号码展示，不会读取或修改手机真实 SIM、本机号码或系统设置。


## Portfolio scope

This is a self-initiated, AI-assisted learning/demo project, not a claim of commercial employment or production deployment. Private databases, credentials, local browser profiles, customer records and generated build output are excluded. Configure your own services and use synthetic data. Payment/provider integrations and deployment require independent review before production use. No new full end-to-end validation is claimed by this publication.
