/* 应用入口：路由、外壳、练习启动、全局事件 */
(function () {
  const Phys = (window.Phys = window.Phys || {});
  const UI = Phys.UI;
  const App = {};

  function parseRoute() {
    let raw = location.hash || '';
    if (!raw) raw = '#/home';
    raw = raw.replace(/^#/, '');
    const parts = raw.split('?');
    const path = parts[0] || '/home';
    const query = Phys.parseQuery(parts[1] || '');
    const seg = path.split('/').filter(Boolean);
    if (!seg.length || seg[0] === 'home') return { name: 'home', query, raw };
    if (seg[0] === 'chapter' && seg[1]) return { name: 'chapter', chapterId: decodeURIComponent(seg[1]), query, raw };
    if (seg[0] === 'knowledge' && seg[1]) return { name: 'knowledge', chapterId: decodeURIComponent(seg[1]), query, raw };
    if (seg[0] === 'practice') return { name: 'practice', query, raw };
    if (seg[0] === 'wrong') return { name: 'wrong', query, raw };
    if (seg[0] === 'insights') return { name: 'insights', query, raw };
    if (seg[0] === 'settings') return { name: 'settings', query, raw };
    return { name: 'notFound', query, raw };
  }

  App.refreshShell = function () {
    const route = Phys.state.route || parseRoute();
    const sidebar = document.getElementById('sidebar');
    const topbar = document.getElementById('topbar');
    if (sidebar) {
      sidebar.innerHTML = UI.renderSidebar(route);
      sidebar.scrollTop = 0;
      requestAnimationFrame(function () { sidebar.scrollTop = 0; });
    }
    if (topbar) topbar.innerHTML = UI.renderTopbar(route);
    document.body.classList.toggle('sidebar-available', window.innerWidth < 1024);
  };

  App.rerender = function (opts) {
    opts = opts || {};
    const y = window.scrollY;
    render(opts);
    if (opts.keepScroll) window.scrollTo(0, y);
  };

  App.goHome = function () {
    if (location.hash === '#/home' || location.hash === '') {
      App.rerender();
    } else {
      location.hash = '#/home';
    }
  };

  App.startChapter = function (chapterId, mode, index) {
    mode = mode || 'all';
    if (mode === 'resume' && Phys.state.session) {
      if (location.hash === '#/practice') App.rerender();
      else location.hash = '#/practice';
      return;
    }
    const chapter = Phys.Store.getChapter(chapterId);
    if (!chapter) return Phys.toast('章节不存在', 'error');
    let qids = chapter.questions.map((q) => q.id);
    let startIndex = Number(index) || 0;
    if (mode === 'new') {
      qids = chapter.questions.filter((q) => Phys.Store.statusOf(q.id) === 'new').map((q) => q.id);
      startIndex = 0;
      if (!qids.length) {
        Phys.toast('本章没有未做的题，可以试试随机练习或重刷错题', 'info', 4000);
        return;
      }
    } else if (mode === 'wrong') {
      qids = Phys.Store.wrongQids({ chapterId, resolved: false });
      startIndex = 0;
      if (!qids.length) {
        Phys.toast('本章暂时没有待攻克的错题', 'info');
        return;
      }
    } else if (mode === 'random') {
      qids = Phys.shuffle(qids);
      startIndex = 0;
    } else if (mode === 'continue' || mode === 'resume') {
      const firstNew = chapter.questions.findIndex((q) => Phys.Store.statusOf(q.id) === 'new');
      startIndex = firstNew >= 0 ? firstNew : 0;
    }
    if (!qids.length) return Phys.toast('本章还没有题目', 'info');
    const labels = { all: '顺序练习', new: '未做题目', wrong: '错题重刷', random: '随机练习', continue: '继续练习' };
    Phys.Store.startSession({
      mode,
      title: chapter.title + ' · ' + (labels[mode] || '练习'),
      chapterId,
      qids,
      index: startIndex
    });
    if (location.hash === '#/practice') {
      App.rerender();
      window.scrollTo(0, 0);
    } else {
      location.hash = '#/practice';
    }
  };

  App.startSingle = function (qid) {
    const row = Phys.Store.getQuestion(qid);
    if (!row) return Phys.toast('题目不存在', 'error');
    Phys.Store.startSession({
      mode: 'single',
      title: row.chapter.title + ' · 单题精练',
      chapterId: row.chapter.id,
      qids: [qid],
      index: 0
    });
    if (location.hash === '#/practice') {
      App.rerender();
      window.scrollTo(0, 0);
    } else {
      location.hash = '#/practice';
    }
  };

  App.startWrongAll = function () {
    const qids = Phys.Store.wrongQids({ resolved: false });
    if (!qids.length) {
      Phys.toast('错题本是空的，先去章节里做几道题吧', 'info');
      return;
    }
    Phys.Store.startSession({
      mode: 'wrong',
      title: '错题重刷 · ' + qids.length + ' 题',
      chapterId: null,
      qids,
      index: 0
    });
    if (location.hash === '#/practice') {
      App.rerender();
      window.scrollTo(0, 0);
    } else {
      location.hash = '#/practice';
    }
  };

  function render(opts) {
    opts = opts || {};
    const route = parseRoute();
    Phys.state.route = route;
    let view;
    try {
      if (route.name === 'home') view = Phys.Views.home();
      else if (route.name === 'chapter') view = Phys.Views.chapter(route.chapterId);
      else if (route.name === 'knowledge') view = Phys.Views.knowledge(route.chapterId, route.query);
      else if (route.name === 'practice') view = Phys.Practice.render();
      else if (route.name === 'wrong') view = Phys.Views.wrong();
      else if (route.name === 'insights') view = Phys.Views.insights();
      else if (route.name === 'settings') view = Phys.Settings.render();
      else view = Phys.Views.notFound();
    } catch (e) {
      console.error(e);
      view = {
        html:
          '<div class="fatal-error"><div class="fatal-icon">' + Phys.icon('alert') + '</div><h1>页面出了点问题</h1><p>' +
          Phys.escapeHtml(e.message || String(e)) +
          '</p><div class="fatal-actions"><button class="btn btn-primary" onclick="location.reload()">刷新页面</button><a class="btn btn-ghost" href="#/home">回到首页</a></div></div>'
      };
    }

    const main = document.getElementById('main');
    if (!main) return;
    main.innerHTML = (view && view.html) || '';
    if (view && view.mount) {
      try {
        view.mount(main);
      } catch (e) {
        console.error('mount error', e);
        main.insertAdjacentHTML('beforeend', '<div class="inline-error">页面交互初始化失败：' + Phys.escapeHtml(e.message || String(e)) + '</div>');
      }
    }
    App.refreshShell();
    closeSidebar();
    if (!opts.keepScroll) window.scrollTo(0, 0);
    document.title = titleFor(route);
    if (route.name === 'practice' && Phys.state.session && Phys.state.session.finished) {
      document.title = '练习完成 · ' + Phys.state.bank.title;
    }
  }

  function titleFor(route) {
    const bank = Phys.state.bank ? Phys.state.bank.title : '大学物理';
    const map = { home: '学习首页', wrong: '错题本', insights: '薄弱点总结', settings: '设置', practice: '答题练习', knowledge: '知识讲解' };
    if (route.name === 'chapter') {
      const ch = Phys.Store.getChapter(route.chapterId);
      return (ch ? ch.title : '章节') + ' · ' + bank;
    }
    return (map[route.name] || '页面') + ' · ' + bank;
  }

  function openSidebar() {
    document.body.classList.add('sidebar-open');
  }
  function closeSidebar() {
    document.body.classList.remove('sidebar-open');
  }

  function bindGlobal() {
    window.addEventListener('hashchange', function () {
      render();
    });

    document.addEventListener('click', function (e) {
      const menu = e.target.closest('#menu-btn');
      if (menu) {
        e.preventDefault();
        document.body.classList.toggle('sidebar-open');
        return;
      }
      if (e.target.id === 'sidebar-backdrop' || e.target.closest('#sidebar-backdrop')) {
        closeSidebar();
        return;
      }
      if (e.target.closest('#sidebar a')) closeSidebar();

      const startCh = e.target.closest('[data-start-chapter]');
      if (startCh) {
        e.preventDefault();
        App.startChapter(startCh.getAttribute('data-start-chapter'), startCh.getAttribute('data-start-mode') || 'all', startCh.getAttribute('data-start-index'));
        return;
      }
      const startQ = e.target.closest('[data-start-qid]');
      if (startQ) {
        e.preventDefault();
        App.startSingle(startQ.getAttribute('data-start-qid'));
        return;
      }
      const wrongAll = e.target.closest('[data-start-mode="wrong-all"]');
      if (wrongAll) {
        e.preventDefault();
        if (!wrongAll.disabled) App.startWrongAll();
        return;
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeSidebar();
    });

    let lastWidth = window.innerWidth;
    window.addEventListener('resize', Phys.debounce(function () {
      const w = window.innerWidth;
      if ((lastWidth < 1024 && w >= 1024) || (lastWidth >= 1024 && w < 1024)) {
        if (w >= 1024) closeSidebar();
      }
      lastWidth = w;
    }, 200));
  }

  async function boot() {
    const main = document.getElementById('main');
    if (main) main.innerHTML = '<div class="boot-screen"><div class="boot-atom">' + UI.brandMark() + '</div><p>正在打开刷题室…</p></div>';
    try {
      await Phys.Store.init();
      Phys.Store.loadSession();
    } catch (e) {
      console.error(e);
      if (main) main.innerHTML = '<div class="fatal-error"><h1>应用启动失败</h1><p>' + Phys.escapeHtml(e.message || String(e)) + '</p><button class="btn btn-primary" onclick="location.reload()">重试</button></div>';
      return;
    }
    if (!location.hash) {
      history.replaceState(null, '', '#/home');
    }
    bindGlobal();
    render();
    document.body.classList.add('app-ready');
    if (main) main.focus({ preventScroll: true });
  }

  App.parseRoute = parseRoute;
  App.render = render;
  Phys.App = App;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
