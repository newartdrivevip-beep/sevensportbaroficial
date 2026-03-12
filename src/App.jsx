import { useState, useEffect, useRef } from "react";

// ─── AUDIO ENGINE ─────────────────────────────────────────────────────────────
let _ctx = null;
function getCtx() {
  if (!_ctx) try { _ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
  return _ctx;
}
function playTone(freq, type, duration, vol = 0.3, delay = 0) {
  const ctx = getCtx(); if (!ctx) return;
  const osc = ctx.createOscillator(), gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  osc.type = type; osc.frequency.value = freq;
  const t = ctx.currentTime + delay;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(vol, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  osc.start(t); osc.stop(t + duration + 0.05);
}
const SFX = {
  newOrder:      () => { playTone(880,"sine",.3,.4,0); playTone(1100,"sine",.3,.4,.18); playTone(1320,"sine",.4,.4,.36); },
  statusAdvance: () => { playTone(660,"sine",.15,.25,0); playTone(880,"sine",.2,.25,.12); },
  orderReady:    () => [523,659,784,1047].forEach((f,i) => playTone(f,"triangle",.35,.35,i*.1)),
  addCart:       () => playTone(440,"sine",.08,.15),
  pinPress:      () => playTone(600,"sine",.05,.1),
  pinError:      () => { playTone(200,"sawtooth",.15,.2,0); playTone(150,"sawtooth",.2,.2,.1); },
};

// ─── TABLE PINS (uma senha por mesa) ─────────────────────────────────────────
const TABLE_PINS = {
  "1":"3847","2":"6192","3":"5034","4":"9271","5":"4815",
  "6":"7263","7":"1590","8":"8346","9":"2974","10":"6031",
  "11":"4728","12":"9153","13":"3612","14":"7489","15":"5207",
  "16":"8364","17":"1975","18":"6403","19":"2891","20":"7152",
};

// ─── SHARED STATE ─────────────────────────────────────────────────────────────
const DB = {
  tables: Array.from({length:20},(_,i)=>({id:String(i+1),active:true})),
  menu: [
    {id:1,  name:"X-Burguer",      category:"Lanches",         price:18.9, emoji:"🍔",desc:"Pão, hambúrguer 150g, queijo, alface, tomate",          available:true},
    {id:2,  name:"X-Bacon",        category:"Lanches",         price:22.9, emoji:"🥓",desc:"Pão, hambúrguer 150g, bacon crocante, queijo, molho",    available:true},
    {id:3,  name:"X-Frango",       category:"Lanches",         price:19.9, emoji:"🍗",desc:"Pão, frango grelhado, queijo, alface, maionese",         available:true},
    {id:4,  name:"X-Tudo",         category:"Lanches",         price:26.9, emoji:"⭐",desc:"Pão, 2 hambúrgueres, bacon, ovo, queijo, alface, tomate",available:true},
    {id:5,  name:"Batata Frita P", category:"Acompanhamentos", price:8.9,  emoji:"🍟",desc:"Porção pequena de batatas crocantes",                    available:true},
    {id:6,  name:"Batata Frita G", category:"Acompanhamentos", price:13.9, emoji:"🍟",desc:"Porção grande de batatas crocantes",                     available:true},
    {id:7,  name:"Onion Rings",    category:"Acompanhamentos", price:12.9, emoji:"🧅",desc:"Anéis de cebola empanados crocantes",                    available:true},
    {id:8,  name:"Coca-Cola Lata", category:"Bebidas",         price:6.9,  emoji:"🥤",desc:"350ml gelada",                                           available:true},
    {id:9,  name:"Suco Natural",   category:"Bebidas",         price:9.9,  emoji:"🧃",desc:"Laranja, limão ou maracujá",                             available:true},
    {id:10, name:"Água Mineral",   category:"Bebidas",         price:4.9,  emoji:"💧",desc:"500ml com ou sem gás",                                   available:true},
    {id:11, name:"Milk Shake",     category:"Sobremesas",      price:16.9, emoji:"🥛",desc:"Chocolate, morango ou baunilha — 400ml",                 available:true},
    {id:12, name:"Brownie",        category:"Sobremesas",      price:10.9, emoji:"🍫",desc:"Brownie quentinho com sorvete de creme",                 available:true},
  ],
  orders: [],
  nextOrderId: 1,
  nextMenuId: 13,
};
const listeners = new Set(), orderListeners = new Set();
const notify = () => listeners.forEach(fn => fn());
const notifyOrder = o => orderListeners.forEach(fn => fn(o));

function useDB() {
  const [,setT] = useState(0);
  useEffect(()=>{const fn=()=>setT(t=>t+1);listeners.add(fn);return()=>listeners.delete(fn);},[]);
  return DB;
}
function addOrder(items,table,name){
  const o={id:DB.nextOrderId++,items,table,customerName:name,status:"novo",createdAt:new Date(),total:items.reduce((s,i)=>s+i.price*i.qty,0)};
  DB.orders.unshift(o); notify(); notifyOrder(o); return o.id;
}
function updateOrderStatus(id,status){
  const o=DB.orders.find(o=>o.id===id);
  if(o){o.status=status;notify();if(status==="pronto")SFX.orderReady();else SFX.statusAdvance();}
}
function updateMenuItem(id,changes){const m=DB.menu.find(m=>m.id===id);if(m){Object.assign(m,changes);notify();}}
function addMenuItem(item){DB.menu.push({...item,id:DB.nextMenuId++,available:true});notify();}
function deleteMenuItem(id){const i=DB.menu.findIndex(m=>m.id===id);if(i>-1){DB.menu.splice(i,1);notify();}}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const SL = {novo:"Novo",preparando:"Preparando",pronto:"Pronto!",entregue:"Entregue"};
const SC = {novo:"#F5A623",preparando:"#F5D020",pronto:"#4CAF50",entregue:"#555"};
const SN = {novo:"preparando",preparando:"pronto",pronto:"entregue"};
const SNL= {novo:"▶ Iniciar preparo",preparando:"✓ Marcar pronto",pronto:"✓ Entregar"};
const CATS = ["Lanches","Acompanhamentos","Bebidas","Sobremesas"];
const EMOJIS = ["🍔","🥓","🍗","⭐","🍟","🧅","🥤","🧃","💧","🥛","🍫","🌮","🌯","🥗","🍕","🥞","🍦","🧁","🎂","☕","🍺","🍻","🥃","🍾"];

function useNow(){const[n,sn]=useState(new Date());useEffect(()=>{const t=setInterval(()=>sn(new Date()),15000);return()=>clearInterval(t);},[]);return n;}
function timeAgo(d,n){const m=Math.floor((n-d)/60000);if(m<1)return"agora";if(m<60)return`${m}min`;return`${Math.floor(m/60)}h`;}

// ─── LOGO ─────────────────────────────────────────────────────────────────────
const LogoMark = ({size=32}) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    <circle cx="50" cy="50" r="48" fill="#0A2E1A" stroke="#C9920A" strokeWidth="3"/>
    <text x="50" y="64" textAnchor="middle" fontSize="52" fontWeight="900" fontFamily="Arial Black,sans-serif" fill="#F5A623">7</text>
  </svg>
);

// ─── STYLES ───────────────────────────────────────────────────────────────────
const G = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@600;700;800&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:#061A0D;color:#F0EBD8;font-family:'Barlow',sans-serif;min-height:100vh}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#0A2416}::-webkit-scrollbar-thumb{background:#C9920A;border-radius:2px}
input,textarea,select{font-family:'Barlow',sans-serif}
:root{
  --gold:#F5A623;--gold2:#C9920A;--gold-light:#FFD166;
  --green:#0A2E1A;--green2:#0D3B21;--green3:#12512E;--green4:#1A6B3E;
  --surface:#0C2418;--surface2:#102E1E;--border:#1E4A2C;
  --text:#F0EBD8;--muted:#8BA898;
}
.app{min-height:100vh;display:flex;flex-direction:column}

/* NAV */
.nav{display:flex;align-items:center;justify-content:space-between;padding:0 20px;height:60px;background:var(--green);border-bottom:2px solid var(--gold2);position:sticky;top:0;z-index:100;gap:12px}
.nav-brand{display:flex;align-items:center;gap:10px}
.nav-name{font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:2px;line-height:1}
.nav-name span{color:var(--gold);display:block;font-size:12px;letter-spacing:3px}
.nav-tabs{display:flex;gap:2px;background:#051209;border-radius:8px;padding:3px;flex-shrink:0}
.nav-tab{padding:6px 14px;border-radius:6px;border:none;cursor:pointer;font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:700;letter-spacing:.5px;transition:all .2s;background:transparent;color:var(--muted);white-space:nowrap;position:relative;text-transform:uppercase}
.nav-tab.active{background:var(--gold);color:#061A0D}
.nav-badge{position:absolute;top:-5px;right:-5px;background:#4CAF50;color:#fff;border-radius:10px;font-size:10px;font-weight:800;padding:1px 5px;min-width:16px;text-align:center}

/* PIN NUMPAD */
.pin-screen{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:var(--green);padding:24px}
.pin-dots{display:flex;gap:14px;margin-bottom:28px}
.pin-dot{width:16px;height:16px;border-radius:50%;transition:all .15s}
.numpad{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;width:230px}
.numpad-btn{height:62px;border-radius:12px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-size:22px;font-family:'Bebas Neue',sans-serif;letter-spacing:1px;cursor:pointer;transition:all .15s;display:flex;align-items:center;justify-content:center}
.numpad-btn:hover{background:var(--green3);border-color:var(--gold2)}
.numpad-btn:active{transform:scale(.94)}
.numpad-btn.empty{background:transparent;border-color:transparent;cursor:default}
.numpad-btn.del{font-size:20px;color:var(--muted)}
.pin-error{color:#ff6b6b;font-size:13px;margin-top:16px;font-weight:600;animation:shake .3s ease}
@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}

/* TABLE SELECTOR */
.table-selector{max-width:540px;margin:0 auto;padding:28px 20px}
.page-title{font-family:'Bebas Neue',sans-serif;font-size:34px;letter-spacing:2px;color:var(--gold);margin-bottom:4px}
.page-sub{color:var(--muted);font-size:14px;margin-bottom:24px}
.tables-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}
.table-btn{background:var(--surface2);border:2px solid var(--border);border-radius:12px;padding:16px 6px;cursor:pointer;transition:all .2s;text-align:center;color:var(--text)}
.table-btn:hover{border-color:var(--gold2);background:var(--green3);transform:translateY(-2px)}
.table-btn-num{font-family:'Bebas Neue',sans-serif;font-size:26px;color:var(--gold);line-height:1}
.table-btn-label{font-size:10px;color:var(--muted);margin-top:3px;font-weight:500}

/* CUSTOMER */
.customer{max-width:540px;margin:0 auto;padding:0 0 80px;flex:1}
.welcome{padding:20px 20px 12px}
.welcome-hero{background:linear-gradient(135deg,var(--green2) 0%,var(--green3) 100%);border:1px solid var(--border);border-radius:16px;padding:18px;position:relative;overflow:hidden}
.welcome-hero::before{content:'7';position:absolute;right:-8px;top:-18px;font-family:'Bebas Neue',sans-serif;font-size:130px;color:var(--gold2);opacity:.1;line-height:1;pointer-events:none}
.welcome-hero h1{font-family:'Bebas Neue',sans-serif;font-size:28px;letter-spacing:1px;line-height:1.1}
.welcome-hero h1 span{color:var(--gold)}
.welcome-hero p{color:var(--muted);font-size:13px;margin-top:4px}
.table-badge{display:inline-flex;align-items:center;gap:6px;background:var(--gold)1a;border:1px solid var(--gold2)55;color:var(--gold);border-radius:20px;padding:4px 12px;font-size:12px;margin-top:10px;cursor:pointer;font-weight:600;transition:opacity .2s}
.table-badge:hover{opacity:.75}

/* CLIENT TABS */
.client-tabs{display:flex;gap:0;padding:0 20px 14px;border-bottom:1px solid var(--border);margin-bottom:0}
.client-tab{flex:1;padding:10px;border:none;background:transparent;color:var(--muted);cursor:pointer;font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;border-bottom:2px solid transparent;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:6px}
.client-tab.active{color:var(--gold);border-bottom-color:var(--gold)}
.client-tab-badge{background:var(--gold);color:#061A0D;border-radius:10px;font-size:10px;font-weight:800;padding:1px 6px;min-width:16px;text-align:center}

.cat-scroll{display:flex;gap:8px;padding:14px 20px;overflow-x:auto;scrollbar-width:none}
.cat-scroll::-webkit-scrollbar{display:none}
.cat-btn{white-space:nowrap;padding:6px 14px;border-radius:20px;border:1px solid var(--border);background:transparent;color:var(--muted);cursor:pointer;font-size:13px;font-weight:600;transition:all .2s;flex-shrink:0;font-family:'Barlow Condensed',sans-serif;letter-spacing:.5px;text-transform:uppercase}
.cat-btn.active{background:var(--gold);border-color:var(--gold);color:#061A0D}

.menu-grid{display:flex;flex-direction:column;gap:8px;padding:0 20px}
.menu-card{background:var(--surface2);border:1px solid var(--border);border-radius:14px;display:flex;align-items:center;gap:12px;padding:12px;cursor:pointer;transition:all .2s;position:relative;overflow:hidden}
.menu-card::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--gold2);opacity:0;transition:opacity .2s}
.menu-card:hover{border-color:var(--gold2);background:var(--green3);transform:translateY(-1px)}
.menu-card:hover::before{opacity:1}
.menu-card.unavailable{opacity:.3;pointer-events:none}
.menu-emoji{font-size:32px;width:52px;height:52px;display:flex;align-items:center;justify-content:center;background:var(--green3);border-radius:12px;flex-shrink:0;border:1px solid var(--border)}
.menu-info{flex:1;min-width:0}
.menu-name{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:16px;letter-spacing:.3px}
.menu-desc{color:var(--muted);font-size:12px;margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.menu-price{color:var(--gold);font-weight:700;font-size:15px;margin-top:3px;font-family:'Barlow Condensed',sans-serif}
.menu-add{width:30px;height:30px;border-radius:8px;background:var(--gold);border:none;color:#061A0D;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s;font-weight:900}
.menu-add:hover{background:var(--gold-light);transform:scale(1.1)}
.menu-qty-badge{position:absolute;top:8px;right:8px;background:var(--gold);color:#061A0D;border-radius:10px;font-size:11px;font-weight:800;padding:2px 7px}

/* CART */
.cart-bar{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,var(--gold) 0%,var(--gold2) 100%);color:#061A0D;border:none;border-radius:14px;padding:14px 22px;font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:700;letter-spacing:.5px;cursor:pointer;display:flex;align-items:center;gap:10px;box-shadow:0 8px 32px #F5A62355;z-index:50;transition:transform .2s;width:calc(100% - 32px);max-width:496px;justify-content:space-between;text-transform:uppercase}
.cart-bar:hover{transform:translateX(-50%) translateY(-2px)}
.cart-overlay{position:fixed;inset:0;background:#000c;z-index:200;display:flex;flex-direction:column;justify-content:flex-end}
.cart-sheet{background:var(--green);border-radius:24px 24px 0 0;padding:0 20px 40px;max-height:88vh;overflow-y:auto;border-top:2px solid var(--gold2)}
.cart-handle{width:36px;height:4px;background:var(--border);border-radius:2px;margin:12px auto 18px}
.cart-title{font-family:'Bebas Neue',sans-serif;font-size:24px;letter-spacing:1px;color:var(--gold)}
.cart-sub{color:var(--muted);font-size:13px;margin-bottom:14px}
.cart-item{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)}
.cart-item-name{flex:1;font-size:14px;font-weight:500}
.cart-item-price{color:var(--gold);font-size:15px;font-weight:700;min-width:62px;text-align:right;font-family:'Barlow Condensed',sans-serif}
.qty-ctrl{display:flex;align-items:center;gap:6px}
.qty-btn{width:26px;height:26px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--text);cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;transition:all .15s}
.qty-btn:hover{background:var(--gold);border-color:var(--gold);color:#061A0D}
.qty-val{font-size:15px;font-weight:700;min-width:18px;text-align:center;color:var(--gold);font-family:'Barlow Condensed',sans-serif}
.cart-total{display:flex;justify-content:space-between;padding:12px 0;font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:1px;border-top:1px solid var(--border);margin-top:4px}
.cart-total span:last-child{color:var(--gold)}
.txt-input{width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:11px 14px;color:var(--text);font-size:14px;margin-bottom:10px;outline:none;transition:border-color .2s}
.txt-input:focus{border-color:var(--gold)}
.confirm-btn{width:100%;background:linear-gradient(135deg,var(--gold) 0%,var(--gold2) 100%);border:none;border-radius:12px;padding:15px;color:#061A0D;font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:1px;cursor:pointer;transition:opacity .2s}
.confirm-btn:disabled{opacity:.4;cursor:not-allowed}
.confirm-btn:hover:not(:disabled){opacity:.88}

/* ORDER TRACKING TAB */
.orders-track{padding:16px 20px 100px}
.order-track-card{background:var(--surface2);border:1px solid var(--border);border-radius:14px;margin-bottom:12px;overflow:hidden;border-left:4px solid}
.otc-head{padding:12px 14px;display:flex;align-items:center;justify-content:space-between;background:var(--green2)}
.otc-num{font-family:'Bebas Neue',sans-serif;font-size:20px;color:var(--gold);letter-spacing:1px}
.otc-meta{font-size:12px;color:var(--muted);margin-top:1px}
.otc-badge{padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;font-family:'Barlow Condensed',sans-serif}
.otc-items{padding:8px 14px;border-top:1px solid var(--border)}
.otc-item-row{display:flex;gap:8px;padding:5px 0;font-size:13px;border-bottom:1px solid #0d2a1a}
.otc-item-row:last-child{border-bottom:none}
.otc-item-qty{color:var(--gold);font-weight:700;font-family:'Barlow Condensed',sans-serif;font-size:15px;min-width:22px}
.otc-steps{display:flex;align-items:center;padding:10px 14px;gap:4px}
.otc-step{flex:1;height:4px;border-radius:2px;transition:background .4s}
.otc-step-label{display:flex;justify-content:space-between;padding:0 14px 12px;font-size:11px;color:var(--muted)}
.no-orders{text-align:center;padding:50px 20px;color:var(--muted)}
.no-orders .ni{font-size:44px;margin-bottom:12px}
.no-orders p{font-family:'Bebas Neue',sans-serif;font-size:18px;color:var(--green4);letter-spacing:1px}
.no-orders span{font-size:13px}

/* SUCCESS */
.success-screen{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 24px;text-align:center}
.s-icon{font-size:68px;margin-bottom:14px;animation:pop .5s ease}
@keyframes pop{0%{transform:scale(0)}70%{transform:scale(1.2)}100%{transform:scale(1)}}
.s-num{font-family:'Bebas Neue',sans-serif;font-size:76px;color:var(--gold);line-height:1;letter-spacing:2px}
.s-label{color:var(--muted);font-size:14px;margin:4px 0 14px}
.s-name{font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:1px}
.s-sub{color:var(--muted);font-size:13px;margin-top:4px}
.track-wrap{margin-top:24px;width:100%;max-width:280px}
.track-step{display:flex;align-items:center;gap:10px;padding:7px 0}
.track-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0;transition:background .4s}
.track-line{width:2px;height:20px;background:var(--border);margin-left:4px}
.track-lbl{font-size:14px;font-weight:600}

/* KITCHEN */
.kitchen{padding:20px;flex:1}
.kitch-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:10px}
.kitch-title{font-family:'Bebas Neue',sans-serif;font-size:26px;letter-spacing:1px;color:var(--gold)}
.live-badge{display:flex;align-items:center;gap:6px;background:#4CAF5015;border:1px solid #4CAF5040;color:#4CAF50;border-radius:20px;padding:4px 12px;font-size:12px;font-weight:600}
.live-dot{width:7px;height:7px;border-radius:50%;background:#4CAF50;animation:pulse 1.5s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.2}}
.kitch-cols{display:grid;grid-template-columns:repeat(auto-fill,minmax(275px,1fr));gap:14px}
.order-card{background:var(--surface2);border-radius:14px;border-top:3px solid;overflow:hidden;animation:slideIn .3s ease;border:1px solid var(--border);border-top-width:3px}
@keyframes slideIn{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}
.order-card-head{padding:12px 14px 10px;display:flex;align-items:flex-start;justify-content:space-between;background:var(--green2)}
.order-num{font-family:'Bebas Neue',sans-serif;font-size:22px;color:var(--gold);letter-spacing:1px;line-height:1}
.order-meta{font-size:12px;color:var(--muted);margin-top:2px;font-weight:500}
.order-time-tag{font-size:11px;color:#4a6e55;margin-top:1px}
.order-status-badge{padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;flex-shrink:0;text-transform:uppercase;letter-spacing:.5px;font-family:'Barlow Condensed',sans-serif}
.order-items-list{padding:6px 14px 10px;border-top:1px solid var(--border)}
.order-item-row{display:flex;gap:8px;padding:6px 0;border-bottom:1px solid #0d2a1a;font-size:13px}
.order-item-row:last-child{border-bottom:none}
.order-item-qty{color:var(--gold);font-weight:700;min-width:22px;font-family:'Barlow Condensed',sans-serif;font-size:15px}
.order-actions{padding:10px 14px;display:flex;gap:8px;background:var(--green2)}
.action-btn{flex:1;padding:10px;border-radius:8px;border:none;font-family:'Bebas Neue',sans-serif;font-size:14px;letter-spacing:.5px;cursor:pointer;transition:opacity .2s;text-transform:uppercase}
.action-btn:hover{opacity:.82}
.empty-state{text-align:center;padding:56px 20px}
.empty-state .ei{font-size:48px;margin-bottom:12px}
.empty-state p{font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:1px;color:var(--green4)}
.empty-state span{font-size:13px;color:#2d5e3a}

/* TOAST */
.sound-toast{position:fixed;top:70px;right:16px;background:var(--green2);border:1px solid var(--gold2);border-radius:12px;padding:10px 14px;font-size:13px;color:var(--gold);z-index:400;animation:fadeSlide .3s ease;display:flex;align-items:center;gap:8px;box-shadow:0 4px 24px #00000060;font-weight:600}
@keyframes fadeSlide{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}

/* ADMIN */
.admin{padding:20px;flex:1}
.admin-title{font-family:'Bebas Neue',sans-serif;font-size:26px;letter-spacing:1px;color:var(--gold);margin-bottom:14px}
.admin-tabs{display:flex;gap:2px;background:#051209;border-radius:8px;padding:3px;width:fit-content;margin-bottom:20px}
.admin-tab{padding:7px 18px;border-radius:6px;border:none;cursor:pointer;font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:700;letter-spacing:.5px;transition:all .2s;background:transparent;color:var(--muted);text-transform:uppercase}
.admin-tab.active{background:var(--gold);color:#061A0D}
.stats-row{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;margin-bottom:20px}
.stat-card{background:var(--surface2);border-radius:12px;padding:14px;border:1px solid var(--border)}
.stat-val{font-family:'Bebas Neue',sans-serif;font-size:30px;color:var(--gold);letter-spacing:1px;line-height:1}
.stat-label{color:var(--muted);font-size:11px;margin-top:4px;font-weight:500;text-transform:uppercase;letter-spacing:.5px}
.orders-table{width:100%;border-collapse:collapse}
.orders-table th{text-align:left;padding:9px 10px;color:var(--green4);font-size:11px;font-weight:700;border-bottom:1px solid var(--border);text-transform:uppercase;letter-spacing:.5px;font-family:'Barlow Condensed',sans-serif}
.orders-table td{padding:11px 10px;border-bottom:1px solid var(--border);font-size:13px;vertical-align:middle}
.status-pill{display:inline-block;padding:3px 9px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;font-family:'Barlow Condensed',sans-serif}
.menu-admin-grid{display:flex;flex-direction:column;gap:8px;margin-bottom:14px}
.menu-admin-row{background:var(--surface2);border-radius:12px;padding:12px;display:flex;align-items:center;gap:12px;border:1px solid var(--border);transition:border-color .2s}
.menu-admin-row:hover{border-color:var(--gold2)}
.menu-admin-emoji{font-size:28px;width:44px;height:44px;background:var(--green3);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid var(--border)}
.menu-admin-info{flex:1;min-width:0}
.menu-admin-name{font-weight:600;font-size:14px;font-family:'Barlow Condensed',sans-serif;letter-spacing:.3px}
.menu-admin-cat{color:var(--muted);font-size:12px}
.menu-admin-actions{display:flex;align-items:center;gap:8px}
.icon-btn{width:30px;height:30px;border-radius:7px;border:1px solid var(--border);background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:13px;transition:all .15s;color:var(--muted)}
.icon-btn:hover{background:var(--green3);color:var(--text);border-color:var(--green4)}
.icon-btn.del:hover{background:#ff3b3b18;border-color:#ff4444;color:#ff6b6b}
.toggle{width:38px;height:21px;border-radius:11px;border:none;cursor:pointer;transition:background .2s;position:relative;flex-shrink:0}
.toggle::after{content:'';position:absolute;top:3px;left:3px;width:15px;height:15px;border-radius:50%;background:#fff;transition:transform .2s;box-shadow:0 1px 3px #0005}
.toggle.on{background:var(--gold)}.toggle.on::after{transform:translateX(17px)}
.toggle.off{background:#1a3a27}
.tables-admin-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:10px;margin-bottom:14px}
.table-admin-card{background:var(--surface2);border-radius:12px;padding:12px;text-align:center;border:1px solid var(--border)}
.table-admin-num{font-family:'Bebas Neue',sans-serif;font-size:26px;color:var(--gold);letter-spacing:1px;line-height:1}
.table-admin-pin{font-size:11px;color:var(--green4);margin-top:2px;font-family:'Barlow Condensed',sans-serif;letter-spacing:1px}
.table-admin-sub{font-size:11px;color:var(--muted);margin-top:1px;margin-bottom:8px}
.add-item-btn{display:flex;align-items:center;justify-content:center;gap:8px;background:var(--gold)15;border:1px dashed var(--gold2);border-radius:12px;padding:13px 16px;cursor:pointer;color:var(--gold);font-size:14px;font-weight:600;transition:all .2s;width:100%;font-family:'Barlow Condensed',sans-serif;letter-spacing:.5px;text-transform:uppercase}
.add-item-btn:hover{background:var(--gold)25;border-style:solid}

/* MODAL */
.modal-overlay{position:fixed;inset:0;background:#000c;z-index:300;display:flex;align-items:center;justify-content:center;padding:20px}
.modal{background:var(--green);border-radius:18px;padding:24px;width:100%;max-width:430px;border:1px solid var(--gold2);max-height:90vh;overflow-y:auto}
.modal h3{font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:1px;color:var(--gold);margin-bottom:18px}
.modal-row{margin-bottom:12px}
.modal-label{font-size:11px;color:var(--muted);margin-bottom:5px;text-transform:uppercase;letter-spacing:.6px;font-weight:600}
.modal-input{width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:9px;padding:10px 12px;color:var(--text);font-size:14px;outline:none;transition:border-color .2s}
.modal-input:focus{border-color:var(--gold)}
.modal-footer{display:flex;gap:8px;margin-top:18px}
.modal-cancel{flex:1;padding:11px;border-radius:10px;border:1px solid var(--border);background:transparent;color:var(--muted);cursor:pointer;font-size:13px;font-weight:600;transition:all .2s}
.modal-cancel:hover{background:var(--surface2);color:var(--text)}
.modal-save{flex:2;padding:11px;border-radius:10px;border:none;background:linear-gradient(135deg,var(--gold) 0%,var(--gold2) 100%);color:#061A0D;cursor:pointer;font-family:'Bebas Neue',sans-serif;font-size:16px;letter-spacing:.5px;transition:opacity .2s}
.modal-save:hover{opacity:.88}
.emoji-picker{display:flex;flex-wrap:wrap;gap:5px;padding:8px;background:var(--surface2);border-radius:9px;max-height:96px;overflow-y:auto}
.emoji-opt{width:32px;height:32px;border-radius:7px;border:2px solid transparent;background:transparent;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;transition:all .15s}
.emoji-opt:hover{background:var(--green3)}
.emoji-opt.sel{border-color:var(--gold);background:var(--gold)20}
select.modal-input option{background:var(--green2)}
`;

// ─── PIN NUMPAD COMPONENT ─────────────────────────────────────────────────────
function PinPad({ title, subtitle, onSuccess, correctPin, onBack }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  const attempt = (val) => {
    if (val === correctPin) { setError(false); onSuccess(); }
    else if (val.length === 4) {
      SFX.pinError();
      setError(true);
      setPin("");
      setTimeout(() => setError(false), 1200);
    }
  };
  const press = (d) => {
    SFX.pinPress();
    const next = pin + d;
    setPin(next);
    if (next.length === 4) attempt(next);
  };
  const del = () => setPin(p => p.slice(0, -1));

  return (
    <div className="pin-screen">
      <LogoMark size={64}/>
      <div style={{fontFamily:"Bebas Neue",fontSize:26,letterSpacing:2,color:"var(--gold)",marginTop:14}}>{title}</div>
      <div style={{color:"var(--muted)",fontSize:13,marginBottom:28,marginTop:4}}>{subtitle}</div>
      <div className="pin-dots">
        {[0,1,2,3].map(i => (
          <div key={i} className="pin-dot" style={{
            width:16,height:16,
            background: i < pin.length ? (error ? "#ff4444" : "var(--gold)") : "transparent",
            border: "2px solid " + (error ? "#ff4444" : i < pin.length ? "var(--gold)" : "var(--border)")
          }}/>
        ))}
      </div>
      <div className="numpad">
        {[1,2,3,4,5,6,7,8,9,"back",0,"del"].map((d,i) => {
          if (d === "back") return (
            <button key={i} className="numpad-btn empty" style={{background:"transparent",border:"none"}}/>
          );
          if (d === "del") return (
            <button key={i} className="numpad-btn del" onClick={del}>⌫</button>
          );
          return (
            <button key={i} className="numpad-btn" onClick={() => press(String(d))}>{d}</button>
          );
        })}
      </div>
      {error && <div className="pin-error">PIN incorreto — tente novamente</div>}
      {onBack && (
        <button onClick={onBack} style={{marginTop:24,background:"transparent",border:"none",color:"var(--muted)",cursor:"pointer",fontSize:13,fontWeight:600}}>
          ← Voltar para mesas
        </button>
      )}
    </div>
  );
}

// ─── ORDER TRACKING TAB ───────────────────────────────────────────────────────
function OrderTracking({ table }) {
  const db = useDB();
  const now = useNow();
  const tableOrders = db.orders.filter(o => o.table === table);
  const steps = ["novo","preparando","pronto","entregue"];

  if (tableOrders.length === 0) return (
    <div className="orders-track">
      <div className="no-orders">
        <div className="ni">🍽️</div>
        <p>Nenhum pedido ainda</p>
        <span>Seus pedidos aparecerão aqui</span>
      </div>
    </div>
  );

  return (
    <div className="orders-track">
      {tableOrders.map(order => {
        const si = steps.indexOf(order.status);
        return (
          <div key={order.id} className="order-track-card" style={{borderLeftColor: SC[order.status]}}>
            <div className="otc-head">
              <div>
                <div className="otc-num">Pedido #{order.id}</div>
                <div className="otc-meta">{order.customerName} · {timeAgo(order.createdAt, now)}</div>
              </div>
              <div className="otc-badge" style={{background:SC[order.status]+"22",color:SC[order.status]}}>
                {SL[order.status]}
              </div>
            </div>
            <div className="otc-items">
              {order.items.map((item,i) => (
                <div key={i} className="otc-item-row">
                  <span className="otc-item-qty">×{item.qty}</span>
                  <span>{item.emoji} {item.name}</span>
                  <span style={{marginLeft:"auto",color:"var(--gold)",fontFamily:"Barlow Condensed",fontSize:14}}>R$ {(item.price*item.qty).toFixed(2)}</span>
                </div>
              ))}
              <div style={{display:"flex",justifyContent:"flex-end",paddingTop:6,color:"var(--gold)",fontFamily:"Bebas Neue",fontSize:16,letterSpacing:1}}>
                Total: R$ {order.total.toFixed(2)}
              </div>
            </div>
            {/* Progress bar */}
            <div className="otc-steps">
              {steps.map((s,i) => (
                <div key={s} className="otc-step" style={{background: i<=si ? SC[s] : "var(--border)", marginRight: i<3?4:0}}/>
              ))}
            </div>
            <div className="otc-step-label">
              <span style={{color: si>=0?"var(--gold)":"var(--border)"}}>📋</span>
              <span style={{color: si>=1?"#F5D020":"var(--border)"}}>👨‍🍳</span>
              <span style={{color: si>=2?"#4CAF50":"var(--border)"}}>✅</span>
              <span style={{color: si>=3?"#aaa":"var(--border)"}}>🎊</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── KITCHEN SOUNDS HOOK ──────────────────────────────────────────────────────
function useKitchenSounds(view) {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);
  useEffect(() => {
    if (view !== "cozinha") return;
    const fn = (o) => {
      SFX.newOrder();
      setToast(`Novo pedido #${o.id} — Mesa ${o.table}`);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setToast(null), 3500);
    };
    orderListeners.add(fn);
    return () => { orderListeners.delete(fn); clearTimeout(timerRef.current); };
  }, [view]);
  return toast;
}

// ─── TABLE SELECTOR ───────────────────────────────────────────────────────────
function TableSelector({ onSelect }) {
  const db = useDB();
  return (
    <div className="table-selector">
      <div className="page-title">Escolha sua mesa</div>
      <div className="page-sub">Selecione sua mesa — você precisará do PIN da mesa para entrar</div>
      <div className="tables-grid">
        {db.tables.filter(t => t.active).map(t => (
          <button key={t.id} className="table-btn" onClick={() => onSelect(t.id)}>
            <div className="table-btn-num">{t.id}</div>
            <div className="table-btn-label">🔒 PIN</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── CUSTOMER VIEW ────────────────────────────────────────────────────────────
function CustomerView() {
  const db = useDB();
  const [table, setTable] = useState(null);
  const [tableAuthed, setTableAuthed] = useState(false);
  const [clientTab, setClientTab] = useState("cardapio"); // "cardapio" | "pedidos"
  const [activeCat, setActiveCat] = useState("Todos");
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [name, setName] = useState("");
  const now = useNow();

  const tableOrders = table ? db.orders.filter(o => o.table === table) : [];
  const activeOrders = tableOrders.filter(o => o.status !== "entregue");

  // Step 1: choose table
  if (!table) return <TableSelector onSelect={setTable} />;

  // Step 2: enter table PIN
  if (!tableAuthed) return (
    <PinPad
      title={`Mesa ${table}`}
      subtitle={`Digite o PIN da mesa ${table} para continuar`}
      correctPin={TABLE_PINS[table]}
      onSuccess={() => setTableAuthed(true)}
      onBack={() => setTable(null)}
    />
  );

  const cats = ["Todos", ...new Set(db.menu.map(i => i.category))];
  const filtered = activeCat === "Todos" ? db.menu : db.menu.filter(i => i.category === activeCat);
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const count = cart.reduce((s, i) => s + i.qty, 0);

  const addToCart = (item) => { SFX.addCart(); setCart(prev => { const ex = prev.find(i => i.id === item.id); if (ex) return prev.map(i => i.id === item.id ? {...i,qty:i.qty+1} : i); return [...prev,{...item,qty:1}]; }); };
  const changeQty = (id, d) => setCart(prev => prev.map(i => i.id===id ? {...i,qty:Math.max(0,i.qty+d)} : i).filter(i=>i.qty>0));
  const confirm = () => { addOrder(cart, table, name); setCart([]); setCartOpen(false); setClientTab("pedidos"); };

  return (
    <div className="customer">
      <div className="welcome">
        <div className="welcome-hero">
          <h1>Faça seu<br/><span>Pedido Agora</span></h1>
          <p>Escolha seus itens e confirme direto da mesa</p>
          <div className="table-badge" onClick={() => { setTable(null); setTableAuthed(false); }}>⭐ Mesa {table} · trocar</div>
        </div>
      </div>

      {/* Client tabs */}
      <div className="client-tabs">
        <button className={`client-tab ${clientTab==="cardapio"?"active":""}`} onClick={()=>setClientTab("cardapio")}>
          🍔 Cardápio
        </button>
        <button className={`client-tab ${clientTab==="pedidos"?"active":""}`} onClick={()=>setClientTab("pedidos")}>
          📋 Meus Pedidos
          {activeOrders.length > 0 && <span className="client-tab-badge">{activeOrders.length}</span>}
        </button>
      </div>

      {clientTab === "cardapio" && (
        <>
          <div className="cat-scroll">
            {cats.map(c => <button key={c} className={`cat-btn ${activeCat===c?"active":""}`} onClick={()=>setActiveCat(c)}>{c}</button>)}
          </div>
          <div className="menu-grid">
            {filtered.map(item => {
              const qty = cart.find(i=>i.id===item.id)?.qty||0;
              return (
                <div key={item.id} className={`menu-card ${!item.available?"unavailable":""}`} onClick={()=>item.available&&addToCart(item)}>
                  {qty>0 && <div className="menu-qty-badge">×{qty}</div>}
                  <div className="menu-emoji">{item.emoji}</div>
                  <div className="menu-info">
                    <div className="menu-name">{item.name}</div>
                    <div className="menu-desc">{item.desc}</div>
                    <div className="menu-price">R$ {item.price.toFixed(2)}</div>
                  </div>
                  <button className="menu-add" onClick={e=>{e.stopPropagation();item.available&&addToCart(item);}}>+</button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {clientTab === "pedidos" && <OrderTracking table={table} />}

      {count > 0 && !cartOpen && clientTab === "cardapio" && (
        <button className="cart-bar" onClick={()=>setCartOpen(true)}>
          <span>🛒 {count} {count===1?"item":"itens"}</span>
          <span>Ver carrinho · R$ {total.toFixed(2)}</span>
        </button>
      )}

      {cartOpen && (
        <div className="cart-overlay" onClick={e=>e.target===e.currentTarget&&setCartOpen(false)}>
          <div className="cart-sheet">
            <div className="cart-handle"/>
            <div className="cart-title">Seu Pedido</div>
            <div className="cart-sub">Mesa {table} · Seven Sport Bar</div>
            {cart.map(item => (
              <div key={item.id} className="cart-item">
                <span style={{fontSize:22}}>{item.emoji}</span>
                <span className="cart-item-name">{item.name}</span>
                <div className="qty-ctrl">
                  <button className="qty-btn" onClick={()=>changeQty(item.id,-1)}>−</button>
                  <span className="qty-val">{item.qty}</span>
                  <button className="qty-btn" onClick={()=>changeQty(item.id,+1)}>+</button>
                </div>
                <span className="cart-item-price">R$ {(item.price*item.qty).toFixed(2)}</span>
              </div>
            ))}
            <div className="cart-total"><span>Total</span><span>R$ {total.toFixed(2)}</span></div>
            <input
              className="txt-input"
              placeholder="Seu nome *"
              value={name}
              onChange={e=>setName(e.target.value)}
              style={{borderColor: name.trim()===""?"#ff444455":""}}
            />
            <button className="confirm-btn" onClick={confirm} disabled={cart.length===0||!name.trim()}>
              Confirmar Pedido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── KITCHEN VIEW ─────────────────────────────────────────────────────────────
function KitchenView({ view }) {
  const db = useDB();
  const now = useNow();
  const toast = useKitchenSounds(view);
  const active = db.orders.filter(o => o.status !== "entregue");

  return (
    <div className="kitchen">
      {toast && <div className="sound-toast">🔔 {toast}</div>}
      <div className="kitch-header">
        <div className="kitch-title">⚡ Cozinha</div>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <span style={{color:"var(--muted)",fontSize:13,fontWeight:600}}>{active.length} ativo{active.length!==1?"s":""}</span>
          <div className="live-badge"><div className="live-dot"/>AO VIVO</div>
        </div>
      </div>
      {active.length === 0 ? (
        <div className="empty-state">
          <div className="ei">😴</div>
          <p>Nenhum pedido pendente</p>
          <span>Os novos pedidos aparecem aqui automaticamente</span>
        </div>
      ) : (
        <div className="kitch-cols">
          {active.map(order => (
            <div key={order.id} className="order-card" style={{borderTopColor: SC[order.status]}}>
              <div className="order-card-head">
                <div>
                  <div className="order-num">#{order.id}</div>
                  <div className="order-meta">Mesa {order.table} · {order.customerName}</div>
                  <div className="order-time-tag">⏱ {timeAgo(order.createdAt, now)}</div>
                </div>
                <div className="order-status-badge" style={{background:SC[order.status]+"22",color:SC[order.status]}}>
                  {SL[order.status]}
                </div>
              </div>
              <div className="order-items-list">
                {order.items.map((item,i) => (
                  <div key={i} className="order-item-row">
                    <span className="order-item-qty">×{item.qty}</span>
                    <span>{item.emoji} {item.name}</span>
                  </div>
                ))}
              </div>
              {SN[order.status] && (
                <div className="order-actions">
                  <button
                    className="action-btn"
                    style={{background:SC[SN[order.status]],color:"#061A0D"}}
                    onClick={()=>updateOrderStatus(order.id,SN[order.status])}
                  >
                    {SNL[order.status]}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── MENU ITEM MODAL ──────────────────────────────────────────────────────────
function MenuItemModal({ item, onSave, onClose }) {
  const [form, setForm] = useState({name:item?.name||"",category:item?.category||"Lanches",price:item?.price||"",desc:item?.desc||"",emoji:item?.emoji||"🍔"});
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const valid = form.name.trim() && parseFloat(form.price)>0;
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <h3>{item?"✏️ Editar item":"⭐ Novo item"}</h3>
        <div className="modal-row">
          <div className="modal-label">Emoji</div>
          <div className="emoji-picker">
            {EMOJIS.map(e=><button key={e} className={`emoji-opt ${form.emoji===e?"sel":""}`} onClick={()=>set("emoji",e)}>{e}</button>)}
          </div>
        </div>
        <div className="modal-row"><div className="modal-label">Nome</div><input className="modal-input" value={form.name} onChange={e=>set("name",e.target.value)} placeholder="Ex: X-Burguer"/></div>
        <div className="modal-row"><div className="modal-label">Descrição</div><input className="modal-input" value={form.desc} onChange={e=>set("desc",e.target.value)} placeholder="Ingredientes ou descrição breve"/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div className="modal-row"><div className="modal-label">Preço (R$)</div><input className="modal-input" type="number" step="0.10" min="0" value={form.price} onChange={e=>set("price",e.target.value)} placeholder="0.00"/></div>
          <div className="modal-row"><div className="modal-label">Categoria</div><select className="modal-input" value={form.category} onChange={e=>set("category",e.target.value)}>{CATS.map(c=><option key={c}>{c}</option>)}</select></div>
        </div>
        <div className="modal-footer">
          <button className="modal-cancel" onClick={onClose}>Cancelar</button>
          <button className="modal-save" disabled={!valid} style={{opacity:valid?1:.5}} onClick={()=>{onSave({...form,price:parseFloat(form.price)});onClose();}}>Salvar</button>
        </div>
      </div>
    </div>
  );
}

// ─── ADMIN VIEW ───────────────────────────────────────────────────────────────
function AdminView() {
  const db = useDB();
  const [tab, setTab] = useState("pedidos");
  const [editItem, setEditItem] = useState(null);
  const now = useNow();

  const revenue   = db.orders.filter(o=>o.status==="entregue").reduce((s,o)=>s+o.total,0);
  const pending   = db.orders.filter(o=>["novo","preparando"].includes(o.status)).length;
  const delivered = db.orders.filter(o=>o.status==="entregue").length;
  const handleSave = (data) => { if(editItem==="new") addMenuItem(data); else updateMenuItem(editItem.id,data); };

  return (
    <div className="admin">
      {editItem && <MenuItemModal item={editItem==="new"?null:editItem} onSave={handleSave} onClose={()=>setEditItem(null)}/>}
      <div className="admin-title">⚙️ Painel Admin</div>
      <div className="stats-row">
        <div className="stat-card"><div className="stat-val">{db.orders.length}</div><div className="stat-label">Total pedidos</div></div>
        <div className="stat-card"><div className="stat-val" style={{color:"#F5D020"}}>{pending}</div><div className="stat-label">Em andamento</div></div>
        <div className="stat-card"><div className="stat-val" style={{color:"#4CAF50"}}>{delivered}</div><div className="stat-label">Entregues</div></div>
        <div className="stat-card"><div className="stat-val">R${revenue.toFixed(0)}</div><div className="stat-label">Faturamento</div></div>
      </div>
      <div className="admin-tabs">
        {["pedidos","cardapio","mesas"].map(t=>(
          <button key={t} className={`admin-tab ${tab===t?"active":""}`} onClick={()=>setTab(t)}>
            {t.charAt(0).toUpperCase()+t.slice(1)}
          </button>
        ))}
      </div>

      {tab==="pedidos" && (
        db.orders.length===0
          ? <div className="empty-state"><div className="ei">📋</div><p>Nenhum pedido ainda</p></div>
          : <div style={{overflowX:"auto"}}>
              <table className="orders-table">
                <thead><tr><th>#</th><th>Cliente</th><th>Mesa</th><th>Itens</th><th>Total</th><th>Status</th><th>Tempo</th></tr></thead>
                <tbody>
                  {db.orders.map(o=>(
                    <tr key={o.id}>
                      <td style={{fontFamily:"Bebas Neue",fontSize:18,color:"var(--gold)",letterSpacing:1}}>#{o.id}</td>
                      <td>{o.customerName}</td>
                      <td style={{fontWeight:600}}>Mesa {o.table}</td>
                      <td style={{color:"var(--muted)",maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.items.map(i=>`${i.qty}x ${i.name}`).join(", ")}</td>
                      <td style={{color:"var(--gold)",fontWeight:700,fontFamily:"Barlow Condensed",fontSize:15}}>R$ {o.total.toFixed(2)}</td>
                      <td><span className="status-pill" style={{background:SC[o.status]+"22",color:SC[o.status]}}>{SL[o.status]}</span></td>
                      <td style={{color:"#3a6048"}}>{timeAgo(o.createdAt,now)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
      )}

      {tab==="cardapio" && (
        <>
          <div className="menu-admin-grid">
            {db.menu.map(item=>(
              <div key={item.id} className="menu-admin-row">
                <div className="menu-admin-emoji">{item.emoji}</div>
                <div className="menu-admin-info">
                  <div className="menu-admin-name">{item.name}</div>
                  <div className="menu-admin-cat">{item.category} · R$ {item.price.toFixed(2)}</div>
                </div>
                <div className="menu-admin-actions">
                  <button className="icon-btn" onClick={()=>setEditItem(item)}>✏️</button>
                  <button className="icon-btn del" onClick={()=>deleteMenuItem(item.id)}>🗑</button>
                  <button className={`toggle ${item.available?"on":"off"}`} onClick={()=>updateMenuItem(item.id,{available:!item.available})}/>
                </div>
              </div>
            ))}
          </div>
          <button className="add-item-btn" onClick={()=>setEditItem("new")}>⭐ Adicionar item ao cardápio</button>
        </>
      )}

      {tab==="mesas" && (
        <>
          <div className="tables-admin-grid">
            {db.tables.map(t=>{
              const ao = db.orders.filter(o=>o.table===t.id&&o.status!=="entregue");
              return (
                <div key={t.id} className="table-admin-card" style={{borderColor:ao.length>0?"var(--gold2)":"var(--border)"}}>
                  <div className="table-admin-num">{t.id}</div>
                  <div className="table-admin-pin">PIN: {TABLE_PINS[t.id]}</div>
                  <div className="table-admin-sub" style={{color:!t.active?"#2a4a35":ao.length>0?"#F5D020":"var(--muted)"}}>
                    {!t.active?"desativada":ao.length>0?`${ao.length} pedido${ao.length>1?"s":""}` :"livre"}
                  </div>
                  <div style={{display:"flex",justifyContent:"center"}}>
                    <button className={`toggle ${t.active?"on":"off"}`} onClick={()=>{const i=DB.tables.findIndex(x=>x.id===t.id);if(i>-1){DB.tables[i].active=!DB.tables[i].active;notify();}}}/>
                  </div>
                </div>
              );
            })}
          </div>
          <p style={{color:"var(--muted)",fontSize:12}}>Os PINs ficam impressos em cada mesa. Desative mesas fora de uso.</p>
        </>
      )}
    </div>
  );
}

// ─── STAFF PIN LOGIN ──────────────────────────────────────────────────────────
function InternalPanel({ onBack }) {
  const db = useDB();
  const [view, setView] = useState("cozinha");
  const [authed, setAuthed] = useState(false);
  const pending = db.orders.filter(o=>["novo","preparando"].includes(o.status)).length;

  if (!authed) return (
    <div className="app"><style>{G}</style>
      <PinPad
        title="Acesso Interno"
        subtitle="Digite o PIN de funcionário para continuar"
        correctPin="7109"
        onSuccess={()=>setAuthed(true)}
        onBack={onBack}
      />
    </div>
  );

  return (
    <div className="app">
      <style>{G}</style>
      <nav className="nav">
        <div className="nav-brand">
          <LogoMark size={38}/>
          <div className="nav-name">Seven <span>Interno</span></div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div className="nav-tabs">
            {[{id:"cozinha",label:"Cozinha"},{id:"admin",label:"Admin"}].map(t=>(
              <button key={t.id} className={`nav-tab ${view===t.id?"active":""}`} onClick={()=>setView(t.id)}>
                {t.label}
                {t.id==="cozinha"&&pending>0&&<span className="nav-badge">{pending}</span>}
              </button>
            ))}
          </div>
          <button onClick={()=>{setAuthed(false);onBack();}} style={{background:"transparent",border:"1px solid var(--border)",borderRadius:8,padding:"6px 10px",color:"var(--muted)",cursor:"pointer",fontSize:12,fontWeight:600,whiteSpace:"nowrap"}}>
            ← Sair
          </button>
        </div>
      </nav>
      {view==="cozinha" && <KitchenView view={view}/>}
      {view==="admin"   && <AdminView/>}
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [mode, setMode] = useState("cliente");

  if (mode === "interno") return <InternalPanel onBack={()=>setMode("cliente")}/>;

  return (
    <div className="app">
      <style>{G}</style>
      <nav className="nav">
        <div className="nav-brand">
          <LogoMark size={38}/>
          <div className="nav-name">Seven <span>Sport Bar</span></div>
        </div>
        <button onClick={()=>setMode("interno")} style={{background:"transparent",border:"1px solid var(--border)",borderRadius:8,padding:"6px 12px",color:"var(--muted)",cursor:"pointer",fontSize:12,fontWeight:600,flexShrink:0}}>
          🔒 Interno
        </button>
      </nav>
      <CustomerView/>
    </div>
  );
}
