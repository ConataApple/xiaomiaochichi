-- ============================================================
-- 外卖菜品记录网站 - Supabase 数据库建表 SQL
-- 在 Supabase 控制台 -> SQL Editor -> 新建查询 -> 粘贴本文件全部内容 -> Run
-- ============================================================

-- 1. 餐厅表
CREATE TABLE IF NOT EXISTS restaurants (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        TEXT NOT NULL,
  note        TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 用餐记录表（一次点餐 = 一条 meal）
CREATE TABLE IF NOT EXISTS meals (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  restaurant_id BIGINT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  note          TEXT DEFAULT '',          -- 本次用餐文字备注
  meal_at       TIMESTAMPTZ DEFAULT NOW(),-- 用餐时间
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 菜品表
CREATE TABLE IF NOT EXISTS dishes (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  meal_id     BIGINT NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  attrs       TEXT DEFAULT '',           -- 属性文本，如"微糖 / 少冰"
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 标签表（标签管理界面维护）
CREATE TABLE IF NOT EXISTS tags (
  id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name    TEXT NOT NULL,
  emoji   TEXT DEFAULT '🏷️',
  color   TEXT DEFAULT '#3b82f6',        -- 十六进制颜色
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 用餐-标签 关联（多对多）
CREATE TABLE IF NOT EXISTS meal_tags (
  meal_id BIGINT NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  tag_id  BIGINT NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
  PRIMARY KEY (meal_id, tag_id)
);

-- 6. 菜品-标签 关联（多对多）
CREATE TABLE IF NOT EXISTS dish_tags (
  dish_id BIGINT NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  tag_id  BIGINT NOT NULL REFERENCES tags(id)   ON DELETE CASCADE,
  PRIMARY KEY (dish_id, tag_id)
);

-- 7. 应用设置表（存放编辑口令，个人自用，简单明文比对）
CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- 初始化编辑口令（请改成你自己的！之后也能在界面改）
INSERT INTO app_settings (key, value)
VALUES ('edit_password', '123456')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 行级安全（RLS）
-- 个人自用 + 静态站点无登录，这里开放匿名读写。
-- 如果你介意别人看到数据，可后续改为仅自己 IP 或加更复杂的鉴权。
-- ============================================================
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE meals       ENABLE ROW LEVEL SECURITY;
ALTER TABLE dishes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags        ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_tags   ENABLE ROW LEVEL SECURITY;
ALTER TABLE dish_tags   ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- 允许匿名（anon）对所有表进行增删改查
CREATE POLICY "anon_all_restaurants" ON restaurants FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_meals"       ON meals       FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_dishes"      ON dishes      FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_tags"        ON tags        FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_meal_tags"   ON meal_tags   FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_dish_tags"   ON dish_tags   FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_app_settings" ON app_settings FOR ALL TO anon USING (true) WITH CHECK (true);

-- ============================================================
-- 预置一些常用标签，方便上手（可删）
-- ============================================================
INSERT INTO tags (name, emoji, color) VALUES
  ('好吃',     '😋', '#22c55e'),
  ('一般',     '😐', '#eab308'),
  ('避雷',     '🚫', '#ef4444'),
  ('太咸',     '🧂', '#f97316'),
  ('太甜',     '🍬', '#ec4899'),
  ('份量少',   '📉', '#a855f7'),
  ('性价比高', '💰', '#06b6d4'),
  ('送得快',   '🚀', '#3b82f6')
ON CONFLICT DO NOTHING;
