/**
 * Bettbox / mihomo 轻量自定义规则覆写脚本
 * 仅添加 XPTV / 媒体相关规则，不影响其他配置
 * 使用方法：在 Bettbox 中单独添加此脚本作为覆写
 */

function main(config) {
  // 自定义规则（按优先级从高到低排列）
  const customRules = [
    // ========== 全球加速 → 默认代理 ==========
    'DOMAIN-SUFFIX,cdn.kin6c1.com,默认代理',
    'DOMAIN-SUFFIX,cdn.iz8qkg.com,默认代理',
    'DOMAIN-SUFFIX,cdn.v82u1l.com,默认代理',
    'DOMAIN-SUFFIX,haiwaikan.com,默认代理',
    'DOMAIN-KEYWORD,olelive,默认代理',
    'DOMAIN-KEYWORD,olevod,默认代理',
    'DOMAIN-KEYWORD,olemovienews,默认代理',
    'DOMAIN,www.olehdtv.com,默认代理',
    'DOMAIN,missav.com,默认代理',
    'DOMAIN-KEYWORD,duboku,默认代理',
    'DOMAIN,pornemby.club,默认代理',
    'DOMAIN,misty.ltd,默认代理',
    'DOMAIN-KEYWORD,test.28.al,默认代理',
    'DOMAIN,embyplus.org,默认代理',
    'DOMAIN-KEYWORD,nebula-media,默认代理',
    'DOMAIN,music.mefun.org,默认代理',
    'DOMAIN-KEYWORD,epg,默认代理',
    'DOMAIN,iptv.yang-1989.xyz,默认代理',
    'DOMAIN,tv.iill.top,默认代理',
    'DOMAIN-KEYWORD,z-lib,默认代理',
    'DOMAIN-KEYWORD,z-library,默认代理',

    // ========== 新加坡节点 ==========
    'DOMAIN,mini.jmsuper.com,新加坡',

    // ========== 美国节点 ==========
    'DOMAIN-SUFFIX,vercel.app,美国',
    'DOMAIN,vercel.buyikun.dpdns.org,美国',
    'DOMAIN,lite.cn2gias.UK,美国',
    'DOMAIN-SUFFIX,plex.tv,美国',
    'DOMAIN-KEYWORD,trakt.tv,美国',
    'DOMAIN-KEYWORD,imdb,美国',
    'DOMAIN-KEYWORD,tmdb,美国',
    'DOMAIN-KEYWORD,stream-link,美国',
    'DOMAIN,aktv.space,美国',
    'DOMAIN,app.koyeb.com,美国',
    'DOMAIN,www.koyeb.com,美国',
    'DOMAIN,constant-fulvia-buyikun-ff01d8b0.koyeb.app,美国',
    'DOMAIN-KEYWORD,69shuba,美国',
    'DOMAIN-KEYWORD,69shux,美国',
    'DOMAIN-KEYWORD,69yuedu,美国',
    'DOMAIN,twkan.com,美国',
    'DOMAIN-KEYWORD,kelee.one,美国',
  ];

  // 把自定义规则插入到原有规则的最前面（优先级最高）
  // 如果你希望优先级低一点，可以改成 push 到后面
  config.rules = [...customRules, ...(config.rules || [])];

  return config;
}
