const CANVAS_SIZE = 800;
const canvasEl = document.getElementById('main-canvas');
const overlay = document.getElementById('loading-overlay');
const loadingText = document.getElementById('loading-text');

// --- 메인 3D 씬 설정 ---
const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({ 
    canvas: canvasEl, antialias: true, preserveDrawingBuffer: true, logarithmicDepthBuffer: true, alpha: true 
});
renderer.setSize(CANVAS_SIZE, CANVAS_SIZE, false);
renderer.autoClear = false;

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 10000);
camera.position.set(0, 200, 600);
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// 조명
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.5);
dirLight1.position.set(200, 300, 200);
scene.add(dirLight1);
const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
dirLight2.position.set(-200, 100, -200);
scene.add(dirLight2);

// --- 조명 UI 연동 로직 ---
const lightPad = document.getElementById('lightControlPad');
const lightHandle = document.getElementById('lightHandle');
let isDraggingLight = false;

function initLightPad() {
    const maxRadius = 33; // (80px / 2) - (14px / 2) 핸들이 넘어가지 않게 여백
    const mapScale = 400 / maxRadius; // 3D 좌표 스케일 매핑
    const dx = dirLight1.position.x / mapScale;
    const dy = dirLight1.position.z / mapScale;
    lightHandle.style.left = `calc(50% + ${dx}px)`;
    lightHandle.style.top = `calc(50% + ${dy}px)`;
}
initLightPad();

function updateLightPosition(e) {
    const rect = lightPad.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    let clientX = e.clientX;
    let clientY = e.clientY;
    if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    }

    let dx = clientX - rect.left - centerX;
    let dy = clientY - rect.top - centerY;
    
    const maxRadius = 33;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist > maxRadius) {
        dx = (dx / dist) * maxRadius;
        dy = (dy / dist) * maxRadius;
    }

    lightHandle.style.left = `calc(50% + ${dx}px)`;
    lightHandle.style.top = `calc(50% + ${dy}px)`;

    const mapScale = 400 / maxRadius;
    dirLight1.position.x = dx * mapScale;
    dirLight1.position.z = dy * mapScale;
}

lightPad.addEventListener('mousedown', (e) => { isDraggingLight = true; updateLightPosition(e); });
window.addEventListener('mousemove', (e) => { if (isDraggingLight) updateLightPosition(e); });
window.addEventListener('mouseup', () => { isDraggingLight = false; });

// 모바일 터치 지원
lightPad.addEventListener('touchstart', (e) => { isDraggingLight = true; updateLightPosition(e); }, {passive: true});
window.addEventListener('touchmove', (e) => { if (isDraggingLight) { updateLightPosition(e); e.preventDefault(); } }, {passive: false});
window.addEventListener('touchend', () => { isDraggingLight = false; });

document.getElementById('lightIntensity').addEventListener('input', (e) => {
    dirLight1.intensity = parseFloat(e.target.value);
});
document.getElementById('ambientIntensity').addEventListener('input', (e) => {
    ambientLight.intensity = parseFloat(e.target.value);
});

document.getElementById('btnResetLight').addEventListener('click', () => {
    // 조명 값 초기화
    dirLight1.position.set(200, 300, 200);
    dirLight1.intensity = 0.5;
    ambientLight.intensity = 0.6;
    
    // 슬라이더 UI 초기화
    document.getElementById('lightIntensity').value = 0.5;
    document.getElementById('ambientIntensity').value = 0.6;
    
    // 컨트롤 패드 손잡이 위치 초기화
    initLightPad();
});

const uiScene = new THREE.Scene();
const uiCamera = new THREE.OrthographicCamera(-CANVAS_SIZE/2, CANVAS_SIZE/2, CANVAS_SIZE/2, -CANVAS_SIZE/2, 1, 10);
uiCamera.position.z = 5;

let wmSprite = null;
let wmTexture = null;

function updateWatermark(isTransparent, hexColor) {
    let isLight = true;
    if (!isTransparent) {
        const r = parseInt(hexColor.slice(1, 3), 16);
        const g = parseInt(hexColor.slice(3, 5), 16);
        const b = parseInt(hexColor.slice(5, 7), 16);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        isLight = brightness > 128;
    }

    const wmCanvas = document.createElement('canvas');
    wmCanvas.width = 400; wmCanvas.height = 60;
    const wmCtx = wmCanvas.getContext('2d');
    
    wmCtx.fillStyle = isLight ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.7)';
    wmCtx.font = 'bold 22px sans-serif';
    wmCtx.textAlign = 'right';
    wmCtx.fillText('@bb_uu_t 아크릴 스탠드 메이커', 390, 35);
    
    if (!wmSprite) {
        wmTexture = new THREE.CanvasTexture(wmCanvas);
        wmSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: wmTexture, transparent: true }));
        wmSprite.scale.set(400, 60, 1);
        wmSprite.position.set(CANVAS_SIZE/2 - 210, -CANVAS_SIZE/2 + 40, 0); 
        uiScene.add(wmSprite);
    } else {
        wmTexture.image = wmCanvas;
        wmTexture.needsUpdate = true;
    }
}

// 전역 변수
let pivotContainer = null;
let uploadedImage = null;
let uploadedBackImage = null;
let uploadedBaseImage = null;

// --- UI 연동 ---
const elThickness = document.getElementById('thickness');
const elMargin = document.getElementById('margin');
const elBaseSize = document.getElementById('baseSize');

elThickness.addEventListener('input', e => document.getElementById('valThickness').textContent = e.target.value);
elMargin.addEventListener('input', e => document.getElementById('valMargin').textContent = e.target.value);
elBaseSize.addEventListener('input', e => document.getElementById('valBaseSize').textContent = e.target.value);

function updateBaseOptionsUI() {
    const isBottom = document.getElementById('pivotType').value === 'bottom';
    const isContour = document.getElementById('baseShapeType').value === 'contour';
    document.getElementById('baseOptionsPanel').style.display = isBottom ? 'block' : 'none';
    document.getElementById('baseSizeContainer').style.display = isContour ? 'none' : 'block';
}
document.getElementById('pivotType').addEventListener('change', updateBaseOptionsUI);
document.getElementById('baseShapeType').addEventListener('change', () => { updateBaseOptionsUI(); if(uploadedImage) generateAcrylic(); });
elBaseSize.addEventListener('change', () => { if(uploadedImage) generateAcrylic(); });
updateBaseOptionsUI();

function updateBackground() {
    const isTransparent = document.getElementById('bgTransparent').checked;
    const color = document.getElementById('bgColor').value;
    if (isTransparent) {
        scene.background = null;
        renderer.setClearColor(0x000000, 0);
        canvasEl.classList.add('bg-checker');
        canvasEl.style.backgroundColor = 'transparent';
    } else {
        scene.background = new THREE.Color(color);
        renderer.setClearColor(color, 1);
        canvasEl.classList.remove('bg-checker');
        canvasEl.style.backgroundColor = color;
    }
    updateWatermark(isTransparent, color);
}
document.getElementById('bgTransparent').addEventListener('change', updateBackground);
document.getElementById('bgColor').addEventListener('input', updateBackground);
updateBackground();

// 라이선스 모달 이벤트
const licenseModal = document.getElementById('licenseModal');
document.getElementById('btnInfo').addEventListener('click', () => licenseModal.style.display = 'flex');
document.getElementById('btnCloseModal').addEventListener('click', () => licenseModal.style.display = 'none');
licenseModal.addEventListener('click', (e) => { if(e.target === licenseModal) licenseModal.style.display = 'none'; });

// --- 공통 외곽선 추적 유틸리티 ---
function getContour(imageData, width, height) {
    const data = imageData.data;
    const isSolid = (x, y) => {
        if (x < 0 || x >= width || y < 0 || y >= height) return false;
        return data[(y * width + x) * 4 + 3] > 128;
    };

    let startX = -1, startY = -1;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (isSolid(x, y)) { startX = x; startY = y; break; }
        }
        if (startX !== -1) break;
    }
    if (startX === -1) return [];

    const boundary = [];
    let currX = startX, currY = startY;
    let backDir = 3;
    const dx = [1, 1, 0, -1, -1, -1, 0, 1];
    const dy = [0, 1, 1, 1, 0, -1, -1, -1];

    let attempts = 0;
    do {
        boundary.push({x: currX, y: currY});
        let found = false;
        let searchDir = (backDir + 2) % 8; 
        for (let i = 0; i < 8; i++) {
            let dir = (searchDir + i) % 8;
            let nx = currX + dx[dir]; let ny = currY + dy[dir];
            if (isSolid(nx, ny)) {
                currX = nx; currY = ny; backDir = (dir + 4) % 8; found = true; break;
            }
        }
        if (!found) break;
        attempts++;
        if (attempts > width * height) break;
    } while (currX !== startX || currY !== startY);
    return boundary;
}

function smoothContour(points, windowSize = 7) {
    if (points.length < windowSize) return points;
    const smoothed = [];
    for (let i = 0; i < points.length; i++) {
        let sumX = 0, sumY = 0;
        for (let j = 0; j < windowSize; j++) {
            let idx = (i + j - Math.floor(windowSize / 2) + points.length) % points.length;
            sumX += points[idx].x; sumY += points[idx].y;
        }
        smoothed.push({ x: sumX / windowSize, y: sumY / windowSize });
    }
    const simplified = [smoothed[0]];
    for (let i = 1; i < smoothed.length; i++) {
        const last = simplified[simplified.length - 1];
        const dx = smoothed[i].x - last.x; const dy = smoothed[i].y - last.y;
        if (Math.sqrt(dx * dx + dy * dy) > 2) simplified.push(smoothed[i]);
    }
    return simplified;
}

function createShapeFromImage(img, expandPx, maxDim = 400) {
    let scale = 1;
    if (img.width > maxDim || img.height > maxDim) {
        scale = maxDim / Math.max(img.width, img.height);
    }
    const w = Math.floor(img.width * scale);
    const h = Math.floor(img.height * scale);
    const scaledExpand = Math.floor(expandPx * scale);
    const cw = w + scaledExpand * 2;
    const ch = h + scaledExpand * 2;

    const cvs1 = document.createElement('canvas');
    cvs1.width = w; cvs1.height = h;
    const ctx1 = cvs1.getContext('2d');
    ctx1.drawImage(img, 0, 0, w, h);

    const cvs2 = document.createElement('canvas');
    cvs2.width = cw; cvs2.height = ch;
    const ctx2 = cvs2.getContext('2d', { willReadFrequently: true });

    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
        ctx2.drawImage(cvs1, scaledExpand + Math.cos(angle) * scaledExpand, scaledExpand + Math.sin(angle) * scaledExpand);
    }

    const imgData = ctx2.getImageData(0, 0, cw, ch);
    for (let i = 0; i < imgData.data.length; i += 4) {
        imgData.data[i + 3] = imgData.data[i + 3] > 30 ? 255 : 0;
    }
    ctx2.putImageData(imgData, 0, 0);

    let points = getContour(imgData, cw, ch);
    if (points.length === 0) return null;
    points = smoothContour(points, 7);

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    points.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
    });
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    const shape = new THREE.Shape();
    shape.moveTo((points[0].x - cx) / scale, -(points[0].y - cy) / scale);
    for (let i = 1; i < points.length; i++) {
        shape.lineTo((points[i].x - cx) / scale, -(points[i].y - cy) / scale);
    }
    
    const planeOffsetX = (cw / 2 - cx) / scale;
    const planeOffsetY = (cy - ch / 2) / scale;

    return { shape, points, scale, cw, ch, planeOffsetX, planeOffsetY, cx, cy };
}

// --- 카메라 초점 초기화 함수 ---
function resetCamera() {
    if (!pivotContainer) return;
    
    pivotContainer.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(pivotContainer);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    const maxDimension = Math.max(
        Math.sqrt(size.x * size.x + size.z * size.z),
        size.y
    );

    const fovRad = camera.fov * (Math.PI / 180);
    const cameraDistance = (maxDimension / 2) / Math.tan(fovRad / 2) * 1.35;

    camera.far = Math.max(10000, cameraDistance * 3);
    camera.updateProjectionMatrix();

    camera.position.set(0, center.y, cameraDistance);
    controls.target.set(0, center.y, 0);
    controls.update();
}
document.getElementById('btnResetCamera').addEventListener('click', resetCamera);

// --- 메인 아크릴 생성 로직 ---
function generateAcrylic() {
    if (!uploadedImage) {
        alert('먼저 앞면 이미지를 업로드해주세요.');
        return;
    }

    showLoading('아크릴 3D 모델을 생성 중입니다...');

    setTimeout(() => {
        try {
            if (pivotContainer) scene.remove(pivotContainer);

            const thickness = parseInt(elThickness.value);
            const expandPx = parseInt(elMargin.value);
            const pivotType = document.getElementById('pivotType').value;
            const mode = document.getElementById('contourMode').value;
            const hasBackImage = !!uploadedBackImage;

            const frontData = createShapeFromImage(uploadedImage, expandPx);
            if (!frontData) throw new Error("앞면 이미지에서 형태를 찾을 수 없습니다.");

            let backData = null;
        if (hasBackImage) {
            backData = createShapeFromImage(uploadedBackImage, expandPx);
            if (!backData) throw new Error("뒷면 이미지에서 형태를 찾을 수 없습니다.");
        }

        // V7 이전 룩으로 아크릴 재질 롤백
        const acrylicMaterial = new THREE.MeshPhongMaterial({
            color: 0xffffff, transparent: true, opacity: 0.4,
            shininess: 100, specular: 0xffffff, side: THREE.DoubleSide
        });

        const textureLoader = new THREE.TextureLoader();
        const texFront = textureLoader.load(uploadedImage.src);
        const texBack = hasBackImage ? textureLoader.load(uploadedBackImage.src) : texFront;

        const textureType = document.getElementById('textureType').value;
        
        const matFront = textureType === 'glossy' 
            ? new THREE.MeshPhongMaterial({ map: texFront, transparent: true, side: THREE.FrontSide, alphaTest: 0.05, shininess: 100, specular: 0xffffff })
            : new THREE.MeshBasicMaterial({ map: texFront, transparent: true, side: THREE.FrontSide, alphaTest: 0.05 });
        
        const matBack = textureType === 'glossy'
            ? new THREE.MeshPhongMaterial({ map: texBack, transparent: true, side: THREE.FrontSide, alphaTest: 0.05, shininess: 100, specular: 0xffffff })
            : new THREE.MeshBasicMaterial({ map: texBack, transparent: true, side: THREE.FrontSide, alphaTest: 0.05 });

        const frontPlaneGeo = new THREE.PlaneGeometry(uploadedImage.width, uploadedImage.height);
        const backPlaneGeo = hasBackImage ? new THREE.PlaneGeometry(uploadedBackImage.width, uploadedBackImage.height) : frontPlaneGeo;

            const mainGroup = new THREE.Group();
            const gap = 1.0; 

            pivotContainer = new THREE.Group();
            pivotContainer.userData.mode = mode;
            pivotContainer.userData.hasBackImage = hasBackImage;

            // 입체 생성
            if (mode === 'unified' || (!hasBackImage && mode === 'separate')) {
                const extrudeSettings = { depth: thickness, bevelEnabled: false };
                const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(frontData.shape, extrudeSettings), acrylicMaterial);
                mesh.position.z = -thickness / 2; mesh.renderOrder = 0;
                mainGroup.add(mesh);

                const frontPlane = new THREE.Mesh(frontPlaneGeo, matFront);
                frontPlane.position.set(frontData.planeOffsetX, frontData.planeOffsetY, thickness / 2 + gap);
                frontPlane.renderOrder = 1;
                mainGroup.add(frontPlane);

                const backPlane = new THREE.Mesh(backPlaneGeo, matBack);
                if (hasBackImage) {
                    backPlane.position.set(-backData.planeOffsetX, backData.planeOffsetY, -thickness / 2 - gap);
                } else {
                    backPlane.position.set(frontData.planeOffsetX, frontData.planeOffsetY, -thickness / 2 - gap);
                    backPlane.scale.x = -1; 
                }
                backPlane.rotation.y = Math.PI; backPlane.renderOrder = 1;
                mainGroup.add(backPlane);

            } else {
                const frontMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(frontData.shape, { depth: thickness, bevelEnabled: false }), acrylicMaterial);
                frontMesh.position.z = -thickness / 2; frontMesh.renderOrder = 0;
                const frontPlane = new THREE.Mesh(frontPlaneGeo, matFront);
                frontPlane.position.set(frontData.planeOffsetX, frontData.planeOffsetY, thickness / 2 + gap);
                frontPlane.renderOrder = 1;
                
                const frontGroup = new THREE.Group();
                frontGroup.add(frontMesh); frontGroup.add(frontPlane);
                mainGroup.add(frontGroup);

                const backMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(backData.shape, { depth: thickness, bevelEnabled: false }), acrylicMaterial);
                backMesh.position.z = -thickness / 2; backMesh.renderOrder = 0;
                const backPlaneMesh = new THREE.Mesh(backPlaneGeo, matBack);
                backPlaneMesh.position.set(backData.planeOffsetX, backData.planeOffsetY, thickness / 2 + gap);
                backPlaneMesh.renderOrder = 1;

                const backGroup = new THREE.Group();
                backGroup.add(backMesh); backGroup.add(backPlaneMesh);
                backGroup.rotation.y = Math.PI;
                mainGroup.add(backGroup);

                pivotContainer.userData.frontGroup = frontGroup;
                pivotContainer.userData.backGroup = backGroup;
            }
            
            // 받침대(바닥) 옵션
            if (pivotType === 'bottom') {
                let minY = Infinity;
                frontData.points.forEach(p => {
                    let yPos = -(p.y - frontData.cy) / frontData.scale;
                    if (yPos < minY) minY = yPos;
                });
                mainGroup.position.y = -minY;

                const baseGroup = new THREE.Group();
                const baseThickness = thickness; 
                
                const baseShapeType = document.getElementById('baseShapeType').value;
                const baseRadius = parseInt(elBaseSize.value);
                
                let baseShape;
                let baseScale = 1;
                let basePlaneGeo = null;

                if (baseShapeType === 'contour' && uploadedBaseImage) {
                    const baseData = createShapeFromImage(uploadedBaseImage, expandPx);
                    if (!baseData) throw new Error("바닥 이미지에서 형태를 찾을 수 없습니다.");
                    baseShape = baseData.shape;
                    basePlaneGeo = new THREE.PlaneGeometry(uploadedBaseImage.width, uploadedBaseImage.height);
                } else {
                    baseShape = new THREE.Shape();
                    if (baseShapeType === 'square' || (baseShapeType === 'contour' && !uploadedBaseImage)) {
                        baseShape.moveTo(-baseRadius, -baseRadius);
                        baseShape.lineTo(baseRadius, -baseRadius);
                        baseShape.lineTo(baseRadius, baseRadius);
                        baseShape.lineTo(-baseRadius, baseRadius);
                    } else {
                        baseShape.absarc(0, 0, baseRadius, 0, Math.PI * 2, false);
                    }
                    
                    if (uploadedBaseImage) {
                        const maxDim = Math.max(uploadedBaseImage.width, uploadedBaseImage.height);
                        baseScale = (baseRadius * 2 * 0.9) / maxDim;
                        basePlaneGeo = new THREE.PlaneGeometry(uploadedBaseImage.width * baseScale, uploadedBaseImage.height * baseScale);
                    }
                }

                const baseMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(baseShape, { depth: baseThickness, bevelEnabled: false }), acrylicMaterial);
                baseMesh.position.z = -baseThickness / 2;
                baseMesh.renderOrder = 0;
                baseGroup.add(baseMesh);

                if (uploadedBaseImage && basePlaneGeo) {
                    const baseTex = textureLoader.load(uploadedBaseImage.src);
                    const baseMat = textureType === 'glossy'
                        ? new THREE.MeshPhongMaterial({ map: baseTex, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide, shininess: 100, specular: 0xffffff })
                        : new THREE.MeshBasicMaterial({ map: baseTex, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide });
                    
                    const baseImgMesh = new THREE.Mesh(basePlaneGeo, baseMat);
                    if (baseShapeType === 'contour') {
                        const bd = createShapeFromImage(uploadedBaseImage, expandPx);
                        baseImgMesh.position.set(bd.planeOffsetX, bd.planeOffsetY, baseThickness / 2 + 0.5);
                    } else {
                        baseImgMesh.position.z = baseThickness / 2 + 0.5;
                    }
                    baseImgMesh.renderOrder = 1;
                    baseGroup.add(baseImgMesh);
                }

                baseGroup.rotation.x = -Math.PI / 2;
                baseGroup.position.y = -baseThickness / 2; 
                
                pivotContainer.add(baseGroup);
            }

            pivotContainer.add(mainGroup);
            scene.add(pivotContainer);

            resetCamera();

            document.getElementById('btnExportVideo').disabled = false;
            document.getElementById('btnExportAPNG').disabled = false;
            document.getElementById('btnExportGIF').disabled = false;
            document.getElementById('btnExportGLTF').disabled = false;

            hideLoading();
        } catch (err) {
            hideLoading();
            alert("오류가 발생했습니다: " + err.message);
        }
    }, 100);
}

function updateVisibility() {
    if (pivotContainer && pivotContainer.userData.mode === 'separate' && pivotContainer.userData.hasBackImage) {
        const cameraPos = new THREE.Vector3(); camera.getWorldPosition(cameraPos);
        const centerPos = new THREE.Vector3(); pivotContainer.getWorldPosition(centerPos);
        const viewVector = cameraPos.sub(centerPos).normalize();
        const forwardVector = new THREE.Vector3(0, 0, 1).applyQuaternion(pivotContainer.quaternion);
        
        if (forwardVector.dot(viewVector) >= 0) {
            pivotContainer.userData.frontGroup.visible = true;
            pivotContainer.userData.backGroup.visible = false;
        } else {
            pivotContainer.userData.frontGroup.visible = false;
            pivotContainer.userData.backGroup.visible = true;
        }
    }
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    
    const speed = parseInt(document.getElementById('rotationSpeed').value);
    if (pivotContainer && speed > 0) {
        pivotContainer.rotation.y += speed * 0.01;
    }
    
    updateVisibility();
    
    renderer.clear();
    renderer.render(scene, camera);
    renderer.clearDepth();
    renderer.render(uiScene, uiCamera);
}
animate();

// --- 파일 업로드 이벤트 통합 ---
function handleImageUpload(e, type) {
    const file = e.target.files[0];
    if (!file) return;
    
    let label = '이미지';
    if (type === 'front') label = '앞면';
    else if (type === 'back') label = '뒷면';
    else if (type === 'base') label = '바닥';

    showLoading(`${label} 이미지 로드 중...`);
    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() { 
            if (type === 'front') uploadedImage = img; 
            else if (type === 'back') uploadedBackImage = img;
            else if (type === 'base') uploadedBaseImage = img;
            generateAcrylic(); 
        }
        img.src = event.target.result;
    }
    reader.readAsDataURL(file);
}

document.getElementById('imageInput').addEventListener('change', e => handleImageUpload(e, 'front'));
document.getElementById('imageBackInput').addEventListener('change', e => handleImageUpload(e, 'back'));
document.getElementById('imageBaseInput').addEventListener('change', e => handleImageUpload(e, 'base'));

document.getElementById('btnClearBack').addEventListener('click', () => {
    document.getElementById('imageBackInput').value = '';
    uploadedBackImage = null;
    if(uploadedImage) generateAcrylic();
});

document.getElementById('btnClearBase').addEventListener('click', () => {
    document.getElementById('imageBaseInput').value = '';
    uploadedBaseImage = null;
    if(uploadedImage) generateAcrylic();
});

document.getElementById('btnGenerate').addEventListener('click', generateAcrylic);
document.getElementById('contourMode').addEventListener('change', () => { if(uploadedImage) generateAcrylic(); });
document.getElementById('textureType').addEventListener('change', () => { if(uploadedImage) generateAcrylic(); });

// --- 내보내기 (Export) 기능 ---

// 1. WebM Export
document.getElementById('btnExportVideo').addEventListener('click', () => {
    if (!pivotContainer) return;
    showLoading('영상을 녹화 중입니다... (약 3초 소요)');
    
    const originalSpeed = document.getElementById('rotationSpeed').value;
    document.getElementById('rotationSpeed').value = 0; 
    pivotContainer.rotation.y = 0;

    const stream = canvasEl.captureStream(30);
    const isTransparent = document.getElementById('bgTransparent').checked;
    let mimeType = 'video/webm';
    if (isTransparent && MediaRecorder.isTypeSupported('video/webm; codecs=vp9')) {
        mimeType = 'video/webm; codecs=vp9';
    }
    
    let recorder;
    try { recorder = new MediaRecorder(stream, { mimeType }); } 
    catch(e) { recorder = new MediaRecorder(stream); }
    
    const chunks = [];
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'acrylic-stand.webm'; a.click();
        URL.revokeObjectURL(url);
        document.getElementById('rotationSpeed').value = originalSpeed;
        hideLoading();
    };

    const totalFrames = 90; let frame = 0;
    recorder.start(100); 
    
    function recordFrame() {
        if (frame <= totalFrames) {
            pivotContainer.rotation.y = (frame / totalFrames) * Math.PI * 2;
            updateVisibility();
            renderer.clear();
            renderer.render(scene, camera);
            renderer.clearDepth();
            renderer.render(uiScene, uiCamera);
            
            frame++; requestAnimationFrame(recordFrame);
        } else { recorder.stop(); }
    }
    recordFrame();
});

// 2. APNG Export
document.getElementById('btnExportAPNG').addEventListener('click', async () => {
    if (!pivotContainer || typeof UPNG === 'undefined') return;
    showLoading('APNG 프레임을 캡처 중입니다...');
    
    const originalSpeed = document.getElementById('rotationSpeed').value;
    document.getElementById('rotationSpeed').value = 0;
    pivotContainer.rotation.y = 0;

    const isTransparent = document.getElementById('bgTransparent').checked;
    
    const frames = [];
    const delays = [];
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = CANVAS_SIZE;
    tempCanvas.height = CANVAS_SIZE;
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

    const totalFrames = 45;

    for(let frame = 0; frame < totalFrames; frame++) {
        pivotContainer.rotation.y = (frame / totalFrames) * Math.PI * 2;
        updateVisibility();
        
        if (isTransparent) renderer.setClearColor(0x000000, 0);
        
        renderer.clear();
        renderer.render(scene, camera);
        renderer.clearDepth();
        renderer.render(uiScene, uiCamera);
        
        tempCtx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        tempCtx.drawImage(canvasEl, 0, 0);
        
        frames.push(tempCtx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE).data.buffer);
        delays.push(60);
        
        await new Promise(resolve => requestAnimationFrame(resolve));
    }

    loadingText.innerHTML = 'APNG로 병합/인코딩 중입니다...<br><span style="font-size: 13px; color: #f59e0b; margin-top:8px; display:block;">※ 무손실 압축 중 (화면이 잠시 멈출 수 있습니다)</span>';
    
    setTimeout(() => {
        try {
            const apngBuffer = UPNG.encode(frames, CANVAS_SIZE, CANVAS_SIZE, 0, delays);
            const blob = new Blob([apngBuffer], { type: 'image/apng' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'acrylic-stand-animated.png'; a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);
            alert("APNG 인코딩에 실패했습니다.");
        }
        
        document.getElementById('rotationSpeed').value = originalSpeed;
        updateBackground(); 
        hideLoading();
    }, 100);
});

// 3. GIF Export
document.getElementById('btnExportGIF').addEventListener('click', () => {
    if (!pivotContainer || typeof GIF === 'undefined') return;
    showLoading('GIF를 생성 중입니다... 창을 닫지 마세요.');
    
    const originalSpeed = document.getElementById('rotationSpeed').value;
    document.getElementById('rotationSpeed').value = 0;
    pivotContainer.rotation.y = 0;

    const isTransparent = document.getElementById('bgTransparent').checked;
    const workerStr = `importScripts('https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js');`;
    const workerBlob = new Blob([workerStr], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(workerBlob);

    const gifOptions = { workers: 2, quality: 10, width: CANVAS_SIZE, height: CANVAS_SIZE, workerScript: workerUrl };
    if (isTransparent) gifOptions.transparent = 0xFF00FF; 
    const gif = new GIF(gifOptions);

    const totalFrames = 45; let frame = 0;

    function addGifFrame() {
        if (frame < totalFrames) {
            pivotContainer.rotation.y = (frame / totalFrames) * Math.PI * 2;
            updateVisibility();
            
            if (isTransparent) {
                renderer.setClearColor(0xFF00FF, 1);
                scene.background = new THREE.Color(0xFF00FF);
            }
            
            renderer.clear();
            renderer.render(scene, camera);
            renderer.clearDepth();
            renderer.render(uiScene, uiCamera);
            
            gif.addFrame(renderer.domElement, { copy: true, delay: 60 });
            frame++; requestAnimationFrame(addGifFrame);
        } else {
            loadingText.textContent = 'GIF를 인코딩 중입니다...';
            updateBackground();
            gif.render();
        }
    }

    gif.on('finished', function(blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'acrylic-stand.gif'; a.click();
        URL.revokeObjectURL(url); URL.revokeObjectURL(workerUrl);
        document.getElementById('rotationSpeed').value = originalSpeed;
        hideLoading();
    });
    addGifFrame();
});

// 4. 3D GLTF Export
document.getElementById('btnExportGLTF').addEventListener('click', () => {
    if (!pivotContainer) return;
    showLoading('3D 모델을 추출 중입니다...');
    
    const exporter = new THREE.GLTFExporter();
    exporter.parse(pivotContainer, function ( gltf ) {
        const blob = new Blob( [ gltf ], { type: 'application/octet-stream' } );
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'acrylic-stand.glb'; a.click();
        URL.revokeObjectURL(url);
        hideLoading();
    }, { binary: true });
});

function showLoading(text) { loadingText.innerHTML = text; overlay.style.display = 'flex'; }
function hideLoading() { overlay.style.display = 'none'; }