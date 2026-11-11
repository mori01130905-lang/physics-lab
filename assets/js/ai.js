/* AI 接口层：OpenAI 兼容 /chat/completions，支持文本与视觉模型 */
(function () {
  const Phys = (window.Phys = window.Phys || {});
  const AI = {};

  function endpoint(baseUrl) {
    let u = String(baseUrl || '').trim().replace(/\/+$/, '');
    if (!u) throw new Error('还没有填写 AI 接口地址');
    if (/\/chat\/completions$/i.test(u)) return u;
    if (/\/v1$/i.test(u)) return u + '/chat/completions';
    // 百炼、智谱等兼容地址本身就带版本号
    return u + '/chat/completions';
  }

  function err(msg, code, extra) {
    const e = new Error(msg);
    e.code = code || 'AI_ERROR';
    if (extra) Object.assign(e, extra);
    return e;
  }

  function statusMessage(status, detail) {
    if (status === 401 || status === 403) return 'API Key 无效、已过期或没有该模型权限（HTTP ' + status + '）';
    if (status === 404) return '接口地址或模型名不正确（HTTP 404）。请检查 Base URL 是否需要带 /v1';
    if (status === 429) return '请求太频繁或额度不足（HTTP 429），请稍后再试或检查账户余额';
    if (status >= 500) return 'AI 服务暂时不可用（HTTP ' + status + '），请稍后重试';
    return 'AI 请求失败（HTTP ' + status + '）' + (detail ? '：' + detail.slice(0, 200) : '');
  }

  async function fetchWithTimeout(url, options, timeoutMs) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs || 120000);
    try {
      return await fetch(url, Object.assign({}, options, { signal: ctrl.signal }));
    } finally {
      clearTimeout(timer);
    }
  }

  AI.chat = async function (opts) {
    const cfg = Phys.Store.getAIConfig();
    const useVision = opts.profile === 'vision';
    const baseUrl = useVision ? cfg.visionBaseUrl : cfg.baseUrl;
    const apiKey = useVision ? cfg.visionApiKey : cfg.apiKey;
    const model = useVision ? cfg.visionModel : cfg.model;
    if (!baseUrl || !apiKey || !model) {
      throw err(useVision ? '还没有配置视觉模型，无法读取手写图片' : '还没有配置 AI 批改，请先在「设置」中填写接口和 Key', 'NOT_CONFIGURED');
    }

    const messages = opts.messages;
    const body = {
      model,
      messages,
      temperature: opts.temperature == null ? 0.2 : opts.temperature,
      max_tokens: opts.maxTokens || 1800,
      stream: false
    };
    if (opts.json !== false) body.response_format = { type: 'json_object' };

    async function doRequest(payload) {
      let res;
      try {
        res = await fetchWithTimeout(endpoint(baseUrl), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + apiKey
          },
          body: JSON.stringify(payload)
        }, opts.timeoutMs || 120000);
      } catch (e) {
        if (e.name === 'AbortError') throw err('AI 响应超时（超过 2 分钟）。题目或图片可能太大，请稍后重试', 'TIMEOUT');
        throw err('无法连接 AI 接口。请检查网络、Base URL，以及该服务是否允许浏览器直接跨域访问', 'NETWORK', { cause: e });
      }

      if (!res.ok) {
        let detail = '';
        try {
          const txt = await res.text();
          detail = txt;
          try {
            const j = JSON.parse(txt);
            detail = (j.error && (j.error.message || j.error.code)) || j.message || txt;
          } catch (e2) {}
        } catch (e3) {}
        const error = err(statusMessage(res.status, detail), 'HTTP_' + res.status, { status: res.status, detail });
        throw error;
      }
      let data;
      try {
        data = await res.json();
      } catch (e) {
        throw err('AI 返回的不是有效 JSON（可能是接口地址填成了网页地址）', 'BAD_RESPONSE');
      }
      const choice = data && data.choices && data.choices[0];
      let content = choice && choice.message && choice.message.content;
      if (Array.isArray(content)) {
        content = content.map((part) => (typeof part === 'string' ? part : part.text || '')).join('');
      }
      if (!content || !String(content).trim()) {
        if (choice && choice.message && choice.message.reasoning_content) {
          throw err('模型只返回了推理过程，没有最终答案，请换一个模型或重试', 'EMPTY_CONTENT');
        }
        throw err('AI 返回了空内容，请重试或更换模型', 'EMPTY_CONTENT');
      }
      return { content: String(content), usage: data.usage || null, model, raw: data };
    }

    try {
      return await doRequest(body);
    } catch (e) {
      // 部分兼容服务不接受 response_format，去掉后重试一次
      if (e.status === 400 && body.response_format) {
        const retryBody = Object.assign({}, body);
        delete retryBody.response_format;
        try {
          return await doRequest(retryBody);
        } catch (e2) {
          throw e2;
        }
      }
      if (e.status === 429 || e.status >= 500) {
        await Phys.sleep(1200);
        return doRequest(body);
      }
      throw e;
    }
  };

  AI.extractJSON = function (text) {
    let s = String(text || '').trim();
    if (!s) throw err('AI 返回为空', 'BAD_JSON');
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    // 去掉可能出现在 JSON 前后的说明文字
    const start = s.indexOf('{');
    const end = s.lastIndexOf('}');
    if (start >= 0 && end > start) s = s.slice(start, end + 1);
    try {
      return JSON.parse(s);
    } catch (e) {
      // 尝试修复中文引号、尾逗号
      const repaired = s
        .replace(/[“”]/g, '"')
        .replace(/,\s*([}\]])/g, '$1');
      try {
        return JSON.parse(repaired);
      } catch (e2) {
        throw err('AI 返回格式异常，无法解析为 JSON。可重试一次，或换用更稳定的模型', 'BAD_JSON', { raw: String(text).slice(0, 800) });
      }
    }
  };

  AI.test = async function () {
    const started = performance.now();
    const out = await AI.chat({
      messages: [
        { role: 'system', content: '你是连接测试助手。' },
        { role: 'user', content: '请只回复两个字：正常' }
      ],
      maxTokens: 24,
      temperature: 0,
      json: false,
      timeoutMs: 45000
    });
    return {
      ms: Math.round(performance.now() - started),
      content: out.content.trim(),
      model: out.model
    };
  };

  AI.imagePart = function (dataUrl) {
    return { type: 'image_url', image_url: { url: dataUrl } };
  };

  AI.friendlyError = function (e) {
    if (!e) return '未知错误';
    if (e.code === 'NOT_CONFIGURED') return e.message;
    if (e.code === 'NETWORK') return e.message + '（也可能是平板处于离线状态）';
    return e.message || 'AI 请求失败';
  };

  Phys.AI = AI;
})();
