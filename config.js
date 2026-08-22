// ============================================================
// 配置文件 —— 只需要改这里两行即可
// 在 Supabase 控制台 -> Project Settings -> API 里找到下面两个值
// ============================================================
const SUPABASE_URL = "https://qvhflrryftvxymhirvuy.supabase.co";   // 改成你的 Project URL
const SUPABASE_ANON_KEY = "sb_publishable_PFIBAI2sNZRNW7wf5znUgw_3l_UCcLc";                 // 改成你的 anon public key

// 暴露到全局
window.APP_CONFIG = {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
};
