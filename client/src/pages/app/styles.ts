// Scoped styles using Sato's palette (defined in index.css :root).
export const shellStyles = `
.sato-shell{min-height:100vh;background:var(--paper);color:var(--ink);font-family:var(--sans);position:relative;display:flex;flex-direction:column;overflow-x:clip;}
.sato-shell *{box-sizing:border-box;}

/* Auth (disconnected) — split sign-in */
.sato-shell.auth-pass{display:flex;flex-direction:column;height:100vh;height:100svh;overflow:hidden;background:var(--paper);color:var(--ink);font-family:var(--sans);}

/* Testnet pass sign-in — one object, minimal copy */
.pass-nav{display:flex;align-items:center;justify-content:space-between;max-width:1200px;width:100%;margin:0 auto;padding:22px clamp(20px,4vw,44px);flex:0 0 auto;}
.pass-nav .auth-brand{display:flex;align-items:center;gap:9px;}
.pass-nav .auth-brand .brand-name{font-size:18px;}
.pass-back{display:inline-flex;align-items:center;gap:5px;font-size:13px;font-weight:700;color:var(--text-muted);transition:color .15s ease,transform .18s var(--ease);}
.pass-back:hover{color:var(--ink);transform:translateY(-1px);}
.pass-main{width:100%;max-width:640px;margin:0 auto;padding:0 clamp(20px,4vw,44px);display:flex;flex:1 1 auto;min-height:0;flex-direction:column;align-items:center;justify-content:center;text-align:center;}
.pass-title{font-size:clamp(44px,min(11vw,9svh),88px);line-height:.96;letter-spacing:-.055em;font-weight:800;margin:0;}
.pass-lede{color:var(--text-muted);font-size:15px;margin:14px 0 0;}
.pass-aurora{position:absolute;inset:0;overflow:hidden;pointer-events:none;}
.pa{position:absolute;border-radius:50%;filter:blur(90px);}
.pa.a1{width:55vmax;height:55vmax;background:rgba(246,195,154,.4);top:-18vmax;right:-14vmax;animation:pa-drift 26s ease-in-out infinite alternate;}
.pa.a2{width:50vmax;height:50vmax;background:rgba(185,205,242,.4);bottom:-20vmax;left:-16vmax;animation:pa-drift 32s ease-in-out infinite alternate-reverse;}
@keyframes pa-drift{from{translate:-6vmax 2vmax;}to{translate:6vmax -3vmax;}}
.pass-noise{position:absolute;inset:0;pointer-events:none;opacity:.05;background-image:url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2"/></filter><rect width="160" height="160" filter="url(%23n)" opacity="0.6"/></svg>');}
.pass-nav,.pass-main,.pass-foot{position:relative;z-index:1;}
.pass-tilt{margin-top:30px;width:min(100%,380px);perspective:1200px;cursor:grab;touch-action:none;}
.pass-tilt:active{cursor:grabbing;}
.pass-spin{animation:pass-float 7s ease-in-out infinite;}
@keyframes pass-float{0%,100%{transform:translateY(0);}50%{transform:translateY(-8px);}}
.pass-flip{position:relative;transform-style:preserve-3d;will-change:transform;}
.pass-flip::before{content:"";position:absolute;inset:8px 2px;border-radius:18px;background:linear-gradient(180deg,#2b313c,#0b0e14);transform:translateZ(-13px);}
.pass-face{position:relative;overflow:hidden;background:linear-gradient(150deg,#161d29 0%,#0d1117 60%,#1a1410 100%);border-radius:22px;padding:26px;text-align:left;color:#fff;box-shadow:0 30px 70px rgba(13,17,23,.28);backface-visibility:hidden;-webkit-backface-visibility:hidden;}
.pass-face.front::after{content:"";position:absolute;inset:0;border-radius:inherit;background:radial-gradient(420px circle at var(--gx,70%) var(--gy,10%),rgba(255,255,255,.14),transparent 60%);pointer-events:none;}
.pass-face.back{position:absolute;inset:0;transform:rotateY(180deg);display:flex;flex-direction:column;}
.pass-sheen{position:absolute;top:-20%;bottom:-20%;left:0;width:45%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.16),transparent);transform:translateX(-160%) skewX(-12deg);animation:pass-sheen 7s ease-in-out infinite;pointer-events:none;}
@keyframes pass-sheen{0%{transform:translateX(-160%) skewX(-12deg);}22%{transform:translateX(380%) skewX(-12deg);}100%{transform:translateX(380%) skewX(-12deg);}}
.pass-stripe{height:46px;background:#000;margin:2px -26px 0;}
.pass-back-note{font-size:12.5px;line-height:1.6;color:#8d9aaa;margin:auto 0 0;}
.pass-word.small{font-size:20px;margin-top:8px;}
.pass-hint{margin-top:16px;font-size:11.5px;font-weight:700;color:var(--muted);}
.pass-row{display:flex;align-items:center;justify-content:space-between;}
.pass-micro{font-size:10.5px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#8d9aaa;}
.pass-status{display:inline-flex;align-items:center;gap:7px;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#a8e7c4;}
.pass-status i{width:7px;height:7px;border-radius:50%;background:#a8e7c4;animation:tx-pulse 1.6s ease-in-out infinite;}
.pass-chip{width:52px;height:38px;border-radius:8px;background:linear-gradient(135deg,#f15a24,#ff8d66);margin:34px 0;box-shadow:inset 0 0 0 1px rgba(255,255,255,.25);}
.pass-bottom{margin-top:8px;}
.pass-holder{font-size:13px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:#8d9aaa;}
.pass-word{font-size:26px;font-weight:800;letter-spacing:-.05em;color:#fff;}
.pass-connect{width:min(100%,380px);margin-top:26px;box-shadow:0 14px 30px rgba(13,17,23,.22);}
.pass-micro2{font-size:12.5px;font-weight:600;color:var(--muted);margin:14px 0 0;}
.pass-foot{flex:0 0 auto;text-align:center;font-size:11.5px;color:var(--muted);padding:0 20px 20px;}
.sky-line{display:block;overflow:hidden;padding-bottom:.09em;margin-bottom:-.09em;}
.sky-line>span{display:block;animation:sky-rise .9s var(--ease) both;}
.sky-line:nth-child(2)>span{animation-delay:.1s;}
@keyframes sky-rise{from{transform:translateY(112%);}}

/* Brand panel */

/* ---- sky: the landing hero, carried into the app ---- */
.sky{position:absolute;top:0;left:0;right:0;height:660px;z-index:0;overflow:hidden;pointer-events:none;background:linear-gradient(180deg,#5d8fd6 0%,#7ba9e3 26%,#a9c9f0 52%,#d9e9fb 76%,#f5f4ef 100%);}
.cloud{position:absolute;background:transparent;filter:blur(14px);opacity:.85;}
.cloud::before,.cloud::after{content:"";position:absolute;background:#fff;border-radius:999px;}
.cloud::before{inset:0;}
.cloud::after{left:22%;top:-34%;width:44%;height:120%;}
.cloud.c1{width:340px;height:70px;top:6%;right:38%;animation:cloud-drift 26s ease-in-out infinite alternate;}
.cloud.c2{width:460px;height:84px;top:2%;right:-80px;animation:cloud-drift 32s ease-in-out infinite alternate-reverse;}
.cloud.c3{width:260px;height:56px;top:34%;left:56%;opacity:.7;animation:cloud-drift 22s ease-in-out infinite alternate;}
.cloud.c4{width:380px;height:66px;top:18%;right:5%;opacity:.6;animation:cloud-drift 28s ease-in-out infinite alternate-reverse;}
.cloud.c5{width:520px;height:90px;top:52%;left:52%;transform:translateX(-50%);opacity:.45;}
.sky-mist{position:absolute;left:0;right:0;bottom:0;height:260px;background:linear-gradient(180deg,transparent,rgba(245,244,239,.6) 55%,var(--paper) 100%);}
@keyframes cloud-drift{from{translate:-24px 0;}to{translate:30px -8px;}}

/* ---- floating pill nav ---- */
.appnav{position:fixed;top:max(14px,env(safe-area-inset-top));left:0;right:0;z-index:50;display:flex;align-items:center;gap:8px;width:min(1180px,calc(100% - 40px));height:64px;margin:0 auto;padding:6px 8px 6px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.55);background:rgba(255,255,255,.62);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);box-shadow:0 18px 50px rgba(40,70,130,.2);}
.appnav-brand{display:flex;align-items:center;gap:9px;padding:0 16px 0 4px;border-right:1px solid rgba(13,17,23,.1);color:var(--ink);text-decoration:none;flex-shrink:0;}
.appnav-mark{width:32px;height:32px;border-radius:10px;overflow:hidden;background:#000;display:grid;place-items:center;flex-shrink:0;}
.appnav-mark img{width:100%;height:100%;object-fit:cover;display:block;}
.appnav-brand strong{font-size:17px;font-weight:800;letter-spacing:-.04em;}
.appnav-links{display:flex;align-items:center;gap:2px;flex:1;justify-content:center;min-width:0;overflow:hidden;}
.appnav-link{border:0;background:transparent;color:#3d4652;font-size:13.5px;font-weight:700;font-family:var(--sans);padding:10px 14px;border-radius:999px;cursor:pointer;transition:background .18s ease,color .18s ease;white-space:nowrap;}
.appnav-link:hover{background:rgba(13,17,23,.06);color:var(--ink);}
.appnav-link.active{background:var(--ink);color:#fff;}
.appnav-right{display:flex;align-items:center;gap:6px;flex-shrink:0;}
.appnav-pool{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);background:#fff;color:var(--ink);font-family:var(--sans);font-size:12.5px;font-weight:800;font-variant-numeric:tabular-nums;padding:9px 13px;border-radius:999px;cursor:pointer;transition:border-color .18s ease,transform .18s var(--ease);}
.appnav-pool svg{color:var(--orange);}
.appnav-pool:hover{border-color:#d9d4cc;transform:translateY(-1px);}
.appnav-cta{display:inline-flex;align-items:center;gap:7px;background:var(--ink);color:#fff;border:0;font-family:var(--sans);font-size:13.5px;font-weight:800;padding:12px 20px;border-radius:999px;cursor:pointer;box-shadow:0 10px 24px rgba(13,17,23,.22);transition:background .2s ease,transform .2s var(--ease),box-shadow .2s ease;}
.appnav-cta:hover:not(:disabled){background:var(--orange);transform:translateY(-2px);box-shadow:0 14px 30px rgba(241,90,36,.3);}
.appnav-cta:active:not(:disabled){transform:scale(.97);}
.appnav-cta:disabled{opacity:.6;cursor:not-allowed;}
.appnav-icon{display:grid;place-items:center;width:34px;height:34px;border:0;background:transparent;color:#6b6b6b;border-radius:999px;cursor:pointer;transition:background .16s ease,color .16s ease;}
.appnav-icon:hover{background:rgba(13,17,23,.06);color:var(--ink);}
.appnav-user{border:0;background:transparent;padding:0;cursor:pointer;}
.appnav-avatar{display:grid;place-items:center;width:38px;height:38px;border-radius:50%;background:var(--peach,#fdeade);color:var(--coral,#c4502a);border:1px solid #f5d9c8;font-size:12.5px;font-weight:800;letter-spacing:.01em;transition:transform .2s var(--ease);}
.appnav-user:hover .appnav-avatar{transform:scale(1.06);}
.tx-head{display:grid;grid-template-columns:1fr auto;gap:12px;padding:4px 8px 10px;font-size:10.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);}
.tx-head span:last-child{text-align:right;}
.brand-mark{width:30px;height:30px;border-radius:9px;overflow:hidden;background:#000;display:grid;place-items:center;flex-shrink:0;}
.brand-mark img{width:100%;height:100%;object-fit:cover;display:block;}
.brand-name{font-weight:700;font-size:17px;letter-spacing:-.02em;}
/* Main — full-width of the page, no column strip */
.main{position:relative;z-index:1;padding:132px clamp(20px,4vw,44px) 96px;width:100%;max-width:1180px;margin:0 auto;}
.page-head{margin-bottom:34px;display:flex;align-items:flex-end;justify-content:space-between;gap:20px;flex-wrap:wrap;}
.page-kicker{display:inline-flex;align-items:center;gap:7px;background:var(--peach,#fdeade);color:var(--coral,#c4502a);border:1px solid #f5d9c8;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.09em;line-height:1;padding:8px 15px;border-radius:999px;margin:0 0 16px;}
.page-head h1{color:#fff;font-size:clamp(38px,4.6vw,64px);line-height:.98;letter-spacing:-.05em;margin:0 0 12px;font-weight:800;text-shadow:0 2px 30px rgba(50,90,160,.25);text-wrap:balance;}
.page-head p{color:rgba(255,255,255,.94);font-size:clamp(14.5px,1.3vw,16.5px);line-height:1.6;margin:0;max-width:560px;text-shadow:0 1px 18px rgba(28,64,124,.35);}
.page-head>.btn,.page-head .btn.soft{background:rgba(255,255,255,.92);border-color:transparent;color:var(--ink);backdrop-filter:blur(8px);box-shadow:0 12px 28px rgba(30,60,120,.16);}
.page-head>.btn:hover,.page-head .btn.soft:hover{background:#fff;}

/* Panels — white surfaces on the sky, like the site's cards */
.panel{background:#fff;border:1px solid var(--line);border-radius:24px;padding:26px 28px;margin-bottom:24px;box-shadow:0 18px 44px rgba(21,34,53,.07);}
.panel-eyebrow{display:block;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.09em;color:#a08a72;margin-bottom:14px;}
.panel-lede{color:var(--text-muted);font-size:14.5px;line-height:1.65;margin:0 0 18px;}

/* First-run get-started — three calm steps, not a wall of capability tiles */
.start-card{padding:26px 28px;}
.start-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:22px;}
.start-head .panel-eyebrow{margin-bottom:6px;}
.start-title{font-size:22px;font-weight:800;letter-spacing:-.03em;line-height:1.15;margin:0;}
.start-dismiss{display:inline-flex;align-items:center;gap:6px;flex-shrink:0;border:1px solid var(--line);background:#fff;color:var(--text-muted);border-radius:999px;padding:7px 13px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:var(--sans);transition:color .14s,background .14s;}
.start-dismiss:hover{color:var(--ink);background:#f7f6f2;}
.start-dismiss svg{color:var(--orange);}
.start-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;}
.start-step{display:flex;align-items:center;gap:12px;text-align:left;background:#f7f6f2;border:1px solid transparent;border-radius:16px;padding:14px 16px;cursor:pointer;font-family:var(--sans);color:var(--ink);transition:background .16s,border-color .16s,transform .16s var(--ease);}
.start-step:not(:disabled):hover{background:#fff;border-color:var(--line);transform:translateY(-1px);}
.start-step:not(:disabled):active{transform:scale(.99);}
.start-step:disabled{cursor:default;}
.start-step.done{background:transparent;border-color:var(--line);}
.start-step.done .start-label{color:var(--text-muted);}
.start-num{display:grid;place-items:center;width:26px;height:26px;flex:0 0 auto;border-radius:50%;background:var(--peach,#fdeade);color:var(--coral,#c4502a);font-size:12px;font-weight:800;}
.start-step.done .start-num{background:var(--orange);color:#fff;}
.start-label{font-size:13.5px;font-weight:700;letter-spacing:-.01em;line-height:1.3;}

/* Tabular figures on every money/number readout — digits stay column-aligned
   during count-up so the hero never jitters, the way Revolut/OKX balances hold. */
.balance-num,.bh-num,.bh-sub,.stat-value,.lock-row strong,.earn-receive-total,
.aside-balance strong,.field-usd,.receive-name,.receive-addr-val{font-variant-numeric:tabular-nums;}

.balance-line{display:flex;align-items:baseline;gap:8px;}
.balance-num{font-size:56px;font-weight:800;letter-spacing:-.045em;line-height:1;}
.balance-unit{font-size:17px;color:var(--text-muted);font-weight:600;}
.panel-actions{display:flex;gap:10px;margin-top:24px;}

/* Balance hero + live value chart (Overview) */
.balance-hero{position:relative;background:#fff;border:1px solid var(--line);border-radius:28px;padding:32px 32px 14px;margin-bottom:24px;overflow:hidden;box-shadow:0 30px 60px -26px rgba(21,34,53,.32),0 2px 6px rgba(13,17,23,.04);}
.balance-hero::before{content:"";position:absolute;width:440px;height:440px;right:-150px;top:-170px;border-radius:50%;background:radial-gradient(circle,#f15a2414,transparent 65%);animation:breathe 8s ease-in-out infinite;pointer-events:none;}
.balance-hero>*{position:relative;z-index:1;}
@keyframes breathe{0%,100%{opacity:.55;transform:scale(1);}50%{opacity:1;transform:scale(1.12);}}
.bh-top{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;}
.bh-eyebrow{display:block;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);}
.bh-value{display:flex;align-items:baseline;gap:8px;margin:9px 0 3px;}
.bh-num{font-size:44px;font-weight:800;letter-spacing:-.035em;line-height:1;}
.bh-num small{font-size:16px;color:var(--text-muted);font-weight:600;}
.bh-sub{font-size:13px;color:var(--text-muted);}
.bh-sub-a::after{content:" · ";}
.bh-trend{display:inline-flex;align-items:center;font-size:12.5px;font-weight:700;padding:5px 11px;border-radius:999px;white-space:nowrap;flex-shrink:0;}
.bh-trend.up{background:#eef6f1;color:#2f7d54;}
.bh-trend.down{background:#fbeae7;color:#b4341f;}
.bh-empty{margin:16px 0 14px;padding:18px;background:#f7f6f2;border:1px solid #ececea;border-radius:14px;font-size:13px;color:var(--text-muted);text-align:center;}
.bh-empty.actionable{display:flex;align-items:center;justify-content:space-between;gap:16px;text-align:left;padding:12px 14px 12px 18px;}
.bh-empty-cta{display:inline-flex;align-items:center;gap:7px;flex:0 0 auto;border:0;border-radius:999px;background:var(--ink);color:#fff;font-family:var(--sans);font-size:12.5px;font-weight:800;padding:10px 16px;cursor:pointer;transition:background .2s ease,transform .2s var(--ease);}
.bh-empty-cta:not(:disabled):hover{background:var(--orange);transform:translateY(-1px);}
.bh-empty-cta:disabled{opacity:.5;cursor:default;}
.bchart{position:relative;width:100%;margin-top:14px;touch-action:pan-y;cursor:crosshair;}
.bchart-svg{display:block;width:100%;height:116px;}
.bchart-area,.bchart-line{pointer-events:none;}
.bchart-svg circle{transition:r .12s var(--ease);}
.bchart-tip{position:absolute;top:-6px;transform:translateX(-50%);background:var(--ink);color:#fff;border-radius:11px;padding:8px 11px;pointer-events:none;display:flex;flex-direction:column;gap:3px;box-shadow:0 10px 26px #16202833;white-space:nowrap;z-index:3;min-width:118px;}
.bct-kind{display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#c3ccd6;}
.bct-kind.in{color:#7fd6a3;}
.bct-kind.out{color:#f3a08c;}
.bchart-tip strong{font-size:15px;font-weight:800;letter-spacing:-.01em;line-height:1.1;}
.bchart-tip strong span{font-size:9px;font-weight:600;color:#aeb8c4;text-transform:uppercase;letter-spacing:.05em;margin-left:2px;}
.bct-usd{font-size:11px;font-weight:600;color:#e7ecf1;}
.bct-peer{font-size:10.5px;color:#aeb8c4;}
.bct-meta{font-size:9.5px;color:#8f9aa7;text-transform:uppercase;letter-spacing:.05em;margin-top:1px;}
.bchart-foot{display:flex;align-items:center;justify-content:space-between;margin-top:8px;font-size:11px;color:var(--text-muted);font-variant-numeric:tabular-nums;}
.bchart-foot span:first-child{font-weight:600;color:var(--ink);}
@media(prefers-reduced-motion:no-preference){
  .bchart-line{stroke-dasharray:1;stroke-dashoffset:1;animation:bdraw 1.05s var(--ease) .05s forwards;}
}
@keyframes bdraw{to{stroke-dashoffset:0;}}

/* Balance hero — a white device card floating on the sky, like the site's mockup */
.balance-hero.bh-dark{background:#fff;border-color:var(--line);color:var(--ink);padding:32px 32px 14px;box-shadow:0 30px 60px -26px rgba(21,34,53,.32),0 2px 6px rgba(13,17,23,.04);}
.balance-hero.bh-dark .bh-eyebrow{color:#8c8c86;}
.balance-hero.bh-dark .bh-num{color:var(--ink);font-size:64px;}
.balance-hero.bh-dark .bh-num small{color:var(--text-muted);}
.balance-hero.bh-dark .bh-sub{color:var(--text-muted);}
.balance-hero.bh-dark .bh-trend.up{background:#eef6f1;color:#2f7d54;}
.balance-hero.bh-dark .bh-trend.down{background:#fdeeea;color:#b4341f;}
.balance-hero.bh-dark .bh-empty{border-color:var(--line);color:var(--text-muted);}
.balance-hero.bh-dark .bchart-line{stroke:var(--ink);}
.balance-hero.bh-dark .bchart-area{fill:rgba(13,17,23,.06);}
.balance-hero.bh-dark .bchart-svg circle{stroke:#fff;}
.balance-hero.bh-dark .bchart-foot{color:var(--text-muted);}
.balance-hero.bh-dark .bchart-foot span:first-child{color:var(--ink);}
@media(max-width:640px){.balance-hero.bh-dark .bh-num{font-size:46px;}}

.claimed-row{display:flex;align-items:center;gap:14px;flex-wrap:wrap;}
.claimed-badge{display:inline-flex;align-items:center;gap:6px;background:#f0f7f3;color:#2f7d54;border:1px solid #cfe8db;padding:8px 14px;border-radius:999px;font-weight:700;font-size:15px;}
.claimed-note{color:var(--text-muted);font-size:13.5px;}

.inline-form{display:flex;gap:12px;align-items:center;}
.inline-form .text-field{min-width:0;}
.inline-form .btn{flex:0 0 auto;height:46px;padding:0 22px;font-size:13.5px;}
.text-field{display:flex;align-items:center;gap:10px;border:0;border-bottom:1px solid #d8d5cd;border-radius:0;padding:10px 2px;background:transparent;flex:1;transition:border-color .25s ease;}
.text-field:focus-within{border-color:var(--ink);box-shadow:none;background:linear-gradient(180deg,transparent 94%,#f15a2412);}
.text-field.block{width:100%;margin-bottom:4px;}
.field-at{color:var(--text-muted);font-weight:700;}
.field-lead{color:var(--muted);flex-shrink:0;}
.field-trail{color:var(--text-muted);font-size:13px;font-weight:600;}
.field-input{flex:1;border:0;background:transparent;padding:13px 2px;font-size:15px;color:var(--ink);outline:none;font-family:var(--sans);min-width:0;}
.field-input:focus,.field-input:focus-visible{outline:none;}
.field-input::-webkit-outer-spin-button,
.field-input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}
.field-input[type=number]{-moz-appearance:textfield;appearance:textfield;}
.field-usd{display:block;font-size:14px;font-weight:700;color:var(--ink);letter-spacing:-.01em;margin:8px 0 2px;}
.field-label{display:block;font-size:13px;font-weight:600;color:var(--ink);margin:16px 0 7px;}
.field-label:first-child{margin-top:0;}
.field-hint{display:inline-flex;align-items:center;gap:5px;font-size:12.5px;margin-top:2px;}
.field-hint.muted{color:var(--muted);}
.field-hint.ok{color:#2f7d54;}
.field-hint.miss{color:#b4341f;}
.field-hint.warn{color:#b56a1f;}

.gas-toggle{display:flex;align-items:center;gap:12px;width:100%;margin-top:18px;padding:12px 14px;background:#fafaf8;border:1px solid var(--line);border-radius:12px;cursor:pointer;text-align:left;transition:border-color .2s var(--ease),background .2s var(--ease);}
.gas-toggle:hover{border-color:#d7d3c9;}
.gas-toggle.on{background:#fff;border-color:var(--ink);}
.gas-toggle-track{position:relative;flex-shrink:0;width:38px;height:22px;border-radius:999px;background:#d7d3c9;transition:background .2s var(--ease);}
.gas-toggle.on .gas-toggle-track{background:var(--ink);}
.gas-toggle-knob{position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#fff;transition:transform .2s var(--ease);}
.gas-toggle.on .gas-toggle-knob{transform:translateX(16px);}
.gas-toggle-label{display:flex;flex-direction:column;gap:3px;}
.gas-toggle-title{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:700;color:var(--ink);}
.gas-toggle.on .gas-toggle-title svg{color:var(--orange);}
.gas-toggle-title svg{color:#9a958a;}
.gas-toggle-sub{font-size:11px;font-weight:500;color:var(--muted);}

.send-panel .btn.full{margin-top:22px;}
.earn-actions{display:flex;gap:10px;margin-top:22px;}
.earn-actions .btn{flex:1;}
.term-presets{display:flex;gap:8px;}
.term-preset{flex:1;border:1px solid var(--line);background:var(--white);color:var(--text-muted);padding:10px 8px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:var(--sans);transition:background .14s,border-color .14s,color .14s;}
.term-preset:hover{color:var(--ink);border-color:#d7d3c9;}
.term-preset.active{background:var(--ink);border-color:var(--ink);color:var(--white);}
.cat-tabs{display:flex;gap:8px;margin-bottom:2px;}
.cat-tab{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;border:1px solid var(--line);background:var(--white);color:var(--text-muted);padding:12px 6px;border-radius:12px;font-size:12px;font-weight:700;cursor:pointer;font-family:var(--sans);transition:background .14s,border-color .14s,color .14s;}
.cat-tab:hover{color:var(--ink);border-color:#d7d3c9;}
.cat-tab.active{background:var(--ink);border-color:var(--ink);color:var(--white);}
.field-select{flex:1;border:0;background:transparent;padding:12px 2px;font-size:15px;color:var(--ink);outline:none;font-family:var(--sans);min-width:0;cursor:pointer;}
.field-verify{flex-shrink:0;border:1px solid var(--ink);background:var(--ink);color:var(--white);font-size:12px;font-weight:700;padding:7px 12px;border-radius:8px;cursor:pointer;font-family:var(--sans);transition:opacity .14s;}
.field-verify:hover:not(:disabled){opacity:.85;}
.field-verify:disabled{opacity:.4;cursor:not-allowed;}
.scaffold-note{display:flex;gap:10px;align-items:flex-start;margin-bottom:18px;padding:12px 14px;background:#fbf3e9;border:1px solid #f0d9be;border-radius:12px;font-size:12.5px;line-height:1.5;color:#8a5a22;}
.scaffold-note svg{flex-shrink:0;margin-top:1px;color:#c07a26;}
.scaffold-note b{color:#6f4718;font-weight:700;}
.lock-card{display:flex;flex-direction:column;padding:6px 20px 16px;background:#fafaf8;border:1px solid var(--line);border-radius:14px;margin-top:4px;}
.lock-row{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:9px 0;}
.lock-row+.lock-row{border-top:1px solid var(--line);}
.lock-row span{font-size:13px;color:var(--text-muted);font-weight:600;}
.lock-row strong{font-size:16px;font-weight:700;letter-spacing:-.01em;}
.lock-row strong small{font-size:11.5px;color:var(--text-muted);font-weight:600;}
.lock-yield{color:var(--orange);}
.lock-status{margin-top:12px;padding:10px 14px;background:var(--white);border:1px solid var(--line);border-radius:10px;font-size:12.5px;font-weight:700;color:var(--text-muted);text-align:center;}
.lock-status.matured{color:#0f7a3d;border-color:#bfe6cd;background:#f2fbf5;}
.lock-progress{display:block;height:6px;border-radius:99px;background:#e8e6df;overflow:hidden;margin-top:10px;}
.lock-progress i{display:block;height:100%;width:38%;border-radius:99px;background:linear-gradient(90deg,var(--orange),#ff8d66);animation:lock-slide 1.6s ease-in-out infinite;}
@keyframes lock-slide{0%{transform:translateX(-110%);}100%{transform:translateX(290%);}}
.term-custom{margin-top:10px;}
.field-max{flex-shrink:0;border:1px solid var(--line);background:var(--white);color:var(--ink);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;padding:5px 9px;border-radius:7px;cursor:pointer;font-family:var(--sans);transition:background .14s,border-color .14s;}
.field-max:hover:not(:disabled){background:#ecebe5;border-color:#d7d3c9;}
.field-max:disabled{opacity:.4;cursor:not-allowed;}
.earn-receive{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:16px;padding:14px 16px;background:#fafaf8;border:1px solid var(--line);border-radius:12px;}
.earn-receive-label{display:flex;flex-direction:column;gap:3px;min-width:0;}
.earn-receive-label span{font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);}
.earn-receive-label small{font-size:12.5px;color:var(--text-muted);}
.earn-receive-total{font-size:20px;font-weight:700;letter-spacing:-.02em;white-space:nowrap;}
.earn-receive-total small{font-size:12px;color:var(--text-muted);font-weight:600;}

/* Earn hero — live yield figure + pool-share ring */
.earn-hero{display:grid;grid-template-columns:1fr auto;gap:24px;align-items:center;padding:6px 0;margin-bottom:30px;position:relative;overflow:hidden;}
.earn-hero::before{content:"";position:absolute;top:-45%;right:-8%;width:320px;height:320px;background:radial-gradient(circle,#f15a2412,transparent 62%);pointer-events:none;}
.eh-main{min-width:0;position:relative;z-index:1;}
.eh-head{display:flex;align-items:center;gap:10px;}
.eh-eyebrow{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);}
.eh-live{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#2f7d54;background:#eef6f1;padding:3px 8px;border-radius:999px;}
.eh-live-dot{width:6px;height:6px;border-radius:50%;background:#2f9c63;}
.eh-value{display:flex;align-items:baseline;gap:8px;margin:10px 0 2px;}
.eh-num{font-size:44px;font-weight:800;letter-spacing:-.03em;line-height:1;font-variant-numeric:tabular-nums;}
.eh-unit{font-size:16px;color:var(--text-muted);font-weight:600;}
.eh-meta{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:8px;}
.eh-apr{display:inline-flex;align-items:center;font-size:12px;font-weight:700;color:var(--orange);background:#f15a2414;border:1px solid #f15a2433;padding:3px 9px;border-radius:999px;white-space:nowrap;}
.eh-note{font-size:13px;color:var(--text-muted);}
.eh-ring{display:flex;flex-direction:column;align-items:center;gap:9px;position:relative;z-index:1;}
.eh-ring-sub{font-size:11.5px;color:var(--text-muted);font-variant-numeric:tabular-nums;}

/* Radial gauge — the wrapper class is ring-wrap, not ring, because a bare
   .ring collides with Tailwind's ring utility (a 1px currentColor box-shadow)
   present in this build, which drew a black square around the donut. */
.ring-wrap{position:relative;display:grid;place-items:center;}
.ring-track{stroke:var(--line);}
.ring-arc{stroke:var(--orange);transition:stroke-dashoffset 1.1s var(--ease);}
.ring-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;}
.ring-pct{font-size:23px;font-weight:800;letter-spacing:-.02em;line-height:1;font-variant-numeric:tabular-nums;}
.ring-cap{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);}
@media(max-width:560px){
  .earn-hero{grid-template-columns:1fr;justify-items:start;gap:18px;}
  .eh-num{font-size:38px;}
  .eh-ring{align-self:center;width:100%;}
}

/* Empty state */
.empty-panel{text-align:center;padding:48px 32px;}
.empty-icon{width:56px;height:56px;border-radius:16px;background:var(--paper);border:1px solid var(--line);display:grid;place-items:center;color:var(--text-muted);margin:0 auto 18px;}
.empty-panel h2{font-size:18px;letter-spacing:-.02em;margin:0 0 8px;}
.empty-panel p{color:var(--text-muted);font-size:14px;line-height:1.6;max-width:340px;margin:0 auto 22px;}

/* Stat tiles */
.stat-row{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:16px;}
.stat-tile{background:none;border:0;border-radius:0;padding:14px 0;display:flex;flex-direction:column;gap:9px;box-shadow:none;transition:transform .18s var(--ease);}
.stat-row{border-top:1px solid var(--line);border-bottom:1px solid var(--line);}
.stat-tile+.stat-tile{border-left:1px solid var(--line);padding-left:18px;}
.stat-head{display:flex;align-items:center;justify-content:space-between;gap:8px;}
.stat-label{font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);}
.stat-ico{width:28px;height:28px;border-radius:8px;background:var(--paper);border:1px solid var(--line);display:grid;place-items:center;color:var(--text-muted);flex-shrink:0;}
.stat-value{font-size:22px;font-weight:700;letter-spacing:-.03em;line-height:1.1;overflow:hidden;text-overflow:ellipsis;}
.stat-value small{font-size:13px;font-weight:600;color:var(--text-muted);}
.stat-tile.big .stat-value{font-size:30px;}
.stat-sub{font-size:12px;color:var(--text-muted);}
.stat-gauge{margin-top:11px;height:5px;border-radius:999px;background:var(--paper);overflow:hidden;}
.stat-gauge-fill{display:block;height:100%;border-radius:999px;background:var(--orange);transition:width 1s var(--ease);}

/* Overview grid */
.ov-stack{display:flex;flex-direction:column;gap:32px;}
.ov-split{display:grid;grid-template-columns:1.6fr 1fr;gap:20px;align-items:start;}
.panel-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px;}
.panel-head h2{font-size:15px;font-weight:700;letter-spacing:-.01em;margin:0;}
.panel-link{display:inline-flex;align-items:center;gap:4px;font-size:12.5px;font-weight:600;color:var(--text-muted);background:transparent;border:0;cursor:pointer;font-family:var(--sans);transition:color .14s;}
.panel-link:hover{color:var(--ink);}
.stack-actions{display:flex;flex-direction:column;gap:10px;}

/* Transaction list */
.tx-list{display:flex;flex-direction:column;}
.tx-row{padding:11px 8px;margin:0 -8px;border-top:1px solid var(--line);border-radius:10px;transition:background .12s;}
.tx-row:first-child{border-top:0;}
.tx-row:hover{background:var(--paper);}
.tx-row-head{display:flex;align-items:center;gap:12px;width:100%;background:none;border:0;padding:0;cursor:pointer;font:inherit;color:inherit;text-align:left;}
.tx-ico{width:36px;height:36px;border-radius:11px;display:grid;place-items:center;flex-shrink:0;background:var(--paper);border:1px solid var(--line);color:var(--ink);}
.tx-main{display:flex;flex-direction:column;min-width:0;flex:1;gap:2px;}
.tx-label{font-size:14px;font-weight:600;letter-spacing:-.01em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.tx-sub{font-size:12px;color:var(--muted);font-family:var(--mono);}
.tx-right{display:flex;align-items:center;gap:12px;flex-shrink:0;}
.tx-time{font-size:12px;color:var(--text-muted);white-space:nowrap;min-width:56px;text-align:right;}
.tx-ext{color:var(--muted);opacity:0;transition:opacity .12s;}
.tx-row:hover .tx-ext{opacity:1;}
.tx-chev{color:var(--muted);transition:transform .2s var(--ease);flex-shrink:0;}
.tx-chev.open{transform:rotate(180deg);}
.tx-detail{padding:12px 0 4px 48px;animation:fade-up .3s var(--ease) both;}
.tx-steps{display:flex;flex-direction:column;gap:7px;margin-bottom:12px;}
.tx-step{display:flex;align-items:center;gap:9px;font-size:12.5px;font-weight:700;color:var(--muted);}
.tx-step i{width:8px;height:8px;border-radius:50%;background:#c9c5bb;flex-shrink:0;}
.tx-step.done{color:var(--ink);}
.tx-step.done i{background:#1d7a4c;}
.tx-step.active{color:var(--ink);}
.tx-step.active i{background:var(--orange);animation:tx-pulse 1.4s ease-in-out infinite;}
.tx-step.bad{color:#b3261e;}
.tx-step.bad i{background:#b3261e;}
@keyframes tx-pulse{50%{opacity:.3;}}
.tx-idrow{display:flex;align-items:center;gap:8px;}
.tx-id{font-size:12.5px;}
.tx-datesub{font-size:12px;color:var(--muted);margin-top:6px;}
.tx-explorer-link{display:inline-flex;align-items:center;gap:4px;margin-top:10px;font-size:12.5px;font-weight:700;color:var(--orange);}
.tx-filter{display:flex;flex-direction:column;gap:10px;margin-bottom:6px;}
.filter-chips{display:flex;gap:8px;flex-wrap:wrap;}
.filter-chip{border:1px solid var(--line);background:var(--white);color:var(--text-muted);border-radius:999px;padding:8px 15px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:var(--sans);transition:all .14s;}
.filter-chip:hover{border-color:#c9c5bb;}
.filter-chip.active{background:var(--ink);border-color:var(--ink);color:#fff;}
.filter-count{font-size:12px;color:var(--muted);margin:12px 0 0;text-align:center;}
.quote-skel{display:flex;flex-direction:column;gap:6px;padding:4px 0;}
.quote-skel i{display:block;height:13px;border-radius:6px;background:linear-gradient(90deg,#ecebe5 25%,#f7f6f2 50%,#ecebe5 75%);background-size:200% 100%;animation:quote-shimmer 1.2s ease-in-out infinite;}
.quote-skel i:last-child{width:62%;}
@keyframes quote-shimmer{to{background-position:-200% 0;}}
.pill{display:inline-flex;align-items:center;font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;text-transform:capitalize;}
.pill.success{background:#eef6f1;color:#2f7d54;}
.pill.pending{background:#fdf0e4;color:#b56a1f;}
.pill.failed,.pill.abort{background:#fbeae7;color:#b4341f;}

/* Transaction loading + empty */
.tx-loading{display:flex;flex-direction:column;gap:8px;}
.tx-skel{height:58px;border-radius:11px;background:linear-gradient(90deg,#efeee8,#f7f6f1,#efeee8);background-size:200% 100%;animation:sk 1.2s ease-in-out infinite;}
@keyframes sk{0%{background-position:200% 0}100%{background-position:-200% 0}}
.tx-empty{text-align:center;padding:26px 12px;display:flex;flex-direction:column;align-items:center;}
.tx-empty p{color:var(--text-muted);font-size:13.5px;line-height:1.6;max-width:320px;margin:0 0 12px;}
.tx-empty .empty-icon{margin-bottom:14px;}
.tx-empty-link{display:inline-flex;align-items:center;gap:5px;font-size:13px;font-weight:600;color:var(--ink);}

/* Copy button + mono address */
.mono{font-family:var(--mono);font-size:13px;color:var(--ink);}
.icon-btn{display:grid;place-items:center;width:26px;height:26px;border-radius:7px;border:1px solid var(--line);background:var(--paper);color:var(--text-muted);cursor:pointer;transition:color .14s,background .14s;}
.icon-btn:hover{color:var(--ink);background:#ecebe5;}

/* Send view */
.send-grid{display:grid;grid-template-columns:1.5fr 1fr;gap:24px 48px;align-items:start;}
.send-aside{align-self:stretch;}
.tips{list-style:none;padding:0;margin:0 0 20px;display:flex;flex-direction:column;gap:13px;}
.tips li{position:relative;padding-left:20px;font-size:13.5px;line-height:1.55;color:var(--text-muted);}
.tips b{color:var(--ink);font-weight:600;}
.tip-dot{position:absolute;left:0;top:7px;width:7px;height:7px;border-radius:50%;background:var(--orange);}
.aside-balance{display:flex;align-items:center;justify-content:space-between;padding-top:16px;border-top:1px solid var(--line);}
.aside-balance span{font-size:13px;color:var(--text-muted);}
.aside-balance strong{font-size:17px;font-weight:700;letter-spacing:-.02em;}
.aside-balance small{font-size:12px;color:var(--text-muted);font-weight:600;}
.explorer-cta{display:inline-flex;align-items:center;gap:6px;margin-top:4px;font-size:13px;font-weight:600;color:var(--text-muted);transition:color .14s;}
.explorer-cta:hover{color:var(--ink);}

/* Quick-action pair (Overview) */
.action-pair{display:flex;gap:10px;}
.action-pair .btn{flex:1;}

/* Quick actions — OKX-style tactile row under the balance hero */
.dock{display:grid;grid-template-columns:repeat(6,1fr);gap:2px;background:#fff;border:1px solid var(--line);border-radius:24px;padding:8px;box-shadow:0 18px 44px rgba(21,34,53,.07);}
.dock-btn{display:flex;flex-direction:column;align-items:center;gap:10px;background:transparent;border:0;border-radius:18px;padding:16px 6px;cursor:pointer;font-family:var(--sans);color:var(--ink);transition:transform .18s var(--ease),background .18s ease;animation:fade-up .45s var(--ease) both;}
.dock-btn:nth-child(2){animation-delay:.05s;}
.dock-btn:nth-child(3){animation-delay:.1s;}
.dock-btn:nth-child(4){animation-delay:.15s;}
.dock-btn:nth-child(5){animation-delay:.2s;}
.dock-btn:nth-child(6){animation-delay:.25s;}
.dock-btn:not(:disabled):hover{background:#f7f6f2;}
.dock-btn:not(:disabled):active{transform:scale(.98);}
.dock-btn:disabled{opacity:.55;cursor:default;}
.dock-ico{display:grid;place-items:center;width:42px;height:42px;border-radius:50%;background:#f7f6f2;color:var(--ink);transition:color .16s,background .16s,transform .18s var(--ease);}
.dock-btn:not(:disabled):hover .dock-ico{color:var(--orange);background:#f15a2414;transform:scale(1.06);}
.dock-btn.primary .dock-ico{background:var(--ink);color:#fff;box-shadow:0 10px 22px rgba(13,17,23,.22);}
.dock-btn.primary:not(:disabled):hover .dock-ico{color:#fff;background:var(--orange);transform:scale(1.06);}
.dock-label{font-size:12px;font-weight:700;letter-spacing:-.01em;}
@media(max-width:640px){
  .dock{grid-template-columns:repeat(3,1fr);gap:0;padding:5px;}
  .dock-btn{padding:10px 4px;border-radius:14px;gap:6px;}
  .dock-ico{width:36px;height:36px;}
  .dock-label{font-size:11.5px;}
}

/* Receive view — wide hero: oversized code left, everything else right */
.receive-hero{display:grid;grid-template-columns:auto 1fr;gap:clamp(28px,4vw,60px);align-items:center;}
.receive-info{display:flex;flex-direction:column;align-items:flex-start;text-align:left;min-width:0;}
.qr-frame{padding:20px;background:#fff;border:1px solid var(--line);border-radius:22px;box-shadow:var(--elev-2);line-height:0;transition:transform .2s var(--ease),box-shadow .2s ease;}
.qr-frame:hover{transform:translateY(-3px) rotate(-1deg);box-shadow:var(--elev-3);}
.receive-handle{display:flex;align-items:baseline;gap:1px;margin:0;}
.receive-at{font-size:26px;font-weight:700;color:var(--text-muted);}
.receive-name{font-size:32px;font-weight:800;letter-spacing:-.04em;color:var(--ink);}
.receive-name.unnamed{font-size:18px;font-family:var(--mono);letter-spacing:0;}
.receive-note{color:var(--text-muted);font-size:14px;line-height:1.6;max-width:440px;margin:10px 0 0;}
.receive-note b{color:var(--ink);font-weight:700;}
.link-btn{border:0;background:transparent;color:var(--orange);font-weight:700;cursor:pointer;font-family:var(--sans);font-size:inherit;padding:0;text-decoration:underline;text-underline-offset:2px;}
.receive-actions{display:flex;gap:10px;margin-top:22px;width:100%;max-width:480px;}
.receive-actions .btn{flex:1;}
.receive-addr{margin:22px 0 0;width:100%;max-width:480px;}
.receive-addr .panel-eyebrow{display:block;margin-bottom:8px;}
.receive-addr-val{display:block;word-break:break-all;font-size:12.5px;line-height:1.5;color:var(--ink);background:var(--paper);border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin-bottom:10px;}
.receive-addr-row{display:flex;gap:8px;}
.receive-addr-row .btn{flex:1;}
/* Live receipt summaries in the form asides */
.sum-rows{display:flex;flex-direction:column;margin:2px 0 4px;}
.sum-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-top:1px solid var(--line);font-size:13px;}
.sum-row:first-child{border-top:0;}
.sum-row>span{color:var(--muted);font-weight:600;flex-shrink:0;}
.sum-row>strong{font-weight:700;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.sum-row>strong small{color:var(--muted);font-weight:600;}
.sum-row.total>strong{font-size:14.5px;}
.sum-empty{color:#b9b4a8;font-weight:600;}
.ok-inline{color:#1d7a4c;display:inline-flex;align-items:center;gap:4px;}

/* Small button + spinner */
.btn.sm{padding:8px 12px;font-size:12.5px;border-radius:9px;}
.spin{animation:spin 1s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}

/* --- Motion ------------------------------------------------------------ */
@keyframes fade-up{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}
@keyframes fade-in{from{opacity:0;}to{opacity:1;}}

/* View entrance — staggered; re-runs on tab switch via key={view} */
.view>*{animation:fade-up .6s var(--ease) both;}
.view>*:nth-child(2){animation-delay:.07s;}
.view>*:nth-child(3){animation-delay:.14s;}
.view>*:nth-child(4){animation-delay:.21s;}
.view>*:nth-child(5){animation-delay:.28s;}
.view>*:nth-child(6){animation-delay:.35s;}

/* Transaction rows drift in on load */
.tx-list .tx-row{animation:fade-up .45s var(--ease) both;}
.tx-list .tx-row:nth-child(2){animation-delay:.05s;}
.tx-list .tx-row:nth-child(3){animation-delay:.1s;}
.tx-list .tx-row:nth-child(4){animation-delay:.15s;}
.tx-list .tx-row:nth-child(n+5){animation-delay:.2s;}

/* Sign-in entrance */
.pass-main>*{animation:fade-up .55s var(--ease) both;}
.pass-main>*:nth-child(2){animation-delay:.06s;}
.pass-main>*:nth-child(3){animation-delay:.12s;}
.pass-main>*:nth-child(4){animation-delay:.18s;}
.pass-main>*:nth-child(5){animation-delay:.24s;}

/* Hover micro-interactions */
.stat-tile:hover{transform:translateY(-2px);}

/* Buttons — pills, black with an orange hover, like the site */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;border:0;border-radius:999px;padding:14px 24px;font-size:14px;font-weight:800;cursor:pointer;font-family:var(--sans);transition:transform .22s var(--ease),opacity .15s,background .2s ease,box-shadow .22s ease;text-decoration:none;}
.btn:disabled{opacity:.45;cursor:not-allowed;}
.btn:not(:disabled):hover{transform:translateY(-2px);}
.btn:not(:disabled):active{transform:scale(.97);}
.btn.primary{background:var(--ink);color:#fff;box-shadow:0 8px 20px -6px rgba(13,17,23,.28);}
.btn.primary:disabled{background:#e8e6e0;color:#a19c93;box-shadow:none;}
.btn.primary:not(:disabled):hover{background:var(--orange);box-shadow:0 16px 36px rgba(241,90,36,.3);}
.btn.primary:disabled{box-shadow:none;}
.btn.soft{background:#fff;border:1px solid var(--line);color:var(--ink);}
.btn.soft:hover{background:#f7f6f2;border-color:#d9d4cc;}
.btn.full{width:100%;}
.btn.lg{padding:16px 28px;font-size:15px;}

/* Mobile bottom tabs (hidden on desktop) */
.tab-bar{display:none;}

@media(max-width:1040px){
  .send-grid{grid-template-columns:1fr;}
  .ov-split{grid-template-columns:1fr;}
  .send-aside{padding-top:0;}
  .ov-split>*:last-child{padding-top:0;}
}
@media(max-width:640px){
  .stat-row{grid-template-columns:1fr;}
  .stat-tile+.stat-tile{border-left:0;border-top:1px solid var(--line);padding-left:0;padding-top:14px;}
  .inline-form{flex-direction:column;align-items:stretch;gap:14px;}
  .inline-form .btn{width:100%;height:48px;margin:0;}
  .start-card{padding:22px 20px;}
  .start-head{margin-bottom:18px;}
  .start-title{font-size:19px;}
  .start-steps{grid-template-columns:1fr;gap:8px;}
  .start-step{padding:12px 14px;}
  .bh-sub{font-size:12px;line-height:1.5;}
  .bh-sub-a{display:block;}
  .bh-sub-a::after{content:none;}
  .bh-sub-b{display:block;}
  .bh-empty.actionable{flex-direction:row;align-items:center;text-align:left;gap:12px;padding:12px 12px 12px 16px;}
  .bh-empty{margin:14px 0 10px;}
  .bh-empty-cta{width:auto;height:40px;padding:0 14px;font-size:12px;}
}
@media(max-width:800px){
  .pass-main{padding-top:0;}
  .pass-title{font-size:clamp(40px,min(13vw,10svh),64px);}
  .pass-face{padding:22px;}
  .pass-tilt{margin-top:24px;}
  .pass-connect{margin-top:22px;}
  .sky{height:520px;background:linear-gradient(180deg,#4c80cd 0%,#5d8fd6 32%,#7fabe1 56%,#bcd6f2 78%,#eceeee 92%,var(--paper) 100%);}
  .appnav{top:max(10px,env(safe-area-inset-top));width:calc(100% - 20px);height:58px;padding:6px 8px;gap:6px;}
  .appnav-brand{padding:0 10px 0 2px;}
  .appnav-brand strong{font-size:16px;}
  .appnav-links{display:none;}
  .appnav-pool{padding:8px 11px;font-size:12px;}
  .appnav-cta{padding:10px 15px;font-size:13px;}
  .appnav-icon{display:none;}
  .main{padding:96px 18px 104px;max-width:100%;}
  .receive-hero{grid-template-columns:1fr;justify-items:center;}
  .receive-info{align-items:center;text-align:center;}
  .receive-addr{max-width:100%;}
  .page-head{margin-bottom:22px;align-items:flex-start;}
  .page-head h1{font-size:clamp(34px,9vw,44px);}
  .panel{padding:22px 20px;border-radius:22px;margin-bottom:18px;}
  .tab-bar{display:flex;position:fixed;bottom:max(10px,env(safe-area-inset-bottom));left:10px;right:10px;background:rgba(255,255,255,.86);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border:1px solid rgba(255,255,255,.6);border-radius:22px;padding:6px;z-index:40;box-shadow:0 18px 44px rgba(21,34,53,.16);}
  .tab{position:relative;flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;border:0;background:transparent;color:var(--text-muted);padding:8px 4px;min-height:50px;border-radius:16px;font-size:10.5px;font-weight:700;cursor:pointer;font-family:var(--sans);transition:color .18s,background .18s;-webkit-tap-highlight-color:transparent;}
  .tab svg{transition:transform .22s var(--ease);}
  .tab.active{color:var(--ink);background:#f4f2ec;}
  .tab.active svg{transform:translateY(-1px) scale(1.06);color:var(--orange);}
  .tab::before{display:none;}
  .balance-num{font-size:48px;}
}
@media(max-width:480px){
  .main{padding:98px 16px 102px;}
  .page-head .btn{width:100%;}
  .pass-nav{padding:16px 20px;}
  .balance-num{font-size:42px;}
  .stat-tile.big .stat-value{font-size:26px;}
  .bh-num{font-size:42px;}
  .balance-hero.bh-dark .bh-num{font-size:42px;}
}
@media(prefers-reduced-motion:reduce){
  .view>*,.tx-list .tx-row,.dock-btn,.sky-line>span,.pass-spin,.pass-sheen,.pa,.pass-main>*,.balance-hero::before,.spin,.lock-progress i,.tx-detail,.tx-step.active i,.quote-skel i{animation:none !important;}
  .pass-flip,.pass-tilt{transition:none !important;}
  *{transition-duration:.01ms !important;}
}
`;
