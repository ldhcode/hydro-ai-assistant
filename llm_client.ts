/**
 * LLM 客户端模块
 * 支持 OpenAI 兼容 API，可对接各类大模型服务
 * 支持: OpenAI / DeepSeek / Qwen(阿里百炼) / GLM(智谱) / 豆包 等
 */

// 速率限制：基于 IP 的滑动窗口
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(ip: string, limit: number = 10, windowMs: number = 60000): boolean {
    const now = Date.now();
    const record = rateLimitMap.get(ip);
    if (!record || now > record.resetTime) {
        rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
        return true;
    }
    if (record.count >= limit) {
        return false;
    }
    record.count++;
    return true;
}

// 每日每用户限制数
const dailyLimitMap = new Map<string, { count: number; date: string }>();

export function checkDailyLimit(uid: string, limit: number = 50): boolean {
    const today = new Date().toISOString().slice(0, 10);
    const record = dailyLimitMap.get(uid);
    if (!record || record.date !== today) {
        dailyLimitMap.set(uid, { count: 1, date: today });
        return true;
    }
    if (record.count >= limit) {
        return false;
    }
    record.count++;
    return true;
}

export interface LLMConfig {
    endpoint: string;       // API 端点，如 https://api.openai.com/v1/chat/completions
    apiKey: string;         // API Key
    model: string;          // 模型名称，如 gpt-4o, deepseek-chat, qwen-plus
    maxTokens: number;      // 最大输出 token
    temperature: number;    // 温度参数
    systemPrompt?: string;  // 自定义系统提示词
    timeout: number;         // 超时时间(ms)
}

export interface LLMResponse {
    success: boolean;
    content?: string;
    error?: string;
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}

/**
 * 调用 LLM API 获取回复
 */
export async function callLLM(
    config: LLMConfig,
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
): Promise<LLMResponse> {
    const { endpoint, apiKey, model, maxTokens, temperature, timeout } = config;

    // 合并系统提示词
    const fullMessages = [...messages];

    const body = {
        model,
        messages: fullMessages,
        max_tokens: maxTokens,
        temperature,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout || 60000);

    try {
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(body),
            signal: controller.signal as any,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            return {
                success: false,
                error: `API 请求失败 (${response.status}): ${errorText.slice(0, 200)}`,
            };
        }

        const data: any = await response.json();
        const content = data.choices?.[0]?.message?.content || '';

        return {
            success: true,
            content,
            usage: data.usage ? {
                promptTokens: data.usage.prompt_tokens || 0,
                completionTokens: data.usage.completion_tokens || 0,
                totalTokens: data.usage.total_tokens || 0,
            } : undefined,
        };
    } catch (err: any) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
            return { success: false, error: '请求超时，请稍后重试' };
        }
        return { success: false, error: `请求异常: ${err.message}` };
    }
}

/** 解题思路 system prompt */
export const SOLVE_SYSTEM_PROMPT = `你是一位专业的算法竞赛教练。用户会提供一道算法题目的描述，请你：

1. **简要分析**题目的核心考点和算法类型
2. **提供解题思路**，从分析到实现的清晰步骤
3. **给出算法复杂度**分析（时间复杂度、空间复杂度）
4. **提示常见坑点**和注意事项
5. 如果适用，给出**关键代码片段**（伪代码或具体语言）

注意：
- 不要直接给出完整可提交的代码，而是引导用户理解思路
- 使用清晰的中文回答
- 对于不同难度题目，调整解释的详细程度
- 如果题目描述不完整，基于已有信息给出合理分析`;

/** 代码查错 system prompt */
export const DEBUG_SYSTEM_PROMPT = `你是一位经验丰富的编程调试专家。用户会提供一段代码和相关的评测信息（如错误类型、测试点结果），请你：

1. **分析错误原因**，定位最可能的 bug
2. **解释为什么出错**，说明逻辑缺陷
3. **给出修改建议**，包括具体的代码修改方案
4. **提供测试建议**，帮助用户自行验证修复

注意：
- 重点关注逻辑错误而非语法错误
- 关注边界条件和特殊情况的处理
- 分析算法复杂度是否合理
- 如果用户代码逻辑正确但超时，建议优化方向
- 如果用户代码输出格式错误，指出格式问题`;

/** 通用答疑 system prompt */
export const QA_SYSTEM_PROMPT = `你是一位信息学竞赛助教。用户会就一道算法题目提出疑问，请你耐心回答：

1. 如果用户对题目本身有疑问，解释题目要求和样例
2. 如果用户对某个算法概念有疑问，用通俗语言解释
3. 如果用户对解题步骤有疑问，逐步引导理解
4. 鼓励用户独立思考，不要直接告诉答案

请使用清晰、友好的中文回答。`;
