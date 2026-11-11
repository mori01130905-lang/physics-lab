/* 设置页：AI 接口、题库导入导出、进度备份 */
(function () {
  const Phys = (window.Phys = window.Phys || {});
  const UI = Phys.UI;
  const S = {};
  const esc = Phys.escapeHtml;

  const TEMPLATE = {
    id: 'my-physics-bank',
    version: 1,
    title: '大学物理',
    subtitle: '我的题库',
    updatedAt: '2026-01-01',
    chapters: [
      {
        id: 'ch1',
        number: 1,
        title: '第一章 质点运动学',
        intro: '一句话说明本章学什么。',
        knowledge: [
          {
            id: 'k1-1',
            title: '位置、速度与加速度',
            summary: '本知识点的核心结论。',
            formulas: [
              { tex: 'v=\\frac{dx}{dt}', note: '速度是位置对时间的导数' }
            ],
            points: ['用 Markdown 写讲解，公式用 $...$ 包裹。'],
            pitfalls: ['列出学生最容易犯的错误。'],
            examples: [
              { question: '一道例题。', solution: '分步解答。' }
            ]
          }
        ],
        questions: [
          {
            id: 'q1',
            type: 'single',
            difficulty: 1,
            stem: '单选题题干，公式用 $...$。',
            options: [
              { id: 'A', text: '选项 A' },
              { id: 'B', text: '选项 B' },
              { id: 'C', text: '选项 C' },
              { id: 'D', text: '选项 D' }
            ],
            answer: ['A'],
            explanation: '详细解析。',
            knowledge: ['k1-1']
          },
          {
            id: 'q2',
            type: 'multiple',
            difficulty: 2,
            stem: '多选题题干。',
            options: [
              { id: 'A', text: '选项 A' },
              { id: 'B', text: '选项 B' },
              { id: 'C', text: '选项 C' }
            ],
            answer: ['A', 'C'],
            explanation: '详细解析。',
            knowledge: ['k1-1']
          },
          {
            id: 'q3',
            type: 'blank',
            difficulty: 1,
            stem: '填空题题干，第一个空填 ____，第二个空填 ____。',
            blanks: [
              { label: '第一个空', answers: ['答案', '可接受的等价答案'], unit: '' },
              { label: '第二个空', answers: ['2'], unit: 'm/s' }
            ],
            explanation: '详细解析。',
            knowledge: ['k1-1']
          },
          {
            id: 'q4',
            type: 'calc',
            difficulty: 3,
            stem: '计算题题干。',
            answer: {
              reference: '参考答案与最终结果。',
              rubric: ['写出所用公式', '代入数据', '结果与单位']
            },
            explanation: '详细解析。',
            knowledge: ['k1-1']
          }
        ]
      }
    ]
  };

  S.render = function () {
    const st = Phys.state;
    const ai = st.settings.ai;
    const cfg = Phys.Store.getAIConfig();
    const preset = Phys.Store.presets.find((p) => p.baseUrl && p.baseUrl === ai.baseUrl);
    const storageBytes = (function () {
      try {
        return new Blob([JSON.stringify(localStorage)]).size;
      } catch (e) {
        return 0;
      }
    })();
    const bankBytes = (function () {
      try {
        return new Blob([JSON.stringify(st.bank)]).size;
      } catch (e) {
        return 0;
      }
    })();

    const header =
      '<header class="page-head settings-head">' +
      '<div class="eyebrow">SETTINGS</div>' +
      '<h1>设置</h1>' +
      '<p class="page-sub">配置 AI 批改、管理题库与学习数据。所有内容默认只保存在这台设备的浏览器里。</p>' +
      '</header>';

    const aiCard =
      '<section class="panel settings-card" id="ai-settings">' +
      '<div class="settings-card-head"><div class="sc-icon">' + Phys.icon('spark') + '</div><div><h2>AI 批改</h2><p>兼容 OpenAI 的 /chat/completions 接口，例如 DeepSeek、通义千问、智谱、OpenAI。</p></div><span class="config-state ' + (Phys.Store.hasAI() ? 'on' : '') + '">' + (Phys.Store.hasAI() ? '已配置' : '未配置') + '</span></div>' +
      '<div class="preset-row">' +
      Phys.Store.presets.map(function (p) {
        return '<button class="preset-chip' + (preset && preset.id === p.id ? ' is-active' : '') + '" data-preset="' + p.id + '">' + esc(p.name) + '</button>';
      }).join('') +
      '</div>' +
      '<p class="preset-note" id="preset-note">' + esc(preset ? preset.note : '选择服务商后会自动填入接口地址和推荐模型；也可以手动填写任意兼容接口。') + '</p>' +
      '<div class="form-grid">' +
      '<label class="field full"><span>接口地址 Base URL</span><input type="url" id="ai-base" value="' + esc(ai.baseUrl) + '" placeholder="https://api.deepseek.com/v1" spellcheck="false"></label>' +
      '<label class="field full"><span>API Key</span><span class="key-field"><input type="password" id="ai-key" value="' + esc(ai.apiKey) + '" placeholder="sk-..." autocomplete="off" spellcheck="false"><button type="button" class="key-toggle" data-toggle-key="ai-key" aria-label="显示或隐藏 Key">' + Phys.icon('eye') + '</button></span><small>只保存在本机浏览器 localStorage，不会上传到本应用之外的服务器。</small></label>' +
      '<label class="field"><span>文本模型</span><input type="text" id="ai-model" value="' + esc(ai.model) + '" placeholder="deepseek-chat" spellcheck="false"></label>' +
      '<label class="field"><span>视觉模型 <em>（可选）</em></span><input type="text" id="ai-vision" value="' + esc(ai.visionModel) + '" placeholder="qwen-vl-max" spellcheck="false"><small>填写后，手写图片会发给视觉模型识别。</small></label>' +
      '</div>' +
      '<details class="advanced-box">' +
      '<summary>视觉模型使用独立接口 / Key（可选）</summary>' +
      '<div class="form-grid">' +
      '<label class="field full"><span>视觉 Base URL</span><input type="url" id="ai-vision-base" value="' + esc(ai.visionBaseUrl || '') + '" placeholder="留空则复用上面的接口" spellcheck="false"></label>' +
      '<label class="field full"><span>视觉 API Key</span><span class="key-field"><input type="password" id="ai-vision-key" value="' + esc(ai.visionApiKey || '') + '" placeholder="留空则复用上面的 Key" autocomplete="off" spellcheck="false"><button type="button" class="key-toggle" data-toggle-key="ai-vision-key" aria-label="显示或隐藏 Key">' + Phys.icon('eye') + '</button></span></label>' +
      '</div>' +
      '</details>' +
      '<div class="form-row strict-row">' +
      '<div class="field-label">批改严格度</div>' +
      '<div class="segmented" id="strictness">' +
      [
        { v: 'loose', t: '宽松', d: '思路对就给分' },
        { v: 'standard', t: '标准', d: '按步骤给分' },
        { v: 'strict', t: '严格', d: '严扣单位和步骤' }
      ].map((x) => '<button type="button" class="seg-btn' + ((ai.strictness || 'standard') === x.v ? ' is-active' : '') + '" data-strictness="' + x.v + '" title="' + x.d + '">' + x.t + '</button>').join('') +
      '</div>' +
      '<input type="hidden" id="ai-strictness" value="' + esc(ai.strictness || 'standard') + '">' +
      '</div>' +
      '<label class="check-row"><input type="checkbox" id="ai-send-drawing"' + (ai.sendDrawing !== false ? ' checked' : '') + '><span>把手写作答图片一起发送给 AI（需要视觉模型）</span></label>' +
      '<div class="form-actions">' +
      '<button class="btn btn-primary" id="save-ai">' + Phys.icon('check') + '保存 AI 设置</button>' +
      '<button class="btn btn-ghost" id="test-ai">' + Phys.icon('zap') + '测试连接</button>' +
      '<span class="test-result" id="test-result"></span>' +
      '</div>' +
      '<div class="privacy-note">' + Phys.icon('lock') + '<p>提交批改时，题目、你的答案和（可选）手写图片会发送到你配置的 AI 服务商。除此之外，本应用不会上传任何数据。API Key 只存在本机。</p></div>' +
      '</section>';

    const bankCard =
      '<section class="panel settings-card" id="bank-settings">' +
      '<div class="settings-card-head"><div class="sc-icon">' + Phys.icon('book') + '</div><div><h2>题库</h2><p>导入正式题库，或导出当前题库做备份。导入 JSON 后会替换当前题库。</p></div></div>' +
      '<div class="bank-summary">' +
      '<div class="bank-cover"><span>题库</span><strong>' + esc(st.bank.title) + '</strong><small>' + esc(st.bank.subtitle || '') + '</small></div>' +
      '<div class="bank-facts">' +
      '<div><strong>' + st.bank.chapters.length + '</strong><span>章节</span></div>' +
      '<div><strong>' + st.stats.total + '</strong><span>题目</span></div>' +
      '<div><strong>' + (bankBytes / 1024).toFixed(0) + '</strong><span>KB</span></div>' +
      '<div><strong>' + esc(st.bank.updatedAt || '—') + '</strong><span>更新</span></div>' +
      '</div></div>' +
      '<div class="button-row">' +
      '<label class="btn btn-primary" for="bank-file">' + Phys.icon('upload') + '导入题库 JSON</label><input id="bank-file" type="file" accept=".json,application/json" hidden>' +
      '<button class="btn btn-ghost" id="export-bank">' + Phys.icon('download') + '导出当前题库</button>' +
      '<button class="btn btn-ghost" id="download-template">' + Phys.icon('copy') + '下载题库模板</button>' +
      '<button class="btn btn-ghost danger-text" id="restore-sample">恢复内置题库</button>' +
      '</div>' +
      '<div class="bank-format-note">' + Phys.icon('info') + '<p>支持单选、多选、填空、计算四种题型。字段说明见模板文件；正式题库可以直接发给我，我帮你转换。</p></div>' +
      '</section>';

    const dataCard =
      '<section class="panel settings-card" id="data-settings">' +
      '<div class="settings-card-head"><div class="sc-icon">' + Phys.icon('chart') + '</div><div><h2>学习数据</h2><p>进度、错题和手写记录（不保存手写图片）默认存在本机。换设备前建议导出备份。</p></div></div>' +
      '<div class="data-facts">' +
      '<div><span>累计作答</span><strong>' + st.stats.attempts + ' 次</strong></div>' +
      '<div><span>学习天数</span><strong>' + st.stats.studyDays + ' 天</strong></div>' +
      '<div><span>本地占用</span><strong>' + (storageBytes / 1024 / 1024).toFixed(2) + ' MB</strong></div>' +
      '</div>' +
      '<div class="button-row">' +
      '<button class="btn btn-ghost" id="export-progress">' + Phys.icon('download') + '导出进度备份</button>' +
      '<label class="btn btn-ghost" for="progress-file">' + Phys.icon('upload') + '导入进度备份</label><input id="progress-file" type="file" accept=".json,application/json" hidden>' +
      '<button class="btn btn-danger-ghost" id="reset-progress">清空当前题库进度</button>' +
      '</div>' +
      '</section>';

    const profileCard =
      '<section class="panel settings-card" id="profile-settings">' +
      '<div class="settings-card-head"><div class="sc-icon">' + Phys.icon('edit') + '</div><div><h2>学习档案</h2><p>只用于首页称呼和考试倒计时，不参与 AI 批改。</p></div></div>' +
      '<div class="form-grid">' +
      '<label class="field"><span>昵称</span><input type="text" id="profile-name" value="' + esc((st.settings.profile && st.settings.profile.nickname) || '') + '" placeholder="例如：小林" maxlength="20"></label>' +
      '<label class="field"><span>考试日期（可选）</span><input type="date" id="profile-exam" value="' + esc((st.settings.profile && st.settings.profile.examDate) || '') + '"></label>' +
      '</div>' +
      '<div class="form-actions"><button class="btn btn-ghost" id="save-profile">保存档案</button></div>' +
      '</section>';

    const about =
      '<section class="panel settings-card about-card">' +
      '<div class="about-mark">' + UI.brandMark() + '</div>' +
      '<div><h3>物理 · 刷题室 <span class="version">v1.0</span></h3><p>为平板手写作答设计的大学物理刷题工具。题目、知识点、进度和错题本都可以离线使用；只有 AI 批改需要联网。</p>' +
      '<p class="muted">公式渲染 KaTeX · Markdown marked · 安全过滤 DOMPurify · 无账号、无追踪。</p></div>' +
      '</section>';

    return {
      html:
        header +
        '<div class="settings-layout">' +
        '<div class="settings-main">' + aiCard + bankCard + dataCard + profileCard + '</div>' +
        '<aside class="settings-side">' +
        '<div class="panel side-note"><h3>推荐配置</h3><p>只想自动批改文字答案：选 DeepSeek，填 Key 即可。</p><p>要识别平板手写：选通义千问或智谱，并把视觉模型填上。</p><a class="text-link" href="#/insights">看看薄弱点报告 ' + Phys.icon('arrowRight') + '</a></div>' +
        '<div class="panel side-note"><h3>题库格式</h3><p>JSON 按章节组织，每章含 knowledge 与 questions。四种题型都有模板。</p><button class="text-link" id="download-template-2">下载模板 ' + Phys.icon('download') + '</button></div>' +
        '</aside>' +
        '</div>' +
        about,
      mount: mount
    };
  };

  function mount(root) {
    const st = Phys.state;
    let strictness = st.settings.ai.strictness || 'standard';

    // Key 显示
    root.querySelectorAll('[data-toggle-key]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const input = root.querySelector('#' + btn.getAttribute('data-toggle-key'));
        if (!input) return;
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.innerHTML = Phys.icon(show ? 'eyeOff' : 'eye');
      });
    });

    // 预设
    root.querySelectorAll('[data-preset]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const p = Phys.Store.presets.find((x) => x.id === btn.getAttribute('data-preset'));
        if (!p) return;
        root.querySelectorAll('[data-preset]').forEach((b) => b.classList.toggle('is-active', b === btn));
        root.querySelector('#ai-base').value = p.baseUrl || '';
        root.querySelector('#ai-model').value = p.model || '';
        root.querySelector('#ai-vision').value = p.visionModel || '';
        const note = root.querySelector('#preset-note');
        if (note) note.textContent = p.note + (p.id === 'custom' ? ' 请填写任意 OpenAI 兼容接口。' : ' 还需要填写你自己的 API Key。');
      });
    });

    // 严格度
    root.querySelectorAll('[data-strictness]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        strictness = btn.getAttribute('data-strictness');
        root.querySelectorAll('[data-strictness]').forEach((b) => b.classList.toggle('is-active', b === btn));
        root.querySelector('#ai-strictness').value = strictness;
      });
    });

    function collect() {
      return {
        baseUrl: root.querySelector('#ai-base').value.trim(),
        apiKey: root.querySelector('#ai-key').value.trim(),
        model: root.querySelector('#ai-model').value.trim(),
        visionModel: root.querySelector('#ai-vision').value.trim(),
        visionBaseUrl: root.querySelector('#ai-vision-base').value.trim(),
        visionApiKey: root.querySelector('#ai-vision-key').value.trim(),
        sendDrawing: root.querySelector('#ai-send-drawing').checked,
        strictness
      };
    }

    function saveAI(quiet) {
      const ai = collect();
      Phys.Store.saveSettings({ ai });
      if (!quiet) {
        Phys.toast('AI 设置已保存', 'success');
        if (Phys.App && Phys.App.refreshShell) Phys.App.refreshShell();
      }
      return ai;
    }

    const saveBtn = root.querySelector('#save-ai');
    if (saveBtn) saveBtn.addEventListener('click', () => saveAI(false));

    const testBtn = root.querySelector('#test-ai');
    if (testBtn) {
      testBtn.addEventListener('click', async function () {
        const out = root.querySelector('#test-result');
        const ai = collect();
        if (!ai.baseUrl || !ai.apiKey || !ai.model) {
          out.className = 'test-result is-error';
          out.textContent = '请先填写接口地址、API Key 和文本模型';
          return;
        }
        saveAI(true);
        testBtn.disabled = true;
        testBtn.innerHTML = '<span class="spinner"></span>测试中…';
        out.className = 'test-result';
        out.textContent = '';
        try {
          const res = await Phys.AI.test();
          out.className = 'test-result is-ok';
          out.textContent = '连接成功 · ' + res.ms + 'ms · ' + res.model + ' 回复「' + res.content.slice(0, 12) + '」';
          Phys.toast('AI 连接成功', 'success');
          if (Phys.App && Phys.App.refreshShell) Phys.App.refreshShell();
        } catch (e) {
          console.error(e);
          out.className = 'test-result is-error';
          out.textContent = Phys.AI.friendlyError(e);
        } finally {
          testBtn.disabled = false;
          testBtn.innerHTML = Phys.icon('zap') + '测试连接';
        }
      });
    }

    // 题库
    const bankFile = root.querySelector('#bank-file');
    if (bankFile) {
      bankFile.addEventListener('change', async function () {
        const file = bankFile.files && bankFile.files[0];
        bankFile.value = '';
        if (!file) return;
        let raw;
        try {
          raw = JSON.parse(await Phys.readFileText(file));
        } catch (e) {
          Phys.toast('JSON 解析失败：' + e.message, 'error', 6000);
          return;
        }
        const check = Phys.Store.validateBank(raw);
        if (!check.ok) {
          Phys.modal({
            title: '题库校验未通过',
            subtitle: file.name,
            body: '<div class="import-errors"><p>请修正以下问题后再导入：</p><ul>' + check.errors.slice(0, 12).map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>' + (check.errors.length > 12 ? '<p class="muted">还有 ' + (check.errors.length - 12) + ' 条…</p>' : '') + '</div>',
            actions: [{ label: '知道了', kind: 'primary' }]
          });
          return;
        }
        const warnings = check.warnings || [];
        const body =
          '<div class="import-summary">' +
          '<div class="import-file">' + Phys.icon('book') + '<div><strong>' + esc(check.bank.title) + '</strong><span>' + esc(file.name) + '</span></div></div>' +
          '<div class="import-stats"><div><strong>' + check.bank.chapters.length + '</strong><span>章节</span></div><div><strong>' + check.qCount + '</strong><span>题目</span></div><div><strong>' + check.bank.chapters.reduce((n, c) => n + c.knowledge.length, 0) + '</strong><span>知识点</span></div></div>' +
          (warnings.length ? '<details class="import-warnings"><summary>' + warnings.length + ' 条提醒（不影响导入）</summary><ul>' + warnings.slice(0, 12).map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul></details>' : '') +
          '<label class="check-row"><input type="checkbox" id="import-reset-progress"><span>同时清空该题库已有的答题进度</span></label>' +
          '<p class="muted">导入会替换当前题库；其他题库的进度不会被删除。</p>' +
          '</div>';
        Phys.modal({
          title: '导入题库',
          subtitle: '确认后会替换当前题库',
          body,
          actions: [
            { label: '取消', kind: 'ghost' },
            {
              label: '确认导入',
              kind: 'primary',
              onClick: async function () {
                const reset = document.querySelector('#import-reset-progress') && document.querySelector('#import-reset-progress').checked;
                try {
                  await Phys.Store.setBank(check.bank, { resetProgress: reset });
                  Phys.toast('题库已导入：' + check.bank.title, 'success', 3500);
                  Phys.App.goHome();
                } catch (e) {
                  Phys.toast(e.message || '导入失败', 'error', 6000);
                  return false;
                }
              }
            }
          ]
        });
      });
    }

    const exportBankBtn = root.querySelector('#export-bank');
    if (exportBankBtn) exportBankBtn.addEventListener('click', function () {
      Phys.download('大学物理题库_' + Phys.dayKey() + '.json', Phys.Store.exportBank(), 'application/json;charset=utf-8');
      Phys.toast('题库已导出', 'success');
    });

    function downloadTemplate() {
      Phys.download('大学物理题库模板.json', JSON.stringify(TEMPLATE, null, 2), 'application/json;charset=utf-8');
      Phys.toast('模板已下载，按同样结构替换内容即可', 'success');
    }
    ['#download-template', '#download-template-2'].forEach(function (sel) {
      const b = root.querySelector(sel);
      if (b) b.addEventListener('click', downloadTemplate);
    });

    const restoreBtn = root.querySelector('#restore-sample');
    if (restoreBtn) {
      restoreBtn.addEventListener('click', async function () {
        const yes = await Phys.confirm({
          title: '恢复内置题库？',
          message: '当前导入的题库会被移除，内置的大学物理 A 题库会重新加载。你的设置不会丢失。',
          confirmText: '恢复内置题库'
        });
        if (!yes) return;
        await Phys.Store.restoreSampleBank();
        Phys.toast('已恢复内置题库', 'success');
        Phys.App.goHome();
      });
    }

    // 进度
    const exportProgressBtn = root.querySelector('#export-progress');
    if (exportProgressBtn) {
      exportProgressBtn.addEventListener('click', function () {
        Phys.download('物理刷题进度_' + Phys.dayKey() + '.json', Phys.Store.exportProgress(), 'application/json;charset=utf-8');
        Phys.toast('进度备份已导出', 'success');
      });
    }

    const progressFile = root.querySelector('#progress-file');
    if (progressFile) {
      progressFile.addEventListener('change', async function () {
        const file = progressFile.files && progressFile.files[0];
        progressFile.value = '';
        if (!file) return;
        try {
          const raw = JSON.parse(await Phys.readFileText(file));
          Phys.Store.importProgress(raw);
          Phys.toast('进度已恢复', 'success');
          Phys.App.rerender();
        } catch (e) {
          Phys.toast(e.message || '进度导入失败', 'error', 6000);
        }
      });
    }

    const resetBtn = root.querySelector('#reset-progress');
    if (resetBtn) {
      resetBtn.addEventListener('click', async function () {
        const yes = await Phys.confirm({
          title: '清空当前题库进度？',
          message: '会删除本题库的作答记录、错题本和 AI 诊断缓存，题库本身保留。建议先导出备份。',
          confirmText: '清空进度',
          danger: true
        });
        if (!yes) return;
        Phys.Store.resetProgress();
        Phys.toast('进度已清空', 'success');
        Phys.App.rerender();
      });
    }

    // 档案
    const saveProfile = root.querySelector('#save-profile');
    if (saveProfile) {
      saveProfile.addEventListener('click', function () {
        Phys.Store.saveSettings({
          profile: {
            nickname: root.querySelector('#profile-name').value.trim(),
            examDate: root.querySelector('#profile-exam').value
          }
        });
        Phys.toast('学习档案已保存', 'success');
      });
    }
  }

  Phys.Settings = S;
})();
