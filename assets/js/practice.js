/* 答题页：选择 / 填空 / 计算，手写、拍照、AI 批改、自评、结果 */
(function () {
  const Phys = (window.Phys = window.Phys || {});
  const UI = Phys.UI;
  const P = {};
  const esc = Phys.escapeHtml;
  let currentPad = null;

  const SYMBOLS = ['×', '÷', '√', 'π', 'θ', 'ω', 'α', 'β', 'Δ', '∫', '²', '³', '₀', '₁', '₂', 'μ', 'Ω', '°', '≈', '≤', '≥', '→'];

  function session() {
    return Phys.state.session;
  }

  function ensureDraft(qid) {
    const s = session();
    s.drafts = s.drafts || {};
    if (!s.drafts[qid]) {
      s.drafts[qid] = { selected: [], blanks: [], text: '', padStrokes: [], photos: [], padOpen: false };
    }
    return s.drafts[qid];
  }

  function sourceLabel(source) {
    return { ai: 'AI 批改', local: '本地判分', self: '自评' }[source] || '判分';
  }

  function resultTone(r) {
    return r.result === 'correct' ? 'correct' : r.result === 'partial' ? 'partial' : 'wrong';
  }

  function resultIcon(r) {
    return r.result === 'correct' ? 'check' : r.result === 'partial' ? 'alert' : 'close';
  }

  // ---------- 渲染：选项 ----------
  function optionsHtml(q, draft, result) {
    const selected = new Set(result && result.userAnswer ? result.userAnswer.selected || [] : draft.selected || []);
    const correct = new Set(q.answer || []);
    return (
      '<div class="options ' + (result ? 'is-locked' : '') + '" data-options role="group" aria-label="选项">' +
      q.options.map(function (o) {
        const isSel = selected.has(o.id);
        const isCorrect = correct.has(o.id);
        let cls = 'option';
        if (isSel) cls += ' is-selected';
        if (result) {
          if (isCorrect) cls += ' is-correct';
          if (isSel && !isCorrect) cls += ' is-wrong';
          if (!isSel && isCorrect) cls += ' is-missed';
        }
        return (
          '<button type="button" class="' + cls + '" data-option="' + esc(o.id) + '" aria-pressed="' + (isSel ? 'true' : 'false') + '" aria-label="选项 ' + esc(o.id) + '：' + esc(Phys.stripMarkdown(o.text)) + '">' +
          '<span class="opt-key">' + esc(o.id) + '</span>' +
          '<span class="opt-text">' + Phys.renderMath(o.text) + '</span>' +
          '<span class="opt-mark">' + (result && isCorrect ? Phys.icon('check') : result && isSel && !isCorrect ? Phys.icon('close') : '') + '</span>' +
          '</button>'
        );
      }).join('') +
      '</div>'
    );
  }

  // ---------- 渲染：填空 ----------
  function blanksHtml(q, draft, result) {
    const values = result && result.userAnswer ? result.userAnswer.blanks || [] : draft.blanks || [];
    return (
      '<div class="blanks">' +
      (q.answer || []).map(function (b, i) {
        return (
          '<label class="blank-row">' +
          '<span class="blank-index">(' + (i + 1) + ')</span>' +
          '<span class="blank-body">' +
          (b.label ? '<span class="blank-label">' + esc(b.label) + '</span>' : '') +
          '<span class="blank-input-wrap"><input class="blank-input" type="text" inputmode="text" autocomplete="off" spellcheck="false" data-blank="' + i + '" value="' + esc(values[i] || '') + '" placeholder="' + esc(b.placeholder || '填写答案') + '" ' + (result ? 'disabled' : '') + '>' +
          (b.unit ? '<span class="blank-unit">' + esc(b.unit) + '</span>' : '') +
          '</span></span>' +
          '</label>'
        );
      }).join('') +
      '</div>'
    );
  }

  function padSection(q, draft, result, opts) {
    opts = opts || {};
    if (q.type === 'blank' && !opts.force) {
      const open = draft.padOpen || (draft.padStrokes && draft.padStrokes.length);
      return (
        '<details class="work-details" data-blank-pad ' + (open ? 'open' : '') + '>' +
        '<summary>' + Phys.icon('pen') + '<span>手写补充过程（选填）</span><small>需要写公式时使用</small>' + Phys.icon('chevronDown') + '</summary>' +
        '<div class="pad-host" data-pad-host></div>' +
        '</details>'
      );
    }
    return (
      '<div class="pad-block">' +
      '<div class="pad-block-head"><div><h4>' + (q.type === 'calc' ? '手写解题过程' : '手写补充') + '</h4><p>用触控笔直接写，支持压感、全屏和防误触</p></div><span class="pad-optional">' + (q.type === 'calc' ? '推荐' : '选填') + '</span></div>' +
      '<div class="pad-host" data-pad-host></div>' +
      '</div>'
    );
  }

  function photoStrip(draft, result) {
    return (
      '<div class="photo-area" data-photo-area>' +
      '<div class="photo-thumbs" data-photo-thumbs>' + photosHtml(draft, result) + '</div>' +
      (!result
        ? '<label class="photo-add">' + Phys.icon('camera') + '<span>拍照 / 上传</span><input type="file" accept="image/*" multiple data-photo-input hidden></label>'
        : '') +
      '</div>'
    );
  }

  function photosHtml(draft, result) {
    const photos = draft.photos || [];
    return photos.map(function (src, i) {
      return (
        '<div class="photo-thumb"><img src="' + src + '" alt="作答照片 ' + (i + 1) + '">' +
        (!result ? '<button type="button" class="photo-remove" data-photo-remove="' + i + '" aria-label="删除照片">' + Phys.icon('close') + '</button>' : '') +
        '</div>'
      );
    }).join('');
  }

  function symbolBar() {
    return (
      '<div class="symbol-bar" aria-label="快捷符号">' +
      '<span class="symbol-label">符号</span>' +
      SYMBOLS.map((s) => '<button type="button" class="symbol-btn" data-symbol="' + esc(s) + '">' + esc(s) + '</button>').join('') +
      '</div>'
    );
  }

  function workArea(q, draft, result) {
    if (q.type === 'single' || q.type === 'multiple') return optionsHtml(q, draft, result);
    if (q.type === 'blank') {
      return (
        blanksHtml(q, draft, result) +
        '<div class="optional-note">' + Phys.icon('info') + '数值题直接填数字；表达式可用 ^ 表示乘方，例如 <code>v0*t+0.5*a*t^2</code>。</div>' +
        (result ? '' : '<details class="text-details"><summary>补充文字过程（选填）</summary><textarea class="answer-textarea" data-answer-text rows="3" placeholder="可以补充推导过程，AI 会一起看">' + esc(draft.text || '') + '</textarea></details>') +
        padSection(q, draft, result) +
        (result ? '' : symbolBar())
      );
    }
    return (
      '<div class="calc-text-block">' +
      '<label class="field-label" for="calc-text">文字答案 / 关键步骤 <span>（可以只写最终结果，详细过程建议手写）</span></label>' +
      '<textarea id="calc-text" class="answer-textarea calc-textarea" data-answer-text rows="4" placeholder="例如：由牛顿第二定律得 a = F/m = ..." ' + (result ? 'disabled' : '') + '>' + esc(draft.text || '') + '</textarea>' +
      '</div>' +
      padSection(q, draft, result, { force: true }) +
      photoStrip(draft, result) +
      (result ? '' : symbolBar())
    );
  }

  // ---------- 渲染：结果 ----------
  function resultHtml(r, q, chapter) {
    if (!r) return '';
    const tone = resultTone(r);
    const source = sourceLabel(r.source);
    const gaps = (r.knowledgeGaps || []).filter((g) => g && g.point);
    return (
      '<section class="result-card result-' + tone + '" id="result-area">' +
      '<div class="result-banner">' +
      '<div class="result-icon">' + Phys.icon(resultIcon(r)) + '</div>' +
      '<div class="result-title"><div class="result-kicker"><span class="source-tag">' + source + '</span>' + (r.result === 'correct' ? '本题通过' : r.result === 'partial' ? '部分掌握' : '需要重做') + '</div><h2>' + esc(r.verdict || '') + '</h2></div>' +
      '<div class="result-score"><strong>' + (Number(r.score) || 0) + '</strong><span>/ 100</span></div>' +
      '</div>' +
      '<div class="result-body">' +
      (r.feedback ? '<div class="result-section"><div class="rs-label">' + Phys.icon('info') + '讲评</div><div class="rich result-rich">' + Phys.renderRich(r.feedback) + '</div></div>' : '') +
      (r.errors && r.errors.length
        ? '<div class="result-section error-section"><div class="rs-label">' + Phys.icon('alert') + '具体问题</div><ul class="error-list">' + r.errors.map((x) => '<li>' + Phys.renderMath(x) + '</li>').join('') + '</ul></div>'
        : '') +
      (r.correctSolution ? '<div class="result-section solution-section"><div class="rs-label">' + Phys.icon('checkCircle') + '参考答案与解法</div><div class="rich result-rich">' + Phys.renderRich(r.correctSolution) + '</div></div>' : '') +
      (gaps.length
        ? '<div class="result-section"><div class="rs-label">' + Phys.icon('target') + '这道题暴露的知识点</div><div class="gap-list">' + gaps.map((g) => '<button class="gap-chip" data-scroll-k="' + esc(g.id || g.point) + '" data-chapter="' + esc(chapter.id) + '">' + esc(g.point) + '</button>').join('') + '</div>' + (gaps.some((g) => g.why) ? '<div class="gap-why">' + gaps.filter((g) => g.why).map((g) => '<p><strong>' + esc(g.point) + '：</strong>' + esc(g.why) + '</p>').join('') + '</div>' : '') + '</div>'
        : '') +
      (r.similar && r.similar.question
        ? '<details class="similar-box result-similar"><summary>' + Phys.icon('spark') + '<span>举一反三：换一道同知识点的题</span><span class="similar-open">展开</span></summary><div class="similar-body"><div class="rich">' + Phys.renderRich(r.similar.question) + '</div>' +
          (r.similar.hint ? '<p class="similar-hint">提示：' + Phys.renderRich(r.similar.hint, { inline: true }) + '</p>' : '') +
          (r.similar.solution ? '<details class="similar-sol"><summary>查看解析</summary><div class="rich">' + Phys.renderRich(r.similar.solution) + '</div></details>' : '') +
          '</div></details>'
        : '') +
      (r.drawing ? '<details class="my-work"><summary>' + Phys.icon('image') + '查看我的手写作答</summary><img src="' + r.drawing + '" alt="手写作答"></details>' : '') +
      (r.aiError ? '<div class="ai-error">' + Phys.icon('alert') + '<span>' + esc(r.aiError) + '</span></div>' : '') +
      (r.source === 'ai' ? '<div class="ai-disclaimer">' + Phys.icon('info') + 'AI 批改由模型生成，可能存在误判；关键结论请对照标准解法。</div>' : '') +
      '<div class="your-answer"><span>你的作答</span><strong>' + esc(UI.answerText(q, r.userAnswer)) + '</strong></div>' +
      (r.result !== 'correct' ? '<div class="wrong-added">' + Phys.icon('wrong') + '已自动加入错题本，之后可以在「错题本」重刷。</div>' : '') +
      '</div>' +
      '<div class="result-actions">' +
      '<button class="btn btn-primary" data-action="next">' + (Phys.state.session.index >= Phys.state.session.qids.length - 1 ? '查看本轮结果' : '下一题') + Phys.icon('arrowRight') + '</button>' +
      '<button class="btn btn-ghost" data-action="retry">' + Phys.icon('refresh') + '再做一次</button>' +
      '<a class="btn btn-ghost" href="#/knowledge/' + encodeURIComponent(chapter.id) + '">' + Phys.icon('bookOpen') + '回看知识点</a>' +
      '</div>' +
      '</section>'
    );
  }

  function selfCheckHtml(q, chapter, message, canRetry) {
    return (
      '<section class="result-card result-pending" id="result-area">' +
      '<div class="result-banner self-banner">' +
      '<div class="result-icon">' + Phys.icon('edit') + '</div>' +
      '<div class="result-title"><div class="result-kicker">自评模式</div><h2>对照答案，诚实自评</h2></div>' +
      '</div>' +
      '<div class="result-body">' +
      '<div class="self-message">' + Phys.icon('info') + '<div><strong>' + (message ? 'AI 暂时没能完成批改' : '本题需要自评') + '</strong><p>' + esc(message || '还没有配置 AI 批改。你可以先对照参考答案判断自己是否做对；配置 AI 后，计算题也能自动按步骤给分。') + '</p></div></div>' +
      '<div class="self-actions">' +
      '<button class="btn btn-success" data-self="correct">' + Phys.icon('check') + '基本做对</button>' +
      '<button class="btn btn-warn" data-self="partial">' + Phys.icon('alert') + '对了一部分</button>' +
      '<button class="btn btn-danger-ghost" data-self="wrong">' + Phys.icon('close') + '做错了</button>' +
      '</div>' +
      '<div class="self-ref"><div class="rs-label">' + Phys.icon('checkCircle') + '参考答案与解析</div>' +
      '<div class="rich result-rich">' + Phys.renderRich((q.answer && q.answer.reference) || q.explanation || '题库暂无参考答案。') + '</div>' +
      (q.explanation ? '<details class="self-explanation"><summary>展开题目解析</summary><div class="rich">' + Phys.renderRich(q.explanation) + '</div></details>' : '') +
      '</div>' +
      (canRetry ? '<div class="self-retry"><button class="btn btn-ghost" data-action="retry-ai">' + Phys.icon('refresh') + '重试 AI 批改</button></div>' : '') +
      '<div class="self-tip">' + Phys.icon('info') + '自评结果同样会计入进度和错题本。' + (!Phys.Store.hasAI() ? ' <a href="#/settings">去配置 AI 批改</a>' : '') + '</div>' +
      '</div>' +
      '</section>'
    );
  }

  // ---------- 页面 ----------
  P.render = function () {
    const s = session();
    if (!s) {
      return {
        html: UI.empty('play', '还没有开始练习', '从章节页或错题本选择一组题目开始。', '<a class="btn btn-primary" href="#/home">回到首页</a>'),
        mount: function () {}
      };
    }
    if (s.finished) return { html: completionHtml(s), mount: completionMount };

    const qid = s.qids[s.index];
    const row = Phys.Store.getQuestion(qid);
    if (!row) return { html: UI.empty('alert', '题目不存在', '题库可能已更新，请重新开始练习。', '<a class="btn btn-primary" href="#/home">回到首页</a>') };
    const q = row.q;
    const chapter = row.chapter;
    const p = Phys.Store.getQuestionProgress(qid);
    const result = s.results[qid];
    const draft = ensureDraft(qid);
    if (q.type === 'blank') {
      const n = (q.answer || []).length;
      draft.blanks = draft.blanks || [];
      for (let i = 0; i < n; i++) if (draft.blanks[i] == null) draft.blanks[i] = '';
    }
    const status = Phys.Store.statusOf(qid);
    const ai = Phys.Store.hasAI();
    const vision = Phys.Store.hasVision();

    const header =
      '<div class="practice-head">' +
      '<a class="icon-btn" href="' + (s.chapterId ? '#/chapter/' + encodeURIComponent(s.chapterId) : '#/wrong') + '" aria-label="退出练习">' + Phys.icon('arrowLeft') + '</a>' +
      '<div class="practice-title"><span>' + esc(s.title) + '</span><strong>第 ' + (s.index + 1) + ' / ' + s.qids.length + ' 题</strong></div>' +
      '<div class="practice-progress"><div class="pp-bar"><i style="width:' + Math.round(((s.index + 1) / s.qids.length) * 100) + '%"></i></div><span>' + Math.round(((s.index + 1) / s.qids.length) * 100) + '%</span></div>' +
      '<button class="btn btn-ghost btn-sm" data-action="finish">结束</button>' +
      '</div>';

    const dots =
      '<div class="question-dots" role="tablist" aria-label="题目导航">' +
      s.qids.map(function (id, i) {
        const r = s.results[id];
        let cls = 'qdot';
        if (i === s.index) cls += ' is-current';
        if (r) cls += r.result === 'correct' ? ' is-correct' : r.result === 'partial' ? ' is-partial' : ' is-wrong';
        return '<button class="' + cls + '" data-jump="' + i + '" aria-label="第 ' + (i + 1) + ' 题" aria-current="' + (i === s.index ? 'true' : 'false') + '">' + (i + 1) + '</button>';
      }).join('') +
      '</div>';

    const meta =
      '<div class="q-meta">' +
      '<span class="q-number">Q' + String(s.index + 1).padStart(2, '0') + '</span>' +
      UI.typeBadge(q.type) + UI.diff(q.difficulty) +
      (p && p.seen ? UI.statusPill(status) : '') +
      '<span class="q-source">' + esc(chapter.title) + '</span>' +
      '</div>';

    const knowledge = q.knowledge && q.knowledge.length
      ? '<div class="q-knowledge">' + q.knowledge.map(function (kid) {
          const k = Phys.Store.getKnowledge(chapter, kid);
          return '<a class="chip chip-k" href="#/knowledge/' + encodeURIComponent(chapter.id) + '?k=' + encodeURIComponent(kid) + '">' + esc(k ? k.title : kid) + '</a>';
        }).join('') + '</div>'
      : '';

    const hint = Phys.Store.TYPE_HINT[q.type] || '';
    const aiNote = ai
      ? (q.type === 'calc' || q.type === 'blank'
        ? (vision ? '提交后 AI 批改，手写图片会一起发送' : '提交后 AI 批改；未配置视觉模型时请补充文字答案')
        : '选择题提交后立即本地判分')
      : (q.type === 'calc'
        ? '未配置 AI：计算题需要对照参考答案自评'
        : q.type === 'blank'
          ? '未配置 AI：填空题使用本地判分'
          : '选择题提交后立即本地判分');

    const card =
      '<article class="question-card ' + (result ? 'is-graded' : '') + '" data-qid="' + esc(qid) + '">' +
      meta +
      '<div class="q-stem rich">' + Phys.renderRich(q.stem) + '</div>' +
      knowledge +
      '<div class="q-hint">' + Phys.icon('info') + esc(hint) + '</div>' +
      '<div class="q-work">' + workArea(q, draft, result) + '</div>' +
      '<div class="q-ai-note ' + (ai ? '' : 'is-off') + '">' + Phys.icon(ai ? 'spark' : 'info') + '<span>' + esc(aiNote) + '</span><a href="#/settings">设置</a></div>' +
      (result ? '' : '<div id="grading-status" class="grading-status" hidden><span class="spinner"></span><span>正在批改，请稍候…</span></div>') +
      '</article>';

    const bottom =
      '<div class="practice-bottom' + (q.type === 'single' || q.type === 'multiple' ? ' is-sticky' : '') + '">' +
      '<button class="btn btn-ghost" data-action="prev" ' + (s.index === 0 ? 'disabled' : '') + '>' + Phys.icon('arrowLeft') + '上一题</button>' +
      '<div class="pb-main">' +
      (!result
        ? '<button class="btn btn-primary btn-lg" data-submit>' + Phys.icon('send') + '提交批改</button><span class="kbd-hint">Ctrl / ⌘ + Enter</span>'
        : '<button class="btn btn-ghost btn-lg" data-action="next">' + (s.index >= s.qids.length - 1 ? '查看本轮结果' : '下一题') + Phys.icon('arrowRight') + '</button>') +
      '</div>' +
      '<span class="bottom-spacer"></span>' +
      '</div>';

    return {
      html: header + dots + '<div class="practice-wrap">' + card + '<div id="result-slot">' + (result ? resultHtml(result, q, chapter) : '') + '</div>' + bottom + '</div>',
      mount: function (root) {
        mountPractice(root, q, chapter, draft, result);
      }
    };
  };

  // ---------- 挂载 ----------
  function mountPractice(root, q, chapter, draft, result) {
    currentPad = null;
    const s = session();
    const qid = q.id;

    function updateSubmit() {
      const btn = root.querySelector('[data-submit]');
      if (!btn) return;
      let ok = false;
      if (q.type === 'single' || q.type === 'multiple') ok = (draft.selected || []).length > 0;
      else if (q.type === 'blank') ok = (draft.blanks || []).some((x) => String(x || '').trim());
      else ok = !!(draft.text && draft.text.trim()) || (draft.padStrokes && draft.padStrokes.length) || (draft.photos && draft.photos.length);
      btn.disabled = !ok;
    }

    // 选项
    if (q.type === 'single' || q.type === 'multiple') {
      root.querySelectorAll('[data-option]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (s.results[qid]) return;
          const id = btn.getAttribute('data-option');
          if (q.type === 'single') draft.selected = [id];
          else {
            const set = new Set(draft.selected || []);
            if (set.has(id)) set.delete(id);
            else set.add(id);
            draft.selected = Array.from(set);
          }
          root.querySelectorAll('[data-option]').forEach(function (b) {
            const on = draft.selected.includes(b.getAttribute('data-option'));
            b.classList.toggle('is-selected', on);
            b.setAttribute('aria-pressed', on ? 'true' : 'false');
          });
          updateSubmit();
        });
      });
    }

    // 填空
    root.querySelectorAll('[data-blank]').forEach(function (input) {
      input.addEventListener('input', function () {
        const i = Number(input.getAttribute('data-blank'));
        draft.blanks[i] = input.value;
        updateSubmit();
      });
    });

    // 文字
    const ta = root.querySelector('[data-answer-text]');
    if (ta) {
      ta.addEventListener('input', function () {
        draft.text = ta.value;
        updateSubmit();
      });
    }

    // 符号
    root.querySelectorAll('[data-symbol]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const symbol = btn.getAttribute('data-symbol');
        const active = document.activeElement;
        const target = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') && root.contains(active) ? active : ta;
        if (!target) {
          Phys.toast('先点一下要输入的答题框', 'info', 1600);
          return;
        }
        const start = target.selectionStart == null ? target.value.length : target.selectionStart;
        const end = target.selectionEnd == null ? target.value.length : target.selectionEnd;
        target.value = target.value.slice(0, start) + symbol + target.value.slice(end);
        target.selectionStart = target.selectionEnd = start + symbol.length;
        target.focus();
        if (target.hasAttribute('data-blank')) {
          const i = Number(target.getAttribute('data-blank'));
          draft.blanks[i] = target.value;
        } else {
          draft.text = target.value;
        }
        updateSubmit();
      });
    });

    // 白板
    function bindPad() {
      const host = root.querySelector('[data-pad-host]');
      if (!host || host._pad) return;
      currentPad = Phys.Pad.mount(host, {
        strokes: draft.padStrokes || [],
        readOnly: !!s.results[qid],
        antiPalm: Phys.state.settings.ui.antiPalm !== false,
        onChange: function (strokes) {
          draft.padStrokes = strokes;
          updateSubmit();
        },
        onAntiPalmChange: function (v) {
          Phys.Store.saveSettings({ ui: { antiPalm: v } });
        }
      });
      if (s.results[qid]) currentPad.setReadOnly(true);
    }

    const blankPad = root.querySelector('[data-blank-pad]');
    if (blankPad) {
      if (blankPad.open) bindPad();
      blankPad.addEventListener('toggle', function () {
        draft.padOpen = blankPad.open;
        if (blankPad.open) setTimeout(bindPad, 30);
      });
    } else {
      bindPad();
    }

    // 照片
    function bindPhotoInput() {
      const input = root.querySelector('[data-photo-input]');
      if (!input) return;
      input.addEventListener('change', async function () {
        const files = Array.from(input.files || []);
        input.value = '';
        for (const file of files) {
          if (!file.type.startsWith('image/')) continue;
          if ((draft.photos || []).length >= 2) {
            Phys.toast('最多上传 2 张照片', 'warn');
            break;
          }
          try {
            const raw = await Phys.readFileDataURL(file);
            const compressed = await Phys.compressImage(raw, 1400, 0.82);
            draft.photos = draft.photos || [];
            draft.photos.push(compressed);
            refreshPhotos();
            updateSubmit();
          } catch (e) {
            Phys.toast('图片读取失败', 'error');
          }
        }
      });
    }
    function refreshPhotos() {
      const thumbs = root.querySelector('[data-photo-thumbs]');
      if (thumbs) thumbs.innerHTML = photosHtml(draft, !!s.results[qid]);
      bindPhotoRemove();
    }
    function bindPhotoRemove() {
      root.querySelectorAll('[data-photo-remove]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const i = Number(btn.getAttribute('data-photo-remove'));
          draft.photos.splice(i, 1);
          refreshPhotos();
          updateSubmit();
        });
      });
    }
    bindPhotoInput();
    bindPhotoRemove();
    updateSubmit();

    // 提交
    const submitBtn = root.querySelector('[data-submit]');
    if (submitBtn) {
      submitBtn.addEventListener('click', function () {
        if (submitBtn.disabled) return;
        submit(root, q, chapter, draft);
      });
    }

    // 键盘快捷键
    const onKey = function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!s.results[qid]) submit(root, q, chapter, draft);
      }
    };
    document.addEventListener('keydown', onKey);

    // 导航 / 自评
    root.querySelectorAll('[data-action="prev"]').forEach((b) => b.addEventListener('click', () => go(-1)));
    root.querySelectorAll('[data-action="next"]').forEach((b) =>
      b.addEventListener('click', function () {
        if (this.hasAttribute('disabled')) return;
        go(1);
      })
    );
    root.querySelectorAll('[data-action="finish"]').forEach((b) =>
      b.addEventListener('click', async function () {
        if (!s.results[qid] && (draft.selected.length || draft.text || draft.padStrokes.length || draft.blanks.some((x) => x))) {
          const yes = await Phys.confirm({ title: '结束本轮练习？', message: '当前这题还没有提交批改，结束后仍可从章节页重新开始。', confirmText: '结束练习' });
          if (!yes) return;
        }
        s.finished = true;
        Phys.Store.persistSession();
        Phys.App.rerender();
      })
    );
    root.querySelectorAll('[data-jump]').forEach((b) =>
      b.addEventListener('click', function () {
        s.index = Number(b.getAttribute('data-jump'));
        s.finished = false;
        Phys.Store.persistSession();
        Phys.App.rerender();
      })
    );
    root.querySelectorAll('[data-action="retry"]').forEach((b) =>
      b.addEventListener('click', function () {
        delete s.results[qid];
        Phys.App.rerender();
      })
    );
    root.querySelectorAll('[data-action="retry-ai"]').forEach((b) =>
      b.addEventListener('click', function () {
        if (currentPad) draft.padStrokes = currentPad.getStrokes();
        submit(root, q, chapter, draft);
      })
    );

    bindSelfActions(root, q, chapter, draft);
    bindResultKnowledge(root);
  }

  function bindResultKnowledge(root) {
    UI.bindCommon(root);
  }

  function bindSelfActions(root, q, chapter, draft) {
    root.querySelectorAll('[data-self]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const level = btn.getAttribute('data-self');
        const user = buildUser(q, draft);
        const res = Phys.Grader.selfResult(q, chapter, level, user);
        if (currentPad && currentPad.count() > 0) res.drawing = currentPad.toDataURL(1500);
        finalize(q.id, res, '自评已记录');
      });
    });
  }

  // ---------- 提交 ----------
  function buildUser(q, draft) {
    if (currentPad) draft.padStrokes = currentPad.getStrokes();
    const drawing = currentPad && !currentPad.isEmpty() ? currentPad.toDataURL(1500) : null;
    const images = [];
    if (drawing) images.push(drawing);
    (draft.photos || []).forEach((p) => images.push(p));
    return {
      selected: draft.selected || [],
      blanks: draft.blanks || [],
      text: draft.text || '',
      images: images.slice(0, 2),
      allImages: images,
      drawing
    };
  }

  async function submit(root, q, chapter, draft) {
    const s = session();
    const qid = q.id;
    if (s.results[qid]) return;
    if (q.type === 'single' || q.type === 'multiple') {
      if (!(draft.selected || []).length) return Phys.toast('请先选择答案', 'warn');
    }
    if (q.type === 'blank') {
      const empty = (draft.blanks || []).filter((x) => !String(x || '').trim()).length;
      if (empty) return Phys.toast('还有 ' + empty + ' 个空没有填写', 'warn');
    }
    if (q.type === 'calc') {
      if ((!draft.text || !draft.text.trim()) && (!draft.padStrokes || !draft.padStrokes.length) && (!draft.photos || !draft.photos.length)) {
        return Phys.toast('请写一点解题过程，或上传作答照片', 'warn');
      }
    }

    const user = buildUser(q, draft);
    const status = root.querySelector('#grading-status');
    const submitBtn = root.querySelector('[data-submit]');
    if (status) status.hidden = false;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span>正在批改…';
    }
    const card = root.querySelector('.question-card');
    if (card) card.classList.add('is-submitting');

    try {
      let result = null;
      if (q.type === 'single' || q.type === 'multiple') {
        result = Phys.Grader.gradeObjective(q, chapter, user);
      } else if (q.type === 'blank') {
        const local = Phys.Grader.gradeBlankLocal(q, chapter, user);
        if (local.result === 'correct' || !Phys.Store.hasAI()) {
          result = local;
        } else {
          try {
            result = await Phys.Grader.gradeWithAI(q, chapter, user, user.images);
          } catch (e) {
            console.error(e);
            local.aiError = Phys.AI.friendlyError(e);
            result = local;
            Phys.toast('AI 批改失败，已使用本地判分', 'warn', 4200);
          }
        }
      } else {
        if (!Phys.Store.hasAI()) {
          if (status) status.hidden = true;
          if (card) card.classList.remove('is-submitting');
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = Phys.icon('send') + '提交批改';
          }
          showSelfCheck(root, q, chapter, '', false);
          return;
        }
        result = await Phys.Grader.gradeWithAI(q, chapter, user, user.images);
      }
      if (user.drawing) result.drawing = user.drawing;
      finalize(qid, result, result.result === 'correct' ? '回答正确' : '已记入错题本');
    } catch (e) {
      console.error(e);
      if (status) status.hidden = true;
      if (card) card.classList.remove('is-submitting');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = Phys.icon('send') + '提交批改';
      }
      const msg = Phys.AI.friendlyError(e);
      Phys.toast(msg, 'error', 6000);
      if (q.type === 'blank' || q.type === 'calc') {
        showSelfCheck(root, q, chapter, msg, true);
      }
    }
  }

  function showSelfCheck(root, q, chapter, message, canRetry) {
    const slot = root.querySelector('#result-slot');
    if (!slot) return;
    slot.innerHTML = selfCheckHtml(q, chapter, message, canRetry);
    const submitBar = root.querySelector('[data-submit]');
    if (submitBar) submitBar.hidden = true;
    const draft = ensureDraft(q.id);
    bindSelfActions(root, q, chapter, draft);
    const retry = root.querySelector('[data-action="retry-ai"]');
    if (retry) {
      retry.addEventListener('click', function () {
        submit(root, q, chapter, draft);
      });
    }
    setTimeout(function () {
      const el = root.querySelector('#result-area');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  }

  function finalize(qid, result, toastMsg) {
    const s = session();
    Phys.Store.recordAttempt(qid, result);
    s.results[qid] = result;
    s.revealed[qid] = true;
    Phys.Store.persistSession();
    Phys.toast(toastMsg, result.result === 'correct' ? 'success' : 'info', 2200);
    Phys.App.rerender();
    setTimeout(function () {
      const el = document.querySelector('#result-area');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }

  function go(delta) {
    const s = session();
    const next = s.index + delta;
    if (next < 0) return;
    if (next >= s.qids.length) {
      s.finished = true;
      Phys.Store.persistSession();
      Phys.App.rerender();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    s.index = next;
    Phys.Store.persistSession();
    Phys.App.rerender();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---------- 完成页 ----------
  function completionHtml(s) {
    const answered = s.qids.filter((id) => s.results[id]);
    const correct = answered.filter((id) => s.results[id].result === 'correct').length;
    const partial = answered.filter((id) => s.results[id].result === 'partial').length;
    const wrong = answered.filter((id) => s.results[id].result === 'wrong').length;
    const wrongIds = s.qids.filter((id) => s.results[id] && s.results[id].result !== 'correct');
    const pct = answered.length ? correct / answered.length : 0;
    const duration = (Date.now() - new Date(s.startedAt).getTime()) / 1000;
    const chapter = s.chapterId ? Phys.Store.getChapter(s.chapterId) : null;
    return (
      '<div class="completion">' +
      '<div class="completion-top">' +
      '<div class="completion-ring">' + UI.ring(pct, { size: 190, label: '本轮正确率' }) + '</div>' +
      '<div class="completion-copy"><div class="eyebrow">SESSION COMPLETE</div><h1>' + (wrong === 0 && partial === 0 ? '这一轮，全对。' : '练习完成，复盘一下。') + '</h1>' +
      '<p>' + esc(s.title) + ' · 用时 ' + Phys.fmtDuration(duration) + ' · 作答 ' + answered.length + '/' + s.qids.length + ' 题</p>' +
      '<div class="completion-stats">' +
      '<div><strong class="success">' + correct + '</strong><span>正确</span></div>' +
      '<div><strong class="warn">' + partial + '</strong><span>部分正确</span></div>' +
      '<div><strong class="danger">' + wrong + '</strong><span>错误</span></div>' +
      '</div>' +
      '<div class="completion-actions">' +
      (wrongIds.length ? '<button class="btn btn-primary" data-completion="redo-wrong">' + Phys.icon('refresh') + '重刷本轮错题 ' + wrongIds.length + '</button>' : '') +
      '<button class="btn btn-ghost" data-completion="again">' + Phys.icon('refresh') + '再做一轮</button>' +
      (chapter ? '<a class="btn btn-ghost" href="#/chapter/' + encodeURIComponent(chapter.id) + '">' + Phys.icon('arrowLeft') + '返回章节</a>' : '<a class="btn btn-ghost" href="#/wrong">返回错题本</a>') +
      '</div></div></div>' +
      (wrongIds.length
        ? '<section class="panel completion-wrong"><h3>这一轮需要回看的题</h3><div class="completion-list">' + wrongIds.map(function (id) {
            const row = Phys.Store.getQuestion(id);
            const r = s.results[id];
            if (!row) return '';
            return '<button class="completion-item" data-completion-qid="' + esc(id) + '"><span class="ci-status ' + resultTone(r) + '">' + esc(r.verdict || '') + '</span><span class="ci-stem">' + esc(UI.questionPreview(row.q)) + '</span>' + Phys.icon('chevronRight') + '</button>';
          }).join('') + '</div></section>'
        : '<section class="panel completion-wrong"><div class="completion-good">' + Phys.icon('trophy') + '<div><h3>没有需要重做的题</h3><p>可以尝试随机练习，或者去错题本看看以前做错的题。</p></div><a class="btn btn-ghost" href="#/wrong">打开错题本</a></div></section>') +
      '</div>'
    );
  }

  function completionMount(root) {
    const s = session();
    root.querySelectorAll('[data-completion="redo-wrong"]').forEach(function (b) {
      b.addEventListener('click', function () {
        const ids = s.qids.filter((id) => s.results[id] && s.results[id].result !== 'correct');
        if (!ids.length) return;
        Phys.Store.startSession({ mode: 'wrong', title: s.title + ' · 错题重刷', chapterId: s.chapterId, qids: ids });
        Phys.App.rerender();
        window.scrollTo(0, 0);
      });
    });
    root.querySelectorAll('[data-completion="again"]').forEach(function (b) {
      b.addEventListener('click', function () {
        Phys.Store.startSession({ mode: s.mode, title: s.title, chapterId: s.chapterId, qids: s.qids });
        Phys.App.rerender();
        window.scrollTo(0, 0);
      });
    });
    root.querySelectorAll('[data-completion-qid]').forEach(function (b) {
      b.addEventListener('click', function () {
        const qid = b.getAttribute('data-completion-qid');
        Phys.App.startSingle(qid);
      });
    });
  }

  Phys.Practice = P;
})();
