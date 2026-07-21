/**
 * Hydro AI 助手 - 模板注入脚本
 * 
 * 用于将 AI 助手按钮注入到 Hydro 默认模板中。
 * 在插件安装后执行：node install.js
 * 
 * 工作原理：
 * - 修改 @hydrooj/ui-default 中的模板文件
 * - 在题目侧边栏添加"AI 助手"菜单项
 * - 在页面头部注入 CSS/JS 引用
 * - 在评测记录页添加"AI 查错"按钮
 */
const fs = require('fs');
const path = require('path');

// 查找 ui-default 安装路径
function findUiDefault() {
    const possiblePaths = [
        path.join(process.cwd(), 'node_modules', '@hydrooj', 'ui-default'),
        '/opt/hydro/node_modules/@hydrooj/ui-default',
        path.join(__dirname, '..', '..', 'ui-default'),
    ];

    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            return p;
        }
    }

    // 尝试全局搜索
    try {
        const { execSync } = require('child_process');
        const result = execSync('find / -path "*/node_modules/@hydrooj/ui-default" -maxdepth 5 -type d 2>/dev/null | head -1', {
            encoding: 'utf-8',
            timeout: 5000,
        }).trim();
        if (result && fs.existsSync(result)) {
            return result;
        }
    } catch (e) {
        // ignore
    }

    return null;
}

// 备份原始文件
function backupFile(filePath) {
    const backupPath = filePath + '.ai-assistant.bak';
    if (!fs.existsSync(backupPath)) {
        fs.copyFileSync(filePath, backupPath);
        console.log(`[ai-assistant] 已备份: ${path.basename(filePath)}`);
    }
}

// 向模板文件注入内容
function injectToTemplate(filePath, injectAfter, content) {
    if (!fs.existsSync(filePath)) {
        console.log(`[ai-assistant] 模板文件不存在，跳过: ${filePath}`);
        return false;
    }

    let text = fs.readFileSync(filePath, 'utf-8');

    // 检查是否已经注入
    if (text.includes('AI 助手插件注入点')) {
        console.log(`[ai-assistant] 模板已注入，跳过: ${path.basename(filePath)}`);
        return true;
    }

    backupFile(filePath);

    const injectMark = '\n    <!-- AI 助手插件注入点 -->';
    const injectedContent = injectMark + '\n' + content;

    if (text.includes(injectAfter)) {
        text = text.replace(injectAfter, injectAfter + injectedContent);
    } else {
        console.log(`[ai-assistant] 警告: 未找到注入位置标记，在文件末尾添加`);
        text += injectedContent;
    }

    fs.writeFileSync(filePath, text, 'utf-8');
    console.log(`[ai-assistant] 已注入模板: ${path.basename(filePath)}`);
    return true;
}

// 主函数
function install(uiDefaultPath) {
    console.log('[ai-assistant] 开始注入 AI 助手到 Hydro 模板...');
    console.log(`[ai-assistant] ui-default 路径: ${uiDefaultPath}`);

    // 1. 注入页面头部（CSS/JS 引入）
    const layoutHtml = path.join(uiDefaultPath, 'templates', 'layout', 'layout.html');
    const headInjection = `
    {% if AiAssistantEnabled %}
    <link rel="stylesheet" href="/ai-assistant/static/ai-assistant.css">
    <script src="/ai-assistant/static/ai-assistant.js"></script>
    {% endif %}`;

    injectToTemplate(layoutHtml, '</head>', headInjection);

    // 2. 注入题目侧边栏 AI 按钮
    const sidebarHtml = path.join(
        uiDefaultPath, 'templates', 'partials', 'problem_sidebar_normal.html'
    );

    if (fs.existsSync(sidebarHtml)) {
        const sidebarInjection = `
    {% if page_name == 'problem_detail' and AiAssistantEnabled %}
    <li class="menu__item nojs--hide">
      <a class="menu__link" href="javascript:;" id="ai-assist-sidebar-btn">
        <span class="icon icon-help"></span> {{ _('AI_ASSIST_SOLVE') }}
      </a>
    </li>
    {% endif %}`;

        injectToTemplate(sidebarHtml, '</ol>', sidebarInjection);
    }

    // 3. 注入题目页 AI Banner
    const problemDetailHtml = path.join(
        uiDefaultPath, 'templates', 'problem_detail.html'
    );

    if (fs.existsSync(problemDetailHtml)) {
        const bannerInjection = `
    {% if AiAssistantEnabled %}
    <div class="ai-banner" style="margin-bottom: 16px; padding: 12px 16px; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border: 1px solid #bfdbfe; border-radius: 10px;">
      <div class="ai-banner-inner" style="display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 13.5px; color: #1e40af;">
        <span>🤖 不会做这题？让 AI 帮你分析</span>
        <button class="ai-btn ai-btn-primary" onclick="document.getElementById('ai-assist-sidebar-btn').click()" style="flex-shrink: 0;">AI 解题</button>
      </div>
    </div>
    {% endif %}`;

        injectToTemplate(problemDetailHtml, '<div class="section__body">', bannerInjection);
    }

    // 4. 注入评测记录页 AI 查错按钮
    const recordDetailHtml = path.join(
        uiDefaultPath, 'templates', 'record_detail.html'
    );

    if (fs.existsSync(recordDetailHtml)) {
        const debugInjection = `
    {% if AiAssistantEnabled and rdoc.status != 1 %}
    <div class="ai-debug-entry" style="display: flex; align-items: center; gap: 12px; margin: 16px 0; padding: 12px 16px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px;">
      <button class="ai-btn ai-btn-primary" onclick="document.getElementById('ai-assist-sidebar-btn')?.click()">
        🔍 {{ _('AI_ASSIST_DEBUG') }}
      </button>
      <span class="ai-debug-entry-hint" style="font-size: 12.5px; color: #92400e;">让 AI 帮你分析代码问题和错误原因</span>
    </div>
    <script>
      window.AI_DEBUG_CONTEXT = {
        rid: '{{ rdoc._id }}',
        status: {{ rdoc.status }},
        lang: '{{ rdoc.lang }}'
      };
    </script>
    {% endif %}
    {% if AiAssistantEnabled and rdoc.status == 1 %}
    <div class="ai-debug-entry" style="display: flex; align-items: center; gap: 12px; margin: 16px 0; padding: 12px 16px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px;">
      <button class="ai-btn ai-btn-primary" onclick="document.getElementById('ai-assist-sidebar-btn')?.click()">
        🔍 {{ _('AI_ASSIST_DEBUG') }}
      </button>
      <span class="ai-debug-entry-hint" style="font-size: 12.5px; color: #065f46;">代码已通过，但可以让 AI 分析优化建议</span>
    </div>
    <script>
      window.AI_DEBUG_CONTEXT = {
        rid: '{{ rdoc._id }}',
        status: {{ rdoc.status }},
        lang: '{{ rdoc.lang }}'
      };
    </script>
    {% endif %}`;

        // 在 section__body 内容之前插入
        injectToTemplate(recordDetailHtml, '<div class="section__body">', debugInjection);
    }

    console.log('[ai-assistant] ✅ 模板注入完成！');
    console.log('[ai-assistant] 请执行 pm2 restart hydrooj 重启 Hydro 服务');
}

// 卸载：恢复原始模板
function uninstall(uiDefaultPath) {
    console.log('[ai-assistant] 开始恢复原始模板...');

    function restoreFile(filePath) {
        const backupPath = filePath + '.ai-assistant.bak';
        if (fs.existsSync(backupPath)) {
            fs.copyFileSync(backupPath, filePath);
            fs.unlinkSync(backupPath);
            console.log(`[ai-assistant] 已恢复: ${path.basename(filePath)}`);
        }
    }

    const templates = [
        path.join(uiDefaultPath, 'templates', 'layout', 'layout.html'),
        path.join(uiDefaultPath, 'templates', 'partials', 'problem_sidebar_normal.html'),
        path.join(uiDefaultPath, 'templates', 'problem_detail.html'),
        path.join(uiDefaultPath, 'templates', 'record_detail.html'),
    ];

    for (const tpl of templates) {
        restoreFile(tpl);
    }

    console.log('[ai-assistant] ✅ 模板已恢复');
}

// 执行
const action = process.argv[2] || 'install';
const uiDefaultPath = process.argv[3] || findUiDefault();

if (!uiDefaultPath) {
    console.error('[ai-assistant] 错误: 找不到 ui-default 插件路径');
    console.error('[ai-assistant] 请手动指定路径: node install.js install /path/to/ui-default');
    process.exit(1);
}

if (action === 'install') {
    install(uiDefaultPath);
} else if (action === 'uninstall') {
    uninstall(uiDefaultPath);
} else {
    console.log(`用法: node install.js [install|uninstall] [ui-default路径]`);
}
