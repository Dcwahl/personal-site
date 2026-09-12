import { getScene } from '../../room.js?v=2';
import { project, mockupToScreen, ROOM_CAMERA } from '../../camera.js?v=2';
import { buildRobot, placeRobot, drawRobot } from '../../robot.js?v=2';

// A self-contained choreography study. All dimensions are in robot-local units;
// the whole delivery shares the site's camera and hidden-surface renderer.
const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
const $ = id => document.getElementById(id);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const clamp = x => Math.max(0, Math.min(1, x));
// A lankier utility robot for the delivery: small head, long limbs, plain eyes.
// Kept here as a separate character rather than altering the site's about host.
const porter = {
  footHeight: .055, footWidth: .12, footDepth: .24,
  legLength: .40, legWidth: .065, legDepth: .07, legSpread: .115,
  torsoHeight: .32, torsoWidth: .32, torsoDepth: .20,
  neckHeight: .065, neckWidth: .065,
  headHeight: .145, headWidth: .22, headDepth: .18,
  eyeSize: .028, eyeSpread: .054, eyeHeightOnHead: .55,
  armLength: .37, armWidth: .055, armDepth: .06,
  shoulderDrop: .045, antennaHeight: .065, antennaTip: .025,
  panelWidth: .15, panelHeight: .12, keyBowHeight: .10,
};
const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
let elapsed = 0, last = 0, frame = 0, running = false, started = false;
let proximity = 0, cameraFrame = 0, closeView = false;
const room = document.querySelector('.room');

function approach(closer) {
  cancelAnimationFrame(cameraFrame);
  closeView = closer;
  document.body.classList.toggle('viewing',closer);
  $('approach').textContent = closer ? 'back to room' : 'step closer';
  $('approach').setAttribute('aria-pressed', String(closer));
  $('framing-control').hidden = !closer;
  const from = proximity, to = closer ? 1 : 0, began = performance.now();
  function move(now) {
    const t = reduced.matches ? 1 : clamp((now-began)/1400);
    proximity = from+(to-from)*ease(t);
    render();
    if (t<1) cameraFrame = requestAnimationFrame(move);
  }
  move(began);
}

function box(name, x, y, z, w, h, d) {
  const p = (a, b, c) => ({ x: x + a*w/2, y: y + b*h/2, z: z + c*d/2 });
  return { name, quads: [
    { normal: {x:1,y:0,z:0}, points: [p(1,-1,-1),p(1,-1,1),p(1,1,1),p(1,1,-1)] },
    { normal: {x:-1,y:0,z:0}, points: [p(-1,-1,-1),p(-1,-1,1),p(-1,1,1),p(-1,1,-1)] },
    { normal: {x:0,y:1,z:0}, points: [p(-1,1,-1),p(-1,1,1),p(1,1,1),p(1,1,-1)] },
    { normal: {x:0,y:-1,z:0}, points: [p(-1,-1,-1),p(-1,-1,1),p(1,-1,1),p(1,-1,-1)] },
    { normal: {x:0,y:0,z:1}, points: [p(-1,-1,1),p(1,-1,1),p(1,1,1),p(-1,1,1)] },
    { normal: {x:0,y:0,z:-1}, points: [p(-1,-1,-1),p(1,-1,-1),p(1,1,-1),p(-1,1,-1)] },
  ] };
}

function wheel(x, z, angle) {
  const quads = [], r = .105, y = .11, d = .035, n = 12;
  const p = (i, side) => ({x:x+r*Math.cos(i*2*Math.PI/n+angle), y:y+r*Math.sin(i*2*Math.PI/n+angle), z:z+side*d});
  for (let i=0;i<n;i++) {
    const a = (i+.5)*2*Math.PI/n+angle;
    quads.push({normal:{x:Math.cos(a),y:Math.sin(a),z:0},points:[p(i,-1),p(i+1,-1),p(i+1,1),p(i,1)]});
    // Quads with a repeated centre keep the shared renderer's four-point contract.
    for (const side of [-1,1]) quads.push({normal:{x:0,y:0,z:side},points:[{x,y,z:z+side*d},p(i,side),p(i+1,side),{x,y,z:z+side*d}]});
  }
  return {name:`wheel-${x}-${z}`,quads};
}

function render() {
  const scene = getScene();
  if (!scene) return;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  if (canvas.width !== Math.round(innerWidth*dpr) || canvas.height !== Math.round(innerHeight*dpr)) {
    canvas.width = Math.round(innerWidth*dpr); canvas.height = Math.round(innerHeight*dpr);
  }
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,innerWidth,innerHeight);
  if (!started) return;
  const load = Number($('load').value), pull = $('mode').value === 'pull';
  const duration = 4.5 + load*4;
  const progress = ease((elapsed-.6)/duration);
  const parked = elapsed >= duration+.6;
  const effort = ease(elapsed/.6) * (1-ease((elapsed-duration-.3)/.65));
  const toScreen = mockupToScreen(scene);
  // Fix camera depth, solve x from screen centre. The path is parallel to the
  // image plane; its room axes still use the recovered perspective.
  const pixels = Math.min(innerWidth*.23, innerHeight*.205);
  const horizon = toScreen({x:ROOM_CAMERA.principal.x,y:ROOM_CAMERA.principal.y}).y;
  const floorY = Math.max(innerHeight * (innerWidth < 600 ? .73 : .76), scene.corner.y+28);
  const depth = ROOM_CAMERA.focalLength*scene.scale/(floorY-horizon);
  const scale = pixels * depth / (ROOM_CAMERA.focalLength*scene.scale);
  const target = innerWidth*.5;
  const screenX = -pixels*2.2 + (target+pixels*2.2)*progress;
  const reference = toScreen({x:ROOM_CAMERA.principal.x,y:ROOM_CAMERA.principal.y,depth});
  const camX = (screenX-reference.x)*depth/(ROOM_CAMERA.focalLength*scene.scale);
  const camY = (floorY-reference.y)*depth/(ROOM_CAMERA.focalLength*scene.scale);
  const r = ROOM_CAMERA.alongRightWall, l = ROOM_CAMERA.alongLeftWall;
  const dx = camX-ROOM_CAMERA.corner.x, dz = depth-ROOM_CAMERA.corner.z;
  const origin = {x:dx*r.x+dz*r.z,z:dx*l.x+dz*l.z,y:1-camY};
  const yaw = Math.atan2(l.x,r.x), c = Math.cos(yaw), s = Math.sin(yaw);
  const transform = (p, normal=false) => ({x:(normal?0:origin.x)+(p.x*c-p.z*s)*(normal?1:scale),y:(normal?0:origin.y)+p.y*(normal?1:scale),z:(normal?0:origin.z)+(p.x*s+p.z*c)*(normal?1:scale)});
  const at = (x,y,z) => toScreen(project(transform({x,y,z})));
  const travel = progress*(target+pixels*2.2)/pixels;
  const robot = buildRobot({...porter, stepAngle: (16-load*5)*effort, rockAngle: (3+load*3)*effort,
    phase: .25+(pull?-1:1)*travel/(.35-load*.09), armReach: 82, armRaise: 0,
    armSwing: 0, expression: parked?'happy':'neutral'});
  const lean = (pull?-.08:.08+load*.16)*effort;
  const leanC = Math.cos(lean), leanS = Math.sin(lean);
  const hip = porter.footHeight+porter.legLength;
  const bend = (p, normal=false) => {
    const y = p.y-(normal?0:hip);
    return {x:p.x*leanC+y*leanS,y:y*leanC-p.x*leanS+(normal?0:hip),z:p.z};
  };
  for (const part of robot.parts) if (!/^(foot|leg)\./.test(part.name)) {
    part.quads = part.quads.map(q=>({...q,normal:bend(q.normal,true),points:q.points.map(p=>bend(p))}));
  }
  // Hold the handle through the gait: translate the body from the mean hand
  // position, leaving the shoulders and feet free to rock under the load.
  const hands = robot.parts.filter(p=>p.name.startsWith('arm.')).map(part=> {
    const points = part.quads.flatMap(q=>q.points);
    const furthest = Math.max(...points.map(p=>p.x));
    const tip = points.filter(p=>p.x > furthest-.035);
    return tip.reduce((a,p)=>({x:a.x+p.x/tip.length,y:a.y+p.y/tip.length,z:a.z+p.z/tip.length}),{x:0,y:0,z:0});
  });
  const handX = hands.reduce((a,p)=>a+p.x/hands.length,0);
  const handY = hands.reduce((a,p)=>a+p.y/hands.length,0);
  const side = pull?1:-1, handleX = side*.88;
  robot.params.height = robot.crown/ROOM_CAMERA.doorHeight;
  const robotParts = placeRobot(robot,{x:handleX+side*handX,z:0,facing:pull?180:0,travel:0});
  // The small vertical handle motion is suspension/weight shift, not a jump.
  const handleY = handY;
  const parts = [box('deck',0,.24,0,1.3,.11,.84),
    box('cabinet-base',0,.64,0,.91,.69,.65),
    box('cabinet-screen',0,1.22,-.07,.91,.5,.51),
    box('marquee',0,1.56,-.02,1,.19,.62),
    box('control-shelf',0,.99,.12,1,.1,.64),
    box('handle',handleX,handleY,0,.055,.055,.55)];
  for (const z of [-.26,.26]) {
    parts.push(box('upright',handleX,(handleY+.26)/2,z,.045,handleY-.26,.045));
    parts.push(box('rail',side*.68,.28,z,.44,.045,.045));
  }
  for (const x of [-.46,.46]) for (const z of [-.39,.39]) parts.push(wheel(x,z,-travel/.105));
  parts.push(...robotParts);
  const solids = parts.map(part=>({...part,quads:part.quads.map(q=>({...q,detail:q.detail ?? [],normal:transform(q.normal,true),points:q.points.map(p=>transform(p))}))}));
  // An optical zoom/pan of the complete room, with the canvas redrawn at its
  // actual resolution. Keep the background registered to the cabinet; changing
  // the shared room camera would require reconstructing the 2D door artwork.
  const framing = Number($('framing').value);
  const focusY = .9 + framing*.33;
  const focus = at(0,focusY,.187);
  const halfWidth = .65-framing*.23, halfHeight = .88-framing*.62;
  const left = at(-halfWidth,focusY,.187), right = at(halfWidth,focusY,.187);
  const frameTop = at(0,focusY+halfHeight,.187), frameBottom = at(0,focusY-halfHeight,.187);
  const availableTop = document.querySelector('.study-head').getBoundingClientRect().bottom+24;
  const availableBottom = document.querySelector('.controls').getBoundingClientRect().top-24;
  const availableHeight = Math.max(100,availableBottom-availableTop);
  const destinationZoom = Math.max(1,Math.min(innerWidth*.88/(right.x-left.x),availableHeight/(frameBottom.y-frameTop.y)));
  const zoom = 1+(destinationZoom-1)*proximity;
  const panX = (innerWidth/2-focus.x*destinationZoom)*proximity;
  const panY = ((availableTop+availableBottom)/2-focus.y*destinationZoom)*proximity;
  ctx.setTransform(dpr*zoom,0,0,dpr*zoom,dpr*panX,dpr*panY);
  room.style.transform = `matrix(${zoom},0,0,${zoom},${panX},${panY})`;
  drawRobot(ctx,solids,toScreen,{weight:1.2/Math.sqrt(zoom)});
  function panel(x,y,z,w,h,fill) {
    const points=[at(x-w/2,y-h/2,z),at(x+w/2,y-h/2,z),at(x+w/2,y+h/2,z),at(x-w/2,y+h/2,z)];
    ctx.beginPath(); points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)); ctx.closePath();ctx.fillStyle=fill;ctx.fill();
  }
  const awake = parked && elapsed > duration+1;
  $('approach').disabled = !awake;
  panel(0,1.23,.187,.72,.35,awake?'#607862':'#383a32');
  // Pixel invader: the load starts behaving like the destination on arrival.
  if (awake) {
    const sprite=['001000100','000101000','001111100','011010110','111111111','101111101','101000101','000101000'];
    sprite.forEach((row,y)=>[...row].forEach((v,x)=>{if(v==='1')panel((x-4)*.023,1.3-y*.023,.19,.018,.018,'#dac9a4');}));
  }
  panel(0,.66,.328,.2,.045,'#383a32');
  const title = at(0,1.56,.295);
  ctx.fillStyle='#17140f';ctx.font=`${Math.max(9,pixels*.065)}px monospace`;ctx.textAlign='center';ctx.fillText('G A M E S',title.x,title.y+3);
  for (const x of [.17,.29]) { const p=at(x,1.049,.28);ctx.beginPath();ctx.ellipse(p.x,p.y,pixels*.025,pixels*.012,0,0,Math.PI*2);ctx.fill(); }
  const stick=at(-.23,1.055,.25), top=at(-.23,1.16,.25);
  ctx.beginPath();ctx.moveTo(stick.x,stick.y);ctx.lineTo(top.x,top.y);ctx.stroke();ctx.beginPath();ctx.arc(top.x,top.y,pixels*.025,0,Math.PI*2);ctx.fill();
  const message = closeView?'Try the framing slider: whole cabinet → screen and border. Escape steps back.':awake?'Delivery made. Step closer to the screen.':parked?'Parked. Waking up the cabinet…':effort<.5?'Getting a grip…':load>.5?'Short steps. This one’s heavy.':'Rolling along.';
  if ($('status').textContent!==message) $('status').textContent=message;
  if (elapsed>duration+1.6) {running=false;$('pause').disabled=true;$('deliver').textContent='replay';}
}

function tick(now) {
  if (!running) return;
  if (last) elapsed += Math.min((now-last)/1000,.05);
  last=now; render();
  if (running) frame=requestAnimationFrame(tick);
}
function start() {
  cancelAnimationFrame(cameraFrame); proximity=0; closeView=false;
  document.body.classList.remove('viewing');
  room.style.transform='none';$('framing-control').hidden=true;
  $('approach').textContent='step closer';$('approach').setAttribute('aria-pressed','false');
  cancelAnimationFrame(frame); started=true; elapsed=reduced.matches?99:0; last=0;
  running=!reduced.matches;$('pause').disabled=!running;$('pause').textContent='pause';$('deliver').textContent='restart';
  render();if(running)frame=requestAnimationFrame(tick);
}
$('deliver').addEventListener('click',start);
$('approach').addEventListener('click',()=>approach(!closeView));
$('framing').addEventListener('input',()=>{
  const value = Number($('framing').value);
  $('framing-name').textContent = value<.35?'cabinet':value<.95?'bezel':'screen';
  render();
});
window.addEventListener('keydown',event=>{if(event.key==='Escape' && closeView)approach(false);});
$('pause').addEventListener('click',()=>{running=!running;$('pause').textContent=running?'pause':'resume';last=0;if(running)frame=requestAnimationFrame(tick);else cancelAnimationFrame(frame);});
$('mode').addEventListener('change',()=>{if(started)start();});
$('load').addEventListener('input',()=>{$('weight').textContent=Number($('load').value)>.5?'hefty':'light';if(started)start();});
window.addEventListener('room:layout',render);
reduced.addEventListener('change',()=>{if(started)start();});
const query = new URLSearchParams(location.search);
if(query.has('t')) {started=true;elapsed=Math.max(0,Number(query.get('t'))||0);render();}
else if(query.has('play')) start();
