# Hydro AI 题解答疑助手

[![Hydro](https://img.shields.io/badge/Hydro-Plugin-blue)](https://hydro.js.org)
[![License](https://img.shields.io/badge/License-AGPL--3.0-green)](LICENSE)

Hydro 插件，接入大语言模型（LLM）为题目解答提供 AI 辅助功能。

## 功能特性

### 🎯 三大核心功能

| 功能 | 触发位置 | 说明 |
|------|---------|------|
| **AI 解题** | 题目详情页 | 分析题目并提供解题思路、算法讲解、复杂度分析 |
| **AI 查错** | 评测记录详情页 | 分析用户代码中的错误，定位 bug 并给出修改建议 |
| **AI 答疑** | 题目详情页（对话模式） | 回答用户对题目的任何疑问，支持多轮对话 |

### 🛡️ 安全与限制

- **速率限制**：每 IP 每分钟最多 10 次请求（可配置）
- **每日配额**：每用户每天最多 50 次请求（可配置）
- **权限控制**：用户只能查自己的代码
- **多模型支持**：OpenAI / DeepSeek / 阿里百炼 / 智谱 GLM 等所有 OpenAI 兼容 API

### 🎨 界面预览

- **题目页**：侧边栏多出"AI 助手"菜单项 + 页面顶部蓝色横幅提示
- **评测记录页**：自动显示"AI 查错"按钮（非 AC 时黄色提示，AC 时为绿色）
- **对话面板**：右侧滑出面板，支持 Markdown 渲染、代码高亮

## 快速安装

### 前置要求

- Hydro 5.0+ 已部署并正常运行
- Node.js >= 22

### 步骤 1：安装插件

```bash
# 进入 Hydro 插件目录
cd /opt/hydro-plugins

# 克隆插件
git clone <your-repo-url> hydro-ai-assistant
cd hydro-ai-assistant

# 安装依赖
npm install

# 注册插件到 Hydro
hydrooj addon add /opt/hydro-plugins/hydro-ai-assistant
```

### 步骤 2：注入模板

```bash
# 自动注入 AI 按钮到 Hydro 默认模板
node install.js

# 如果自动查找失败，手动指定 ui-default 路径：
node install.js install /opt/hydro/node_modules/@hydrooj/ui-default
```

### 步骤 3：配置 API

在 Hydro 管理后台 **控制面板 → 系统设置** 中找到以下配置项：

| 配置项 | 说明 | 示例值 |
|--------|------|--------|
| `ai-assistant.endpoint` | AI API 端点 | `https://api.openai.com/v1/chat/completions` |
| `ai-assistant.apiKey` | API 密钥 | `sk-xxxx` |
| `ai-assistant.model` | 模型名称 | `gpt-4o-mini` |
| `ai-assistant.enabled` | 启用/禁用插件 | `true` |

也可以通过环境变量配置：

```bash
export AI_ENDPOINT="https://api.openai.com/v1/chat/completions"
export AI_API_KEY="sk-xxxx"
export AI_MODEL="gpt-4o-mini"
```

### 步骤 4：重启服务

```bash
pm2 restart hydrooj

# 查看日志验证插件是否加载成功
pm2 logs hydrooj --lines 20 | grep ai-assistant
```

## 支持的 AI 服务

| 服务商 | endpoint 示例 | model 示例 |
|--------|--------------|-----------|
| **OpenAI** | `https://api.openai.com/v1/chat/completions` | `gpt-4o`, `gpt-4o-mini` |
| **DeepSeek** | `https://api.deepseek.com/v1/chat/completions` | `deepseek-chat` |
| **阿里百炼** | `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions` | `qwen-plus`, `qwen-max` |
| **智谱 GLM** | `https://open.bigmodel.cn/api/paas/v4/chat/completions` | `glm-4-plus` |
| **豆包 (火山)** | `https://ark.cn-beijing.volces.com/api/v3/chat/completions` | `doubao-1.5-pro-32k` |
| **硅基流动** | `https://api.siliconflow.cn/v1/chat/completions` | `deepseek-ai/DeepSeek-V3` |

> 任何兼容 OpenAI Chat Completions API 的服务均可使用。

## 卸载

```bash
# 恢复原始模板
node /opt/hydro-plugins/hydro-ai-assistant/install.js uninstall

# 移除插件
hydrooj addon remove @hydrooj/ai-assistant

# 重启
pm2 restart hydrooj

# 清理文件（可选）
rm -rf /opt/hydro-plugins/hydro-ai-assistant
```

## 项目结构

```
hydro-ai-assistant/
├── package.json          # 插件元信息
├── index.ts              # 插件入口（路由注册、钩子、设置）
├── handler.ts            # API 路由处理器
├── llm_client.ts         # LLM API 客户端 + 系统提示词
├── install.js            # 模板注入/卸载脚本
├── static/
│   ├── ai-assistant.js   # 前端交互逻辑
│   └── ai-assistant.css  # 前端样式
├── templates/
│   ├── ai_assistant_head.html
│   └── partials/
│       ├── problem_sidebar_ai.html
│       └── record_detail_ai.html
└── locale/
    └── zh.yaml           # 中英文翻译
```

## API 接口

### POST `/ai-assistant/solve`

获取 AI 解题思路。

```json
{
  "pid": "题目ID",
  "mode": "idea"   // "idea"=解题思路, "detailed"=详细题解
}
```

### POST `/ai-assistant/debug`

AI 代码查错。

```json
{
  "rid": "评测记录ID"
}
```

### POST `/ai-assistant/qa`

AI 答疑（对话模式）。

```json
{
  "pid": "题目ID",
  "question": "用户问题"
}
```

所有接口需登录后访问（携带 Cookie）。

## 开发

```bash
# 安装开发依赖
cd hydro-ai-assistant
npm install
npm install hydrooj -D

# 编写代码后同步到服务器
# 使用 pm2 restart hydrooj 热重载插件
```

## License

AGPL-3.0
