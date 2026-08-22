// ============================================================
// 小喵吃吃 · 点餐避雷本 - 主逻辑
// ============================================================
(function () {
  'use strict';

  const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.APP_CONFIG;
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // ---------- 全局状态 ----------
  const state = {
    unlocked: false,        // 是否已通过编辑口令
    restaurants: [],        // 餐厅列表（含用餐数）
    tags: [],               // 所有标签
    editPassword: null,     // 服务器存的口令
    currentRestaurant: null,// 当前查看的餐厅
    meals: [],              // 当前餐厅的用餐（含菜品与标签）
    editingMealId: null,    // 正在编辑的用餐（null=新增）
    editingRestId: null,    // 正在编辑的餐厅（null=新增）
    mealTagSel: new Set(),  // 添加用餐时选中的用餐标签
    dishDraft: [],          // 添加用餐时的菜品草稿 [{name, attrs, tagIds:Set}]
  };

  // ---------- 工具 ----------
  const $ = (id) => document.getElementById(id);
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.remove('is-hidden');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.add('is-hidden'), 1800);
  }
  function fmtDate(s) {
    const d = new Date(s);
    if (isNaN(d)) return s;
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  // 标签用用户自选的真实颜色做背景，不再映射预设色块（彻底避免落黄）
  function tagChip(tag) {
    const color = tag.color || '#fde047';
    return `<span class="tag" style="background:${color}"><span>${escapeHtml(tag.emoji || '🏷')}</span>${escapeHtml(tag.name)}</span>`;
  }
  function getTag(id) { return state.tags.find((t) => t.id === id); }

  // ---------- 口令 ----------
  async function loadPassword() {
    const { data } = await sb.from('app_settings').select('value').eq('key', 'edit_password').single();
    state.editPassword = data ? data.value : '123456';
  }
  function requireUnlock(action) {
    if (state.unlocked) { action(); return; }
    openPasswordModal(action);
  }
  function updateLockUI() {
    $('lockIcon').textContent = state.unlocked ? '🔓' : '🔒';
    $('lockText').textContent = state.unlocked ? '可编辑' : '可查看';
    // 锁定状态变化后，刷新各处编辑入口的可见性
    renderRestaurantList();
    if (state.currentRestaurant) {
      $('btnEditRestaurant').classList.toggle('hidden', !state.unlocked);
      renderMeals();
    }
  }

  // ---------- 数据加载 ----------
  async function loadTags() {
    const { data, error } = await sb.from('tags').select('*').order('created_at');
    if (error) { toast('加载标签失败'); console.error(error); return; }
    state.tags = data || [];
  }
  async function loadRestaurants() {
    const { data, error } = await sb
      .from('restaurants').select('id, name, note, created_at');
    if (error) { toast('加载餐厅失败'); console.error(error); return; }
    // 统计用餐数
    const { data: meals } = await sb.from('meals').select('restaurant_id');
    const counts = {};
    (meals || []).forEach((m) => { counts[m.restaurant_id] = (counts[m.restaurant_id] || 0) + 1; });
    state.restaurants = (data || []).map((r) => ({ ...r, mealCount: counts[r.id] || 0 }))
      .sort((a, b) => b.mealCount - a.mealCount || a.name.localeCompare(b.name));
    renderRestaurantList();
  }
  async function loadMeals(restaurantId) {
    // 用餐 + 菜品 + 标签
    const { data: meals, error } = await sb
      .from('meals').select('*').eq('restaurant_id', restaurantId).order('meal_at', { ascending: false });
    if (error) { toast('加载用餐失败'); console.error(error); return; }

    const mealIds = (meals || []).map((m) => m.id);
    let dishes = [], mealTags = [], dishTags = [];
    if (mealIds.length) {
      const [dRes, mtRes, dtRes] = await Promise.all([
        sb.from('dishes').select('*').in('meal_id', mealIds),
        sb.from('meal_tags').select('*').in('meal_id', mealIds),
        sb.from('dish_tags').select('*').in('dish_id', (await sb.from('dishes').select('id').in('meal_id', mealIds)).data?.map(x => x.id) || []),
      ]);
      dishes = dRes.data || [];
      mealTags = mtRes.data || [];
      dishTags = dtRes.data || [];
    }

    state.meals = (meals || []).map((m) => {
      const dlist = dishes.filter((d) => d.meal_id === m.id);
      const mt = mealTags.filter((x) => x.meal_id === m.id).map((x) => getTag(x.tag_id)).filter(Boolean);
      const dlistWithTags = dlist.map((d) => ({
        ...d,
        tags: dishTags.filter((x) => x.dish_id === d.id).map((x) => getTag(x.tag_id)).filter(Boolean),
      }));
      return { ...m, dishes: dlistWithTags, tags: mt };
    });
  }

  // ---------- 渲染：餐厅列表 ----------
  function renderRestaurantList() {
    const box = $('restaurantList');
    box.innerHTML = '';
    if (!state.restaurants.length) return;
    state.restaurants.forEach((r) => {
      const el = document.createElement('div');
      el.className = 'rest-row';
      const editBtn = state.unlocked
        ? `<button data-editrest="${r.id}" class="rest-edit">✎ 编辑</button>`
        : '';
      el.innerHTML = `
        <button data-open="${r.id}" class="rest-main" style="background:none">
          <div class="rest-name">${escapeHtml(r.name)}</div>
          ${r.note ? `<div class="rest-note">${escapeHtml(r.note)}</div>` : ''}
        </button>
        <div class="rest-count">
          <div>
            <div class="num">${r.mealCount}</div>
            <div class="lbl">次</div>
          </div>
        </div>
        ${editBtn}`;
      el.querySelector('[data-open]').onclick = () => openRestaurant(r);
      const eb = el.querySelector('[data-editrest]');
      if (eb) eb.onclick = (e) => { e.stopPropagation(); requireUnlock(() => openRestaurantModal(r)); };
      box.appendChild(el);
    });
  }

  // ---------- 渲染：餐厅详情 ----------
  async function openRestaurant(r) {
    state.currentRestaurant = r;
    $('detailName').textContent = r.name;
    $('detailMeta').textContent = `${r.mealCount} 次用餐 · ${r.note ? '备注：' + r.note : '暂无备注'}`;
    $('btnEditRestaurant').classList.toggle('hidden', !state.unlocked);
    $('viewList').classList.add('hidden');
    $('viewDetail').classList.remove('hidden');
    $('mealList').innerHTML = '<p class="text-neutral-400 text-sm text-center py-10">加载中…</p>';
    await loadMeals(r.id);
    renderMeals();
  }
  function renderMeals() {
    const box = $('mealList');
    box.innerHTML = '';
    if (!state.meals.length) return;
    state.meals.forEach((m) => {
      const block = document.createElement('div');
      block.className = 'meal-block';
      // 用餐级标签：放在第一行右侧（与日期同行）
      const tagsHtml = m.tags.length ? `<div class="meal-taglist">${m.tags.map(tagChip).join('')}</div>` : '';
      // 用餐备注：放在第二行，小字
      const noteHtml = m.note ? `<div class="meal-note">📝 ${escapeHtml(m.note)}</div>` : '';
      const dishesHtml = m.dishes.map((d) => {
        const dt = d.tags.length ? `<div class="dish-tags">${d.tags.map(tagChip).join('')}</div>` : '';
        const attrLine = d.attrs ? `<div class="dish-attrs">${escapeHtml(d.attrs)}</div>` : '';
        return `<div class="dish-row">
          <div style="min-width:0;flex:1">
            <div class="dish-name">${escapeHtml(d.name)}</div>
            ${attrLine}
          </div>
          ${dt}
        </div>`;
      }).join('');
      const actions = state.unlocked
        ? `<div class="meal-actions">
             <button data-edit="${m.id}" class="link-btn">编辑</button>
             <button data-del="${m.id}" class="link-btn">删除</button>
           </div>`
        : '';
      block.innerHTML = `
        <div class="meal-head">
          <div class="meal-date">${fmtDate(m.meal_at)}</div>
          ${tagsHtml}
        </div>
        ${noteHtml}
        <div class="meal-dishes">${dishesHtml}</div>
        ${actions}`;
      box.appendChild(block);
    });

    // 绑定编辑/删除
    box.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => editMeal(Number(b.dataset.edit)));
    box.querySelectorAll('[data-del]').forEach((b) => b.onclick = () => deleteMeal(Number(b.dataset.del)));
  }

  // ---------- 餐厅 增/改 ----------
  function openRestaurantModal(rest) {
    state.editingRestId = rest ? rest.id : null;
    $('restTitle').textContent = rest ? '编辑餐厅' : '添加餐厅';
    $('inputRestName').value = rest ? rest.name : '';
    $('inputRestNote').value = rest ? (rest.note || '') : '';
    showModal('modalRestaurant');
  }
  async function saveRestaurant() {
    const name = $('inputRestName').value.trim();
    if (!name) { toast('请填写餐厅名称'); return; }
    const note = $('inputRestNote').value.trim();
    let res;
    if (state.editingRestId) {
      res = await sb.from('restaurants').update({ name, note }).eq('id', state.editingRestId);
    } else {
      res = await sb.from('restaurants').insert({ name, note });
    }
    if (res.error) { toast('保存失败'); console.error(res.error); return; }
    hideModal('modalRestaurant');
    toast('已保存');
    await loadRestaurants();
  }

  // ---------- 用餐 增/改 ----------
  function openMealModal(meal) {
    state.editingMealId = meal ? meal.id : null;
    $('inputMealDate').value = meal ? fmtDate(meal.meal_at) : fmtDate(new Date());
    $('inputMealNote').value = meal ? (meal.note || '') : '';
    state.mealTagSel = new Set(meal ? meal.tags.map((t) => t.id) : []);
    state.dishDraft = meal
      ? meal.dishes.map((d) => ({ id: d.id, name: d.name, attrs: d.attrs, tagIds: new Set(d.tags.map((t) => t.id)) }))
      : [];
    renderMealTagPicker();
    renderDishDraft();
    showModal('modalMeal');
  }
  function renderMealTagPicker() {
    const box = $('mealTagPicker');
    box.innerHTML = '';
    state.tags.forEach((t) => {
      const on = state.mealTagSel.has(t.id);
      const b = document.createElement('button');
      b.type = 'button';
      const color = t.color || '#fde047';
      b.className = 'tag-pick' + (on ? ' is-on' : '');
      b.style.background = color;
      b.innerHTML = `<span>${escapeHtml(t.emoji || '🏷')}</span> ${escapeHtml(t.name)}`;
      b.onclick = () => {
        if (state.mealTagSel.has(t.id)) state.mealTagSel.delete(t.id);
        else state.mealTagSel.add(t.id);
        renderMealTagPicker();
      };
      box.appendChild(b);
    });
  }
  function addDishRow() {
    state.dishDraft.push({ name: '', attrs: '', tagIds: new Set() });
    renderDishDraft();
  }
  function renderDishDraft() {
    const box = $('dishContainer');
    box.innerHTML = '';
    state.dishDraft.forEach((d, i) => {
      const row = document.createElement('div');
      row.className = 'card card-sm';
      const tagBtns = state.tags.map((t) => {
        const on = d.tagIds.has(t.id);
        const color = t.color || '#fde047';
        return `<button type="button" data-di="${i}" data-ti="${t.id}"
          class="tag-pick dish-tag ${on ? 'is-on' : ''}"
          style="background:${color}">
          ${escapeHtml(t.emoji || '🏷')}${escapeHtml(t.name)}</button>`;
      }).join('');
      row.innerHTML = `
        <div class="flex gap-2 mb-2">
          <input data-dname="${i}" type="text" placeholder="菜名，如：珍珠奶茶"
            value="${escapeHtml(d.name)}" class="input" style="padding:0.5rem 0.7rem" />
          <button data-delrow="${i}" class="link-btn" style="border-bottom-width:3px">✕</button>
        </div>
        <input data-dattr="${i}" type="text" placeholder="属性，如：微糖 / 少冰"
          value="${escapeHtml(d.attrs)}" class="input" style="padding:0.5rem 0.7rem;margin-bottom:0.6rem" />
        <div class="flex gap-2" style="flex-wrap:wrap">${tagBtns}</div>`;
      box.appendChild(row);
    });
    // 绑定
    box.querySelectorAll('[data-dname]').forEach((el) => el.oninput = (e) => { state.dishDraft[+e.target.dataset.dname].name = e.target.value; });
    box.querySelectorAll('[data-dattr]').forEach((el) => el.oninput = (e) => { state.dishDraft[+e.target.dataset.dattr].attrs = e.target.value; });
    box.querySelectorAll('[data-delrow]').forEach((el) => el.onclick = () => { state.dishDraft.splice(+el.dataset.delrow, 1); renderDishDraft(); });
    box.querySelectorAll('.dish-tag').forEach((el) => el.onclick = () => {
      const di = +el.dataset.di, ti = +el.dataset.ti;
      if (state.dishDraft[di].tagIds.has(ti)) state.dishDraft[di].tagIds.delete(ti);
      else state.dishDraft[di].tagIds.add(ti);
      renderDishDraft();
    });
  }
  async function saveMeal() {
    const date = $('inputMealDate').value || fmtDate(new Date());
    const note = $('inputMealNote').value.trim();
    const dishes = state.dishDraft.filter((d) => d.name.trim());
    if (!dishes.length) { toast('至少要有一道菜'); return; }
    if (!state.currentRestaurant) { toast('出错了：无当前餐厅'); return; }

    let mealId = state.editingMealId;
    // 编辑：先删旧的子数据再重建
    if (state.editingMealId) {
      await sb.from('meal_tags').delete().eq('meal_id', state.editingMealId);
      const { data: oldDishes } = await sb.from('dishes').select('id').eq('meal_id', state.editingMealId);
      const oldDishIds = (oldDishes || []).map((x) => x.id);
      if (oldDishIds.length) await sb.from('dish_tags').delete().in('dish_id', oldDishIds);
      await sb.from('dishes').delete().eq('meal_id', state.editingMealId);
      const { error } = await sb.from('meals').update({ note, meal_at: date }).eq('id', state.editingMealId);
      if (error) { toast('更新失败'); console.error(error); return; }
    } else {
      const { data, error } = await sb.from('meals').insert({ restaurant_id: state.currentRestaurant.id, note, meal_at: date }).select('id');
      if (error) { toast('保存失败'); console.error(error); return; }
      mealId = data[0].id;
    }

    // 插入菜品
    const dishRows = dishes.map((d) => ({ meal_id: mealId, name: d.name.trim(), attrs: d.attrs.trim() }));
    const { data: dishData, error: de } = await sb.from('dishes').insert(dishRows).select('id');
    if (de) { toast('菜品保存失败'); console.error(de); return; }

    // 菜品标签
    const dishTagRows = [];
    dishes.forEach((d, i) => {
      const did = dishData[i].id;
      d.tagIds.forEach((tid) => dishTagRows.push({ dish_id: did, tag_id: tid }));
    });
    if (dishTagRows.length) await sb.from('dish_tags').insert(dishTagRows);

    // 用餐标签
    const mealTagRows = [...state.mealTagSel].map((tid) => ({ meal_id: mealId, tag_id: tid }));
    if (mealTagRows.length) await sb.from('meal_tags').insert(mealTagRows);

    hideModal('modalMeal');
    toast('已保存');
    await loadMeals(state.currentRestaurant.id);
    renderMeals();
    await loadRestaurants();
  }
  async function editMeal(id) {
    const meal = state.meals.find((m) => m.id === id);
    if (meal) openMealModal(meal);
  }
  async function deleteMeal(id) {
    if (!confirm('确定删除这次用餐记录？')) return;
    await sb.from('meal_tags').delete().eq('meal_id', id);
    const { data: ds } = await sb.from('dishes').select('id').eq('meal_id', id);
    const ids = (ds || []).map((x) => x.id);
    if (ids.length) await sb.from('dish_tags').delete().in('dish_id', ids);
    await sb.from('dishes').delete().eq('meal_id', id);
    const { error } = await sb.from('meals').delete().eq('id', id);
    if (error) { toast('删除失败'); console.error(error); return; }
    toast('已删除');
    await loadMeals(state.currentRestaurant.id);
    renderMeals();
    await loadRestaurants();
  }

  // ---------- 标签管理 ----------
  function renderTagList() {
    const box = $('tagList');
    box.innerHTML = '';
    state.tags.forEach((t) => {
      const row = document.createElement('div');
      row.className = 'tag-row';
      row.innerHTML = `
        <input type="color" value="${t.color}" data-color="${t.id}" class="color-input" style="width:2.2rem;height:2.2rem" />
        <input type="text" value="${escapeHtml(t.emoji || '')}" maxlength="2" data-emoji="${t.id}" class="input tag-name-input" style="max-width:3.5rem;padding:0.4rem;text-align:center" />
        <input type="text" value="${escapeHtml(t.name)}" data-name="${t.id}" class="input tag-name-input" />
        <button data-del="${t.id}" class="link-btn">删除</button>`;
      box.appendChild(row);
    });
    box.querySelectorAll('[data-color]').forEach((el) => el.oninput = (e) => updateTag(+e.target.dataset.color, { color: e.target.value }));
    box.querySelectorAll('[data-emoji]').forEach((el) => el.onchange = (e) => updateTag(+e.target.dataset.emoji, { emoji: e.target.value }));
    box.querySelectorAll('[data-name]').forEach((el) => el.onchange = (e) => updateTag(+e.target.dataset.name, { name: e.target.value }));
    box.querySelectorAll('[data-del]').forEach((el) => el.onclick = () => deleteTag(+el.dataset.del));
  }
  async function updateTag(id, patch) {
    const { error } = await sb.from('tags').update(patch).eq('id', id);
    if (error) { toast('更新失败'); console.error(error); return; }
    await loadTags();
    renderTagList();
    if (state.currentRestaurant) { await loadMeals(state.currentRestaurant.id); renderMeals(); }
  }
  async function deleteTag(id) {
    if (!confirm('删除标签？已标记的关联关系也会移除。')) return;
    await sb.from('meal_tags').delete().eq('tag_id', id);
    await sb.from('dish_tags').delete().eq('tag_id', id);
    const { error } = await sb.from('tags').delete().eq('id', id);
    if (error) { toast('删除失败'); console.error(error); return; }
    await loadTags();
    renderTagList();
    if (state.currentRestaurant) { await loadMeals(state.currentRestaurant.id); renderMeals(); }
  }
  async function addTag() {
    const name = $('inputTagName').value.trim();
    if (!name) { toast('请填写标签名'); return; }
    const emoji = $('inputTagEmoji').value.trim() || '🏷️';
    const color = $('inputTagColor').value;
    const { error } = await sb.from('tags').insert({ name, emoji, color });
    if (error) { toast('添加失败'); console.error(error); return; }
    $('inputTagName').value = ''; $('inputTagEmoji').value = '';
    await loadTags();
    renderTagList();
    toast('标签已添加');
  }
  async function changePassword() {
    const pw = $('inputNewPw').value;
    if (!pw) { toast('请输入新口令'); return; }
    const { error } = await sb.from('app_settings').upsert({ key: 'edit_password', value: pw });
    if (error) { toast('更新失败'); console.error(error); return; }
    state.editPassword = pw;
    state.unlocked = true; // 改完即视为已解锁
    updateLockUI();
    $('inputNewPw').value = '';
    toast('口令已更新并已解锁');
  }

  // ---------- 弹窗通用 ----------
  function showModal(id) { $(id).classList.add('is-open'); }
  function hideModal(id) { $(id).classList.remove('is-open'); }

  function openPasswordModal(after) {
    $('pwError').classList.add('hidden');
    $('inputPassword').value = '';
    showModal('modalPassword');
    $('inputPassword').focus();
    $('btnPwOk').onclick = () => {
      if ($('inputPassword').value === state.editPassword) {
        state.unlocked = true; updateLockUI(); hideModal('modalPassword'); toast('已解锁，可以编辑');
        if (after) after();
      } else {
        $('pwError').classList.remove('hidden');
      }
    };
    $('btnPwCancel').onclick = () => hideModal('modalPassword');
    $('inputPassword').onkeydown = (e) => { if (e.key === 'Enter') $('btnPwOk').click(); };
  }

  // ---------- 事件绑定 ----------
  function bind() {
    $('btnTags').onclick = () => { renderTagList(); showModal('modalTags'); };
    $('btnTagClose').onclick = () => hideModal('modalTags');
    $('btnTagAdd').onclick = addTag;
    $('btnPwChange').onclick = changePassword;

    $('btnLock').onclick = () => {
      if (state.unlocked) { state.unlocked = false; updateLockUI(); toast('已锁定为只读'); if (state.currentRestaurant) renderMeals(); }
      else openPasswordModal();
    };

    $('btnAddRestaurant').onclick = () => requireUnlock(() => openRestaurantModal(null));
    $('btnAddMeal').onclick = () => requireUnlock(() => openMealModal(null));
    $('btnEditRestaurant').onclick = () => requireUnlock(() => openRestaurantModal(state.currentRestaurant));
    $('btnRestCancel').onclick = () => hideModal('modalRestaurant');
    $('btnRestSave').onclick = () => requireUnlock(saveRestaurant);
    $('btnMealCancel').onclick = () => hideModal('modalMeal');
    $('btnMealSave').onclick = () => requireUnlock(saveMeal);
    $('btnAddDish').onclick = addDishRow;

    $('btnBack').onclick = () => {
      $('viewDetail').classList.add('hidden');
      $('viewList').classList.remove('hidden');
      state.currentRestaurant = null;
    };
  }

  // ---------- 初始化 ----------
  async function init() {
    bind();
    updateLockUI();
    try {
      await loadPassword();
      await loadTags();
      await loadRestaurants();
    } catch (e) {
      console.error(e);
      toast('初始化失败，请检查 config.js 与网络');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
