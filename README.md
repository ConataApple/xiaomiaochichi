# 🍱 外卖打卡 · 我的点餐避雷本

一个**纯静态**的个人外卖记录网站。记录吃过的外卖菜品、给菜品和用餐打标签、写备注，
下次点餐前翻一翻，就知道这家店哪些好吃、哪些要避雷。

技术栈：**纯 HTML + Tailwind(CDN) + Supabase(数据库) + GitHub(代码) + Netlify(部署) + PWA(手机主屏幕)**
无任何构建步骤，无后端服务器。

---

## ✨ 功能

- 📋 记录餐厅、每次点的菜、每道菜的**属性**（如「微糖 / 少冰」）
- 🏷️ 给**每道菜**加多个评价标签，给**每次用餐**加多个标签
- 📝 给每次用餐写文字备注
- 🔍 进入餐厅即可看到全部用餐记录、所有标签、属性、备注
- 🎨 标签管理：增 / 删 / 改颜色 / 改 emoji
- 💻📱 电脑、手机自适应（响应式蓝色简约界面）
- 🔒 **无需登录即可查看**；只有「添加 / 修改 / 删除」时才要求输入编辑口令
- 📲 iPhone 加到主屏幕，像原生 App（有图标、无浏览器工具栏，可离线看）

---

## 🚀 部署步骤（按顺序来）

### 第 1 步：Supabase 建数据库

1. 登录 https://supabase.com ，新建一个项目（区域随便选）。
2. 左侧菜单 **SQL Editor → New query**，把本项目里的 `supabase-schema.sql` 全文粘贴进去，点 **Run**。
   - 这会创建 7 张表、开放匿名读写、并预置 8 个常用标签和默认口令 `123456`。
3. 拿到 API 信息：**Project Settings → API**
   - `Project URL`（形如 `https://xxxx.supabase.co`）
   - `anon public key`（一长串 `eyJ...`）

> ⚠️ 安全说明：本项目为个人自用，建表 SQL 开放了 anon 匿名读写，方便静态站点直接连库。
> 由于 URL 和 anon key 会随网页下发到浏览器，**别人理论上也能连你的库**。
> 个人记录且只在自己设备上用风险可控；若在意，可在 Supabase 里把 `app_settings` 之外的表改为只读策略，
> 或后续升级为带登录的鉴权方案。

### 第 2 步：填配置

打开 `config.js`，把两行改成你的值：

```js
const SUPABASE_URL = "https://xxxx.supabase.co";
const SUPABASE_ANON_KEY = "eyJ......";
```

### 第 3 步：推到 GitHub

```bash
git init
git add .
git commit -m "外卖打卡 v1"
git branch -M main
git remote add origin https://github.com/你的用户名/你的仓库名.git
git push -u origin main
```

（仓库里需要有这些文件：`index.html` `app.js` `config.js` `manifest.webmanifest` `service-worker.js` `icon-192.png` `icon-512.png`）

### 第 4 步：Netlify 部署

1. 登录 https://app.netlify.com
2. **Add new site → Import an existing project → 选 GitHub**，授权并选中你的仓库。
3. 构建设置：**Build command 留空，Publish directory 填 `.`**（根目录）。
4. 点 **Deploy**。等一两分钟，得到一个 `https://xxxx.netlify.app` 的网址。

### 第 5 步：iPhone 加到主屏幕（像原生 App）

1. 用 iPhone 的 Safari 打开上面的 Netlify 网址。
2. 点底部「分享」按钮 → **添加到主屏幕** → 取名「外卖打卡」→ 添加。
3. 回到桌面点新图标打开：全屏、无浏览器工具栏，就是原生 App 的感觉。
4. 之后在手机上记录、查询都能用，数据实时同步（因为都在 Supabase）。

---

## 🔑 关于口令

- 默认编辑口令是 `123456`（在 `supabase-schema.sql` 里设置）。
- 打开网站默认是**只读**状态（🔒 可查看），随便翻看不用输密码。
- 想添加 / 修改时，点右上角锁或任意「＋」按钮，会弹出输入框，输对才解锁（🔓 可编辑）。
- 改口令：右上角 🏷️ 标签管理 → 最底部「修改编辑口令」。

---

## 🗂️ 文件说明

| 文件 | 作用 |
|------|------|
| `index.html` | 页面结构与样式（Tailwind CDN） |
| `app.js` | 全部交互逻辑（增删改查、标签、口令、PWA） |
| `config.js` | **你只需改这里**：Supabase 地址和 key |
| `supabase-schema.sql` | 数据库建表 SQL，去 Supabase 跑一次 |
| `manifest.webmanifest` | PWA 配置（主屏幕图标、全屏） |
| `service-worker.js` | 离线缓存 |
| `icon-192.png` / `icon-512.png` | emoji 图标（🍱） |

---

## 📝 使用小技巧

- 同一道菜多次点（如珍珠奶茶）但属性不同，就在「属性」里填「微糖/少冰」，这样能对比哪种搭配好吃。
- 标签建议分两类：菜品级（好吃/避雷/太咸）和用餐级（送得快/份量少）。
- 标签颜色、emoji 都能在标签管理里随时改。
