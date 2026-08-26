# 小喵吃吃 · 项目交接文档（给接手 AI 看）

> 本文档的目标：让一个**完全没接触过这个项目**的 AI（或人），读完就能完全理解这个网站是怎么造的、怎么跑的、怎么改的、有哪些坑。
> 项目主人（用户）不懂技术，所以文档写得非常详细、自洽，不假设你懂任何前置知识。
> 最后更新时间：2026-08-22。

---

## 一、这个项目到底是什么

**一句话**：一个**纯静态的个人外卖打卡网站**。用户用它记录"在哪家店吃了什么、好不好吃、有什么避雷点"，下次点餐前翻一翻，决定要不要吃。

**它解决什么问题**：
- 外卖吃多了记不住——这家店的某道菜上次很难吃、那家出餐慢，靠脑子记不住。
- 所以要做成"点餐避雷本"：每家店一条记录，点进去能看到所有历史用餐、每道菜的评价标签、备注。

**技术本质（非常重要，先建立心智模型）**：
- **没有后端服务器、没有构建步骤、没有框架**。就是一堆静态文件（HTML/CSS/JS），浏览器直接打开就能跑。
- **数据存在云端数据库 Supabase**（PostgreSQL）里，不是存在本地文件。
- 网站通过 Supabase 提供的 JavaScript 库，**在用户浏览器里**直接连数据库读写。
- 因为是静态文件，可以免费部署到 Netlify / GitHub Pages / 任意静态托管。
- 支持 PWA：iPhone Safari "添加到主屏幕" 后像原生 App（全屏、有图标、可离线看已加载内容）。

**用户是谁**：完全不懂技术的个人用户。所有"改配置""部署"的操作都是 AI 帮她做的。

---

## 二、文件清单（每个文件是干什么的）

项目根目录下这些文件，**全部需要一起部署**（少一个都不行）：

| 文件 | 大小(约) | 作用 | 谁改它 |
|------|---------|------|--------|
| `index.html` | 7KB | 页面骨架：顶栏、餐厅列表视图、餐厅详情视图、4 个弹窗（口令/餐厅/用餐/标签管理）、加载 Supabase JS 和本地脚本 | 结构基本固定，偶尔加元素 |
| `app.js` | 22KB / 488 行 | **全部逻辑**：连数据库、增删改查、标签渲染、口令锁、PWA 注册之外的所有行为 | 主要改这里 |
| `styles.css` | 14KB / 397 行 | **全部样式**：新粗野主义视觉风格、响应式、PWA 安全区留白 | 改外观改这里 |
| `config.js` | 0.5KB | **唯一的配置入口**：填 Supabase 的 URL 和 anon key | 部署时填一次 |
| `supabase-schema.sql` | 4KB | **建库 SQL**：7 张表 + RLS 策略 + 预置标签。去 Supabase 控制台跑一次 | 建库时跑一次 |
| `manifest.webmanifest` | 0.7KB | PWA 清单：名称、图标、全屏模式 | 基本不动 |
| `service-worker.js` | 1.7KB | PWA 离线缓存逻辑（network-first） | 改缓存策略时动 |
| `icon-192.png` / `icon-512.png` | — | PWA 主屏幕图标（🍱 emoji 蓝底） | 基本不动 |
| `README.md` | 原部署说明 | 给用户看的部署步骤（注意：里面明文写了默认密码 123456，见安全章节） | — |
| `HANDOFF.md` | 本文档 | 给接手 AI 看的技术交接 | — |

**依赖（不在仓库里，走 CDN）**：
- Supabase JS v2：`https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2`（在 index.html 第 173 行以 `<script>` 引入）
- 没有任何 npm 包、没有 package.json、没有构建工具。

---

## 三、UI 风格：新粗野主义（Neo-Brutalism）

用户明确要求且最终满意的视觉风格是 **Neo-Brutalism（新粗野主义）**，不是普通的极简或可爱风。

**视觉特征（在 styles.css 顶部 `:root` 变量里定义）**：
- **硬边**：所有元素直角，无圆角（除了标签胶囊）。
- **粗黑描边**：`--stroke: 3px solid #000`，次要元素 `--stroke-thin: 2px solid #000`。
- **硬阴影（无模糊）**：`--shadow: 6px 6px 0 #000`（实心黑影，不是柔和投影）。元素 hover/active 时阴影位移变化，做出"按下/浮起"的实体感。
- **糖果饱和色块**：柠檬黄 `--lemon:#fde047`、珊瑚红、薄荷、天空蓝、粉、青柠、薰衣草、橙。
- **顶栏固定柠檬黄底 + 黑描边**。

**字体层级（关键，用户特别在意"有粗有细有大有小"）**：
- 焦点内容（菜名）用 `font-weight: 900` + clamp 大字号，是视觉重点。
- 说明内容（备注、属性）用 `font-weight: 400` + 小字号 + 灰色，是次要层。
- 标签用 `border-radius: 999px` 圆角胶囊 + 粗字，是点缀层。
- 标题字号用 `clamp()` 做响应式缩放（手机小、电脑大）。

**标签（tag）的渲染规则（重要，踩过坑）**：
- 标签有用户自选的**颜色**（存在 `tags.color` 字段，十六进制如 `#61187c`）。
- 当前版本（2026-08-22 最新）**直接用 `style="background:真实颜色"` 渲染**，不再映射预设 class——因为之前用"预设 8 色映射"会导致非预设色全部落回黄色（详见"已知坑"章节）。
- 标签选择器按钮（添加用餐时选标签）同理用真实色做背景。

**布局结构**：
- 顶栏（sticky）：左侧品牌"小喵吃吃 / 点餐避雷本"，右侧"标签"按钮 + 锁状态按钮。
- 列表视图：卡片网格展示所有餐厅，每张卡显示店名、备注、用餐次数。
- 详情视图：店名 + 备注 + "用餐记录"列表。每次用餐是一个白色卡片（meal-block）：
  - 第 1 行：日期 + 用餐标签（右侧）
  - 第 2 行：用餐备注（小字灰）
  - 第 3 行：菜名（大号粗体，焦点）
  - 第 4 行：菜品属性（如"微糖/少冰"，小字灰）+ 菜品标签（右侧胶囊）
- 4 个弹窗（modal）：口令输入、添加/编辑餐厅、添加用餐、标签管理。

---

## 四、数据库：Supabase（PostgreSQL）

### 4.1 怎么连上数据库的（核心原理）

1. `config.js` 里写死两个值：
   ```js
   const SUPABASE_URL = "https://xxxx.supabase.co";
   const SUPABASE_ANON_KEY = "sb_publishable_xxxx";
   window.APP_CONFIG = { SUPABASE_URL, SUPABASE_ANON_KEY };
   ```
2. `index.html` 先加载 Supabase CDN 脚本，再加载 `config.js`，再加载 `app.js`。
3. `app.js` 第 7-8 行：
   ```js
   const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.APP_CONFIG;
   const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
   ```
   创建了一个全局 `sb` 客户端对象，之后所有数据库操作都通过 `sb.from('表名').xxx()` 调用。

**关于 anon key 的安全性（接手者必读）**：
- `anon key` 是**公开设计**的——它会被下发到每个访客的浏览器，相当于"公开用户名"，不保密。
- 真正保密的是 `service_role` key（本项目从未使用，也绝不该出现在前端代码里）。
- 数据库的安全靠 **RLS（行级安全策略）** 控制，见 4.3。

### 4.2 表结构（7 张表）

关系链：**restaurants（餐厅）1—N meals（用餐）1—N dishes（菜品）；tags（标签）通过关联表多对多挂在 meals 和 dishes 上。**

```
restaurants
  id          BIGINT 主键 自增
  name        TEXT   店名（必填）
  note        TEXT   餐厅备注
  created_at  TIMESTAMPTZ

meals（一次点餐 = 一条）
  id            BIGINT 主键
  restaurant_id BIGINT 外键→restaurants（级联删除）
  note          TEXT   本次用餐备注
  meal_at       TIMESTAMPTZ  用餐时间（界面用 date input 选）
  created_at    TIMESTAMPTZ

dishes（菜品）
  id          BIGINT 主键
  meal_id     BIGINT 外键→meals（级联删除）
  name        TEXT   菜名（必填）
  attrs       TEXT   属性文本，如"微糖 / 少冰"
  created_at  TIMESTAMPTZ

tags（标签，标签管理界面维护）
  id      BIGINT 主键
  name    TEXT   标签名
  emoji   TEXT   图标 emoji，默认 🏷️
  color   TEXT   十六进制颜色，如 #3b82f6
  created_at TIMESTAMPTZ

meal_tags（用餐-标签 多对多）
  meal_id BIGINT 外键→meals（级联删除）
  tag_id  BIGINT 外键→tags（级联删除）
  主键 (meal_id, tag_id)

dish_tags（菜品-标签 多对多）
  dish_id BIGINT 外键→dishes（级联删除）
  tag_id  BIGINT 外键→tags（级联删除）
  主键 (dish_id, tag_id)

app_settings（应用设置，目前只存编辑口令）
  key   TEXT 主键（如 'edit_password'）
  value TEXT
```

**预置数据**：建库 SQL 会插入 8 个默认标签（好吃/一般/避雷/太咸/太甜/份量少/性价比高/送得快）和默认口令 `edit_password = '123456'`。

### 4.3 RLS（行级安全）现状——⚠️ 安全薄弱点

`s易`建库 SQL 开启了 RLS，但策略是**对 anon 角色开放所有表的完整增删改查**：
```sql
CREATE POLICY "anon_all_restaurants" ON restaurants FOR ALL TO anon USING (true) WITH CHECK (true);
-- 其余 6 张表同理
```
这意味着：**任何拿到 anon key 的人（也就是任何能打开网站的人，因为 key 在浏览器里）都能读写整个库**。

当前靠"编辑口令"做软限制——但口令只是 `app_settings` 里一条记录，而 `app_settings` 本身也对 anon 开放读写，所以**理论上懂技术的人可以绕过前端直接改口令或删数据**。

**用户已在 2026-08-22 把 GitHub 仓库设为 Private**，降低了代码（含 anon key 和默认密码提示）被公开搜到的风险，但数据库层面仍是开放的。若接手者要加固，正确做法是：用 Supabase 的 RLS 把操作限制为"仅自己"（例如基于一个固定 user id 或 IP），或升级为带登录的鉴权。本文档不强制，仅告知现状。

---

## 五、核心代码逻辑（app.js 导读）

`app.js` 是全局 IIFE（立即执行函数），无模块系统。关键结构：

**全局状态 `state`**（第 11 行起）：
```js
const state = {
  tags: [],            // 所有标签
  restaurants: [],     // 餐厅列表（含 mealCount）
  meals: [],           // 当前餐厅的用餐记录（含嵌套 dishes/tags）
  currentRestaurant,   // 当前打开的餐厅
  unlocked: false,     // 是否已解锁编辑（输对口令）
  editPassword: '123456',
  mealTagSel: new Set(),   // 添加用餐时临时选中的标签 id
  dishDraft: [],          // 添加用餐时临时菜品草稿
  editingRestId, editingMealId,  // 编辑中的对象 id（null=新建）
};
```

**数据加载顺序**（页面初始化，`init()` 类逻辑）：
1. `loadPassword()` → 从 `app_settings` 读 `edit_password`，写入 `state.editPassword`。
2. `loadTags()` → 读全部 `tags`。
3. `loadRestaurants()` → 读餐厅 + 统计每家用餐数。
4. 渲染列表。进详情时 `loadMeals(id)` → 一次性读 meals + dishes + meal_tags + dish_tags（4 个并行查询）。

**口令锁机制**（用户很在意）：
- 默认 `state.unlocked = false`，界面只读（🔒 可查看）。
- 任何"添加/编辑/删除"操作前调用 `requireUnlock(action)`：未解锁则弹出口令弹窗，输对才执行 `action`。
- 顶栏锁按钮显示当前状态，解锁后显示"编辑"按钮等入口。
- 改口令在标签管理弹窗底部，写回 `app_settings`。

**增删改查示例（接手者改逻辑时照抄）**：
```js
// 读
await sb.from('restaurants').select('id, name, note, created_at');
// 插
await sb.from('meals').insert({ restaurant_id, note, meal_at }).select('id');
// 改
await sb.from('restaurants').update({ name, note }).eq('id', id);
// 删（级联：删餐厅会连带删 meals→dishes→关联表）
await sb.from('restaurants').delete().eq('id', id);
```

**编辑已存在记录的处理**（易错点）：保存用餐/餐厅时，靠 `state.editingXxxId` 判断是新建还是更新。更新用餐时，代码会**先删旧的 meal_tags / dish_tags / dishes，再重新插入**（见 `saveMeal()` 第 308-314 行），避免关联残留。

**PWA 注册**：在 `index.html` 底部 `<script>` 里注册 `service-worker.js`（不是 app.js 里）。

---

## 六、部署流程（用户已部署过，接手者如需重部署照做）

前提：已有 Supabase 项目 + GitHub 仓库（Private）+ Netlify 账号。

**第 1 步：建数据库**（只需一次）
- 登录 Supabase → SQL Editor → 新建查询 → 粘贴 `supabase-schema.sql` 全文 → Run。
- 这会建 7 张表、开 RLS、插默认标签和默认口令。

**第 2 步：填配置**
- 打开 `config.js`，把 `SUPABASE_URL` 和 `SUPABASE_ANON_KEY` 换成你项目的值（Supabase → Project Settings → API）。

**第 3 步：推 GitHub**
- 仓库已存在（`ConataApple/xiaomiaochichi`），Private。
- 改完代码后：`git add -A && git commit -m "..." && git push`。
- 注意：推送用 PAT 时 URL 形如 `https://用户名:TOKEN@github.com/...`，TOKEN 别泄露。

**第 4 步：Netlify 部署**
- Netlify → Add new site → Import from GitHub → 选仓库。
- Build command 留空，Publish directory 填 `.`（根目录）。
- Deploy 后得到 `https://xxxx.netlify.app`。

**第 5 步：iPhone 加主屏幕**
- Safari 打开 Netlify 网址 → 分享 → 添加到主屏幕 → 取名。
- 之后全屏无工具栏。改版后若有缓存问题，删图标重加一次（service-worker 缓存版本见 `service-worker.js` 的 `CACHE` 常量，升级时 +1）。

---

## 七、已知坑 / 历史 bug（接手者改之前必读，避免重蹈覆辙）

1. **标签颜色"全变黄"bug（已修，但原理要懂）**
   - 原因：曾用 `tagClassForColor()` 把标签颜色映射到 8 个固定预设 class（`.tag-pink` 等），只有恰好选中那 8 个预设色才上色，否则落回黄色。
   - 用户标签存的是自选十六进制（如 `#61187c`），几乎不可能命中预设，所以全黄。
   - **现方案**：直接用 `style="background:真实颜色"` 渲染（app.js 第 43-46 行 `tagChip`、第 247 行选择器、第 271 行菜品标签）。
   - 教训：用户要"标签用自选色"就老老实实用 inline style，别做预设映射。

2. **PWA 灵动岛遮挡（已修）**
   - 原因：`viewport-fit=cover` + `black-translucent` 状态栏 + 没加安全区留白，顶栏内容被 iPhone 灵动岛挡住。
   - 修复：`.topbar` / `.container` / `.modal-panel` 的 padding 加 `env(safe-area-inset-top/right/bottom/left)`。

3. **iOS 日期框穿模（已修）**
   - 原因：`<input type="date">` 在 iOS 有内建 spinner 控件，最小宽度撑破父容器。
   - 修复：`appearance:none` + `min-width:0` + 父级 `overflow-x:clip`。

4. **空状态提示误显示（已删）**
   - 曾因 service-worker 缓存旧代码 + 时序问题，有餐厅时也显示"点击新建"空提示。用户要求彻底删除两个空状态元素，已删。

5. **餐厅名/备注无法编辑（已修）**
   - 早期没做编辑入口，后加了列表和详情里的编辑按钮，靠 `state.editingRestId` 区分新建/更新。

6. **FAB 悬浮加号按钮（已删）**
   - 用户嫌手机端右下角悬浮"＋"没用，已删除（commit 3c3cce6）。

---

## 八、当前版本状态（2026-08-22）

最新 commit：`ba0438e`「标签改用用户真实颜色渲染，彻底修复落黄问题」
包含的历史改动（均未推错，已全部 push 到 Private 仓库 main 分支）：
- 新粗野主义 UI 定稿
- PWA 灵动岛 + 日期框修复
- 标签真实颜色渲染
- FAB 删除
- 空状态删除

**用户已做的安全动作**：GitHub 仓库设为 Private。
**用户已做**：编辑口令从默认 123456 改为自定义强密码（在网站标签管理里改的，存在数据库）。

**仍存在的薄弱点（接手者若要做安全加固）**：
- Supabase RLS 对 anon 全开放，懂技术者可绕过前端直接操作库。加固需改 `supabase-schema.sql` 的 policy（例如限制为固定身份）。
- `config.js` 的 anon key 随网页公开（这是 Supabase 设计使然，不是泄露，但意味着不能靠它保密）。
- `README.md` 和旧 commit 历史里明文出现过默认密码 `123456` 和 anon key——仓库已 Private 缓解，但若将来转 Public 需先清理。

---

## 九、给接手 AI 的快速上手清单

如果你（接手 AI）要改这个网站，按顺序来：

1. **改外观** → 编辑 `styles.css`（设计变量在 `:root`，标签在「标签」段，弹窗在「弹窗」段）。
2. **改行为/数据逻辑** → 编辑 `app.js`（函数名见第五节，Supabase 调用照抄 `sb.from(...)` 模式）。
3. **改页面结构** → 编辑 `index.html`（弹窗模板在对应 `id="modalXxx"` 段）。
4. **改数据库结构** → 改 `supabase-schema.sql` 并在 Supabase SQL Editor 跑（注意已有数据，ALTER 要谨慎）。
5. **改 Supabase 连接** → 改 `config.js` 两行。
6. **本地预览** → 在根目录起静态服务器：`python3 -m http.server 8765`，浏览器开 `http://localhost:8765/`。
7. **改完部署** → `git add -A && git commit -m "说明" && git push`（PAT 方式见第六节）。
8. **PWA 缓存** → 改了静态资源后，若用户反映没更新，升 `service-worker.js` 里 `CACHE` 版本号（如 v3→v4），并让用户删主屏幕图标重加。

**绝对不要做的事**：
- 不要把 `service_role` key 放进前端代码（`config.js` / `app.js`）。
- 不要把标签颜色改回"预设 class 映射"（会重现全黄 bug）。
- 不要删 `config.js` 里的 `window.APP_CONFIG` 赋值（app.js 第 7 行依赖它）。
- 部署前确认 `.gitignore` 没把关键文件排除（目前只忽略 `.workbuddy`）。

---

## 十、关键外部资源（接手者可能要用）

- Supabase 项目 URL：在 `config.js` 里（用户私有，文档不重复贴，从文件读）。
- Supabase JS v2 文档：https://supabase.com/docs/reference/javascript
- Netlify 部署文档：https://docs.netlify.com
- GitHub 仓库：`ConataApple/xiaomiaochichi`（Private）
- PWA / iOS 安全区：`env(safe-area-inset-*)` 是标准 CSS 环境变量，无需额外库。

---

*文档结束。若项目后续有大改，请同步更新本文档，保持它对"下一个完全不懂的 AI"可读。*
