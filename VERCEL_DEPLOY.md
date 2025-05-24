# Vercel 部署指南

本项目已经配置好可以部署到 Vercel 平台。

## 部署步骤

### 1. 准备工作
确保你有一个 GitHub 账号，并且项目代码已经推送到 GitHub 仓库。

### 2. 注册 Vercel 账号
1. 访问 [vercel.com](https://vercel.com)
2. 使用 GitHub 账号登录

### 3. 导入项目
1. 在 Vercel 控制台中点击 "New Project"
2. 选择你的 GitHub 仓库
3. 导入项目

### 4. 部署配置
Vercel 会自动检测项目结构：
- 检测到 `api/` 文件夹，自动配置为 Serverless Functions
- 检测到 `package.json`，自动安装 Node.js 依赖
- 其他 HTML/CSS/JS 文件作为静态资源部署

**注意**: 已移除 `vercel.json` 配置文件，使用 Vercel 的自动检测功能。

### 5. 部署
点击 "Deploy" 按钮开始部署。

## 项目结构说明

```txt
GDIC-RouteMap/
├── index.html              # 前端页面（静态文件）
├── api/                    # Vercel Serverless 函数
│   └── index.js           # API 路由处理
├── package.json           # 依赖配置
├── test-*.html            # 测试页面
└── proxy-status.html      # 状态检查页面
```

## 环境差异

### 本地开发
- API 请求会发送到 `http://localhost:3001`
- 需要运行 `server.js` 作为代理服务器

### Vercel 生产环境
- API 请求会发送到相对路径 `/api/*`
- 使用 Serverless 函数处理 API 请求
- 自动检测环境并切换 API 基础 URL

## 功能说明

### API 端点
- `/api/test` - 健康检查
- `/api/station-codes` - 获取车站代码
- `/api/query-trains` - 查询列车信息
- `/api/train-details` - 获取列车详细信息

### 前端页面
- `index.html` - 主要的列车出发板页面
- `proxy-status.html` - API 状态检查页面
- `test-*.html` - 各种测试页面

## 注意事项

1. **CORS 处理**: Vercel 环境中的 API 函数已经配置了 CORS，可以跨域访问
2. **超时设置**: API 函数超时时间设置为 30 秒
3. **环境检测**: 前端代码会自动检测是否在本地环境，并切换相应的 API 基础 URL
4. **12306 API**: 由于 12306 网站的访问限制，部分功能可能在生产环境中不稳定

## 调试和测试

### 测试API端点
部署后，你可以通过以下URL测试API：

- **基础测试**: `https://your-project.vercel.app/api/test`
- **简单测试**: `https://your-project.vercel.app/api/test.js` (独立测试文件)
- **车站代码**: `https://your-project.vercel.app/api/station-codes`
- **列车查询**: `https://your-project.vercel.app/api/query-trains?from_station=PYA&to_station=GCA&train_date=2025-05-25`

### 查看日志
1. 登录Vercel控制台
2. 选择你的项目
3. 点击"Functions"选项卡
4. 查看函数执行日志

### 常见问题排查

#### 1. 404错误
- 检查API路径是否正确
- Vercel中API路径不包含`/api`前缀
- 路径格式：`/api/endpoint` → Serverless函数中处理为 `/endpoint`

#### 2. CORS错误
- API函数已配置CORS头
- 检查浏览器网络选项卡确认预检请求

#### 3. 12306接口访问失败
- 12306可能限制服务器IP访问
- 系统会自动回退到模拟数据

## 常见问题

### Q: 部署后 API 调用失败
A: 
1. 检查 Vercel 函数日志
2. 12306 网站可能对服务器 IP 有访问限制
3. 系统会自动回退到模拟数据

### Q: 本地开发环境设置
A:
1. 运行 `npm install` 安装依赖
2. 运行 `node server.js` 启动本地代理服务器
3. 在浏览器中打开 `index.html`

### Q: 如何更新部署
A:
1. 推送代码到 GitHub
2. Vercel 会自动重新部署

## 技术栈
- **前端**: HTML5, CSS3, JavaScript (ES6+)
- **后端**: Vercel Serverless Functions (Node.js)
- **部署**: Vercel Platform
- **API**: 12306 官方接口（通过代理访问）
