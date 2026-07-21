/**
 * Hydro AI 助手 - 前端交互脚本
 * 在题目详情页和评测记录页注入 AI 助手面板
 */
(function () {
    'use strict';

    // 等待 DOM 和 Hydro 框架加载
    const MAX_RETRY = 30;
    let retryCount = 0;

    function init() {
        if (typeof window.Hydro === 'undefined') {
            if (retryCount++ < MAX_RETRY) {
                setTimeout(init, 500);
            }
            return;
        }

        const isProblemPage = window.location.pathname.includes('/p/') &&
            !window.location.pathname.includes('/submit') &&
            !window.location.pathname.includes('/solution') &&
            !window.location.pathname.includes('/edit');
        const isRecordPage = window.location.pathname.includes('/record/');

        if (isProblemPage) {
            initProblemPageAI();
        } else if (isRecordPage) {
            initRecordPageAI();
        }
    }

    // ===================== 通用 AI 面板 =====================

    function createAiPanel() {
        if (document.getElementById('ai-assistant-panel')) {
            return document.getElementById('ai-assistant-panel');
        }

        const panel = document.createElement('div');
        panel.id = 'ai-assistant-panel';
        panel.className = 'ai-assistant-panel';
        panel.innerHTML = `
            <div class="ai-panel-header">
                <span class="ai-panel-title">🤖 AI 助手</span>
                <div class="ai-panel-actions">
                    <button class="ai-btn ai-btn-sm ai-btn-clear" title="清空对话">清空</button>
                    <button class="ai-btn ai-btn-sm ai-btn-close" title="关闭">✕</button>
                </div>
            </div>
            <div class="ai-panel-body">
                <div class="ai-messages" id="ai-messages"></div>
                <div class="ai-input-area">
                    <textarea id="ai-input" class="ai-input" placeholder="输入你的问题..." rows="2"></textarea>
                    <div class="ai-input-btns">
                        <button class="ai-btn ai-btn-primary ai-btn-send" id="ai-send-btn">发送</button>
                        <button class="ai-btn ai-btn-secondary ai-btn-idea" id="ai-idea-btn">💡 解题思路</button>
                        <button class="ai-btn ai-btn-secondary ai-btn-detail" id="ai-detail-btn">📝 详细题解</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(panel);

        // 事件绑定
        panel.querySelector('.ai-btn-close')!.addEventListener('click', () => {
            panel.classList.remove('ai-panel-open');
        });

        panel.querySelector('.ai-btn-clear')!.addEventListener('click', () => {
            const msgContainer = panel.querySelector('#ai-messages')!;
            msgContainer.innerHTML = '';
        });

        panel.querySelector('#ai-send-btn')!.addEventListener('click', () => sendQaMessage(panel));
        panel.querySelector('#ai-input')!.addEventListener('keydown', (e) => {
            if ((e as KeyboardEvent).key === 'Enter' && !(e as KeyboardEvent).shiftKey) {
                e.preventDefault();
                sendQaMessage(panel);
            }
        });

        return panel;
    }

    function showAiPanel(panel: HTMLElement) {
        panel.classList.add('ai-panel-open');
        const input = panel.querySelector('#ai-input') as HTMLTextAreaElement;
        if (input) setTimeout(() => input.focus(), 300);
    }

    function addMessage(panel: HTMLElement, role: 'user' | 'assistant' | 'system', content: string) {
        const msgContainer = panel.querySelector('#ai-messages')!;
        const msg = document.createElement('div');
        msg.className = `ai-message ai-msg-${role}`;

        if (role === 'assistant' || role === 'system') {
            // 简单 Markdown 渲染
            msg.innerHTML = renderMarkdown(content);
        } else {
            msg.textContent = content;
        }
        msgContainer.appendChild(msg);
        msgContainer.scrollTop = msgContainer.scrollHeight;
        return msg;
    }

    function showLoading(panel: HTMLElement): HTMLElement {
        const msgContainer = panel.querySelector('#ai-messages')!;
        const loading = document.createElement('div');
        loading.className = 'ai-message ai-msg-assistant ai-loading';
        loading.innerHTML = '<span class="ai-dot-pulse"></span> AI 思考中...';
        msgContainer.appendChild(loading);
        msgContainer.scrollTop = msgContainer.scrollHeight;
        return loading;
    }

    function removeLoading(panel: HTMLElement, loading: HTMLElement) {
        if (loading && loading.parentNode) {
            loading.parentNode.removeChild(loading);
        }
    }

    // 简单 Markdown 渲染（支持代码块、加粗、列表）
    function renderMarkdown(text: string): string {
        // 转义 HTML
        let html = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // 代码块 (```...```)
        html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="ai-code-block"><code class="language-$1">$2</code></pre>');

        // 行内代码 (`...`)
        html = html.replace(/`([^`]+)`/g, '<code class="ai-inline-code">$1</code>');

        // 加粗 (**...**)
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

        // 标题
        html = html.replace(/^### (.+)$/gm, '<h4 class="ai-h4">$1</h4>');
        html = html.replace(/^## (.+)$/gm, '<h3 class="ai-h3">$1</h3>');
        html = html.replace(/^# (.+)$/gm, '<h2 class="ai-h2">$1</h2>');

        // 无序列表
        html = html.replace(/^- (.+)$/gm, '<li class="ai-li">$1</li>');
        html = html.replace(/((?:<li[^>]*>.*<\/li>\n?)+)/g, '<ul class="ai-ul">$1</ul>');

        // 有序列表
        html = html.replace(/^\d+\.\s(.+)$/gm, '<li class="ai-li">$1</li>');

        // 换行
        html = html.replace(/\n\n/g, '</p><p>');
        html = html.replace(/\n/g, '<br>');
        html = '<p>' + html + '</p>';

        return html;
    }

    // 发送自定义提问
    async function sendQaMessage(panel: HTMLElement) {
        const input = panel.querySelector('#ai-input') as HTMLTextAreaElement;
        const question = input.value.trim();
        if (!question) return;

        const pid = panel.getAttribute('data-pid');
        if (!pid) {
            addMessage(panel, 'system', '无法获取题目信息，请刷新页面后重试。');
            return;
        }

        input.value = '';
        addMessage(panel, 'user', question);
        const loading = showLoading(panel);

        try {
            const resp = await fetch('/ai-assistant/qa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pid, question }),
            });
            const data = await resp.json();
            removeLoading(panel, loading);

            if (data.success) {
                addMessage(panel, 'assistant', data.content);
            } else {
                addMessage(panel, 'system', '❌ ' + (data.error || '请求失败'));
            }
        } catch (err) {
            removeLoading(panel, loading);
            addMessage(panel, 'system', '❌ 网络错误，请检查连接后重试。');
        }
    }

    // 获取解题思路
    async function fetchSolveIdea(panel: HTMLElement, mode: 'idea' | 'detailed') {
        const pid = panel.getAttribute('data-pid');
        if (!pid) {
            addMessage(panel, 'system', '无法获取题目信息。');
            return;
        }

        const label = mode === 'idea' ? '解题思路' : '详细题解';
        addMessage(panel, 'user', `请提供${label}`);
        const loading = showLoading(panel);

        try {
            const resp = await fetch('/ai-assistant/solve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pid, mode }),
            });
            const data = await resp.json();
            removeLoading(panel, loading);

            if (data.success) {
                addMessage(panel, 'assistant', data.content);
            } else {
                addMessage(panel, 'system', '❌ ' + (data.error || '请求失败'));
            }
        } catch (err) {
            removeLoading(panel, loading);
            addMessage(panel, 'system', '❌ 网络错误，请检查连接后重试。');
        }
    }

    // ===================== 题目页 AI 集成 =====================

    function initProblemPageAI() {
        // 从 URL 获取 pid
        const pathParts = window.location.pathname.split('/');
        const pid = pathParts[pathParts.indexOf('p') + 1] || '';

        // 创建 AI 面板
        const panel = createAiPanel();
        panel.setAttribute('data-pid', pid);

        // 在侧边栏添加 AI 助手按钮
        const sidebarInsertPoint = document.querySelector('.section__side .menu, .section__side .problem__side-menu');
        if (sidebarInsertPoint) {
            const aiMenuItem = document.createElement('li');
            aiMenuItem.className = 'menu__item';
            aiMenuItem.innerHTML = `
                <a class="menu__link" href="javascript:;" id="ai-assist-btn">
                    <span class="icon icon-book"></span> AI 助手
                </a>
            `;
            sidebarInsertPoint.appendChild(aiMenuItem);

            aiMenuItem.querySelector('#ai-assist-btn')!.addEventListener('click', (e) => {
                e.preventDefault();
                showAiPanel(panel);
            });
        }

        // 绑定"解题思路"按钮
        const ideaBtn = panel.querySelector('#ai-idea-btn');
        if (ideaBtn) {
            ideaBtn.addEventListener('click', () => fetchSolveIdea(panel, 'idea'));
        }

        // 绑定"详细题解"按钮
        const detailBtn = panel.querySelector('#ai-detail-btn');
        if (detailBtn) {
            detailBtn.addEventListener('click', () => fetchSolveIdea(panel, 'detailed'));
        }

        // 同时也在题目内容区域上方添加一个 AI 助手入口
        const problemContent = document.querySelector('.problem-content-container, .section__body');
        if (problemContent) {
            const aiBanner = document.createElement('div');
            aiBanner.className = 'ai-banner';
            aiBanner.innerHTML = `
                <div class="ai-banner-inner">
                    <span>🤖 不会做这题？让 AI 帮你分析</span>
                    <button class="ai-btn ai-btn-primary ai-banner-btn" id="ai-banner-btn">AI 解题</button>
                </div>
            `;
            problemContent.insertBefore(aiBanner, problemContent.firstChild);

            aiBanner.querySelector('#ai-banner-btn')!.addEventListener('click', () => {
                showAiPanel(panel);
                fetchSolveIdea(panel, 'idea');
            });
        }
    }

    // ===================== 评测记录页 AI 集成 =====================

    function initRecordPageAI() {
        // 从 URL 获取 rid
        const pathParts = window.location.pathname.split('/');
        const rid = pathParts[pathParts.length - 1] || '';

        // 只在非 AC 状态时显示 AI 查错按钮
        const statusEl = document.querySelector('.record-status--text, .record-status, [class*="status"]');
        const statusText = statusEl?.textContent?.trim() || '';
        const isAccepted = statusText.includes('Accepted') || statusText.includes('通过');

        // 创建 AI 面板
        const panel = createAiPanel();
        panel.setAttribute('data-rid', rid);

        // 隐藏聊天输入区域，只保留查错相关功能
        const inputArea = panel.querySelector('.ai-input-area') as HTMLElement;
        if (inputArea) {
            inputArea.innerHTML = `
                <div class="ai-debug-buttons">
                    <button class="ai-btn ai-btn-primary ai-btn-debug" id="ai-debug-btn">🔍 AI 代码查错</button>
                    <div class="ai-debug-hint">让 AI 帮你分析代码中的问题和错误原因</div>
                </div>
            `;
        }

        // 在评测详情区域添加 AI 查错按钮
        const detailArea = document.querySelector('.record_detail, .section__body');
        if (detailArea) {
            const debugBtnContainer = document.createElement('div');
            debugBtnContainer.className = 'ai-debug-entry';
            debugBtnContainer.innerHTML = `
                <button class="ai-btn ai-btn-primary ai-btn-debug-inline" id="ai-debug-inline-btn">
                    🔍 AI 代码查错
                </button>
                <span class="ai-debug-entry-hint">${isAccepted ? '代码已 AC，但仍可让 AI 分析代码改进点' : '让 AI 帮你分析代码问题和错误原因'}</span>
            `;
            detailArea.appendChild(debugBtnContainer);

            debugBtnContainer.querySelector('#ai-debug-inline-btn')!.addEventListener('click', () => {
                showAiPanel(panel);
                fetchDebugAnalysis(panel, rid);
            });
        }

        // 面板内查错按钮
        const debugBtn = panel.querySelector('#ai-debug-btn');
        if (debugBtn) {
            debugBtn.addEventListener('click', () => fetchDebugAnalysis(panel, rid));
        }
    }

    async function fetchDebugAnalysis(panel: HTMLElement, rid: string) {
        if (!rid) {
            addMessage(panel, 'system', '无法获取评测记录信息。');
            return;
        }

        addMessage(panel, 'user', '请帮我分析这段代码的问题');
        const loading = showLoading(panel);

        try {
            const resp = await fetch('/ai-assistant/debug', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rid }),
            });
            const data = await resp.json();
            removeLoading(panel, loading);

            if (data.success) {
                addMessage(panel, 'assistant', data.content);
            } else {
                addMessage(panel, 'system', '❌ ' + (data.error || '请求失败'));
            }
        } catch (err) {
            removeLoading(panel, loading);
            addMessage(panel, 'system', '❌ 网络错误，请检查连接后重试。');
        }
    }

    // 启动
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
