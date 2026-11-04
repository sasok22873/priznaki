/* ===== Слой Supabase: вход, выход, загрузка и сохранение задач ===== */
(function () {
  const URL = window.SUPABASE_URL || '';
  const KEY = window.SUPABASE_ANON_KEY || '';

  let client = null;
  let currentProfile = null;
  const dbMeta = new Map();
  let userLoggedOut = false;

  // --- диагностика: показываем ошибки базы на экране ---
  function dbBanner(msg) {
    let el = document.getElementById('dbBanner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'dbBanner';
      el.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:100000;background:#7a1f26;color:#fff;' +
        'font:12px/1.5 ui-monospace,Consolas,monospace;padding:12px 14px;max-height:45vh;overflow:auto;' +
        'white-space:pre-wrap;border-top:3px solid #ff5d6c';
      document.body.appendChild(el);
    }
    el.textContent = 'ОШИБКА БАЗЫ\n' + msg;
    console.error('[DB]', msg);
  }

  function getTasks() {
    try { return tasks; } catch (e) { return []; }
  }

  const PRIORITY_TO_DB = { 'Низкий': 'low', 'Средний': 'medium', 'Высокий': 'high' };
  const PRIORITY_FROM_DB = { low: 'Низкий', medium: 'Средний', high: 'Высокий' };
  const STATUS_TO_DB = {
    'Новая': 'new', 'Запланирована': 'planned', 'В работе': 'in_progress',
    'На проверке': 'review', 'Завершена': 'done', 'Отменена': 'cancelled'
  };
  const STATUS_FROM_DB = {
    new: 'Новая', planned: 'Запланирована', in_progress: 'В работе',
    review: 'На проверке', done: 'Завершена', cancelled: 'Отменена'
  };

  // ---------- цели и проекты ----------
  function goalToRow(g) {
    return {
      title: g.title || '',
      area: g.area || '',
      measure: g.measure || '',
      due_date: g.date || null,
      budget_planned: Number(g.budgetAmount) > 0 ? Number(g.budgetAmount) : null,
      budget_state: g.budgetState || 'planned',
      pct: Number(g.pct) || 0
    };
  }

  function rowToGoal(r) {
    return {
      id: r.id,
      title: r.title || '',
      area: r.area || '',
      measure: r.measure || '',
      date: r.due_date || '',
      budgetAmount: r.budget_planned || '',
      budgetState: r.budget_state || 'planned',
      pct: Number(r.pct) || 0,
      projects: 0
    };
  }

  function projectToRow(p) {
    return {
      title: p.title || '',
      area: p.area || '',
      goal: p.goal || '',
      stage: p.stage || 'Планирование',
      due_date: p.date || null,
      budget_planned: Number(p.budgetAmount) > 0 ? Number(p.budgetAmount) : null,
      budget_state: p.budgetState || 'planned',
      pct: Number(p.pct) || 0
    };
  }

  function rowToProject(r) {
    return {
      id: r.id,
      title: r.title || '',
      area: r.area || '',
      goal: r.goal || '',
      stage: r.stage || 'Планирование',
      date: r.due_date || '',
      budgetAmount: r.budget_planned || '',
      budgetState: r.budget_state || 'planned',
      pct: Number(r.pct) || 0
    };
  }

  function getGoals()    { try { return goals; }    catch (e) { return []; } }
  function getProjects() { try { return projects; } catch (e) { return []; } }

  async function loadGoalsProjects() {
    const g = await client.from('goals').select('*').order('created_at', { ascending: false });
    if (g.error) {
      dbBanner('ЧТЕНИЕ целей: ' + (g.error.message || '') + '\ncode=' + (g.error.code || '-'));
    } else {
      const arr = getGoals();
      arr.length = 0;
      (g.data || []).forEach(function (r) { arr.push(rowToGoal(r)); });
    }

    const pr = await client.from('projects').select('*').order('created_at', { ascending: false });
    if (pr.error) {
      dbBanner('ЧТЕНИЕ проектов: ' + (pr.error.message || '') + '\ncode=' + (pr.error.code || '-'));
    } else {
      const arr = getProjects();
      arr.length = 0;
      (pr.data || []).forEach(function (r) { arr.push(rowToProject(r)); });
    }

    // у каждой цели — сколько проектов на неё ссылается
    const allProjects = getProjects();
    getGoals().forEach(function (g) {
      g.projects = allProjects.filter(function (p) { return p.goal && p.goal === g.title; }).length;
    });
  }

  async function saveGoalsProjects() {
    if (!currentProfile || !client) return;
    if (['owner', 'member'].indexOf(currentProfile.role) === -1) return;

    // цели
    for (const g of getGoals().slice()) {
      const row = goalToRow(g);
      if (!g.id) {
        const { data, error } = await client.from('goals').insert(row).select().single();
        if (error) {
          dbBanner('ЗАПИСЬ цели отклонена\n' + (error.message || '') + '\ncode=' + (error.code || '-'));
          continue;
        }
        g.id = data.id;
      } else {
        const { error } = await client.from('goals').update(row).eq('id', g.id);
        if (error) dbBanner('ИЗМЕНЕНИЕ цели отклонено\n' + (error.message || ''));
      }
    }

    // проекты
    for (const p of getProjects().slice()) {
      const row = projectToRow(p);
      if (!p.id) {
        const { data, error } = await client.from('projects').insert(row).select().single();
        if (error) {
          dbBanner('ЗАПИСЬ проекта отклонена\n' + (error.message || '') + '\ncode=' + (error.code || '-'));
          continue;
        }
        p.id = data.id;
      } else {
        const { error } = await client.from('projects').update(row).eq('id', p.id);
        if (error) dbBanner('ИЗМЕНЕНИЕ проекта отклонено\n' + (error.message || ''));
      }
    }
  }

  const overlay = document.createElement('div');
  overlay.id = 'authOverlay';
  overlay.innerHTML = [
    '<div class="auth-card">',
    '<div class="auth-brand">ПРИЗНАКИ БЕШЕНСТВА 24</div>',
    '<h2 class="auth-title">Вход в штаб</h2>',
    '<p class="auth-sub">Доступ только для участников группы.</p>',
    '<form id="authForm" class="auth-form">',
    '<label>Почта<input class="field" id="authEmail" type="email" autocomplete="username" required></label>',
    '<label>Пароль<input class="field" id="authPass" type="password" autocomplete="current-password" required></label>',
    '<div class="auth-error" id="authError"></div>',
    '<button class="btn red auth-submit" type="submit" id="authSubmit">Войти</button>',
    '</form>',
    '<p class="auth-foot" id="authFoot">Забыли пароль — попросите владельца группы сбросить его.</p>',
    '</div>'
  ].join('');
  document.body.appendChild(overlay);

  const style = document.createElement('style');
  style.textContent = [
    '#authOverlay{position:fixed;inset:0;z-index:9999;display:none;place-items:center;padding:16px;background:#121216;overflow:auto}',
    '#authOverlay.open{display:grid}',
    '.auth-card{width:min(400px,100%);background:#1b1a20;border:1px solid #3a3745;border-radius:16px;padding:24px 20px;box-shadow:0 20px 60px #000a}',
    '.auth-brand{font:700 11px Arial,sans-serif;letter-spacing:.16em;color:#b39aff;margin-bottom:14px}',
    '.auth-title{font:700 24px/1.15 Arial,sans-serif;color:#f3f0f7;margin:0 0 6px}',
    '.auth-sub{font:14px/1.4 "Segoe UI",Arial,sans-serif;color:#a8a3b3;margin:0 0 18px}',
    '.auth-form{display:grid;gap:12px}',
    '.auth-form label{font:13px "Segoe UI",Arial,sans-serif;color:#c9c4d4;display:grid;gap:6px}',
    '.auth-form .field{min-height:44px;font-size:16px;background:#24222b;border:1px solid #45414f;color:#f3f0f7}',
    '.auth-submit{min-height:46px;font-size:14px}',
    '.auth-error{display:none;font:13px/1.4 "Segoe UI",Arial,sans-serif;color:#ffb3b3;background:#3a2226;border:1px solid #6b3a40;border-radius:9px;padding:9px 11px}',
    '.auth-error.show{display:block}',
    '.auth-foot{font:12px/1.4 "Segoe UI",Arial,sans-serif;color:#8d8898;margin:16px 0 0}',
    '.whoami{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:6px 8px;font:11px "Segoe UI",Arial,sans-serif;color:#a8a3b3}',
    '.whoami b{color:#e4d7ff}',
    '.whoami button{border:0;background:transparent;color:#b39aff;text-decoration:underline;font-size:11px;cursor:pointer;padding:0}'
  ].join('');
  document.head.appendChild(style);

  function showError(msg) {
    const box = document.getElementById('authError');
    if (!box) return;
    box.textContent = msg;
    box.classList.add('show');
  }
  function clearError() {
    const box = document.getElementById('authError');
    if (box) box.classList.remove('show');
  }

  function rowToTask(r) {
    return {
      id: r.id,
      title: r.title || '',
      description: r.description || '',
      result: r.result || '',
      note: r.note || '',
      owner: r.owner_name || '',
      area: r.area || '',
      date: r.due_date || '',
      priority: PRIORITY_FROM_DB[r.priority] || 'Средний',
      status: STATUS_FROM_DB[r.status] || 'Новая',
      budgetAmount: r.budget_planned || '',
      budgetState: Number(r.budget_planned) > 0 ? 'planned' : '',
      attachments: []
    };
  }

  function taskToRow(t) {
    const row = {
      title: t.title || '',
      description: t.description || '',
      result: t.result || '',
      note: t.note || '',
      area: t.area || '',
      owner_name: t.owner || '',
      due_date: t.date || null,
      priority: PRIORITY_TO_DB[t.priority] || 'medium',
      status: STATUS_TO_DB[t.status] || 'new',
      budget_planned: Number(t.budgetAmount) > 0 ? Number(t.budgetAmount) : null
    };
    return row;
  }

  async function loadTasks() {
    const { data, error } = await client.from('tasks').select('*').order('created_at', { ascending: false });
    if (error) {
      console.error('tasks load', error);
      dbBanner('ЧТЕНИЕ задач: ' + (error.message || '') + '\ncode=' + (error.code || '-'));
      window.toast && window.toast('Не удалось загрузить задачи: ' + error.message);
      return;
    }
    const arr = getTasks();
    arr.length = 0;
    dbMeta.clear();
    (data || []).forEach(function (r) {
      arr.push(rowToTask(r));
      dbMeta.set(r.id, JSON.stringify(taskToRow(rowToTask(r))));
    });
  }

  async function saveTasks() {
    if (!currentProfile || !client) return;
    if (['owner', 'member'].indexOf(currentProfile.role) === -1) {
      dbBanner('СОХРАНЕНИЕ ОТКЛЮЧЕНО\nваша роль в профиле: "' + currentProfile.role + '"\n' +
        'разрешены только owner или member.\nИсправьте роль в таблице profiles.');
      window.toast && window.toast('Режим просмотра: изменения не сохраняются');
      return;
    }
    const arr = getTasks();
    for (const t of arr.slice()) {
      const row = taskToRow(t);
      if (!t.id) {
        row.owner_id = currentProfile.id;
        row.created_by = currentProfile.id;
        let { data, error } = await client.from('tasks').insert(row).select().single();
        if (error && /created_by/.test(error.message || '')) {
          const fallback = Object.assign({}, row);
          delete fallback.created_by;
          ({ data, error } = await client.from('tasks').insert(fallback).select().single());
        }
        if (error) {
          console.error('task insert', error);
          dbBanner('ЗАПИСЬ задачи отклонена базой\n' +
            'сообщение: ' + (error.message || '-') + '\n' +
            'код: ' + (error.code || '-') + '\n' +
            'детали: ' + (error.details || '-') + '\n' +
            'подсказка: ' + (error.hint || '-') + '\n\n' +
            'отправляемые поля: ' + Object.keys(row).join(', '));
          window.toast && window.toast('Ошибка сохранения: ' + error.message);
          continue;
        }
        t.id = data.id;
        dbMeta.set(data.id, JSON.stringify(taskToRow(rowToTask(data))));
      } else {
        const snapshot = JSON.stringify(row);
        if (dbMeta.get(t.id) !== snapshot) {
          const { error } = await client.from('tasks').update(row).eq('id', t.id);
          if (error) {
            console.error('task update', error);
            dbBanner('ИЗМЕНЕНИЕ задачи отклонено\n' + (error.message || '') + '\nкод: ' + (error.code || '-'));
            continue;
          }
          dbMeta.set(t.id, snapshot);
        }
      }
    }
  }

  function renderWhoami() {
    const foot = document.querySelector('.side-foot');
    if (!foot || !currentProfile) return;
    let box = document.getElementById('whoamiBox');
    if (!box) {
      box = document.createElement('div');
      box.id = 'whoamiBox';
      box.className = 'whoami';
      foot.parentNode.insertBefore(box, foot);
    }
    const labels = { owner: 'владелец', member: 'участник', viewer: 'только просмотр' };
    const role = labels[currentProfile.role] || currentProfile.role;
    box.innerHTML = '<span>Вы: <b>' + (currentProfile.full_name || 'без имени') + '</b> · ' + role + '</span><button id="logoutBtn">выйти</button>';
    document.getElementById('logoutBtn').onclick = logout;
  }

  async function enterApp() {
    const sess = await client.auth.getSession();
    const user = sess && sess.data && sess.data.session && sess.data.session.user;
    if (!user) { overlay.classList.add('open'); return; }

    const { data: prof, error } = await client
      .from('profiles')
      .select('id, full_name, role')
      .eq('id', user.id)
      .single();

    if (error || !prof) {
      console.error('profile', error);
      overlay.classList.add('open');
      showError('Профиль не найден. Попросите владельца группы проверить ваш доступ.');
      return;
    }

    currentProfile = prof;
    overlay.classList.remove('open');
    renderWhoami();
    await loadTasks();
    await loadGoalsProjects();
    window.renderAll && window.renderAll();
    window.persist = function () { saveTasks(); saveGoalsProjects(); };

  }

  async function logout() {
    userLoggedOut = true;
    if (client) await client.auth.signOut();
    currentProfile = null;
    dbMeta.clear();
    const arr = getTasks();
    if (arr.length) arr.length = 0;
    window.renderAll && window.renderAll();
    overlay.classList.add('open');
    clearError();
  }

  function init() {
    if (!URL || !KEY) {
      overlay.classList.add('open');
      showError('Файл config.js не заполнен. Впишите SUPABASE_URL и SUPABASE_ANON_KEY.');
      document.getElementById('authSubmit').disabled = true;
      return;
    }
    if (!window.supabase || !window.supabase.createClient) {
      overlay.classList.add('open');
      showError('Библиотека Supabase не загрузилась. Проверьте интернет и обновите страницу.');
      return;
    }

    client = window.supabase.createClient(URL, KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storage: window.localStorage }
    });
    window.supabaseClient = client;

    document.getElementById('authForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      clearError();
      const btn = document.getElementById('authSubmit');
      btn.disabled = true;
      btn.textContent = 'Входим…';
      const email = document.getElementById('authEmail').value.trim();
      const pass = document.getElementById('authPass').value;
      const res = await client.auth.signInWithPassword({ email: email, password: pass });
      btn.disabled = false;
      btn.textContent = 'Войти';
      if (res.error) {
        showError(res.error.message === 'Invalid login credentials'
          ? 'Неверная почта или пароль.'
          : 'Не удалось войти: ' + res.error.message);
        return;
      }
      await enterApp();
    });

    client.auth.onAuthStateChange(function (event) {
      if (event === 'SIGNED_OUT') {
        if (!userLoggedOut) dbBanner('СЕССИЯ ЗАВЕРШЕНА без вашего выхода (событие SIGNED_OUT).\nПришлите этот текст администратору.');
        userLoggedOut = false;
        overlay.classList.add('open');
      }
      if (event === 'TOKEN_REFRESHED') console.info('[auth] токен обновлён');
    });

    client.auth.getSession().then(function (r) {
      if (r && r.data && r.data.session) enterApp();
      else overlay.classList.add('open');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
