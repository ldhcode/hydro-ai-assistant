/**
 * AI 助手路由处理器
 * 提供三个核心功能：解题思路、代码查错、智能答疑
 */
import { Handler, param, Types } from 'hydrooj';
import {
    callLLM, checkRateLimit, checkDailyLimit,
    SOLVE_SYSTEM_PROMPT, DEBUG_SYSTEM_PROMPT, QA_SYSTEM_PROMPT,
    type LLMConfig,
} from './llm_client';

// ============================
// AI 解题助手处理器
// ============================
class AiSolveHandler extends Handler {
    @param('pid', Types.String, true)
    @param('mode', Types.String, true)  // 'idea' | 'detailed'
    async post(domainId: string, pid: string, mode: string) {
        // 速率限制检查
        const ip = this.request.ip || '0.0.0.0';
        if (!checkRateLimit(ip)) {
            this.response.body = { success: false, error: '请求过于频繁，请稍后再试' };
            return;
        }

        // 每日限制检查
        const uid = (this.user as any)?._id || ip;
        if (!checkDailyLimit(String(uid))) {
            this.response.body = { success: false, error: '今日 AI 请求次数已达上限' };
            return;
        }

        // 获取系统设置
        const system = (this.ctx as any).model.system;
        const endpoint = system.get('ai-assistant.endpoint') ||
            process.env.AI_ENDPOINT || 'https://api.openai.com/v1/chat/completions';
        const apiKey = system.get('ai-assistant.apiKey') ||
            process.env.AI_API_KEY || '';
        const model = system.get('ai-assistant.model') ||
            process.env.AI_MODEL || 'gpt-4o-mini';

        if (!apiKey) {
            this.response.body = { success: false, error: 'AI 服务未配置，请联系管理员' };
            return;
        }

        // 获取题目信息
        const pdoc = await (this.ctx as any).db.get('problem', domainId, pid);
        if (!pdoc) {
            this.response.body = { success: false, error: '题目不存在' };
            return;
        }

        // 构建 LLM 配置
        const llmConfig: LLMConfig = {
            endpoint,
            apiKey,
            model,
            maxTokens: mode === 'detailed' ? 4096 : 2048,
            temperature: 0.7,
            timeout: 120000,
        };

        // 构建消息
        const userPrompt = buildProblemPrompt(pdoc, mode);
        const messages = [
            { role: 'system' as const, content: SOLVE_SYSTEM_PROMPT },
            { role: 'user' as const, content: userPrompt },
        ];

        const result = await callLLM(llmConfig, messages);

        this.response.body = result;
    }
}

// ============================
// AI 代码查错处理器
// ============================
class AiDebugHandler extends Handler {
    @param('rid', Types.String, true)
    async post(domainId: string, rid: string) {
        const ip = this.request.ip || '0.0.0.0';
        if (!checkRateLimit(ip)) {
            this.response.body = { success: false, error: '请求过于频繁，请稍后再试' };
            return;
        }

        const uid = (this.user as any)?._id || ip;
        if (!checkDailyLimit(String(uid))) {
            this.response.body = { success: false, error: '今日 AI 请求次数已达上限' };
            return;
        }

        const system = (this.ctx as any).model.system;
        const endpoint = system.get('ai-assistant.endpoint') ||
            process.env.AI_ENDPOINT || 'https://api.openai.com/v1/chat/completions';
        const apiKey = system.get('ai-assistant.apiKey') ||
            process.env.AI_API_KEY || '';
        const model = system.get('ai-assistant.model') ||
            process.env.AI_MODEL || 'gpt-4o-mini';

        if (!apiKey) {
            this.response.body = { success: false, error: 'AI 服务未配置，请联系管理员' };
            return;
        }

        // 获取评测记录
        const rdoc = await (this.ctx as any).db.get('record', domainId, rid);
        if (!rdoc) {
            this.response.body = { success: false, error: '评测记录不存在' };
            return;
        }

        // 权限检查：只能查自己的代码
        if (String(rdoc.uid) !== String((this.user as any)._id) && !(this.user as any).hasPerm('PERM_VIEW_CODE')) {
            this.response.body = { success: false, error: '无权查看此代码' };
            return;
        }

        // 获取题目信息
        const pdoc = await (this.ctx as any).db.get('problem', domainId, String(rdoc.pid));
        if (!pdoc) {
            this.response.body = { success: false, error: '题目不存在' };
            return;
        }

        const llmConfig: LLMConfig = {
            endpoint,
            apiKey,
            model,
            maxTokens: 3072,
            temperature: 0.5,
            timeout: 120000,
        };

        const userPrompt = buildDebugPrompt(pdoc, rdoc);
        const messages = [
            { role: 'system' as const, content: DEBUG_SYSTEM_PROMPT },
            { role: 'user' as const, content: userPrompt },
        ];

        const result = await callLLM(llmConfig, messages);
        this.response.body = result;
    }
}

// ============================
// AI 智能答疑处理器
// ============================
class AiQaHandler extends Handler {
    @param('pid', Types.String, true)
    @param('question', Types.String, true)
    async post(domainId: string, pid: string, question: string) {
        const ip = this.request.ip || '0.0.0.0';
        if (!checkRateLimit(ip)) {
            this.response.body = { success: false, error: '请求过于频繁，请稍后再试' };
            return;
        }

        const uid = (this.user as any)?._id || ip;
        if (!checkDailyLimit(String(uid))) {
            this.response.body = { success: false, error: '今日 AI 请求次数已达上限' };
            return;
        }

        const system = (this.ctx as any).model.system;
        const endpoint = system.get('ai-assistant.endpoint') ||
            process.env.AI_ENDPOINT || 'https://api.openai.com/v1/chat/completions';
        const apiKey = system.get('ai-assistant.apiKey') ||
            process.env.AI_API_KEY || '';
        const model = system.get('ai-assistant.model') ||
            process.env.AI_MODEL || 'gpt-4o-mini';

        if (!apiKey) {
            this.response.body = { success: false, error: 'AI 服务未配置，请联系管理员' };
            return;
        }

        const pdoc = await (this.ctx as any).db.get('problem', domainId, pid);
        if (!pdoc) {
            this.response.body = { success: false, error: '题目不存在' };
            return;
        }

        const llmConfig: LLMConfig = {
            endpoint,
            apiKey,
            model,
            maxTokens: 3072,
            temperature: 0.7,
            timeout: 120000,
        };

        const userPrompt = buildQaPrompt(pdoc, question);
        const messages = [
            { role: 'system' as const, content: QA_SYSTEM_PROMPT },
            { role: 'user' as const, content: userPrompt },
        ];

        const result = await callLLM(llmConfig, messages);
        this.response.body = result;
    }
}

// ============================
// 静态资源处理器
// 匹配 /ai-assistant/static/:file
// ============================
class AiStaticHandler extends Handler {
    async get(file: string) {
        const fs = await import('fs');
        const path = await import('path');

        // 安全检查：防止路径穿越
        const safeFile = path.basename(file || 'ai-assistant.js');
        const filePath = path.join(__dirname, 'static', safeFile);

        if (!fs.existsSync(filePath)) {
            this.response.status = 404;
            this.response.body = 'Not Found';
            return;
        }

        const ext = path.extname(safeFile).toLowerCase();
        const mime: Record<string, string> = {
            '.js': 'application/javascript; charset=utf-8',
            '.css': 'text/css; charset=utf-8',
            '.html': 'text/html; charset=utf-8',
            '.json': 'application/json',
            '.png': 'image/png',
            '.svg': 'image/svg+xml',
        };

        this.response.type = mime[ext] || 'application/octet-stream';
        this.response.body = fs.readFileSync(filePath, 'utf-8');
    }
}

// ============================
// 辅助函数
// ============================

function buildProblemPrompt(pdoc: any, mode: string): string {
    const parts: string[] = [];
    parts.push(`题目：${pdoc.title || '未知'}`);
    if (pdoc.content) {
        // 去除 HTML 标签，提取纯文本
        let text = pdoc.content.replace(/<[^>]+>/g, '');
        text = text.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&').replace(/&quot;/g, '"');
        parts.push(`题目描述：${text.slice(0, 3000)}`);
    }
    if (pdoc.tag && pdoc.tag.length) {
        parts.push(`题目标签：${pdoc.tag.join('、')}`);
    }
    if (mode === 'detailed') {
        parts.push('\n请提供详细的题解，包括完整的解题思路、关键算法讲解和复杂度分析。');
    } else {
        parts.push('\n请简要分析题目并给出核心解题思路，不要直接给出完整代码。');
    }
    return parts.join('\n\n');
}

function buildDebugPrompt(pdoc: any, rdoc: any): string {
    const parts: string[] = [];
    parts.push(`题目：${pdoc.title || '未知'}`);
    if (pdoc.content) {
        let text = pdoc.content.replace(/<[^>]+>/g, '');
        text = text.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&').replace(/&quot;/g, '"');
        parts.push(`题目描述：${text.slice(0, 2000)}`);
    }
    parts.push(`编程语言：${rdoc.lang || '未知'}`);
    parts.push(`评测状态：${getStatusText(rdoc.status)}`);
    if (rdoc.score !== undefined) {
        parts.push(`得分：${rdoc.score}`);
    }
    if (rdoc.time) parts.push(`运行时间：${rdoc.time}ms`);
    if (rdoc.memory) parts.push(`内存消耗：${rdoc.memory}KB`);

    // 测试点详情
    if (rdoc.cases && rdoc.cases.length) {
        const testCases = rdoc.cases.slice(0, 5);
        const caseInfo = testCases.map((c: any, i: number) =>
            `测试点${i + 1}: ${getStatusText(c.status)} | 时间:${c.time}ms | 内存:${c.memory}KB`
        ).join('\n');
        parts.push(`测试点结果：\n${caseInfo}`);
    }

    // 错误信息
    if (rdoc.compilerText) {
        parts.push(`编译信息：${rdoc.compilerText.slice(0, 500)}`);
    }

    // 用户代码
    if (rdoc.code) {
        parts.push(`\n用户代码：\n\`\`\`${rdoc.lang || ''}\n${rdoc.code.slice(0, 8000)}\n\`\`\``);
    }

    parts.push('\n请分析代码中的问题并给出修改建议。');
    return parts.join('\n\n');
}

function buildQaPrompt(pdoc: any, question: string): string {
    const parts: string[] = [];
    parts.push(`题目：${pdoc.title || '未知'}`);
    if (pdoc.content) {
        let text = pdoc.content.replace(/<[^>]+>/g, '');
        text = text.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&').replace(/&quot;/g, '"');
        parts.push(`题目描述：${text.slice(0, 2000)}`);
    }
    parts.push(`\n用户提问：${question}`);
    return parts.join('\n\n');
}

function getStatusText(status: number): string {
    const statusMap: Record<number, string> = {
        0: 'Waiting',
        1: 'Accepted',
        2: 'Wrong Answer',
        3: 'Time Limit Exceeded',
        4: 'Memory Limit Exceeded',
        5: 'Output Limit Exceeded',
        6: 'Runtime Error',
        7: 'Compile Error',
        8: 'System Error',
        9: 'Canceled',
        10: 'Unknown Error',
        11: 'Ignored',
    };
    return statusMap[status] || `Status(${status})`;
}

export { AiSolveHandler, AiDebugHandler, AiQaHandler, AiStaticHandler };
