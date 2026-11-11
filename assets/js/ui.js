/* 共享界面组件：侧栏、顶栏、进度条、章节卡片、空状态 */
(function () {
  const Phys = (window.Phys = window.Phys || {});
  const UI = {};

  UI.pct = function (v) {
    return Math.round(Phys.clamp(v || 0, 0, 1) * 100);
  };

  UI.progress = function (value, opts) {
    opts = opts || {};
    const pct = UI.pct(value);
    return (
      '<div class="progress ' + (opts.className || '') + '" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100">' +
      '<div class="progress-fill" style="width:' + pct + '%"></div>' +
      '</div>'
    );
  };

  UI.ring = function (value, opts) {
    opts = opts || {};
    const pct = UI.pct(value);
    const size = opts.size || 156;
    return (
      '<div class="ring" style="width:' + size + 'px;height:' + size + 'px">' +
      '<svg viewBox="0 0 120 120" aria-hidden="true">' +
      '<circle class="ring-bg" cx="60" cy="60" r="52" pathLength="100"></circle>' +
      '<circle class="ring-fill" cx="60" cy="60" r="52" pathLength="100" stroke-dasharray="100" stroke-dashoffset="' + (100 - pct) + '"></circle>' +
      '</svg>' +
      '<div class="ring-center"><strong>' + pct + '<small>%</small></strong><span>' + (opts.label || '总进度') + '</span></div>' +
      '</div>'
    );
  };

  UI.typeBadge = function (type) {
    const label = Phys.Store.TYPE_LABEL[type] || type;
    return '<span class="type-badge type-' + type + '">' + label + '</span>';
  };

  UI.statusPill = function (status, opts) {
    opts = opts || {};
    const label = opts.label || Phys.Store.statusLabel[status] || status;
    return '<span class="status-pill status-' + status + '"><i></i>' + label + '</span>';
  };

  UI.diff = function (n) {
    const lv = Phys.clamp(Number(n) || 1, 1, 5);
    let html = '<span class="diff" title="难度 ' + lv + '/5">';
    for (let i = 1; i <= 5; i++) html += '<i class="' + (i <= lv ? 'on' : '') + '"></i>';
    return html + '</span>';
  };

  UI.chip = function (text, kind, attrs) {
    return '<span class="chip chip-' + (kind || 'default') + '" ' + (attrs || '') + '>' + Phys.escapeHtml(text) + '</span>';
  };

  UI.questionPreview = function (q) {
    return Phys.truncate(Phys.stripMarkdown(q.stem), 92);
  };

  UI.aiPill = function () {
    const ok = Phys.Store.hasAI();
    let text = ok ? 'AI 批改已连接' : 'AI 未配置';
    if (ok && Phys.Store.hasVision()) text = 'AI + 手写识别';
    return '<a class="ai-pill ' + (ok ? 'is-on' : '') + '" href="#/settings" title="' + (ok ? '点击查看 / 修改 AI 配置' : '配置 AI 批改') + '"><span class="ai-dot"></span><span class="ai-pill-text">' + text + '</span></a>';
  };

  function chapterStatsMap() {
    const map = new Map();
    (Phys.state.stats ? Phys.state.stats.chapters : []).forEach((row) => map.set(row.chapter.id, row.stats));
    return map;
  }

  UI.brandMark = function () {
    return (
      '<svg class="brand-atom" viewBox="0 0 48 48" fill="none" aria-hidden="true">' +
      '<ellipse cx="24" cy="24" rx="20" ry="8" stroke="currentColor" stroke-width="1.4" transform="rotate(30 24 24)"/>' +
      '<ellipse cx="24" cy="24" rx="20" ry="8" stroke="currentColor" stroke-width="1.4" transform="rotate(-30 24 24)"/>' +
      '<circle cx="24" cy="24" r="3.2" fill="currentColor"/>' +
      '<circle cx="38.5" cy="14" r="2" fill="currentColor"/>' +
      '<circle cx="9.5" cy="34" r="1.6" fill="currentColor"/>' +
      '</svg>'
    );
  };

  UI.renderSidebar = function (route) {
    const st = Phys.state;
    const stats = st.stats || { wrongActive: 0 };
    const cmap = chapterStatsMap();
    const activeChapter = route.chapterId || (st.session && st.session.chapterId) || null;
    const active = (name) => (route.name === name ? ' is-active' : '');
    const nav = [
      { href: '#/home', icon: 'home', label: '学习首页', name: 'home' },
      { href: '#/wrong', icon: 'wrong', label: '错题本', name: 'wrong', badge: stats.wrongActive },
      { href: '#/insights', icon: 'spark', label: '薄弱点总结', name: 'insights' },
      { href: '#/settings', icon: 'settings', label: '设置', name: 'settings' }
    ];

    let chapterHtml = '';
    st.bank.chapters.forEach(function (ch) {
      const s = cmap.get(ch.id) || { progress: 0, answered: 0, total: ch.questions.length };
      const isActive = activeChapter === ch.id;
      chapterHtml +=
        '<a class="side-chapter' + (isActive ? ' is-active' : '') + '" href="#/chapter/' + encodeURIComponent(ch.id) + '">' +
        '<span class="sc-num">' + String(ch.number || 0).padStart(2, '0') + '</span>' +
        '<span class="sc-main"><span class="sc-title">' + Phys.escapeHtml(ch.title) + '</span>' +
        '<span class="sc-meta">' + s.answered + '/' + s.total + ' 题</span>' +
        '<span class="sc-bar"><i style="width:' + UI.pct(s.progress) + '%"></i></span></span>' +
        '<span class="sc-pct">' + UI.pct(s.progress) + '%</span>' +
        '</a>';
    });

    return (
      '<div class="sidebar-inner">' +
      '<a class="brand" href="#/home" aria-label="返回学习首页">' +
      '<span class="brand-mark">' + UI.brandMark() + '</span>' +
      '<span class="brand-text"><strong>物理 · 刷题室</strong><small>UNIVERSITY PHYSICS</small></span>' +
      '</a>' +
      '<nav class="side-nav" aria-label="主导航">' +
      nav.map(function (n) {
        return (
          '<a class="side-link' + (route.name === n.name ? ' is-active' : '') + '" href="' + n.href + '">' +
          Phys.icon(n.icon) + '<span>' + n.label + '</span>' +
          (n.badge ? '<span class="nav-badge">' + n.badge + '</span>' : '') +
          '</a>'
        );
      }).join('') +
      '</nav>' +
      '<div class="side-label"><span>章节</span><span class="side-count">' + st.bank.chapters.length + '</span></div>' +
      '<div class="side-chapters">' + chapterHtml + '</div>' +
      '<div class="sidebar-foot">' +
      '<div class="side-bank"><span class="side-bank-dot"></span><span>' + Phys.escapeHtml(st.bank.title) + '</span><a href="#/settings">管理</a></div>' +
      '<div class="side-ai"><span class="ai-dot ' + (Phys.Store.hasAI() ? 'on' : '') + '"></span>' + (Phys.Store.hasAI() ? 'AI 批改已启用' : 'AI 批改未配置') + '</div>' +
      '</div>' +
      '</div>'
    );
  };

  UI.renderTopbar = function (route) {
    const st = Phys.state;
    let crumb = '学习首页';
    if (route.name === 'chapter') crumb = '第 ' + ((Phys.Store.getChapter(route.chapterId) || {}).number || '') + ' 章';
    else if (route.name === 'knowledge') crumb = '知识讲解';
    else if (route.name === 'practice') crumb = '答题练习';
    else if (route.name === 'wrong') crumb = '错题本';
    else if (route.name === 'insights') crumb = '薄弱点总结';
    else if (route.name === 'settings') crumb = '设置';
    const streak = st.stats ? st.stats.streak : 0;
    return (
      '<button class="icon-btn menu-btn" id="menu-btn" aria-label="打开章节菜单">' + Phys.icon('menu') + '</button>' +
      '<div class="crumb"><span class="crumb-root">大学物理</span>' + Phys.icon('chevronRight') + '<span>' + Phys.escapeHtml(crumb) + '</span></div>' +
      '<div class="top-actions">' +
      (streak ? '<span class="streak-chip" title="连续学习天数">' + Phys.icon('flame') + streak + ' 天</span>' : '') +
      UI.aiPill() +
      '<a class="icon-btn" href="#/settings" aria-label="设置">' + Phys.icon('settings') + '</a>' +
      '</div>'
    );
  };

  UI.pageHead = function (opts) {
    return (
      '<header class="page-head ' + (opts.className || '') + '">' +
      (opts.eyebrow ? '<div class="eyebrow">' + opts.eyebrow + '</div>' : '') +
      '<h1>' + opts.title + '</h1>' +
      (opts.subtitle ? '<p class="page-sub">' + opts.subtitle + '</p>' : '') +
      (opts.actions ? '<div class="page-actions">' + opts.actions + '</div>' : '') +
      '</header>'
    );
  };

  UI.empty = function (icon, title, text, actionHtml) {
    return (
      '<div class="empty">' +
      '<div class="empty-icon">' + Phys.icon(icon || 'bookOpen') + '</div>' +
      '<h3>' + Phys.escapeHtml(title) + '</h3>' +
      '<p>' + Phys.escapeHtml(text || '') + '</p>' +
      (actionHtml ? '<div class="empty-actions">' + actionHtml + '</div>' : '') +
      '</div>'
    );
  };

  UI.chapterCard = function (ch) {
    const s = Phys.chapterStats(ch);
    const pct = UI.pct(s.progress);
    const status = s.answered === 0 ? '未开始' : s.answered === s.total ? '已完成' : '进行中';
    return (
      '<a class="chapter-card" href="#/chapter/' + encodeURIComponent(ch.id) + '">' +
      '<div class="cc-top"><span class="cc-num">' + String(ch.number || 0).padStart(2, '0') + '</span><span class="cc-status">' + status + '</span></div>' +
      '<h3>' + Phys.escapeHtml(ch.title) + '</h3>' +
      '<p>' + Phys.escapeHtml(ch.intro || '') + '</p>' +
      '<div class="cc-foot">' +
      '<div class="cc-progress"><div class="cc-bar"><i style="width:' + pct + '%"></i></div><span>' + s.answered + '/' + s.total + ' 题 · ' + pct + '%</span></div>' +
      '<span class="cc-arrow">' + Phys.icon('arrowRight') + '</span>' +
      '</div>' +
      '</a>'
    );
  };

  UI.knowledgeChips = function (chapter, ids, linkable) {
    if (!ids || !ids.length) return '';
    return (
      '<div class="k-chips">' +
      ids.map(function (id) {
        const k = Phys.Store.getKnowledge(chapter, id);
        const title = k ? k.title : id;
        if (linkable) {
          return '<button class="chip chip-k" data-scroll-k="' + Phys.escapeAttr(id) + '">' + Phys.escapeHtml(title) + '</button>';
        }
        return '<span class="chip chip-k">' + Phys.escapeHtml(title) + '</span>';
      }).join('') +
      '</div>'
    );
  };

  UI.sectionTitle = function (title, sub, action) {
    return '<div class="section-head"><div><h2>' + title + '</h2>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>' + (action || '') + '</div>';
  };

  UI.answerText = function (q, userAnswer) {
    if (!userAnswer) return '（未作答）';
    if (q.type === 'single' || q.type === 'multiple') {
      const arr = Array.isArray(userAnswer) ? userAnswer : [userAnswer];
      return arr.join('、') || '（未选）';
    }
    if (q.type === 'blank') {
      const arr = Array.isArray(userAnswer) ? userAnswer : [userAnswer];
      return arr.map((x, i) => '(' + (i + 1) + ') ' + (x || '空')).join('；');
    }
    if (userAnswer && typeof userAnswer === 'object') {
      return userAnswer.text || (userAnswer.hasDrawing ? '见手写作答' : '（未作答）');
    }
    return String(userAnswer);
  };

  UI.bindCommon = function (root) {
    // 知识点跳转（章节页 / 结果页）
    root.querySelectorAll('[data-scroll-k]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        let kid = btn.getAttribute('data-scroll-k');
        const chapterId = btn.getAttribute('data-chapter') || Phys.state.route.chapterId || (Phys.state.session && Phys.state.session.chapterId);
        const chapter = chapterId ? Phys.Store.getChapter(chapterId) : null;
        if (chapter) {
          const hit = (chapter.knowledge || []).find((k) => k.id === kid);
          if (!hit) {
            const byTitle = (chapter.knowledge || []).find((k) => k.title === kid);
            if (byTitle) kid = byTitle.id;
          }
        }
        if (location.hash.indexOf('#/knowledge/') === 0 && chapterId) {
          const el = document.getElementById('k-' + kid);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else if (chapterId) {
          location.hash = '#/knowledge/' + encodeURIComponent(chapterId) + '?k=' + encodeURIComponent(kid);
        }
      });
    });
  };

  window.Phys.UI = UI;
})();
