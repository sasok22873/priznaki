/* =========================================================================
   Мозговой штурм: сессии, идеи, голоса, ICE, превращение идей
   в задачи/цели/проекты/направления. Всё хранится в Supabase.
   ========================================================================= */
(function () {
  const sb = function () { return window.supabaseClient; };
  const STAGES = [
    { key: 'storm', label: '1 · Штурм' },
    { key: 'select', label: '2 · Отбор' },
    { key: 'summary', label: '3 · Итоги' }
  ];
  const TEMPLATES = {
    '': { label: 'Без шаблона', prompts: [] },
    names: { label: 'Названия песен', prompts: ['О чём эта песня?', 'Какая метафора цепляет?', 'Какая фраза может стать крючком?'] },
    clip: { label: 'Идеи для клипа', prompts: ['Локация и время суток', 'Сюжет в одном предложении', 'Визуальный приём/фишка'] },
    content: { label: 'Контент-план', prompts: ['Идея рилса', 'Идея поста', 'Серия сторис'] }
  };
  const TYPE_LABELS = { task: 'Задача', goal: 'Цель', project: 'Проект', direction: 'Направление' };

  const state = {
    view: 'list',
    filter: 'active',
    sessions: [],
    session: null,
    ideas: [],
    votes: {},
    myVotes: {},
    loading: false,
    pendingConvert: null
  };

  // ---------- CSS ----------
  const css = document.createElement('style');
  css.id = 'pbBrainStyle';
  css.textContent = [
    '#brainstormApp{display:grid;gap:16px}',
    '.pb-brain-bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center}',
    '.pb-brain-bar .pb-spacer{flex:1 1 auto}',
    '.pb-brain-tabs{display:inline-flex;gap:4px;padding:3px;border:1px solid rgba(255,255,255,.08);border-radius:11px;background:rgba(255,255,255,.02)}',
    '.pb-brain-tabs button{border:0;background:transparent;color:#a8a3b3;font:12.5px inherit;padding:6px 12px;border-radius:8px;cursor:pointer}',
    '.pb-brain-tabs button.active{background:rgba(167,139,250,.18);color:#f1ecff}',
    '.pb-session-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}',
    '.pb-session{border:1px solid rgba(255,255,255,.08);border-radius:16px;background:#15151a;padding:14px;display:grid;gap:8px;cursor:pointer;transition:border-color .15s,transform .15s,box-shadow .15s}',
    '.pb-session:hover{border-color:rgba(167,139,250,.55);transform:translateY(-1px);box-shadow:0 12px 28px rgba(0,0,0,.4)}',
    '.pb-session b{font-size:14px;color:#efeaf8;line-height:1.3}',
    '.pb-session-topic{font-size:12px;color:#8f8a9c;min-height:14px}',
    '.pb-session-meta{display:flex;flex-wrap:wrap;gap:6px;font-size:10.5px;color:#8f8a9c}',
    '.pb-session-meta span{background:rgba(255,255,255,.05);border-radius:6px;padding:1px 7px}',
    '.pb-badge-arch{color:#fbbf24;border:1px solid rgba(251,191,36,.35);border-radius:999px;padding:1px 8px;font-size:10.5px}',
    '.pb-brain-head{display:flex;flex-wrap:wrap;align-items:center;gap:10px}',
    '.pb-brain-title{font-size:20px;font-weight:650;letter-spacing:-.02em;color:#f1ecff}',
    '.pb-brain-stage{display:grid;gap:14px;margin-top:6px}',
    '.pb-add-row{display:flex;gap:8px;align-items:flex-end}',
    '.pb-add-row textarea{flex:1 1 auto;min-height:46px;max-height:120px;resize:vertical}',
    '.pb-add-row .btn{height:46px;min-width:52px;font-size:20px}',
    '.pb-idea{padding:10px 12px;border:1px solid rgba(255,255,255,.09);border-radius:13px;background:rgba(255,255,255,.02);display:flex;gap:10px;align-items:flex-start;transition:border-color .14s,box-shadow .14s}',
    '.pb-idea:hover{border-color:rgba(167,139,250,.4)}',
    '.pb-idea.dragging{border-color:rgba(167,139,250,.85);box-shadow:0 14px 30px rgba(0,0,0,.5);background:rgba(167,139,250,.06)}',
    '.pb-idea-handle{color:#575266;cursor:grab;font-size:16px;line-height:1.2;padding-top:2px;touch-action:none;user-select:none}',
    '.pb-idea-handle:hover{color:#c4b5fd}',
    '.pb-idea-num{color:#6f6a7d;font-size:11px;min-width:18px;padding-top:3px}',
    '.pb-idea-main{flex:1 1 auto;min-width:0;display:grid;gap:4px}',
    '.pb-idea-text{width:100%;background:transparent;border:0;color:#e7e2f2;font:13.5px/1.4 inherit;resize:vertical;min-height:22px;padding:0}',
    '.pb-idea-text:focus{outline:none;border-bottom:1px dashed rgba(167,139,250,.5)}',
    '.pb-idea-author{font-size:10.5px;color:#6f6a7d}',
    '.pb-idea-actions{display:flex;gap:6px;align-items:center}',
    '.pb-vote{border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.03);border-radius:9px;color:#a8a3b3;font:11.5px inherit;padding:5px 8px;cursor:pointer}',
    '.pb-vote:hover{color:#fda4af;border-color:rgba(253,164,175,.5)}',
    '.pb-vote.voted{color:#fb7185;border-color:rgba(251,113,133,.65);background:rgba(251,113,133,.12)}',
    '.pb-iconbtn{width:30px;height:30px;border-radius:9px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.03);color:#a8a3b3;cursor:pointer;line-height:1;font-size:13px}',
    '.pb-iconbtn:hover{color:#fff;border-color:rgba(167,139,250,.6)}',
    '.pb-iconbtn.danger:hover{color:#fff;border-color:rgba(248,113,113,.75);background:rgba(248,113,113,.16)}',
    '.pb-idea-note{width:100%;min-height:38px;border-radius:9px;background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.08);color:#d8d2e6;font:12.5px/1.4 inherit;padding:6px 8px;resize:vertical}',
    '.pb-ice{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}',
    '.pb-ice label{display:grid;gap:3px;font-size:10.5px;color:#8f8a9c}',
    '.pb-ice label{display:grid;gap:3px;font-size:10.5px;color:#8f8a9c}',
    '.pb-ice label b{color:#e6e2ee;font-size:11.5px;font-weight:600}',
    '.pb-ice input[type="range"]{width:100%;height:18px;accent-color:#a78bfa;background:transparent;border:0;padding:0;margin:0;cursor:pointer}',
    '.pb-ice-score{font-size:11px;color:#c4b5fd}',
    '.pb-tag{font-size:10.5px;border-radius:999px;padding:1px 8px;border:1px solid rgba(255,255,255,.12);color:#a8a3b3}',
    '.pb-tag.accepted{color:#34d399;border-color:rgba(52,211,153,.4)}',
    '.pb-tag.rejected{color:#f87171;border-color:rgba(248,113,113,.35)}',
    '.pb-tag.converted{color:#c4b5fd;border-color:rgba(167,139,250,.5)}',
    '.pb-sec-title{display:flex;align-items:center;gap:10px;font-size:13px;color:#a8a3b3;margin:6px 0 2px}',
    '.pb-sec-title .pb-spacer{flex:1 1 auto}',
    '.pb-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}',
    '.pb-sum-card{border:1px solid rgba(255,255,255,.08);border-radius:14px;background:#15151a;padding:12px 14px;display:grid;gap:4px}',
    '.pb-sum-card span{font-size:11px;color:#8f8a9c}',
    '.pb-sum-card b{font-size:22px;color:#f1ecff}',
    '.pb-empty{border:1px dashed rgba(255,255,255,.12);border-radius:14px;padding:22px;text-align:center;color:#8f8a9c;font-size:13px}',
    '.pb-prompts{display:flex;flex-wrap:wrap;gap:6px}',
    '.pb-prompts span{font-size:11.5px;border:1px solid rgba(255,255,255,.1);border-radius:999px;padding:3px 10px;color:#a8a3b3}',
    '#pbConvertModal .modal{max-width:520px}',
    '.pb-type-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:8px 0 4px}',
    '.pb-type-grid button{padding:14px;border-radius:13px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.02);color:#e7e2f2;font:13px inherit;cursor:pointer;display:grid;gap:4px;text-align:left}',
    '.pb-type-grid button:hover{border-color:rgba(167,139,250,.7);background:rgba(167,139,250,.1)}',
    '.pb-type-grid small{color:#8f8a9c;font-size:11px}',
    '@media (max-width:700px){.pb-brain-bar{gap:8px}.pb-brain-tabs{flex-wrap:wrap;width:100%}.pb-brain-tabs button{flex:1 1 auto}.pb-brain-head{gap:8px}.pb-brain-title{font-size:17px;word-break:break-word}#brainstormApp{padding-bottom:6px}.pb-add-row{flex-direction:row;align-items:stretch}.pb-add-row textarea{min-height:52px}.pb-idea{padding:10px;gap:8px}.pb-idea-text{resize:none}.pb-sec-title{flex-wrap:wrap}.pb-idea-actions{flex-direction:column;align-items:flex-end}.pb-ice{grid-template-columns:1fr;gap:8px}.pb-type-grid{grid-template-columns:1fr}.pb-session-grid{grid-template-columns:1fr}.pb-summary{grid-template-columns:1fr 1fr}}',
  ].join('');
  document.head.appendChild(css);
  css.textContent += '.nav [data-page="brainstorm"] .ico{--ico:url("data:image/svg+xml,%3Csvg%20xmlns=%27http%3A//www.w3.org/2000/svg%27%20viewBox=%270%200%2024%2024%27%20fill=%27none%27%20stroke=%27black%27%20stroke-width=%271.7%27%20stroke-linecap=%27round%27%20stroke-linejoin=%27round%27%3E%3Cpath%20d=%27M12%205a3%203%200%201%200-5.997.125%204%204%200%200%200-2.526%205.77%204%204%200%200%200%20.556%206.588A4%204%200%201%200%2012%2018Z%27/%3E%3Cpath%20d=%27M12%205a3%203%200%201%201%205.997.125%204%204%200%200%201%202.526%205.77%204%204%200%200%201-.556%206.588A4%204%200%201%201%2012%2018Z%27/%3E%3Cpath%20d=%27M15%2013a4.5%204.5%200%200%201-3-4%204.5%204.5%200%200%201-3%204%27/%3E%3Cpath%20d=%27M17.599%206.5a3%203%200%200%200%20.399-1.375%27/%3E%3Cpath%20d=%27M6.003%205.125A3%203%200%200%200%206.401%206.5%27/%3E%3Cpath%20d=%27M3.477%2010.896a4%204%200%200%201%20.585-.396%27/%3E%3Cpath%20d=%27M19.938%2010.5a4%204%200%200%201%20.585.396%27/%3E%3Cpath%20d=%27M6%2018a4%204%200%200%201-1.967-.516%27/%3E%3Cpath%20d=%27M19.967%2017.484A4%204%200%200%201%2018%2018%27/%3E%3C/svg%3E")}';

  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function toast(m) { if (typeof window.toast === 'function') window.toast(m); }
  function fmtDate(iso) {
    if (!iso) return '';
    try { return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso)); } catch (e) { return ''; }
  }
  function fmtShort(iso) {
    if (!iso) return '';
    try { return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(new Date(iso)); } catch (e) { return ''; }
  }
  function me() { return window.__CURRENT_PROFILE__ || {}; }
  function canWrite() { const r = me().role; return r === 'owner' || r === 'member'; }
  function iceScore(i) { return (Number(i.impact) || 0) + (Number(i.confidence) || 0) + (Number(i.ease) || 0); }

  // ---------- DOM: навигация и страница ----------
  function injectNav() {
    const nav = document.getElementById('nav');
    if (nav && !nav.querySelector('[data-page="brainstorm"]')) {
      const b = document.createElement('button');
      b.setAttribute('data-page', 'brainstorm');
      b.innerHTML = '<span class="ico" aria-hidden="true"></span>Мозговой штурм';
      const anchor = nav.querySelector('[data-page="promotion"]');
      if (anchor && anchor.nextSibling) nav.insertBefore(b, anchor.nextSibling);
      else nav.appendChild(b);
    }
    const moreGrid = document.querySelector('#mobileMore .mobile-more-grid');
    if (moreGrid && !moreGrid.querySelector('[data-mobile-page="brainstorm"]')) {
      const b = document.createElement('button');
      b.setAttribute('data-mobile-page', 'brainstorm');
      b.innerHTML = '<span>🧠</span><b>Мозговой штурм</b>';
      b.onclick = function () { if (typeof window.mobileGo === 'function') window.mobileGo('brainstorm'); };
      moreGrid.appendChild(b);
    }
  }

  function ensurePage() {
    if (document.getElementById('brainstorm')) return;
    const main = document.querySelector('.app main') || document.querySelector('main');
    if (!main) return;
    const sec = document.createElement('section');
    sec.id = 'brainstorm';
    sec.className = 'page';
    sec.innerHTML = '<div id="brainstormApp"></div>';
    main.appendChild(sec);
  }

  function ensureRoot() {
    ensurePage();
    let host = document.getElementById('brainstormApp');
    const sec = document.getElementById('brainstorm');
    if (host && sec && host.parentNode !== sec) { sec.appendChild(host); }
    return host;
  }

  function active() {
    const sec = document.getElementById('brainstorm');
    return sec && sec.classList.contains('active');
  }

  // ---------- загрузка данных ----------
  async function loadSessions() {
    const c = sb();
    if (!c) return;
    const { data, error } = await c.from('brainstorm_sessions').select('*').order('created_at', { ascending: false });
    if (error) { console.warn('[brainstorm] sessions', error.message); return; }
    state.sessions = data || [];
  }

  async function loadSession(id) {
    const c = sb();
    if (!c) return;
    const { data: session } = await c.from('brainstorm_sessions').select('*').eq('id', id).maybeSingle();
    if (!session) { toast('Сессия не найдена'); state.view = 'list'; render(); return; }
    state.session = session;
    const { data: ideas } = await c.from('brainstorm_ideas').select('*').eq('session_id', id).order('order_index', { ascending: true }).order('created_at', { ascending: true });
    state.ideas = ideas || [];
    const ids = state.ideas.map(function (i) { return i.id; });
    state.votes = {};
    state.myVotes = {};
    if (ids.length) {
      const { data: votes } = await c.from('brainstorm_votes').select('idea_id, user_id').in('idea_id', ids);
      (votes || []).forEach(function (v) {
        state.votes[v.idea_id] = (state.votes[v.idea_id] || 0) + 1;
        if (v.user_id === me().id) state.myVotes[v.idea_id] = true;
      });
    }
  }

  async function patchSession(patch) {
    const c = sb();
    if (!c || !state.session) return;
    patch.updated_at = new Date().toISOString();
    Object.assign(state.session, patch);
    const { error } = await c.from('brainstorm_sessions').update(patch).eq('id', state.session.id);
    if (error) console.warn('[brainstorm] patch session', error.message);
  }

  async function patchIdea(idea, patch) {
    const c = sb();
    if (!c) return;
    Object.assign(idea, patch);
    patch.updated_at = new Date().toISOString();
    const { error } = await c.from('brainstorm_ideas').update(patch).eq('id', idea.id);
    if (error) { console.warn('[brainstorm] patch idea', error.message); toast('Не сохранилось: ' + error.message); }
  }

  function nextAutoTitle() {
    const n = state.sessions.length + 1;
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return 'МШ-' + n + ' · ' + dd + '.' + mm;
  }

  // ---------- рендер ----------
  function render() {
    const host = ensureRoot();
    if (!host) return;
    injectNav();
    if (!active()) return;
    host.innerHTML = '';
    if (state.view === 'session' && state.session) renderSession(host);
    else renderList(host);
  }

  function renderList(host) {
    const list = state.sessions.filter(function (s) {
      return state.filter === 'archive' ? s.status === 'archived' : s.status !== 'archived';
    });
    host.innerHTML = [
      '<div class="pb-brain-bar">',
      '<div class="pb-brain-tabs" data-brain-filter>',
      '<button data-filter="active" class="' + (state.filter === 'active' ? 'active' : '') + '">Активные</button>',
      '<button data-filter="archive" class="' + (state.filter === 'archive' ? 'active' : '') + '">Архив</button>',
      '</div>',
      '<span class="pb-spacer"></span>',
      canWrite() ? '<button class="btn red" data-brain-action="new">＋ Новая сессия</button>' : '',
      '</div>',
      list.length ? '<div class="pb-session-grid">' + list.map(function (s) {
        return '<div class="pb-session" data-brain-session="' + esc(s.id) + '">' +
          '<b>' + esc(s.title) + '</b>' +
          '<div class="pb-session-topic">' + esc(s.topic || 'без темы') + '</div>' +
          '<div class="pb-session-meta"><span>' + fmtDate(s.created_at) + '</span>' +
          '<span>' + esc(STAGES.filter(function (x) { return x.key === s.stage; })[0] ? STAGES.filter(function (x) { return x.key === s.stage; })[0].label : 'Штурм') + '</span>' +
          (s.status === 'archived' ? '<span class="pb-badge-arch">архив</span>' : '') +
          '</div></div>';
      }).join('') + '</div>'
        : '<div class="pb-empty">' + (state.filter === 'archive' ? 'Архив пуст.' : 'Сессий пока нет. Создайте первую — например, «идеи для нового клипа».') + '</div>'
    ].join('');
  }

  function renderSession(host) {
    const s = state.session;
    const stage = s.stage || 'storm';
    const ideas = state.ideas;
    const counts = {
      total: ideas.length,
      accepted: ideas.filter(function (i) { return i.status === 'accepted' || i.status === 'converted'; }).length,
      rejected: ideas.filter(function (i) { return i.status === 'rejected'; }).length,
      converted: ideas.filter(function (i) { return i.status === 'converted'; }).length
    };
    const head = [
      '<div class="pb-brain-head">',
      '<button class="btn ghost tiny" data-brain-action="back">← Сессии</button>',
      '<span class="pb-brain-title" id="pbBrainTitle" contenteditable="' + (canWrite() ? 'true' : 'false') + '">' + esc(s.title) + '</span>',
      (s.status === 'archived' ? '<span class="pb-badge-arch">архив</span>' : ''),
      '<span class="pb-spacer" style="flex:1 1 auto"></span>',
      '<span style="font-size:11.5px;color:#6f6a7d">идей: ' + counts.total + ' · принято: ' + counts.accepted + '</span>',
      (canWrite() ? '<button class="pb-iconbtn danger" data-brain-action="delete-session" title="Удалить сессию">🗑</button>' : ''),
      '</div>',
      '<div class="pb-brain-tabs" data-brain-stage>' + STAGES.map(function (x) {
        return '<button data-stage="' + x.key + '" class="' + (stage === x.key ? 'active' : '') + '">' + x.label + '</button>';
      }).join('') + '</div>'
    ].join('');

    let body = '';
    if (stage === 'storm') body = stormHTML(ideas);
    else if (stage === 'select') body = selectHTML(ideas, counts);
    else body = summaryHTML(ideas, counts);

    host.innerHTML = '<div class="pb-brain-stage">' + head + body + '</div>';
  }

  function stormHTML(ideas) {
    const tpl = TEMPLATES[state.session.template || ''] || TEMPLATES[''];
    const prompts = tpl.prompts || [];
    return [
      canWrite() ? '<div class="pb-add-row">' +
        '<textarea class="field" id="pbBrainInput" rows="1" placeholder="Напишите идею и нажмите ＋ (Enter — добавить, Shift+Enter — перенос строки)"></textarea>' +
        '<button class="btn red" data-brain-action="add" title="Добавить идею">＋</button>' +
        '</div>' : '',
      prompts.length && !ideas.length ? '<div class="pb-prompts">' + prompts.map(function (p) { return '<span>' + esc(p) + '</span>'; }).join('') + '</div>' : '',
      ideas.length ? '<div id="pbBrainList">' + ideas.map(function (idea, idx) { return stormIdeaHTML(idea, idx); }).join('') + '</div>'
        : '<div class="pb-empty">Идей пока нет. Начните с первого вопроса: что приходит в голову?</div>'
    ].join('');
  }

  function stormIdeaHTML(idea, idx) {
    const votes = state.votes[idea.id] || 0;
    const voted = !!state.myVotes[idea.id];
    return '<div class="pb-idea" data-brain-idea="' + esc(idea.id) + '">' +
      '<span class="pb-idea-handle" title="Перетащить">⠿</span>' +
      '<span class="pb-idea-num">' + (idx + 1) + '</span>' +
      '<div class="pb-idea-main">' +
      '<textarea class="pb-idea-text" rows="1" data-idea-text>' + esc(idea.text) + '</textarea>' +
      '<span class="pb-idea-author">' + esc(idea.author_name || '') + (idea.note ? ' · есть заметка' : '') + '</span>' +
      '</div>' +
      '<div class="pb-idea-actions">' +
      '<button class="pb-vote' + (voted ? ' voted' : '') + '" data-brain-vote="' + esc(idea.id) + '">♥ ' + votes + '</button>' +
      (canWrite() ? '<button class="pb-iconbtn danger" data-brain-del="' + esc(idea.id) + '" title="Удалить идею">✕</button>' : '') +
      '</div></div>';
  }

  function selectHTML(ideas, counts) {
    const live = ideas.filter(function (i) { return i.status !== 'rejected'; });
    const rejected = ideas.filter(function (i) { return i.status === 'rejected'; });
    const sorted = live.slice().sort(function (a, b) {
      const ca = a.status === 'converted' ? 1 : 0, cb = b.status === 'converted' ? 1 : 0;
      if (ca !== cb) return cb - ca;
      return iceScore(b) - iceScore(a);
    });
    return [
      '<div class="pb-sec-title">Берём или в мусор <span class="pb-spacer"></span><span style="font-size:11px;color:#6f6a7d">' + counts.accepted + ' принято · ' + counts.converted + ' оформлено</span></div>',
      live.length ? sorted.map(selectIdeaHTML).join('') : '<div class="pb-empty">Пока нечего отбирать — вернитесь на этап «Штурм» и добавьте идеи.</div>',
      rejected.length ? '<details class="pb-sec-title"><summary style="cursor:pointer;color:#8f8a9c">Мусор (' + rejected.length + ')</summary>' +
        rejected.map(function (idea) {
          return '<div class="pb-idea" data-brain-idea="' + esc(idea.id) + '">' +
            '<div class="pb-idea-main"><span style="font-size:13px;color:#8f8a9c;text-decoration:line-through">' + esc(idea.text) + '</span></div>' +
            (canWrite() ? '<button class="pb-iconbtn" data-brain-restore="' + esc(idea.id) + '" title="Вернуть">↩</button>' : '') +
            '</div>';
        }).join('') + '</details>' : ''
    ].join('');
  }

  function selectIdeaHTML(idea) {
    const converted = idea.status === 'converted';
    const accepted = idea.status === 'accepted' || converted;
    return '<div class="pb-idea" data-brain-idea="' + esc(idea.id) + '">' +
      '<div class="pb-idea-main">' +
      '<textarea class="pb-idea-text" rows="1" data-idea-text>' + esc(idea.text) + '</textarea>' +
      '<textarea class="pb-idea-note" rows="1" placeholder="Почему берём / что уточнить" data-idea-note>' + esc(idea.note || '') + '</textarea>' +
      '<div class="pb-ice">' +
      '<label>Польза <b data-ice-val="impact">' + (idea.impact || 0) + '</b><input type="range" min="0" max="10" step="1" data-ice="impact" value="' + (idea.impact || 0) + '"></label>' +
      '<label>Уверенность <b data-ice-val="confidence">' + (idea.confidence || 0) + '</b><input type="range" min="0" max="10" step="1" data-ice="confidence" value="' + (idea.confidence || 0) + '"></label>' +
      '<label>Лёгкость <b data-ice-val="ease">' + (idea.ease || 0) + '</b><input type="range" min="0" max="10" step="1" data-ice="ease" value="' + (idea.ease || 0) + '"></label>' +
      '</div>' +
      '<span class="pb-ice-score">ICE: ' + iceScore(idea) + '/30</span>' +
      '</div>' +
      '<div class="pb-idea-actions" style="flex-direction:column;align-items:flex-end">' +
      (accepted ? '<span class="pb-tag accepted">принято</span>' : '<span class="pb-tag">идея</span>') +
      (converted ? '<span class="pb-tag converted">→ ' + esc(TYPE_LABELS[idea.target_type] || 'оформлено') + ': ' + esc(idea.target_title || '') + '</span>' : '') +
      (canWrite() ? '<div style="display:flex;gap:6px;margin-top:4px">' +
        '<button class="pb-iconbtn" data-brain-accept="' + esc(idea.id) + '" title="Берём" style="color:#34d399">✓</button>' +
        '<button class="pb-iconbtn danger" data-brain-reject="' + esc(idea.id) + '" title="В мусор">🗑</button>' +
        '</div>' : '') +
      '</div></div>';
  }

  function summaryHTML(ideas, counts) {
    const converted = ideas.filter(function (i) { return i.status === 'converted'; });
    return [
      '<div class="pb-summary">' +
      '<div class="pb-sum-card"><span>Всего идей</span><b>' + counts.total + '</b></div>' +
      '<div class="pb-sum-card"><span>Принято</span><b>' + counts.accepted + '</b></div>' +
      '<div class="pb-sum-card"><span>В мусор</span><b>' + counts.rejected + '</b></div>' +
      '<div class="pb-sum-card"><span>Оформлено</span><b>' + counts.converted + '</b></div>' +
      '</div>',
      '<div class="pb-sec-title">Что получилось <span class="pb-spacer"></span>' +
      '<button class="btn ghost tiny" data-brain-action="export">Выгрузить текст</button></div>',
      converted.length ? converted.map(function (i) {
        return '<div class="pb-idea"><div class="pb-idea-main"><b style="font-size:13px;color:#e7e2f2">' + esc(i.text) + '</b>' +
          '<span class="pb-idea-author">→ ' + esc(TYPE_LABELS[i.target_type] || '') + ': ' + esc(i.target_title || '') + '</span></div></div>';
      }).join('') : '<div class="pb-empty">Пока ничего не оформлено. На этапе «Отбор» нажмите ✓ и выберите, чем станет идея.</div>',
      '<div class="pb-brain-bar" style="margin-top:6px">' +
      (canWrite() && state.session.status !== 'archived' ? '<button class="btn red" data-brain-action="archive">Завершить сессию</button>' : '') +
      (canWrite() && state.session.status === 'archived' ? '<button class="btn ghost" data-brain-action="restore-session">Вернуть в работу</button>' : '') +
      '<span class="pb-spacer"></span><button class="btn ghost tiny" data-brain-action="back">К списку сессий</button></div>'
    ].join('');
  }

  // ---------- действия ----------
  let saveTimer = null;
  function scheduleSave(fn, delay) {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(fn, delay || 700);
  }

  async function addIdea() {
    const input = document.getElementById('pbBrainInput');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    const c = sb();
    if (!c || !state.session) return;
    const maxOrder = state.ideas.reduce(function (m, i) { return Math.max(m, Number(i.order_index) || 0); }, 0);
    const row = {
      session_id: state.session.id,
      text: text,
      author_id: me().id || null,
      author_name: me().full_name || '',
      order_index: maxOrder + 1
    };
    const { data, error } = await c.from('brainstorm_ideas').insert(row).select('*').single();
    if (error) { toast('Не добавилось: ' + error.message); return; }
    state.ideas.push(data);
    input.value = '';
    input.focus();
    render();
    const inp = document.getElementById('pbBrainInput');
    if (inp) inp.focus();
  }

  async function toggleVote(ideaId) {
    const c = sb();
    if (!c) return;
    if (!canWrite()) { toast('Смотреть могут все, голосовать — участники'); return; }
    const voted = !!state.myVotes[ideaId];
    if (voted) {
      const { error } = await c.from('brainstorm_votes').delete().eq('idea_id', ideaId).eq('user_id', me().id);
      if (error) { toast(error.message); return; }
      state.myVotes[ideaId] = false;
      state.votes[ideaId] = Math.max(0, (state.votes[ideaId] || 1) - 1);
    } else {
      const { error } = await c.from('brainstorm_votes').insert({ idea_id: ideaId, user_id: me().id });
      if (error) { toast(error.message); return; }
      state.myVotes[ideaId] = true;
      state.votes[ideaId] = (state.votes[ideaId] || 0) + 1;
    }
    render();
  }

  async function deleteIdea(id) {
    const idea = state.ideas.find(function (i) { return i.id === id; });
    if (!idea) return;
    if (!confirm('Удалить идею «' + idea.text.slice(0, 60) + '»?')) return;
    const c = sb();
    const { error } = await c.from('brainstorm_ideas').delete().eq('id', id);
    if (error) { toast(error.message); return; }
    state.ideas = state.ideas.filter(function (i) { return i.id !== id; });
    render();
  }

  function setStage(stage) {
    if (!state.session) return;
    if (state.session.stage === stage) return;
    patchSession({ stage: stage });
    state.session.stage = stage;
    render();
  }

  async function acceptIdea(id) {
    const idea = state.ideas.find(function (i) { return i.id === id; });
    if (!idea) return;
    if (idea.status === 'converted') { toast('Идея уже оформлена: ' + (idea.target_title || '')); return; }
    askConvertType(idea);
  }

  async function rejectIdea(id) {
    const idea = state.ideas.find(function (i) { return i.id === id; });
    if (!idea) return;
    await patchIdea(idea, { status: 'rejected' });
    render();
    toast('Убрано в мусор — можно вернуть');
  }

  async function restoreIdea(id) {
    const idea = state.ideas.find(function (i) { return i.id === id; });
    if (!idea) return;
    await patchIdea(idea, { status: 'new' });
    render();
  }

  async function deleteSession() {
    const s = state.session;
    if (!s || !canWrite()) return;
    if (!confirm('Удалить сессию «' + s.title + '» со всеми идеями? Это необратимо.')) return;
    const c = sb();
    const { error } = await c.from('brainstorm_sessions').delete().eq('id', s.id);
    if (error) { toast('Не удалось удалить: ' + error.message); return; }
    state.session = null;
    state.ideas = [];
    state.votes = {};
    state.myVotes = {};
    state.view = 'list';
    await loadSessions();
    render();
    toast('Сессия удалена');
  }

  // ---------- превращение идеи ----------
  function ensureConvertModal() {
    if (document.getElementById('pbConvertModal')) return;
    const wrap = document.createElement('div');
    wrap.className = 'modal-back';
    wrap.id = 'pbConvertModal';
    wrap.innerHTML = [
      '<div class="modal" role="dialog" aria-modal="true">',
      '<div class="modal-head"><h2>Во что превратить идею?</h2><button class="close" type="button" data-brain-cancel>×</button></div>',
      '<p class="sub" id="pbConvertIdea" style="margin:0 0 10px"></p>',
      '<div class="pb-type-grid">',
      '<button type="button" data-brain-type="task">Задача<small>срок, ответственный, направление</small></button>',
      '<button type="button" data-brain-type="goal">Цель<small>критерий успеха, срок (можно без)</small></button>',
      '<button type="button" data-brain-type="project">Проект<small>этап, бюджет, срок</small></button>',
      '<button type="button" data-brain-type="direction">Направление<small>новая сфера работы + иконка</small></button>',
      '</div>',
      '<div class="form-actions"><button class="btn ghost" type="button" data-brain-cancel>Отмена</button></div>',
      '</div>'
    ].join('');
    document.body.appendChild(wrap);
    wrap.addEventListener('click', function (e) {
      if (e.target === wrap || e.target.closest('[data-brain-cancel]')) closeConvertModal();
      const b = e.target.closest('[data-brain-type]');
      if (b) convertIdea(b.getAttribute('data-brain-type'));
    });
  }
  function askConvertType(idea) {
    ensureConvertModal();
    state.pendingConvert = idea;
    document.getElementById('pbConvertIdea').textContent = '«' + idea.text + '»';
    document.getElementById('pbConvertModal').classList.add('open');
  }
  function closeConvertModal() {
    const el = document.getElementById('pbConvertModal');
    if (el) el.classList.remove('open');
  }

  function convertIdea(type) {
    const idea = state.pendingConvert;
    if (!idea) return;
    closeConvertModal();
    state.pendingConvert = null;
    const title = idea.text.slice(0, 140);
    const note = idea.note || '';
    if (type === 'direction') {
      if (typeof window.pbOpenDirectionModal === 'function') {
        window.pbOpenDirectionModal();
        setTimeout(function () {
          const inp = document.getElementById('pbDirectionName');
          if (inp) { inp.value = title; inp.focus(); }
        }, 120);
        watchDirectionConvert(idea, title);
      } else { toast('Создание направления недоступно'); }
      return;
    }
    const modalMap = { task: 'taskModal', goal: 'goalModal', project: 'projectModal' };
    const formMap = { task: 'taskForm', goal: 'goalForm', project: 'projectForm' };
    if (typeof window.openModal !== 'function') { toast('Не удалось открыть карточку'); return; }
    window.openModal(modalMap[type]);
    setTimeout(function () {
      const form = document.getElementById(formMap[type]);
      if (!form) return;
      const titleEl = form.elements.title;
      if (titleEl) titleEl.value = title;
      if (type === 'task' && form.elements.description) form.elements.description.value = note;
      if (type === 'goal' && form.elements.measure) form.elements.measure.value = note;
      if (type === 'project' && form.elements.stage) form.elements.stage.value = '';
      toast('Оформите «' + TYPE_LABELS[type] + '» и сохраните — идея получит этот статус');
    }, 150);
    watchFormConvert(idea, type, formMap[type], title);
  }

  function watchFormConvert(idea, type, formId, title) {
    const handler = function (e) {
      if (!e.target || e.target.id !== formId) return;
      document.removeEventListener('submit', handler, true);
      setTimeout(async function () {
        const s = (typeof window.pbState === 'function') ? window.pbState() : null;
        const list = s ? (s[type === 'task' ? 'tasks' : type === 'goal' ? 'goals' : 'projects'] || []) : [];
        const found = list.find(function (it) { return String(it.title || '').trim() === title.trim(); });
        if (found) {
          await patchIdea(idea, { status: 'converted', target_type: type, target_title: found.title, target_id: found.id || null });
          toast('Идея оформлена: ' + TYPE_LABELS[type] + ' «' + found.title + '»');
          render();
        } else {
          toast('Карточка не сохранена — идея осталась в отборе');
        }
      }, 700);
    };
    document.addEventListener('submit', handler, true);
  }

  function watchDirectionConvert(idea, title) {
    const wrap = document.getElementById('pbDirectionModal');
    if (!wrap) return;
    const handler = function (e) {
      if (!e.target.closest || !e.target.closest('#pbDirectionSave')) return;
      wrap.removeEventListener('click', handler, true);
      setTimeout(async function () {
        const c = sb();
        const { data } = await c.from('directions').select('id, name').eq('name', title).maybeSingle();
        if (data) {
          await patchIdea(idea, { status: 'converted', target_type: 'direction', target_title: data.name, target_id: data.id || null });
          toast('Идея оформлена: направление «' + data.name + '»');
          render();
        } else {
          toast('Направление не сохранилось — идея осталась в отборе');
        }
      }, 700);
    };
    wrap.addEventListener('click', handler, true);
  }

  // ---------- сессии ----------
  function ensureSessionModal() {
    if (document.getElementById('pbSessionModal')) return;
    const wrap = document.createElement('div');
    wrap.className = 'modal-back';
    wrap.id = 'pbSessionModal';
    wrap.innerHTML = [
      '<div class="modal" role="dialog" aria-modal="true" style="max-width:520px">',
      '<div class="modal-head"><h2>Новая сессия штурма</h2><button class="close" type="button" data-sess-cancel>×</button></div>',
      '<div class="form">',
      '<label class="wide">Название<input class="field" id="pbSessTitle" maxlength="120"></label>',
      '<label class="wide">Тема / вопрос (необязательно)<input class="field" id="pbSessTopic" maxlength="160" placeholder="Например: идеи для клипа на новый сингл"></label>',
      '<label class="wide">Шаблон подсказок<select class="field" id="pbSessTemplate">' +
      Object.keys(TEMPLATES).map(function (k) { return '<option value="' + esc(k) + '">' + esc(TEMPLATES[k].label) + '</option>'; }).join('') +
      '</select></label>',
      '</div>',
      '<div class="form-actions"><button class="btn ghost" type="button" data-sess-cancel>Отмена</button><button class="btn red" type="button" id="pbSessCreate">Создать</button></div>',
      '</div>'
    ].join('');
    document.body.appendChild(wrap);
    wrap.addEventListener('click', function (e) {
      if (e.target === wrap || e.target.closest('[data-sess-cancel]')) wrap.classList.remove('open');
    });
    document.getElementById('pbSessCreate').onclick = createSession;
  }

  function openSessionModal() {
    ensureSessionModal();
    document.getElementById('pbSessTitle').value = nextAutoTitle();
    document.getElementById('pbSessTopic').value = '';
    document.getElementById('pbSessTemplate').value = '';
    document.getElementById('pbSessionModal').classList.add('open');
    setTimeout(function () { const t = document.getElementById('pbSessTitle'); if (t) { t.focus(); t.select(); } }, 80);
  }

  async function createSession() {
    const c = sb();
    if (!c) { toast('Нет подключения'); return; }
    const title = (document.getElementById('pbSessTitle').value || '').trim() || nextAutoTitle();
    const topic = (document.getElementById('pbSessTopic').value || '').trim();
    const template = document.getElementById('pbSessTemplate').value || '';
    const btn = document.getElementById('pbSessCreate');
    btn.disabled = true;
    try {
      const { data, error } = await c.from('brainstorm_sessions').insert({
        title: title, topic: topic, template: template, stage: 'storm', status: 'active',
        created_by: me().id || null
      }).select('*').single();
      if (error) { toast('Не создалось: ' + error.message); return; }
      document.getElementById('pbSessionModal').classList.remove('open');
      await loadSessions();
      state.session = data;
      state.ideas = [];
      state.votes = {};
      state.myVotes = {};
      state.view = 'session';
      render();
      toast('Сессия создана');
    } finally { btn.disabled = false; }
  }

  async function exportSession() {
    const s = state.session;
    if (!s) return;
    const lines = ['# ' + s.title, s.topic ? 'Тема: ' + s.topic : '', ''];
    state.ideas.forEach(function (i) {
      const mark = i.status === 'converted' ? ' → ' + (TYPE_LABELS[i.target_type] || '') + ': ' + (i.target_title || '') :
        i.status === 'rejected' ? ' (в мусор)' : i.status === 'accepted' ? ' (принято)' : '';
      lines.push('- ' + i.text + mark);
    });
    const text = lines.join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    a.download = s.title.replace(/[\\/:*?"<>|]+/g, '_') + '.txt';
    document.body.appendChild(a); a.click(); a.remove();
  }

  // «＋ Создать» → карточка «Мозговой штурм»
  function injectCreateChoice() {
    const grid = document.getElementById('createChoices');
    if (!grid || grid.querySelector('[data-create="brainstorm"]')) return;
    const b = document.createElement('button');
    b.className = 'create-choice';
    b.setAttribute('data-create', 'brainstorm');
    b.innerHTML = '<span class="choice-icon">' + (window.pbIcon ? window.pbIcon('brain') : '✦') + '</span><b>Мозговой штурм</b><small>Сессия идей: штурм → отбор → итоги</small>';
    b.onclick = function () {
      if (typeof window.closeCreateHub === 'function') window.closeCreateHub();
      if (typeof window.go === 'function') window.go('brainstorm');
      setTimeout(function () {
        onVisible();
        if (!state.session) openSessionModal();
      }, 260);
    };
    grid.appendChild(b);
  }
  if (typeof window.openCreateHub === 'function') {
    const _openHub = window.openCreateHub;
    window.openCreateHub = function () {
      const res = _openHub.apply(this, arguments);
      try { injectCreateChoice(); } catch (e) { }
      return res;
    };
  }

  // ---------- встраивание и события ----------
  const prevRenderAll = window.renderAll;
  window.renderAll = function () {
    const res = (typeof prevRenderAll === 'function') ? prevRenderAll.apply(this, arguments) : undefined;
    try { if (active()) render(); } catch (e) { console.warn('[brainstorm]', e); }
    return res;
  };

  async function onVisible() {
    if (!active()) return;
    if (!state.loaded) {
      state.loaded = true;
      await loadSessions();
      render();
      return;
    }
    render();
  }

  document.addEventListener('click', function (e) {
    const nav = e.target.closest && e.target.closest('[data-page="brainstorm"]');
    if (nav) setTimeout(function () { onVisible(); }, 80);
  });

  // делегирование действий внутри страницы
  document.addEventListener('click', function (e) {
    if (!active()) return;
    const el = e.target;
    const filterBtn = el.closest && el.closest('[data-brain-filter] button');
    if (filterBtn) { state.filter = filterBtn.getAttribute('data-filter'); render(); return; }
    const sessionCard = el.closest && el.closest('[data-brain-session]');
    if (sessionCard) {
      const id = sessionCard.getAttribute('data-brain-session');
      state.view = 'session';
      state.loading = true;
      render();
      loadSession(id).then(function () { state.loading = false; render(); });
      return;
    }
    const stageBtn = el.closest && el.closest('[data-brain-stage] button');
    if (stageBtn) { setStage(stageBtn.getAttribute('data-stage')); return; }
    const vote = el.closest && el.closest('[data-brain-vote]');
    if (vote) { toggleVote(vote.getAttribute('data-brain-vote')); return; }
    const del = el.closest && el.closest('[data-brain-del]');
    if (del) { deleteIdea(del.getAttribute('data-brain-del')); return; }
    const accept = el.closest && el.closest('[data-brain-accept]');
    if (accept) { acceptIdea(accept.getAttribute('data-brain-accept')); return; }
    const reject = el.closest && el.closest('[data-brain-reject]');
    if (reject) { rejectIdea(reject.getAttribute('data-brain-reject')); return; }
    const restore = el.closest && el.closest('[data-brain-restore]');
    if (restore) { restoreIdea(restore.getAttribute('data-brain-restore')); return; }
    const act = el.closest && el.closest('[data-brain-action]');
    if (act) {
      const a = act.getAttribute('data-brain-action');
      if (a === 'new') openSessionModal();
      else if (a === 'back') { state.view = 'list'; state.session = null; loadSessions().then(render); }
      else if (a === 'add') addIdea();
      else if (a === 'export') exportSession();
      else if (a === 'archive') { patchSession({ status: 'archived', archived_at: new Date().toISOString() }).then(function () { toast('Сессия в архиве'); render(); }); }
      else if (a === 'restore-session') { patchSession({ status: 'active' }).then(function () { toast('Сессия возвращена'); render(); }); }
      else if (a === 'delete-session') { deleteSession(); }
      return;
    }
  });

  // Enter в поле идеи — добавить
  document.addEventListener('keydown', function (e) {
    if (!active()) return;
    const input = e.target;
    if (input && input.id === 'pbBrainInput') {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addIdea(); }
    }
    if (input && input.id === 'pbBrainTitle' && e.key === 'Enter') { e.preventDefault(); input.blur(); }
  });

  // сохранение правок текста/заметок/ICE и перетаскивание идей
  document.addEventListener('input', function (e) {
    if (!active()) return;
    const el = e.target;
    const ideaEl = el.closest && el.closest('[data-brain-idea]');
    if (!ideaEl) return;
    const idea = state.ideas.find(function (i) { return i.id === ideaEl.getAttribute('data-brain-idea'); });
    if (!idea) return;
    if (el.matches('[data-idea-text]')) { idea.text = el.value; scheduleSave(function () { patchIdea(idea, { text: idea.text }); }); }
    if (el.matches('[data-idea-note]')) { idea.note = el.value; scheduleSave(function () { patchIdea(idea, { note: idea.note }); }); }
    if (el.matches('[data-ice]')) {
      const key = el.getAttribute('data-ice');
      const v = Math.max(0, Math.min(10, Number(el.value) || 0));
      idea[key] = v;
      const valEl = ideaEl.querySelector('[data-ice-val="' + key + '"]');
      if (valEl) valEl.textContent = v;
      const scoreEl = ideaEl.querySelector('.pb-ice-score');
      if (scoreEl) scoreEl.textContent = 'ICE: ' + iceScore(idea) + '/30';
      scheduleSave(function () { patchIdea(idea, { impact: idea.impact, confidence: idea.confidence, ease: idea.ease }); });
    }
  }, true);

  // Сохранение названия сессии
  document.addEventListener('blur', function (e) {
    const t = e.target;
    if (t && t.id === 'pbBrainTitle' && state.session) {
      const v = (t.textContent || '').trim();
      if (v && v !== state.session.title) { state.session.title = v; patchSession({ title: v }); toast('Название сессии сохранено'); }
    }
  }, true);

  // Перетаскивание идей (порядок)
  let ideaDrag = null;
  document.addEventListener('pointerdown', function (e) {
    if (!active()) return;
    const handle = e.target.closest && e.target.closest('.pb-idea-handle');
    if (!handle) return;
    const item = handle.closest('[data-brain-idea]');
    if (!item) return;
    e.preventDefault();
    ideaDrag = { item: item, list: item.parentNode };
    item.classList.add('dragging');
    try { handle.setPointerCapture(e.pointerId); } catch (_e) { }
  });
  document.addEventListener('pointermove', function (e) {
    if (!ideaDrag) return;
    const list = ideaDrag.list;
    const item = ideaDrag.item;
    const siblings = Array.prototype.filter.call(list.children, function (el) { return el !== item && el.hasAttribute && el.hasAttribute('data-brain-idea'); });
    let target = null;
    for (let k = 0; k < siblings.length; k++) {
      const r = siblings[k].getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) { target = siblings[k]; break; }
    }
    if (target) { if (item.nextElementSibling !== target) list.insertBefore(item, target); }
    else if (list.lastElementChild !== item) list.appendChild(item);
  });
  document.addEventListener('pointerup', function () {
    if (!ideaDrag) return;
    const item = ideaDrag.item;
    item.classList.remove('dragging');
    ideaDrag = null;
    // сохраняем новый порядок
    const list = item.parentNode;
    const order = Array.prototype.map.call(list.querySelectorAll('[data-brain-idea]'), function (el) { return el.getAttribute('data-brain-idea'); });
    order.forEach(function (id, idx) {
      const idea = state.ideas.find(function (i) { return i.id === id; });
      if (idea && Number(idea.order_index) !== idx + 1) patchIdea(idea, { order_index: idx + 1 });
    });
  });

  // кнопка «＋» и старт
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { injectNav(); ensurePage(); onVisible(); });
  } else { injectNav(); ensurePage(); onVisible(); }
})();
