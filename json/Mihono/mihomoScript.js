/**
mihomo配置覆写脚本（全量版）
作者：AIsouler
源仓库：https://github.com/AIsouler/MyClash
脚本链接：https://raw.githubusercontent.com/AIsouler/MyClash/main/Script/mihomoScript.js
友情推荐，非常好用、省电且内存占用低的代理软件：https://github.com/appshubcc/Bettbox */
// --- 静态配置区域 ---

// 适配 Bettbox 自定义配置参数 const Compatible_With_Bettbox = { ruleOptionsEnable: true };

/**
自定义配置选项
true = 启用
false = 禁用 */
const ruleOptionsEnable = {
  // 基础策略组
  手动选择: true, // 是否启用手动选择策略组
  自动选择: true, // 是否启用自动选择策略组
  负载均衡: true, // 是否启用负载均衡策略组

  // 以下为分流策略配置
  FCM: true, // GoogleFCM服务
  YouTube: true, // YouTube视频平台
  Google: true, // Google服务
  AI: true, // 国外AI服务
  Microsoft: true, // Microsoft服务
  Apple: true, // Apple服务
  Telegram: true, // Telegram通讯软件
  Steam: true, // Steam游戏平台
  TikTok: true, // TikTok视频平台
  Twitter: true, // Twitter社交平台
  Meta: true, // Meta服务
  Line: true, // Line通讯软件
  Netflix: true, // Netflix视频平台
  Emby: true, // Emby媒体服务
  PikPak: true, // PikPak网盘服务
  Spotify: true, // Spotify音乐服务
  Crypto: true, // 加密货币相关服务
  EHentai: true, // E-Hentai网站
  AdBlock: true, // 广告拦截

  // 以下为非分流策略配置
  生成地区自动选择组: true, // 是否生成地区自动选择策略组
  隐藏地区手动选择组: false, // 是否隐藏地区手动选择策略组
  生成倍率组: true, // 是否生成低倍率/高倍率策略组
  分流组添加所有节点: false, // 是否为分流策略组添加所有节点
  过滤低倍率节点: false, // 是否过滤低倍率节点
  过滤高倍率节点: false, // 是否过滤高倍率节点
  过滤非地区节点: true, // 是否过滤非地区节点
  屏蔽国外QUIC: true, // 是否屏蔽国外QUIC流量
  代理IPV4优先: false, // 是否将订阅节点统一为 IPv4 优先（与“代理IPV6优先”同时开启时不生效）
  代理IPV6优先: false, // 是否将订阅节点统一为 IPv6 优先（与“代理IPV4优先”同时开启时不生效）
  链式代理: false, // 是否启用链式代理（自定义节点作为落地节点，经“链式中转”策略组中转）
};

// 定义前置规则
const prefixRules = [
  // 私有网络直连
  'RULE-SET,private,直连',

  // 国内直连
  'RULE-SET,geolocation-cn,直连',
  'RULE-SET,games_cn,直连', // 已包含 steam 下载域名
  'RULE-SET,epicgames,直连',
  'RULE-SET,nvidia_cn,直连',
  'RULE-SET,apple_cn,直连',
  'RULE-SET,microsoft_cn,直连',
  'DOMAIN,fsend.cn,直连',
  'DOMAIN,international-gfe.download.nvidia.com,直连',
];

// --- 自定义规则区（整合 Rule/ 目录下的 Loon 规则） ---
// 规则来源：https://github.com/buyikun/myown/tree/main/Rule
// 汇总时按「先出现的策略优先」去重，可直接在此增删

/**
 是否启用自定义规则
 true = 启用
 false = 禁用 */
const enableCustomRules = true;

// 未标注策略时使用的默认策略
// airport（机场订阅）：需要代理 → 自动选择
// direct（直连域名）：直连
// outdoor（境外流媒体/Plex/Emby）：需要代理 → 自动选择
// unsure（不确定归属）：走 Emby 分组
const customRuleDefaultPolicies = {
  airport: '自动选择',
  direct: '直连',
  outdoor: '自动选择',
  unsure: 'Emby',
};

// 目标策略组未生成时的回退顺序
const customRuleFallbackPolicies = ['自动选择', '默认代理'];

// Loon 策略名 → mihomo 策略组名
const customRulePolicyAlias = {
  全球加速: '自动选择',
  美国节点: '美国',
  新加坡节点: '新加坡',
};

// Loon 内建策略 → mihomo 内建策略
const customRuleBuiltinPolicies = {
  DIRECT: '直连',
  REJECT: 'REJECT',
  'REJECT-DROP': 'REJECT-DROP',
  PASS: 'PASS',
};

// 支持的规则类型
const customRuleTypes = ['DOMAIN', 'DOMAIN-SUFFIX', 'DOMAIN-KEYWORD'];

// Rule/airport：机场订阅与官网域名
const customRuleSourceAirport = `
#宝可梦
DOMAIN-KEYWORD,52pokemon
#glados
DOMAIN,update.glados-config.com
#aca
DOMAIN,api.aca.best
#error
DOMAIN,network-proxy.erroris.best
#锦瑜小窝
DOMAIN-KEYWORD,jinyuxiaowo
#cac
DOMAIN,www.cacapex.com
#free
DOMAIN,proc.xn--l9qyaz082a.cn
#apop
DOMAIN-KEYWORD,apopemby
#公益网络
DOMAIN,gy888.xyz
#高中生
DOMAIN,302verify.com
DOMAIN-KEYWORD,ytools
#ikuuu
DOMAIN,api.sub-100.one
#包含sub
DOMAIN,sub.xn--mes91t7ofgnw.com
#华夏
DOMAIN,wwn.trx1.cyou
DOMAIN,huaxia.tyreo.cn
#oi
DOMAIN-KEYWORD,oiyun
#claw-substore
#DOMAIN,udrlkbsihdtq.ap-northeast-1.clawcloudrun.com
`;

// Rule/direct：直连域名
const customRuleSourceDirect = `
#中兴路由器
DOMAIN,zte.home
#hxd
DOMAIN,cf.bili.rip
DOMAIN,hxd.as174.de
#1111
DOMAIN,cf.xmsl.org
#IrisEmby
DOMAIN-SUFFIX,irisyyds.top
DOMAIN-SUFFIX,iris520.vip
#二楼
DOMAIN-SUFFIX,cmecloud.cn,DIRECT
DOMAIN-SUFFIX,guangyacdn.com,DIRECT
# misty
#emos
DOMAIN,video.emos.best
DOMAIN,clun.top
#月饼
DOMAIN-SUFFIX,emby.my
#通用反代线路
DOMAIN,emby.buyikun.dpdns.org,DIRECT
DOMAIN,auto.liuer.indevs.in,DIRECT
DOMAIN,auto.dolby.dpdns.org,DIRECT
DOMAIN,emby.noomi.eu.cc,DIRECT
DOMAIN,fd.dirige.de5.net,DIRECT
DOMAIN,auto.embys.dpdns.org,DIRECT
DOMAIN,plex.2699699.xyz
DOMAIN,www.jotaro.icu
#反代
DOMAIN,myg.rfc.280454.xyz
#tmdb反代
DOMAIN,tmdb.buyikun.dpdns.org
DOMAIN,img.buyikun.dpdns.org
DOMAIN,tg.buyikun.dpdns.org
#弹幕
DOMAIN,buyikun-danmu-api.ms.show
DOMAIN,logvar.xxrmb.com

#小说
DOMAIN,www.mayitxt.org
DOMAIN-KEYWORD,minguoqiren

#plex
DOMAIN,v4.plex.tv
DOMAIN,plexapp.com
DOMAIN,plex.direct

#yuheng
DOMAIN-KEYWORD,yuheng,DIRECT
DOMAIN-KEYWORD,yqc-premium,DIRECT

#jstv
DOMAIN,wogg.xxooo.cf,DIRECT
DOMAIN,wogg.333232.xyz,DIRECT
DOMAIN,www.wogg.one,DIRECT
DOMAIN,www.wogg.lol,DIRECT
DOMAIN,666.666291.xyz,DIRECT
DOMAIN,www.muou.asia,DIRECT
DOMAIN,www.muou.site,DIRECT
DOMAIN,feimaoai.site,DIRECT
DOMAIN,feimao666.fun,DIRECT
DOMAIN,feimao888.fun,DIRECT
DOMAIN,mihdr.top,DIRECT
DOMAIN,www.miqk.cc,DIRECT
DOMAIN,www.mihdr.top,DIRECT
DOMAIN,www.zhizhenpan.fun,DIRECT
DOMAIN,tv.yydsys.top,DIRECT
DOMAIN,tv.yydsys.cc,DIRECT
DOMAIN,tv.214521.xyz,DIRECT
DOMAIN,woog.nxog.eu.org,DIRECT
DOMAIN,xhww.net,DIRECT
DOMAIN,2xiaopan.fun,DIRECT
DOMAIN,erxiaofn.click,DIRECT
DOMAIN,erxiaofn.site,DIRECT
DOMAIN,www.xhww.net,DIRECT
DOMAIN,xiaoer.5568.eu.org,DIRECT
DOMAIN,xsayang.fun,DIRECT
DOMAIN-SUFFIX,joll.cc.cd,DIRECT
`;

// Rule/outdoor：境外流媒体、Plex/Emby、阅读与订阅站点
const customRuleSourceOutdoor = `
# XPTV
# 海外看
DOMAIN-SUFFIX,cdn.kin6c1.com,全球加速
DOMAIN-SUFFIX,cdn.iz8qkg.com,全球加速
DOMAIN-SUFFIX,cdn.v82u1l.com,全球加速
DOMAIN-SUFFIX,haiwaikan.com,全球加速
# 欧乐影视
DOMAIN-KEYWORD,olelive,全球加速
DOMAIN-KEYWORD,olevod,全球加速
DOMAIN-KEYWORD,olemovienews,全球加速
DOMAIN,www.olehdtv.com,全球加速
# missav
DOMAIN,missav.com,全球加速
# 独播库
DOMAIN-KEYWORD,duboku,全球加速

# emby
# porn
DOMAIN,pornemby.club,全球加速
DOMAIN,misty.ltd,全球加速
# 起点
DOMAIN-KEYWORD,test.28.al,全球加速

# pilipili
# DOMAIN-KEYWORD,pilipili,全球加速
# 纸片人
DOMAIN,embyplus.org,全球加速
# cc
# DOMAIN-SUFFIX,carryz.net,全球加速
# 星云
DOMAIN-KEYWORD,nebula-media,全球加速
# mefun
DOMAIN,music.mefun.org,全球加速
#jms
DOMAIN,mini.jmsuper.com,新加坡节点
#vercel
DOMAIN,vercel.app,美国节点
DOMAIN,vercel.buyikun.dpdns.org,美国节点
#dpdns.org
#DOMAIN-SUFFIX,dpdns.org,美国节点
#sntp
DOMAIN,lite.cn2gias.UK,美国节点
#todb
DOMAIN,playback.theotherdb.org,新加坡节点

#plex
DOMAIN,plex.tv,美国节点
DOMAIN,metadata-static.plex.tv,美国节点
DOMAIN,metadata.provider.plex.tv,美国节点
DOMAIN,provider.plex.tv,美国节点
DOMAIN,analytics.plex.tv,美国节点
DOMAIN,meta.plex.tv,美国节点
DOMAIN,support.plex.tv,美国节点
DOMAIN,forums.plex.tv,美国节点
DOMAIN,downloads.plex.tv,美国节点
DOMAIN,clients.plex.tv,美国节点
DOMAIN,pubsub.plex.tv,美国节点
DOMAIN,images.plex.tv,美国节点
DOMAIN,together.plex.tv,美国节点
DOMAIN,community.plex.tv,美国节点
DOMAIN,scrobbles.plex.tv,美国节点
DOMAIN,features.plex.tv,美国节点

#trakt
DOMAIN-KEYWORD,trakt.tv,美国节点
#imdb
DOMAIN-KEYWORD,imdb,美国节点
#tmdb
DOMAIN-KEYWORD,tmdb,美国节点

# APTV
# iptv中国地区（含港澳台）
DOMAIN-KEYWORD,stream-link,美国节点
DOMAIN,aktv.space,美国节点
# epg
DOMAIN-KEYWORD,epg,全球加速
# 订阅代理
DOMAIN,iptv.yang-1989.xyz,全球加速
DOMAIN,tv.iill.top,全球加速


#zlibrary
DOMAIN-KEYWORD,z-lib,全球加速
DOMAIN-KEYWORD,z-library,全球加速

# Reader
DOMAIN,app.koyeb.com,美国节点
DOMAIN,www.koyeb.com,美国节点
DOMAIN,constant-fulvia-buyikun-ff01d8b0.koyeb.app,美国节点
DOMAIN-KEYWORD,69shuba,美国节点
DOMAIN-KEYWORD,69shux,美国节点
DOMAIN-KEYWORD,69yuedu,美国节点
DOMAIN,twkan.com,美国节点

#可莉
DOMAIN-KEYWORD,kelee.one,美国节点

#API
DOMAIN,api.abnt.it,全球加速
DOMAIN,elysia.h-e.top,全球加速
# Meta（Facebook / Instagram / WhatsApp / Threads / Meta AI）
# 来源: https://rucu6.pages.dev/Rules/Meta.lsr (2026-11-11)
# 统一走「全球加速」；IP 规则 mihomo 同步脚本不识别，仅在 Loon 端生效
DOMAIN-KEYWORD,facebook,全球加速
DOMAIN-KEYWORD,fbcdn,全球加速
DOMAIN-KEYWORD,instagram,全球加速
DOMAIN-KEYWORD,whatsapp,全球加速
DOMAIN-SUFFIX,aboutfacebook.com,全球加速
DOMAIN-SUFFIX,accessfacebookfromschool.com,全球加速
DOMAIN-SUFFIX,accountkit.com,全球加速
DOMAIN-SUFFIX,acebooik.com,全球加速
DOMAIN-SUFFIX,acebook.com,全球加速
DOMAIN-SUFFIX,achat-followers-instagram.com,全球加速
DOMAIN-SUFFIX,acheter-followers-instagram.com,全球加速
DOMAIN-SUFFIX,acheterdesfollowersinstagram.com,全球加速
DOMAIN-SUFFIX,acheterfollowersinstagram.com,全球加速
DOMAIN-SUFFIX,advancediddetection.com,全球加速
DOMAIN-SUFFIX,askfacebook.net,全球加速
DOMAIN-SUFFIX,askfacebook.org,全球加速
DOMAIN-SUFFIX,atdmt2.com,全球加速
DOMAIN-SUFFIX,atlasdmt.com,全球加速
DOMAIN-SUFFIX,atlasonepoint.com,全球加速
DOMAIN-SUFFIX,atscaleconference.com,全球加速
DOMAIN-SUFFIX,binoculus.com,全球加速
DOMAIN-SUFFIX,bookstagram.com,全球加速
DOMAIN-SUFFIX,botorch.org,全球加速
DOMAIN-SUFFIX,buck.build,全球加速
DOMAIN-SUFFIX,buckbuild.com,全球加速
DOMAIN-SUFFIX,buyingfacebooklikes.com,全球加速
DOMAIN-SUFFIX,buyoculus.com,全球加速
DOMAIN-SUFFIX,careersatfb.com,全球加速
DOMAIN-SUFFIX,carstagram.com,全球加速
DOMAIN-SUFFIX,cdninstagram.com,全球加速
DOMAIN-SUFFIX,celebgramme.com,全球加速
DOMAIN-SUFFIX,chickstagram.com,全球加速
DOMAIN-SUFFIX,china-facebook.com,全球加速
DOMAIN-SUFFIX,click-url.com,全球加速
DOMAIN-SUFFIX,como-hackearfacebook.com,全球加速
DOMAIN-SUFFIX,componentkit.org,全球加速
DOMAIN-SUFFIX,crowdtangle.com,全球加速
DOMAIN-SUFFIX,dacebook.com,全球加速
DOMAIN-SUFFIX,dlfacebook.com,全球加速
DOMAIN-SUFFIX,dotfacebook.com,全球加速
DOMAIN-SUFFIX,dotfacebook.net,全球加速
DOMAIN-SUFFIX,draftjs.org,全球加速
DOMAIN-SUFFIX,expresswifi.com,全球加速
DOMAIN-SUFFIX,f8.com,全球加速
DOMAIN-SUFFIX,faacebok.com,全球加速
DOMAIN-SUFFIX,faacebook.com,全球加速
DOMAIN-SUFFIX,faasbook.com,全球加速
DOMAIN-SUFFIX,facbebook.com,全球加速
DOMAIN-SUFFIX,facbeok.com,全球加速
DOMAIN-SUFFIX,facboo.com,全球加速
DOMAIN-SUFFIX,facbook.com,全球加速
DOMAIN-SUFFIX,facbool.com,全球加速
DOMAIN-SUFFIX,facboox.com,全球加速
DOMAIN-SUFFIX,faccebook.com,全球加速
DOMAIN-SUFFIX,faccebookk.com,全球加速
DOMAIN-SUFFIX,facdbook.com,全球加速
DOMAIN-SUFFIX,facdebook.com,全球加速
DOMAIN-SUFFIX,face-book.com,全球加速
DOMAIN-SUFFIX,faceabook.com,全球加速
DOMAIN-SUFFIX,facebboc.com,全球加速
DOMAIN-SUFFIX,facebbook.com,全球加速
DOMAIN-SUFFIX,facebboook.com,全球加速
DOMAIN-SUFFIX,facebcook.com,全球加速
DOMAIN-SUFFIX,facebdok.com,全球加速
DOMAIN-SUFFIX,facebgook.com,全球加速
DOMAIN-SUFFIX,facebhook.com,全球加速
DOMAIN-SUFFIX,facebkkk.com,全球加速
DOMAIN-SUFFIX,facebo-ok.com,全球加速
DOMAIN-SUFFIX,faceboak.com,全球加速
DOMAIN-SUFFIX,facebock.com,全球加速
DOMAIN-SUFFIX,facebocke.com,全球加速
DOMAIN-SUFFIX,facebof.com,全球加速
DOMAIN-SUFFIX,faceboik.com,全球加速
DOMAIN-SUFFIX,facebok.com,全球加速
DOMAIN-SUFFIX,facebokbook.com,全球加速
DOMAIN-SUFFIX,facebokc.com,全球加速
DOMAIN-SUFFIX,facebokk.com,全球加速
DOMAIN-SUFFIX,facebokok.com,全球加速
DOMAIN-SUFFIX,faceboks.com,全球加速
DOMAIN-SUFFIX,facebol.com,全球加速
DOMAIN-SUFFIX,facebolk.com,全球加速
DOMAIN-SUFFIX,facebomok.com,全球加速
DOMAIN-SUFFIX,faceboo.com,全球加速
DOMAIN-SUFFIX,facebooa.com,全球加速
DOMAIN-SUFFIX,faceboob.com,全球加速
DOMAIN-SUFFIX,faceboobok.com,全球加速
DOMAIN-SUFFIX,facebooc.com,全球加速
DOMAIN-SUFFIX,faceboock.com,全球加速
DOMAIN-SUFFIX,facebood.com,全球加速
DOMAIN-SUFFIX,facebooe.com,全球加速
DOMAIN-SUFFIX,faceboof.com,全球加速
DOMAIN-SUFFIX,facebooi.com,全球加速
DOMAIN-SUFFIX,facebooik.com,全球加速
DOMAIN-SUFFIX,facebooik.org,全球加速
DOMAIN-SUFFIX,facebooj.com,全球加速
DOMAIN-SUFFIX,facebook-corp.com,全球加速
DOMAIN-SUFFIX,facebook-covid-19.com,全球加速
DOMAIN-SUFFIX,facebook-ebook.com,全球加速
DOMAIN-SUFFIX,facebook-forum.com,全球加速
DOMAIN-SUFFIX,facebook-hardware.com,全球加速
DOMAIN-SUFFIX,facebook-inc.com,全球加速
DOMAIN-SUFFIX,facebook-login.com,全球加速
DOMAIN-SUFFIX,facebook-newsroom.com,全球加速
DOMAIN-SUFFIX,facebook-newsroom.org,全球加速
DOMAIN-SUFFIX,facebook-pmdcenter.com,全球加速
DOMAIN-SUFFIX,facebook-pmdcenter.net,全球加速
DOMAIN-SUFFIX,facebook-pmdcenter.org,全球加速
DOMAIN-SUFFIX,facebook-privacy.com,全球加速
DOMAIN-SUFFIX,facebook-program.com,全球加速
DOMAIN-SUFFIX,facebook-studio.com,全球加速
DOMAIN-SUFFIX,facebook-support.org,全球加速
DOMAIN-SUFFIX,facebook-texas-holdem.com,全球加速
DOMAIN-SUFFIX,facebook-texas-holdem.net,全球加速
DOMAIN-SUFFIX,facebook.br,全球加速
DOMAIN-SUFFIX,facebook.ca,全球加速
DOMAIN-SUFFIX,facebook.cc,全球加速
DOMAIN-SUFFIX,facebook.com,全球加速
DOMAIN-SUFFIX,facebook.design,全球加速
DOMAIN-SUFFIX,facebook.hu,全球加速
DOMAIN-SUFFIX,facebook.in,全球加速
DOMAIN-SUFFIX,facebook.net,全球加速
DOMAIN-SUFFIX,facebook.nl,全球加速
DOMAIN-SUFFIX,facebook.org,全球加速
DOMAIN-SUFFIX,facebook.se,全球加速
DOMAIN-SUFFIX,facebook.shop,全球加速
DOMAIN-SUFFIX,facebook.tv,全球加速
DOMAIN-SUFFIX,facebook.us,全球加速
DOMAIN-SUFFIX,facebook.wang,全球加速
DOMAIN-SUFFIX,facebook123.org,全球加速
DOMAIN-SUFFIX,facebook30.com,全球加速
DOMAIN-SUFFIX,facebook30.net,全球加速
DOMAIN-SUFFIX,facebook30.org,全球加速
DOMAIN-SUFFIX,facebook4business.com,全球加速
DOMAIN-SUFFIX,facebookads.com,全球加速
DOMAIN-SUFFIX,facebookadvertisingsecrets.com,全球加速
DOMAIN-SUFFIX,facebookappcenter.info,全球加速
DOMAIN-SUFFIX,facebookappcenter.net,全球加速
DOMAIN-SUFFIX,facebookappcenter.org,全球加速
DOMAIN-SUFFIX,facebookatschool.com,全球加速
DOMAIN-SUFFIX,facebookawards.com,全球加速
DOMAIN-SUFFIX,facebookblueprint.net,全球加速
DOMAIN-SUFFIX,facebookbrand.com,全球加速
DOMAIN-SUFFIX,facebookbrand.net,全球加速
DOMAIN-SUFFIX,facebookcanadianelectionintegrityinitiative.com,全球加速
DOMAIN-SUFFIX,facebookcareer.com,全球加速
DOMAIN-SUFFIX,facebookcheats.com,全球加速
DOMAIN-SUFFIX,facebookck.com,全球加速
DOMAIN-SUFFIX,facebookclub.com,全球加速
DOMAIN-SUFFIX,facebookcom.com,全球加速
DOMAIN-SUFFIX,facebookconnect.com,全球加速
DOMAIN-SUFFIX,facebookconsultant.org,全球加速
DOMAIN-SUFFIX,facebookcoronavirus.com,全球加速
DOMAIN-SUFFIX,facebookcovers.org,全球加速
DOMAIN-SUFFIX,facebookcredits.info,全球加速
DOMAIN-SUFFIX,facebookdating.net,全球加速
DOMAIN-SUFFIX,facebookdevelopergarage.com,全球加速
DOMAIN-SUFFIX,facebookdusexe.org,全球加速
DOMAIN-SUFFIX,facebookemail.com,全球加速
DOMAIN-SUFFIX,facebookenespanol.com,全球加速
DOMAIN-SUFFIX,facebookexchange.com,全球加速
DOMAIN-SUFFIX,facebookexchange.net,全球加速
DOMAIN-SUFFIX,facebookfacebook.com,全球加速
DOMAIN-SUFFIX,facebookflow.com,全球加速
DOMAIN-SUFFIX,facebookgames.com,全球加速
DOMAIN-SUFFIX,facebookgraphsearch.com,全球加速
DOMAIN-SUFFIX,facebookgraphsearch.info,全球加速
DOMAIN-SUFFIX,facebookgroups.com,全球加速
DOMAIN-SUFFIX,facebookhome.cc,全球加速
DOMAIN-SUFFIX,facebookhome.com,全球加速
DOMAIN-SUFFIX,facebookhome.info,全球加速
DOMAIN-SUFFIX,facebookhub.com,全球加速
DOMAIN-SUFFIX,facebooki.com,全球加速
DOMAIN-SUFFIX,facebookinc.com,全球加速
DOMAIN-SUFFIX,facebookland.com,全球加速
DOMAIN-SUFFIX,facebooklikeexchange.com,全球加速
DOMAIN-SUFFIX,facebooklive.com,全球加速
DOMAIN-SUFFIX,facebooklivestaging.net,全球加速
DOMAIN-SUFFIX,facebooklivestaging.org,全球加速
DOMAIN-SUFFIX,facebooklogin.com,全球加速
DOMAIN-SUFFIX,facebooklogin.info,全球加速
DOMAIN-SUFFIX,facebookloginhelp.net,全球加速
DOMAIN-SUFFIX,facebooklogs.com,全球加速
DOMAIN-SUFFIX,facebookmail.com,全球加速
DOMAIN-SUFFIX,facebookmail.tv,全球加速
DOMAIN-SUFFIX,facebookmanager.info,全球加速
DOMAIN-SUFFIX,facebookmarketing.info,全球加速
DOMAIN-SUFFIX,facebookmarketingpartner.com,全球加速
DOMAIN-SUFFIX,facebookmarketingpartners.com,全球加速
DOMAIN-SUFFIX,facebookmobile.com,全球加速
DOMAIN-SUFFIX,facebookmsn.com,全球加速
DOMAIN-SUFFIX,facebooknews.com,全球加速
DOMAIN-SUFFIX,facebooknfl.com,全球加速
DOMAIN-SUFFIX,facebooknude.com,全球加速
DOMAIN-SUFFIX,facebookofsex.com,全球加速
DOMAIN-SUFFIX,facebookook.com,全球加速
DOMAIN-SUFFIX,facebookpaper.com,全球加速
DOMAIN-SUFFIX,facebookpay.com,全球加速
DOMAIN-SUFFIX,facebookphonenumber.net,全球加速
DOMAIN-SUFFIX,facebookphoto.com,全球加速
DOMAIN-SUFFIX,facebookphotos.com,全球加速
DOMAIN-SUFFIX,facebookpmdcenter.com,全球加速
DOMAIN-SUFFIX,facebookpoke.net,全球加速
DOMAIN-SUFFIX,facebookpoke.org,全球加速
DOMAIN-SUFFIX,facebookpoker.info,全球加速
DOMAIN-SUFFIX,facebookpokerchips.info,全球加速
DOMAIN-SUFFIX,facebookporn.net,全球加速
DOMAIN-SUFFIX,facebookporn.org,全球加速
DOMAIN-SUFFIX,facebookporno.net,全球加速
DOMAIN-SUFFIX,facebookportal.com,全球加速
DOMAIN-SUFFIX,facebookquotes4u.com,全球加速
DOMAIN-SUFFIX,facebooks.com,全球加速
DOMAIN-SUFFIX,facebooksafety.com,全球加速
DOMAIN-SUFFIX,facebooksecurity.net,全球加速
DOMAIN-SUFFIX,facebookshop.com,全球加速
DOMAIN-SUFFIX,facebooksignup.net,全球加速
DOMAIN-SUFFIX,facebooksite.net,全球加速
DOMAIN-SUFFIX,facebookstories.com,全球加速
DOMAIN-SUFFIX,facebookstudios.net,全球加速
DOMAIN-SUFFIX,facebookstudios.org,全球加速
DOMAIN-SUFFIX,facebooksupplier.com,全球加速
DOMAIN-SUFFIX,facebooksuppliers.com,全球加速
DOMAIN-SUFFIX,facebookswagemea.com,全球加速
DOMAIN-SUFFIX,facebookswagstore.com,全球加速
DOMAIN-SUFFIX,facebooksz.com,全球加速
DOMAIN-SUFFIX,facebookthreads.net,全球加速
DOMAIN-SUFFIX,facebooktv.net,全球加速
DOMAIN-SUFFIX,facebooktv.org,全球加速
DOMAIN-SUFFIX,facebookvacation.com,全球加速
DOMAIN-SUFFIX,facebookw.com,全球加速
DOMAIN-SUFFIX,facebookwork.com,全球加速
DOMAIN-SUFFIX,facebookworld.com,全球加速
DOMAIN-SUFFIX,facebool.com,全球加速
DOMAIN-SUFFIX,facebool.info,全球加速
DOMAIN-SUFFIX,facebooll.com,全球加速
DOMAIN-SUFFIX,faceboom.com,全球加速
DOMAIN-SUFFIX,faceboon.com,全球加速
DOMAIN-SUFFIX,faceboonk.com,全球加速
DOMAIN-SUFFIX,faceboooik.com,全球加速
DOMAIN-SUFFIX,faceboook.com,全球加速
DOMAIN-SUFFIX,faceboop.com,全球加速
DOMAIN-SUFFIX,faceboot.com,全球加速
DOMAIN-SUFFIX,faceboox.com,全球加速
DOMAIN-SUFFIX,facebopk.com,全球加速
DOMAIN-SUFFIX,facebpook.com,全球加速
DOMAIN-SUFFIX,facebuk.com,全球加速
DOMAIN-SUFFIX,facebuok.com,全球加速
DOMAIN-SUFFIX,facebvook.com,全球加速
DOMAIN-SUFFIX,facebyook.com,全球加速
DOMAIN-SUFFIX,facebzook.com,全球加速
DOMAIN-SUFFIX,facecbgook.com,全球加速
DOMAIN-SUFFIX,facecbook.com,全球加速
DOMAIN-SUFFIX,facecbook.org,全球加速
DOMAIN-SUFFIX,facecook.com,全球加速
DOMAIN-SUFFIX,facecook.org,全球加速
DOMAIN-SUFFIX,facedbook.com,全球加速
DOMAIN-SUFFIX,faceebok.com,全球加速
DOMAIN-SUFFIX,faceebook.com,全球加速
DOMAIN-SUFFIX,faceebot.com,全球加速
DOMAIN-SUFFIX,facegbok.com,全球加速
DOMAIN-SUFFIX,facegbook.com,全球加速
DOMAIN-SUFFIX,faceobk.com,全球加速
DOMAIN-SUFFIX,faceobok.com,全球加速
DOMAIN-SUFFIX,faceobook.com,全球加速
DOMAIN-SUFFIX,faceook.com,全球加速
DOMAIN-SUFFIX,facerbooik.com,全球加速
DOMAIN-SUFFIX,facerbook.com,全球加速
DOMAIN-SUFFIX,facesbooc.com,全球加速
DOMAIN-SUFFIX,facesounds.com,全球加速
DOMAIN-SUFFIX,facetook.com,全球加速
DOMAIN-SUFFIX,facevbook.com,全球加速
DOMAIN-SUFFIX,facewbook.co,全球加速
DOMAIN-SUFFIX,facewook.com,全球加速
DOMAIN-SUFFIX,facfacebook.com,全球加速
DOMAIN-SUFFIX,facfebook.com,全球加速
DOMAIN-SUFFIX,faciometrics.com,全球加速
DOMAIN-SUFFIX,fackebook.com,全球加速
DOMAIN-SUFFIX,facnbook.com,全球加速
DOMAIN-SUFFIX,facrbook.com,全球加速
DOMAIN-SUFFIX,facvebook.com,全球加速
DOMAIN-SUFFIX,facwebook.com,全球加速
DOMAIN-SUFFIX,facxebook.com,全球加速
DOMAIN-SUFFIX,fadebook.com,全球加速
DOMAIN-SUFFIX,faebok.com,全球加速
DOMAIN-SUFFIX,faebook.com,全球加速
DOMAIN-SUFFIX,faebookc.com,全球加速
DOMAIN-SUFFIX,faeboook.com,全球加速
DOMAIN-SUFFIX,faecebok.com,全球加速
DOMAIN-SUFFIX,faesebook.com,全球加速
DOMAIN-SUFFIX,fafacebook.com,全球加速
DOMAIN-SUFFIX,faicbooc.com,全球加速
DOMAIN-SUFFIX,fasebokk.com,全球加速
DOMAIN-SUFFIX,fasebook.com,全球加速
DOMAIN-SUFFIX,faseboox.com,全球加速
DOMAIN-SUFFIX,fasttext.cc,全球加速
DOMAIN-SUFFIX,favebook.com,全球加速
DOMAIN-SUFFIX,faycbok.com,全球加速
DOMAIN-SUFFIX,fb.careers,全球加速
DOMAIN-SUFFIX,fb.com,全球加速
DOMAIN-SUFFIX,fb.me,全球加速
DOMAIN-SUFFIX,fbacebook.com,全球加速
DOMAIN-SUFFIX,fbaddins.com,全球加速
DOMAIN-SUFFIX,fbbmarket.com,全球加速
DOMAIN-SUFFIX,fbboostyourbusiness.com,全球加速
DOMAIN-SUFFIX,fbcdn-a.akamaihd.net,全球加速
DOMAIN-SUFFIX,fbcdn.com,全球加速
DOMAIN-SUFFIX,fbcdn.net,全球加速
DOMAIN-SUFFIX,fbf8.com,全球加速
DOMAIN-SUFFIX,fbfeedback.com,全球加速
DOMAIN-SUFFIX,fbhome.com,全球加速
DOMAIN-SUFFIX,fbidb.io,全球加速
DOMAIN-SUFFIX,fbinc.com,全球加速
DOMAIN-SUFFIX,fbinfer.com,全球加速
DOMAIN-SUFFIX,fbinnovation.com,全球加速
DOMAIN-SUFFIX,fblitho.com,全球加速
DOMAIN-SUFFIX,fbmarketing.com,全球加速
DOMAIN-SUFFIX,fbmessenger.com,全球加速
DOMAIN-SUFFIX,fbredex.com,全球加速
DOMAIN-SUFFIX,fbreg.com,全球加速
DOMAIN-SUFFIX,fbrell.com,全球加速
DOMAIN-SUFFIX,fbrpms.com,全球加速
DOMAIN-SUFFIX,fbsbx.com,全球加速
DOMAIN-SUFFIX,fbsbx.net,全球加速
DOMAIN-SUFFIX,fbsupport-covid.net,全球加速
DOMAIN-SUFFIX,fbthirdpartypixel.com,全球加速
DOMAIN-SUFFIX,fbthirdpartypixel.net,全球加速
DOMAIN-SUFFIX,fbthirdpartypixel.org,全球加速
DOMAIN-SUFFIX,fburl.com,全球加速
DOMAIN-SUFFIX,fbworkmail.com,全球加速
DOMAIN-SUFFIX,fcacebook.com,全球加速
DOMAIN-SUFFIX,fcaebook.com,全球加速
DOMAIN-SUFFIX,fcebook.com,全球加速
DOMAIN-SUFFIX,fcebookk.com,全球加速
DOMAIN-SUFFIX,fcfacebook.com,全球加速
DOMAIN-SUFFIX,fdacebook.info,全球加速
DOMAIN-SUFFIX,feacboo.com,全球加速
DOMAIN-SUFFIX,feacbook.com,全球加速
DOMAIN-SUFFIX,feacbooke.com,全球加速
DOMAIN-SUFFIX,feacebook.com,全球加速
DOMAIN-SUFFIX,fecbbok.com,全球加速
DOMAIN-SUFFIX,fecbooc.com,全球加速
DOMAIN-SUFFIX,fecbook.com,全球加速
DOMAIN-SUFFIX,feceboock.com,全球加速
DOMAIN-SUFFIX,fecebook.net,全球加速
DOMAIN-SUFFIX,feceboox.com,全球加速
DOMAIN-SUFFIX,fececbook.com,全球加速
DOMAIN-SUFFIX,feook.com,全球加速
DOMAIN-SUFFIX,ferabook.com,全球加速
DOMAIN-SUFFIX,fescebook.com,全球加速
DOMAIN-SUFFIX,fesebook.com,全球加速
DOMAIN-SUFFIX,ffacebook.com,全球加速
DOMAIN-SUFFIX,fgacebook.com,全球加速
DOMAIN-SUFFIX,ficeboock.com,全球加速
DOMAIN-SUFFIX,flow.dev,全球加速
DOMAIN-SUFFIX,flow.org,全球加速
DOMAIN-SUFFIX,flowtype.org,全球加速
DOMAIN-SUFFIX,fmcebook.com,全球加速
DOMAIN-SUFFIX,fnacebook.com,全球加速
DOMAIN-SUFFIX,fosebook.com,全球加速
DOMAIN-SUFFIX,fpacebook.com,全球加速
DOMAIN-SUFFIX,fqcebook.com,全球加速
DOMAIN-SUFFIX,fracebook.com,全球加速
DOMAIN-SUFFIX,freeb.com,全球加速
DOMAIN-SUFFIX,freebasics.com,全球加速
DOMAIN-SUFFIX,freebasics.net,全球加速
DOMAIN-SUFFIX,freebs.com,全球加速
DOMAIN-SUFFIX,freefacebook.com,全球加速
DOMAIN-SUFFIX,freefacebook.net,全球加速
DOMAIN-SUFFIX,freefacebookads.net,全球加速
DOMAIN-SUFFIX,freefblikes.com,全球加速
DOMAIN-SUFFIX,freindfeed.com,全球加速
DOMAIN-SUFFIX,frescolib.org,全球加速
DOMAIN-SUFFIX,friendbook.info,全球加速
DOMAIN-SUFFIX,friendfed.com,全球加速
DOMAIN-SUFFIX,friendfeed-api.com,全球加速
DOMAIN-SUFFIX,friendfeed-media.com,全球加速
DOMAIN-SUFFIX,friendfeed.com,全球加速
DOMAIN-SUFFIX,friendfeedmedia.com,全球加速
DOMAIN-SUFFIX,fsacebok.com,全球加速
DOMAIN-SUFFIX,fscebook.com,全球加速
DOMAIN-SUFFIX,fundraisingwithfacebook.com,全球加速
DOMAIN-SUFFIX,funnyfacebook.org,全球加速
DOMAIN-SUFFIX,futureofbusinesssurvey.org,全球加速
DOMAIN-SUFFIX,gacebook.com,全球加速
DOMAIN-SUFFIX,gameroom.com,全球加速
DOMAIN-SUFFIX,gfacecbook.com,全球加速
DOMAIN-SUFFIX,groups.com,全球加速
DOMAIN-SUFFIX,hackerfacebook.com,全球加速
DOMAIN-SUFFIX,hackfacebook.com,全球加速
DOMAIN-SUFFIX,hackfacebookid.com,全球加速
DOMAIN-SUFFIX,hacklang.org,全球加速
DOMAIN-SUFFIX,hhvm.com,全球加速
DOMAIN-SUFFIX,hifacebook.info,全球加速
DOMAIN-SUFFIX,howtohackfacebook-account.com,全球加速
DOMAIN-SUFFIX,hsfacebook.com,全球加速
DOMAIN-SUFFIX,httpfacebook.com,全球加速
DOMAIN-SUFFIX,httpsfacebook.com,全球加速
DOMAIN-SUFFIX,httpwwwfacebook.com,全球加速
DOMAIN-SUFFIX,i.org,全球加速
DOMAIN-SUFFIX,ig.me,全球加速
DOMAIN-SUFFIX,igcdn.com,全球加速
DOMAIN-SUFFIX,igsonar.com,全球加速
DOMAIN-SUFFIX,igtv.com,全球加速
DOMAIN-SUFFIX,imstagram.com,全球加速
DOMAIN-SUFFIX,imtagram.com,全球加速
DOMAIN-SUFFIX,instaadder.com,全球加速
DOMAIN-SUFFIX,instachecker.com,全球加速
DOMAIN-SUFFIX,instafallow.com,全球加速
DOMAIN-SUFFIX,instafollower.com,全球加速
DOMAIN-SUFFIX,instagainer.com,全球加速
DOMAIN-SUFFIX,instagda.com,全球加速
DOMAIN-SUFFIX,instagify.com,全球加速
DOMAIN-SUFFIX,instagmania.com,全球加速
DOMAIN-SUFFIX,instagor.com,全球加速
DOMAIN-SUFFIX,instagr.am,全球加速
DOMAIN-SUFFIX,instagram-brand.com,全球加速
DOMAIN-SUFFIX,instagram-engineering.com,全球加速
DOMAIN-SUFFIX,instagram-help.com,全球加速
DOMAIN-SUFFIX,instagram-press.com,全球加速
DOMAIN-SUFFIX,instagram-press.net,全球加速
DOMAIN-SUFFIX,instagram.com,全球加速
DOMAIN-SUFFIX,instagramci.com,全球加速
DOMAIN-SUFFIX,instagramcn.com,全球加速
DOMAIN-SUFFIX,instagramdi.com,全球加速
DOMAIN-SUFFIX,instagramhashtags.net,全球加速
DOMAIN-SUFFIX,instagramhilecim.com,全球加速
DOMAIN-SUFFIX,instagramhilesi.org,全球加速
DOMAIN-SUFFIX,instagramium.com,全球加速
DOMAIN-SUFFIX,instagramizlenme.com,全球加速
DOMAIN-SUFFIX,instagramkusu.com,全球加速
DOMAIN-SUFFIX,instagramlogin.com,全球加速
DOMAIN-SUFFIX,instagramm.com,全球加速
DOMAIN-SUFFIX,instagramn.com,全球加速
DOMAIN-SUFFIX,instagrampartners.com,全球加速
DOMAIN-SUFFIX,instagramphoto.com,全球加速
DOMAIN-SUFFIX,instagramq.com,全球加速
DOMAIN-SUFFIX,instagramsepeti.com,全球加速
DOMAIN-SUFFIX,instagramtakipcisatinal.net,全球加速
DOMAIN-SUFFIX,instagramtakiphilesi.com,全球加速
DOMAIN-SUFFIX,instagramtips.com,全球加速
DOMAIN-SUFFIX,instagramtr.com,全球加速
DOMAIN-SUFFIX,instagran.com,全球加速
DOMAIN-SUFFIX,instagranm.com,全球加速
DOMAIN-SUFFIX,instagrem.com,全球加速
DOMAIN-SUFFIX,instagrm.com,全球加速
DOMAIN-SUFFIX,instagtram.com,全球加速
DOMAIN-SUFFIX,instagy.com,全球加速
DOMAIN-SUFFIX,instamgram.com,全球加速
DOMAIN-SUFFIX,instangram.com,全球加速
DOMAIN-SUFFIX,instanttelegram.com,全球加速
DOMAIN-SUFFIX,instaplayer.net,全球加速
DOMAIN-SUFFIX,instastyle.tv,全球加速
DOMAIN-SUFFIX,instgram.com,全球加速
DOMAIN-SUFFIX,intagram.com,全球加速
DOMAIN-SUFFIX,intagrm.com,全球加速
DOMAIN-SUFFIX,internet.org,全球加速
DOMAIN-SUFFIX,intgram.com,全球加速
DOMAIN-SUFFIX,ip6.static.sl-reverse.com,全球加速
DOMAIN-SUFFIX,kingstagram.com,全球加速
DOMAIN-SUFFIX,klik.me,全球加速
DOMAIN-SUFFIX,liverail.com,全球加速
DOMAIN-SUFFIX,liverail.tv,全球加速
DOMAIN-SUFFIX,lnstagram-help.com,全球加速
DOMAIN-SUFFIX,login-account.net,全球加速
DOMAIN-SUFFIX,m.me,全球加速
DOMAIN-SUFFIX,makeitopen.com,全球加速
DOMAIN-SUFFIX,markzuckerberg.com,全球加速
DOMAIN-SUFFIX,mcrouter.net,全球加速
DOMAIN-SUFFIX,mcrouter.org,全球加速
DOMAIN-SUFFIX,messenger.com,全球加速
DOMAIN-SUFFIX,messengerdevelopers.com,全球加速
DOMAIN-SUFFIX,meta.ai,全球加速
DOMAIN-SUFFIX,meta.com,全球加速
DOMAIN-SUFFIX,metaaivm.com,全球加速
DOMAIN-SUFFIX,midentsolutions.com,全球加速
DOMAIN-SUFFIX,mobilefacebook.com,全球加速
DOMAIN-SUFFIX,moneywithfacebook.com,全球加速
DOMAIN-SUFFIX,muse.ai,全球加速
DOMAIN-SUFFIX,myfbfans.com,全球加速
DOMAIN-SUFFIX,nbabot.net,全球加速
DOMAIN-SUFFIX,newsfeed.com,全球加速
DOMAIN-SUFFIX,nextstop.com,全球加速
DOMAIN-SUFFIX,oculus-china.com,全球加速
DOMAIN-SUFFIX,oculus.com,全球加速
DOMAIN-SUFFIX,oculus2014.com,全球加速
DOMAIN-SUFFIX,oculus3d.com,全球加速
DOMAIN-SUFFIX,oculusblog.com,全球加速
DOMAIN-SUFFIX,oculusbrand.com,全球加速
DOMAIN-SUFFIX,oculuscasino.net,全球加速
DOMAIN-SUFFIX,oculuscdn.com,全球加速
DOMAIN-SUFFIX,oculusconnect.com,全球加速
DOMAIN-SUFFIX,oculusdiving.com,全球加速
DOMAIN-SUFFIX,oculusforbusiness.com,全球加速
DOMAIN-SUFFIX,oculusrift.com,全球加速
DOMAIN-SUFFIX,oculusvr.com,全球加速
DOMAIN-SUFFIX,ocul.us,全球加速
DOMAIN-SUFFIX,ogp.me,全球加速
DOMAIN-SUFFIX,oninstagram.com,全球加速
DOMAIN-SUFFIX,online-deals.net,全球加速
DOMAIN-SUFFIX,online-instagram.com,全球加速
DOMAIN-SUFFIX,onlineinstagram.com,全球加速
DOMAIN-SUFFIX,opencreate.org,全球加速
DOMAIN-SUFFIX,opengraphprotocol.com,全球加速
DOMAIN-SUFFIX,opengraphprotocol.org,全球加速
DOMAIN-SUFFIX,parse.com,全球加速
DOMAIN-SUFFIX,powersunitedvr.com,全球加速
DOMAIN-SUFFIX,pyrobot.org,全球加速
DOMAIN-SUFFIX,reachtheworldonfacebook.com,全球加速
DOMAIN-SUFFIX,react.com,全球加速
DOMAIN-SUFFIX,reactjs.com,全球加速
DOMAIN-SUFFIX,reactjs.org,全球加速
DOMAIN-SUFFIX,readyatdawn.com,全球加速
DOMAIN-SUFFIX,recoiljs.org,全球加速
DOMAIN-SUFFIX,redkix.com,全球加速
DOMAIN-SUFFIX,rocksdb.com,全球加速
DOMAIN-SUFFIX,rocksdb.net,全球加速
DOMAIN-SUFFIX,rocksdb.org,全球加速
DOMAIN-SUFFIX,shopfacebook.com,全球加速
DOMAIN-SUFFIX,sportsfacebook.com,全球加速
DOMAIN-SUFFIX,sportstream.com,全球加速
DOMAIN-SUFFIX,supportfacebook.com,全球加速
DOMAIN-SUFFIX,terragraph.com,全球加速
DOMAIN-SUFFIX,thefacebook.com,全球加速
DOMAIN-SUFFIX,thefacebook.net,全球加速
DOMAIN-SUFFIX,thefind.com,全球加速
DOMAIN-SUFFIX,theinstagramhack.com,全球加速
DOMAIN-SUFFIX,threads.com,全球加速
DOMAIN-SUFFIX,threads.net,全球加速
DOMAIN-SUFFIX,toplayerserver.com,全球加速
DOMAIN-SUFFIX,viewpointsfromfacebook.com,全球加速
DOMAIN-SUFFIX,wa.me,全球加速
DOMAIN-SUFFIX,web-instagram.net,全球加速
DOMAIN-SUFFIX,whatsapp-plus.info,全球加速
DOMAIN-SUFFIX,whatsapp-plus.me,全球加速
DOMAIN-SUFFIX,whatsapp-plus.net,全球加速
DOMAIN-SUFFIX,whatsapp.biz,全球加速
DOMAIN-SUFFIX,whatsapp.cc,全球加速
DOMAIN-SUFFIX,whatsapp.com,全球加速
DOMAIN-SUFFIX,whatsapp.info,全球加速
DOMAIN-SUFFIX,whatsapp.net,全球加速
DOMAIN-SUFFIX,whatsapp.org,全球加速
DOMAIN-SUFFIX,whatsapp.tv,全球加速
DOMAIN-SUFFIX,whatsappbrand.com,全球加速
DOMAIN-SUFFIX,whyfacebook.com,全球加速
DOMAIN-SUFFIX,workplace.com,全球加速
DOMAIN-SUFFIX,workplaceusecases.com,全球加速
DOMAIN-SUFFIX,worldhack.com,全球加速
DOMAIN-SUFFIX,www-facebook.com,全球加速
DOMAIN-SUFFIX,wwwfacebok.com,全球加速
DOMAIN-SUFFIX,wwwfacebook.com,全球加速
DOMAIN-SUFFIX,wwwinstagram.com,全球加速
DOMAIN-SUFFIX,wwwmfacebook.com,全球加速
DOMAIN-SUFFIX,yogalayout.com,全球加速
DOMAIN-SUFFIX,zuckerberg.com,全球加速
DOMAIN-SUFFIX,zuckerberg.net,全球加速
IP-CIDR,3.123.36.126/32,全球加速,no-resolve
IP-CIDR,18.194.0.0/15,全球加速,no-resolve
IP-CIDR,31.13.64.0/18,全球加速,no-resolve
IP-CIDR,34.224.0.0/12,全球加速,no-resolve
IP-CIDR,35.157.215.84/32,全球加速,no-resolve
IP-CIDR,35.157.217.255/32,全球加速,no-resolve
IP-CIDR,50.22.198.204/30,全球加速,no-resolve
IP-CIDR,52.58.209.134/32,全球加速,no-resolve
IP-CIDR,54.93.124.31/32,全球加速,no-resolve
IP-CIDR,54.162.243.80/32,全球加速,no-resolve
IP-CIDR,54.173.34.141/32,全球加速,no-resolve
IP-CIDR,54.235.23.242/32,全球加速,no-resolve
IP-CIDR,54.242.0.0/15,全球加速,no-resolve
IP-CIDR,108.168.176.192/26,全球加速,no-resolve
IP-CIDR,108.168.177.0/27,全球加速,no-resolve
IP-CIDR,108.168.180.96/27,全球加速,no-resolve
IP-CIDR,108.168.254.65/32,全球加速,no-resolve
IP-CIDR,108.168.255.224/32,全球加速,no-resolve
IP-CIDR,108.168.255.227/32,全球加速,no-resolve
IP-CIDR,108.177.8.0/21,全球加速,no-resolve
IP-CIDR,119.235.224.0/24,全球加速,no-resolve
IP-CIDR,119.235.232.0/24,全球加速,no-resolve
IP-CIDR,119.235.236.0/23,全球加速,no-resolve
IP-CIDR,129.134.0.0/17,全球加速,no-resolve
IP-CIDR,157.240.0.0/17,全球加速,no-resolve
IP-CIDR,158.85.5.192/27,全球加速,no-resolve
IP-CIDR,158.85.46.128/27,全球加速,no-resolve
IP-CIDR,158.85.224.160/27,全球加速,no-resolve
IP-CIDR,169.45.248.118/32,全球加速,no-resolve
IP-CIDR,173.192.222.160/27,全球加速,no-resolve
IP-CIDR,173.192.231.32/27,全球加速,no-resolve
IP-CIDR,173.252.64.0/18,全球加速,no-resolve
IP-CIDR,184.173.128.0/17,全球加速,no-resolve
IP-CIDR,208.43.122.128/27,全球加速,no-resolve
IP-ASN,32934,全球加速,no-resolve
`;

// Rule/unsure：尚未确定归属的域名
const customRuleSourceUnsure = `
#plex
DOMAIN,plex.20120714.xyz
#琉璃门
DOMAIN,iris.niceduck.lol
#yang
DOMAIN-SUFFIX,iill.top
#鸢尾
DOMAIN-SUFFIX,pvq.cc
#nox
DOMAIN,test.inemby.us.ci
#fandai
DOMAIN,emby.gszhou.dpdns.org
DOMAIN,fandai.buyikun.dpdns.org
`;

/**
 解析 Loon 规则文本，转换为 mihomo 规则条目
 @param {string} text 规则文本
 @param {string} defaultPolicy 未标注策略时使用的默认策略
 @param {(policy: string) => string} resolvePolicy 策略解析函数
 @returns {{ key: string, rule: string }[]}
*/
function parseCustomRules(text, defaultPolicy, resolvePolicy) {
  const rules = [];

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const [rawType, rawValue, rawPolicy] = line.split(',').map((part) => part.trim());
    if (!rawType || !rawValue) continue;

    const type = rawType.toUpperCase();
    const value = rawValue.toLowerCase();
    if (!customRuleTypes.includes(type)) continue;

    rules.push({
      key: `${type},${value}`,
      rule: `${type},${value},${resolvePolicy(rawPolicy || defaultPolicy)}`,
    });
  }

  return rules;
}

/**
 汇总全部自定义规则：按 airport → direct → outdoor → unsure 的顺序解析，
 重复域名保留首次出现的策略
 @param {Set<string>} availablePolicies 当前配置中可用的策略组名
 @returns {string[]}
*/
function buildCustomRules(availablePolicies) {
  if (!enableCustomRules) return [];

  const resolvePolicy = (policy) => {
    // Loon 内建策略（如 DIRECT）直接映射为 mihomo 内建策略
    const builtin = customRuleBuiltinPolicies[String(policy).toUpperCase()];
    if (builtin) return builtin;

    // Loon 策略名别名映射（全球加速 / 美国节点 / 新加坡节点）
    const mapped = customRulePolicyAlias[policy] || policy;
    if (availablePolicies.has(mapped)) return mapped;

    // 目标策略组未生成时，按回退链取第一个可用的组
    for (const fallback of customRuleFallbackPolicies) {
      if (availablePolicies.has(fallback)) return fallback;
    }
    return '默认代理';
  };

  const sources = [
    [customRuleSourceAirport, customRuleDefaultPolicies.airport],
    [customRuleSourceDirect, customRuleDefaultPolicies.direct],
    [customRuleSourceOutdoor, customRuleDefaultPolicies.outdoor],
    [customRuleSourceUnsure, customRuleDefaultPolicies.unsure],
  ];

  const seen = new Set();
  const rules = [];

  for (const [text, defaultPolicy] of sources) {
    for (const { key, rule } of parseCustomRules(text, defaultPolicy, resolvePolicy)) {
      if (seen.has(key)) continue;
      seen.add(key);
      rules.push(rule);
    }
  }

  return rules;
}

// 此处添加自定义节点，填入下方[]内（可选，留空则不生成“自建节点”策略组）
// 自定义节点不参与节点过滤与 hosts 改写；与订阅节点（标准化后）重名时自动添加“自建-”前缀
// 示例：
// const customizeProxies = [
//   {
//     name: '自建-日本-01',
//     type: 'vmess',
//     server: '5.6.7.8',
//     port: 443,
//     uuid: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
//     alterId: 0,
//     cipher: 'auto',
//     tls: true,
//     servername: 'example.com',
//     network: 'ws',
//     'ws-opts': {
//       path: '/path',
//       headers: { Host: 'example.com' },
//     },
//   },
// ];
const customizeProxies = [];

// 链式代理启用时，自定义节点的 dialer-proxy 引用目标
const dialerProxyName = '链式中转';

// 定义全局排除节点的正则表达式，用于排除非地区节点
const excludeFilter =
  /群|返利|循环|官网|客服|网站|网址|获取|订阅|流量|到期|机场|下次|版本|官址|备用|过期|已用|联系|邮箱|工单|贩卖|通知|倒卖|防止|国内|地址|频道|电报|无法|说明|使用|提示|访问|支持|教程|关注|更新|作者|加入|超时|收藏|优惠|福利|邀请|好友|失联|选择|剩余|公益|发布|DIZTNA|通路|登录|禁止|定时|渠道|牢记|永久|余额|阁下|本站|刷新|导航|建议|重置|以下|过滤|⚠️|@|t\.me\/+|\bexpire\b|\bhttps?:\/\/|\.com|\btraffic\b/iu;

// 屏蔽国外QUIC
const blockForeignQuic = [
  'AND,((NETWORK,UDP),(DST-PORT,443),(NOT,((OR,((RULE-SET,cn_additional),(RULE-SET,cn_ip,no-resolve)))))),REJECT',
];

// Cloudflare 官方 IPv4 段直连（来源：https://www.cloudflare.com/ips-v4）
// 供 CFST 等优选工具直连测速；全部带 no-resolve，浏览器访问 CF 站点仍按域名规则走代理
const cloudflareDirectRules = [
  'IP-CIDR,173.245.48.0/20,直连,no-resolve',
  'IP-CIDR,103.21.244.0/22,直连,no-resolve',
  'IP-CIDR,103.22.200.0/22,直连,no-resolve',
  'IP-CIDR,103.31.4.0/22,直连,no-resolve',
  'IP-CIDR,141.101.64.0/18,直连,no-resolve',
  'IP-CIDR,108.162.192.0/18,直连,no-resolve',
  'IP-CIDR,190.93.240.0/20,直连,no-resolve',
  'IP-CIDR,188.114.96.0/20,直连,no-resolve',
  'IP-CIDR,197.234.240.0/22,直连,no-resolve',
  'IP-CIDR,198.41.128.0/17,直连,no-resolve',
  'IP-CIDR,162.158.0.0/15,直连,no-resolve',
  'IP-CIDR,104.16.0.0/13,直连,no-resolve',
  'IP-CIDR,104.24.0.0/14,直连,no-resolve',
  'IP-CIDR,172.64.0.0/13,直连,no-resolve',
  'IP-CIDR,131.0.72.0/22,直连,no-resolve',
];

// 直连节点
const directProxies = [
  {
    name: '🇨🇳 直连 | 双栈',
    type: 'direct',
  },
  {
    name: '🇨🇳 直连 | IPv4优先',
    type: 'direct',
    'ip-version': 'ipv4-prefer',
  },
  {
    name: '🇨🇳 直连 | IPv6优先',
    type: 'direct',
    'ip-version': 'ipv6-prefer',
  },
  {
    name: '🇨🇳 直连 | 仅IPv4',
    type: 'direct',
    'ip-version': 'ipv4',
  },
  {
    name: '🇨🇳 直连 | 仅IPv6',
    type: 'direct',
    'ip-version': 'ipv6',
  },
];

// 定义地区策略组
const regionDefinitions = [
  {
    name: '香港',
    flag: '🇭🇰',
    regex: /🇭🇰|香港|(?<![A-Za-z])HKG?(?![A-Za-z])|hong\skong/i,
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Hong_Kong.png',
  },
  {
    name: '日本',
    flag: '🇯🇵',
    regex: /🇯🇵|日本|东京|大坂|京都|(?<![A-Za-z])JPN?(?![A-Za-z])|japan/i,
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Japan.png',
  },
  {
    name: '美国',
    flag: '🇺🇸',
    regex:
      /🇺🇸|美国|纽约|洛杉矶|旧金山|芝加哥|休斯顿|迈阿密|西雅图|波士顿|华盛顿|拉斯维加斯|圣何塞|圣地亚哥|(?<![A-Za-z])USA?(?![A-Za-z])|america|united\sstates/i,
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/United_States.png',
  },
  {
    name: '新加坡',
    flag: '🇸🇬',
    regex: /🇸🇬|新加坡|狮城|(?<![A-Za-z])SGP?(?![A-Za-z])|singapore/i,
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Singapore.png',
  },
  {
    name: '台湾省',
    flag: '🇹🇼',
    regex: /🇹🇼|台湾|台北|高雄|(?<![A-Za-z])TWN?(?![A-Za-z])|taiwan/i,
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Taiwan.png',
  },
];

// 定义倍率策略组
const lowRateRegionName = '低倍率节点';
const highRateRegionName = '高倍率节点';

const rateRegionDefinitions = [
  {
    name: lowRateRegionName,
    regex:
      /^(?!.(?:剩|期)).(?:(?<!\d)0\.[0-5]|(?<=[ [(|｜丨∣┃\-‐–—−－﹣])0[×✕✖⨯⨉x倍])|(?:(?<=[ [(|｜丨∣┃\-‐–—−－﹣])[×✕✖⨯⨉x]0(?=[ )\]]|倍|$))|^(?!.(?:客户端|软件)).下载|低倍|免费|(?<![A-Za-z])free(?![A-Za-z])/i,
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Available_1.png',
  },
  {
    name: highRateRegionName,
    regex:
      /(?<=[ [(|｜丨∣┃\-‐–—−－﹣])((?:[×✕✖⨯⨉x]\s?(?:[2-9]\d*|[1-9]\d+)(?:\.\d+)?)|(?:(?<![\d.])(?:[2-9]\d*|[1-9]\d+)(?:\.\d+)?\s*(?:倍|[*×✕✖⨯⨉x])))/i,
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Airport.png',
  },
];

// 全部策略组定义（地区 + 倍率），统一用于节点匹配与归类
const allRegionDefinitions = [...regionDefinitions, ...rateRegionDefinitions];

// Rule Providers 通用配置
const ruleProviderCommonDomain = {
  type: 'http',
  format: 'mrs',
  interval: 86400,
  behavior: 'domain',
};
const ruleProviderCommonIpcidr = {
  type: 'http',
  format: 'mrs',
  interval: 86400,
  behavior: 'ipcidr',
};

// 定义基础 Rule Providers
const baseRuleProviders = {
  // --- 直连规则集 ---

  private: {
    ...ruleProviderCommonDomain,
    url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/private.mrs',
    path: './ruleset/private.mrs',
    'path-in-bundle': 'geo/geosite/private.mrs',
  },
  private_ip: {
    ...ruleProviderCommonIpcidr,
    url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geoip/private.mrs',
    path: './ruleset/private_ip.mrs',
    'path-in-bundle': 'geo/geoip/private.mrs',
  },
  games_cn: {
    ...ruleProviderCommonDomain,
    url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/category-games@cn.mrs',
    path: './ruleset/category-games@cn.mrs',
    'path-in-bundle': 'geo/geosite/category-games@cn.mrs',
  },
  epicgames: {
    ...ruleProviderCommonDomain,
    url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/epicgames.mrs',
    path: './ruleset/epicgames.mrs',
    'path-in-bundle': 'geo/geosite/epicgames.mrs',
  },
  nvidia_cn: {
    ...ruleProviderCommonDomain,
    url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/nvidia@cn.mrs',
    path: './ruleset/nvidia@cn.mrs',
    'path-in-bundle': 'geo/geosite/nvidia@cn.mrs',
  },
  apple_cn: {
    ...ruleProviderCommonDomain,
    url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/apple@cn.mrs',
    path: './ruleset/apple@cn.mrs',
    'path-in-bundle': 'geo/geosite/apple@cn.mrs',
  },
  microsoft_cn: {
    ...ruleProviderCommonDomain,
    url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/microsoft@cn.mrs',
    path: './ruleset/microsoft@cn.mrs',
    'path-in-bundle': 'geo/geosite/microsoft@cn.mrs',
  },
  'geolocation-cn': {
    ...ruleProviderCommonDomain,
    url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/geolocation-cn.mrs',
    path: './ruleset/geolocation-cn.mrs',
    'path-in-bundle': 'geo/geosite/geolocation-cn.mrs',
  },
  cn_ip: {
    ...ruleProviderCommonIpcidr,
    url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geoip/cn.mrs',
    path: './ruleset/cn_ip.mrs',
    'path-in-bundle': 'geo/geoip/cn.mrs',
  },

  // --- 代理规则集 ---

  'geolocation-!cn': {
    ...ruleProviderCommonDomain,
    url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/geolocation-!cn.mrs',
    path: './ruleset/geolocation-!cn.mrs',
    'path-in-bundle': 'geo/geosite/geolocation-!cn.mrs',
  },

  // --- 其他规则集 ---

  fakeip_filter: {
    ...ruleProviderCommonDomain,
    url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/fakeip-filter.mrs',
    path: './ruleset/fakeip-filter.mrs',
    'path-in-bundle': 'geo/geosite/fakeip-filter.mrs',
  },
  cn_additional: {
    ...ruleProviderCommonDomain,
    url: 'https://static-file-global.353355.xyz/rules/cn-additional-list.mrs',
    path: './ruleset/cn-additional-list.mrs',
    'path-in-bundle': 'geo/geosite/cn.mrs',
  },
  cn: {
    ...ruleProviderCommonDomain,
    url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/cn.mrs',
    path: './ruleset/cn.mrs',
    'path-in-bundle': 'geo/geosite/cn.mrs',
  },
};

// 策略组公共配置
const groupBaseOption = {
  interval: 600,
  timeout: 3000,
  url: 'https://www.apple.com/library/test/success.html',
  lazy: true,
  'max-failed-times': 3,
  'empty-fallback': 'REJECT',
};

// select策略组通用配置
const selectBaseOption = {
  ...groupBaseOption,
  type: 'select',
};

// url-test策略组通用配置
const urlTestBaseOption = {
  ...groupBaseOption,
  type: 'url-test',
  tolerance: 50,
  'exclude-type': 'DIRECT',
  icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Auto.png',
  hidden: true,
};

// load-balance策略组通用配置
const loadBalanceBaseOption = {
  ...groupBaseOption,
  type: 'load-balance',
  strategy: 'sticky-sessions',
  'exclude-type': 'DIRECT',
  icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Round_Robin.png',
  hidden: true,
};

// 定义基础策略组
const baseGroups = [
  {
    name: '手动选择',
    baseOption: selectBaseOption,
    includeAll: true,
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Static.png',
  },
  {
    name: '自动选择',
    baseOption: urlTestBaseOption,
    includeAll: true,
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Auto.png',
  },
  {
    name: '负载均衡',
    baseOption: loadBalanceBaseOption,
    includeAll: true,
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Round_Robin.png',
  },
];

// 定义分流策略组配置
const serviceConfigs = [
  ...baseGroups,
  {
    name: 'FCM',
    baseOption: selectBaseOption,
    direct: true,
    defaultSelected: '直连',
    providers: {
      googlefcm: {
        ...ruleProviderCommonDomain,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/googlefcm.mrs',
        path: './ruleset/googlefcm.mrs',
        'path-in-bundle': 'geo/geosite/googlefcm.mrs',
      },
    },
    icon: 'https://fastly.jsdelivr.net/gh/MiToverG422/Qure@master/IconSet/Color/fcm.png',
    rules: ['RULE-SET,googlefcm,FCM'],
  },
  {
    name: 'YouTube',
    baseOption: selectBaseOption,
    providers: {
      youtube: {
        ...ruleProviderCommonDomain,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/youtube.mrs',
        path: './ruleset/youtube.mrs',
        'path-in-bundle': 'geo/geosite/youtube.mrs',
      },
    },
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/YouTube.png',
    rules: ['RULE-SET,youtube,YouTube'],
  },
  {
    name: 'Google',
    baseOption: selectBaseOption,
    providers: {
      google: {
        ...ruleProviderCommonDomain,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/google.mrs',
        path: './ruleset/google.mrs',
        'path-in-bundle': 'geo/geosite/google.mrs',
      },
      google_ip: {
        ...ruleProviderCommonIpcidr,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geoip/google.mrs',
        path: './ruleset/google_ip.mrs',
        'path-in-bundle': 'geo/geoip/google.mrs',
      },
    },
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Google_Search.png',
    rules: ['RULE-SET,google,Google', 'RULE-SET,google_ip,Google,no-resolve'],
  },
  {
    name: 'AI',
    baseOption: selectBaseOption,
    defaultSelected: '美国',
    providers: {
      ai: {
        ...ruleProviderCommonDomain,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/category-ai-!cn.mrs',
        path: './ruleset/ai.mrs',
        'path-in-bundle': 'geo/geosite/category-ai-!cn.mrs',
      },
    },
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/ChatGPT.png',
    rules: ['RULE-SET,ai,AI'],
  },
  {
    name: 'Microsoft',
    baseOption: selectBaseOption,
    direct: true,
    providers: {
      github: {
        ...ruleProviderCommonDomain,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/github.mrs',
        path: './ruleset/github.mrs',
        'path-in-bundle': 'geo/geosite/github.mrs',
      },
      microsoft: {
        ...ruleProviderCommonDomain,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/microsoft.mrs',
        path: './ruleset/microsoft.mrs',
        'path-in-bundle': 'geo/geosite/microsoft.mrs',
      },
      microsoft_ip: {
        ...ruleProviderCommonIpcidr,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geoip/microsoft.mrs',
        path: './ruleset/microsoft_ip.mrs',
        'path-in-bundle': 'geo/geoip/microsoft.mrs',
      },
    },
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Microsoft.png',
    rules: [
      'RULE-SET,github,默认代理',
      'RULE-SET,microsoft,Microsoft',
      'RULE-SET,microsoft_ip,Microsoft,no-resolve',
    ],
  },
  {
    name: 'Apple',
    baseOption: selectBaseOption,
    direct: true,
    providers: {
      apple: {
        ...ruleProviderCommonDomain,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/apple.mrs',
        path: './ruleset/apple.mrs',
        'path-in-bundle': 'geo/geosite/apple.mrs',
      },
      apple_ip: {
        ...ruleProviderCommonIpcidr,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geoip/apple.mrs',
        path: './ruleset/apple_ip.mrs',
        'path-in-bundle': 'geo/geoip/apple.mrs',
      },
    },
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Apple.png',
    rules: ['RULE-SET,apple,Apple', 'RULE-SET,apple_ip,Apple,no-resolve'],
  },
  {
    name: 'Telegram',
    baseOption: selectBaseOption,
    providers: {
      telegram: {
        ...ruleProviderCommonDomain,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/telegram.mrs',
        path: './ruleset/telegram.mrs',
        'path-in-bundle': 'geo/geosite/telegram.mrs',
      },
      telegram_ip: {
        ...ruleProviderCommonIpcidr,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geoip/telegram.mrs',
        path: './ruleset/telegram_ip.mrs',
        'path-in-bundle': 'geo/geoip/telegram.mrs',
      },
    },
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Telegram.png',
    rules: ['RULE-SET,telegram,Telegram', 'RULE-SET,telegram_ip,Telegram,no-resolve'],
  },
  {
    name: 'Steam',
    baseOption: selectBaseOption,
    direct: true,
    providers: {
      steam: {
        ...ruleProviderCommonDomain,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/steam.mrs',
        path: './ruleset/steam.mrs',
        'path-in-bundle': 'geo/geosite/steam.mrs',
      },
      steam_ip: {
        ...ruleProviderCommonIpcidr,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geoip/steam.mrs',
        path: './ruleset/steam_ip.mrs',
        'path-in-bundle': 'geo/geoip/steam.mrs',
      },
    },
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Steam.png',
    rules: ['RULE-SET,steam,Steam', 'RULE-SET,steam_ip,Steam,no-resolve'],
  },
  {
    name: 'TikTok',
    baseOption: selectBaseOption,
    defaultSelected: '日本',
    providers: {
      tiktok: {
        ...ruleProviderCommonDomain,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/tiktok.mrs',
        path: './ruleset/tiktok.mrs',
        'path-in-bundle': 'geo/geosite/tiktok.mrs',
      },
      tiktok_ip: {
        ...ruleProviderCommonIpcidr,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geoip/tiktok.mrs',
        path: './ruleset/tiktok_ip.mrs',
        'path-in-bundle': 'geo/geoip/tiktok.mrs',
      },
    },
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/TikTok.png',
    rules: ['RULE-SET,tiktok,TikTok', 'RULE-SET,tiktok_ip,TikTok,no-resolve'],
  },
  {
    name: 'Twitter',
    baseOption: selectBaseOption,
    providers: {
      twitter: {
        ...ruleProviderCommonDomain,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/twitter.mrs',
        path: './ruleset/twitter.mrs',
        'path-in-bundle': 'geo/geosite/twitter.mrs',
      },
      twitter_ip: {
        ...ruleProviderCommonIpcidr,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geoip/twitter.mrs',
        path: './ruleset/twitter_ip.mrs',
        'path-in-bundle': 'geo/geoip/twitter.mrs',
      },
    },
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Twitter.png',
    rules: ['RULE-SET,twitter,Twitter', 'RULE-SET,twitter_ip,Twitter,no-resolve'],
  },
  {
    name: 'Meta',
    baseOption: selectBaseOption,
    providers: {
      meta: {
        ...ruleProviderCommonDomain,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/meta.mrs',
        path: './ruleset/meta.mrs',
        'path-in-bundle': 'geo/geosite/meta.mrs',
      },
      facebook_ip: {
        ...ruleProviderCommonIpcidr,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geoip/facebook.mrs',
        path: './ruleset/facebook_ip.mrs',
        'path-in-bundle': 'geo/geoip/facebook.mrs',
      },
    },
    icon: 'https://fastly.jsdelivr.net/gh/lige47/QuanX-icon-rule@main/icon/04ProxySoft/meta.png',
    rules: ['RULE-SET,meta,Meta', 'RULE-SET,facebook_ip,Meta,no-resolve'],
  },
  {
    name: 'Line',
    baseOption: selectBaseOption,
    providers: {
      line: {
        ...ruleProviderCommonDomain,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/line.mrs',
        path: './ruleset/line.mrs',
        'path-in-bundle': 'geo/geosite/line.mrs',
      },
    },
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Line.png',
    rules: ['RULE-SET,line,Line'],
  },
  {
    name: 'Netflix',
    baseOption: selectBaseOption,
    providers: {
      netflix: {
        ...ruleProviderCommonDomain,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/netflix.mrs',
        path: './ruleset/netflix.mrs',
        'path-in-bundle': 'geo/geosite/netflix.mrs',
      },
      netflix_ip: {
        ...ruleProviderCommonIpcidr,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geoip/netflix.mrs',
        path: './ruleset/netflix_ip.mrs',
        'path-in-bundle': 'geo/geoip/netflix.mrs',
      },
    },
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Netflix.png',
    rules: ['RULE-SET,netflix,Netflix', 'RULE-SET,netflix_ip,Netflix,no-resolve'],
  },
  {
    name: 'Emby',
    baseOption: selectBaseOption,
    direct: true,
    providers: {
      emby: {
        ...ruleProviderCommonDomain,
        url: 'https://fastly.jsdelivr.net/gh/666OS/rules@release/mihomo/domain/Emby.mrs',
        path: './ruleset/emby.mrs',
        'path-in-bundle': 'geo/geosite/category-emby.mrs',
      },
      emos: {
        ...ruleProviderCommonDomain,
        url: 'https://fastly.jsdelivr.net/gh/binaryu/emos-proxy-rule@main/rules/emos-mihomo.mrs',
        path: './ruleset/emos.mrs',
        'path-in-bundle': 'geo/geosite/category-emby.mrs',
      },
    },
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Emby.png',
    rules: [
      'RULE-SET,emby,Emby',
      'RULE-SET,emos,Emby',
      'DOMAIN-SUFFIX,mb3admin.com,Emby',
      'DOMAIN-SUFFIX,nubebelle.com,Emby',
      'DOMAIN-KEYWORD,emby,Emby',
      'PROCESS-NAME,com.mb.android,Emby',
      'PROCESS-NAME,tv.emby.embyatv,Emby',
      'PROCESS-NAME,com.hush.yamby,Emby',
      'PROCESS-NAME,com.jellycine.app,Emby',
      'PROCESS-NAME,com.mountains.hills,Emby',
      'PROCESS-NAME,RodelPlayer.App.exe,Emby',
      'PROCESS-NAME,com.feifeiduck.capyplayer,Emby',
    ],
  },
  {
    name: 'PikPak',
    baseOption: selectBaseOption,
    direct: true,
    providers: {
      pikpak: {
        ...ruleProviderCommonDomain,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/pikpak.mrs',
        path: './ruleset/pikpak.mrs',
        'path-in-bundle': 'geo/geosite/pikpak.mrs',
      },
    },
    icon: 'https://fastly.jsdelivr.net/gh/lige47/QuanX-icon-rule@main/icon/03CNSoft/pikpak.png',
    rules: ['RULE-SET,pikpak,PikPak'],
  },
  {
    name: 'Spotify',
    baseOption: selectBaseOption,
    direct: true,
    providers: {
      spotify: {
        ...ruleProviderCommonDomain,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/spotify.mrs',
        path: './ruleset/spotify.mrs',
        'path-in-bundle': 'geo/geosite/spotify.mrs',
      },
      spotify_ip: {
        ...ruleProviderCommonIpcidr,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geoip/spotify.mrs',
        path: './ruleset/spotify_ip.mrs',
        'path-in-bundle': 'geo/geoip/spotify.mrs',
      },
    },
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Spotify.png',
    rules: ['RULE-SET,spotify,Spotify', 'RULE-SET,spotify_ip,Spotify,no-resolve'],
  },
  {
    name: 'Crypto',
    baseOption: selectBaseOption,
    defaultSelected: '日本',
    providers: {
      cryptocurrency: {
        ...ruleProviderCommonDomain,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/category-cryptocurrency.mrs',
        path: './ruleset/cryptocurrency.mrs',
        'path-in-bundle': 'geo/geosite/category-cryptocurrency.mrs',
      },
    },
    icon: 'https://fastly.jsdelivr.net/gh/lige47/QuanX-icon-rule@main/icon/04ProxySoft/Bitcoin.png',
    rules: ['RULE-SET,cryptocurrency,Crypto'],
  },
  {
    name: 'EHentai',
    baseOption: selectBaseOption,
    direct: true,
    defaultSelected: '美国',
    providers: {
      ehentai: {
        ...ruleProviderCommonDomain,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/ehentai.mrs',
        path: './ruleset/ehentai.mrs',
        'path-in-bundle': 'geo/geosite/ehentai.mrs',
      },
    },
    icon: 'https://fastly.jsdelivr.net/gh/lige47/QuanX-icon-rule@main/icon/04ProxySoft/exhentai.png',
    rules: ['RULE-SET,ehentai,EHentai'],
  },
  {
    name: 'AdBlock',
    baseOption: selectBaseOption,
    reject: true,
    providers: {
      adblockmihomolite: {
        ...ruleProviderCommonDomain,
        url: 'https://fastly.jsdelivr.net/gh/217heidai/adblockfilters@main/rules/adblockmihomolite.mrs',
        path: './ruleset/adblockmihomolite.mrs',
        'path-in-bundle': 'geo/geosite/category-ads-all.mrs',
      },
    },
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Advertising.png',
    rules: ['RULE-SET,adblockmihomolite,AdBlock'],
  },
];

// ---节点过滤、重命名及验证---

/**
节点匹配缓存，避免重复执行正则
*/
const regionMatchCache = new Map();
function getMatchedRegions(proxyName) {
  if (regionMatchCache.has(proxyName)) {
    return regionMatchCache.get(proxyName);
  }

  const regions = allRegionDefinitions.filter((region) => region.regex.test(proxyName));
  regionMatchCache.set(proxyName, regions);

  return regions;
}

/**
标准化节点名称：补全地区国旗、折叠多余空格，并预缓存匹配结果
*/
const flagRegex = /[\u{1F1E6}-\u{1F1FF}]{2}/u;
function normalizeProxyName(proxy) {
  const originalName = proxy.name;

  const flag = originalName.match(flagRegex)?.[0];

  const nameWithoutFlag = (flag ? originalName.replace(flag, '') : originalName)
    .replace(/\s+/g, ' ')
    .trim();

  const matchedRegions = getMatchedRegions(originalName);

  const regionFlag = flag || matchedRegions.find((region) => region.flag)?.flag;

  const normalizedName = regionFlag ? `${regionFlag} ${nameWithoutFlag}` : nameWithoutFlag;

  if (normalizedName !== originalName) {
    regionMatchCache.set(normalizedName, matchedRegions);
  }

  return normalizedName === originalName ? proxy : { ...proxy, name: normalizedName };
}

/**
修复 dialer-proxy 引用：目标被重命名则更新，被移除或不存在则删除引用
*/
function fixDialerProxy(proxy, renameMap, normalizedProxyNames) {
  const target = proxy['dialer-proxy'];
  if (!target) return proxy;

  if (renameMap.has(target)) {
    return { ...proxy, 'dialer-proxy': renameMap.get(target) };
  }

  if (normalizedProxyNames.has(target)) {
    return proxy;
  }

  const copy = { ...proxy };
  delete copy['dialer-proxy'];
  return copy;
}

/**
读取代理 IP 版本偏好：仅其中一个开关开启时返回对应偏好，
同时开启或同时关闭时返回 null（不应用任何偏好，节点保持原样）
*/
function getIpVersionPreference() {
  const ipv4PreferEnabled = ruleOptionsEnable.代理IPV4优先;
  const ipv6PreferEnabled = ruleOptionsEnable.代理IPV6优先;

  if (ipv4PreferEnabled && !ipv6PreferEnabled) return 'ipv4-prefer';
  if (ipv6PreferEnabled && !ipv4PreferEnabled) return 'ipv6-prefer';
  return null;
}

/**
过滤并标准化节点：剔除内置/信息节点、按配置过滤、去重、修复 dialer-proxy 引用，空列表时抛错
*/
function filterAndNormalizeProxies(config) {
  regionMatchCache.clear();

  const filterLowRateProxiesEnabled = ruleOptionsEnable.过滤低倍率节点;
  const filterHighRateProxiesEnabled = ruleOptionsEnable.过滤高倍率节点;
  const filterNonRegionProxiesEnabled = ruleOptionsEnable.过滤非地区节点;

  const lowRateRegex = filterLowRateProxiesEnabled
    ? rateRegionDefinitions.find((r) => r.name === lowRateRegionName)?.regex
    : null;
  const highRateRegex = filterHighRateProxiesEnabled
    ? rateRegionDefinitions.find((r) => r.name === highRateRegionName)?.regex
    : null;

  const originalProxies = config.proxies || [];

  const filteredRawProxies = originalProxies.filter((proxy) => {
    const type = String(proxy.type ?? '').toLowerCase();
    if (type === 'direct' || type === 'reject' || type === 'rematch') return false;

    if (lowRateRegex?.test(proxy.name) || highRateRegex?.test(proxy.name)) return false;

    if (!filterNonRegionProxiesEnabled) return true;

    const isRegionProxy = getMatchedRegions(proxy.name).some((region) =>
      regionDefinitions.includes(region),
    );

    return isRegionProxy || !excludeFilter.test(proxy.name);
  });

  const renameMap = new Map();
  const normalizedProxies = [];
  const uniqueNames = new Set();

  for (const rawProxy of filteredRawProxies) {
    const normalized = normalizeProxyName(rawProxy);
    if (normalized.name !== rawProxy.name) {
      renameMap.set(rawProxy.name, normalized.name);
    }
    if (!uniqueNames.has(normalized.name)) {
      uniqueNames.add(normalized.name);
      normalizedProxies.push(normalized);
    }
  }

  const normalizedProxyNames = new Set(normalizedProxies.map((p) => p.name));

  const filteredProxies = normalizedProxies.map((proxy) =>
    fixDialerProxy(proxy, renameMap, normalizedProxyNames),
  );

  if (!filteredProxies.length) {
    throw new Error('配置文件中未找到任何代理节点，请使用机场提供的配置文件进行覆写');
  }

  const ipVersionPreference = getIpVersionPreference();
  if (ipVersionPreference) {
    return filteredProxies.map((proxy) =>
      proxy['ip-version'] === ipVersionPreference
        ? proxy
        : { ...proxy, 'ip-version': ipVersionPreference },
    );
  }

  return filteredProxies;
}

// ---构建地区组和倍率组---

/**
构建地区策略组，可附带自动选择组
*/
function createRegionGroup(name, icon, proxies) {
  const generateRegionAutoSelectEnabled = ruleOptionsEnable.生成地区自动选择组;
  const hideManualSelectGroupEnabled = ruleOptionsEnable.隐藏地区手动选择组;

  if (generateRegionAutoSelectEnabled) {
    const urlTestName = `${name}-自动选择`;
    return [
      {
        ...urlTestBaseOption,
        name: urlTestName,
        proxies,
      },
      {
        ...selectBaseOption,
        name,
        icon,
        proxies: [...proxies, urlTestName],
        hidden: hideManualSelectGroupEnabled,
      },
    ];
  }
  return [
    {
      ...selectBaseOption,
      name,
      icon,
      proxies,
      hidden: hideManualSelectGroupEnabled,
    },
  ];
}

/**
将节点按地区/倍率归类，构建地区策略组、倍率策略组与“其他节点”组
*/
function buildRegionGroups(filteredProxies, customProxies) {
  const generateRateGroupEnabled = ruleOptionsEnable.生成倍率组;

  const regionGroups = Object.fromEntries(allRegionDefinitions.map(({ name }) => [name, []]));
  const otherProxies = [];

  for (const proxy of [...filteredProxies, ...customProxies]) {
    const matchedRegions = getMatchedRegions(proxy.name);
    const isRegionProxy = matchedRegions.some((region) => regionDefinitions.includes(region));

    for (const region of matchedRegions) {
      regionGroups[region.name].push(proxy.name);
    }

    if (!isRegionProxy) {
      otherProxies.push(proxy.name);
    }
  }

  const generatedRegionGroups = allRegionDefinitions
    .filter(
      (r) =>
        regionGroups[r.name].length > 0 &&
        (generateRateGroupEnabled || !rateRegionDefinitions.includes(r)),
    )
    .flatMap((r) => createRegionGroup(r.name, r.icon, regionGroups[r.name]));

  if (otherProxies.length > 0) {
    generatedRegionGroups.push(
      ...createRegionGroup(
        '其他节点',
        'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/World_Map.png',
        otherProxies,
      ),
    );
  }

  return generatedRegionGroups;
}

// ---构建自定义节点组---

/**
处理自定义节点：标准化名称、与订阅节点重名时添加“自建-”前缀、内部去重，
并构建“自建节点”策略组。
自定义节点不参与订阅节点过滤，也不参与 hosts 改写及 DNS 域名处理。
*/
function buildCustomizeGroups(filteredProxies, customizeList = customizeProxies) {
  const chainEnabled = ruleOptionsEnable.链式代理;

  if (!customizeList.length) {
    if (chainEnabled) {
      throw new Error('启用失败，请在脚本中添加自定义节点后尝试');
    }
    return { customProxies: [], customProxyNames: [], customGroup: null };
  }

  const usedNames = new Set(filteredProxies.map((p) => p.name));
  const customPrefix = '自建-';
  const customProxies = [];

  for (const proxy of customizeList) {
    const normalized = normalizeProxyName(proxy);
    let name = normalized.name;
    while (usedNames.has(name)) {
      name = normalizeProxyName({ name: `${customPrefix}${name}` }).name.replace(
        `${customPrefix} `,
        customPrefix,
      );
    }
    usedNames.add(name);

    let customProxy = name === normalized.name ? normalized : { ...normalized, name };
    if (chainEnabled && customProxy['dialer-proxy'] !== dialerProxyName) {
      customProxy = { ...customProxy, 'dialer-proxy': dialerProxyName };
    }
    customProxies.push(customProxy);
  }

  const customProxyNames = customProxies.map((p) => p.name);

  const customGroup = {
    ...selectBaseOption,
    name: chainEnabled ? '链式落地' : '自建节点',
    proxies: customProxyNames,
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Server.png',
  };

  return { customProxies, customProxyNames, customGroup };
}

// ---构建基础策略组和分流策略组---

/**
构建基础/分流策略组/部分节点组、GLOBAL 组与规则集，并汇总分流规则
*/
function buildFunctionalGroups(filteredProxies, generatedRegionGroups, customizeInfo) {
  const blockForeignQuicEnabled = ruleOptionsEnable.屏蔽国外QUIC;
  const addAllNodesToServiceGroupsEnabled = ruleOptionsEnable.分流组添加所有节点;
  const chainEnabled = ruleOptionsEnable.链式代理;
  const hideManualSelectGroupEnabled = ruleOptionsEnable.隐藏地区手动选择组;

  const functionalGroups = [];
  const functionalRules = [];
  const finalRuleProviders = { ...baseRuleProviders };

  if (!blockForeignQuicEnabled) {
    delete finalRuleProviders.cn_additional;
  }

  const { customProxyNames = [], customGroup = null } = customizeInfo || {};
  const filteredProxyNames = filteredProxies.map((p) => p.name);
  const allProxiesNames = [...customProxyNames, ...filteredProxyNames];
  const groupNamesOfSelect = generatedRegionGroups
    .filter((g) => g.type === 'select')
    .map((g) => g.name);
  const baseGroupNames = baseGroups.filter((g) => ruleOptionsEnable[g.name]).map((g) => g.name);
  const customGroupNames = customGroup ? [customGroup.name] : [];

  // 自定义规则可引用的策略组：固定组 + 已启用基组 + 地区组 + 自建节点组 + 已启用的服务组
  const serviceGroupNames = serviceConfigs
    .filter((svc) => ruleOptionsEnable[svc.name])
    .map((svc) => svc.name);
  const availablePolicies = new Set([
    '默认代理',
    '漏网之鱼',
    '直连',
    ...baseGroupNames,
    ...groupNamesOfSelect,
    ...customGroupNames,
    ...serviceGroupNames,
  ]);
  const customRules = buildCustomRules(availablePolicies);

  functionalGroups.push({
    ...selectBaseOption,
    name: '默认代理',
    proxies: [...groupNamesOfSelect, ...baseGroupNames, ...customGroupNames],
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Proxy.png',
  });

  const orderedServiceConfigs = [
    ...serviceConfigs.filter((svc) => svc.name === 'AdBlock'),
    ...serviceConfigs.filter((svc) => svc.name !== 'AdBlock'),
  ];
  // 自定义规则紧跟 AdBlock 之后，优先于内置分流规则集
  let customRulesInjected = false;
  for (const svc of orderedServiceConfigs) {
    if (!ruleOptionsEnable[svc.name]) continue;

    functionalRules.push(...(svc.rules || []));
    Object.assign(finalRuleProviders, svc.providers || {});

    if (svc.name === 'AdBlock') {
      functionalRules.push(...customRules);
      customRulesInjected = true;
    }
  }
  // AdBlock 未启用时，自定义规则置于最前
  if (!customRulesInjected) functionalRules.unshift(...customRules);

  for (const svc of serviceConfigs) {
    if (!ruleOptionsEnable[svc.name]) continue;

    let groupProxies = [];
    if (svc.includeAll) {
      groupProxies = [...allProxiesNames];
    } else if (svc.reject) {
      groupProxies = ['REJECT', 'REJECT-DROP', 'PASS'];
    } else {
      // 所有非 AdBlock 的分流组都默认追加「直连」选项
      groupProxies = !addAllNodesToServiceGroupsEnabled
        ? ['默认代理', ...customGroupNames, ...baseGroupNames, ...groupNamesOfSelect, '直连']
        : [
            '默认代理',
            ...customGroupNames,
            ...baseGroupNames,
            ...groupNamesOfSelect,
            ...allProxiesNames,
            '直连',
          ];
    }

    functionalGroups.push({
      ...svc.baseOption,
      name: svc.name,
      icon: svc.icon,
      proxies: groupProxies,
      ...(svc.defaultSelected !== undefined && {
        'default-selected': svc.defaultSelected,
      }),
    });
  }

  functionalGroups.push({
    ...selectBaseOption,
    name: '漏网之鱼',
    proxies: ['默认代理', '直连', ...groupNamesOfSelect],
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Stack.png',
  });

  if (customGroup) {
    functionalGroups.push(customGroup);
  }

  const chainGroup =
    chainEnabled && customGroup
      ? {
          ...selectBaseOption,
          name: dialerProxyName,
          proxies: filteredProxyNames,
          icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Bypass.png',
        }
      : null;

  const directGroup = {
    ...selectBaseOption,
    name: '直连',
    proxies: [...directProxies.map((p) => p.name)],
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/China.png',
    hidden: hideManualSelectGroupEnabled,
  };

  const globalGroup = {
    ...selectBaseOption,
    name: 'GLOBAL',
    proxies: [
      ...functionalGroups.map((g) => g.name),
      ...(chainGroup ? [chainGroup.name] : []),
      directGroup.name,
      ...generatedRegionGroups.map((g) => g.name),
    ],
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Global.png',
  };

  return {
    globalGroup,
    functionalGroups,
    functionalRules,
    finalRuleProviders,
    chainGroup,
    directGroup,
  };
}

// ---dns和hosts相关处理---

// 常见的公共 DNS，用于过滤订阅中的公共 DNS
const commonDnsList = [
  // IPv4（国内）
  '223.5.5.5',
  '223.6.6.6',
  '119.29.29.29',
  '1.12.12.12',
  '120.53.53.53',
  '114.114.114.114',
  '180.76.76.76',
  '1.2.4.8',
  '116.116.116.116',
  '101.226.4.6',
  '123.125.81.6',
  '180.184.1.1',
  '180.184.2.2',

  // IPv6（国内）
  '2400:3200::1',
  '2400:3200:baba::1',
  '2402:4e00::',
  '2400:da00::6666',

  // IPv4（国外）
  '1.1.1.1',
  '1.0.0.1',
  '8.8.8.8',
  '8.8.4.4',
  '9.9.9.9',
  '149.112.112.112',
  '208.67.222.222',
  '208.67.220.220',
  '94.140.14.14',
  '94.140.15.15',
  '76.76.2.0',
  '76.76.10.0',
  '185.228.168.9',
  '185.228.169.9',
  '77.88.8.8',
  '77.88.8.1',
  '156.154.70.1',
  '156.154.71.1',

  // IPv6（国外）
  '2606:4700:4700::1111',
  '2606:4700:4700::1001',
  '2001:4860:4860::8888',
  '2001:4860:4860::8844',
  '2620:fe::fe',
  '2620:fe::9',
  '2620:119:35::35',
  '2620:119:53::53',
  '2a10:50c0::bad1:ff',
  '2a10:50c0::bad2:ff',
  '2a10:50c0::ad1:ff',
  '2a10:50c0::ad2:ff',
  '2a0d:2a00:1::2',
  '2a0d:2a00:2::2',
  '2a02:6b8::feed:0ff',
  '2a02:6b8:0:1::feed:0ff',
  '2610:a1:1018::1',
  '2610:a1:1019::1',

  // 关键词（国内）
  'alidns',
  'doh.pub',
  'dot.pub',
  'dns.pub',
  'dnspod',
  'dns.baidu',

  // 关键词（国外）
  'dns.google',
  'dns.cloudflare',
  'dns.apple',
  'cloudflare-dns',
  'quad9',
  'opendns',
  'nextdns',
  'adguard',
  'one.one.one.one',
];

// 预编译公共 DNS 正则
const commonDnsRegex = new RegExp(
  commonDnsList.map((dns) => dns.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
  'i',
);

// 国内外 DNS 定义
const chinaDNS = ['223.5.5.5#DIRECT', '119.29.29.29#DIRECT'];
const foreignDNS = [
  'https://cloudflare-dns.com/dns-query#默认代理',
  'https://dns.google/dns-query#默认代理',
];
const defaultDNS = [
  '114.114.114.114#DIRECT',
  'tls://223.5.5.5#DIRECT',
  'https://1.12.12.12/dns-query#DIRECT',
];
const proxyServerDNS = [
  '114.114.114.114#DIRECT',
  'tls://223.5.5.5#DIRECT',
  'https://doh.pub/dns-query#DIRECT',
];

/**
hosts 匹配优先级：精确 > +. > . > *（同级按出现顺序）
*/
function hostSpecificity(pattern) {
  if (pattern.startsWith('+.')) return 2;
  if (pattern.startsWith('.')) return 1;
  if (pattern.includes('*')) return 0;
  return 3;
}

/**
判断域名规则（精确/通配）是否匹配节点域名集合，忽略大小写
*/
function matchDomainPattern(pattern, domains) {
  pattern = pattern.toLowerCase();

  // 精确匹配
  if (!pattern.includes('*') && !pattern.startsWith('+.') && !pattern.startsWith('.')) {
    return typeof domains === 'string'
      ? domains.toLowerCase() === pattern
      : [...domains].some((d) => d.toLowerCase() === pattern);
  }

  const domainList =
    typeof domains === 'string' ? [domains.toLowerCase()] : [...domains].map((d) => d.toLowerCase());

  // +.example.com
  if (pattern.startsWith('+.')) {
    const suffix = pattern.slice(2);
    return domainList.some(
      (domain) => domain === suffix || domain.endsWith(`.${suffix}`),
    );
  }

  // .example.com
  if (pattern.startsWith('.')) {
    const suffix = pattern.slice(1);
    return domainList.some(
      (domain) => domain !== suffix && domain.endsWith(`.${suffix}`),
    );
  }

  // *.example.com、example.*.com 等
  const patternParts = pattern.split('.');
  return domainList.some((domain) => {
    const domainParts = domain.split('.');
    return (
      patternParts.length === domainParts.length &&
      patternParts.every((part, index) => part === '*' || part === domainParts[index])
    );
  });
}

/**
根据订阅 hosts 映射改写节点 server，改写后无需再复制 hosts 进新配置。
支持链式映射（如 a: b、b: c 时节点 a 改写为 c）；
回环映射（a: b、b: a）由内核校验拒绝，此处仅以已访问集合防御性终止
*/
function applyHostsToProxies(proxies, hosts) {
  if (!hosts || typeof hosts !== 'object') return proxies;

  const hostEntries = Object.entries(hosts)
    .filter(
      ([, value]) =>
        (typeof value === 'string' && value.length > 0) ||
        (Array.isArray(value) && value.length > 0),
    )
    .sort((a, b) => hostSpecificity(b[0]) - hostSpecificity(a[0]));

  if (hostEntries.length === 0) return proxies;

  const targetOf = (value) => {
    if (Array.isArray(value)) value = value.find((v) => typeof v === 'string' && v.length > 0);
    return typeof value === 'string' && value.length > 0 ? value : null;
  };

  const resolveCache = new Map();
  const resolve = (server) => {
    const cached = resolveCache.get(server);
    if (cached !== undefined) return cached;

    const seen = new Set();
    let current = server.toLowerCase();
    let result = server;
    while (!seen.has(current)) {
      seen.add(current);
      const entry = hostEntries.find(([pattern]) => matchDomainPattern(pattern, current));
      const target = entry && targetOf(entry[1]);
      if (!target) break;
      result = target;
      current = target.toLowerCase();
    }
    resolveCache.set(server, result);
    return result;
  };

  return proxies.map((proxy) => {
    if (typeof proxy.server !== 'string') return proxy;
    const server = resolve(proxy.server);
    return server === proxy.server ? proxy : { ...proxy, server };
  });
}

/**
剥离 DNS 地址的 # 策略组后缀；
参数包含 direct 或 直连 时，强制改为 #DIRECT
*/
function stripDnsSuffix(dns) {
  const str = String(dns);
  const hashIndex = str.indexOf('#');
  if (hashIndex === -1) return str;

  const prefix = str.slice(0, hashIndex).trim();

  const suffix = str
    .slice(hashIndex + 1)
    .toLowerCase()
    .trim();

  if (suffix.includes('direct') || suffix.includes('直连')) return prefix + '#DIRECT';

  return prefix;
}

/**
判断节点 server 是否为 IP 地址（IPv4 / IPv6），用于从节点域名集合中排除 IP 类型的 server
*/
function isIpAddress(server) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(server) || server.includes(':');
}

/**
简化节点域名策略：将相同 DNS 的节点域名按后缀归类，至少三段的域名可合并为 +. 后缀形式
*/
function simplifyDomainPolicy(policy) {
  const groups = new Map();

  for (const [domain, dns] of Object.entries(policy)) {
    const dnsKey = JSON.stringify(Array.isArray(dns) ? [...dns].sort() : dns);

    if (domain.startsWith('+.') || domain.startsWith('.') || domain.includes('*')) {
      groups.set(`keep:${domain}`, [{ domain, dns, dnsKey }]);
      continue;
    }

    const parts = domain.split('.');

    if (parts.length < 3) {
      groups.set(`keep:${domain}`, [{ domain, dns, dnsKey }]);
      continue;
    }

    const suffix = parts.slice(-2).join('.');

    if (!groups.has(suffix)) {
      groups.set(suffix, []);
    }

    groups.get(suffix).push({ domain, dns, dnsKey });
  }

  const result = {};

  for (const [suffix, domains] of groups) {
    const firstDnsKey = domains[0].dnsKey;
    const sameDns = domains.every(({ dnsKey }) => dnsKey === firstDnsKey);

    if (domains.length >= 2 && sameDns) {
      result[`+.${suffix}`] = domains[0].dns;
    } else {
      for (const { domain, dns } of domains) {
        result[domain] = dns;
      }
    }
  }

  return result;
}

/**
构建 DNS 与 hosts：保留私有 DNS、节点域名 policy/fake-ip-filter，并按 hosts 改写节点 server
hosts改写条件（满足任意一个条件即可）：
proxy-server-nameserver 有且仅有一个 DNS 并且该 DNS 包含非空的 listen 值
proxy-server-nameserver 有且仅有一个 DNS 并且该 DNS 包含 127.0.0.1 并且 listen 包含 0.0.0.0
*/
function buildDnsAndHostsConfig(config, filteredProxies) {
  const originalDnsConfig = config.dns || {};

  const proxyServerNameservers = originalDnsConfig['proxy-server-nameserver'] || [];
  const listenValue = originalDnsConfig['listen'];

  const shouldRewriteByHosts =
    proxyServerNameservers.length === 1 &&
    typeof listenValue === 'string' &&
    listenValue.length > 0 &&
    (proxyServerNameservers.some((dns) =>
      String(dns).toLowerCase().includes(listenValue.toLowerCase()),
    ) ||
      (listenValue.includes('0.0.0.0') &&
        proxyServerNameservers.some((dns) =>
          String(dns).toLowerCase().includes('127.0.0.1'),
        )));

  const mappedProxies = shouldRewriteByHosts
    ? applyHostsToProxies(filteredProxies, config.hosts)
    : filteredProxies;

  const proxyDomains = new Set(
    mappedProxies
      .filter((proxy) => typeof proxy.server === 'string')
      .map((proxy) => proxy.server.toLowerCase())
      .filter((server) => !isIpAddress(server)),
  );

  const privateProxyServerNameservers = shouldRewriteByHosts ? [] : proxyServerNameservers;

  const isCommonDns = (dns) => {
    const value = String(dns).trim().toLowerCase();
    if (value === 'system' || value === 'system://') return true;

    return commonDnsRegex.test(value);
  };

  const privateDNS = [
    ...new Set(
      [...(originalDnsConfig['nameserver'] || []), ...privateProxyServerNameservers]
        .map(stripDnsSuffix)
        .filter((dns) => dns.length > 0 && !isCommonDns(dns)),
    ),
  ];

  const matchedProxyPolicy = {};
  for (const [domain, dns] of Object.entries({
    ...originalDnsConfig['nameserver-policy'],
    ...originalDnsConfig['proxy-server-nameserver-policy'],
  })) {
    if (!matchDomainPattern(domain, proxyDomains)) continue;

    const stripedDns = Array.isArray(dns)
      ? dns.map(stripDnsSuffix).filter((d) => d.length > 0)
      : stripDnsSuffix(dns);
    if (Array.isArray(stripedDns) && stripedDns.length === 0) continue;

    matchedProxyPolicy[domain] = stripedDns;
  }

  if (privateDNS.length > 0 && Object.keys(matchedProxyPolicy).length === 0) {
    for (const domain of proxyDomains) {
      matchedProxyPolicy[domain] = privateDNS;
    }
  }

  const matchedPolicyDomains = Object.keys(matchedProxyPolicy);
  const proxyServerPolicy =
    proxyDomains.size === matchedPolicyDomains.length &&
    matchedPolicyDomains.every((domain) => proxyDomains.has(domain.toLowerCase()))
      ? simplifyDomainPolicy(matchedProxyPolicy)
      : matchedProxyPolicy;

  const originalFakeIpFilter = originalDnsConfig['fake-ip-filter'] || [];
  const proxyFakeIpFilter = originalFakeIpFilter.filter((pattern) => {
    const p = String(pattern);
    return matchDomainPattern(p, proxyDomains);
  });

  const dns = {
    enable: true,
    ipv6: true,
    'use-hosts': true,
    'cache-algorithm': 'arc',
    'use-system-hosts': true,
    'enhanced-mode': 'fake-ip',
    'fake-ip-range': '198.18.0.1/15',
    'fake-ip-range6': '2001:2::1/48',
    'fake-ip-filter': [
      'rule-set:private',
      'rule-set:fakeip_filter',
      'rule-set:geolocation-cn',
      ...(ruleOptionsEnable['FCM'] ? ['rule-set:googlefcm'] : []),
      ...proxyFakeIpFilter,
    ],
    'default-nameserver': defaultDNS,
    'proxy-server-nameserver': proxyServerDNS,
    ...(Object.keys(proxyServerPolicy).length > 0 && {
      'proxy-server-nameserver-policy': proxyServerPolicy,
    }),
    nameserver: foreignDNS,
    'nameserver-policy': {
      'rule-set:cn': chinaDNS,
    },
    'direct-nameserver': chinaDNS,
  };

  const hosts = {
    'doh.pub': ['1.12.12.12', '120.53.53.53'],
    'cloudflare-dns.com': ['1.1.1.1', '1.0.0.1'],
    'dns.google': ['8.8.8.8', '8.8.4.4'],

    // 解决谷歌商店无法下载的问题
    'services.googleapis.cn': 'services.googleapis.com',

    // 屏蔽哔哩哔哩PCDN，解决访问视频/直播卡顿问题
    '+.mcdn.bilivideo.com': ['0.0.0.0'],
    '+.mcdn.bilivideo.cn': ['0.0.0.0'],
    '+.edge.mountaintoys.cn': ['0.0.0.0'],
    '+.h2.smtcdns.net': ['0.0.0.0'],
  };

  return { dns, hosts, proxies: mappedProxies };
}

// --- 主入口 ---

/**
主入口：覆写机场订阅配置，生成完整 mihomo 配置
*/
function main(config) {
  if (config['proxy-providers'] && Object.keys(config['proxy-providers']).length > 0) {
    throw new Error('配置文件中包含 proxy-providers，请使用机场提供的配置文件进行覆写');
  }

  const newConfig = {};

  const filteredProxies = filterAndNormalizeProxies(config);

  const { customProxies, customProxyNames, customGroup } = buildCustomizeGroups(filteredProxies);

  const generatedRegionGroups = buildRegionGroups(filteredProxies, customProxies);

  const {
    globalGroup,
    functionalGroups,
    functionalRules,
    finalRuleProviders,
    chainGroup,
    directGroup,
  } = buildFunctionalGroups(filteredProxies, generatedRegionGroups, {
    customProxyNames,
    customGroup,
  });

  const { dns, hosts, proxies: mappedProxies } = buildDnsAndHostsConfig(config, filteredProxies);

  newConfig['dns'] = dns;
  newConfig['hosts'] = hosts;
  newConfig['mixed-port'] = 7890;
  newConfig['allow-lan'] = true;
  newConfig['ipv6'] = true;
  newConfig['mode'] = 'rule';
  newConfig['log-level'] = 'info';
  newConfig['bind-address'] = '*';
  newConfig['unified-delay'] = true;
  newConfig['tcp-concurrent'] = true;
  newConfig['keep-alive-interval'] = 60;
  newConfig['find-process-mode'] = 'strict';

  newConfig['external-controller'] = '127.0.0.1:9090';
  newConfig['external-ui'] = 'ui';
  newConfig['external-ui-url'] =
    'https://github.com/Zephyruso/zashboard/releases/latest/download/dist.zip';

  newConfig['profile'] = {
    'store-selected': true,
    'store-fake-ip': true,
  };

  newConfig['ntp'] = {
    enable: true,
    'write-to-system': false,
    server: 'ntp.aliyun.com',
    port: 123,
    interval: 60,
  };

  newConfig['tun'] = {
    enable: true,
    stack: 'mixed',
    'auto-route': true,
    'strict-route': true,
    'auto-redirect': true,
    'auto-detect-interface': true,
    'dns-hijack': ['any:53', 'tcp://any:53'],
  };

  newConfig['proxies'] = [...customProxies, ...mappedProxies, ...directProxies];
  newConfig['proxy-groups'] = [
    globalGroup,
    ...functionalGroups,
    ...(chainGroup ? [chainGroup] : []),
    directGroup,
    ...generatedRegionGroups,
  ];
  newConfig['rule-providers'] = finalRuleProviders;

  newConfig['rules'] = [
    ...prefixRules,
    ...(ruleOptionsEnable.屏蔽国外QUIC ? blockForeignQuic : []),
    ...functionalRules,

    // 兜底规则
    // Cloudflare 官方 IPv4 段直连（CFST 优选测速），放在 geolocation-!cn 之前
    ...cloudflareDirectRules,
    'RULE-SET,geolocation-!cn,默认代理',
    'RULE-SET,cn_ip,直连',
    'RULE-SET,private_ip,直连',
    'MATCH,漏网之鱼',
  ];

  return newConfig;
}
