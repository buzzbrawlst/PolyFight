(() => {
  const THREE = window.THREE;
  const canvas = document.querySelector('#game');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x78b9e8);
  scene.fog = new THREE.Fog(0x78b9e8, 55, 220);

  const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, .1, 500);
  const renderer = new THREE.WebGLRenderer({canvas, antialias:true, powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene.add(new THREE.HemisphereLight(0xbfeaff, 0x466044, 2.2));
  const sun = new THREE.DirectionalLight(0xfff1c4, 3.2);
  sun.position.set(-55,90,35); sun.castShadow=true; sun.shadow.mapSize.set(2048,2048); sun.shadow.camera.left=-90; sun.shadow.camera.right=90; sun.shadow.camera.top=90; sun.shadow.camera.bottom=-90; scene.add(sun);

  const groundMat = new THREE.MeshStandardMaterial({color:0x55a943, roughness:.92});
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(500,500,50,50),groundMat);
  ground.rotation.x=-Math.PI/2; ground.receiveShadow=true; scene.add(ground);

  // gentle terrain patches
  const patchMat = new THREE.MeshStandardMaterial({color:0x76bd4e, roughness:1});
  for(let i=0;i<32;i++){
    const p=new THREE.Mesh(new THREE.CircleGeometry(5+Math.random()*10,12),patchMat);
    p.rotation.x=-Math.PI/2; p.position.set((Math.random()-.5)*220,.012,(Math.random()-.5)*220); p.scale.y=.55; scene.add(p);
  }
  // road
  const road=new THREE.Mesh(new THREE.PlaneGeometry(28,500),new THREE.MeshStandardMaterial({color:0x303b43,roughness:.95}));
  road.rotation.x=-Math.PI/2; road.position.y=.02; road.position.x=-48; scene.add(road);
  const lineMat=new THREE.MeshBasicMaterial({color:0xf8d75c});
  for(let z=-245;z<245;z+=10){const l=new THREE.Mesh(new THREE.PlaneGeometry(.35,5),lineMat);l.rotation.x=-Math.PI/2;l.position.set(-48,.035,z);scene.add(l)}

  function tree(x,z,s=1){
    const g=new THREE.Group(); g.position.set(x,0,z); g.scale.setScalar(s);
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.45,.65,4,7),new THREE.MeshStandardMaterial({color:0x71452b})); trunk.position.y=2; trunk.castShadow=true; g.add(trunk);
    const leaves=new THREE.Mesh(new THREE.IcosahedronGeometry(3.2,1),new THREE.MeshStandardMaterial({color:0x2d8b3c,roughness:1})); leaves.position.y=5; leaves.castShadow=true; g.add(leaves);
    const leaves2=leaves.clone(); leaves2.scale.set(.72,.7,.72); leaves2.position.set(1.2,7,.3); g.add(leaves2); scene.add(g);
  }
  for(let i=0;i<55;i++){let x=(Math.random()-.5)*190,z=(Math.random()-.5)*190;if(Math.abs(x+48)<18) x+=30; tree(x,z,.65+Math.random()*.65)}

  // small POI buildings
  const buildingMat=new THREE.MeshStandardMaterial({color:0xe3b16d,roughness:.85});
  for(let i=0;i<9;i++){
    const b=new THREE.Mesh(new THREE.BoxGeometry(8,5+Math.random()*5,7),buildingMat); b.position.set(35+(i%3)*12,2.5,-35+Math.floor(i/3)*14); b.castShadow=true;b.receiveShadow=true;scene.add(b);
    const roof=new THREE.Mesh(new THREE.ConeGeometry(6.2,2.4,4),new THREE.MeshStandardMaterial({color:0x3e5367}));roof.position.set(b.position.x,7,b.position.z);roof.rotation.y=Math.PI/4;roof.castShadow=true;scene.add(roof);
  }

  const player=new THREE.Group(); player.position.set(0,0,18); scene.add(player);
  const body=new THREE.Mesh(new THREE.CapsuleGeometry(.55,1.25,5,10),new THREE.MeshStandardMaterial({color:0x2b3344,roughness:.7})); body.position.y=1.45;body.castShadow=true;player.add(body);
  const jacket=new THREE.Mesh(new THREE.BoxGeometry(1.1,.8,.62),new THREE.MeshStandardMaterial({color:0x3b83b7,roughness:.8})); jacket.position.set(0,1.55,0);jacket.castShadow=true;player.add(jacket);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.43,16,12),new THREE.MeshStandardMaterial({color:0xf0bd9b,roughness:.8})); head.position.y=2.45;head.castShadow=true;player.add(head);
  const cap=new THREE.Mesh(new THREE.SphereGeometry(.48,16,8,0,Math.PI*2,0,Math.PI*.52),new THREE.MeshStandardMaterial({color:0x19aee1}));cap.position.y=2.56;cap.castShadow=true;player.add(cap);

  const builds=[]; let selectedBuild=null; let editState=null; let buildRotation=0; let selectedPiece=0;
  const pieceNames=['WALL','FLOOR','RAMP','CONE'];
  const mats={wood:new THREE.MeshStandardMaterial({color:0xb67b46,roughness:.9}),brick:new THREE.MeshStandardMaterial({color:0x9c6154,roughness:.9}),metal:new THREE.MeshStandardMaterial({color:0x6c7b86,metalness:.5,roughness:.55})};
  const buildGroup=new THREE.Group();scene.add(buildGroup);

  function makePiece(type,pos,rot=0,material='wood',pattern=null){
    const g=new THREE.Group(); g.position.copy(pos); g.rotation.y=rot; g.userData={type,owner:'player',pattern:pattern||[],base:true};
    const m=mats[material];
    if(type===0) buildWall(g,m); if(type===1) buildFloor(g,m); if(type===2) buildRamp(g,m); if(type===3) buildCone(g,m);
    g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.userData.build=g}});buildGroup.add(g);builds.push(g);return g;
  }
  function buildWall(g,m,pattern=[]){
    const w=3.8,h=3.8,t=.22; const cells=pattern.length?pattern:null;
    if(!cells){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,t),m);mesh.position.y=h/2;g.add(mesh);return}
    for(let r=0;r<3;r++)for(let c=0;c<3;c++)if(!cells.includes(r*3+c)){const mw=w/3,mh=h/3;const q=new THREE.Mesh(new THREE.BoxGeometry(mw-.035,mh-.035,t),m);q.position.set((c-1)*mw+mw/2-mw/2,(r+.5)*mh,0);g.add(q)}
  }
  function buildFloor(g,m,pattern=[]){
    const q=new THREE.Mesh(new THREE.BoxGeometry(4,.18,4),m);q.position.y=2.2;g.add(q);
    if(pattern.length){pattern.forEach(i=>{const c=i%3,r=Math.floor(i/3);const cut=new THREE.Mesh(new THREE.BoxGeometry(1.34,.22,1.34),new THREE.MeshStandardMaterial({color:0x55a943}));cut.position.set((c-1)*1.34,2.3,(r-1)*1.34);g.add(cut)})}
  }
  function buildRamp(g,m,pattern=[]){const geo=new THREE.BufferGeometry();const v=new Float32Array([-2,0,-2,2,0,-2,-2,3,2,2,3,2]);geo.setAttribute('position',new THREE.BufferAttribute(v,3));geo.setIndex([0,1,2,1,3,2,0,2,3,0,3,1]);geo.computeVertexNormals();const q=new THREE.Mesh(geo,m);q.position.y=0;g.add(q)}
  function buildCone(g,m,pattern=[]){const q=new THREE.Mesh(new THREE.ConeGeometry(2.75,2.8,4),m);q.rotation.y=Math.PI/4;q.position.y=1.4;g.add(q)}

  function gridCellCenter(index){const col=index%3,row=Math.floor(index/3);return new THREE.Vector3((col-1)*1.25,(row+.5)*1.25,0)}
  const gridGroup=new THREE.Group(); gridGroup.visible=false; scene.add(gridGroup);
  const gridMaterial=new THREE.LineBasicMaterial({color:0x7fe7ff,transparent:true,opacity:.9});
  const selectedMaterial=new THREE.MeshBasicMaterial({color:0x69ddff,transparent:true,opacity:.42,side:THREE.DoubleSide});
  let cellMeshes=[];
  function showGrid(build){
    gridGroup.clear();cellMeshes=[];gridGroup.visible=true;gridGroup.position.copy(build.position);gridGroup.rotation.copy(build.rotation);
    const type=build.userData.type;
    for(let r=0;r<3;r++)for(let c=0;c<3;c++){
      if(type===2||type===3){/* still use 3x3 selection for intuitive control */}
      const geo=new THREE.PlaneGeometry(1.24,1.24);const cell=new THREE.Mesh(geo,selectedMaterial.clone());cell.position.set((c-1)*1.25,(r+.5)*1.25,.14);cell.rotation.y=0;cell.userData.index=r*3+c;cellMeshes.push(cell);gridGroup.add(cell);
    }
    const linePts=[];for(let i=0;i<=3;i++){const a=-1.875+i*1.25;linePts.push(-1.875,a,0,1.875,a,0);linePts.push(a,0,0,a,3.75,0)}
    const lines=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(linePts,3)),gridMaterial);lines.position.z=.2;gridGroup.add(lines);
    if(type===0){gridGroup.position.y=build.position.y;gridGroup.scale.set(1,1,1)}
  }
  function hideGrid(){gridGroup.visible=false;cellMeshes=[]}

  // starter build cluster
  makePiece(0,new THREE.Vector3(0,0,12),0,'wood');
  makePiece(0,new THREE.Vector3(3.9,0,12),0,'brick');
  makePiece(1,new THREE.Vector3(0,0,8),0,'wood');
  makePiece(2,new THREE.Vector3(-4,0,8),Math.PI/2,'metal');
  makePiece(3,new THREE.Vector3(4,0,8),0,'wood');

  const keys={}; addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='KeyF')enterEdit();if(e.code==='KeyR'&&!editState){buildRotation+=Math.PI/2;toast('BUILD ROTATED')}if(e.code==='Digit1')selectPiece(0);if(e.code==='Digit2')selectPiece(1);if(e.code==='Digit3')selectPiece(2);if(e.code==='Digit4')selectPiece(3);if(e.code==='Digit5')selectPiece(4)});addEventListener('keyup',e=>keys[e.code]=false);
  function selectPiece(i){selectedPiece=i;document.querySelectorAll('.slot').forEach((x,n)=>x.classList.toggle('active',n===i));document.querySelector('#mode').textContent=i===4?'COMBAT MODE':'BUILD MODE'}

  const ray=new THREE.Raycaster(), mouse=new THREE.Vector2();
  function aimRay(){mouse.set(0,0);ray.setFromCamera(mouse,camera)}
  function lookedBuild(){aimRay();const hits=ray.intersectObjects(buildGroup.children,true);for(const h of hits){let b=h.object.userData.build;if(b&&b.userData.owner==='player'&&h.distance<18)return b}return null}
  function placeBuild(){if(selectedPiece===4)return;const dir=new THREE.Vector3();camera.getWorldDirection(dir);dir.y=0;dir.normalize();const target=player.position.clone().add(dir.multiplyScalar(5));target.x=Math.round(target.x/4)*4;target.z=Math.round(target.z/4)*4;const type=selectedPiece;const p=makePiece(type,new THREE.Vector3(target.x,0,target.z),buildRotation,type===1?'brick':type===2?'metal':'wood');toast(pieceNames[type]+' PLACED')}
  function shoot(){if(selectedPiece!==4)return;aimRay();const hits=ray.intersectObjects(scene.children,true);const hit=hits.find(h=>h.object!==ground&&!h.object.parent?.userData?.base);const flash=new THREE.Mesh(new THREE.SphereGeometry(.06,8,8),new THREE.MeshBasicMaterial({color:0xfff0a0}));flash.position.copy(camera.position);scene.add(flash);setTimeout(()=>scene.remove(flash),55);if(hit)toast('PULSE HIT')}

  let drag=false,hover=-1,selection=new Set();
  addEventListener('mousedown',e=>{if(e.button===2){if(editState){resetEdit()}return}if(editState){drag=true;pickCell(e)}else if(e.button===0){if(selectedPiece===4)shoot();else placeBuild()}});
  addEventListener('mousemove',e=>{if(!editState)return;const rect=canvas.getBoundingClientRect();mouse.x=((e.clientX-rect.left)/rect.width)*2-1;mouse.y=-((e.clientY-rect.top)/rect.height)*2+1;ray.setFromCamera(mouse,camera);const hits=ray.intersectObjects(cellMeshes,false);hover=hits.length?hits[0].object.userData.index:-1;if(drag&&hover>=0){selection.add(hover);updateGrid()}});
  addEventListener('mouseup',e=>{if(e.button===0&&editState&&drag){drag=false;confirmEdit()}});
  addEventListener('contextmenu',e=>e.preventDefault());
  function pickCell(e){const rect=canvas.getBoundingClientRect();mouse.x=((e.clientX-rect.left)/rect.width)*2-1;mouse.y=-((e.clientY-rect.top)/rect.height)*2+1;ray.setFromCamera(mouse,camera);const hits=ray.intersectObjects(cellMeshes,false);if(hits.length){selection.clear();selection.add(hits[0].object.userData.index);updateGrid()}}
  function updateGrid(){cellMeshes.forEach(c=>c.material.opacity=selection.has(c.userData.index)?.62:.08);document.querySelector('#selectedCount').textContent=selection.size+' TILES';previewPattern()}
  function previewPattern(){if(!editState)return;editState.build.children.filter(x=>x.userData.preview).forEach(x=>editState.build.remove(x));const ghostMat=new THREE.MeshBasicMaterial({color:0x62ddff,transparent:true,opacity:.32,wireframe:true});const p=[...selection];const b=editState.build; if(b.userData.type===0){p.forEach(i=>{const q=new THREE.Mesh(new THREE.BoxGeometry(1.24,1.24,.18),ghostMat);const c=i%3,r=Math.floor(i/3);q.position.set((c-1)*1.27,(r+.5)*1.27,.05);q.userData.preview=true;b.add(q)})}}
  function enterEdit(){if(editState)return;const b=lookedBuild();if(!b){toast('LOOK AT YOUR BUILD');return}selectedBuild=b;editState={build:b,oldMaterial:null};selection.clear();showGrid(b);document.querySelector('#editPanel').classList.remove('hidden');document.querySelector('#editHint').textContent='SELECT TILES';toast('EDIT MODE');}
  function confirmEdit(){if(!editState||selection.size===0)return;const b=editState.build;b.children.slice().forEach(x=>b.remove(x));b.userData.pattern=[...selection];const m=b.userData.type===1?mats.brick:b.userData.type===2?mats.metal:mats.wood;if(b.userData.type===0)buildWall(b,m,[...selection]);else if(b.userData.type===1)buildFloor(b,m,[...selection]);else if(b.userData.type===2)buildRamp(b,m,[...selection]);else buildCone(b,m,[...selection]);b.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.userData.build=b}});hideGrid();document.querySelector('#editPanel').classList.add('hidden');document.querySelector('#editHint').textContent='';editState=null;toast('EDIT CONFIRMED');}
  function resetEdit(){if(!editState)return;const b=editState.build;b.children.slice().forEach(x=>b.remove(x));const m=b.userData.type===1?mats.brick:b.userData.type===2?mats.metal:mats.wood;if(b.userData.type===0)buildWall(b,m);else if(b.userData.type===1)buildFloor(b,m);else if(b.userData.type===2)buildRamp(b,m);else buildCone(b,m);b.userData.pattern=[];hideGrid();document.querySelector('#editPanel').classList.add('hidden');editState=null;toast('EDIT RESET');}

  let yaw=0,pitch=.24,shootCooldown=0,storm=45,last=performance.now();
  addEventListener('mousemove',e=>{if(document.pointerLockElement===canvas){yaw-=e.movementX*.0022;pitch=Math.max(-.15,Math.min(.7,pitch-e.movementY*.0016))}});
  canvas.addEventListener('click',()=>canvas.requestPointerLock?.());
  function update(dt){
    const forward=new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw)),right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));const v=new THREE.Vector3();if(keys.KeyW)v.add(forward);if(keys.KeyS)v.sub(forward);if(keys.KeyD)v.add(right);if(keys.KeyA)v.sub(right);if(v.lengthSq())v.normalize().multiplyScalar((keys.ShiftLeft||keys.ShiftRight?9:5)*dt);player.position.add(v);player.position.x=THREE.MathUtils.clamp(player.position.x,-115,115);player.position.z=THREE.MathUtils.clamp(player.position.z,-115,115);
    const target=player.position.clone();target.y=1.35;const camDist=8.2;const offset=new THREE.Vector3(-Math.sin(yaw)*camDist,3.2+pitch*2, -Math.cos(yaw)*camDist);camera.position.lerp(target.clone().add(offset),1-Math.pow(.001,dt));camera.lookAt(target.clone().add(new THREE.Vector3(Math.sin(yaw)*2,pitch,Math.cos(yaw)*2)));
    if(keys.Space&&player.position.y<=.01)player.position.y=.01;
    shootCooldown=Math.max(0,shootCooldown-dt);storm-=dt;if(storm<=0)storm=45;document.querySelector('#stormTime').textContent='00:'+String(Math.ceil(storm)).padStart(2,'0');document.querySelector('#compass').firstChild.textContent='N '+Math.round(((yaw*180/Math.PI)%360+360)%360)+'° ';
  }
  function toast(text){const el=document.querySelector('#toast');el.textContent=text;el.classList.add('toast-show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('toast-show'),900)}
  function animate(now){requestAnimationFrame(animate);const dt=Math.min(.033,(now-last)/1000);last=now;update(dt);renderer.render(scene,camera)}
  addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
  setTimeout(()=>{document.querySelector('#loading').style.opacity=0;setTimeout(()=>document.querySelector('#loading').remove(),500);toast('DROPZONE ONLINE')},850);
  animate(performance.now());
})();
