/* Native page interactions. External media stays in its provider's iframe. */
(() => {
  let currentCleanup = () => {};
  let sessionMotion = null;
  function mount() {
  currentCleanup();
  const disposers = [];
  let disposed = false;
  function listen(target, event, callback) {
    target.addEventListener(event, callback);
    disposers.push(() => target.removeEventListener(event, callback));
  }
  currentCleanup = () => { disposed = true; disposers.forEach(fn => fn()); };
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  // Fresh visits start with motion on, unless the visitor requests reduced motion.
  // A pause applies only to the current visit; old saved pauses no longer override it.
  let paused = sessionMotion ?? motionQuery.matches;
  const motionButton = document.getElementById('motion');
  if (!motionButton) return;
  const listeners = [];
  function syncMotion() {
    document.body.classList.toggle('paused', paused);
    motionButton.setAttribute('aria-pressed', String(paused));
    motionButton.setAttribute('aria-label', paused ? 'Resume animations' : 'Pause animations');
    motionButton.querySelector('.motion-icon').textContent = paused ? '▷' : 'Ⅱ';
    motionButton.querySelector('.motion-label').textContent = paused ? 'Motion off' : 'Motion on';
    listeners.forEach(fn => fn());
  }
  listen(motionButton, 'click', () => {
    paused = !paused; sessionMotion = paused;
    syncMotion();
  });
  listen(motionQuery, 'change', e => { paused = e.matches; syncMotion(); });
  syncMotion();
  const menu = document.querySelector('.menu-toggle');
  const nav = document.getElementById('navigation');
  function closeMenu() { menu.setAttribute('aria-expanded', 'false'); nav.classList.remove('open'); }
  listen(menu, 'click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(open)); nav.classList.toggle('open', open);
  });
  listen(document, 'keydown', e => { if (e.key === 'Escape' && nav.classList.contains('open')) { closeMenu(); menu.focus(); } });
  listen(nav, 'click', e => { if (e.target.closest('a')) closeMenu(); });
  listen(document, 'click', e => { if (!e.target.closest('.site-header')) closeMenu(); });

  // Warp only the water below the horizon; the sky and page content stay still.
  for (const ocean of document.querySelectorAll('canvas[data-water-image]')) {
  const oceanImage = document.getElementById(ocean.dataset.waterImage);
  if (ocean && oceanImage) {
    const water = ocean.getContext('2d', {alpha: false});
    const texture = document.createElement('canvas');
    const source = texture.getContext('2d');
    if (water && source) {
      let w = 0, h = 0, horizon = 0, oceanFrame = 0, previous = 0, time = 0;
      let imageRect = {x:0,y:0,w:0,h:0}, inView = true;
      const strength = Number(ocean.dataset.strength || 1);
      // Trace the full shoreline, including the water and reflections at the right edge.
      // The contour follows the foreground lilies instead of cutting off the right bank.
      const lakeMask = ocean.dataset.waterMask === 'lake' ? [[.25,.47],[.85,.455],[1,.465],[1,.515],[.97,.515],[.955,.565],[.925,.57],[.90,.585],[.875,.61],[.84,.63],[.81,.65],[.78,.685],[.75,.715],[.72,.745],[.69,.78],[.65,.80],[.64,.78],[.628,.825],[.60,.86],[.56,.89],[.50,.93],[.45,.96],[.31,1],[.23,.94],[.20,.82],[.22,.66],[.26,.58]] : null;
      function renderWater() {
        if (!w || !h) return;
        water.drawImage(texture, 0, 0);
        water.save();
        if (lakeMask) {
          water.beginPath();
          lakeMask.forEach(([px,py],i) => {
            const x=imageRect.x+px*imageRect.w, y=imageRect.y+py*imageRect.h;
            if(i===0)water.moveTo(x,y);else water.lineTo(x,y);
          });
          water.closePath();water.clip();
        }
        const depth = h - horizon;
        for (let y = horizon; y < h; y += 3) {
          const progress = (y - horizon) / depth;
          // Keep visible movement even in the distant water behind navigation.
          const fade = Math.min(1, progress / .045);
          const phase = Math.pow(progress, .64) * 42;
          const amplitude = fade * (2.8 + Math.pow(progress, .8) * 11) * strength;
          const dx = (Math.sin(phase - time * 1.7) + Math.sin(phase * .53 + time * .85) * .4) * amplitude;
          const dy = Math.sin(phase * .78 - time * 1.25) * fade * (1.1 + progress * 4.2) * strength;
          const band = Math.min(3, h - y);
          const sy = Math.max(horizon, Math.min(h - band, y + dy));
          water.drawImage(texture, 0, sy, w, band, dx - amplitude * 1.5, y, w + amplitude * 3, band);
        }
        water.restore();
      }
      function resizeOcean() {
        if (!oceanImage.complete || !oceanImage.naturalWidth) return;
        const rect = ocean.parentElement.getBoundingClientRect();
        const resolution = Math.min(1.5, 1400 / rect.width);
        w = Math.max(1, Math.round(rect.width * resolution));
        h = Math.max(1, Math.round(rect.height * resolution));
        ocean.width = texture.width = w;
        ocean.height = texture.height = h;
        const scale = Math.max(w / oceanImage.naturalWidth, h / oceanImage.naturalHeight);
        const imageW = oceanImage.naturalWidth * scale;
        const imageH = oceanImage.naturalHeight * scale;
        const x = (w - imageW) / 2, y = (h - imageH) * Number(ocean.dataset.positionY || .59);
        imageRect={x,y,w:imageW,h:imageH};
        source.drawImage(oceanImage, x, y, imageW, imageH);
        horizon = Math.max(0, Math.min(h - 1, Math.round(y + imageH * Number(ocean.dataset.horizon || .58))));
        renderWater();
        ocean.classList.add('is-ready');
      }
      function tickOcean(stamp) {
        oceanFrame = 0;
        if (disposed || paused || !inView || document.hidden) { previous = 0; return; }
        // A 30 fps cap keeps the full-screen effect light on mobile devices.
        if (!previous || stamp - previous >= 1000 / 30) {
          if (previous) time += Math.min((stamp - previous) / 1000, .1) * .65;
          previous = stamp;
          renderWater();
        }
        oceanFrame = requestAnimationFrame(tickOcean);
      }
      function runOcean() {
        if (oceanFrame) cancelAnimationFrame(oceanFrame);
        oceanFrame = 0; previous = 0;
        if (!disposed && !paused && inView && !document.hidden) oceanFrame = requestAnimationFrame(tickOcean);
      }
      const oceanResize = new ResizeObserver(resizeOcean);
      oceanResize.observe(ocean.parentElement);
      const waterVisibility = new IntersectionObserver(entries => {inView=entries[0].isIntersecting;runOcean();});
      waterVisibility.observe(ocean.parentElement);
      listen(oceanImage, 'load', resizeOcean);
      listen(document, 'visibilitychange', runOcean);
      listeners.push(runOcean);
      disposers.push(() => { oceanResize.disconnect(); waterVisibility.disconnect(); if (oceanFrame) cancelAnimationFrame(oceanFrame); });
      resizeOcean(); runOcean();
    }
  }
  }

  // Route decorative cursors only through empty space, including the whole path.
  if (document.body.classList.contains('page-taste')) {
    const cursorLayer = document.createElement('div');
    cursorLayer.className = 'drifting-cursors';
    cursorLayer.setAttribute('aria-hidden', 'true');
    document.body.append(cursorLayer);
    const between = (a,b) => a + Math.random() * (b-a);
    const sprites = Array.from({length:3},(_,i) => {
      const el=document.createElement('span');
      el.className='aero-cursor cursor-'+i;el.style.opacity='0';cursorLayer.append(el);
      return {el,x:null,y:null,from:null,to:null,elapsed:0,duration:1,angle:i%2?12:-10};
    });
    const protectedElements=[...document.querySelectorAll('.site-header, #navigation, .taste-copy, .taste-art, .mini-browser, .site-footer')];
    let zones=[], freePoints=[], width=0, height=0, dirty=true, lastGeometry=0;
    let cursorFrame=0, previousCursor=0;
    function pointIsClear(p) {
      return p.x>=20 && p.x<=width-20 && p.y>=24 && p.y<=height-24 &&
        zones.every(r=>p.x<r.left || p.x>r.right || p.y<r.top || p.y>r.bottom);
    }
    function segmentIsClear(a,b) {
      if(!pointIsClear(a)||!pointIsClear(b))return false;
      return zones.every(r=>{
        let enter=0,exit=1;
        for(const [axis,min,max] of [['x',r.left,r.right],['y',r.top,r.bottom]]){
          const delta=b[axis]-a[axis];
          if(Math.abs(delta)<.0001){if(a[axis]<min||a[axis]>max)return true;}
          else {
            const t1=(min-a[axis])/delta,t2=(max-a[axis])/delta;
            enter=Math.max(enter,Math.min(t1,t2));exit=Math.min(exit,Math.max(t1,t2));
            if(enter>exit)return true;
          }
        }
        return false;
      });
    }
    function readZones(stamp) {
      width=window.innerWidth;height=window.innerHeight;
      // Padding includes the cursor's full size and room for the floating artwork.
      zones=protectedElements.map(el=>el.getBoundingClientRect()).filter(r=>r.width>0&&r.height>0)
        .map(r=>({left:r.left-26,right:r.right+26,top:r.top-28,bottom:r.bottom+28}));
      freePoints=[];
      for(let y=26;y<height-24;y+=32)for(let x=22;x<width-20;x+=32){
        const point={x,y};if(pointIsClear(point))freePoints.push(point);
      }
      dirty=false;lastGeometry=stamp;
    }
    function chooseStart(sprite) {
      const available=freePoints.filter(p=>sprites.every(other=>other===sprite||other.x===null||Math.hypot(p.x-other.x,p.y-other.y)>75));
      if(!available.length){sprite.el.style.opacity='0';sprite.el.style.visibility='hidden';sprite.x=null;return false;}
      const p=available[Math.floor(Math.random()*available.length)];
      sprite.x=p.x;sprite.y=p.y;sprite.to={...p};sprite.from={...p};sprite.elapsed=100;
      return true;
    }
    function chooseTarget(sprite) {
      const current={x:sprite.x,y:sprite.y};
      for(let attempt=0;attempt<60;attempt++){
        const angle=between(0,Math.PI*2),distance=between(35,210);
        const target={x:current.x+Math.cos(angle)*distance,y:current.y+Math.sin(angle)*distance};
        if(segmentIsClear(current,target)){
          sprite.from=current;sprite.to=target;sprite.elapsed=0;sprite.duration=between(6,10)+distance/50;
          return;
        }
      }
      sprite.from=current;sprite.to=current;sprite.elapsed=0;sprite.duration=2;
    }
    function tickCursors(stamp) {
      cursorFrame=0;
      if(disposed||paused||document.hidden){previousCursor=0;return;}
      if(!previousCursor||stamp-previousCursor>=1000/30){
        const dt=previousCursor?Math.min((stamp-previousCursor)/1000,.08):0;
        previousCursor=stamp;
        if(dirty||stamp-lastGeometry>250)readZones(stamp);
        for(const sprite of sprites){
          if(sprite.x!==null&&!pointIsClear({x:sprite.x,y:sprite.y})){sprite.el.style.opacity='0';sprite.el.style.visibility='hidden';sprite.x=null;}
          if(sprite.x===null&&!chooseStart(sprite))continue;
          const current={x:sprite.x,y:sprite.y};
          if(sprite.elapsed>=sprite.duration||!segmentIsClear(current,sprite.to))chooseTarget(sprite);
          sprite.elapsed+=dt;
          const t=Math.min(1,sprite.elapsed/sprite.duration),ease=t*t*(3-2*t);
          const next={x:sprite.from.x+(sprite.to.x-sprite.from.x)*ease,y:sprite.from.y+(sprite.to.y-sprite.from.y)*ease};
          if(!segmentIsClear(current,next)){sprite.elapsed=sprite.duration;continue;}
          sprite.x=next.x;sprite.y=next.y;
          sprite.el.style.transform=`translate3d(${next.x-15}px,${next.y-18}px,0) rotate(${sprite.angle}deg)`;
          sprite.el.style.visibility='visible';
          sprite.el.style.opacity='.7';
        }
        cursorLayer.style.opacity='1';
      }
      cursorFrame=requestAnimationFrame(tickCursors);
    }
    function invalidateZones(){dirty=true;cursorLayer.style.opacity='0';}
    function runCursors(){
      if(cursorFrame)cancelAnimationFrame(cursorFrame);
      cursorFrame=0;previousCursor=0;dirty=true;cursorLayer.style.opacity='0';
      if(!disposed&&!paused&&!document.hidden)cursorFrame=requestAnimationFrame(tickCursors);
    }
    const cursorResize=new ResizeObserver(invalidateZones);
    protectedElements.forEach(el=>cursorResize.observe(el));
    listen(window,'resize',invalidateZones);listen(window,'scroll',invalidateZones);
    listen(document,'visibilitychange',runCursors);
    listeners.push(runCursors);
    disposers.push(()=>{cursorResize.disconnect();if(cursorFrame)cancelAnimationFrame(cursorFrame);cursorLayer.remove();});
    runCursors();
  }

  const canvas = document.getElementById('tree-energy');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const img = document.getElementById('tree-image');
  const stage = document.getElementById('tree-stage');
  const energyButton = document.getElementById('energy-button');
  let width = 1, height = 1, frame = 0, last = 0, clock = 0, visible = true;
  let bursts = [], pulses = [], leafFlashes = [];
  // Each route traces a continuous visible root, trunk and limb in the 3:2 art.
  // Closely spaced waypoints prevent shortcuts across empty canopy space.
  const paths = [
    [[.52,.90],[.50,.87],[.475,.83],[.462,.78],[.463,.73],[.47,.67],[.47,.61],[.455,.55],[.437,.49],[.423,.43],[.408,.37],[.39,.31],[.365,.267],[.342,.23],[.313,.196],[.28,.16],[.24,.13],[.20,.108],[.16,.08],[.125,.051],[.10,.025]],
    [[.27,.87],[.31,.84],[.345,.80],[.366,.75],[.378,.69],[.385,.63],[.398,.57],[.41,.51],[.418,.45],[.413,.39],[.405,.33],[.409,.285],[.417,.238],[.432,.193],[.447,.155],[.454,.113],[.452,.073],[.443,.033]],
    [[.80,.90],[.74,.87],[.68,.84],[.638,.806],[.618,.765],[.608,.714],[.593,.66],[.573,.611],[.55,.566],[.539,.52],[.536,.475],[.551,.433],[.574,.395],[.60,.357],[.629,.324],[.66,.295],[.69,.269],[.724,.24],[.755,.21],[.79,.177],[.824,.145],[.853,.112]],
    [[.92,.88],[.86,.856],[.80,.83],[.745,.812],[.70,.79],[.677,.758],[.672,.71],[.673,.657],[.676,.612],[.697,.566],[.73,.535],[.766,.51],[.807,.486],[.85,.458],[.888,.433],[.925,.417],[.963,.407]],
    [[.10,.84],[.16,.83],[.22,.812],[.276,.79],[.316,.759],[.347,.72],[.361,.674],[.366,.628],[.375,.583],[.381,.55],[.361,.518],[.335,.49],[.307,.463],[.277,.437],[.247,.409],[.214,.38],[.177,.353],[.143,.331],[.11,.318],[.075,.30],[.04,.288]],
    [[.89,.91],[.82,.88],[.755,.85],[.706,.817],[.681,.78],[.677,.73],[.677,.675],[.677,.619],[.675,.56],[.673,.503],[.669,.448],[.662,.395],[.653,.343],[.646,.294],[.637,.255],[.624,.224]]
  ];
  const colors = ['143,255,137','104,235,255','209,166,255'];
  // Distance-based interpolation gives a steady speed through uneven waypoints.
  function makeRoute(points) {
    const distances = [0];
    for (let i=1;i<points.length;i++) {
      const dx=(points[i][0]-points[i-1][0])*1.5, dy=points[i][1]-points[i-1][1];
      distances.push(distances[i-1]+Math.hypot(dx,dy));
    }
    return {points, distances, length:distances.at(-1)};
  }
  const routes=paths.map(makeRoute);
  function point(route, progress) {
    const distance=Math.max(0,Math.min(1,progress))*route.length;
    let i=1;
    while(i<route.distances.length-1 && route.distances[i]<distance)i++;
    const a=route.points[i-1],b=route.points[i];
    const t=(distance-route.distances[i-1])/(route.distances[i]-route.distances[i-1]);
    return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
  }
  const leaves=paths.map((p,i)=>{
    const end=p.at(-1);
    return Array.from({length:18},(_,j)=>{
      const angle=j*2.399963+i, r=.008+(j%6)*.004;
      return {x:end[0]+Math.cos(angle)*r,y:end[1]+Math.sin(angle)*r*1.1,size:1.2+(j%3)*.4};
    });
  });
  function resize() {
    width=img.clientWidth;height=img.clientHeight;
    if(!width||!height)return;
    const dpr=Math.min(window.devicePixelRatio||1,2);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    canvas.style.width=width+'px';canvas.style.height=height+'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);draw();
  }
  function glow(x,y,r,color,alpha) {
    const g=ctx.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,`rgba(${color},${alpha})`);
    g.addColorStop(.25,`rgba(${color},${alpha*.6})`);
    g.addColorStop(1,`rgba(${color},0)`);
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
  }
  function trace(route,from,to,color,alpha,lineWidth,blur=0) {
    ctx.save();ctx.beginPath();ctx.lineCap='round';ctx.lineJoin='round';
    const steps=Math.max(2,Math.ceil((to-from)*260));
    for(let i=0;i<=steps;i++){
      const q=point(route,from+(to-from)*i/steps);
      if(i===0)ctx.moveTo(q[0]*width,q[1]*height);else ctx.lineTo(q[0]*width,q[1]*height);
    }
    ctx.strokeStyle=`rgba(${color},${alpha})`;ctx.lineWidth=lineWidth;
    ctx.shadowColor=`rgb(${color})`;ctx.shadowBlur=blur;ctx.stroke();ctx.restore();
  }
  function draw() {
    ctx.clearRect(0,0,width,height);
    const lineWidth=Math.max(2.4,width*.0032);
    for(const pulse of pulses){
      const t=(clock-pulse.start)/pulse.duration;if(t<0||t>1)continue;
      const route=routes[pulse.path],color=colors[pulse.path%3];
      trace(route,0,t,color,pulse.strength*.2,lineWidth*.7,3);
      const tail=Math.max(0,t-.13);
      trace(route,tail,t,color,pulse.strength*.9,lineWidth,11);
      trace(route,Math.max(tail,t-.05),t,'239,255,231',.9,lineWidth*.38);
      const q=point(route,t);
      glow(q[0]*width,q[1]*height,Math.max(15,width*.022),color,pulse.strength*.7);
      glow(q[0]*width,q[1]*height,Math.max(3.5,width*.0045),'240,255,230',1);
    }
    for(const flash of leafFlashes){
      const elapsed=clock-flash.start;if(elapsed<0||elapsed>3.8)continue;
      const strength=Math.sin(elapsed/3.8*Math.PI)*flash.strength;
      const end=paths[flash.path].at(-1),color=colors[flash.path%3];
      glow(end[0]*width,end[1]*height,Math.max(24,width*.045),color,strength*.6);
      for(const leaf of leaves[flash.path])glow(leaf.x*width,leaf.y*height,leaf.size*Math.max(2.3,width/360),color,strength*.95);
    }
  }
  let lastAuto=-3,nextPath=0,boostEnd=0;
  function spawn(path,strength,speed){
    pulses.push({path,strength,duration:routes[path].length/speed,start:clock,lit:false});
  }
  function finishBoost(){
    boostEnd=0;energyButton.disabled=false;
    energyButton.classList.remove('energizing');energyButton.removeAttribute('aria-busy');
  }
  function tick(timestamp){
    frame=0;
    if(disposed||paused||!visible||document.hidden){last=0;return;}
    if(last)clock+=Math.min((timestamp-last)/1000,.06);
    last=timestamp;
    if(clock-lastAuto>2.2){spawn(nextPath++%paths.length,.85,.21);lastAuto=clock;}
    bursts=bursts.filter(b=>{if(clock>=b.time){spawn(b.path,1,.24);return false;}return true;});
    for(const p of pulses)if(!p.lit&&clock>=p.start+p.duration){p.lit=true;leafFlashes.push({path:p.path,start:clock,strength:p.strength});}
    pulses=pulses.filter(p=>clock-p.start<=p.duration);
    leafFlashes=leafFlashes.filter(f=>clock-f.start<3.8);
    if(boostEnd&&clock>=boostEnd)finishBoost();
    draw();frame=requestAnimationFrame(tick);
  }
  function run(){
    if(frame)cancelAnimationFrame(frame);frame=0;last=0;
    if(!disposed&&!paused&&visible&&!document.hidden)frame=requestAnimationFrame(tick);
  }
  listen(energyButton,'click',()=>{
    if(paused){
      // Sending energy explicitly starts a moving pulse, never a frozen line drawing.
      paused=false;sessionMotion=false;syncMotion();
    }
    bursts=paths.map((_,path)=>({path,time:clock+path*.18}));
    boostEnd=clock+Math.max(...routes.map((r,i)=>r.length/.24+i*.18))+.15;
    energyButton.disabled=true;energyButton.setAttribute('aria-busy','true');
    energyButton.classList.add('energizing');run();
  });
  function syncTreeMotion(){
    energyButton.title=paused ? 'Turn motion on and send energy from the roots to the leaves' : 'Send energy from the roots to the leaves';
    if(paused){bursts=[];pulses=[];leafFlashes=[];finishBoost();draw();}
    run();
  }
  listeners.push(syncTreeMotion);
  const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;run();},{threshold:.03});observer.observe(stage);
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(img);
  disposers.push(()=>{observer.disconnect();resizeObserver.disconnect();if(frame)cancelAnimationFrame(frame);});
  listen(img,'load',resize);resize();listen(document,'visibilitychange',run);syncTreeMotion();
  }
  window.BegumSite = { mount, unmount: () => currentCleanup() };
  mount();
})();
