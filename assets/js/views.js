/* 页面视图：首页 / 章节 / 知识讲解 / 错题本 / 薄弱点 */
(function () {
  const Phys = (window.Phys = window.Phys || {});
  const UI = Phys.UI;
  const V = {};
  const esc = Phys.escapeHtml;

  function todayCount() {
    const days = Phys.state.progress.days || {};
    return days[Phys.dayKey()] || 0;
  }

  function firstUnfinished(chapter) {
    const st = Phys.chapterStats(chapter);
    if (!st.total) return null;
    const q = chapter.questions.find((x) => Phys.Store.statusOf(x.id) === 'new');
    return q || chapter.questions[0];
  }

  function chapterRow(ch) {
    const s = Phys.chapterStats(ch);
    return { chapter: ch, stats: s };
  }

  // ================= 首页 =================
  V.home = function () {
    const st = Phys.state;
    const stats = st.stats;
    const chapters = st.bank.chapters;
    let continueCh = chapters.find(function (ch) {
      const s = Phys.chapterStats(ch);
      return s.progress > 0 && s.progress < 1;
    });
    if (!continueCh) continueCh = chapters[0];
    const continueStats = continueCh ? Phys.chapterStats(continueCh) : { progress: 0, answered: 0, total: 0 };
    const hasSession = !!st.session;
    const sessionChapter = st.session && st.session.chapterId ? Phys.Store.getChapter(st.session.chapterId) : null;
    const primaryCh = hasSession && sessionChapter ? sessionChapter : continueCh;
    const activeWrong = Phys.Store.wrongQids({ resolved: false });
    const recentWrong = activeWrong.slice(-3).reverse();
    const today = todayCount();
    const nickname = (st.settings.profile && st.settings.profile.nickname) || '';

    const hero =
      '<section class="home-hero">' +
      '<div class="hero-copy">' +
      '<div class="eyebrow"><span class="eyebrow-dot"></span>' + esc(st.bank.title) + ' · ' + esc(st.bank.subtitle || '按章节刷题与复盘') + '</div>' +
      '<h1>' + (nickname ? esc(nickname) + '，' : '') + '把每一道错题，<br><em>变成会做的题。</em></h1>' +
      '<p class="hero-sub">按章节练习、AI 批改、错题重刷。计算题可以直接在平板上手写，提交后立刻知道哪里出了问题。</p>' +
      '<div class="hero-actions">' +
      (primaryCh
        ? '<button class="btn btn-primary btn-lg" data-start-chapter="' + esc(primaryCh.id) + '" data-start-mode="' + (hasSession ? 'resume' : 'continue') + '">' +
          Phys.icon(hasSession ? 'play' : 'arrowRight') + (hasSession ? (st.session.finished ? '查看上次结果' : '继续上次练习') : continueStats.answered ? '继续 ' + esc(primaryCh.title) : '开始第一章') + '</button>'
        : '') +
      '<a class="btn btn-ghost btn-lg" href="' + (continueCh ? '#/knowledge/' + encodeURIComponent(continueCh.id) : '#/home') + '">' + Phys.icon('bookOpen') + '先看知识讲解</a>' +
      '</div>' +
      '<div class="hero-meta">' +
      '<span>' + Phys.icon('layers') + chapters.length + ' 个章节</span>' +
      '<span>' + Phys.icon('list') + stats.total + ' 道题</span>' +
      '<span>' + Phys.icon('spark') + (Phys.Store.hasAI() ? 'AI 批改已就绪' : '可配置 AI 批改') + '</span>' +
      '</div>' +
      '</div>' +
      '<div class="hero-visual">' +
      '<div class="hero-orbit orbit-1"></div><div class="hero-orbit orbit-2"></div>' +
      '<div class="hero-glow"></div>' +
      '<div class="hero-ring">' + UI.ring(stats.progress, { size: 188, label: '总进度' }) + '</div>' +
      '<div class="float-stat float-a"><span>待攻克错题</span><strong>' + stats.wrongActive + '</strong></div>' +
      '<div class="float-stat float-b"><span>连续学习</span><strong>' + stats.streak + '<small>天</small></strong></div>' +
      '<div class="float-stat float-c"><span>今日完成</span><strong>' + today + '<small>题</small></strong></div>' +
      '</div>' +
      '</section>';

    const statCards =
      '<section class="stat-grid">' +
      [
        { label: '已练题目', value: stats.answered, unit: '/ ' + stats.total, icon: 'target', tone: 'blue' },
        { label: '当前正确率', value: stats.answered ? UI.pct(stats.accuracy) : 0, unit: '%', icon: 'chart', tone: 'green' },
        { label: '待攻克错题', value: stats.wrongActive, unit: '道', icon: 'wrong', tone: 'red' },
        { label: '累计作答', value: stats.attempts, unit: '次', icon: 'refresh', tone: 'amber' }
      ].map(function (c) {
        return (
          '<div class="stat-card tone-' + c.tone + '">' +
          '<div class="stat-icon">' + Phys.icon(c.icon) + '</div>' +
          '<div class="stat-value">' + c.value + '<small>' + c.unit + '</small></div>' +
          '<div class="stat-label">' + c.label + '</div>' +
          '</div>'
        );
      }).join('') +
      '</section>';

    const chapterSection =
      '<section class="section">' +
      UI.sectionTitle('章节练习', '按章节推进，进度会自动保存', '<a class="text-link" href="#/wrong">查看错题本 ' + Phys.icon('arrowRight') + '</a>') +
      '<div class="chapter-grid">' + chapters.map(UI.chapterCard).join('') + '</div>' +
      '</section>';

    const wrongSection =
      '<section class="section two-col">' +
      '<div class="panel">' +
      UI.sectionTitle('最近错题', activeWrong.length ? '从错题开始，效率最高' : '还没有错题', '<a class="text-link" href="#/wrong">全部 ' + activeWrong.length + ' 道 ' + Phys.icon('arrowRight') + '</a>') +
      (recentWrong.length
        ? '<div class="recent-list">' + recentWrong.map(function (qid) {
            const row = Phys.Store.getQuestion(qid);
            if (!row) return '';
            const p = Phys.Store.getQuestionProgress(qid);
            return (
              '<button class="recent-item" data-start-qid="' + esc(qid) + '">' +
              '<span class="recent-type">' + Phys.Store.TYPE_LABEL[row.q.type].slice(0, 2) + '</span>' +
              '<span class="recent-main"><strong>' + esc(UI.questionPreview(row.q)) + '</strong><span>' + esc(row.chapter.title) + ' · 错 ' + (p ? p.wrong : 1) + ' 次</span></span>' +
              Phys.icon('chevronRight') +
              '</button>'
            );
          }).join('') + '</div>'
        : '<div class="mini-empty">做错的题会自动进入错题本；重做答对后标记为「已攻克」。</div>') +
      '</div>' +
      '<div class="panel ai-panel">' +
      '<div class="ai-panel-head"><div class="ai-orb">' + Phys.icon('spark') + '</div><div><h3>AI 批改与薄弱点</h3><p>' + (Phys.Store.hasAI() ? '已配置 · ' + esc(Phys.Store.getAIConfig().model) : '还没有配置') + '</p></div></div>' +
      '<p class="ai-panel-text">' + (Phys.Store.hasAI()
        ? '计算题和填空题会自动批改，指出第一个错误步骤，并生成同知识点的「举一反三」练习。'
        : '配置一个 OpenAI 兼容接口后，计算题、填空题可以自动批改；手写题再配一个视觉模型即可。') + '</p>' +
      '<div class="ai-panel-foot">' +
      '<a class="btn ' + (Phys.Store.hasAI() ? 'btn-soft' : 'btn-primary') + '" href="#/settings">' + (Phys.Store.hasAI() ? '查看 AI 设置' : '去配置 AI') + '</a>' +
      (activeWrong.length ? '<a class="btn btn-ghost" href="#/insights">' + Phys.icon('spark') + '生成薄弱点报告</a>' : '') +
      '</div>' +
      '</div>' +
      '</section>';

    return {
      html: hero + statCards + chapterSection + wrongSection,
      mount: function (root) {
        UI.bindCommon(root);
      }
    };
  };

  // ================= 章节 =================
  V.chapter = function (chapterId) {
    const ch = Phys.Store.getChapter(chapterId);
    if (!ch) {
      return { html: UI.empty('alert', '章节不存在', '这个章节可能已被新题库替换。', '<a class="btn btn-primary" href="#/home">回到首页</a>') };
    }
    const s = Phys.chapterStats(ch);
    const wrongs = Phys.Store.wrongQids({ chapterId: ch.id, resolved: false });
    const pct = UI.pct(s.progress);
    const hero =
      '<header class="chapter-hero">' +
      '<div class="chapter-hero-copy">' +
      '<div class="eyebrow">CHAPTER ' + String(ch.number || 0).padStart(2, '0') + ' · ' + ch.questions.length + ' 道题</div>' +
      '<h1>' + esc(ch.title) + '</h1>' +
      '<p>' + esc(ch.intro || '') + '</p>' +
      '<div class="chapter-hero-actions">' +
      '<button class="btn btn-primary btn-lg" data-start-chapter="' + esc(ch.id) + '" data-start-mode="all">' + Phys.icon('play') + '开始顺序练习</button>' +
      '<button class="btn btn-ghost" data-start-chapter="' + esc(ch.id) + '" data-start-mode="new">只做未做</button>' +
      '<button class="btn btn-ghost" data-start-chapter="' + esc(ch.id) + '" data-start-mode="random">随机练习</button>' +
      (wrongs.length ? '<button class="btn btn-soft" data-start-chapter="' + esc(ch.id) + '" data-start-mode="wrong">' + Phys.icon('wrong') + '重刷本章错题 ' + wrongs.length + '</button>' : '') +
      '</div>' +
      '</div>' +
      '<div class="chapter-hero-side">' +
      '<div class="chapter-ring">' + UI.ring(s.progress, { size: 150, label: '本章进度' }) + '</div>' +
      '<div class="chapter-mini-stats">' +
      '<div><strong>' + s.answered + '<small>/' + s.total + '</small></strong><span>已练</span></div>' +
      '<div><strong>' + (s.answered ? UI.pct(s.accuracy) : 0) + '<small>%</small></strong><span>正确率</span></div>' +
      '<div><strong>' + s.wrongActive + '</strong><span>错题</span></div>' +
      '</div>' +
      '</div>' +
      '</header>';

    const knowledgePanel =
      '<section class="panel knowledge-panel">' +
      UI.sectionTitle('知识讲解', '先理解，再做题；每个知识点都配有公式、易错点和例题', '<a class="text-link" href="#/knowledge/' + encodeURIComponent(ch.id) + '">阅读全文 ' + Phys.icon('arrowRight') + '</a>') +
      (ch.knowledge.length
        ? '<div class="knowledge-list">' + ch.knowledge.map(function (k, i) {
            return (
              '<a class="knowledge-item" href="#/knowledge/' + encodeURIComponent(ch.id) + '?k=' + encodeURIComponent(k.id) + '">' +
              '<span class="ki-num">' + String(i + 1).padStart(2, '0') + '</span>' +
              '<span class="ki-main"><strong>' + esc(k.title) + '</strong><span>' + esc(Phys.truncate(Phys.stripMarkdown(k.summary), 78)) + '</span>' +
              '<span class="ki-meta">' + k.formulas.length + ' 个公式 · ' + k.pitfalls.length + ' 个易错点</span></span>' +
              Phys.icon('chevronRight') +
              '</a>'
            );
          }).join('') + '</div>'
        : '<div class="mini-empty">本章还没有知识点内容。</div>') +
      '</section>';

    const side =
      '<aside class="chapter-side">' +
      '<div class="panel overview-card">' +
      '<h3>本章概览</h3>' +
      '<div class="overview-row"><span>题目总数</span><strong>' + s.total + '</strong></div>' +
      '<div class="overview-row"><span>已完成</span><strong>' + s.answered + '</strong></div>' +
      '<div class="overview-row"><span>待攻克</span><strong class="danger">' + s.wrongActive + '</strong></div>' +
      '<div class="overview-row"><span>已攻克</span><strong class="success">' + s.resolved + '</strong></div>' +
      '<div class="overview-bar">' + UI.progress(s.progress) + '<span>' + pct + '%</span></div>' +
      '<div class="overview-note">' + (s.progress === 0 ? '从第一道题开始，先做再复盘。' : s.progress >= 1 ? '本章已全部做过，建议重刷错题或随机练习。' : '继续推进，错题会自动收进错题本。') + '</div>' +
      '</div>' +
      '<div class="panel tip-card">' +
      '<div class="tip-icon">' + Phys.icon('zap') + '</div>' +
      '<h4>平板书写提示</h4>' +
      '<p>计算题可以直接用手写笔在答题区写过程。检测到触控笔后会自动忽略手掌触摸，也可以点「全屏」放大书写。</p>' +
      '</div>' +
      '</aside>';

    const questionRows =
      '<section class="panel question-list-panel">' +
      UI.sectionTitle('题目列表', '点击任意一题，从该题开始练习') +
      '<div class="question-rows">' + ch.questions.map(function (q, i) {
        const status = Phys.Store.statusOf(q.id);
        return (
          '<button class="question-row" data-start-chapter="' + esc(ch.id) + '" data-start-mode="all" data-start-index="' + i + '">' +
          '<span class="qr-num">' + String(i + 1).padStart(2, '0') + '</span>' +
          '<span class="qr-main"><span class="qr-stem">' + esc(UI.questionPreview(q)) + '</span>' +
          '<span class="qr-meta">' + UI.typeBadge(q.type) + UI.diff(q.difficulty) + '</span></span>' +
          UI.statusPill(status) +
          Phys.icon('chevronRight') +
          '</button>'
        );
      }).join('') + '</div>' +
      '</section>';

    return {
      html: hero + '<div class="chapter-layout">' + knowledgePanel + side + '</div>' + questionRows,
      mount: function (root) {
        UI.bindCommon(root);
      }
    };
  };

  // ================= 知识讲解 =================
  V.knowledge = function (chapterId, query) {
    const ch = Phys.Store.getChapter(chapterId);
    if (!ch) return { html: UI.empty('alert', '章节不存在', '请从首页重新选择章节。', '<a class="btn btn-primary" href="#/home">回到首页</a>') };
    const s = Phys.chapterStats(ch);
    if (!ch.knowledge.length) {
      return {
        html: UI.pageHead({ eyebrow: '第 ' + ch.number + ' 章', title: esc(ch.title), subtitle: esc(ch.intro) }) +
          UI.empty('bookOpen', '本章还没有知识讲解', '可以在题库 JSON 的 knowledge 字段中补充。', '<button class="btn btn-primary" data-start-chapter="' + esc(ch.id) + '" data-start-mode="all">直接做题</button>')
      };
    }

    const toc =
      '<aside class="knowledge-toc">' +
      '<div class="toc-title">本章目录</div>' +
      '<div class="toc-list">' + ch.knowledge.map(function (k, i) {
        return '<button class="toc-item" data-toc="' + esc(k.id) + '"><span>' + String(i + 1).padStart(2, '0') + '</span>' + esc(k.title) + '</button>';
      }).join('') + '</div>' +
      '<div class="toc-progress"><div class="toc-p-label"><span>本章练习进度</span><strong>' + UI.pct(s.progress) + '%</strong></div>' + UI.progress(s.progress) + '</div>' +
      '<button class="btn btn-primary btn-block" data-start-chapter="' + esc(ch.id) + '" data-start-mode="all">' + Phys.icon('play') + '开始本章练习</button>' +
      '</aside>';

    const sections = ch.knowledge.map(function (k, i) {
      const formulas = k.formulas.length
        ? '<div class="formula-grid">' + k.formulas.map(function (f) {
            return (
              '<div class="formula-card">' +
              '<div class="formula-tex">' + Phys.katexRender(f.tex, true) + '</div>' +
              (f.note ? '<div class="formula-note">' + Phys.renderMath(f.note) + '</div>' : '') +
              '</div>'
            );
          }).join('') + '</div>'
        : '';
      const points = k.points.length
        ? '<div class="k-points">' + k.points.map((p) => '<div class="rich">' + Phys.renderRich(p) + '</div>').join('') + '</div>'
        : '';
      const pitfalls = k.pitfalls.length
        ? '<div class="pitfall-box"><div class="pitfall-head">' + Phys.icon('alert') + '<h4>易错点</h4></div><ul>' +
          k.pitfalls.map((p) => '<li>' + Phys.renderRich(p, { inline: true }) + '</li>').join('') + '</ul></div>'
        : '';
      const examples = k.examples.length
        ? '<div class="examples">' + k.examples.map(function (e, ei) {
            return (
              '<details class="worked-example">' +
              '<summary><span class="we-label">例题 ' + (ei + 1) + '</span><span class="we-q">' + Phys.renderRich(e.question, { inline: true }) + '</span><span class="we-toggle">解析 ' + Phys.icon('chevronDown') + '</span></summary>' +
              '<div class="we-body"><div class="we-solution-label">解答</div><div class="rich">' + Phys.renderRich(e.solution) + '</div></div>' +
              '</details>'
            );
          }).join('') + '</div>'
        : '';
      return (
        '<section class="knowledge-section" id="k-' + esc(k.id) + '">' +
        '<div class="ks-head"><span class="ks-index">' + String(i + 1).padStart(2, '0') + '</span><div><div class="ks-kicker">KNOWLEDGE POINT</div><h2>' + esc(k.title) + '</h2></div></div>' +
        (k.summary ? '<p class="ks-summary">' + esc(Phys.stripMarkdown(k.summary)) + '</p>' : '') +
        formulas + points + pitfalls + examples +
        '</section>'
      );
    }).join('');

    const related =
      '<section class="panel related-panel">' +
      UI.sectionTitle('相关题目', '学完知识点，马上用题目检验') +
      '<div class="related-grid">' + ch.questions.map(function (q, i) {
        const status = Phys.Store.statusOf(q.id);
        return (
          '<button class="related-q" data-start-qid="' + esc(q.id) + '">' +
          '<span class="rq-top">' + UI.typeBadge(q.type) + UI.statusPill(status) + '</span>' +
          '<span class="rq-stem">' + esc(UI.questionPreview(q)) + '</span>' +
          '<span class="rq-foot">第 ' + (i + 1) + ' 题 ' + Phys.icon('arrowRight') + '</span>' +
          '</button>'
        );
      }).join('') + '</div>' +
      '</section>';

    return {
      html:
        '<header class="knowledge-hero">' +
        '<a class="back-link" href="#/chapter/' + encodeURIComponent(ch.id) + '">' + Phys.icon('arrowLeft') + '返回章节</a>' +
        '<div class="eyebrow">第 ' + ch.number + ' 章 · 知识讲解</div>' +
        '<h1>' + esc(ch.title) + '</h1>' +
        '<p>' + esc(ch.intro || '') + '</p>' +
        '<div class="knowledge-hero-meta"><span>' + ch.knowledge.length + ' 个知识点</span><span>' + ch.questions.length + ' 道配套题</span><span>已练 ' + s.answered + '/' + s.total + '</span></div>' +
        '</header>' +
        '<div class="knowledge-layout"><div class="knowledge-article">' + sections + related + '</div>' + toc + '</div>',
      mount: function (root) {
        UI.bindCommon(root);
        root.querySelectorAll('[data-toc]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            const el = document.getElementById('k-' + btn.getAttribute('data-toc'));
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          });
        });
        if (query && query.k) {
          setTimeout(function () {
            const el = document.getElementById('k-' + query.k);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 80);
        }
      }
    };
  };

  // ================= 错题本 =================
  function wrongFilter() {
    if (!Phys.state.wrongFilter) Phys.state.wrongFilter = { chapter: 'all', type: 'all', status: 'active' };
    return Phys.state.wrongFilter;
  }

  function wrongDetail(qid, chapter, q, p) {
    const source = { ai: 'AI 批改', local: '本地判分', self: '自评' }[p.lastSource] || '判分';
    return (
      '<div class="wrong-detail">' +
      '<div class="wd-grid">' +
      '<div class="wd-block"><div class="wd-label">你的答案</div><div class="wd-answer">' + esc(UI.answerText(q, p.lastAnswer)) + '</div></div>' +
      '<div class="wd-block"><div class="wd-label">判分结果</div><div class="wd-answer"><span class="source-tag">' + source + '</span> ' + esc(p.lastVerdict || '—') + '</div></div>' +
      '</div>' +
      (p.lastFeedback ? '<div class="wd-block"><div class="wd-label">讲评</div><div class="rich wd-rich">' + Phys.renderRich(p.lastFeedback) + '</div></div>' : '') +
      (p.correctSolution ? '<div class="wd-block"><div class="wd-label">参考答案</div><div class="rich wd-rich">' + Phys.renderRich(p.correctSolution) + '</div></div>' : '') +
      (p.knowledgeGaps && p.knowledgeGaps.length
        ? '<div class="wd-block"><div class="wd-label">暴露的知识点</div><div class="gap-list">' + p.knowledgeGaps.map((g) => '<span class="gap-chip">' + esc(g.point) + '</span>').join('') + '</div></div>'
        : '') +
      (p.similar && p.similar.question
        ? '<details class="similar-box"><summary>' + Phys.icon('spark') + '举一反三：换一道题试试<span>展开</span></summary><div class="similar-body"><div class="rich">' + Phys.renderRich(p.similar.question) + '</div>' + (p.similar.hint ? '<p class="similar-hint">提示：' + Phys.renderRich(p.similar.hint, { inline: true }) + '</p>' : '') + (p.similar.solution ? '<details class="similar-sol"><summary>查看解析</summary><div class="rich">' + Phys.renderRich(p.similar.solution) + '</div></details>' : '') + '</div></details>'
        : '') +
      '</div>'
    );
  }

  V.wrong = function () {
    const filter = wrongFilter();
    const allActive = Phys.Store.wrongQids({ resolved: false });
    const resolvedAll = Phys.Store.wrongQids({ resolved: true });
    const expanded = Phys.state.expandedWrong || (Phys.state.expandedWrong = new Set());
    const base = filter.status === 'resolved' ? resolvedAll : allActive;
    const filtered = base.filter(function (qid) {
      const row = Phys.Store.getQuestion(qid);
      if (!row) return false;
      if (filter.chapter !== 'all' && row.chapter.id !== filter.chapter) return false;
      if (filter.type !== 'all' && row.q.type !== filter.type) return false;
      return true;
    });
    const types = ['all', 'single', 'multiple', 'blank', 'calc'];
    const activeChapter = filter.chapter;

    const header =
      '<header class="page-head wrong-head">' +
      '<div class="eyebrow">REVIEW & REBUILD</div>' +
      '<h1>错题本</h1>' +
      '<p class="page-sub">错题不是收藏品。重做、弄懂、再换一道同知识点的题验证，才算真正掌握。</p>' +
      '<div class="page-actions">' +
      '<button class="btn btn-primary btn-lg" data-start-mode="wrong-all"' + (allActive.length ? '' : ' disabled') + '>' + Phys.icon('refresh') + '重刷全部错题' + (allActive.length ? ' · ' + allActive.length : '') + '</button>' +
      '<a class="btn btn-ghost" href="#/insights">' + Phys.icon('spark') + '薄弱点总结</a>' +
      '</div>' +
      '</header>';

    const overview =
      '<div class="wrong-overview">' +
      '<div class="wo-stat"><span>待攻克</span><strong>' + allActive.length + '</strong></div>' +
      '<div class="wo-stat"><span>已攻克</span><strong class="success">' + resolvedAll.length + '</strong></div>' +
      '<div class="wo-stat"><span>累计作答</span><strong>' + Phys.state.stats.attempts + '</strong></div>' +
      '<div class="wo-stat wo-note"><span>建议</span><p>' + (allActive.length ? '先重刷错题，再按知识点做「举一反三」。' : '暂时没有待攻克错题，保持练习节奏。') + '</p></div>' +
      '</div>';

    const chapterOptions = Phys.state.bank.chapters.map(function (ch) {
      return '<button class="filter-chip' + (activeChapter === ch.id ? ' is-active' : '') + '" data-wfilter="chapter" data-value="' + esc(ch.id) + '">' + esc(ch.title) + '</button>';
    }).join('');
    const typeOptions = types.map(function (t) {
      const label = t === 'all' ? '全部题型' : Phys.Store.TYPE_LABEL[t];
      return '<button class="filter-chip' + (filter.type === t ? ' is-active' : '') + '" data-wfilter="type" data-value="' + t + '">' + label + '</button>';
    }).join('');
    const filters =
      '<div class="filter-bar">' +
      '<div class="filter-group"><span class="filter-label">状态</span>' +
      '<button class="filter-chip' + (filter.status === 'active' ? ' is-active' : '') + '" data-wfilter="status" data-value="active">待攻克</button>' +
      '<button class="filter-chip' + (filter.status === 'resolved' ? ' is-active' : '') + '" data-wfilter="status" data-value="resolved">已攻克</button>' +
      '</div>' +
      '<div class="filter-group"><span class="filter-label">章节</span><button class="filter-chip' + (activeChapter === 'all' ? ' is-active' : '') + '" data-wfilter="chapter" data-value="all">全部</button>' + chapterOptions + '</div>' +
      '<div class="filter-group"><span class="filter-label">题型</span>' + typeOptions + '</div>' +
      '</div>';

    let list;
    if (!filtered.length) {
      list = UI.empty(
        filter.status === 'resolved' ? 'checkCircle' : 'trophy',
        filter.status === 'resolved' ? '还没有已攻克的错题' : '这个筛选下没有错题',
        filter.status === 'resolved' ? '重做错题并答对后，会自动出现在这里。' : '换个筛选条件，或者去章节里做几道题。',
        '<button class="btn btn-primary" data-start-mode="wrong-all"' + (allActive.length ? '' : ' disabled') + '>重刷错题</button>'
      );
    } else {
      list = '<div class="wrong-list">' + filtered.map(function (qid) {
        const row = Phys.Store.getQuestion(qid);
        const p = Phys.Store.getQuestionProgress(qid);
        if (!row || !p) return '';
        const isOpen = expanded.has(qid);
        return (
          '<article class="wrong-item ' + (isOpen ? 'is-open' : '') + '">' +
          '<div class="wi-top">' +
          '<span class="wi-chapter">' + esc(row.chapter.title) + '</span>' +
          UI.typeBadge(row.q.type) + UI.diff(row.q.difficulty) +
          UI.statusPill(Phys.Store.statusOf(qid)) +
          '<span class="wi-time">' + esc(Phys.relativeTime(p.lastAt)) + '</span>' +
          '</div>' +
          '<h3 class="wi-stem">' + Phys.renderRich(row.q.stem, { inline: true }) + '</h3>' +
          '<div class="wi-meta"><span>错 ' + p.wrong + ' 次</span><span>最近得分 ' + p.lastScore + '</span>' + (p.knowledgeGaps && p.knowledgeGaps.length ? '<span>' + esc(p.knowledgeGaps.map((g) => g.point).slice(0, 2).join('、')) + '</span>' : '') + '</div>' +
          '<div class="wi-actions">' +
          '<button class="btn btn-primary btn-sm" data-start-qid="' + esc(qid) + '">' + Phys.icon('refresh') + '重刷这题</button>' +
          '<button class="btn btn-ghost btn-sm" data-wrong-toggle="' + esc(qid) + '">' + (isOpen ? '收起解析' : '查看解析与举一反三') + '</button>' +
          (filter.status === 'resolved'
            ? '<button class="btn btn-ghost btn-sm" data-wrong-restore="' + esc(qid) + '">重新加入待攻克</button>'
            : '<button class="btn btn-ghost btn-sm danger-text" data-wrong-remove="' + esc(qid) + '">移出错题本</button>') +
          '</div>' +
          (isOpen ? wrongDetail(qid, row.chapter, row.q, p) : '') +
          '</article>'
        );
      }).join('') + '</div>';
    }

    return {
      html: header + overview + filters + list,
      mount: function (root) {
        UI.bindCommon(root);
        root.querySelectorAll('[data-wfilter]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            const key = btn.getAttribute('data-wfilter');
            filter[key] = btn.getAttribute('data-value');
            Phys.App.rerender({ keepScroll: true });
          });
        });
        root.querySelectorAll('[data-wrong-toggle]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            const qid = btn.getAttribute('data-wrong-toggle');
            if (expanded.has(qid)) expanded.delete(qid);
            else expanded.add(qid);
            Phys.App.rerender();
          });
        });
        root.querySelectorAll('[data-wrong-remove]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            const qid = btn.getAttribute('data-wrong-remove');
            Phys.Store.removeFromWrong(qid);
            Phys.toast('已移出错题本，可在「已攻克」中找回', 'success');
            Phys.App.rerender();
          });
        });
        root.querySelectorAll('[data-wrong-restore]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            const qid = btn.getAttribute('data-wrong-restore');
            Phys.Store.restoreToWrong(qid);
            Phys.toast('已重新加入待攻克', 'success');
            Phys.App.rerender();
          });
        });
      }
    };
  };

  // ================= 薄弱点 =================
  function renderInsightReport(saved) {
    const p = saved.payload;
    const weak = (p.weakPoints || []).map(function (w, i) {
      return (
        '<div class="insight-point">' +
        '<div class="ip-num">' + String(i + 1).padStart(2, '0') + '</div>' +
        '<div class="ip-main"><div class="ip-head"><h4>' + esc(w.point) + '</h4>' + (w.chapter ? '<span class="chip">' + esc(w.chapter) + '</span>' : '') + '</div>' +
        (w.why ? '<p class="ip-why"><strong>为什么错：</strong>' + esc(w.why) + '</p>' : '') +
        (w.explain ? '<div class="rich ip-explain">' + Phys.renderRich(w.explain) + '</div>' : '') +
        (w.fix ? '<p class="ip-fix"><strong>怎么补：</strong>' + esc(w.fix) + '</p>' : '') +
        '</div></div>'
      );
    }).join('');
    const patterns = (p.patterns || []).map(function (x) {
      return '<div class="pattern-item"><strong>' + esc(x.title) + '</strong><p>' + esc(x.detail) + '</p></div>';
    }).join('');
    const plan = (p.plan || []).map(function (x, i) {
      return '<div class="plan-item"><span class="plan-dot"></span><div><strong>第 ' + (i + 1) + ' 步</strong><p>' + esc(x) + '</p></div></div>';
    }).join('');
    const examples = (p.examples || []).map(function (e, i) {
      return (
        '<details class="insight-example">' +
        '<summary><span class="ie-num">' + (i + 1) + '</span><span class="ie-main"><strong>' + esc(e.point || '举一反三') + '</strong><span>' + esc(Phys.truncate(Phys.stripMarkdown(e.question), 120)) + '</span></span><span class="ie-toggle">展开</span></summary>' +
        '<div class="ie-body"><div class="rich">' + Phys.renderRich(e.question) + '</div>' +
        (e.hint ? '<div class="ie-hint">' + Phys.icon('info') + '<span>提示：' + Phys.renderRich(e.hint, { inline: true }) + '</span></div>' : '') +
        (e.solution ? '<details class="similar-sol"><summary>查看解析</summary><div class="rich">' + Phys.renderRich(e.solution) + '</div></details>' : '') +
        '</div></details>'
      );
    }).join('');

    return (
      '<div class="insight-report">' +
      (p.overview ? '<div class="insight-overview"><div class="io-icon">' + Phys.icon('spark') + '</div><div><div class="io-kicker">AI 诊断</div><p>' + esc(p.overview) + '</p></div></div>' : '') +
      (weak ? '<section class="report-section"><h3>最需要补的 ' + p.weakPoints.length + ' 个点</h3><div class="insight-points">' + weak + '</div></section>' : '') +
      (patterns ? '<section class="report-section"><h3>反复出现的错误模式</h3><div class="pattern-list">' + patterns + '</div></section>' : '') +
      (plan ? '<section class="report-section"><h3>7 天最小复习计划</h3><div class="plan-list">' + plan + '</div></section>' : '') +
      (examples ? '<section class="report-section"><h3>举一反三 · 再练 3 题</h3><div class="example-list">' + examples + '</div></section>' : '') +
      '</div>'
    );
  }

  V.insights = function () {
    const active = Phys.Store.wrongQids({ resolved: false });
    const weak = Phys.Store.weakKnowledge();
    const typeMap = Phys.Store.typeBreakdown();
    const saved = Phys.Store.loadInsight();
    const stale = saved && saved.fingerprint !== Phys.Store.insightKey();
    const maxCount = weak.length ? weak[0].count : 1;

    const header =
      '<header class="page-head insights-head">' +
      '<div class="eyebrow">DIAGNOSE & TRANSFER</div>' +
      '<h1>薄弱点总结</h1>' +
      '<p class="page-sub">从错题里找规律，把「这一题不会」变成「这一类题都会」。</p>' +
      '<div class="page-actions">' +
      (active.length
        ? '<button class="btn btn-primary btn-lg" id="generate-insight">' + Phys.icon('spark') + (saved ? '重新生成 AI 诊断' : '生成 AI 诊断') + '</button>'
        : '<a class="btn btn-primary btn-lg" href="#/home">' + Phys.icon('bookOpen') + '先去做几道题</a>') +
      '<a class="btn btn-ghost" href="#/wrong">' + Phys.icon('wrong') + '查看错题本</a>' +
      '</div>' +
      '</header>';

    if (!active.length) {
      return {
        html: header + UI.empty('trophy', '还没有需要复盘的错题', '做完练习后，做错的题会自动汇总到这里；AI 会帮你找规律、生成举一反三练习。', '<a class="btn btn-primary" href="#/home">去练习</a>'),
        mount: function (root) {}
      };
    }

    const local =
      '<section class="insight-local">' +
      '<div class="panel weak-panel">' +
      UI.sectionTitle('高频薄弱知识点', '按当前错题涉及的次数排序', '<span class="muted">' + active.length + ' 道错题</span>') +
      '<div class="weak-list">' + weak.slice(0, 8).map(function (w, i) {
        return (
          '<div class="weak-row">' +
          '<span class="weak-rank">' + String(i + 1).padStart(2, '0') + '</span>' +
          '<div class="weak-main"><div class="weak-head"><strong>' + esc(w.title) + '</strong><span>' + w.count + ' 题</span></div>' +
          '<div class="weak-bar"><i style="width:' + Math.round((w.count / maxCount) * 100) + '%"></i></div>' +
          '<div class="weak-sub">' + esc(w.chapterTitle) + '</div></div>' +
          '<button class="weak-jump" data-start-chapter="' + esc(w.chapterId) + '" data-start-mode="wrong" title="重刷该章错题">' + Phys.icon('arrowRight') + '</button>' +
          '</div>'
        );
      }).join('') + '</div>' +
      '</div>' +
      '<div class="panel breakdown-panel">' +
      UI.sectionTitle('错题结构', '看看问题集中在哪种题型') +
      '<div class="type-bars">' + Object.keys(typeMap).map(function (t) {
        const n = typeMap[t];
        const pct = active.length ? Math.round((n / active.length) * 100) : 0;
        return '<div class="type-bar-row"><span>' + Phys.Store.TYPE_LABEL[t] + '</span><div class="type-bar"><i class="type-' + t + '" style="width:' + pct + '%"></i></div><strong>' + n + '</strong></div>';
      }).join('') + '</div>' +
      '<div class="insight-tip">' + Phys.icon('info') + '<p>' + (Phys.Store.hasAI() ? '点击上方「生成 AI 诊断」，让 AI 结合你的具体作答，找出错误模式和 7 天复习路径。' : '配置 AI 后，可以结合每道题的具体作答生成诊断，而不是只统计知识点。') + '</p></div>' +
      '</div>' +
      '</section>';

    const aiSection =
      '<section class="ai-report-section">' +
      '<div class="report-head"><div><div class="eyebrow">AI DIAGNOSIS</div><h2>个性化诊断报告</h2></div>' +
      (saved ? '<span class="report-time">生成于 ' + esc(Phys.relativeTime(saved.at)) + '</span>' : '') + '</div>' +
      (!Phys.Store.hasAI()
        ? '<div class="panel config-callout"><div class="config-icon">' + Phys.icon('key') + '</div><div><h3>还没有配置 AI 批改</h3><p>配置 OpenAI 兼容接口后，AI 会结合你的错题和作答，生成薄弱点解释、错误模式、7 天计划和 3 道举一反三题。</p><a class="btn btn-primary" href="#/settings">去配置 AI</a></div></div>'
        : saved
          ? (stale ? '<div class="stale-note">' + Phys.icon('info') + '错题有更新，这份报告可能已过期，建议重新生成。</div>' : '') + renderInsightReport(saved)
          : '<div class="panel report-placeholder"><div class="report-placeholder-icon">' + Phys.icon('spark') + '</div><h3>把错题交给 AI 复盘</h3><p>AI 会阅读当前 ' + active.length + ' 道错题的作答与讲评，归纳你的错误模式，并给出可执行的复习计划。</p><button class="btn btn-primary btn-lg" id="generate-insight-2">' + Phys.icon('spark') + '生成诊断报告</button><span class="muted">需要 10–30 秒</span></div>') +
      '</section>';

    return {
      html: header + local + aiSection,
      mount: function (root) {
        UI.bindCommon(root);
        const btn = root.querySelector('#generate-insight') || root.querySelector('#generate-insight-2');
        if (btn) {
          btn.addEventListener('click', async function () {
            if (!Phys.Store.hasAI()) {
              location.hash = '#/settings';
              return;
            }
            const original = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner"></span>AI 正在分析你的错题…';
            try {
              const items = Phys.Grader.buildInsightItems();
              const payload = await Phys.Grader.generateInsight(items);
              Phys.Store.saveInsight(payload);
              Phys.toast('诊断报告已生成', 'success');
              Phys.App.rerender();
            } catch (e) {
              console.error(e);
              Phys.toast(Phys.AI.friendlyError(e), 'error', 6000);
              btn.disabled = false;
              btn.innerHTML = original;
            }
          });
        }
      }
    };
  };

  V.notFound = function () {
    return {
      html: UI.empty('alert', '页面不存在', '链接可能已经失效。', '<a class="btn btn-primary" href="#/home">回到首页</a>')
    };
  };

  window.Phys.Views = V;
})();
