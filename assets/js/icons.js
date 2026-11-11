/* 轻量图标库：全部内联 SVG，无外部依赖 */
(function () {
  const P = {
    home: '<path d="M3 10.8 12 3l9 7.8"/><path d="M5.5 9.5V21h13V9.5"/><path d="M9.5 21v-6h5v6"/>',
    book: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22.5z"/><path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20"/><path d="M8 6h8"/>',
    wrong: '<path d="M5 4h11l4 4v12H5z"/><path d="M9 10l6 6"/><path d="M15 10l-6 6"/>',
    spark: '<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
    settings: '<path d="M4 6h10"/><path d="M18 6h2"/><circle cx="16" cy="6" r="2"/><path d="M4 12h2"/><path d="M10 12h10"/><circle cx="7" cy="12" r="2"/><path d="M4 18h10"/><path d="M18 18h2"/><circle cx="16" cy="18" r="2"/>',
    menu: '<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/>',
    close: '<path d="m6 6 12 12"/><path d="m18 6-12 12"/>',
    arrowLeft: '<path d="M19 12H5"/><path d="m11 6-6 6 6 6"/>',
    arrowRight: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    chevronRight: '<path d="m9 6 6 6-6 6"/>',
    check: '<path d="m5 12.5 4.2 4.2L19 7"/>',
    checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.7 2.7L16 9"/>',
    xCircle: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6"/><path d="m15 9-6 6"/>',
    alert: '<path d="M12 3 2.5 20h19z"/><path d="M12 9v4.5"/><path d="M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.4l3.4 2"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
    flame: '<path d="M12 22c4 0 6.5-2.7 6.5-6.2 0-2.8-1.6-5.1-3.8-7.3-.4 2-1.4 3.2-2.7 3.8.2-3.5-1.2-6.4-3.7-8.3.2 3-1 5-2.4 7A7.9 7.9 0 0 0 5.5 16c0 3.5 2.6 6 6.5 6z"/>',
    pen: '<path d="m4 20 4.2-1 10.5-10.5a2.1 2.1 0 0 0-3-3L5.2 16z"/><path d="m13.8 6.2 3 3"/>',
    eraser: '<path d="m7 20-3-3L15 6a2.1 2.1 0 0 1 3 0l3 3a2.1 2.1 0 0 1 0 3L11 20z"/><path d="M7 20h13"/><path d="m9 9 6 6"/>',
    undo: '<path d="M9 7 4 12l5 5"/><path d="M4 12h9a6 6 0 0 1 6 6"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m6 6 1 15h10l1-15"/><path d="M10 10v7"/><path d="M14 10v7"/>',
    expand: '<path d="M8 3H3v5"/><path d="M16 3h5v5"/><path d="M8 21H3v-5"/><path d="M16 21h5v-5"/>',
    shrink: '<path d="M3 8h5V3"/><path d="M21 8h-5V3"/><path d="M3 16h5v5"/><path d="M21 16h-5v5"/>',
    camera: '<path d="M4 8h3l1.5-2h7L17 8h3v12H4z"/><circle cx="12" cy="14" r="3.5"/>',
    send: '<path d="m3 11 18-8-8 18-2.2-7.8z"/><path d="M10.8 13.2 21 3"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.7-4L3 10"/><path d="M3 5v5h5"/><path d="M4 13a8 8 0 0 0 14.7 4L21 14"/><path d="M21 19v-5h-5"/>',
    download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 21h16"/>',
    upload: '<path d="M12 21V9"/><path d="m7 14 5-5 5 5"/><path d="M4 3h16"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9"/><path d="m17 6 2 2"/><path d="m14 9 2 2"/>',
    eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/>',
    eyeOff: '<path d="m3 3 18 18"/><path d="M10.6 6.2A10.9 10.9 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3.2 3.7"/><path d="M6.7 6.8A16.5 16.5 0 0 0 2 12s3.5 6 10 6a10.8 10.8 0 0 0 4.4-.9"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    chart: '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 12 9 5 9-5"/><path d="m3 16 9 5 9-5"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m4 18 5-5 3 3 4-4 4 4"/>',
    play: '<path d="M7 4.5v15l13-7.5z"/>',
    zap: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    list: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3.5 6h.01"/><path d="M3.5 12h.01"/><path d="M3.5 18h.01"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 5H4v2a3 3 0 0 0 4 3"/><path d="M16 5h4v2a3 3 0 0 1-4 3"/><path d="M12 13v5"/><path d="M8 21h8"/><path d="M9 18h6"/>',
    edit: '<path d="M12 20h9"/><path d="m16.5 3.5 4 4L8 20H4v-4z"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    wifi: '<path d="M2 8.5a15 15 0 0 1 20 0"/><path d="M5 12a10 10 0 0 1 14 0"/><path d="M8.5 15.5a5 5 0 0 1 7 0"/><path d="M12 19h.01"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    bookOpen: '<path d="M12 5.5C10 4 7 3.5 3 4v15c4-.5 7 0 9 1.5 2-1.5 5-2 9-1.5V4c-4-.5-7 0-9 1.5z"/><path d="M12 5.5v15"/>',
    calculator: '<rect x="5" y="2.5" width="14" height="19" rx="2"/><path d="M8 6.5h8"/><path d="M8.5 11h.01"/><path d="M12 11h.01"/><path d="M15.5 11h.01"/><path d="M8.5 14.5h.01"/><path d="M12 14.5h.01"/><path d="M15.5 14.5h.01"/><path d="M8.5 18h.01"/><path d="M12 18h.01"/><path d="M15.5 18h.01"/>'
  };
  window.Phys = window.Phys || {};
  window.Phys.icon = function (name, cls) {
    const p = P[name] || P.info;
    return '<svg class="icon ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  };
  window.Phys.ICON_NAMES = Object.keys(P);
})();
