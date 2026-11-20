/* GhapherOS core · visor 3D. Uso limitado: ver LICENSE. Copyright Valenxe Dynamics. */
(function(){
  'use strict';

  /* Bus de eventos para extensiones: window.GhapherOS.on('scenario', fn) */
  var bus = {};
  window.GhapherOS = {
    version: '0.1.0',
    on: function(name, fn){ (bus[name] = bus[name] || []).push(fn); },
    emit: function(name, payload){ (bus[name] || []).forEach(function(fn){ try { fn(payload); } catch(e){ console.error('Extensión (' + name + '):', e); } }); }
  };

  /* Plan libre: límites de producto. La versión completa se activa con licencia comercial. */
  var PLAN = {id:'libre', maxNodes:12, maxScenarios:3, maxFlows:12, export:false, watermark:'GhapherOS · versión libre · Valenxe Dynamics'};
  function limitProject(obj){
    var o = JSON.parse(JSON.stringify(obj));
    var cut = [];
    if (o.nodes.length > PLAN.maxNodes){ o.nodes = o.nodes.slice(0, PLAN.maxNodes); cut.push(PLAN.maxNodes + ' equipos'); }
    if (o.scenarios.length > PLAN.maxScenarios){ o.scenarios = o.scenarios.slice(0, PLAN.maxScenarios); cut.push(PLAN.maxScenarios + ' escenarios'); }
    if ((o.flows || []).length > PLAN.maxFlows){ o.flows = o.flows.slice(0, PLAN.maxFlows); cut.push(PLAN.maxFlows + ' flujos'); }
    var ids = {}; o.nodes.forEach(function(n){ ids[n.id] = true; });
    o.flows = (o.flows || []).filter(function(f){ return f.path.every(function(id){ return ids[id]; }); });
    o.limitado = cut.length ? cut : null;
    return o;
  }

  var HAS3 = (typeof THREE !== 'undefined');
  var SPEED = (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) ? 0.35 : 1;
  var STORE = 'ghapheros-project-v1';
  var COL = {amber:0xff7b00, cyan:0x00f0ff, red:0xff2a4b, green:0x00e676, slate:0x3c4d61};
  var CSSC = {amber:'#ff7b00', cyan:'#00f0ff', red:'#ff2a4b', green:'#00e676', slate:'#6f8fa3'};

  var data = null, scene3 = null, renderer = null, cam = null, controls = null, composer = null, bloom = null, css = null, tc = null, clock = null;
  var world = null, N = {}, FL = [], bodies = [], clouds = [], rings = [], stage = document.getElementById('stage');
  var time = 0, current = null, selected = null, hover = null, editMode = false, fly = null, rebuild = false, keys = {};
  var ray = null, ndc = null, extraFiles = [];

  function $(id){ return document.getElementById(id); }
  function nodeOf(id){ return data.nodes.filter(function(n){ return n.id === id; })[0]; }
  function levelOf(id){ return (data.levels || []).filter(function(l){ return l.id === id; })[0] || {y:0}; }
  function scenarioOf(id){ return data.scenarios.filter(function(s){ return s.id === id; })[0]; }
  function fmtErr(e){ return (e && e.message) ? e.message : String(e); }

  function validate(obj){
    if (!obj || !Array.isArray(obj.nodes) || !Array.isArray(obj.scenarios)) throw new Error('El proyecto necesita "nodes" y "scenarios" como listas.');
    var ids = {};
    obj.nodes.forEach(function(n){
      if (!n.id) throw new Error('Cada nodo necesita "id".');
      ids[n.id] = true;
      if (n.level && obj.levels && !obj.levels.some(function(l){ return l.id === n.level; })) throw new Error('El nodo "' + n.id + '" usa un nivel que no existe.');
    });
    (obj.flows || []).forEach(function(f){ (f.path || []).forEach(function(id){ if (!ids[id]) throw new Error('Un flujo usa el nodo "' + id + '", que no existe.'); }); });
    obj.scenarios.forEach(function(s){ if (!s.id) throw new Error('Cada escenario necesita "id".'); });
    return obj;
  }

  function labelFor(n, sid){
    var sub = n.sub || {};
    return {t:(n.label || n.id), s:(sub[sid] || sub.all || '')};
  }

  function tagEl(){
    var el = document.createElement('div');
    el.className = 'tag';
    el.innerHTML = '<div class="t"></div><div class="s"></div>';
    return el;
  }

  function clearWorld(){
    if (tc) tc.detach();
    FL = []; N = {}; bodies = []; clouds = []; rings = [];
    if (!world) return;
    scene3.remove(world);
    world.traverse(function(o){
      if (o.geometry) o.geometry.dispose();
      if (o.material){ if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
    });
    world = null;
  }

  function buildNode(n){
    var lv = levelOf(n.level);
    var y = (typeof n.y === 'number') ? n.y : lv.y;
    var g = new THREE.Group();
    g.position.set(n.x || 0, y, n.z || 0);
    var w = n.w || 2.4, h = n.h || 1.3, d = n.d || 1.8;
    var geo = new THREE.BoxGeometry(w, h, d);
    var mat = new THREE.MeshPhysicalMaterial({color:0x0b1622, roughness:0.25, metalness:0.4, transparent:true, opacity:0.85, clearcoat:0.5, clearcoatRoughness:0.3, emissive:0x000000, emissiveIntensity:0});
    var body = new THREE.Mesh(geo, mat);
    body.position.y = h / 2;
    body.userData.key = n.id;
    var edgesMat = new THREE.LineBasicMaterial({color:0x00f0ff, transparent:true, opacity:0.85});
    var edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgesMat);
    edges.position.copy(body.position);
    var led = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), new THREE.MeshBasicMaterial({color:COL.slate}));
    led.position.set(-w * 0.3, h * 0.72, d / 2 + 0.05);
    var dy = n.tagDy || 0;
    var leadMat = new THREE.LineBasicMaterial({color:0x3c4d61, transparent:true, opacity:0.7});
    var lead = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, h + 0.05, 0), new THREE.Vector3(0, h + 1.2 + dy, 0)]), leadMat);
    g.add(body, edges, led, lead);
    if (y > 0){
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -y, 0), new THREE.Vector3(0, 0, 0)]),
        new THREE.LineBasicMaterial({color:0x00f0ff, transparent:true, opacity:0.18})));
    }
    var el = tagEl();
    var tag = new THREE.CSS2DObject(el);
    tag.position.set(0, h + 1.3 + dy, 0);
    g.add(tag);
    world.add(g);
    N[n.id] = {g:g, body:body, mat:mat, edgesMat:edgesMat, led:led, leadMat:leadMat, tag:tag, el:el, t:el.querySelector('.t'), s:el.querySelector('.s'), data:n};
    bodies.push(body);
  }

  function applyState(id, st){
    var o = N[id];
    if (!o) return;
    var lit = (st === 'amber' || st === 'red' || st === 'green');
    var key = {amber:'amber', red:'red', green:'green', retired:'slate', ghost:'green'}[st] || 'slate';
    var col = COL[key] || COL.slate;
    o.g.visible = (st !== 'hidden');
    o.tag.visible = (st !== 'hidden');
    o.mat.emissive.setHex(lit ? col : 0x000000);
    o.mat.emissiveIntensity = lit ? 0.55 : 0;
    o.mat.opacity = (st === 'retired') ? 0.28 : 0.85;
    o.edgesMat.color.setHex(lit ? col : (key === 'slate' ? 0x3c4d61 : col));
    o.edgesMat.opacity = (st === 'retired') ? 0.25 : 0.85;
    o.leadMat.color.setHex(lit ? col : 0x3c4d61);
    o.led.material.color.setHex(lit ? col : COL.slate);
    o.el.style.setProperty('--c', CSSC[key] || '#00f0ff');
  }

  function buildLevels(){
    (data.levels || []).forEach(function(lv, i){
      var grid = new THREE.GridHelper(70, 35, 0x0e4a57, 0x0b2a33);
      grid.position.set(3, lv.y - 0.02, 0);
      grid.material.transparent = true;
      grid.material.opacity = 0.35;
      world.add(grid);
      [16, 22, 28].forEach(function(r, j){
        var rg = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.05, 180), new THREE.MeshBasicMaterial({color:0x00f0ff, transparent:true, opacity:0.12, side:THREE.DoubleSide}));
        rg.rotation.x = -Math.PI / 2;
        rg.position.set(3, lv.y + 0.02, 0);
        rg.userData.phase = i * 1.3 + j;
        world.add(rg);
        rings.push(rg);
      });
      var count = 380, pos = new Float32Array(count * 3);
      for (var p = 0; p < count; p++){
        var a = Math.random() * Math.PI * 2, r2 = 6 + Math.random() * 26;
        pos[p*3] = 3 + Math.cos(a) * r2; pos[p*3+1] = lv.y + Math.random() * 3.5; pos[p*3+2] = Math.sin(a) * r2;
      }
      var cg = new THREE.BufferGeometry();
      cg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      var cloud = new THREE.Points(cg, new THREE.PointsMaterial({color:(i === 0 ? 0xff7b00 : 0x00f0ff), size:0.14, transparent:true, opacity:0.45, depthWrite:false}));
      world.add(cloud);
      clouds.push(cloud);
      var el = document.createElement('div');
      el.className = 'lvl';
      el.textContent = lv.name || lv.id;
      var lab = new THREE.CSS2DObject(el);
      lab.position.set(-19, lv.y + 0.6, -6);
      world.add(lab);
    });
  }

  function buildFlow(f){
    var pts = (f.path || []).map(function(id){
      var n = nodeOf(id);
      var o = N[id];
      var p = o ? o.g.position : null;
      var lv = levelOf(n.level);
      var y = p ? p.y : ((typeof n.y === 'number') ? n.y : lv.y);
      return new THREE.Vector3(p ? p.x : (n.x || 0), y + (n.h || 1.3) + (f.lift || 0.9), p ? p.z : (n.z || 0));
    });
    if (pts.length < 2) return;
    var curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    var c = COL[f.color] || COL.cyan;
    var group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 180, f.dim ? 0.035 : 0.06, 10, false),
      new THREE.MeshBasicMaterial({color:c, transparent:true, opacity:f.dim ? 0.22 : 0.6})));
    var packets = [];
    var pg = new THREE.SphereGeometry(0.17, 12, 10);
    var bright = new THREE.Color(c).multiplyScalar(2.2);
    for (var i = 0; i < (f.count || 0); i++){
      var p = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({color:bright}));
      group.add(p); packets.push(p);
    }
    world.add(group);
    FL.push({group:group, curve:curve, packets:packets, f:f});
  }

  function rebuildFlows(){
    FL.forEach(function(o){ world.remove(o.group); });
    FL = [];
    (data.flows || []).forEach(buildFlow);
    var id = current;
    FL.forEach(function(o){ o.group.visible = (o.f.scenes || []).indexOf(id) > -1; });
  }

  function applyScenario(id){
    var s = scenarioOf(id);
    if (!s || !scene3) return;
    current = id;
    (data.nodes).forEach(function(n){
      applyState(n.id, (s.states && s.states[n.id]) || 'normal');
      var l = labelFor(n, id);
      N[n.id].t.textContent = l.t;
      N[n.id].s.textContent = l.s;
    });
    FL.forEach(function(o){ o.group.visible = (o.f.scenes || []).indexOf(id) > -1; });
    document.querySelectorAll('#scen [data-scene]').forEach(function(b){
      b.setAttribute('aria-pressed', String(b.getAttribute('data-scene') === id));
    });
    renderPanels(s);
    renderMetrics(id);
    window.GhapherOS.emit('scenario', {id: id});
    placeView(s);
  }

  function placeView(s){
    var c = s.cam || {pos:[-14,26,36], target:[6,4,0]};
    var a = (cam.aspect > 0 && isFinite(cam.aspect)) ? cam.aspect : 1.6;
    var k = Math.min(2.2, Math.max(1, 1.3 / a));
    controls.target.set(c.target[0], c.target[1], c.target[2]);
    cam.position.set(c.pos[0], c.pos[1] * k, c.pos[2] * k);
    controls.update();
  }

  function renderPanels(s){
    var kp = $('kpis');
    kp.innerHTML = '';
    (s.kpis || []).slice(0, 4).forEach(function(k){
      var d = document.createElement('div');
      d.className = 'kpi';
      d.style.setProperty('--c', k.color || 'var(--cyan)');
      d.innerHTML = '<small></small><strong></strong><span></span>';
      d.querySelector('small').textContent = k.label || '';
      d.querySelector('strong').textContent = k.value || '';
      d.querySelector('span').textContent = k.sub || '';
      kp.appendChild(d);
    });
    var b = $('brief');
    b.style.setProperty('--c', s.color || 'var(--cyan)');
    b.querySelector('b').textContent = s.tag || s.label || '';
    b.querySelector('span').textContent = s.brief || '';
  }

  function renderMetrics(id){
    var mini = $('mini');
    mini.innerHTML = '';
    (data.metrics || []).forEach(function(m){
      var div = document.createElement('div');
      var h = document.createElement('h4');
      h.textContent = m.title;
      div.appendChild(h);
      (m.rows || []).forEach(function(r){
        var row = document.createElement('div');
        row.className = 'mrow' + (r.scene === id ? ' on' : '');
        row.style.setProperty('--c', r.color || 'var(--cyan)');
        row.innerHTML = '<span></span><b></b><div class="mtrack"><i></i></div>';
        row.querySelector('span').textContent = r.label;
        row.querySelector('b').textContent = r.text || r.value;
        row.querySelector('i').style.width = Math.min(100, (r.value / (m.scale || 100)) * 100) + '%';
        div.appendChild(row);
      });
      mini.appendChild(div);
    });
  }

  function renderScenarioButtons(){
    var nav = $('scen');
    nav.innerHTML = '';
    data.scenarios.forEach(function(s){
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('data-scene', s.id);
      b.textContent = s.label || s.id;
      b.addEventListener('click', function(){ applyScenario(s.id); });
      nav.appendChild(b);
    });
  }

  function flyTo(p, t, dur){
    if (!cam || !controls) return;
    fly = {p0:cam.position.clone(), t0:controls.target.clone(), p1:p, t1:t, s:performance.now(), d:dur || 1200};
  }

  function refreshTags(){
    Object.keys(N).forEach(function(k){ N[k].el.classList.toggle('open', k === selected || k === hover); });
  }

  function openCard(id){
    var n = nodeOf(id);
    var c = n.card || {title:n.label || n.id, es:'', hoy:'', mejora:''};
    var card = $('card');
    card.style.setProperty('--c', CSSC.cyan);
    $('card-t').textContent = c.title || n.label || n.id;
    $('card-es').textContent = c.es || '';
    $('card-hoy').textContent = c.hoy || '';
    $('card-mej').textContent = c.mejora || '';
    card.hidden = false;
  }

  function closeCard(){ $('card').hidden = true; selected = null; refreshTags(); }

  function pickKey(e){
    var r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    var vis = bodies.filter(function(b){ return b.parent.visible; });
    var hits = ray.intersectObjects(vis, false);
    return hits.length ? hits[0].object.userData.key : null;
  }

  function rebuildAll(){
    if (!scene3) return;
    clearWorld();
    world = new THREE.Group();
    scene3.add(world);
    buildLevels();
    data.nodes.forEach(buildNode);
    (data.flows || []).forEach(buildFlow);
    applyScenario(current && scenarioOf(current) ? current : data.scenarios[0].id);
    window.GhapherOS.emit('built', {project: data.project});
  }

  function setHeader(){
    var p = data.project || {};
    $('proj-name').textContent = (p.name || 'Proyecto').toUpperCase();
    $('proj-sub').textContent = [p.client, p.classification, p.description].filter(Boolean).join(' · ');
  }

  function loadProject(){
    var saved = null;
    try { saved = localStorage.getItem(STORE); } catch(e){}
    if (saved){ try { return Promise.resolve(validate(JSON.parse(saved))); } catch(e){ /* cae al ejemplo */ } }
    return fetch('data/example.json').then(function(r){
      if (!r.ok) throw new Error('No se pudo leer data/example.json');
      return r.json();
    }).then(validate);
  }

  function persist(obj){
    try { localStorage.setItem(STORE, JSON.stringify(obj)); } catch(e){}
  }

  function syncEditorFromData(){ $('p-json').value = JSON.stringify(data, null, 2); }

  function applyEditor(){
    try {
      var obj = validate(JSON.parse($('p-json').value));
      data = limitProject(obj);
      if (data.limitado) $('p-err').textContent = 'Plan libre: se aplicaron los límites (' + data.limitado.join(', ') + '). La versión completa no tiene límites.';
      persist(data);
      setHeader();
      renderScenarioButtons();
      $('p-err').textContent = '';
      current = null;
      rebuildAll();
      var first = data.scenarios[0].id;
      applyScenario(first);
    } catch(e){
      $('p-err').textContent = 'Error: ' + fmtErr(e);
    }
  }

  function savePositions(){
    data.nodes.forEach(function(n){
      var o = N[n.id];
      if (!o) return;
      n.x = +o.g.position.x.toFixed(2);
      n.z = +o.g.position.z.toFixed(2);
    });
    persist(data);
    syncEditorFromData();
  }

  function initScene(){
    var canvas = $('gl');
    var wm = document.createElement('div');
    wm.className = 'wm';
    wm.textContent = PLAN.watermark;
    stage.appendChild(wm);
    renderer = new THREE.WebGLRenderer({canvas:canvas, antialias:true});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x06080d, 1);
    scene3 = new THREE.Scene();
    scene3.fog = new THREE.FogExp2(0x06080d, 0.011);
    cam = new THREE.PerspectiveCamera(38, 1, 0.1, 400);
    clock = new THREE.Clock();
    ray = new THREE.Raycaster();
    ndc = new THREE.Vector2();

    scene3.add(new THREE.AmbientLight(0x88aacc, 0.5));
    var key = new THREE.DirectionalLight(0xbfe9ff, 0.8);
    key.position.set(8, 30, 14);
    scene3.add(key);

    var sp = new Float32Array(1400 * 3);
    for (var i = 0; i < 1400; i++){
      var u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, rad = 180 + Math.random() * 120, s2 = Math.sqrt(1 - u*u);
      sp[i*3] = Math.cos(th) * s2 * rad; sp[i*3+1] = u * rad * 0.6 + 10; sp[i*3+2] = Math.sin(th) * s2 * rad;
    }
    var sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    scene3.add(new THREE.Points(sg, new THREE.PointsMaterial({color:0x7fd8ff, size:0.7, transparent:true, opacity:0.35, depthWrite:false})));

    controls = new THREE.OrbitControls(cam, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.minDistance = 6;
    controls.maxDistance = 400;
    controls.minPolarAngle = 0.05;
    controls.maxPolarAngle = Math.PI - 0.05;
    controls.target.set(4, 4, 0);

    if (THREE.CSS2DRenderer){
      css = new THREE.CSS2DRenderer();
      css.domElement.className = 'css2d';
      stage.appendChild(css.domElement);
    }
    if (THREE.EffectComposer && THREE.UnrealBloomPass && THREE.RenderPass){
      composer = new THREE.EffectComposer(renderer);
      composer.addPass(new THREE.RenderPass(scene3, cam));
      bloom = new THREE.UnrealBloomPass(new THREE.Vector2(256, 256), 0.85, 0.5, 0.2);
      composer.addPass(bloom);
    }
    if (THREE.TransformControls){
      tc = new THREE.TransformControls(cam, renderer.domElement);
      tc.setMode('translate');
      tc.showY = false;
      tc.size = 0.9;
      scene3.add(tc);
      tc.addEventListener('dragging-changed', function(e){ controls.enabled = !e.value; });
      tc.addEventListener('objectChange', function(){ rebuild = true; });
    }

    var drag = false, sx = 0, sy = 0, moved = 0;
    canvas.addEventListener('pointerdown', function(e){ drag = true; sx = e.clientX; sy = e.clientY; moved = 0; });
    canvas.addEventListener('pointermove', function(e){
      if (drag){ moved += Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy); sx = e.clientX; sy = e.clientY; return; }
      if (editMode || !world) return;
      var k = pickKey(e);
      if (k !== hover){ hover = k; refreshTags(); }
      canvas.style.cursor = k ? 'pointer' : '';
    });
    canvas.addEventListener('pointerup', function(e){
      drag = false;
      if (moved >= 6 || !world) return;
      var k = pickKey(e);
      if (editMode){
        if (k){ selected = k; tc.attach(N[k].g); }
        else { tc.detach(); selected = null; }
        return;
      }
      if (k){ selected = k; openCard(k); refreshTags(); }
      else closeCard();
    });
    controls.addEventListener('start', function(){ fly = null; });

    function resize(){
      var w = stage.clientWidth, h = stage.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
      if (composer) composer.setSize(w, h);
      if (bloom) bloom.setSize(w, h);
      if (css) css.setSize(w, h);
      if (current && scenarioOf(current)) placeView(scenarioOf(current));
    }
    if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
    resize();
    requestAnimationFrame(frame);
  }

  function frame(){
    requestAnimationFrame(frame);
    var dt = Math.min(clock.getDelta(), 0.05);
    time += dt * SPEED;
    if (fly){
      var k = Math.min(1, (performance.now() - fly.s) / fly.d);
      var e = k < 0.5 ? 4*k*k*k : 1 - Math.pow(-2*k + 2, 3) / 2;
      cam.position.lerpVectors(fly.p0, fly.p1, e);
      controls.target.lerpVectors(fly.t0, fly.t1, e);
      if (k >= 1) fly = null;
    }
    var mv = (keys.w || keys.up ? 1 : 0) - (keys.s || keys.down ? 1 : 0);
    var mh = (keys.d || keys.right ? 1 : 0) - (keys.a || keys.left ? 1 : 0);
    if (mv || mh){
      var dist = cam.position.distanceTo(controls.target);
      var fwd = new THREE.Vector3().subVectors(controls.target, cam.position);
      fwd.y = 0;
      if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1);
      fwd.normalize();
      var right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
      var step = dist * 0.9 * dt;
      var move = new THREE.Vector3().addScaledVector(fwd, mv * step).addScaledVector(right, mh * step);
      cam.position.add(move);
      controls.target.add(move);
    }
    if (rebuild){ rebuild = false; rebuildFlows(); }
    controls.update();
    clouds.forEach(function(c, i){ c.rotation.y += dt * 0.015 * (i + 1); });
    rings.forEach(function(r){ r.material.opacity = 0.08 + 0.05 * Math.sin(time * 1.4 + r.userData.phase); });
    FL.forEach(function(o){
      if (!o.group.visible || !o.packets.length) return;
      var n = o.packets.length;
      for (var j = 0; j < n; j++){
        var ph = time * o.f.speed + j / n;
        var u = o.f.pingpong ? (0.5 - 0.5 * Math.cos(2 * Math.PI * ph)) : (ph % 1);
        o.curve.getPointAt(u, o.packets[j].position);
      }
    });
    if (composer) composer.render(dt); else renderer.render(scene3, cam);
    if (css) css.render(scene3, cam);
  }

  /* Controles */
  $('btn-cine').addEventListener('click', function(){
    var on = this.getAttribute('aria-pressed') !== 'true';
    this.setAttribute('aria-pressed', String(on));
    if (controls){ controls.autoRotate = on; controls.autoRotateSpeed = 0.6; }
  });
  $('btn-edit').addEventListener('click', function(){
    editMode = !editMode;
    this.setAttribute('aria-pressed', String(editMode));
    $('editbar').hidden = !editMode;
    if (!editMode && tc) tc.detach();
    if (editMode) closeCard();
  });
  $('btn-save').addEventListener('click', function(){ if (world){ savePositions(); } });
  $('btn-reset').addEventListener('click', function(){
    try { localStorage.removeItem(STORE); } catch(e){}
    fetch('data/example.json').then(function(r){ return r.json(); }).then(validate).then(function(obj){
      data = obj; setHeader(); renderScenarioButtons(); current = null; rebuildAll(); applyScenario(data.scenarios[0].id); syncEditorFromData();
    }).catch(function(e){ $('p-err').textContent = 'Error: ' + fmtErr(e); });
  });
  $('btn-panel').addEventListener('click', function(){
    var open = $('panel').hidden;
    $('panel').hidden = !open;
    this.setAttribute('aria-pressed', String(open));
    if (open){ syncEditorFromData(); renderExtraFiles(); }
  });
  $('p-apply').addEventListener('click', applyEditor);
  $('p-export').addEventListener('click', function(){
    if (!PLAN.export){ $('p-err').textContent = 'Exportar el proyecto requiere la versión completa.'; return; }
    var blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'proyecto-ghapheros.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1000);
  });
  $('p-files').addEventListener('change', function(){
    var kind = $('p-kind').value;
    Array.prototype.forEach.call(this.files, function(f){
      extraFiles.push({name:f.name, kind:kind, note:Math.round(f.size / 1024) + ' KB'});
    });
    this.value = '';
    renderExtraFiles();
  });
  function renderExtraFiles(){
    var ul = $('p-files-list');
    ul.innerHTML = '';
    (data.attachments || []).concat(extraFiles).forEach(function(a){
      var li = document.createElement('li');
      li.textContent = a.kind + ' · ' + a.name + (a.note ? ' · ' + a.note : '');
      ul.appendChild(li);
    });
  }
  $('card-x').addEventListener('click', closeCard);
  function setHud(off){
    $('app').classList.toggle('hud-off', off);
    $('btn-hud').textContent = off ? 'MOSTRAR HUD' : 'OCULTAR HUD';
  }
  $('btn-hud').addEventListener('click', function(){ setHud(true); });
  $('btn-hud-show').addEventListener('click', function(){ setHud(false); });

  var KEYMAP = {w:'w', arrowup:'up', s:'s', arrowdown:'down', a:'a', arrowleft:'left', d:'d', arrowright:'right'};
  window.addEventListener('keydown', function(e){
    var k = KEYMAP[e.key.toLowerCase()];
    if (!k) return;
    var t = e.target && e.target.tagName;
    if (t === 'TEXTAREA' || t === 'INPUT' || t === 'SELECT') return;
    keys[k] = true; e.preventDefault();
  });
  window.addEventListener('keyup', function(e){ var k = KEYMAP[e.key.toLowerCase()]; if (k) keys[k] = false; });

  /* Arranque */
  function showMsg(text){ var m = $('msg'); m.textContent = text; m.hidden = false; }

  loadProject().then(function(obj){
    data = limitProject(obj);
    setHeader();
    if (data.limitado) $('proj-sub').textContent += ' · plan libre: se muestran ' + data.limitado.join(', ');
    renderScenarioButtons();
    syncEditorFromData();
    if (HAS3){
      try { initScene(); }
      catch(err){ console.error('Vista 3D:', err); showMsg('La vista 3D necesita WebGL. El panel inferior describe el mismo proceso.'); }
    } else {
      showMsg('No se cargó Three.js. Revisa la conexión a cdn.jsdelivr.net.');
    }
    if (scene3){
      rebuildAll();
      applyScenario(data.scenarios[0].id);
    } else {
      renderPanels(data.scenarios[0]);
      renderMetrics(data.scenarios[0].id);
      $('kpis').innerHTML = '';
      applyScenarioText(data.scenarios[0].id);
    }
  }).catch(function(e){
    $('proj-sub').textContent = 'Error al cargar el proyecto';
    showMsg(fmtErr(e));
  });

  function applyScenarioText(id){
    var s = scenarioOf(id);
    current = id;
    renderPanels(s);
    renderMetrics(id);
  }
})();
