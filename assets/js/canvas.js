/* 手写白板：Pointer Events / 压感 / 防误触 / 全屏 / 导出图片 */
(function () {
  const Phys = (window.Phys = window.Phys || {});
  const Pad = {};

  const COLORS = [
    { id: 'ink', value: '#202a3a', label: '墨色' },
    { id: 'red', value: '#c0392b', label: '红色' },
    { id: 'blue', value: '#1d4ed8', label: '蓝色' }
  ];
  const WIDTHS = [
    { value: 2.0, label: '细' },
    { value: 2.8, label: '中' },
    { value: 3.8, label: '粗' }
  ];

  function deepStrokes(strokes) {
    return strokes.map(function (s) {
      return {
        color: s.color,
        width: s.width,
        points: s.points.map((p) => ({ x: p.x, y: p.y, p: p.p }))
      };
    });
  }

  Pad.mount = function (container, options) {
    options = options || {};
    if (!container) throw new Error('白板容器不存在');
    if (container._pad && container._pad.destroy) container._pad.destroy();

    const antiPalmDefault = options.antiPalm !== false;
    let strokes = deepStrokes(options.strokes || []);
    let history = [];
    let tool = 'pen';
    let color = COLORS[0].value;
    let width = WIDTHS[1].value;
    let drawing = null;
    let readOnly = !!options.readOnly;
    let antiPalm = antiPalmDefault;
    let penSeen = false;
    let destroyed = false;
    let fullscreen = false;

    container.innerHTML =
      '<div class="pad-shell">' +
      '<div class="pad-toolbar">' +
      '<div class="pad-tools">' +
      '<button type="button" class="pad-btn is-active" data-tool="pen" aria-pressed="true">' + Phys.icon('pen') + '<span>笔</span></button>' +
      '<button type="button" class="pad-btn" data-tool="eraser" aria-pressed="false">' + Phys.icon('eraser') + '<span>橡皮</span></button>' +
      '<span class="pad-sep"></span>' +
      '<button type="button" class="pad-btn" data-act="undo" title="撤销">' + Phys.icon('undo') + '<span>撤销</span></button>' +
      '<button type="button" class="pad-btn" data-act="clear" title="清空">' + Phys.icon('trash') + '<span>清空</span></button>' +
      '</div>' +
      '<div class="pad-tools pad-tools-right">' +
      '<div class="pad-colors" role="group" aria-label="笔迹颜色">' +
      COLORS.map((c) => '<button type="button" class="pad-color' + (c.value === color ? ' is-active' : '') + '" data-color="' + c.value + '" aria-label="' + c.label + '" style="--swatch:' + c.value + '"></button>').join('') +
      '</div>' +
      '<button type="button" class="pad-btn pad-width" data-act="width" title="切换粗细">' + WIDTHS[1].label + '</button>' +
      '<label class="pad-toggle" title="检测到手写笔后忽略手掌触摸"><input type="checkbox" data-act="palm"' + (antiPalm ? ' checked' : '') + '><span>防误触</span></label>' +
      '<button type="button" class="pad-btn" data-act="fullscreen" title="全屏书写">' + Phys.icon('expand') + '<span>全屏</span></button>' +
      '</div>' +
      '</div>' +
      '<div class="pad-canvas-wrap">' +
      '<canvas class="pad-canvas" aria-label="手写作答区"></canvas>' +
      '<div class="pad-empty"><span>' + (readOnly ? '本题已提交' : '在这里写解题过程') + '</span><small>' + (readOnly ? '笔迹仅用于本次作答展示' : '支持触控笔 / 手指 · 可全屏') + '</small></div>' +
      '<div class="pad-readonly-badge">' + (readOnly ? '已提交' : '') + '</div>' +
      '</div>' +
      '<div class="pad-foot"><span class="pad-status">' + (strokes.length ? '已写 ' + strokes.length + ' 笔' : '空白') + '</span><span class="pad-tip">手写内容不会上传，除非提交 AI 批改</span></div>' +
      '</div>';

    const shell = container.querySelector('.pad-shell');
    const canvas = container.querySelector('.pad-canvas');
    const wrap = container.querySelector('.pad-canvas-wrap');
    const empty = container.querySelector('.pad-empty');
    const status = container.querySelector('.pad-status');
    const widthBtn = container.querySelector('[data-act="width"]');
    const fsBtn = container.querySelector('[data-act="fullscreen"]');
    const palmInput = container.querySelector('[data-act="palm"]');
    const ctx = canvas.getContext('2d');
    let rect = { width: 0, height: 0 };
    let dpr = 1;

    function setDirty() {
      if (options.onChange) options.onChange(deepStrokes(strokes));
    }

    function updateStatus() {
      status.textContent = strokes.length ? '已写 ' + strokes.length + ' 笔' : '空白';
      empty.style.display = strokes.length ? 'none' : 'flex';
    }

    function resize() {
      const r = wrap.getBoundingClientRect();
      if (!r.width || !r.height) return;
      rect = { width: r.width, height: r.height };
      dpr = Math.min(3, window.devicePixelRatio || 1);
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      canvas.style.width = r.width + 'px';
      canvas.style.height = r.height + 'px';
      redraw();
    }

    function widthFor(stroke) {
      const base = stroke.width || 2.8;
      return Math.max(0.8, (base * rect.width) / 900);
    }

    function drawStroke(stroke) {
      const pts = stroke.points;
      if (!pts || !pts.length) return;
      ctx.strokeStyle = stroke.color || '#202a3a';
      ctx.lineWidth = widthFor(stroke);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (pts.length === 1) {
        ctx.beginPath();
        ctx.arc(pts[0].x * rect.width, pts[0].y * rect.height, ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.fillStyle = stroke.color || '#202a3a';
        ctx.fill();
        return;
      }
      ctx.beginPath();
      ctx.moveTo(pts[0].x * rect.width, pts[0].y * rect.height);
      for (let i = 1; i < pts.length - 1; i++) {
        const x1 = pts[i].x * rect.width;
        const y1 = pts[i].y * rect.height;
        const x2 = pts[i + 1].x * rect.width;
        const y2 = pts[i + 1].y * rect.height;
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        ctx.quadraticCurveTo(x1, y1, mx, my);
      }
      const last = pts[pts.length - 1];
      ctx.lineTo(last.x * rect.width, last.y * rect.height);
      ctx.stroke();
    }

    function redraw() {
      if (!rect.width) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, rect.width, rect.height);
      strokes.forEach(drawStroke);
    }

    function pointFromEvent(e) {
      const r = canvas.getBoundingClientRect();
      return {
        x: Phys.clamp((e.clientX - r.left) / r.width, 0, 1),
        y: Phys.clamp((e.clientY - r.top) / r.height, 0, 1),
        p: e.pressure && e.pressure > 0 ? e.pressure : 0.5
      };
    }

    function eraseAt(pt) {
      const threshold = Math.max(0.012, 18 / Math.max(300, rect.width));
      const before = strokes.length;
      strokes = strokes.filter(function (s) {
        return !s.points.some(function (p) {
          return Math.hypot(p.x - pt.x, p.y - pt.y) < threshold;
        });
      });
      if (strokes.length !== before) {
        redraw();
        updateStatus();
        setDirty();
      }
    }

    function begin(e) {
      if (readOnly) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.pointerType === 'pen') penSeen = true;
      if (antiPalm && penSeen && e.pointerType === 'touch') return;
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      const pt = pointFromEvent(e);
      history.push(deepStrokes(strokes));
      if (history.length > 35) history.shift();
      if (tool === 'eraser') {
        drawing = { erase: true };
        eraseAt(pt);
        return;
      }
      drawing = {
        color: color,
        width: width * (0.65 + pt.p * 0.7),
        points: [pt]
      };
      strokes.push(drawing);
      redraw();
      updateStatus();
    }

    function move(e) {
      if (!drawing || readOnly) return;
      e.preventDefault();
      const pt = pointFromEvent(e);
      if (drawing.erase) {
        eraseAt(pt);
        return;
      }
      const pts = drawing.points;
      const last = pts[pts.length - 1];
      // 过滤过密的点，降低数据量
      if (last && Math.hypot(pt.x - last.x, pt.y - last.y) < 0.0015) return;
      pts.push(pt);
      redraw();
    }

    function end(e) {
      if (!drawing) return;
      if (e && e.pointerId != null && canvas.hasPointerCapture && canvas.hasPointerCapture(e.pointerId)) {
        try {
          canvas.releasePointerCapture(e.pointerId);
        } catch (err) {}
      }
      drawing = null;
      updateStatus();
      setDirty();
    }

    function undo() {
      if (readOnly) return;
      const prev = history.pop();
      if (!prev) {
        Phys.toast('没有可撤销的操作', 'info', 1600);
        return;
      }
      strokes = prev;
      redraw();
      updateStatus();
      setDirty();
    }

    function clear() {
      if (readOnly) return;
      if (!strokes.length) return;
      history.push(deepStrokes(strokes));
      strokes = [];
      redraw();
      updateStatus();
      setDirty();
      Phys.toast('已清空，可点「撤销」恢复', 'info', 2200);
    }

    function toggleFullscreen() {
      fullscreen = !fullscreen;
      shell.classList.toggle('is-fullscreen', fullscreen);
      document.body.classList.toggle('pad-fullscreen-open', fullscreen);
      fsBtn.innerHTML = Phys.icon(fullscreen ? 'shrink' : 'expand') + '<span>' + (fullscreen ? '退出' : '全屏') + '</span>';
      fsBtn.setAttribute('aria-label', fullscreen ? '退出全屏' : '全屏书写');
      setTimeout(resize, 60);
    }

    function onKey(e) {
      if (e.key === 'Escape' && fullscreen) {
        toggleFullscreen();
      }
    }

    canvas.addEventListener('pointerdown', begin);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('pointerleave', function (e) {
      if (drawing && e.pointerType === 'mouse') end(e);
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    container.querySelectorAll('[data-tool]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        tool = btn.dataset.tool;
        container.querySelectorAll('[data-tool]').forEach((b) => {
          b.classList.toggle('is-active', b === btn);
          b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
        });
        canvas.style.cursor = tool === 'eraser' ? 'cell' : 'crosshair';
      });
    });

    container.querySelectorAll('[data-color]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        color = btn.dataset.color;
        container.querySelectorAll('[data-color]').forEach((b) => b.classList.toggle('is-active', b === btn));
      });
    });

    let widthIndex = 1;
    widthBtn.addEventListener('click', function () {
      widthIndex = (widthIndex + 1) % WIDTHS.length;
      width = WIDTHS[widthIndex].value;
      widthBtn.textContent = WIDTHS[widthIndex].label;
      Phys.toast('笔迹粗细：' + WIDTHS[widthIndex].label, 'info', 1200);
    });

    container.querySelector('[data-act="undo"]').addEventListener('click', undo);
    container.querySelector('[data-act="clear"]').addEventListener('click', clear);
    fsBtn.addEventListener('click', toggleFullscreen);
    palmInput.addEventListener('change', function () {
      antiPalm = palmInput.checked;
      Phys.toast(antiPalm ? '防误触已开启：检测到触控笔后会忽略手指触摸' : '防误触已关闭：手指和手掌都可以书写', 'info', 2600);
      if (options.onAntiPalmChange) options.onAntiPalmChange(antiPalm);
    });

    document.addEventListener('keydown', onKey);
    const ro = new ResizeObserver(function () {
      if (!destroyed) resize();
    });
    ro.observe(wrap);
    resize();
    updateStatus();

    const api = {
      getStrokes() {
        return deepStrokes(strokes);
      },
      setStrokes(s) {
        strokes = deepStrokes(s || []);
        history = [];
        redraw();
        updateStatus();
      },
      isEmpty() {
        return strokes.length === 0;
      },
      count() {
        return strokes.length;
      },
      undo,
      clear,
      resize,
      toggleFullscreen,
      setReadOnly(v) {
        readOnly = !!v;
        shell.classList.toggle('is-readonly', readOnly);
        container.querySelector('.pad-readonly-badge').textContent = readOnly ? '已提交' : '';
        empty.querySelector('span').textContent = readOnly ? '本题已提交' : '在这里写解题过程';
      },
      toDataURL(maxSize) {
        const targetW = Math.min(maxSize || 1400, 1600);
        const ratio = rect.height && rect.width ? rect.height / rect.width : 0.62;
        const targetH = Math.max(360, Math.round(targetW * ratio));
        const off = document.createElement('canvas');
        off.width = targetW;
        off.height = targetH;
        const c = off.getContext('2d');
        c.fillStyle = '#ffffff';
        c.fillRect(0, 0, targetW, targetH);
        // 直接在离屏画布上按比例重绘
        strokes.forEach(function (s) {
          const pts = s.points;
          if (!pts.length) return;
          c.strokeStyle = s.color || '#202a3a';
          c.lineWidth = Math.max(1.2, ((s.width || 2.8) * targetW) / 900);
          c.lineCap = 'round';
          c.lineJoin = 'round';
          if (pts.length === 1) {
            c.beginPath();
            c.arc(pts[0].x * targetW, pts[0].y * targetH, c.lineWidth / 2, 0, Math.PI * 2);
            c.fillStyle = s.color || '#202a3a';
            c.fill();
            return;
          }
          c.beginPath();
          c.moveTo(pts[0].x * targetW, pts[0].y * targetH);
          for (let i = 1; i < pts.length - 1; i++) {
            const x1 = pts[i].x * targetW;
            const y1 = pts[i].y * targetH;
            const x2 = pts[i + 1].x * targetW;
            const y2 = pts[i + 1].y * targetH;
            c.quadraticCurveTo(x1, y1, (x1 + x2) / 2, (y1 + y2) / 2);
          }
          const last = pts[pts.length - 1];
          c.lineTo(last.x * targetW, last.y * targetH);
          c.stroke();
        });
        return off.toDataURL('image/jpeg', 0.86);
      },
      destroy() {
        destroyed = true;
        ro.disconnect();
        document.removeEventListener('keydown', onKey);
        document.body.classList.remove('pad-fullscreen-open');
        container._pad = null;
      }
    };

    if (readOnly) api.setReadOnly(true);
    container._pad = api;
    return api;
  };

  Phys.Pad = Pad;
})();
