/* 判分层：客观题本地判分 / 填空等价判断 / AI 批改与薄弱点报告 */
(function () {
  const Phys = (window.Phys = window.Phys || {});
  const G = {};

  // ---------- 文本与数值 ----------
  function normText(s) {
    return String(s == null ? '' : s)
      .normalize('NFKC')
      .replace(/\s+/g, '')
      .replace(/[，,]/g, ',')
      .replace(/[。；;]/g, '')
      .replace(/[（(]/g, '(')
      .replace(/[）)]/g, ')')
      .replace(/[×✕✖]/g, '*')
      .replace(/[÷]/g, '/')
      .replace(/[−–—]/g, '-')
      .replace(/[·⋅∙]/g, '*')
      .replace(/√/g, 'sqrt')
      .toLowerCase();
  }

  function normUnit(u) {
    return String(u || '')
      .normalize('NFKC')
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[·⋅∙]/g, '*')
      .replace(/²/g, '^2')
      .replace(/³/g, '^3')
      .replace(/⁻/g, '-')
      .replace(/\*/g, '')
      .replace(/\./g, '')
      .replace(/^1\//, '');
  }

  function parseNumeric(s) {
    const t = String(s == null ? '' : s).normalize('NFKC').trim().replace(/,/g, '.');
    const m = t.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)\s*(.*)$/);
    if (!m) return null;
    const value = Number(m[1]);
    if (!isFinite(value)) return null;
    let unit = m[2] || '';
    unit = unit.replace(/^[（(]|[）)]$/g, '').trim();
    return { value, unit };
  }

  G.normalize = normText;

  G.answerMatches = function (input, accepted, expectedUnit) {
    if (input == null) return false;
    const list = Array.isArray(accepted) ? accepted : [accepted];
    let raw = String(input).trim();
    if (!raw) return false;
    const unitNorm = normUnit(expectedUnit || '');
    const candidates = [raw];
    // 学生把单位也写进输入框时，去掉题干给出的单位再比较
    if (unitNorm) {
      const compact = raw.replace(/\s+/g, '');
      const u = expectedUnit.replace(/\s+/g, '');
      if (compact.endsWith(u)) candidates.push(compact.slice(0, compact.length - u.length));
    }
    for (const a of list) {
      const acc = String(a == null ? '' : a).trim();
      if (!acc) continue;
      for (const c of candidates) {
        if (normText(c) === normText(acc)) return true;
        const n1 = parseNumeric(c);
        const n2 = parseNumeric(acc);
        if (n1 && n2) {
          const rel = Math.abs(n1.value - n2.value) / Math.max(1e-9, Math.abs(n2.value));
          const unitOK = !unitNorm || normUnit(n1.unit) === unitNorm || !n1.unit;
          if ((rel < 0.01 || Math.abs(n1.value - n2.value) < 1e-9) && unitOK) {
            if (!n1.unit || !n2.unit || normUnit(n1.unit) === normUnit(n2.unit)) return true;
          }
        }
      }
    }
    return false;
  };

  G.formatAnswer = function (q) {
    if (q.type === 'single' || q.type === 'multiple') {
      const correct = (q.answer || []).slice().sort();
      const parts = correct.map(function (id) {
        const o = (q.options || []).find((x) => x.id === id);
        return '**' + id + '**' + (o ? '. ' + o.text : '');
      });
      return '正确答案：' + parts.join('；');
    }
    if (q.type === 'blank') {
      const parts = (q.answer || []).map(function (b, i) {
        return '(' + (i + 1) + ') ' + (b.answers || []).join(' / ') + (b.unit ? ' ' + b.unit : '');
      });
      return '参考答案：' + parts.join('；');
    }
    return '参考答案：' + ((q.answer && q.answer.reference) || '见解析');
  };

  function knowledgeGaps(q, chapter) {
    return (q.knowledge || []).map(function (kid) {
      const k = Phys.Store.getKnowledge(chapter, kid);
      return {
        id: kid,
        point: k ? k.title : kid,
        why: '这道题直接考查该知识点，建议回看本章知识卡片中的公式与易错点。'
      };
    });
  }

  function localResult(q, chapter, opts) {
    const result = opts.result;
    return {
      result,
      level: result,
      score: opts.score == null ? (result === 'correct' ? 100 : result === 'partial' ? 50 : 0) : opts.score,
      verdict: opts.verdict,
      feedback: opts.feedback || q.explanation || '',
      errors: opts.errors || [],
      correctSolution: opts.correctSolution || G.formatAnswer(q),
      knowledgeGaps: result === 'correct' ? [] : knowledgeGaps(q, chapter),
      similar: q.similar || null,
      source: opts.source || 'local',
      userAnswer: opts.userAnswer || null
    };
  }

  // ---------- 客观题 ----------
  G.gradeObjective = function (q, chapter, user) {
    const selected = (user.selected || []).map(String).sort();
    const correct = (q.answer || []).map(String).sort();
    const ok = selected.length === correct.length && selected.every((x, i) => x === correct[i]);
    const errors = [];
    if (!ok) {
      if (q.type === 'multiple') {
        const missing = correct.filter((x) => !selected.includes(x));
        const extra = selected.filter((x) => !correct.includes(x));
        if (missing.length) errors.push('漏选：' + missing.join('、'));
        if (extra.length) errors.push('多选：' + extra.join('、'));
        if (!errors.length) errors.push('选项组合不正确');
      } else {
        errors.push('你选择的是 ' + (selected.join('、') || '（未选）') + '，正确答案是 ' + correct.join('、'));
      }
    }
    return localResult(q, chapter, {
      result: ok ? 'correct' : 'wrong',
      score: ok ? 100 : 0,
      verdict: ok ? '回答正确' : '回答错误',
      feedback: q.explanation || (ok ? '答案正确。' : '请对照参考答案和解析，检查自己的判断依据。'),
      errors,
      correctSolution: G.formatAnswer(q),
      userAnswer: selected
    });
  };

  // ---------- 填空题 ----------
  G.gradeBlankLocal = function (q, chapter, user) {
    const values = user.blanks || [];
    const blanks = q.answer || [];
    let correctCount = 0;
    const errors = [];
    const details = blanks.map(function (b, i) {
      const val = values[i] == null ? '' : String(values[i]).trim();
      const ok = G.answerMatches(val, b.answers, b.unit);
      if (ok) correctCount++;
      else {
        errors.push('第 ' + (i + 1) + ' 空：你填「' + (val || '空') + '」，参考答案「' + (b.answers || []).join(' / ') + '」' + (b.unit ? ' ' + b.unit : ''));
      }
      return { index: i, value: val, ok };
    });
    const all = correctCount === blanks.length;
    const score = blanks.length ? Math.round((correctCount / blanks.length) * 100) : 0;
    return localResult(q, chapter, {
      result: all ? 'correct' : correctCount > 0 ? 'partial' : 'wrong',
      score,
      verdict: all ? '全部正确' : correctCount > 0 ? '部分正确（' + correctCount + '/' + blanks.length + '）' : '答案不正确',
      feedback: q.explanation || '',
      errors,
      correctSolution: G.formatAnswer(q),
      userAnswer: values,
      source: 'local'
    });
  };

  // ---------- AI 批改 ----------
  function strictnessText(level) {
    if (level === 'loose') return '宽松：只要物理思路和最终结果基本正确就给满分；等价表达、单位小瑕疵以提醒为主，不要重扣。';
    if (level === 'strict') return '严格：严格按评分点逐项给分；关键步骤错误、单位错误、有效数字明显不合理都要扣分，不能因为最终结果碰巧正确就给满分。';
    return '标准：按步骤给分；方法正确但最终结果错误给部分分；单位或有效数字错误适当扣分；等价表达可以接受。';
  }

  function questionText(q) {
    let s = q.stem;
    if (q.options && q.options.length) {
      s += '\n' + q.options.map((o) => o.id + '. ' + o.text).join('\n');
    }
    return s;
  }

  function referenceText(q) {
    if (q.type === 'blank') {
      return (q.answer || [])
        .map(function (b, i) {
          return '第 ' + (i + 1) + ' 空：' + (b.answers || []).join(' / ') + (b.unit ? ' ' + b.unit : '');
        })
        .join('\n');
    }
    if (q.type === 'calc') {
      return (q.answer && q.answer.reference) || '（题库未提供参考答案，请先独立解题再评讲）';
    }
    return G.formatAnswer(q);
  }

  G.buildGradePrompt = function (q, chapter, user, images) {
    const rr = (q.answer && q.answer.rubric) || [];
    const knowledge = Phys.Store.knowledgeTitles(chapter, q.knowledge);
    const cfg = Phys.Store.getAIConfig();
    const hasVision = !!cfg.visionModel && cfg.sendDrawing !== false;
    const imageNote =
      images && images.length
        ? hasVision
          ? '学生附上了 ' + images.length + ' 张手写作答图片，请仔细辨认其中的公式、代入过程和最终答案。图片可能横置、字迹潦草，请结合物理逻辑判断，不要因为识别困难就臆造内容。'
          : '学生附了手写图片，但当前没有配置视觉模型或未启用手写图片发送，你无法看到图片。请只根据文字答案批改，并在 feedback 中明确提醒「手写内容未被读取，请配置视觉模型或补充文字答案」。'
        : '学生没有附手写图片。';

    const textAnswer = (user.text || '').trim();
    const blankAnswer = (user.blanks || [])
      .map(function (v, i) {
        return '(' + (i + 1) + ') ' + (String(v || '').trim() || '（空）');
      })
      .join('；');
    const answerBlock = [
      blankAnswer ? '填空作答：' + blankAnswer : '',
      textAnswer ? '文字 / 过程：' + textAnswer : ''
    ].filter(Boolean).join('\n');
    return `你是一位严谨、耐心的大学物理助教，正在批改学生的作业。请先独立完整地解题，再对照学生作答。

【章节】${chapter.title}
【知识点】${knowledge.length ? knowledge.join('、') : '未标注'}
【题型】${Phys.Store.TYPE_LABEL[q.type] || q.type}
【题目】
${questionText(q)}

【参考答案】
${referenceText(q)}

【评分要点】
${rr.length ? rr.map((x, i) => i + 1 + '. ' + x).join('\n') : '（无细分量规，请按大学物理课程常规步骤给分）'}

【学生文字答案】
${answerBlock || '（没有文字答案）'}

【手写说明】
${imageNote}

【批改要求】
1. ${strictnessText(Phys.Store.getAIConfig().strictness)}
2. 填空题：判断数值、表达式或单位是否与参考答案等价；允许合理的等价变形、不同但正确的单位表示、正常范围内的有效数字差异。如果题目在空后已经给出单位，学生只写数值也算正确。
3. 计算题：按「物理模型 → 公式 → 代入 → 结果 → 单位」逐项检查。最终答案错误但方法正确时给步骤分；只写答案没有过程时，如果答案正确可给较高分并提醒补过程。
4. 明确指出第一个导致错误的关键步骤，不要只给最终结论；讲评要具体到公式或数值。
5. 如果学生答案完全正确，也要给出一句肯定，并指出一个可以更严谨的地方（若有）。
6. 生成一道同知识点、难度相当的「举一反三」题，附提示和简要解析。题目要可独立作答，不要依赖原题数据。
7. 使用简体中文。只输出一个 JSON 对象，不要 Markdown 代码围栏，不要输出 JSON 以外的文字。

JSON 字段：
{
  "level": "correct" | "partial" | "wrong",
  "score": 0 到 100 的整数,
  "verdict": "不超过 30 字的结论",
  "feedback": "针对学生这份作答的讲评，2 到 5 句",
  "errors": ["具体错误或遗漏，最多 5 条"],
  "correctSolution": "分步标准解法，必要时保留公式",
  "knowledgeGaps": [{"point": "知识点名称", "why": "学生为什么在这道题上暴露了这个缺口"}],
  "similar": {"question": "举一反三题目", "hint": "一句提示", "solution": "简要解析"}
}`;
  };

  G.normalizeAIResult = function (data, q, chapter, user) {
    if (!data || typeof data !== 'object') throw new Error('AI 返回内容为空');
    let score = Number(data.score);
    if (!isFinite(score)) score = 0;
    score = Phys.clamp(Math.round(score), 0, 100);
    let level = String(data.level || '').toLowerCase();
    if (!['correct', 'partial', 'wrong'].includes(level)) {
      if (data.correct === true) level = 'correct';
      else if (score >= 90) level = 'correct';
      else if (score >= 40) level = 'partial';
      else level = 'wrong';
    }
    if (level === 'correct') score = Math.max(score, 90);
    if (level === 'wrong') score = Math.min(score, 59);
    const gaps = (Array.isArray(data.knowledgeGaps) ? data.knowledgeGaps : data.knowledgeGaps ? [data.knowledgeGaps] : [])
      .map(function (g) {
        if (typeof g === 'string') g = { point: g, why: '' };
        const point = String(g.point || g.title || g.name || '');
        const hit = (chapter.knowledge || []).find((k) => k.id === point || k.title === point);
        return { id: hit ? hit.id : '', point, why: String(g.why || g.reason || '') };
      })
      .filter((g) => g.point);
    let similar = data.similar || data.example || null;
    if (similar && typeof similar === 'string') similar = { question: similar, hint: '', solution: '' };
    if (!similar || !similar.question) similar = q.similar || null;
    const errors = (Array.isArray(data.errors) ? data.errors : data.errors ? [data.errors] : []).map(String).filter(Boolean);
    return {
      result: level,
      level,
      score,
      verdict: String(data.verdict || data.conclusion || (level === 'correct' ? '回答正确' : level === 'partial' ? '部分正确' : '回答错误')),
      feedback: String(data.feedback || data.comment || data.analysis || ''),
      errors,
      correctSolution: String(data.correctSolution || data.solution || (q.answer && q.answer.reference) || G.formatAnswer(q)),
      knowledgeGaps: gaps,
      similar,
      source: 'ai',
      userAnswer: {
        selected: user.selected || [],
        blanks: user.blanks || [],
        text: user.text || '',
        hasDrawing: !!(user.images && user.images.length)
      }
    };
  };

  G.gradeWithAI = async function (q, chapter, user, images) {
    const cfg = Phys.Store.getAIConfig();
    if (!Phys.Store.hasAI()) {
      const e = new Error('还没有配置 AI 批改');
      e.code = 'NOT_CONFIGURED';
      throw e;
    }
    if ((!user.text || !user.text.trim()) && (!user.blanks || !user.blanks.some((x) => String(x || '').trim())) && (!images || !images.length)) {
      const e = new Error('请先写出答案，或在手写区写下解题过程');
      e.code = 'EMPTY_ANSWER';
      throw e;
    }
    const useVision = !!(images && images.length && cfg.visionModel && cfg.sendDrawing);
    if (images && images.length && !useVision && !user.text.trim() && !(user.blanks || []).some((x) => String(x || '').trim())) {
      const e = new Error('当前没有配置视觉模型，AI 读不到手写内容。请补充文字答案，或在设置中配置视觉模型');
      e.code = 'NO_VISION';
      throw e;
    }
    if (images && images.length && !cfg.visionModel) {
      Phys.toast('未配置视觉模型，手写图片不会参与批改', 'warn', 4200);
    }
    const prompt = G.buildGradePrompt(q, chapter, user, images || []);
    let content;
    if (useVision) {
      const parts = [{ type: 'text', text: prompt }];
      images.slice(0, 2).forEach((url) => parts.push(Phys.AI.imagePart(url)));
      content = parts;
    } else {
      content = prompt;
    }
    const out = await Phys.AI.chat({
      profile: useVision ? 'vision' : 'text',
      messages: [
        {
          role: 'system',
          content: '你是一位大学物理课程助教，擅长用中文讲题。你只输出 JSON 对象，绝不输出 JSON 以外的文字。'
        },
        { role: 'user', content }
      ],
      maxTokens: 2800,
      temperature: 0.15,
      json: true,
      timeoutMs: 150000
    });
    const data = Phys.AI.extractJSON(out.content);
    const result = G.normalizeAIResult(data, q, chapter, user);
    result.raw = out.content;
    result.usage = out.usage;
    return result;
  };

  // ---------- 自评 ----------
  G.selfResult = function (q, chapter, level, user) {
    const map = { correct: 100, partial: 50, wrong: 0 };
    return {
      result: level,
      level,
      score: map[level],
      verdict: level === 'correct' ? '自评：已掌握' : level === 'partial' ? '自评：部分掌握' : '自评：仍需复习',
      feedback: q.explanation || '请对照参考答案，重点检查自己的公式、代入和单位。',
      errors: [],
      correctSolution: q.type === 'calc' ? (q.answer && q.answer.reference) || '' : G.formatAnswer(q),
      knowledgeGaps: level === 'correct' ? [] : knowledgeGaps(q, chapter),
      similar: q.similar || null,
      source: 'self',
      userAnswer: {
        selected: user.selected || [],
        blanks: user.blanks || [],
        text: user.text || '',
        hasDrawing: !!(user.images && user.images.length)
      }
    };
  };

  // ---------- 薄弱点报告 ----------
  G.buildInsightPrompt = function (items) {
    const compact = items.slice(0, 30).map(function (it) {
      return {
        chapter: it.chapter,
        knowledge: it.knowledge,
        type: it.type,
        stem: Phys.truncate(it.stem, 260),
        studentAnswer: Phys.truncate(it.studentAnswer, 220),
        wrongCount: it.wrongCount,
        aiComment: Phys.truncate(it.aiComment, 280)
      };
    });
    return `你是一位大学物理教研老师。下面是一个学生当前错题本里的题目摘要（JSON）。请根据这些错题做一次精准的诊断，不要泛泛而谈。

${JSON.stringify(compact, null, 2)}

要求：
1. 归纳学生真正薄弱的知识点，按优先级排序，最多 5 个；每个都要指出「为什么错」和「怎么补」。
2. 找出反复出现的错误模式（例如：矢量方向处理、单位换算、受力分析漏力、把向心加速度当合力等）。
3. 给出一个可在 7 天内完成的最小复习计划，具体到每天做什么。
4. 针对最薄弱的 3 个知识点，各出一道「举一反三」题，附提示和简要解析；题目要能独立作答。
5. 使用简体中文，语气像一位负责的老师。只输出 JSON，不要代码围栏。

JSON 字段：
{
  "overview": "2 到 3 句总体诊断",
  "weakPoints": [
    {"point": "知识点", "chapter": "章节", "why": "错误原因", "explain": "用 2 到 4 句话把这个知识点讲清楚", "fix": "具体补救动作"}
  ],
  "patterns": [{"title": "错误模式", "detail": "表现与例子"}],
  "plan": ["第 1 天：...", "第 2 天：..."],
  "examples": [{"point": "对应知识点", "question": "题目", "hint": "提示", "solution": "解析"}]
}`;
  };

  G.generateInsight = async function (items) {
    if (!Phys.Store.hasAI()) {
      const e = new Error('还没有配置 AI，无法生成个性化薄弱点报告');
      e.code = 'NOT_CONFIGURED';
      throw e;
    }
    const out = await Phys.AI.chat({
      messages: [
        { role: 'system', content: '你是一位经验丰富的大学物理教研老师。你只输出 JSON 对象。' },
        { role: 'user', content: G.buildInsightPrompt(items) }
      ],
      maxTokens: 3200,
      temperature: 0.3,
      json: true,
      timeoutMs: 150000
    });
    const data = Phys.AI.extractJSON(out.content);
    return {
      overview: String(data.overview || ''),
      weakPoints: (Array.isArray(data.weakPoints) ? data.weakPoints : []).map(function (w) {
        return {
          point: String(w.point || w.title || ''),
          chapter: String(w.chapter || ''),
          why: String(w.why || ''),
          explain: String(w.explain || w.explanation || ''),
          fix: String(w.fix || w.action || '')
        };
      }).filter((w) => w.point),
      patterns: (Array.isArray(data.patterns) ? data.patterns : []).map(function (p) {
        return { title: String(p.title || ''), detail: String(p.detail || '') };
      }).filter((p) => p.title || p.detail),
      plan: (Array.isArray(data.plan) ? data.plan : []).map(String).filter(Boolean),
      examples: (Array.isArray(data.examples) ? data.examples : []).map(function (e) {
        return {
          point: String(e.point || e.knowledge || ''),
          question: String(e.question || e.q || ''),
          hint: String(e.hint || ''),
          solution: String(e.solution || e.answer || '')
        };
      }).filter((e) => e.question)
    };
  };

  G.buildInsightItems = function () {
    const qids = Phys.Store.wrongQids({ resolved: false });
    return qids.map(function (qid) {
      const row = Phys.Store.getQuestion(qid);
      if (!row) return null;
      const p = Phys.Store.getQuestionProgress(qid);
      return {
        chapter: row.chapter.title,
        knowledge: Phys.Store.knowledgeTitles(row.chapter, row.q.knowledge).join('、') || '未标注',
        type: Phys.Store.TYPE_LABEL[row.q.type] || row.q.type,
        stem: row.q.stem,
        studentAnswer: p && p.lastAnswer
          ? (Array.isArray(p.lastAnswer)
            ? p.lastAnswer.join('、')
            : (typeof p.lastAnswer === 'object'
              ? (p.lastAnswer.text || (p.lastAnswer.hasDrawing ? '手写作答' : ''))
              : String(p.lastAnswer)))
          : '',
        wrongCount: p ? p.wrong : 0,
        aiComment: p ? p.lastFeedback || p.lastVerdict : ''
      };
    }).filter(Boolean);
  };

  window.Phys.Grader = G;
})();
