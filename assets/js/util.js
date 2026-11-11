/* 通用工具：DOM、文本、数学公式、Markdown、弹窗、存储 */
(function () {
  const Phys = (window.Phys = window.Phys || {});

  // ---------- 基础 ----------
  Phys.$ = (sel, root) => (root || document).querySelector(sel);
  Phys.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  Phys.escapeHtml = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };
  Phys.escapeAttr = Phys.escapeHtml;

  Phys.uid = function (prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  };

  Phys.clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  Phys.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  Phys.shuffle = function (arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  Phys.debounce = function (fn, wait) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  };
  Phys.throttleRaf = function (fn) {
    let queued = false;
    return function (...args) {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        fn.apply(this, args);
      });
    };
  };

  Phys.formatDate = function (iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const now = new Date();
    const sameYear = d.getFullYear() === now.getFullYear();
    const pad = (n) => String(n).padStart(2, '0');
    return (sameYear ? '' : d.getFullYear() + '年') + (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  };

  Phys.relativeTime = function (iso) {
    if (!iso) return '';
    const t = new Date(iso).getTime();
    if (!t) return '';
    const diff = Date.now() - t;
    if (diff < 60e3) return '刚刚';
    if (diff < 3600e3) return Math.floor(diff / 60e3) + ' 分钟前';
    if (diff < 86400e3) return Math.floor(diff / 3600e3) + ' 小时前';
    if (diff < 7 * 86400e3) return Math.floor(diff / 86400e3) + ' 天前';
    return Phys.formatDate(iso).split(' ')[0];
  };

  Phys.dayKey = function (date) {
    const d = date ? new Date(date) : new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };

  Phys.calcStreak = function (dayKeys) {
    const set = new Set(dayKeys || []);
    let cursor = new Date();
    // 今天没学，也从昨天开始算连续，避免早上打开时显示 0
    if (!set.has(Phys.dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
    let streak = 0;
    while (set.has(Phys.dayKey(cursor)) && streak < 3650) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  };

  Phys.fmtDuration = function (sec) {
    sec = Math.max(0, Math.round(sec || 0));
    if (sec < 60) return sec + ' 秒';
    const m = Math.floor(sec / 60);
    if (m < 60) return m + ' 分钟';
    return Math.floor(m / 60) + ' 小时 ' + (m % 60) + ' 分';
  };

  Phys.plural = (n, one, many) => n + ' ' + (n === 1 ? one : many || one);

  Phys.truncate = function (s, n) {
    s = String(s || '').replace(/\s+/g, ' ').trim();
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  };

  // ---------- 文本 / 公式 ----------
  Phys.stripMarkdown = function (s) {
    const BS = String.fromCharCode(92);
    const map = {
      Delta: 'Δ', delta: 'δ', theta: 'θ', alpha: 'α', beta: 'β', gamma: 'γ',
      omega: 'ω', mu: 'μ', pi: 'π', lambda: 'λ', rho: 'ρ', sigma: 'σ',
      tau: 'τ', phi: 'φ', infty: '∞', approx: '≈', times: '×', cdot: '·',
      pm: '±', le: '≤', ge: '≥', to: '→', rightarrow: '→', varphi: 'φ', epsilon: 'ε', partial: '∂', sum: 'Σ', int: '∫', neq: '≠', propto: '∝', perp: '⊥', parallel: '∥',
      sin: 'sin', cos: 'cos', tan: 'tan', ln: 'ln', log: 'log', sqrt: '√'
    };
    let out = String(s || '').split('$').join(' ');
    const parts = out.split(BS);
    out = parts[0];
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      const m = part.match(/^([a-zA-Z]+)/);
      if (!m) {
        out += ' ';
        continue;
      }
      const cmd = m[1];
      const rest = part.slice(cmd.length);
      if (cmd === 'frac' || cmd === 'dfrac' || cmd === 'tfrac') out += rest;
      else if (cmd === 'text' || cmd === 'mathrm' || cmd === 'mathbf' || cmd === 'mathit' || cmd === 'operatorname') out += rest;
      else if (cmd === 'quad' || cmd === 'qquad') out += ' ';
      else if (map[cmd] != null) out += map[cmd] + rest;
      else out += rest;
    }
    out = out.split('}{').join('} {');
    out = out.split('{').join('').split('}').join('');
    out = out.replace(/\^2/g, '²').replace(/\^3/g, '³');
    out = out.replace(/[*_`>#~]/g, '');
    out = out.split(String.fromCharCode(10)).join(' ');
    out = out.replace(/  +/g, ' ').trim();
    return out;
  };

  const MATH_RE = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;

  function katexRender(tex, display) {
    if (!window.katex) return Phys.escapeHtml(tex);
    // 某些模型会把 LaTeX 反斜杠转义成控制字符，这里尽量还原
    const BS = String.fromCharCode(92);
    tex = String(tex).split('').map(function (ch) {
      const code = ch.charCodeAt(0);
      if (code === 8) return BS + 'b';
      if (code === 9) return BS + 't';
      if (code === 10) return BS + 'n';
      if (code === 11) return BS + 'v';
      if (code === 12) return BS + 'f';
      if (code === 13) return BS + 'r';
      if (code < 32) return ' ';
      return ch;
    }).join('');
    try {
      return window.katex.renderToString(tex, {
        displayMode: !!display,
        throwOnError: false,
        strict: 'ignore',
        trust: false,
        output: 'html'
      });
    } catch (e) {
      return '<code class="math-fallback">' + Phys.escapeHtml(tex) + '</code>';
    }
  }
  Phys.katexRender = katexRender;

  // 只渲染公式，不解析 Markdown。用于选项、答案等短文本。
  Phys.renderMath = function (text) {
    const src = String(text == null ? '' : text);
    let out = '';
    let last = 0;
    let m;
    MATH_RE.lastIndex = 0;
    while ((m = MATH_RE.exec(src))) {
      out += Phys.escapeHtml(src.slice(last, m.index)).replace(/\n/g, '<br>');
      out += katexRender(m[1] != null ? m[1] : m[2], m[1] != null);
      last = m.index + m[0].length;
    }
    out += Phys.escapeHtml(src.slice(last)).replace(/\n/g, '<br>');
    return out;
  };

  // Markdown + 公式；公式先占位，避免 Markdown 把下划线、星号吃掉。
  Phys.renderRich = function (text, opts) {
    const src = String(text == null ? '' : text);
    if (!src.trim()) return '';
    const math = [];
    const protectedSrc = src.replace(MATH_RE, function (full, block, inline) {
      math.push({ tex: block != null ? block : inline, display: block != null });
      return '@@KATEX_' + (math.length - 1) + '@@';
    });

    let html;
    if (window.marked && typeof window.marked.parse === 'function') {
      try {
        html = window.marked.parse(protectedSrc, { gfm: true, breaks: true });
      } catch (e) {
        html = Phys.escapeHtml(protectedSrc).replace(/\n/g, '<br>');
      }
    } else {
      html = Phys.escapeHtml(protectedSrc).replace(/\n/g, '<br>');
    }
    if (window.DOMPurify) {
      html = window.DOMPurify.sanitize(html, {
        ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i
      });
    }
    html = html.replace(/@@KATEX_(\d+)@@/g, function (_, i) {
      const item = math[Number(i)];
      return item ? katexRender(item.tex, item.display) : '';
    });
    if (opts && opts.inline) {
      html = html.replace(/^<p>([\s\S]*)<\/p>\s*$/, '$1');
    }
    return html;
  };

  Phys.plainText = function (html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || '';
  };

  // ---------- 本地存储 ----------
  Phys.store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (e) {
        console.warn('localStorage 写入失败', e);
        return false;
      }
    },
    remove(key) {
      try {
        localStorage.removeItem(key);
      } catch (e) {}
    }
  };

  // ---------- IndexedDB（存放大题库） ----------
  const DB_NAME = 'phys_lab';
  const DB_STORE = 'kv';
  let dbPromise = null;

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!window.indexedDB) return reject(new Error('浏览器不支持 IndexedDB'));
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () {
        const db = req.result;
        if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('IndexedDB 打开失败'));
    }).catch(function (e) {
      dbPromise = null;
      throw e;
    });
    return dbPromise;
  }

  Phys.idb = {
    async get(key) {
      try {
        const db = await openDb();
        return await new Promise(function (resolve, reject) {
          const tx = db.transaction(DB_STORE, 'readonly');
          const req = tx.objectStore(DB_STORE).get(key);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
      } catch (e) {
        const raw = Phys.store.get('phys.idb.' + key, null);
        return raw;
      }
    },
    async set(key, val) {
      try {
        const db = await openDb();
        await new Promise(function (resolve, reject) {
          const tx = db.transaction(DB_STORE, 'readwrite');
          tx.objectStore(DB_STORE).put(val, key);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
        return true;
      } catch (e) {
        return Phys.store.set('phys.idb.' + key, val);
      }
    },
    async del(key) {
      try {
        const db = await openDb();
        await new Promise(function (resolve, reject) {
          const tx = db.transaction(DB_STORE, 'readwrite');
          tx.objectStore(DB_STORE).delete(key);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      } catch (e) {}
      Phys.store.remove('phys.idb.' + key);
    }
  };

  // ---------- 提示 / 弹窗 ----------
  let toastTimer = null;
  Phys.toast = function (message, type, duration) {
    const root = document.getElementById('toast-root');
    if (!root) return;
    root.innerHTML = '';
    const el = document.createElement('div');
    el.className = 'toast toast-' + (type || 'info');
    el.setAttribute('role', 'status');
    el.innerHTML =
      '<span class="toast-icon">' +
      Phys.icon(type === 'success' ? 'checkCircle' : type === 'error' ? 'xCircle' : type === 'warn' ? 'alert' : 'info') +
      '</span><span class="toast-text">' +
      Phys.escapeHtml(message) +
      '</span>';
    root.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 250);
    }, duration || 3200);
  };

  let modalState = null;
  let scrollLock = 0;

  function lockScroll(on) {
    scrollLock += on ? 1 : -1;
    scrollLock = Math.max(0, scrollLock);
    document.documentElement.classList.toggle('modal-open', scrollLock > 0);
  }

  Phys.closeModal = function () {
    if (!modalState) return;
    const st = modalState;
    modalState = null;
    lockScroll(false);
    st.wrap.classList.remove('open');
    document.removeEventListener('keydown', st.onKey, true);
    setTimeout(function () {
      st.wrap.remove();
      if (st.lastFocus && st.lastFocus.focus) st.lastFocus.focus();
    }, 220);
  };

  Phys.modal = function (opts) {
    if (modalState) Phys.closeModal();
    const root = document.getElementById('modal-root');
    if (!root) return;
    const lastFocus = document.activeElement;
    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.innerHTML =
      '<section class="modal ' +
      (opts.className || '') +
      '" role="dialog" aria-modal="true" aria-label="' +
      Phys.escapeAttr(opts.title || '对话框') +
      '">' +
      '<header class="modal-head">' +
      '<div><h2 class="modal-title">' +
      Phys.escapeHtml(opts.title || '') +
      '</h2>' +
      (opts.subtitle ? '<p class="modal-sub">' + Phys.escapeHtml(opts.subtitle) + '</p>' : '') +
      '</div>' +
      (opts.dismissible === false ? '' : '<button class="icon-btn modal-close" aria-label="关闭">' + Phys.icon('close') + '</button>') +
      '</header>' +
      '<div class="modal-body"></div>' +
      '<footer class="modal-foot"></footer>' +
      '</section>';

    const body = wrap.querySelector('.modal-body');
    if (opts.body instanceof Node) body.appendChild(opts.body);
    else body.innerHTML = opts.body || '';

    const foot = wrap.querySelector('.modal-foot');
    const actions = opts.actions || [];
    if (actions.length) {
      actions.forEach(function (a) {
        const btn = document.createElement('button');
        btn.className = 'btn ' + (a.kind === 'primary' ? 'btn-primary' : a.kind === 'danger' ? 'btn-danger' : 'btn-ghost');
        btn.textContent = a.label;
        btn.addEventListener('click', async function () {
          if (a.onClick) {
            const original = btn.textContent;
            btn.disabled = true;
            btn.textContent = '处理中…';
            let keep = false;
            try {
              keep = (await a.onClick(Phys.closeModal)) === false;
            } catch (e) {
              console.error(e);
              Phys.toast(e.message || '操作失败', 'error');
              keep = true;
            }
            btn.disabled = false;
            btn.textContent = original;
            if (!keep && a.closeOnClick !== false) Phys.closeModal();
          } else if (a.closeOnClick !== false) {
            Phys.closeModal();
          }
        });
        foot.appendChild(btn);
      });
      foot.style.display = 'flex';
    } else {
      foot.style.display = 'none';
    }

    wrap.addEventListener('mousedown', function (e) {
      if (e.target === wrap && opts.dismissible !== false) Phys.closeModal();
    });

    const st = {
      wrap,
      lastFocus,
      onKey: function (e) {
        if (e.key === 'Escape' && opts.dismissible !== false) {
          e.stopPropagation();
          Phys.closeModal();
          return;
        }
        if (e.key !== 'Tab') return;
        const focusables = Phys.$$('button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])', wrap).filter(
          (el) => el.offsetParent !== null
        );
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    modalState = st;
    document.addEventListener('keydown', st.onKey, true);
    root.appendChild(wrap);
    lockScroll(true);
    requestAnimationFrame(() => {
      wrap.classList.add('open');
      const focusTarget = opts.initialFocus ? wrap.querySelector(opts.initialFocus) : wrap.querySelector('.modal-close, .modal-foot .btn');
      if (focusTarget) focusTarget.focus();
    });

    if (wrap.querySelector('.modal-close')) wrap.querySelector('.modal-close').addEventListener('click', Phys.closeModal);
    if (typeof opts.onMount === 'function') opts.onMount(wrap, Phys.closeModal);
    return Phys.closeModal;
  };

  Phys.confirm = function (opts) {
    return new Promise(function (resolve) {
      let decided = false;
      Phys.modal({
        title: opts.title || '确认',
        subtitle: opts.subtitle,
        body: '<p class="confirm-text">' + Phys.escapeHtml(opts.message || '') + '</p>',
        className: 'modal-sm',
        dismissible: true,
        actions: [
          {
            label: opts.cancelText || '取消',
            kind: 'ghost',
            onClick: function () {
              decided = true;
              resolve(false);
            }
          },
          {
            label: opts.confirmText || '确定',
            kind: opts.danger ? 'danger' : 'primary',
            onClick: function () {
              decided = true;
              resolve(true);
            }
          }
        ],
        onMount: function () {
          // 用户点关闭 / 背景时视为取消
          const observer = new MutationObserver(function () {
            if (!document.body.contains(document.querySelector('.modal-backdrop')) && !decided) {
              decided = true;
              resolve(false);
              observer.disconnect();
            }
          });
          observer.observe(document.getElementById('modal-root'), { childList: true });
        }
      });
    });
  };

  // ---------- 文件 ----------
  Phys.download = function (filename, content, type) {
    const blob = new Blob([content], { type: type || 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  Phys.readFileText = function (file) {
    return new Promise(function (resolve, reject) {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ''));
      r.onerror = () => reject(r.error || new Error('文件读取失败'));
      r.readAsText(file, 'utf-8');
    });
  };

  Phys.readFileDataURL = function (file) {
    return new Promise(function (resolve, reject) {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ''));
      r.onerror = () => reject(r.error || new Error('图片读取失败'));
      r.readAsDataURL(file);
    });
  };

  Phys.compressImage = function (dataUrl, maxSize, quality) {
    return new Promise(function (resolve) {
      const img = new Image();
      img.onload = function () {
        const max = maxSize || 1400;
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        const scale = Math.min(1, max / Math.max(w, h));
        w = Math.max(1, Math.round(w * scale));
        h = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality || 0.84));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  Phys.parseQuery = function (str) {
    const out = {};
    const q = String(str || '').replace(/^\?/, '');
    if (!q) return out;
    q.split('&').forEach(function (pair) {
      if (!pair) return;
      const idx = pair.indexOf('=');
      const k = decodeURIComponent(idx < 0 ? pair : pair.slice(0, idx));
      const v = idx < 0 ? '' : decodeURIComponent(pair.slice(idx + 1));
      out[k] = v;
    });
    return out;
  };

  Phys.copyText = async function (text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    }
  };

  // 全局错误兜底：把脚本错误显示出来，方便排查
  window.addEventListener('error', function (e) {
    if (window.__PHYS_DEBUG_BANNER__ === false) return;
    console.error(e.error || e.message);
  });
  window.addEventListener('unhandledrejection', function (e) {
    console.error('Unhandled promise rejection', e.reason);
  });
})();
