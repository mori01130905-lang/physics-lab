/* 数据层：题库规范化 / 导入导出、设置、进度、错题本、会话 */
(function () {
  const Phys = (window.Phys = window.Phys || {});
  const S = {};

  const KEY = {
    settings: 'phys.settings.v1',
    progress: (bankId) => 'phys.progress.v1.' + bankId,
    insight: (bankId) => 'phys.insights.v1.' + bankId,
    session: 'phys.session.v1',
    bank: 'bank.current'
  };
  const MAX_HISTORY = 24;

  const DEFAULT_SETTINGS = {
    ai: {
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: '',
      model: 'deepseek-chat',
      visionModel: '',
      visionBaseUrl: '',
      visionApiKey: '',
      sendDrawing: true,
      strictness: 'standard',
      language: 'zh'
    },
    ui: {
      antiPalm: true,
      reduceMotion: false
    },
    profile: {
      nickname: '',
      examDate: ''
    }
  };

  const TYPE_LABEL = {
    single: '单选题',
    multiple: '多选题',
    blank: '填空题',
    calc: '计算题'
  };
  const TYPE_HINT = {
    single: '选出唯一正确的一项',
    multiple: '选出所有正确选项，少选 / 多选均不得分',
    blank: '填写数值或表达式，注意单位',
    calc: '写出关键步骤与最终答案，也可直接手写'
  };

  let state = (Phys.state = {
    bank: null,
    settings: null,
    progress: null,
    stats: null,
    qIndex: new Map(),
    chapterMap: new Map(),
    session: null,
    ready: false,
    route: { name: 'home' }
  });

  // ---------- 深拷贝 / 设置 ----------
  function clone(x) {
    return JSON.parse(JSON.stringify(x));
  }

  function deepMerge(base, patch) {
    const out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
    if (!patch || typeof patch !== 'object') return out;
    Object.keys(patch).forEach(function (k) {
      const v = patch[k];
      if (v && typeof v === 'object' && !Array.isArray(v) && base && typeof base[k] === 'object' && !Array.isArray(base[k])) {
        out[k] = deepMerge(base[k], v);
      } else {
        out[k] = v;
      }
    });
    return out;
  }

  S.loadSettings = function () {
    const raw = Phys.store.get(KEY.settings, null);
    state.settings = deepMerge(clone(DEFAULT_SETTINGS), raw || {});
    return state.settings;
  };

  S.saveSettings = function (patch) {
    if (patch) state.settings = deepMerge(state.settings, patch);
    const ok = Phys.store.set(KEY.settings, state.settings);
    if (!ok) Phys.toast('设置保存失败：浏览器存储空间可能已满', 'error');
    return ok;
  };

  S.getAIConfig = function () {
    const ai = state.settings.ai;
    return {
      baseUrl: (ai.baseUrl || '').trim(),
      apiKey: (ai.apiKey || '').trim(),
      model: (ai.model || '').trim(),
      visionBaseUrl: (ai.visionBaseUrl || ai.baseUrl || '').trim(),
      visionApiKey: (ai.visionApiKey || ai.apiKey || '').trim(),
      visionModel: (ai.visionModel || '').trim(),
      sendDrawing: ai.sendDrawing !== false,
      strictness: ai.strictness || 'standard'
    };
  };

  S.hasAI = function () {
    const c = S.getAIConfig();
    return !!(c.baseUrl && c.apiKey && c.model);
  };
  S.hasVision = function () {
    const c = S.getAIConfig();
    return !!(c.visionBaseUrl && c.visionApiKey && c.visionModel);
  };

  // ---------- 题库规范化 ----------
  function asArray(v) {
    if (v == null) return [];
    return Array.isArray(v) ? v.slice() : [v];
  }
  function str(v) {
    return v == null ? '' : String(v);
  }
  function safeId(v, fallback) {
    const s = str(v).trim();
    return s || fallback;
  }

  function normalizeKnowledge(k, ci, ki) {
    k = k || {};
    return {
      id: safeId(k.id, 'k' + (ci + 1) + '-' + (ki + 1)),
      title: str(k.title || k.name || '知识点 ' + (ki + 1)),
      summary: str(k.summary || k.intro || ''),
      formulas: asArray(k.formulas).map(function (f) {
        if (typeof f === 'string') return { tex: f, note: '' };
        return { tex: str(f.tex || f.formula || f.latex || ''), note: str(f.note || f.desc || '') };
      }).filter((f) => f.tex),
      points: asArray(k.points || k.content).map(function (p) {
        return typeof p === 'string' ? p : str(p.text || p.md || '');
      }).filter(Boolean),
      pitfalls: asArray(k.pitfalls || k.warnings).map(function (p) {
        return typeof p === 'string' ? p : str(p.text || p.md || '');
      }).filter(Boolean),
      examples: asArray(k.examples).map(function (e) {
        if (typeof e === 'string') return { question: e, solution: '' };
        return { question: str(e.question || e.q || ''), solution: str(e.solution || e.answer || '') };
      }).filter((e) => e.question)
    };
  }

  function normalizeOptions(options) {
    return asArray(options).map(function (o, i) {
      const letter = String.fromCharCode(65 + i);
      if (typeof o === 'string') return { id: letter, text: o };
      return { id: str(o.id || o.key || letter).toUpperCase(), text: str(o.text || o.content || o.label || '') };
    }).filter((o) => o.text !== '');
  }

  function normalizeBlanks(q) {
    let blanks = q.blanks;
    if (!blanks && q.answer != null) {
      blanks = [{ answers: asArray(q.answer) }];
    }
    return asArray(blanks).map(function (b, i) {
      if (b == null) return null;
      if (typeof b === 'string' || typeof b === 'number') {
        return { id: 'b' + (i + 1), label: '', answers: [String(b)], unit: '' };
      }
      return {
        id: str(b.id || 'b' + (i + 1)),
        label: str(b.label || b.name || ''),
        answers: asArray(b.answers != null ? b.answers : b.answer).map(str).filter((x) => x !== ''),
        unit: str(b.unit || ''),
        placeholder: str(b.placeholder || '')
      };
    }).filter(Boolean);
  }

  function normalizeSimilar(s) {
    if (!s) return null;
    if (typeof s === 'string') return { question: s, hint: '', solution: '' };
    return {
      question: str(s.question || s.q || ''),
      hint: str(s.hint || ''),
      solution: str(s.solution || s.answer || '')
    };
  }

  function normalizeQuestion(q, chapter, qi) {
    q = q || {};
    const rawType = str(q.type || 'single').toLowerCase();
    const alias = {
      choice: 'single',
      radio: 'single',
      multi: 'multiple',
      checkbox: 'multiple',
      fill: 'blank',
      blank: 'blank',
      fill_blank: 'blank',
      calculation: 'calc',
      calculate: 'calc',
      answer: 'calc',
      short: 'calc'
    };
    const type = ['single', 'multiple', 'blank', 'calc'].includes(rawType) ? rawType : alias[rawType] || 'single';
    const options = normalizeOptions(q.options);
    let answer = q.answer;
    if (type === 'single' || type === 'multiple') {
      answer = asArray(answer).map((a) => str(a).trim().toUpperCase()).filter(Boolean);
      // 允许把选项文本作为答案
      if (answer.length && options.length) {
        answer = answer.map(function (a) {
          if (options.some((o) => o.id === a)) return a;
          const hit = options.find((o) => o.text === a);
          return hit ? hit.id : a;
        });
      }
    } else if (type === 'blank') {
      answer = normalizeBlanks(q);
    } else {
      if (typeof answer === 'string') answer = { reference: answer, rubric: [] };
      answer = {
        reference: str((answer && (answer.reference || answer.correct || answer.solution)) || ''),
        rubric: asArray((answer && answer.rubric) || q.rubric).map(str).filter(Boolean)
      };
    }
    return {
      id: safeId(q.id, chapter.id + '-q' + (qi + 1)),
      type,
      stem: str(q.stem || q.question || q.title || ''),
      options,
      answer,
      explanation: str(q.explanation || q.analysis || q.solution || ''),
      knowledge: asArray(q.knowledge || q.knowledgePoints || q.tags).map(str).filter(Boolean),
      difficulty: Phys.clamp(Number(q.difficulty) || 1, 1, 5),
      source: str(q.source || ''),
      similar: normalizeSimilar(q.similar || q.followup || q.example),
      raw: undefined
    };
  }

  function normalizeChapter(ch, ci) {
    ch = ch || {};
    const id = safeId(ch.id, 'ch' + (ci + 1));
    const chapter = {
      id,
      number: Number(ch.number) || ci + 1,
      title: str(ch.title || ch.name || '第 ' + (ci + 1) + ' 章'),
      intro: str(ch.intro || ch.description || ''),
      knowledge: asArray(ch.knowledge || ch.knowledgePoints).map((k, ki) => normalizeKnowledge(k, ci, ki)),
      questions: []
    };
    chapter.questions = asArray(ch.questions).map((q, qi) => normalizeQuestion(q, chapter, qi));
    return chapter;
  }

  S.normalizeBank = function (raw) {
    raw = raw || {};
    const bank = {
      id: safeId(raw.id, 'bank-' + Date.now().toString(36)),
      version: raw.version || 1,
      title: str(raw.title || '大学物理'),
      subtitle: str(raw.subtitle || ''),
      updatedAt: str(raw.updatedAt || ''),
      chapters: asArray(raw.chapters).map(normalizeChapter)
    };
    // 全局唯一 id
    const seen = new Set();
    bank.chapters.forEach(function (ch) {
      const chapterSeen = new Set();
      ch.questions.forEach(function (q, i) {
        let qid = q.id;
        if (chapterSeen.has(qid) || seen.has(qid)) {
          qid = qid + '-' + (i + 1);
          while (seen.has(qid)) qid += 'x';
          q.id = qid;
        }
        chapterSeen.add(qid);
        seen.add(qid);
      });
    });
    return bank;
  };

  S.validateBank = function (raw) {
    const errors = [];
    const warnings = [];
    if (!raw || typeof raw !== 'object') {
      return { ok: false, errors: ['文件内容不是有效的 JSON 对象'], warnings: [] };
    }
    if (!Array.isArray(raw.chapters) || raw.chapters.length === 0) {
      errors.push('缺少 chapters 数组，或章节为空');
    }
    const bank = S.normalizeBank(raw);
    let qCount = 0;
    const seen = new Set();
    bank.chapters.forEach(function (ch, ci) {
      if (!ch.title) errors.push('第 ' + (ci + 1) + ' 章缺少标题');
      if (!ch.questions.length && !ch.knowledge.length) warnings.push('章节「' + ch.title + '」既没有知识点也没有题目');
      const kidSet = new Set(ch.knowledge.map((k) => k.id));
      ch.questions.forEach(function (q, qi) {
        qCount++;
        const label = '第 ' + (ci + 1) + ' 章第 ' + (qi + 1) + ' 题';
        if (q.id && seen.has(q.id)) errors.push(label + '：题目 id「' + q.id + '」重复');
        seen.add(q.id);
        if (!q.stem) errors.push(label + '：缺少题干 stem');
        if (!q.explanation && q.type !== 'calc') warnings.push(label + '：缺少解析 explanation');
        if (q.type === 'single' || q.type === 'multiple') {
          if (q.options.length < 2) errors.push(label + '：选择题至少需要 2 个选项');
          if (!q.answer.length) errors.push(label + '：未设置正确答案');
          const ids = new Set(q.options.map((o) => o.id));
          q.answer.forEach(function (a) {
            if (!ids.has(a)) errors.push(label + '：答案「' + a + '」不在选项中');
          });
          if (q.type === 'single' && q.answer.length > 1) errors.push(label + '：单选题只能有一个答案');
          if (q.type === 'multiple' && q.answer.length < 2) warnings.push(label + '：多选题目前只有 1 个正确选项');
        }
        if (q.type === 'blank') {
          if (!q.answer.length) errors.push(label + '：填空题缺少 blanks / answer');
          q.answer.forEach(function (b, bi) {
            if (!b.answers.length) errors.push(label + '：第 ' + (bi + 1) + ' 个空没有可接受答案');
          });
        }
        if (q.type === 'calc' && !q.answer.reference) {
          warnings.push(label + '：计算题没有参考答案，AI 批改效果会受影响');
        }
        q.knowledge.forEach(function (kid) {
          if (!kidSet.has(kid)) warnings.push(label + '：知识点「' + kid + '」在本章中不存在');
        });
      });
    });
    if (qCount === 0) errors.push('题库中没有任何题目');
    return { ok: errors.length === 0, errors, warnings, bank, qCount };
  };

  // ---------- 初始化 / 加载题库 ----------
  S.init = async function () {
    S.loadSettings();
    let raw = null;
    try {
      raw = await Phys.idb.get(KEY.bank);
    } catch (e) {}
    if (!raw || !raw.chapters) raw = window.PHYS_BANK;
    const check = S.validateBank(raw);
    if (!check.ok) {
      // 内置题库理论上一定合法；若用户导入的数据坏了，退回内置
      console.warn('题库校验失败，使用内置示例题库', check.errors);
      raw = window.PHYS_BANK;
    }
    state.bank = S.normalizeBank(raw);
    S.loadProgress();
    S.rebuildIndexes();
    state.ready = true;
    return state;
  };

  S.rebuildIndexes = function () {
    state.qIndex = new Map();
    state.chapterMap = new Map();
    state.bank.chapters.forEach(function (ch) {
      state.chapterMap.set(ch.id, ch);
      ch.questions.forEach(function (q) {
        state.qIndex.set(q.id, { q, chapter: ch });
      });
    });
    S.recomputeStats();
  };

  S.getQuestion = function (qid) {
    return state.qIndex.get(qid) || null;
  };
  S.getChapter = function (id) {
    return state.chapterMap.get(id) || null;
  };
  S.getKnowledge = function (chapter, kid) {
    return (chapter.knowledge || []).find((k) => k.id === kid) || null;
  };
  S.knowledgeTitles = function (chapter, ids) {
    return (ids || []).map((id) => {
      const k = S.getKnowledge(chapter, id);
      return k ? k.title : id;
    });
  };
  S.allQuestions = function () {
    return Array.from(state.qIndex.values());
  };

  S.setBank = async function (raw, opts) {
    opts = opts || {};
    const check = S.validateBank(raw);
    if (!check.ok) throw new Error(check.errors.slice(0, 4).join('；'));
    const oldId = state.bank && state.bank.id;
    if (opts.resetProgress || (oldId && oldId !== check.bank.id)) {
      Phys.store.remove(KEY.progress(check.bank.id));
    }
    state.bank = check.bank;
    await Phys.idb.set(KEY.bank, check.bank);
    S.loadProgress();
    S.rebuildIndexes();
    S.clearSession();
    return check;
  };

  S.restoreSampleBank = async function () {
    await Phys.idb.del(KEY.bank);
    const check = S.validateBank(window.PHYS_BANK);
    state.bank = check.bank;
    S.loadProgress();
    S.rebuildIndexes();
    S.clearSession();
  };

  S.exportBank = function () {
    return JSON.stringify(state.bank, null, 2);
  };

  // ---------- 进度 ----------
  S.blankProgress = function () {
    return { v: 1, bankId: state.bank.id, updatedAt: null, questions: {}, days: {} };
  };

  S.loadProgress = function () {
    const raw = Phys.store.get(KEY.progress(state.bank.id), null);
    if (raw && raw.questions) {
      state.progress = raw;
      state.progress.days = state.progress.days || {};
    } else {
      state.progress = S.blankProgress();
    }
    return state.progress;
  };

  S.saveProgress = function () {
    if (!state.progress) return;
    state.progress.updatedAt = new Date().toISOString();
    const ok = Phys.store.set(KEY.progress(state.bank.id), state.progress);
    if (!ok) Phys.toast('进度保存失败：存储空间不足，请导出备份后清理', 'error', 5000);
    return ok;
  };

  S.getQuestionProgress = function (qid) {
    return (state.progress.questions && state.progress.questions[qid]) || null;
  };

  function ensureProgress(qid) {
    state.progress.questions = state.progress.questions || {};
    if (!state.progress.questions[qid]) {
      state.progress.questions[qid] = {
        seen: 0,
        correct: 0,
        wrong: 0,
        streak: 0,
        bestScore: 0,
        lastResult: null,
        lastAt: null,
        lastScore: 0,
        lastAnswer: null,
        lastVerdict: '',
        lastFeedback: '',
        knowledgeGaps: [],
        similar: null,
        correctSolution: '',
        archived: false,
        wrongAt: null,
        history: []
      };
    }
    return state.progress.questions[qid];
  }

  S.recordAttempt = function (qid, result) {
    const p = ensureProgress(qid);
    const now = new Date().toISOString();
    p.seen++;
    p.lastResult = result.result;
    p.lastAt = now;
    p.lastScore = Number(result.score) || 0;
    p.lastAnswer = result.userAnswer || null;
    p.lastVerdict = Phys.truncate(result.verdict || '', 200);
    p.lastFeedback = Phys.truncate(result.feedback || '', 1200);
    p.correctSolution = Phys.truncate(result.correctSolution || '', 1600);
    p.knowledgeGaps = (result.knowledgeGaps || []).slice(0, 8);
    p.similar = result.similar || null;
    p.lastSource = result.source || 'local';
    if (result.result === 'correct') {
      p.correct++;
      p.streak++;
      p.bestScore = Math.max(p.bestScore || 0, p.lastScore);
    } else {
      p.wrong++;
      p.streak = 0;
      p.archived = false;
      p.wrongAt = now;
    }
    p.history.push({ at: now, result: result.result, score: p.lastScore });
    if (p.history.length > MAX_HISTORY) p.history = p.history.slice(-MAX_HISTORY);
    const day = Phys.dayKey(now);
    state.progress.days[day] = (state.progress.days[day] || 0) + 1;
    S.saveProgress();
    S.recomputeStats();
    return p;
  };

  S.resetProgress = function () {
    Phys.store.remove(KEY.progress(state.bank.id));
    state.progress = S.blankProgress();
    S.clearInsight();
    S.recomputeStats();
    S.clearSession();
  };

  S.exportProgress = function () {
    return JSON.stringify(
      {
        app: 'phys-lab',
        exportedAt: new Date().toISOString(),
        bankId: state.bank.id,
        bankTitle: state.bank.title,
        progress: state.progress
      },
      null,
      2
    );
  };

  S.importProgress = function (raw) {
    if (!raw || !raw.progress || !raw.progress.questions) throw new Error('不是有效的进度备份文件');
    if (raw.bankId && raw.bankId !== state.bank.id) {
      throw new Error('备份属于另一个题库（' + (raw.bankTitle || raw.bankId) + '），请先切换到对应题库');
    }
    state.progress = raw.progress;
    state.progress.days = state.progress.days || {};
    S.saveProgress();
    S.recomputeStats();
  };

  S.removeFromWrong = function (qid) {
    const p = S.getQuestionProgress(qid);
    if (!p) return;
    p.archived = true;
    S.saveProgress();
    S.recomputeStats();
  };

  S.restoreToWrong = function (qid) {
    const p = S.getQuestionProgress(qid);
    if (!p) return;
    p.archived = false;
    if (p.lastResult === 'correct') {
      p.lastResult = 'wrong';
      p.lastScore = 0;
      p.streak = 0;
      p.lastFeedback = p.lastFeedback || '';
    }
    S.saveProgress();
    S.recomputeStats();
  };

  S.markMastered = function (qid) {
    const p = ensureProgress(qid);
    p.lastResult = 'correct';
    p.lastScore = 100;
    p.lastAt = new Date().toISOString();
    p.streak = Math.max(2, p.streak || 0);
    p.archived = true;
    S.saveProgress();
    S.recomputeStats();
  };

  S.clearQuestionProgress = function (qid) {
    if (state.progress.questions[qid]) {
      delete state.progress.questions[qid];
      S.saveProgress();
      S.recomputeStats();
    }
  };

  S.statusOf = function (qid) {
    const p = S.getQuestionProgress(qid);
    if (!p || !p.seen) return 'new';
    if (p.lastResult === 'correct') {
      if (p.wrong > 0) return 'resolved';
      return 'done';
    }
    return 'wrong';
  };

  S.statusLabel = {
    new: '未做',
    wrong: '待攻克',
    resolved: '已攻克',
    done: '已掌握'
  };

  S.isActiveWrong = function (qid) {
    const p = S.getQuestionProgress(qid);
    return !!(p && p.seen && p.lastResult !== 'correct' && !p.archived);
  };
  S.isResolved = function (qid) {
    const p = S.getQuestionProgress(qid);
    return !!(p && p.wrong > 0 && p.lastResult === 'correct');
  };

  S.wrongQids = function (opts) {
    opts = opts || {};
    const out = [];
    state.bank.chapters.forEach(function (ch) {
      if (opts.chapterId && ch.id !== opts.chapterId) return;
      ch.questions.forEach(function (q) {
        const p = state.progress.questions[q.id];
        if (!p || !p.seen) return;
        if (opts.type && q.type !== opts.type) return;
        if (opts.resolved) {
          if (p.wrong > 0 && p.lastResult === 'correct') out.push(q.id);
        } else if (p.lastResult !== 'correct' && !p.archived) {
          out.push(q.id);
        }
      });
    });
    return out;
  };

  S.chapterStats = function (chapter) {
    let answered = 0;
    let correctLast = 0;
    let wrongActive = 0;
    let resolved = 0;
    let attempts = 0;
    let correctAttempts = 0;
    chapter.questions.forEach(function (q) {
      const p = state.progress.questions[q.id];
      if (p && p.seen) {
        answered++;
        attempts += p.seen;
        correctAttempts += p.correct;
        if (p.lastResult === 'correct') {
          correctLast++;
          if (p.wrong > 0) resolved++;
        } else if (!p.archived) wrongActive++;
      }
    });
    const total = chapter.questions.length;
    return {
      total,
      answered,
      correctLast,
      wrongActive,
      resolved,
      progress: total ? answered / total : 0,
      accuracy: answered ? correctLast / answered : 0,
      attemptAccuracy: attempts ? correctAttempts / attempts : 0
    };
  };

  S.computeStats = function () {
    const all = S.allQuestions();
    const chapters = state.bank.chapters.map(function (ch) {
      return { chapter: ch, stats: S.chapterStats(ch) };
    });
    let answered = 0;
    let correctLast = 0;
    let wrongActive = 0;
    let resolved = 0;
    let attempts = 0;
    let correctAttempts = 0;
    let total = all.length;
    chapters.forEach(function (row) {
      answered += row.stats.answered;
      correctLast += row.stats.correctLast;
      wrongActive += row.stats.wrongActive;
      resolved += row.stats.resolved;
    });
    all.forEach(function (row) {
      const p = state.progress.questions[row.q.id];
      if (p && p.seen) {
        attempts += p.seen;
        correctAttempts += p.correct;
      }
    });
    const days = Object.keys(state.progress.days || {});
    return {
      total,
      answered,
      correctLast,
      wrongActive,
      resolved,
      attempts,
      correctAttempts,
      progress: total ? answered / total : 0,
      accuracy: answered ? correctLast / answered : 0,
      attemptAccuracy: attempts ? correctAttempts / attempts : 0,
      streak: Phys.calcStreak(days),
      studyDays: days.length,
      chapters
    };
  };

  S.recomputeStats = function () {
    state.stats = S.computeStats();
    return state.stats;
  };

  // ---------- 错题知识点聚合 ----------
  S.weakKnowledge = function (opts) {
    opts = opts || {};
    const map = new Map();
    const qids = S.wrongQids({ resolved: false });
    qids.forEach(function (qid) {
      const row = S.getQuestion(qid);
      if (!row) return;
      if (opts.chapterId && row.chapter.id !== opts.chapterId) return;
      const p = S.getQuestionProgress(qid);
      const tags = (row.q.knowledge && row.q.knowledge.length ? row.q.knowledge : ['__none__']);
      tags.forEach(function (kid) {
        const key = row.chapter.id + '::' + kid;
        if (!map.has(key)) {
          map.set(key, {
            key,
            chapterId: row.chapter.id,
            chapterTitle: row.chapter.title,
            knowledgeId: kid,
            title: kid === '__none__' ? '未标注知识点' : (S.getKnowledge(row.chapter, kid) || {}).title || kid,
            count: 0,
            qids: [],
            lastAt: null
          });
        }
        const item = map.get(key);
        item.count++;
        item.qids.push(qid);
        if (p && p.lastAt && (!item.lastAt || p.lastAt > item.lastAt)) item.lastAt = p.lastAt;
      });
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count || a.title.localeCompare(b.title, 'zh'));
  };

  S.typeBreakdown = function () {
    const map = { single: 0, multiple: 0, blank: 0, calc: 0 };
    S.wrongQids({ resolved: false }).forEach(function (qid) {
      const row = S.getQuestion(qid);
      if (row) map[row.q.type] = (map[row.q.type] || 0) + 1;
    });
    return map;
  };

  // ---------- AI 薄弱点报告缓存 ----------
  S.insightKey = function () {
    const qids = S.wrongQids({ resolved: false }).sort();
    return qids.join('|');
  };

  S.loadInsight = function () {
    const saved = Phys.store.get(KEY.insight(state.bank.id), null);
    if (!saved) return null;
    if (saved.fingerprint !== S.insightKey()) return saved; // 保留旧报告，同时标记过期
    return saved;
  };

  S.saveInsight = function (payload) {
    const saved = {
      at: new Date().toISOString(),
      fingerprint: S.insightKey(),
      payload
    };
    Phys.store.set(KEY.insight(state.bank.id), saved);
    return saved;
  };
  S.clearInsight = function () {
    Phys.store.remove(KEY.insight(state.bank.id));
  };

  // ---------- 会话 ----------
  S.startSession = function (opts) {
    const qids = opts.qids && opts.qids.length ? opts.qids.slice() : [];
    if (!qids.length) return null;
    const index = Phys.clamp(opts.index || 0, 0, qids.length - 1);
    state.session = {
      id: Phys.uid('s'),
      mode: opts.mode || 'chapter',
      title: opts.title || '练习',
      chapterId: opts.chapterId || null,
      qids,
      index,
      startedAt: new Date().toISOString(),
      results: {},
      drafts: {},
      revealed: {}
    };
    S.persistSession();
    return state.session;
  };

  S.persistSession = function () {
    if (!state.session) return;
    const s = state.session;
    try {
      sessionStorage.setItem(
        KEY.session,
        JSON.stringify({
          id: s.id,
          mode: s.mode,
          title: s.title,
          chapterId: s.chapterId,
          qids: s.qids,
          index: s.index,
          startedAt: s.startedAt
        })
      );
    } catch (e) {}
  };

  S.loadSession = function () {
    try {
      const raw = sessionStorage.getItem(KEY.session);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || !Array.isArray(s.qids)) return null;
      s.qids = s.qids.filter((qid) => state.qIndex.has(qid));
      if (!s.qids.length) return null;
      state.session = Object.assign({ results: {}, drafts: {}, revealed: {} }, s, {
        index: Phys.clamp(s.index || 0, 0, s.qids.length - 1)
      });
      return state.session;
    } catch (e) {
      return null;
    }
  };

  S.clearSession = function () {
    state.session = null;
    try {
      sessionStorage.removeItem(KEY.session);
    } catch (e) {}
  };

  // ---------- 其他 ----------
  S.TYPE_LABEL = TYPE_LABEL;
  S.TYPE_HINT = TYPE_HINT;
  S.KEY = KEY;
  S.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
  S.presets = [
    {
      id: 'deepseek',
      name: 'DeepSeek',
      baseUrl: 'https://api.deepseek.com/v1',
      model: 'deepseek-chat',
      visionModel: '',
      note: '性价比高，纯文本批改；手写题需另配视觉模型'
    },
    {
      id: 'dashscope',
      name: '阿里云百炼 / 通义千问',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      model: 'qwen-plus',
      visionModel: 'qwen-vl-max',
      note: '支持通义千问，视觉模型可识别手写步骤'
    },
    {
      id: 'zhipu',
      name: '智谱 GLM',
      baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
      model: 'glm-4-plus',
      visionModel: 'glm-4v-plus',
      note: '支持 GLM-4V 视觉模型'
    },
    {
      id: 'openai',
      name: 'OpenAI',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      visionModel: 'gpt-4o',
      note: '需要能访问 OpenAI 的网络环境'
    },
    {
      id: 'custom',
      name: '自定义（OpenAI 兼容）',
      baseUrl: '',
      model: '',
      visionModel: '',
      note: '任何兼容 /chat/completions 的服务'
    }
  ];

  // 兼容测试 / 控制台调试
  window.Store = S;
  window.Phys.Store = S;
  Phys.chapterStats = S.chapterStats;
  Phys.statusOf = S.statusOf;
  Phys.wrongQids = S.wrongQids;
  Phys.STORE_KEY = KEY;
  Phys.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
})();
