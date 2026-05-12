import { useState, useEffect, useRef, useCallback } from "react";

// ═══════════════════════════════════════════════════
// CONSTANTS & DATA
// ═══════════════════════════════════════════════════
const GRID = 5;
const CELL = 64;
const GAP  = 4;

const TIERS  = ['Common','Rare','Epic','Legendary','Mythic'];
const TC     = ['#94a3b8','#3b82f6','#a855f7','#f59e0b','#ec4899'];
const TBG    = ['rgba(148,163,184,0.18)','rgba(59,130,246,0.18)','rgba(168,85,247,0.18)','rgba(245,158,11,0.18)','rgba(236,72,153,0.18)'];
const TGLOW  = ['rgba(148,163,184,0.5)','rgba(59,130,246,0.55)','rgba(168,85,247,0.6)','rgba(245,158,11,0.6)','rgba(236,72,153,0.65)'];

const ITEMS = [
  {id:'fire', e:'🔥', n:'Ember' },
  {id:'ice',  e:'❄️',  n:'Frost' },
  {id:'bolt', e:'⚡', n:'Spark' },
  {id:'leaf', e:'🌿', n:'Leaf'  },
  {id:'gem',  e:'💎', n:'Shard' },
];

const LEVEL_UNLOCKS = [null, {id:'bolt',e:'⚡',n:'Spark'}, {id:'leaf',e:'🌿',n:'Leaf'}, {id:'gem',e:'💎',n:'Shard'}, null, null];

const LEVELS = [
  {goal:{tier:2,count:1}, desc:'Create 1 Epic item',     reward:150},
  {goal:{tier:2,count:3}, desc:'Create 3 Epic items',    reward:200},
  {goal:{tier:3,count:1}, desc:'Create 1 Legendary',     reward:300},
  {goal:{tier:3,count:2}, desc:'2 Legendary items!',     reward:400},
  {goal:{tier:4,count:1}, desc:'Create the Mythic!',     reward:600},
  {goal:{tier:4,count:2}, desc:'2 Mythic items!!',       reward:800},
];

const LB_DATA = [
  {n:'StarForge',     s:98420},
  {n:'NovaMerger',   s:87300},
  {n:'CrystalKnight',s:75100},
  {n:'VoidWeaver',   s:61800},
  {n:'ArcaneSmith',  s:55400},
  {n:'EtherBound',   s:44200},
  {n:'RuneMaster',   s:38900},
];

// ═══════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════
function uid() { return Math.random().toString(36).slice(2, 9); }
function mkItem(type, tier) { return { type, tier, id: uid() }; }
function emptyGrid() { return Array(GRID).fill(null).map(() => Array(GRID).fill(null)); }

// ═══════════════════════════════════════════════════
// AUDIO ENGINE
// ═══════════════════════════════════════════════════
let audioCtx = null;
function getAC() {
  if (!audioCtx) try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){}
  return audioCtx;
}
function playTone(freq, dur, type = 'sine', vol = 0.25, freqEnd = null) {
  const c = getAC(); if (!c) return;
  try {
    const o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination);
    o.type = type;
    o.frequency.setValueAtTime(freq, c.currentTime);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, c.currentTime + dur * 0.6);
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.start(); o.stop(c.currentTime + dur);
  } catch(e){}
}
const NOTES = [262, 330, 392, 523, 659];
function sndMerge(tier) { playTone(NOTES[tier], 0.38, 'sine', 0.28, NOTES[tier] * 2); }
function sndClick() { playTone(500, 0.07, 'triangle', 0.1); }
function sndWin() { [0,1,2,3,4].forEach(i => setTimeout(() => playTone(NOTES[i], 0.22, 'sine', 0.15), i * 90)); }
function sndFail() { playTone(200, 0.15, 'sawtooth', 0.12, 180); }

// ═══════════════════════════════════════════════════
// CSS ANIMATIONS
// ═══════════════════════════════════════════════════
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Exo+2:wght@400;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
body,html{overflow:hidden}
@keyframes twinkle{0%,100%{opacity:0.15}50%{opacity:1}}
@keyframes pulse{0%,100%{transform:scale(1) translateZ(0)}50%{transform:scale(1.09) translateZ(0)}}
@keyframes pop{0%{transform:scale(0.2) rotate(-10deg);opacity:0}65%{transform:scale(1.18) rotate(3deg)}100%{transform:scale(1) rotate(0);opacity:1}}
@keyframes particle{0%{opacity:1;transform:translate(var(--sx),var(--sy)) scale(1)}100%{opacity:0;transform:translate(var(--ex),var(--ey)) scale(0)}}
@keyframes flashbright{0%,30%{filter:brightness(2.5) saturate(2)}100%{filter:brightness(1) saturate(1)}}
@keyframes slideUp{from{transform:translateY(50px);opacity:0}to{transform:translateY(0);opacity:1}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes bounceIn{0%{transform:scale(0.6) translateY(30px);opacity:0}70%{transform:scale(1.04) translateY(-4px)}100%{transform:scale(1) translateY(0);opacity:1}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
@keyframes shimmer{0%{background-position:200% center}100%{background-position:-200% center}}
@keyframes ringPulse{0%{transform:scale(0.8);opacity:0.9}100%{transform:scale(2);opacity:0}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
.sel-cell{animation:pulse 0.55s infinite ease-in-out!important}
.pop-cell{animation:pop 0.42s cubic-bezier(0.34,1.56,0.64,1) forwards!important}
.flash-cell{animation:flashbright 0.42s forwards!important}
.shake-cell{animation:shake 0.28s ease!important}
.float-el{animation:float 2.2s ease-in-out infinite}
.spin-el{animation:spin 12s linear infinite}
`;

// ═══════════════════════════════════════════════════
// STAR FIELD
// ═══════════════════════════════════════════════════
function StarField() {
  const stars = useRef(
    Array.from({ length: 70 }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      s: 0.5 + Math.random() * 1.8,
      d: Math.random() * 4,
      dur: 1.5 + Math.random() * 2.5,
    }))
  ).current;
  return (
    <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:0 }}>
      {stars.map((s, i) => (
        <div key={i} style={{
          position:'absolute', left:`${s.x}%`, top:`${s.y}%`,
          width:s.s, height:s.s, borderRadius:'50%', background:'#fff',
          animation:`twinkle ${s.dur}s ${s.d}s infinite ease-in-out`,
        }}/>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// ITEM DISPLAY
// ═══════════════════════════════════════════════════
function ItemDisplay({ item }) {
  const meta = ITEMS.find(x => x.id === item.type);
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
      <div style={{
        fontSize: 28, lineHeight: 1,
        filter: `drop-shadow(0 0 6px ${TGLOW[item.tier]})`,
      }}>
        {meta?.e}
      </div>
      <div style={{ display:'flex', gap:2 }}>
        {Array.from({ length: item.tier + 1 }, (_, i) => (
          <div key={i} style={{
            width: 4, height: 4, borderRadius:'50%',
            background: TC[item.tier],
            boxShadow: `0 0 4px ${TC[item.tier]}`,
          }}/>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// CELL COMPONENT
// ═══════════════════════════════════════════════════
function Cell({ cell, isSel, isFlash, isPop, isShake, onClick }) {
  const clsList = [];
  if (isSel)   clsList.push('sel-cell');
  if (isPop)   clsList.push('pop-cell');
  if (isFlash) clsList.push('flash-cell');
  if (isShake) clsList.push('shake-cell');
  const cls = clsList.join(' ');

  return (
    <div
      className={cls}
      onClick={onClick}
      style={{
        width: CELL, height: CELL, borderRadius: 14,
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        cursor:'pointer', position:'relative', transition:'box-shadow 0.2s, background 0.2s',
        background: cell ? TBG[cell.tier] : isSel ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.025)',
        border: cell
          ? `1.5px solid ${TC[cell.tier]}60`
          : isSel ? '1.5px dashed rgba(255,255,255,0.25)' : '1px solid rgba(255,255,255,0.07)',
        boxShadow: cell
          ? `0 0 ${isSel ? 18 : 8}px ${TGLOW[cell.tier]}${isSel ? '' : '80'}, inset 0 1px 0 rgba(255,255,255,0.08)`
          : 'none',
      }}
    >
      {cell && <ItemDisplay item={cell} />}
      {isSel && !cell && (
        <div style={{ color:'rgba(255,255,255,0.2)', fontSize:20 }}>+</div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// PARTICLE SYSTEM
// ═══════════════════════════════════════════════════
function Particles({ particles }) {
  return (
    <>
      {particles.map(p => (
        <div key={p.id} style={{
          position:'absolute', left: p.ox, top: p.oy,
          width: p.size, height: p.size, borderRadius:'50%',
          background: p.color, boxShadow:`0 0 5px ${p.color}`,
          pointerEvents:'none',
          '--sx':0,'--sy':0,
          '--ex':`${p.dx}px`,'--ey':`${p.dy}px`,
          animation:`particle ${p.dur}ms forwards ease-out`,
          transform:'translate(-50%,-50%)',
          zIndex:20,
        }}/>
      ))}
      {particles.filter(p => p.ring).map(p => (
        <div key={`ring-${p.id}`} style={{
          position:'absolute', left: p.ox, top: p.oy,
          width: 48, height: 48,
          borderRadius:'50%',
          border: `2px solid ${p.color}`,
          pointerEvents:'none',
          animation:'ringPulse 0.5s forwards ease-out',
          transform:'translate(-50%,-50%)',
          zIndex:19,
        }}/>
      ))}
    </>
  );
}

// ═══════════════════════════════════════════════════
// MODAL OVERLAY
// ═══════════════════════════════════════════════════
function Overlay({ children, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position:'fixed', inset:0, zIndex:200,
        background:'rgba(2,0,20,0.88)',
        backdropFilter:'blur(8px)',
        display:'flex', alignItems:'center', justifyContent:'center',
        animation:'fadeIn 0.18s ease',
        padding:'0 16px',
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{ animation:'bounceIn 0.38s cubic-bezier(0.34,1.56,0.64,1)', width:'100%', maxWidth:360 }}>
        {children}
      </div>
    </div>
  );
}

function ModalBox({ title, children, accent = '#a855f7' }) {
  return (
    <div style={{
      background:'linear-gradient(145deg,#0c0022,#180042)',
      border:`1px solid ${accent}40`,
      borderRadius:24,
      boxShadow:`0 0 60px ${accent}25, 0 8px 32px rgba(0,0,0,0.6)`,
      overflow:'hidden',
    }}>
      {title && (
        <div style={{
          padding:'14px 20px 10px',
          background:`linear-gradient(180deg,${accent}18,transparent)`,
          borderBottom:'1px solid rgba(255,255,255,0.07)',
          fontFamily:"'Orbitron',sans-serif",
          fontSize:13, fontWeight:900, letterSpacing:2.5,
          color:'#e9d9ff', textShadow:`0 0 16px ${accent}`,
        }}>
          {title}
        </div>
      )}
      <div style={{ padding:'14px 18px 18px' }}>{children}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// SHOP MODAL
// ═══════════════════════════════════════════════════
function ShopModal({ coins, gems, onBuyCommon, onBuyRare, onBuyCoins, onClose }) {
  const items = [
    { icon:'🌀', title:'Random Summon', desc:'Spawn a random Common item', costI:'🪙', cost:30, onClick:onBuyCommon, disabled:coins<30 },
    { icon:'✨', title:'Rare Summon',   desc:'Get a guaranteed Rare (tier 2)', costI:'💎', cost:1, onClick:onBuyRare, disabled:gems<1 },
    { icon:'💰', title:'Coin Bundle',   desc:'+500 gold coins',  costI:'💎', cost:3, onClick:()=>onBuyCoins(3), disabled:gems<3 },
    { icon:'💎', title:'Gem Pack',      desc:'+10 premium gems', costI:'💎', cost:10, onClick:()=>onBuyCoins(10,true), disabled:gems<10 },
  ];
  return (
    <ModalBox title="🛒  ARCANE SHOP">
      <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
        {items.map(it => (
          <div
            key={it.title}
            onClick={it.disabled ? undefined : it.onClick}
            style={{
              display:'flex', alignItems:'center', gap:11,
              background: it.disabled ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)',
              border:`1px solid rgba(255,255,255,${it.disabled?'0.05':'0.1'})`,
              borderRadius:14, padding:'10px 13px',
              cursor: it.disabled ? 'not-allowed' : 'pointer',
              opacity: it.disabled ? 0.45 : 1,
              transition:'all 0.15s',
            }}
          >
            <div style={{ fontSize:26 }}>{it.icon}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#e2e8f0' }}>{it.title}</div>
              <div style={{ fontSize:11, color:'#64748b' }}>{it.desc}</div>
            </div>
            <div style={{
              display:'flex', alignItems:'center', gap:3,
              background:'rgba(255,255,255,0.09)', borderRadius:99,
              padding:'3px 10px', fontSize:12, fontWeight:700, flexShrink:0,
            }}>
              <span>{it.costI}</span><span>{it.cost}</span>
            </div>
          </div>
        ))}
        <button onClick={onClose} style={btnStyle('ghost')}>Close</button>
      </div>
    </ModalBox>
  );
}

// ═══════════════════════════════════════════════════
// LEADERBOARD MODAL
// ═══════════════════════════════════════════════════
function LBModal({ score, onClose }) {
  const full = [...LB_DATA, { n:'You ★', s:score, you:true }].sort((a,b)=>b.s-a.s);
  const medals = ['🥇','🥈','🥉'];
  return (
    <ModalBox title="🏆  LEADERBOARD" accent="#f59e0b">
      <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:320, overflowY:'auto' }}>
        {full.map((e, i) => (
          <div key={e.n} style={{
            display:'flex', alignItems:'center', gap:10,
            background: e.you ? 'rgba(168,85,247,0.14)' : 'rgba(255,255,255,0.03)',
            border: e.you ? '1px solid rgba(168,85,247,0.4)' : '1px solid rgba(255,255,255,0.05)',
            borderRadius:12, padding:'8px 12px',
          }}>
            <div style={{
              width:24, height:24, borderRadius:'50%', flexShrink:0,
              background: i===0?'#f59e0b':i===1?'#94a3b8':i===2?'#cd7c4f':'rgba(255,255,255,0.08)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:11, fontWeight:900,
            }}>
              {i < 3 ? medals[i] : i+1}
            </div>
            <div style={{ flex:1, fontSize:13, fontWeight:e.you?700:500, color:e.you?'#c4b5fd':'#e2e8f0' }}>
              {e.n}
            </div>
            <div style={{ fontSize:12, fontWeight:700, color:'#f59e0b' }}>{e.s.toLocaleString()}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop:12 }}>
        <button onClick={onClose} style={btnStyle('ghost')}>Close</button>
      </div>
    </ModalBox>
  );
}

// ═══════════════════════════════════════════════════
// DAILY REWARD MODAL
// ═══════════════════════════════════════════════════
function DailyModal({ done, onClaim, onClose }) {
  const rewards = [
    {icon:'🪙',label:'+200 Coins'}, {icon:'💎',label:'+5 Gems'}, {icon:'⭐',label:'Bonus XP'},
  ];
  return (
    <ModalBox title="🎁  DAILY REWARD" accent="#ec4899">
      <div style={{ textAlign:'center' }}>
        <p style={{ fontSize:11, color:'#64748b', marginBottom:14 }}>Login every day to claim bonus rewards!</p>
        <div style={{ display:'flex', gap:8, justifyContent:'center', marginBottom:16 }}>
          {rewards.map(r => (
            <div key={r.label} style={{
              background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)',
              borderRadius:14, padding:'10px 10px', flex:1,
            }}>
              <div style={{ fontSize:24, marginBottom:4 }}>{r.icon}</div>
              <div style={{ fontSize:9, color:'#94a3b8', fontWeight:700, letterSpacing:0.5 }}>{r.label}</div>
            </div>
          ))}
        </div>
        {done ? (
          <div style={{
            background:'rgba(255,255,255,0.04)', borderRadius:12, padding:10,
            color:'#64748b', fontSize:12, marginBottom:10,
          }}>
            ✓ Already claimed today
          </div>
        ) : (
          <button onClick={onClaim} style={btnStyle('primary', '#ec4899', '#a855f7')}>
            ✨ Claim Reward!
          </button>
        )}
        <button onClick={onClose} style={{ ...btnStyle('ghost'), marginTop:8 }}>
          {done ? 'Close' : 'Maybe Later'}
        </button>
      </div>
    </ModalBox>
  );
}

// ═══════════════════════════════════════════════════
// LEVEL WIN MODAL
// ═══════════════════════════════════════════════════
function WinModal({ lvl, reward, unlocked, onNext }) {
  return (
    <ModalBox accent="#f59e0b">
      <div style={{ textAlign:'center' }}>
        <div className="float-el" style={{ fontSize:52, marginBottom:8 }}>🏆</div>
        <div style={{
          fontFamily:"'Orbitron',sans-serif", fontSize:16, fontWeight:900,
          color:'#f59e0b', letterSpacing:2, textShadow:'0 0 20px #f59e0b90',
          marginBottom:4,
        }}>LEVEL {lvl+1} COMPLETE!</div>
        <p style={{ fontSize:11, color:'#94a3b8', marginBottom:16 }}>Outstanding merge mastery!</p>

        <div style={{
          display:'inline-flex', alignItems:'center', gap:12,
          background:'rgba(245,158,11,0.12)', border:'1px solid rgba(245,158,11,0.35)',
          borderRadius:14, padding:'10px 20px', marginBottom:unlocked?12:16,
        }}>
          <div style={{ fontSize:11, color:'#94a3b8' }}>Rewards</div>
          <div style={{ fontSize:17, fontWeight:700, color:'#f59e0b' }}>🪙 {reward}</div>
          <div style={{ fontSize:17, fontWeight:700, color:'#a855f7' }}>💎 +2</div>
        </div>

        {unlocked && (
          <div style={{
            background:'rgba(168,85,247,0.12)', border:'1px solid rgba(168,85,247,0.35)',
            borderRadius:14, padding:'10px 20px', marginBottom:16,
          }}>
            <div style={{ fontSize:10, color:'#94a3b8', marginBottom:4 }}>NEW ITEM UNLOCKED</div>
            <div style={{ fontSize:30 }}>{unlocked.e}</div>
            <div style={{ fontSize:13, fontWeight:700, color:'#c4b5fd' }}>{unlocked.n}</div>
          </div>
        )}

        <button onClick={onNext} style={btnStyle('primary', '#7c3aed', '#a855f7')}>
          Next Level →
        </button>
      </div>
    </ModalBox>
  );
}

// ═══════════════════════════════════════════════════
// BUTTON HELPERS
// ═══════════════════════════════════════════════════
function btnStyle(type, c1='#a855f7', c2='#7c3aed') {
  if (type === 'primary') return {
    background:`linear-gradient(135deg,${c1},${c2})`,
    border:'none', color:'white', borderRadius:14,
    padding:'12px 0', cursor:'pointer', fontSize:14, fontWeight:700,
    boxShadow:`0 0 22px ${c1}50`, width:'100%', display:'block',
    marginBottom:0, fontFamily:"'Exo 2',sans-serif",
  };
  return {
    background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)',
    color:'#94a3b8', borderRadius:12, padding:'8px 0',
    cursor:'pointer', fontSize:12, width:'100%', display:'block',
    fontFamily:"'Exo 2',sans-serif",
  };
}

// ═══════════════════════════════════════════════════
// MAIN GAME
// ═══════════════════════════════════════════════════
export default function App() {
  // ── State ──────────────────────────────────────
  const [grid, setGrid] = useState(() => {
    const g = emptyGrid();
    const starts = [[0,0,'fire'],[0,2,'ice'],[1,1,'fire'],[1,3,'ice'],[2,0,'fire'],[2,2,'ice'],[3,1,'fire'],[3,3,'ice'],[4,0,'ice'],[4,4,'fire']];
    starts.forEach(([r,c,t]) => { g[r][c] = mkItem(t, 0); });
    return g;
  });
  const [sel,      setSel]      = useState(null);
  const [coins,    setCoins]    = useState(500);
  const [gems,     setGems]     = useState(10);
  const [score,    setScore]    = useState(0);
  const [lvl,      setLvl]      = useState(0);
  const [screen,   setScreen]   = useState('game');
  const [particles,setParticles]= useState([]);
  const [flash,    setFlash]    = useState(null);
  const [pop,      setPop]      = useState(null);
  const [shake,    setShake]    = useState(null);
  const [unlocked, setUnlocked] = useState(['fire','ice']);
  const [dailyDone,setDailyDone]= useState(false);
  const pid = useRef(0);
  const gridRef = useRef(null);

  // Show daily on mount
  useEffect(() => { setTimeout(() => setScreen('daily'), 700); }, []);

  // ── Goal tracking ──────────────────────────────
  const ldata    = LEVELS[Math.min(lvl, LEVELS.length - 1)];
  const goalCnt  = grid.flat().filter(c => c && c.tier >= ldata.goal.tier).length;
  const goalPct  = Math.min(100, (goalCnt / ldata.goal.count) * 100);

  useEffect(() => {
    if (lvl >= LEVELS.length) return;
    if (goalCnt >= ldata.goal.count && screen === 'game') {
      sndWin();
      setTimeout(() => setScreen('win'), 700);
    }
  }, [goalCnt, screen, lvl]);

  // ── Particle spawner ───────────────────────────
  function spawnParticles(r, c, tier) {
    if (!gridRef.current) return;
    const stride = CELL + GAP;
    const cx = c * stride + CELL / 2 + 10;
    const cy = r * stride + CELL / 2 + 10;

    const ps = Array.from({ length: 16 }, (_, i) => {
      const angle = (i / 16) * Math.PI * 2;
      const dist  = 28 + Math.random() * 26;
      return {
        id:    ++pid.current,
        ox:    cx, oy: cy,
        dx:    Math.cos(angle) * dist,
        dy:    Math.sin(angle) * dist,
        color: TC[tier],
        size:  3 + Math.random() * 5,
        dur:   500 + Math.random() * 200,
        ring:  i === 0,
      };
    });
    setParticles(p => [...p, ...ps]);
    setTimeout(() => setParticles(p => p.filter(x => !ps.find(y => y.id === x.id))), 800);
  }

  // ── Click handler ──────────────────────────────
  function click(r, c) {
    getAC(); // unlock audio on first tap
    const item = grid[r][c];

    if (!sel) {
      if (item) { setSel({ r, c }); sndClick(); }
      return;
    }
    if (sel.r === r && sel.c === c) { setSel(null); return; }

    const si = grid[sel.r][sel.c];
    if (!si) { setSel(null); return; }

    // MERGE
    if (item && item.type === si.type && item.tier === si.tier && item.tier < 4) {
      const g   = grid.map(row => [...row]);
      const nt  = item.tier + 1;
      g[r][c]           = mkItem(item.type, nt);
      g[sel.r][sel.c]   = null;
      setGrid(g); setSel(null);
      const pts = (nt + 1) * 55;
      setScore(s => s + pts); setCoins(s => s + pts);
      spawnParticles(r, c, nt);
      setFlash({ r, c }); setTimeout(() => setFlash(null), 450);
      setPop({ r, c });   setTimeout(() => setPop(null), 420);
      sndMerge(nt);
      return;
    }

    // Can't merge (same type, max tier)
    if (item && item.type === si.type && item.tier === si.tier && item.tier === 4) {
      setShake({ r: sel.r, c: sel.c }); setTimeout(() => setShake(null), 300);
      sndFail(); setSel(null); return;
    }

    // MOVE to empty
    if (!item) {
      const g = grid.map(row => [...row]);
      g[r][c]         = si;
      g[sel.r][sel.c] = null;
      setGrid(g); setSel(null); sndClick();
      return;
    }

    // RE-SELECT
    setSel({ r, c }); sndClick();
  }

  // ── Spawn helpers ──────────────────────────────
  function getEmptyCells(g) {
    const e = [];
    g.forEach((row, r) => row.forEach((cell, c) => { if (!cell) e.push([r, c]); }));
    return e;
  }

  function spawnOnGrid(tier = 0, useGems = false) {
    const empties = getEmptyCells(grid);
    if (!empties.length) return false;
    const [r, c] = empties[Math.floor(Math.random() * empties.length)];
    const avail  = ITEMS.filter(x => unlocked.includes(x.id));
    const t      = avail[Math.floor(Math.random() * avail.length)].id;
    const g      = grid.map(row => [...row]);
    g[r][c]      = mkItem(t, tier);
    setGrid(g);
    return true;
  }

  function buyCommon() {
    if (coins < 30 || !spawnOnGrid(0)) return;
    setCoins(c => c - 30); sndClick();
  }
  function buyRare() {
    if (gems < 1 || !spawnOnGrid(1)) return;
    setGems(g => g - 1); sndMerge(1);
  }
  function buyCoins(cost, isGems = false) {
    if (gems < cost) return;
    if (isGems) {
      setGems(g => g - cost + 10);
    } else {
      setGems(g => g - cost);
      setCoins(c => c + 500);
    }
    sndMerge(2);
  }

  // ── Level progression ──────────────────────────
  function nextLevel() {
    const reward = ldata.reward;
    const next   = lvl + 1;
    setLvl(next);
    setCoins(c => c + reward);
    setGems(g => g + 2);
    setScreen('game');
    const lu = LEVEL_UNLOCKS[next];
    if (lu && !unlocked.includes(lu.id)) setUnlocked(u => [...u, lu.id]);
  }

  function claimDaily() {
    setCoins(c => c + 200);
    setGems(g => g + 5);
    setDailyDone(true);
    setScreen('game');
    sndWin();
  }

  // ── Grid pixel dims ────────────────────────────
  const gridW = GRID * CELL + (GRID - 1) * GAP;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div style={{
        minHeight:'100dvh', maxHeight:'100dvh',
        background:'linear-gradient(155deg,#06000f 0%,#0d0030 55%,#080018 100%)',
        display:'flex', flexDirection:'column', alignItems:'center',
        fontFamily:"'Exo 2',sans-serif", color:'#fff',
        overflowX:'hidden', overflowY:'hidden',
        position:'relative', userSelect:'none', WebkitUserSelect:'none',
      }}>
        <StarField />

        {/* ── HEADER ─────────────────────────────────── */}
        <div style={{
          width:'100%', maxWidth:400,
          display:'flex', justifyContent:'space-between', alignItems:'center',
          padding:'10px 16px 6px',
          background:'linear-gradient(180deg,rgba(0,0,20,0.7) 0%,transparent 100%)',
          backdropFilter:'blur(8px)',
          position:'relative', zIndex:10, flexShrink:0,
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{
              fontFamily:"'Orbitron',sans-serif", fontSize:10, fontWeight:900,
              color:'#a855f7', letterSpacing:2.5, textShadow:'0 0 12px #a855f7',
            }}>
              LEVEL {lvl + 1}
            </div>
            <div style={{
              fontSize:11, color:'#94a3b8',
              background:'rgba(255,255,255,0.06)', padding:'2px 8px', borderRadius:99,
            }}>
              ⭐ {score.toLocaleString()}
            </div>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            {[{ i:'🪙', v:coins }, { i:'💎', v:gems }].map(b => (
              <div key={b.i} onClick={() => setScreen('shop')} style={{
                display:'flex', alignItems:'center', gap:4,
                background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.12)',
                borderRadius:99, padding:'3px 10px', cursor:'pointer', fontSize:12, fontWeight:700,
              }}>
                <span style={{ fontSize:14 }}>{b.i}</span>
                <span>{b.v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── GOAL BAR ───────────────────────────────── */}
        <div style={{ width:'100%', maxWidth:400, padding:'4px 16px 6px', flexShrink:0 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
            <div style={{ fontSize:11, color:'#cbd5e1', fontWeight:600 }}>{ldata.desc}</div>
            <div style={{ fontSize:11, fontWeight:700, color:TC[ldata.goal.tier] }}>
              {goalCnt}/{ldata.goal.count}
            </div>
          </div>
          <div style={{ height:5, background:'rgba(255,255,255,0.08)', borderRadius:99, overflow:'hidden' }}>
            <div style={{
              height:'100%', width:`${goalPct}%`, borderRadius:99,
              background:`linear-gradient(90deg,${TC[ldata.goal.tier]},${TC[Math.min(ldata.goal.tier+1,4)]})`,
              transition:'width 0.5s ease',
              boxShadow:`0 0 8px ${TC[ldata.goal.tier]}`,
            }} />
          </div>
        </div>

        {/* ── GRID ───────────────────────────────────── */}
        <div style={{ position:'relative', flexShrink:0 }}>
          <div
            ref={gridRef}
            style={{
              display:'grid',
              gridTemplateColumns:`repeat(${GRID},${CELL}px)`,
              gap: GAP,
              padding:10,
              background:'rgba(255,255,255,0.025)',
              borderRadius:22,
              border:'1px solid rgba(255,255,255,0.07)',
              backdropFilter:'blur(6px)',
              boxShadow:'0 4px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
              position:'relative',
            }}
          >
            {grid.map((row, r) => row.map((cell, c) => (
              <Cell
                key={`${r}-${c}`}
                cell={cell}
                isSel={sel?.r === r && sel?.c === c}
                isFlash={flash?.r === r && flash?.c === c}
                isPop={pop?.r === r && pop?.c === c}
                isShake={shake?.r === r && shake?.c === c}
                onClick={() => click(r, c)}
              />
            )))}
            <Particles particles={particles} />
          </div>
        </div>

        {/* ── TIER LEGEND ────────────────────────────── */}
        <div style={{
          display:'flex', gap:8, marginTop:10, flexShrink:0,
          padding:'5px 14px',
          background:'rgba(255,255,255,0.03)',
          borderRadius:99, border:'1px solid rgba(255,255,255,0.06)',
        }}>
          {TIERS.map((t, i) => (
            <div key={t} style={{ display:'flex', alignItems:'center', gap:3 }}>
              <div style={{
                width:6, height:6, borderRadius:'50%',
                background:TC[i], boxShadow:`0 0 5px ${TC[i]}`,
              }}/>
              <span style={{ fontSize:9, color:TC[i], fontWeight:700, letterSpacing:0.5 }}>
                {t.slice(0,3).toUpperCase()}
              </span>
            </div>
          ))}
        </div>

        {/* ── ITEM TYPE ICONS ─────────────────────────── */}
        <div style={{
          display:'flex', gap:6, marginTop:8, flexShrink:0,
          padding:'5px 12px',
          background:'rgba(255,255,255,0.03)',
          borderRadius:99, border:'1px solid rgba(255,255,255,0.06)',
        }}>
          {ITEMS.map(item => (
            <div key={item.id} style={{
              display:'flex', alignItems:'center', gap:3,
              opacity: unlocked.includes(item.id) ? 1 : 0.25,
            }}>
              <span style={{ fontSize:15 }}>{item.e}</span>
            </div>
          ))}
        </div>

        {/* ── BOTTOM BAR ─────────────────────────────── */}
        <div style={{
          display:'flex', gap:8, marginTop:10, flexShrink:0,
          width:'100%', maxWidth:400, padding:'0 14px',
        }}>
          {[
            { icon:'🎁', label:'Daily', action:() => setScreen('daily'), dot:!dailyDone },
            { icon:'🛒', label:'Shop',  action:() => setScreen('shop')  },
            { icon:'🏆', label:'Ranks', action:() => setScreen('lb')    },
          ].map(b => (
            <button
              key={b.label}
              onClick={b.action}
              style={{
                flex:1,
                display:'flex', flexDirection:'column', alignItems:'center', gap:3,
                background:'rgba(255,255,255,0.05)',
                border:'1px solid rgba(255,255,255,0.09)',
                borderRadius:16, padding:'8px 4px',
                color:'#cbd5e1', cursor:'pointer', position:'relative',
                fontFamily:"'Exo 2',sans-serif",
              }}
            >
              <span style={{ fontSize:20 }}>{b.icon}</span>
              <span style={{ fontSize:10, fontWeight:600 }}>{b.label}</span>
              {b.dot && (
                <div style={{
                  position:'absolute', top:5, right:8,
                  width:7, height:7, borderRadius:'50%',
                  background:'#ec4899', boxShadow:'0 0 7px #ec4899',
                }}/>
              )}
            </button>
          ))}
        </div>

        {/* ── HOW TO PLAY HINT ───────────────────────── */}
        <div style={{
          marginTop:8, fontSize:10, color:'rgba(255,255,255,0.2)',
          fontStyle:'italic', flexShrink:0,
        }}>
          Tap an item · Tap a matching item to merge
        </div>

        {/* ══ MODALS ══════════════════════════════════ */}
        {screen === 'shop' && (
          <Overlay onClose={() => setScreen('game')}>
            <ShopModal
              coins={coins} gems={gems}
              onBuyCommon={buyCommon} onBuyRare={buyRare} onBuyCoins={buyCoins}
              onClose={() => setScreen('game')}
            />
          </Overlay>
        )}
        {screen === 'lb' && (
          <Overlay onClose={() => setScreen('game')}>
            <LBModal score={score} onClose={() => setScreen('game')} />
          </Overlay>
        )}
        {screen === 'daily' && (
          <Overlay onClose={() => setScreen('game')}>
            <DailyModal done={dailyDone} onClaim={claimDaily} onClose={() => setScreen('game')} />
          </Overlay>
        )}
        {screen === 'win' && (
          <Overlay onClose={() => {}}>
            <WinModal
              lvl={lvl} reward={ldata.reward}
              unlocked={LEVEL_UNLOCKS[lvl + 1]}
              onNext={nextLevel}
            />
          </Overlay>
        )}
      </div>
    </>
  );
}
