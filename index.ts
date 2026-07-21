/**
 * Hydro AI 题解答疑助手插件 - 入口文件
 *
 * 功能：
 * 1. AI 解题 - 在题目详情页提供解题思路分析
 * 2. AI 查错 - 在评测记录页提供代码查错服务
 * 3. AI 答疑 - 回答用户关于题目的疑问
 *
 * 安装方式：
 * 1. cd /opt/hydro-plugins && git clone <this-repo> hydro-ai-assistant
 * 2. cd hydro-ai-assistant && npm install
 * 3. hydrooj addon add /opt/hydro-plugins/hydro-ai-assistant
 * 4. node install.js
 * 5. pm2 restart hydrooj
 *
 * 配置项（在 控制面板 → 系统设置 中）：
 * - ai-assistant.endpoint: LLM API 端点
 * - ai-assistant.apiKey: API 密钥
 * - ai-assistant.model: 使用的模型名称
 */
import type { Context } from 'hydrooj';
import {
    AiSolveHandler, AiDebugHandler, AiQaHandler, AiStaticHandler,
} from './handler';

export async function apply(ctx: Context) {
    const pluginName = 'ai-assistant';

    // 获取 Setting 和 SystemSetting API
    const { Setting, SystemSetting } = ctx.model.setting;

    // ==========================
    // 1. 注册系统设置项
    // ==========================
    SystemSetting(
        Setting(pluginName, `${pluginName}.endpoint`, '', 'text', 'AI API 端点',
            'OpenAI 兼容的 API 端点地址，用于调用大模型'),
        Setting(pluginName, `${pluginName}.apiKey`, '', 'password', 'AI API 密钥',
            '调用大模型服务的 API Key'),
        Setting(pluginName, `${pluginName}.model`, 'gpt-4o-mini', 'text', 'AI 模型名称',
            '使用的模型名称，如 gpt-4o-mini, deepseek-chat, qwen-plus'),
        Setting(pluginName, `${pluginName}.enabled`, true, 'boolean', '启用 AI 助手',
            '在题目页面和评测记录页启用 AI 助手功能'),
        Setting(pluginName, `${pluginName}.rateLimit`, 10, 'number', '速率限制(次/分钟)',
            '每个 IP 每分钟最多可调用次数'),
        Setting(pluginName, `${pluginName}.dailyLimit`, 50, 'number', '每日限制(次)',
            '每个用户每天最多可调用次数'),
    );

    // 辅助函数：读取系统设置
    const getSetting = (key: string) => ctx.model.system.get(key);

    // ==========================
    // 2. 注册路由
    // ==========================

    // AI 解题思路 API
    ctx.Route('ai_assistant_solve', '/ai-assistant/solve', AiSolveHandler);

    // AI 代码查错 API
    ctx.Route('ai_assistant_debug', '/ai-assistant/debug', AiDebugHandler);

    // AI 答疑 API
    ctx.Route('ai_assistant_qa', '/ai-assistant/qa', AiQaHandler);

    // 静态资源路由 — 使用通配符匹配所有 /ai-assistant/static/* 请求
    ctx.Route('ai_assistant_static', '/ai-assistant/static/:file', AiStaticHandler);

    // ==========================
    // 3. 钩子：在页面中注入 AI 助手变量
    // ==========================

    ctx.on('handler/after/ProblemDetail#get', (h: any) => {
        const enabled = getSetting('ai-assistant.enabled');
        if (!enabled || !h.response.body) return;

        if (typeof h.response.body === 'object') {
            h.response.body.AiAssistantEnabled = true;
        }
    });

    ctx.on('handler/after/RecordDetail#get', (h: any) => {
        const enabled = getSetting('ai-assistant.enabled');
        if (!enabled || !h.response.body) return;

        if (typeof h.response.body === 'object') {
            h.response.body.AiAssistantEnabled = true;
        }
    });

    // ==========================
    // 4. 通过钩子注入 CSS/JS 到页面 head
    // ==========================
    const injectAiAssets = (h: any) => {
        if (h.response.body && typeof h.response.body === 'object' && h.response.body.AiAssistantEnabled) {
            if (!h.response.body.UiContext) h.response.body.UiContext = {};
            const uiCtx = h.response.body.UiContext;
            if (!uiCtx.extraHead) uiCtx.extraHead = [];
            uiCtx.extraHead.push(
                '<link rel="stylesheet" href="/ai-assistant/static/ai-assistant.css">',
            );
            // JS 通过模板注入（在页面底部加载）
        }
    };

    ctx.on('handler/after/ProblemDetail#get', injectAiAssets);
    ctx.on('handler/after/RecordDetail#get', injectAiAssets);

    // ==========================
    // 5. 国际化翻译
    // ==========================
    const zh = {
        'AI_ASSIST_SOLVE': 'AI 解题',
        'AI_ASSIST_DEBUG': 'AI 查错',
        'AI_ASSIST_QA': 'AI 答疑',
        'AI_ASSIST_LOADING': 'AI 思考中...',
        'AI_ASSIST_ERROR': '请求失败，请稍后再试',
        'AI_ASSIST_PLACEHOLDER': '输入你的问题...',
        'AI_ASSIST_SEND': '发送',
        'AI_ASSIST_CLEAR': '清空对话',
        'AI_ASSIST_CLOSE': '关闭',
        'AI_ASSIST_IDEA': '解题思路',
        'AI_ASSIST_DETAILED': '详细题解',
        'AI_ASSIST_RATE_LIMIT': '请求过于频繁，请稍后再试',
        'AI_ASSIST_DAILY_LIMIT': '今日 AI 请求次数已达上限',
        'AI_ASSIST_NOT_CONFIGURED': 'AI 服务未配置，请联系管理员',
    };

    const en = {
        'AI_ASSIST_SOLVE': 'AI Solve',
        'AI_ASSIST_DEBUG': 'AI Debug',
        'AI_ASSIST_QA': 'AI Q&A',
        'AI_ASSIST_LOADING': 'AI is thinking...',
        'AI_ASSIST_ERROR': 'Request failed',
        'AI_ASSIST_PLACEHOLDER': 'Type your question...',
        'AI_ASSIST_SEND': 'Send',
        'AI_ASSIST_CLEAR': 'Clear',
        'AI_ASSIST_CLOSE': 'Close',
        'AI_ASSIST_IDEA': 'Solution Idea',
        'AI_ASSIST_DETAILED': 'Detailed Solution',
        'AI_ASSIST_RATE_LIMIT': 'Too many requests, please wait',
        'AI_ASSIST_DAILY_LIMIT': 'Daily AI request limit reached',
        'AI_ASSIST_NOT_CONFIGURED': 'AI service not configured',
    };

    // ctx.i18n.load 加载翻译
    if (ctx.i18n?.load) {
        ctx.i18n.load('zh', zh);
        ctx.i18n.load('en', en);
    }

    // 也通过全局 bus 事件注入（兼容不同版本）
    ctx.effect?.(() => {
        if (ctx.i18n?.load) {
            ctx.i18n.load('zh', zh);
            ctx.i18n.load('en', en);
        }
    });

    console.log('[ai-assistant] AI 题解答疑助手插件已加载');
}
