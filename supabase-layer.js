/* ===== Слой Supabase: вход, выход, загрузка и сохранение задач ===== */
(function () {
  const URL = window.SUPABASE_URL || '';
  const KEY = window.SUPABASE_ANON_KEY || '';

  let client = null;
  let currentProfile = null;
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
    'Запланирована': 'planned', 'В работе': 'in_progress', 'Завершена': 'done',
    'Новая': 'planned', 'На проверке': 'in_progress', 'Отменена': 'done'
  };
  const STATUS_FROM_DB = {
    planned: 'Запланирована', in_progress: 'В работе', done: 'Завершена',
    new: 'Запланирована', review: 'В работе', cancelled: 'Завершена'
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
      pct: Number(g.pct) || 0,
      icon: g.icon || ''
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
      icon: r.icon || '',
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
      pct: Number(p.pct) || 0,
      icon: p.icon || ''
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
      pct: Number(r.pct) || 0,
      icon: r.icon || ''
    };
  }

  function eventToRow(e) {
    return {
      title: e.title || '',
      date: e.date || null,
      time: e.time || '',
      type: e.type || '',
      place: e.place || '',
      task: e.task || ''
    };
  }

  function rowToEvent(r) {
    return {
      id: r.id,
      title: r.title || '',
      date: r.date || '',
      time: r.time || '',
      type: r.type || '',
      place: r.place || '',
      task: r.task || ''
    };
  }

  function moneyToRow(m) {
    return {
      type: m.type || '',
      amount: Number(m.amount) || 0,
      title: m.title || '',
      date: m.date || null,
      category: m.category || '',
      person: m.person || '',
      project: m.project || '',
      state: m.state || '',
      reimburse: m.reimburse || '',
      task: m.task || ''
    };
  }

  function rowToMoney(r) {
    return {
      id: r.id,
      type: r.type || '',
      amount: r.amount || 0,
      title: r.title || '',
      date: r.date || '',
      category: r.category || '',
      person: r.person || '',
      project: r.project || '',
      state: r.state || '',
      reimburse: r.reimburse || '',
      task: r.task || ''
    };
  }

  function memberToRow(m) {
    return { name: m.name || '', login: m.login || '', role: m.role || '', access: m.access || '', state: m.state || '', bio: m.bio || '', avatar_url: m.avatar_url || '' };
  }

  function rowToMember(r) {
    return { id: r.id, name: r.name || '', login: r.login || '', role: r.role || '', access: r.access || '', state: r.state || '', bio: r.bio || '', avatar_url: r.avatar_url || '' };
  }

  function getMembers() { try { return members; } catch (e) { return []; } }

  function getEvents() { try { return events; } catch (e) { return []; } }
  function getMoney()  { try { return money; }  catch (e) { return []; } }

  function getGoals()    { try { return goals; }    catch (e) { return []; } }
  function getProjects() { try { return projects; } catch (e) { return []; } }

  const teamProfiles = [];
  window.teamProfiles = teamProfiles;

  async function loadTeamProfiles() {
    const { data, error } = await client.from('profiles').select('id, full_name, role, bio, avatar_url, email, access_status').order('full_name', { ascending: true });
    if (error) {
      dbBanner('ЧТЕНИЕ участников: ' + (error.message || '') + '\ncode=' + (error.code || '-'));
      return;
    }
    teamProfiles.length = 0;
    (data || []).forEach(function (p) { teamProfiles.push({ id: p.id, full_name: p.full_name || '', role: p.role || '', bio: p.bio || '', avatar_url: p.avatar_url || '', email: p.email || '', access_status: p.access_status || 'active' }); });
  }
  window.refreshTeamProfiles = async function () { await loadTeamProfiles(); window.renderAll && window.renderAll(); return teamProfiles; };

  function profileIdByName(name) {
    const p = teamProfiles.find(function (x) { return x.full_name === name; });
    return p ? p.id : null;
  }

  function profileNameById(id) {
    const p = teamProfiles.find(function (x) { return x.id === id; });
    return p ? p.full_name : '';
  }

  async function addMemberDirect(m) {
    if (!client || !currentProfile) { dbBanner('Нет подключения к базе: участник не сохранён'); return false; }
    if (['owner', 'member'].indexOf(currentProfile.role) === -1) {
      dbBanner('Ваша роль: ' + (currentProfile.role || 'не задана') + '. Добавлять участников может владелец или участник');
      return false;
    }
    const { data, error } = await client.from('members').insert(memberToRow(m)).select().single();
    if (error) {
      dbBanner('ДОБАВЛЕНИЕ участника отклонено\n' + (error.message || '') + '\ncode=' + (error.code || '-'));
      return false;
    }
    m.id = data.id;
    members.push(m);
    snaps.members.set(data.id, JSON.stringify(memberToRow(m)));
    return true;
  }
  window.addMemberDirect = addMemberDirect;

  window.updateOwnProfile = async function (patch) {
    if (!client || !currentProfile) return { error: { message: 'Нет активной сессии' } };
    const { data, error } = await client.rpc('update_own_profile', {
      new_full_name: patch.full_name || currentProfile.full_name || '',
      new_bio: patch.bio || '',
      new_avatar_url: patch.avatar_url || ''
    });
    if (!error) {
      currentProfile = Object.assign({}, currentProfile, { full_name: patch.full_name || currentProfile.full_name, bio: patch.bio || '', avatar_url: patch.avatar_url || '' });
      window.__CURRENT_PROFILE__ = currentProfile;
      const listed = teamProfiles.find(function (p) { return p.id === currentProfile.id; });
      if (listed) Object.assign(listed, { full_name: currentProfile.full_name, bio: currentProfile.bio, avatar_url: currentProfile.avatar_url });
      renderWhoami();
    }
    return { data: currentProfile, error: error };
  };
  window.setTeamProfileRole = async function (profileId, role) {
    if (!client || !currentProfile) return { error: { message: 'Нет активной сессии' } };
    return await client.rpc('admin_set_profile_role', { target_profile_id: profileId, new_role: role });
  };
  window.setTeamProfileAccess = async function (profileId, accessStatus) {
    if (!client || !currentProfile) return { error: { message: 'Нет активной сессии' } };
    return await client.rpc('admin_set_profile_access', { target_profile_id: profileId, new_access_status: accessStatus });
  };
  // Полное удаление аккаунта участника. Разрешено только владельцу; проверки
  // (не себя, не owner) выполняются на сервере в admin_delete_profile.
  window.deleteTeamProfile = async function (profileId) {
    if (!client || !currentProfile) return { error: { message: 'Нет активной сессии' } };
    return await client.rpc('admin_delete_profile', { target_profile_id: profileId });
  };
  window.updateTeamProfile = async function (profileId, patch) {
    if (!client || !currentProfile) return { error: { message: 'Нет активной сессии' } };
    const args = { target_profile_id: profileId, new_full_name: patch.full_name || '', new_bio: patch.bio || '', new_avatar_url: patch.avatar_url || '' };
    const own = profileId === currentProfile.id;
    const { error } = await client.rpc(own ? 'update_own_profile' : 'admin_update_profile', own ? {
      new_full_name: patch.full_name || currentProfile.full_name || '', new_bio: patch.bio || '', new_avatar_url: patch.avatar_url || ''
    } : args);
    if (error) return { error: error };
    const listed = teamProfiles.find(function (p) { return p.id === profileId; });
    if (listed) Object.assign(listed, { full_name: patch.full_name || listed.full_name, bio: patch.bio || '', avatar_url: patch.avatar_url || '' });
    if (own) { currentProfile = Object.assign({}, currentProfile, { full_name: patch.full_name || currentProfile.full_name, bio: patch.bio || '', avatar_url: patch.avatar_url || '' }); window.__CURRENT_PROFILE__ = currentProfile; renderWhoami(); }
    return { data: listed || currentProfile, error: null };
  };

  const TABLES = [
    { table: 'tasks', get: getTasks, toRow: taskToRow, fromRow: rowToTask, order: 'created_at', desc: true,
      extra: function () { return { created_by: currentProfile.id }; } },
    { table: 'goals', get: getGoals, toRow: goalToRow, fromRow: rowToGoal, order: 'created_at', desc: true },
    { table: 'projects', get: getProjects, toRow: projectToRow, fromRow: rowToProject, order: 'created_at', desc: true },
    { table: 'events', get: getEvents, toRow: eventToRow, fromRow: rowToEvent, order: 'date', desc: false },
    { table: 'money', get: getMoney, toRow: moneyToRow, fromRow: rowToMoney, order: 'date', desc: true },
    { table: 'members', get: getMembers, toRow: memberToRow, fromRow: rowToMember, order: 'created_at', desc: true }
  ];
  const snaps = {};
  TABLES.forEach(function (c) { snaps[c.table] = new Map(); });
  let saveQueue = Promise.resolve();

  async function loadTable(c) {
    const { data, error } = await client.from(c.table).select('*').order(c.order, { ascending: !c.desc });
    if (error) {
      dbBanner('ЧТЕНИЕ ' + c.table + ': ' + (error.message || '') + '\ncode=' + (error.code || '-'));
      return;
    }
    const arr = c.get();
    const snap = snaps[c.table];
    arr.length = 0;
    snap.clear();
    (data || []).forEach(function (r) {
      const item = c.fromRow(r);
      arr.push(item);
      snap.set(r.id, JSON.stringify(c.toRow(item)));
    });
  }

  async function loadAll() {
    await loadDirections();
    await loadTeamProfiles();
    for (const c of TABLES) await loadTable(c);
    getGoals().forEach(function (g) {
      g.projects = getProjects().filter(function (p) { return p.goal && p.goal === g.title; }).length;
    });
  }

  async function saveTable(c) {
    const arr = c.get();
    const snap = snaps[c.table];
    const liveIds = new Set(arr.map(function (x) { return x.id; }).filter(Boolean));

    for (const id of Array.from(snap.keys())) {
      if (liveIds.has(id)) continue;
      const { error } = await client.from(c.table).delete().eq('id', id);
      if (error) {
        dbBanner('УДАЛЕНИЕ ' + c.table + ' отклонено\n' + (error.message || '') + '\ncode=' + (error.code || '-'));
        continue;
      }
      snap.delete(id);
    }

    for (const item of arr.slice()) {
      const row = c.toRow(item);
      if (!item.id) {
        if (c.extra) Object.assign(row, c.extra());
        const { data, error } = await client.from(c.table).insert(row).select().single();
        if (error) {
          dbBanner('ЗАПИСЬ ' + c.table + ' отклонена\n' + (error.message || '') + '\ncode=' + (error.code || '-'));
          continue;
        }
        item.id = data.id;
        snap.set(data.id, JSON.stringify(c.toRow(item)));
      } else {
        const json = JSON.stringify(row);
        if (snap.get(item.id) === json) continue;
        const { error } = await client.from(c.table).update(row).eq('id', item.id);
        if (error) {
          dbBanner('ИЗМЕНЕНИЕ ' + c.table + ' отклонено\n' + (error.message || '') + '\ncode=' + (error.code || '-'));
          continue;
        }
        snap.set(item.id, json);
      }
    }
  }

  const dirSnap = new Map();
  const areaIcons = {};
  window.areaIcons = areaIcons;

  function dirIcon(name) { return areaIcons[name] || ''; }

  async function writeDirection(name, icon) {
    const existing = dirSnap.get(name);
    const value = icon || '';
    if (existing) {
      if ((existing.icon || '') !== value) {
        const { error } = await client.from('directions').update({ icon: value }).eq('id', existing.id);
        if (error) return { error: error };
        existing.icon = value;
      }
      areaIcons[name] = value;
      return { data: existing };
    }
    const { data, error } = await client.from('directions').insert({ name: name, icon: value }).select().single();
    if (error) return { error: error };
    dirSnap.set(name, { id: data.id, icon: value });
    areaIcons[name] = value;
    return { data: data };
  }

  // Создание направления из карточки (владелец). Обновляет локальное состояние.
  window.saveDirection = async function (name, icon) {
    if (!client || !currentProfile) return { error: { message: 'Нет активной сессии' } };
    const clean = String(name || '').trim();
    if (!clean) return { error: { message: 'Введите название направления' } };
    const res = await writeDirection(clean, String(icon || '').trim());
    if (res.error) return { error: res.error };
    if (areas.indexOf(clean) === -1) areas.push(clean);
    return { data: { name: clean, icon: String(icon || '').trim() } };
  };

  async function loadDirections() {
    const { data, error } = await client.from('directions').select('*').order('created_at', { ascending: true });
    if (error) {
      dbBanner('ЧТЕНИЕ направлений: ' + (error.message || '') + '\ncode=' + (error.code || '-'));
      return;
    }
    dirSnap.clear();
    Object.keys(areaIcons).forEach(function (k) { delete areaIcons[k]; });
    if (!data || !data.length) {
      for (const name of areas.slice()) {
        const res = await writeDirection(name, areaIcons[name] || '');
        if (res.error) { dbBanner('ЗАПИСЬ направления отклонена\n' + (res.error.message || '') + '\ncode=' + (res.error.code || '-')); }
      }
      return;
    }
    areas.length = 0;
    data.forEach(function (r) {
      areas.push(r.name);
      dirSnap.set(r.name, { id: r.id, icon: r.icon || '' });
      if (r.icon) areaIcons[r.name] = r.icon;
    });
  }

  async function saveDirections() {
    const names = new Set(areas);
    for (const entry of Array.from(dirSnap.entries())) {
      const name = entry[0], row = entry[1];
      if (names.has(name)) continue;
      const { error } = await client.from('directions').delete().eq('id', row.id);
      if (error) { dbBanner('УДАЛЕНИЕ направления отклонено\n' + (error.message || '')); continue; }
      dirSnap.delete(name);
      delete areaIcons[name];
    }
    for (const name of areas.slice()) {
      const res = await writeDirection(name, dirIcon(name));
      if (res.error) { dbBanner('ЗАПИСЬ направления отклонена\n' + (res.error.message || '') + '\ncode=' + (res.error.code || '-')); }
    }
  }

  function saveAll() {
    if (!currentProfile || !client) return saveQueue;
    if (['owner', 'member'].indexOf(currentProfile.role) === -1) {
      window.toast && window.toast('Режим просмотра: изменения не сохраняются');
      return saveQueue;
    }
    saveQueue = saveQueue.then(async function () {
      for (const c of TABLES) await saveTable(c);
      await saveDirections();
    }).catch(function (err) {
      dbBanner('СОХРАНЕНИЕ: ' + ((err && err.message) || err));
    });
    return saveQueue;
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
    '<form id="pendingPasswordForm" class="auth-form" hidden><p class="auth-sub">Приглашение подтверждено. Задайте пароль, затем дождитесь, пока владелец одобрит доступ.</p><label>Новый пароль<input class="field" id="pendingPassword" type="password" minlength=8 autocomplete="new-password" required></label><div class="auth-error" id="pendingPasswordError"></div><button class="btn red auth-submit" type="submit" id="pendingPasswordSubmit">Задать пароль</button></form>',
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
    '.whoami button{border:0;background:transparent;color:#b39aff;text-decoration:underline;font-size:11px;cursor:pointer;padding:0}',
    '#whoamiBox{display:flex;flex-direction:row;align-items:center;justify-content:space-between;gap:8px;flex-wrap:nowrap}',
    '#whoamiBox span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '#whoamiBox button{align-self:center;flex:0 0 auto;margin:0;padding:0;white-space:nowrap}'
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
      owner: r.owner_name || profileNameById(r.owner_id),
      area: r.area || '',
      project: r.project || '',
      goal: r.goal || '',
      date: r.due_date || '',
      priority: PRIORITY_FROM_DB[r.priority] || 'Средний',
      status: STATUS_FROM_DB[r.status] || 'Новая',
      budgetAmount: r.budget_planned || '',
      budgetState: Number(r.budget_planned) > 0 ? 'planned' : '',
      icon: r.icon || '',
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
      project: t.project || '',
      goal: t.goal || '',
      owner_name: t.owner || '',
      owner_id: profileIdByName(t.owner),
      due_date: t.date || null,
      priority: PRIORITY_TO_DB[t.priority] || 'medium',
      status: STATUS_TO_DB[t.status] || 'new',
      budget_planned: Number(t.budgetAmount) > 0 ? Number(t.budgetAmount) : null,
      icon: t.icon || ''
    };
    return row;
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
    const name = currentProfile.full_name || 'без имени';
    const showRole = String(name).toLowerCase() !== String(role).toLowerCase();
    box.innerHTML = '<span>Вы: <b>' + name + '</b>' + (showRole ? ' · ' + role : '') + '</span><button id="logoutBtn">выйти</button>';
    document.getElementById('logoutBtn').onclick = logout;
  }

  let entering = false;

  function profileErrorText(error) {
    const code = error && error.code;
    if (code === 'PGRST116') return 'Профиль не найден. Попросите владельца группы проверить ваш доступ.';
    if (code === '42501') return 'База отклонила чтение профиля (нет прав). Войдите заново или обратитесь к владельцу.';
    if (code === '42703') return 'В базе нет нужных колонок: не применена SQL-миграция. Обратитесь к администратору.';
    const msg = (error && (error.message || error.error_description)) || 'неизвестная ошибка';
    return 'Не удалось загрузить профиль: ' + msg;
  }

  function storedSessionExists() {
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.indexOf('-auth-token') !== -1) return true;
      }
    } catch (e) {}
    return false;
  }

  async function enterApp() {
    if (entering) return;
    entering = true;
    try {
      const sess = await client.auth.getSession();
      const user = sess && sess.data && sess.data.session && sess.data.session.user;
      if (!user) { bootGateEnd(); document.body.classList.add('pb-locked'); overlay.classList.add('open'); return; }

      const { data: prof, error } = await client
        .from('profiles')
        .select('id, full_name, role, bio, avatar_url, email, access_status')
        .eq('id', user.id)
        .single();

      if (error || !prof) {
        console.error('[auth] profile', error);
        bootGateEnd(); document.body.classList.add('pb-locked'); overlay.classList.add('open');
        showError(profileErrorText(error));
        return;
      }

      const status = String(prof.access_status || 'active');
      if (status !== 'active') {
        bootGateEnd(); document.body.classList.add('pb-locked'); overlay.classList.add('open');
        if (status === 'invited') {
          document.getElementById('authForm').hidden = true;
          document.getElementById('authFoot').hidden = true;
          document.getElementById('pendingPasswordForm').hidden = false;
          return;
        }
        userLoggedOut = true;
        try { await client.auth.signOut(); } catch (e) {}
        userLoggedOut = false;
        showError('Доступ отозван владельцем. Обратитесь к владельцу.');
        return;
      }

      currentProfile = prof;
      window.__CURRENT_PROFILE__ = prof;
      bootGateEnd();
      document.body.classList.remove('pb-locked');
      overlay.classList.remove('open');
      clearError();
      renderWhoami();
      await loadAll();
      window.renderAll && window.renderAll();
      window.persist = saveAll;
    } catch (e) {
      console.error('[auth] enterApp', e);
      bootGateEnd(); document.body.classList.add('pb-locked'); overlay.classList.add('open');
      showError('Не удалось загрузить приложение: ' + ((e && e.message) || e));
    } finally {
      entering = false;
    }
  }

  async function logout() {
    userLoggedOut = true;
    try { if (client) await client.auth.signOut(); } catch (e) { console.error('[auth] signOut', e); }
    currentProfile = null;
    window.__CURRENT_PROFILE__ = null;
    TABLES.forEach(function (c) { snaps[c.table].clear(); });
    [getTasks, getGoals, getProjects, getEvents, getMoney, getMembers].forEach(function (getter) {
      try { const arr = getter(); if (arr && arr.length) arr.length = 0; } catch (e) {}
    });
    teamProfiles.length = 0;
    const box = document.getElementById('whoamiBox');
    if (box && box.parentNode) box.parentNode.removeChild(box);
    window.renderAll && window.renderAll();
    bootGateEnd(); document.body.classList.add('pb-locked'); overlay.classList.add('open');
    clearError();
  }

  // Пока не выяснили, кто вошёл, интерфейс скрыт (экран загрузки из index.html).
  function bootGateEnd() {
    try {
      document.documentElement.classList.remove('pb-booting');
      document.body.classList.remove('pb-booting');
      var el = document.getElementById('pbBootScreen');
      if (el) el.style.display = 'none';
    } catch (e) { }
  }

  function init() {
    if (!URL || !KEY) {
      bootGateEnd(); document.body.classList.add('pb-locked'); overlay.classList.add('open');
      showError('Файл config.js не заполнен. Впишите SUPABASE_URL и SUPABASE_ANON_KEY.');
      document.getElementById('authSubmit').disabled = true;
      return;
    }
    if (!window.supabase || !window.supabase.createClient) {
      bootGateEnd(); document.body.classList.add('pb-locked'); overlay.classList.add('open');
      showError('Библиотека Supabase не загрузилась. Проверьте интернет и обновите страницу.');
      return;
    }

    // ВАЖНО: после входа по ссылке из письма Supabase кладёт токены в #hash адреса.
    // Если их не убрать, владелец копирует адресную строку и сливает сессию. Поэтому
    // забираем токены себе и сразу вычищаем адрес — в строке остаётся чистый адрес сайта.
    let bootSession = null;
    try {
      const rawHash = window.location.hash || '';
      if (/access_token=/.test(rawHash) && /refresh_token=/.test(rawHash)) {
        const params = new URLSearchParams(rawHash.replace(/^#/, ''));
        const at = params.get('access_token');
        const rt = params.get('refresh_token');
        if (at && rt) {
          bootSession = { access_token: at, refresh_token: rt };
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
      }
    } catch (e) { console.warn('[auth] hash parse', e); }
    window.addEventListener('hashchange', function () {
      try {
        if (/access_token=|refresh_token=/.test(window.location.hash || '')) {
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
      } catch (e) { }
    });

    client = window.supabase.createClient(URL, KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: !bootSession, storage: window.localStorage }
    });
    window.supabaseClient = client;
    if (bootSession) {
      // уже вытащили токены из адреса — применяем вручную
      client.auth.setSession(bootSession).then(function () { restoreSession(0); }).catch(function (err) {
        console.error('[auth] setSession from URL', err);
        restoreSession(0);
      });
    }

    document.getElementById('authForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      clearError();
      const btn = document.getElementById('authSubmit');
      const email = document.getElementById('authEmail').value.trim();
      const pass = document.getElementById('authPass').value;
      btn.disabled = true;
      btn.textContent = 'Входим…';
      try {
        const res = await client.auth.signInWithPassword({ email: email, password: pass });
        if (res && res.error) {
          const m = res.error.message || '';
          showError(m === 'Invalid login credentials' ? 'Неверная почта или пароль.'
            : m === 'Email not confirmed' ? 'Почта не подтверждена. Обратитесь к владельцу группы.'
            : 'Не удалось войти: ' + m);
          return;
        }
        await enterApp();
      } catch (err) {
        console.error('[auth] signIn', err);
        showError('Сеть недоступна или сервер не ответил. Проверьте интернет и попробуйте снова.');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Войти';
      }
    });

    document.getElementById('pendingPasswordForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      const btn = document.getElementById('pendingPasswordSubmit');
      const errBox = document.getElementById('pendingPasswordError');
      const password = document.getElementById('pendingPassword').value;
      if (password.length < 8) { errBox.textContent = 'Пароль должен содержать не менее 8 символов.'; return; }
      btn.disabled = true;
      errBox.textContent = '';
      try {
        const result = await client.auth.updateUser({ password: password });
        if (result && result.error) { errBox.textContent = 'Не удалось задать пароль: ' + result.error.message; return; }
      } catch (err) {
        errBox.textContent = 'Сеть недоступна: ' + ((err && err.message) || err);
        return;
      } finally {
        btn.disabled = false;
      }
      userLoggedOut = true;
      try { await client.auth.signOut(); } catch (err) {}
      userLoggedOut = false;
      document.getElementById('pendingPasswordForm').hidden = true;
      document.getElementById('authForm').hidden = false;
      document.getElementById('authFoot').hidden = false;
      showError('Пароль задан. Теперь дождитесь одобрения владельца; после одобрения войдите с этим паролем.');
    });

    client.auth.onAuthStateChange(function (event, session) {
      if (event === 'SIGNED_OUT') {
        if (!userLoggedOut) {
          console.warn('[auth] сессия завершена без выхода пользователя');
          showError('Сессия истекла — войдите снова.');
        }
        userLoggedOut = false;
        currentProfile = null;
        window.__CURRENT_PROFILE__ = null;
        bootGateEnd(); document.body.classList.add('pb-locked'); overlay.classList.add('open');
      }
      if (event === 'SIGNED_IN' && !currentProfile && !entering) { enterApp(); }
      if (event === 'TOKEN_REFRESHED') console.info('[auth] токен обновлён');
    });

    // Восстановление сессии при загрузке страницы: пробуем дважды, если в
    // хранилище есть след сессии, — это спасает от разовых сбоев чтения.
    async function restoreSession(attempt) {
      try {
        const r = await client.auth.getSession();
        if (r && r.data && r.data.session) { await enterApp(); return; }
      } catch (err) {
        console.error('[auth] getSession', err);
      }
      if (attempt === 0 && storedSessionExists()) {
        await new Promise(function (res) { setTimeout(res, 400); });
        return restoreSession(1);
      }
      bootGateEnd(); document.body.classList.add('pb-locked'); overlay.classList.add('open');
    }
    if (!bootSession) restoreSession(0);
  }

  // Сессия отозвана или истекла (например, после отзыва токенов на сервере):
  // показываем экран входа, а не непонятную ошибку.
  window.pbAuthExpired = function () {
    try { if (client && client.auth && client.auth.signOut) client.auth.signOut({ scope: 'local' }).catch(function () { }); } catch (e) { }
    try {
      if (overlay) bootGateEnd(); document.body.classList.add('pb-locked'); overlay.classList.add('open');
      if (typeof showError === 'function') showError('Сессия истекла — войдите снова.');
      document.getElementById('authSubmit').disabled = false;
    } catch (e) { console.warn('[auth] pbAuthExpired', e); }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
