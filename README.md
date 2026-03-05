# 大模型问答小程序

基于 Taro.js 的多端大模型问答小程序，支持 DeepSeek、通义千问等云端模型，预留本地模型接入能力。

## 技术栈

- Taro 3.6 + React 18 + TypeScript
- Yarn（包管理）
- Sass

## 快速开始

### 1. 安装依赖

```bash
# 方式一：使用安装脚本（推荐）
bash install.sh

# 方式二：手动安装
yarn install
```

**注意**：如果网络需要代理，请先设置代理环境变量：
```bash
export http_proxy=http://127.0.0.1:7897
export https_proxy=http://127.0.0.1:7897
yarn install
```

### 2. 配置模型 API Key

编辑 `src/config/models.config.ts`，填入你的 API Key：

```typescript
export const qwenConfig: ModelConfig = {
  apiKey: '你的千问 API Key',  // 已配置
  modelName: 'Qwen3-VL-Plus',
  enabled: true
}

export const deepseekConfig: ModelConfig = {
  apiKey: '你的 DeepSeek API Key',  // 填入后改为 enabled: true
  modelName: 'deepseek-chat',
  enabled: false
}
```

### 3. 启动开发

```bash
# H5 预览（推荐，便于调试）
yarn dev:h5

# 微信小程序
yarn dev:weapp

# 支付宝小程序
yarn dev:alipay
```

## 多端构建

```bash
# 微信小程序
yarn dev:weapp    # 开发
yarn build:weapp  # 构建

# 支付宝小程序
yarn dev:alipay
yarn build:alipay

# H5
yarn dev:h5
yarn build:h5
```

## 研报分析（需后端）

研报分析功能依赖 Node 后端（Express + SQLite），数据持久化在服务端。

```bash
cd server
cp .env.example .env   # 填入 QWEN_API_KEY
yarn install
yarn dev               # http://localhost:3000
```

小程序开发时需在微信开发者工具中勾选「不校验合法域名」，以便访问本地后端。
详细 API 文档见 `server/README.md`。

## 项目结构

```
miniApp/
├── src/                    # 前端（Taro + React）
│   ├── pages/
│   │   ├── index/          # 首页
│   │   ├── chat/           # 通用对话
│   │   ├── report/         # 研报分析
│   │   │   ├── entry/      # 导入入口
│   │   │   ├── summary/    # 一页纸摘要
│   │   │   ├── chat/       # 研报问答
│   │   │   └── list/       # 我的研报
│   │   ├── settings/       # 设置
│   │   └── history/        # 对话历史
│   ├── services/           # 业务服务
│   ├── components/         # 通用组件
│   └── providers/          # 模型提供者
├── server/                 # 后端（Express + SQLite）
│   ├── src/
│   │   ├── config/         # 配置（环境变量 + 模型注册）
│   │   ├── db/             # 数据库初始化
│   │   ├── routes/         # API 路由
│   │   ├── services/       # 业务逻辑
│   │   └── middleware/     # 中间件
│   └── data/               # SQLite 数据文件
└── config/                 # Taro 构建配置
```

## 功能特性

- ✅ 研报分析：上传 PDF / 粘贴文本 → 一页纸摘要 → 智能问答
- ✅ 数据持久化（SQLite，研报 + 聊天记录）
- ✅ 多模型支持（千问、DeepSeek，预留本地模型）
- ✅ 配置文件化管理（在 `models.config.ts` 中配置 API Key）
- ✅ 简洁优美的 UI 设计（白色主调）
- ✅ 对话历史本地缓存
- ✅ 错误重试机制
- ✅ 自定义系统提示词（`src/constants/prompts.ts`）

## 模型配置

所有模型配置在 `src/config/models.config.ts` 中：

- **千问**：已配置 API Key，可直接使用
- **DeepSeek**：填入 `apiKey` 和 `modelName`，设置 `enabled: true` 即可使用
- **本地模型**：预留接口，后续可接入 ONNX/llama.cpp 等

## 自定义提示词

编辑 `src/constants/prompts.ts` 中的 `SYSTEM_PROMPT` 来自定义 AI 的回答风格。
