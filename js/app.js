/* =============================================================================
   app.js — Lógica de la presentación, visores 3D (Three.js) y transiciones
   Indagación: "La Germinación de la Lenteja y la Cantidad de Agua"
   Optimizado: carga diferida, caché de modelos y pausa de render off-screen.
   ============================================================================= */

/* ---------------------------------------------------------------------------
   1. ESTADO GLOBAL
--------------------------------------------------------------------------- */
const slides = Array.from(document.querySelectorAll('.slide'));
const slideContainer = document.getElementById('slidesContainer');
let currentSlide = 0;
let isTransitioning = false;
let documentHidden = document.visibilityState === 'hidden';

// Fases de crecimiento para la planta de progreso inferior
const growthStages = [
    { text: 'Fase: Semilla en reposo', icon: '<circle cx="12" cy="14" r="5"/>' },
    { text: 'Fase: Planteamiento del problema', icon: '<path d="M12 3l4 6a4 4 0 1 1-8 0z"/><circle cx="12" cy="18" r="3"/>' },
    { text: 'Fase: Variables y diseño', icon: '<circle cx="12" cy="14" r="4"/><path d="M12 18v4"/>' },
    { text: 'Fase: Registro de resultados', icon: '<path d="M3 3v18h18"/>' },
    { text: 'Fase: Análisis de evidencia', icon: '<circle cx="12" cy="12" r="3"/><path d="M12 15v6"/>' },
    { text: 'Fase: Sustentación celular', icon: '<path d="M12 20V8"/><path d="M12 12c-3-1-4-3-4-5 2 0 4 1 4 5z"/>' },
    { text: 'Fase: Conclusiones', icon: '<path d="M7 20h10"/><path d="M12 20V5"/>' }
];

/* ---------------------------------------------------------------------------
   2. TOAST
--------------------------------------------------------------------------- */
let toastTimer = null;
function showToast(msg) {
    const box = document.getElementById('toastBox');
    if (!box) return;
    box.textContent = msg;
    box.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => box.classList.remove('show'), 2400);
}

/* ---------------------------------------------------------------------------
   3. NAVEGACIÓN ENTRE DIAPOSITIVAS
--------------------------------------------------------------------------- */
function assignStagger(slide) {
    slide.querySelectorAll('.stagger').forEach((el, i) => el.style.setProperty('--i', i));
}

function buildDots() {
    const nav = document.getElementById('slideDotsNav');
    nav.innerHTML = '';
    slides.forEach((slide, idx) => {
        const dot = document.createElement('button');
        dot.className = 'slide-dot' + (idx === 0 ? ' active' : '');
        dot.setAttribute('aria-label', `Ir a diapositiva ${idx + 1}: ${slide.dataset.title}`);
        dot.title = slide.dataset.title;
        dot.addEventListener('click', () => goToSlide(idx));
        nav.appendChild(dot);
    });
}

function updateHUD() {
    const num = String(currentSlide + 1).padStart(2, '0');
    const total = String(slides.length).padStart(2, '0');
    const title = slides[currentSlide].dataset.title;

    document.getElementById('slideCounter').textContent = `${num} / ${total}`;
    document.getElementById('headerSlideLabel').textContent = `${num} / ${total} — ${title}`;
    document.getElementById('progressBarFill').style.width = `${((currentSlide + 1) / slides.length) * 100}%`;

    document.getElementById('prevBtn').disabled = currentSlide === 0;
    document.getElementById('nextBtn').disabled = currentSlide === slides.length - 1;

    document.querySelectorAll('.slide-dot').forEach((dot, idx) => dot.classList.toggle('active', idx === currentSlide));
    document.querySelectorAll('.overview-card').forEach((card, idx) => card.classList.toggle('current', idx === currentSlide));

    const stage = growthStages[currentSlide] || growthStages[0];
    document.getElementById('growthStageText').textContent = stage.text;
    document.getElementById('growthStageIcon').innerHTML =
        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${stage.icon}</svg>`;
}

function goToSlide(targetIdx) {
    if (targetIdx < 0 || targetIdx >= slides.length || targetIdx === currentSlide || isTransitioning) return;
    isTransitioning = true;
    currentSlide = targetIdx;

    slideContainer.style.transform = `translateX(-${currentSlide * 100}%)`;

    slides.forEach((slide, idx) => {
        if (idx === currentSlide) {
            slide.classList.add('is-active');
            assignStagger(slide);
        } else {
            slide.classList.remove('is-active');
        }
    });

    updateHUD();
    syncViewers(); // carga diferida / pausa de visores 3D

    if (currentSlide === 3) {
        setTimeout(() => { if (typeof resizeCharts === 'function') resizeCharts(); }, 150);
    }

    setTimeout(() => {
        isTransitioning = false;
        resizeViewers();
    }, 820);
}

document.getElementById('prevBtn').addEventListener('click', () => goToSlide(currentSlide - 1));
document.getElementById('nextBtn').addEventListener('click', () => goToSlide(currentSlide + 1));

// Teclado
document.addEventListener('keydown', (e) => {
    if (document.activeElement && document.activeElement.isContentEditable) return;

    const overviewOpen = document.getElementById('overviewModal').classList.contains('open');

    if (e.key === 'Escape') {
        if (overviewOpen) { closeOverview(); return; }
        if (document.body.classList.contains('focus-mode')) toggleFocusMode(false);
        return;
    }

    // Con la vista general abierta, solo se navega saliendo con Esc
    if (overviewOpen) return;

    if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        goToSlide(currentSlide + 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        goToSlide(currentSlide - 1);
    } else if (e.key.toLowerCase() === 'f') {
        toggleFullscreen();
    } else if (e.key.toLowerCase() === 'g') {
        openOverview();
    } else if (e.key >= '1' && e.key <= String(slides.length)) {
        goToSlide(Number(e.key) - 1);
    }
});

// Gestos táctiles (swipe)
let touchStartX = 0;
let touchStartY = 0;
document.getElementById('slidesContainer').addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
}, { passive: true });

document.getElementById('slidesContainer').addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].screenX - touchStartX;
    const dy = e.changedTouches[0].screenY - touchStartY;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        if (dx < 0) goToSlide(currentSlide + 1);
        else goToSlide(currentSlide - 1);
    }
}, { passive: true });

/* ---------------------------------------------------------------------------
   4. NOMBRE DEL EXPOSITOR (persistente)
--------------------------------------------------------------------------- */
const presenterEl = document.getElementById('presenterName');
try {
    const saved = localStorage.getItem('lentil_ppt_presenter');
    if (saved) presenterEl.textContent = saved;
} catch (err) { /* entorno restringido */ }

presenterEl.addEventListener('blur', () => {
    try {
        const val = presenterEl.textContent.trim();
        if (val) {
            localStorage.setItem('lentil_ppt_presenter', val);
            showToast('Nombre del expositor actualizado');
        }
    } catch (err) { /* ignorar */ }
});

/* ---------------------------------------------------------------------------
   5. TEMA CLARO / OSCURO
--------------------------------------------------------------------------- */
const themeToggleBtn = document.getElementById('themeToggleBtn');
try {
    if (localStorage.getItem('lentil_ppt_theme') === 'light') document.documentElement.classList.remove('dark');
} catch (err) { /* ignorar */ }

themeToggleBtn.addEventListener('click', () => {
    const isDark = document.documentElement.classList.toggle('dark');
    try { localStorage.setItem('lentil_ppt_theme', isDark ? 'dark' : 'light'); } catch (err) {}
    if (typeof refreshCharts === 'function') refreshCharts();
    showToast(isDark ? 'Tema oscuro activado' : 'Tema claro activado');
});

/* ---------------------------------------------------------------------------
   6. PANTALLA COMPLETA / MODO ENFOQUE
--------------------------------------------------------------------------- */
function toggleFocusMode(force) {
    const on = typeof force === 'boolean' ? force : !document.body.classList.contains('focus-mode');
    document.body.classList.toggle('focus-mode', on);
    if (on) setTimeout(() => resizeViewers(), 420);
    return on;
}

async function toggleFullscreen() {
    if (document.body.classList.contains('focus-mode')) {
        toggleFocusMode(false);
        showToast('Modo Enfoque desactivado');
        return;
    }
    if (!document.fullscreenEnabled || !document.documentElement.requestFullscreen) {
        toggleFocusMode(true);
        showToast('Modo Enfoque activado (pulsa Esc para salir)');
        return;
    }
    try {
        if (!document.fullscreenElement) {
            await document.documentElement.requestFullscreen();
        } else if (document.exitFullscreen) {
            await document.exitFullscreen();
        }
    } catch (err) {
        toggleFocusMode(true);
        showToast('Modo Enfoque activado (pulsa Esc para salir)');
    }
}
document.getElementById('fullscreenBtn').addEventListener('click', toggleFullscreen);

/* ---------------------------------------------------------------------------
   7. DIAPOSITIVA 2: CONTRASTAR PREGUNTA / HIPÓTESIS
--------------------------------------------------------------------------- */
let contrastState = 0;
function toggleContrast() {
    const q = document.getElementById('questionCard');
    const h = document.getElementById('hypothesisCard');
    contrastState = (contrastState + 1) % 3;
    q.classList.toggle('contrast-focus', contrastState === 1);
    h.classList.toggle('contrast-focus', contrastState === 2);
}

/* ---------------------------------------------------------------------------
   8. DIAPOSITIVA 3: SELECCIÓN DE BOTELLA Y CAMBIO DE MODELO 3D
--------------------------------------------------------------------------- */
function selectBottle(ml) {
    const tr = TREATMENTS.find(t => t.ml === ml) || TREATMENTS[2];
    document.querySelectorAll('.bottle-btn').forEach(b => {
        b.classList.toggle('is-selected', Number(b.dataset.ml) === ml);
    });
    document.getElementById('dataMl').textContent = tr.short;
    document.getElementById('dataGerm').textContent = tr.germination + '%';
    document.getElementById('dataLen').textContent = tr.maxLength + ' cm';
    document.getElementById('dataStatus').textContent = tr.status;
    const v = viewerRefs.variables;
    if (v) v.load(tr.model, tr.fallback);
}

/* ---------------------------------------------------------------------------
   9. DIAPOSITIVA 6: SUSTENTACIÓN CIENTÍFICA + CÁMARA DE LA CÉLULA
--------------------------------------------------------------------------- */
const SCIENCE = [
    {
        title: 'Imbibición y Activación Enzimática',
        text: 'El agua entra en la semilla a través de la testa y el micrópilo, hidratando el embrión y activando enzimas (como la α-amilasa) que convierten el almidón de los cotiledones en energía disponible para el brote.',
        badge: 'Pared celular: absorción inicial de H₂O y activación de enzimas'
    },
    {
        title: 'Presión de Turgencia',
        text: 'El agua llena la gran vacuola central de la célula, que se hincha y empuja la pared celular. Esta presión de turgencia es la que expande y alarga las células del tallo y la raíz. ¡Gira el modelo para explorar la vacuola!',
        badge: 'Vacuola central: expansión por agua que empuja la pared y alarga el tallo/raíz'
    },
    {
        title: 'Diferenciación Celular y Crecimiento de Tejidos',
        text: 'Las células recién divididas se especializan (diferenciación) en tejidos conductores, de sostén y fotosintéticos, dando lugar al alargamiento del tallo, la ramificación de las raíces y la aparición de las hojas.',
        badge: 'Núcleo y cloroplastos: especialización de tejidos y fotosíntesis'
    }
];

function selectScienceTab(index) {
    document.querySelectorAll('#scienceTabs .tab').forEach((tab, i) => {
        tab.classList.toggle('is-selected', i === index);
    });
    const s = SCIENCE[index];
    document.getElementById('sciencePanel').innerHTML =
        `<h3 class="tab-panel-title">${s.title}</h3><p class="tab-panel-text">${s.text}</p>`;

    const badge = document.getElementById('cellBadge');
    if (badge) badge.textContent = s.badge;

    const v = viewerRefs.cell;
    if (!v) return;

    v.setTurgorPulse(false); // apagar el pulso por defecto

    const size = v._size || { x: 1, y: 1, z: 1 };
    const base = v._fitDist || 4;

    let target, dir, dist;
    if (index === 0) {
        // Vista general completa de la célula
        target = [0, 0, 0];
        dir = [0, 0.3, 1];
        dist = base;
    } else if (index === 1) {
        // Zoom a la vacuola central + pulso de turgencia
        target = [0, 0, 0];
        dir = [0, 0.1, 1];
        dist = base * 0.45;
        v.setTurgorPulse(true);
    } else {
        // Rotación y acercamiento hacia el núcleo y los cloroplastos
        target = [size.x * 0.3, -size.y * 0.06, size.z * 0.05];
        dir = [0.5, 0.12, 1];
        dist = base * 0.6;
    }

    v.flyTo(target, dir, dist);
}

/* ---------------------------------------------------------------------------
   10. MOTOR 3D (Three.js) CON CACHÉ DE MODELOS Y FALLBACK SVG
--------------------------------------------------------------------------- */
const viewers = [];
const gltfCache = new Map();      // url -> gltf.scene (plantilla compartida)
const gltfPending = new Map();    // url -> [callbacks pendientes]

function loadModelCached(url, cb) {
    if (gltfCache.has(url)) { cb(gltfCache.get(url)); return; }
    if (gltfPending.has(url)) { gltfPending.get(url).push(cb); return; }
    gltfPending.set(url, [cb]);
    const loader = new THREE.GLTFLoader();
    if (typeof MeshoptDecoder !== 'undefined' && typeof loader.setMeshoptDecoder === 'function') {
        loader.setMeshoptDecoder(MeshoptDecoder);
    }
    loader.load(
        url,
        (gltf) => {
            gltfCache.set(url, gltf.scene);
            const cbs = gltfPending.get(url) || [];
            gltfPending.delete(url);
            cbs.forEach((f) => f(gltf.scene));
        },
        null,
        () => {
            const cbs = gltfPending.get(url) || [];
            gltfPending.delete(url);
            cbs.forEach((f) => f(null));
        }
    );
}

function createViewer3D(containerId, opts = {}) {
    const container = document.getElementById(containerId);
    if (!container) return null;

    const viewer = {
        container,
        autoRotate: opts.autoRotate !== false,
        active: true,
        renderer: null, scene: null, camera: null, controls: null,
        model: null, raf: null, loader: null, disposed: false, fallbackActive: false,
        _pulse: false, _pulseTime: 0, _size: null, _fitDist: null
    };

    viewer._ensure = function () {
        if (viewer.renderer) return true;
        if (typeof THREE === 'undefined' || typeof THREE.OrbitControls === 'undefined' || typeof THREE.GLTFLoader === 'undefined') {
            return false;
        }
        const w = container.clientWidth || 320;
        const h = container.clientHeight || 340;

        viewer.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        viewer.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        viewer.renderer.setSize(w, h);
        viewer.renderer.setClearColor(0x000000, 0);
        viewer.renderer.domElement.style.position = 'absolute';
        viewer.renderer.domElement.style.inset = '0';
        viewer.renderer.domElement.style.width = '100%';
        viewer.renderer.domElement.style.height = '100%';
        container.appendChild(viewer.renderer.domElement);

        viewer.scene = new THREE.Scene();
        viewer.camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 200);
        viewer.camera.position.set(0, 0.6, 4);

        viewer.scene.add(new THREE.AmbientLight(0xffffff, 1.0));
        const key = new THREE.DirectionalLight(0xffffff, 1.6);
        key.position.set(4, 6, 4);
        viewer.scene.add(key);
        const rim = new THREE.DirectionalLight(0xbfefff, 0.7);
        rim.position.set(-3, 2, -3);
        viewer.scene.add(rim);

        viewer.controls = new THREE.OrbitControls(viewer.camera, viewer.renderer.domElement);
        viewer.controls.enableDamping = true;
        viewer.controls.dampingFactor = 0.08;
        viewer.controls.autoRotate = viewer.autoRotate;
        viewer.controls.autoRotateSpeed = 1.3;
        viewer.controls.minDistance = 0.5;
        viewer.controls.maxDistance = 20;
        viewer.controls.target.set(0, 0, 0);

        viewer._loop();
        return true;
    };

    viewer._loop = function () {
        if (viewer.disposed) return;
        viewer.raf = requestAnimationFrame(viewer._loop);
        // Solo renderizar cuando la diapositiva está visible y la pestaña activa
        if (viewer.active && !documentHidden && !viewer.fallbackActive) {
            // Pulso de turgencia: expansión horizontal suave de la célula (1.0 ↔ 1.05)
            if (viewer._pulse && viewer.model) {
                viewer._pulseTime += 0.045;
                const s = 1.025 + Math.sin(viewer._pulseTime) * 0.025;
                viewer.model.scale.set(s, 1, s);
            }
            viewer.controls.update();
            viewer.renderer.render(viewer.scene, viewer.camera);
        }
    };

    viewer.setActive = function (a) {
        viewer.active = a;
        if (!a && viewer.setTurgorPulse) viewer.setTurgorPulse(false);
    };

    viewer.setTurgorPulse = function (on) {
        viewer._pulse = on;
        if (!on && viewer.model) {
            viewer.model.scale.set(1, 1, 1);
        }
    };

    viewer._showLoading = function () {
        viewer._hideFallback();
        let el = container.querySelector('[data-role="loading"]');
        if (!el) {
            el = document.createElement('div');
            el.setAttribute('data-role', 'loading');
            el.className = 'visor-loading';
            el.innerHTML = '<span class="visor-loading-dot"></span> Cargando modelo 3D...';
            container.appendChild(el);
        }
    };

    viewer._hideLoading = function () {
        const el = container.querySelector('[data-role="loading"]');
        if (el) el.remove();
    };

    viewer._showFallback = function (type) {
        viewer._hideLoading();
        viewer.fallbackActive = true;
        if (viewer.renderer) viewer.renderer.domElement.style.display = 'none';
        let fb = container.querySelector('[data-role="fallback"]');
        if (!fb) {
            fb = document.createElement('div');
            fb.setAttribute('data-role', 'fallback');
            fb.className = 'visor-fallback';
            container.appendChild(fb);
        }
        fb.innerHTML = buildFallbackSVG(type);
        fb.style.display = 'flex';
    };

    viewer._hideFallback = function () {
        viewer.fallbackActive = false;
        if (viewer.renderer) viewer.renderer.domElement.style.display = '';
        const fb = container.querySelector('[data-role="fallback"]');
        if (fb) fb.style.display = 'none';
    };

    viewer._clearModel = function () {
        if (!viewer.model) return;
        viewer.scene.remove(viewer.model);
        viewer.model.traverse((o) => {
            if (o.geometry) o.geometry.dispose();
            if (o.material) {
                const mats = Array.isArray(o.material) ? o.material : [o.material];
                mats.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
            }
        });
        viewer.model = null;
    };

    // Centra el modelo y encuadra la cámara con la CAJA delimitadora
    // (mejor que la esfera para modelos verticales como el brote de lenteja)
    viewer._frame = function (obj) {
        const box = new THREE.Box3().setFromObject(obj);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        obj.position.sub(center); // centrar visualmente

        const fov = (viewer.camera.fov * Math.PI) / 180;
        const aspect = viewer.camera.aspect || 1;
        const halfH = Math.tan(fov / 2);
        const halfW = halfH * aspect;
        const dH = size.y / (2 * halfH);
        const dW = Math.max(size.x, size.z) / (2 * halfW);
        const dist = Math.max(dH, dW) * 1.18; // margen del 18%

        viewer._size = size.clone();
        viewer._fitDist = dist;

        viewer.camera.near = Math.max(dist / 1000, 0.001);
        viewer.camera.far = dist * 200;
        viewer.camera.updateProjectionMatrix();

        viewer.controls.target.set(0, 0, 0);
        viewer.camera.position.set(dist * 0.25, dist * 0.12, dist);
        viewer.controls.minDistance = dist * 0.2;
        viewer.controls.maxDistance = dist * 4;
        viewer.controls.update();
    };

    viewer.load = function (modelPath, fallbackType) {
        if (viewer.disposed) return;
        if (!viewer._ensure()) { viewer._showFallback(fallbackType); return; }
        viewer._showLoading();
        viewer._clearModel();
        loadModelCached(modelPath, (template) => {
            if (viewer.disposed) return;
            if (!template) { viewer._showFallback(fallbackType); return; }
            viewer._hideLoading();
            viewer._hideFallback();
            viewer.model = template.clone(true);
            viewer.scene.add(viewer.model);
            viewer._frame(viewer.model);
        });
    };

    viewer.resize = function () {
        if (!viewer.renderer) return;
        const w = container.clientWidth || 320;
        const h = container.clientHeight || 340;
        viewer.renderer.setSize(w, h);
        viewer.camera.aspect = w / h;
        viewer.camera.updateProjectionMatrix();
    };

    // Transición suave de cámara hacia una zona del modelo (lerp de target + posición)
    viewer.flyTo = function (target, dir, distance) {
        if (!viewer.controls || !viewer.camera) return;
        const startTarget = viewer.controls.target.clone();
        const startPos = viewer.camera.position.clone();
        const endTarget = new THREE.Vector3(target[0], target[1], target[2]);
        const dirVec = new THREE.Vector3(dir[0], dir[1], dir[2]).normalize();
        const endPos = endTarget.clone().add(dirVec.multiplyScalar(distance));
        const t0 = performance.now();
        const dur = 850;
        viewer.controls.autoRotate = false;
        function step(now) {
            if (viewer.disposed) return;
            let k = Math.min(1, (now - t0) / dur);
            k = k < 0.5 ? 2 * k * k : -1 + (4 - 2 * k) * k;
            viewer.controls.target.lerpVectors(startTarget, endTarget, k);
            viewer.camera.position.lerpVectors(startPos, endPos, k);
            viewer.controls.update();
            if (k < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    };

    viewer.dispose = function () {
        viewer.disposed = true;
        if (viewer.raf) cancelAnimationFrame(viewer.raf);
        viewer._clearModel();
        if (viewer.renderer) {
            viewer.renderer.dispose();
            if (viewer.renderer.forceContextLoss) viewer.renderer.forceContextLoss();
        }
        container.innerHTML = '';
    };

    viewer.load(opts.modelPath, opts.fallbackType);
    viewers.push(viewer);
    return viewer;
}

function resizeViewers() {
    viewers.forEach((v) => v.resize());
}

/* Carga diferida: cada visor se crea solo al entrar a su diapositiva */
const viewerConfigs = [
    { name: 'portada',   id: 'visor3DPortada',   slideIndex: 0, model: 'assets/models/lenteja_15ml_opt.glb', fallback: 'sprout-15', autoRotate: true },
    { name: 'variables', id: 'visor3DVariables', slideIndex: 2, model: 'assets/models/lenteja_5ml_opt.glb', fallback: 'sprout-5', autoRotate: true },
    { name: 'cell',      id: 'visor3DCelula',    slideIndex: 5, model: 'assets/models/celula_vegetal_opt.glb', fallback: 'cell',     autoRotate: true }
];
const viewerRefs = {};

function syncViewers() {
    viewerConfigs.forEach((cfg) => {
        const onScreen = currentSlide === cfg.slideIndex;
        if (!onScreen) {
            if (viewerRefs[cfg.name]) viewerRefs[cfg.name].setActive(false);
            return;
        }
        if (!viewerRefs[cfg.name]) {
            viewerRefs[cfg.name] = createViewer3D(cfg.id, {
                modelPath: cfg.model,
                fallbackType: cfg.fallback,
                autoRotate: cfg.autoRotate
            });
        }
        viewerRefs[cfg.name].setActive(true);
        viewerRefs[cfg.name].resize();
    });
}

/* ---------------------------------------------------------------------------
   11. FALLBACK VISUAL: ilustraciones SVG dinámicas animadas
--------------------------------------------------------------------------- */
function sproutSVG(h) {
    const stemBottom = 210;
    const topY = stemBottom - h;
    const leafY = topY + 8;
    return `
    <svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="sStem" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0" stop-color="#059669"/><stop offset="1" stop-color="#6ee7b7"/>
            </linearGradient>
            <linearGradient id="sSeed" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#d97706"/><stop offset="1" stop-color="#78350f"/>
            </linearGradient>
        </defs>
        <ellipse cx="150" cy="240" rx="126" ry="30" fill="#0d3627" opacity="0.55"/>
        <ellipse cx="150" cy="230" rx="96" ry="16" fill="#072218" opacity="0.7"/>
        <g class="fb-drop">
            <path d="M70 40 C70 40 78 54 78 60 A8 8 0 1 1 62 60 C62 54 70 40 70 40 Z" fill="#38bdf8"/>
        </g>
        <g class="fb-drop" style="animation-delay:.9s">
            <path d="M228 30 C228 30 236 44 236 50 A8 8 0 1 1 220 50 C220 44 228 30 228 30 Z" fill="#38bdf8"/>
        </g>
        <g class="fb-sway">
            <path d="M150 ${stemBottom} C146 ${stemBottom - h * 0.5} 154 ${topY + h * 0.5} 150 ${topY}" fill="none" stroke="url(#sStem)" stroke-width="7" stroke-linecap="round"/>
            <path d="M150 ${leafY} C124 ${leafY - 14} 110 ${leafY - 30} 104 ${leafY - 44} C128 ${leafY - 38} 144 ${leafY - 22} 150 ${leafY - 2} Z" fill="#34d399"/>
            <path d="M150 ${leafY - 4} C176 ${leafY - 18} 190 ${leafY - 34} 196 ${leafY - 48} C172 ${leafY - 42} 156 ${leafY - 26} 150 ${leafY - 6} Z" fill="#10b981"/>
        </g>
        <g class="fb-grow">
            <path d="M150 226 C146 244 152 262 148 272" stroke="#fde68a" stroke-width="3.5" fill="none" stroke-linecap="round"/>
            <path d="M149 240 C136 250 130 260 126 268" stroke="#fde68a" stroke-width="2.5" fill="none" stroke-linecap="round"/>
            <path d="M151 242 C164 252 170 262 174 270" stroke="#fde68a" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        </g>
        <ellipse cx="150" cy="218" rx="28" ry="17" fill="url(#sSeed)" stroke="#fbbf24" stroke-width="2"/>
        <text x="150" y="290" text-anchor="middle" fill="#64748b" font-family="JetBrains Mono" font-size="10">Simulación 2D · modelo .glb no disponible</text>
    </svg>`;
}

function cellSVG() {
    return `
    <svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
        <g class="fb-float">
            <rect x="55" y="40" width="190" height="220" rx="34" fill="none" stroke="#4ade80" stroke-width="6"/>
            <rect x="66" y="52" width="168" height="196" rx="26" fill="#ecfdf5" stroke="#86efac" stroke-width="2.5"/>
            <rect x="98" y="96" width="104" height="108" rx="20" fill="#7dd3fc" opacity="0.55" stroke="#0ea5e9" stroke-width="2.5"/>
            <text x="150" y="156" text-anchor="middle" fill="#0369a1" font-family="JetBrains Mono" font-size="11" font-weight="bold">VACUOLA</text>
            <circle cx="178" cy="200" r="26" fill="#fde68a" stroke="#d97706" stroke-width="2.5"/>
            <circle cx="178" cy="200" r="10" fill="#b45309" opacity="0.7"/>
            <text x="178" y="240" text-anchor="middle" fill="#92400e" font-family="JetBrains Mono" font-size="9">Núcleo</text>
            <ellipse cx="96" cy="204" rx="14" ry="9" fill="#34d399" stroke="#059669" stroke-width="1.5"/>
            <ellipse cx="200" cy="80" rx="14" ry="9" fill="#34d399" stroke="#059669" stroke-width="1.5"/>
            <ellipse cx="92" cy="78" rx="12" ry="8" fill="#4ade80" stroke="#059669" stroke-width="1.5"/>
            <text x="150" y="286" text-anchor="middle" fill="#64748b" font-family="JetBrains Mono" font-size="10">Célula vegetal · Simulación 2D</text>
        </g>
    </svg>`;
}

function buildFallbackSVG(type) {
    if (type === 'cell') return cellSVG();
    const heights = { 'sprout-5': 40, 'sprout-10': 92, 'sprout-15': 148 };
    return sproutSVG(heights[type] || 100);
}

/* ---------------------------------------------------------------------------
   12. FONDO AMBIENTAL DE PARTÍCULAS (agua y naturaleza)
--------------------------------------------------------------------------- */
const canvas = document.getElementById('bgCanvas');
const ctx = canvas.getContext('2d');
let particles = [];

function initParticles() {
    const count = Math.min(40, Math.floor((canvas.width * canvas.height) / 32000));
    particles = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 2.6 + 1.2,
        vx: (Math.random() - 0.5) * 0.35,
        vy: -Math.random() * 0.4 - 0.12,
        type: Math.random() > 0.45 ? 'sprout' : 'water',
        alpha: Math.random() * 0.45 + 0.15
    }));
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    initParticles();
}

function animateBackground() {
    requestAnimationFrame(animateBackground);
    if (documentHidden) return; // pausar con la pestaña oculta
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const dark = document.documentElement.classList.contains('dark');
    for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -10) { p.y = canvas.height + 10; p.x = Math.random() * canvas.width; }
        if (p.x < -10) p.x = canvas.width + 10;
        if (p.x > canvas.width + 10) p.x = -10;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        if (p.type === 'sprout') {
            ctx.fillStyle = dark ? `rgba(52, 211, 153, ${p.alpha})` : `rgba(46, 125, 50, ${p.alpha * 0.7})`;
        } else {
            ctx.fillStyle = dark ? `rgba(56, 189, 248, ${p.alpha})` : `rgba(2, 136, 209, ${p.alpha * 0.7})`;
        }
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
            const p2 = particles[j];
            const dist = Math.hypot(p.x - p2.x, p.y - p2.y);
            if (dist < 115) {
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.strokeStyle = dark
                    ? `rgba(52, 211, 153, ${(1 - dist / 115) * 0.09})`
                    : `rgba(46, 125, 50, ${(1 - dist / 115) * 0.10})`;
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }
    }
}

/* ---------------------------------------------------------------------------
   12.5 VISTA GENERAL DE DIAPOSITIVAS (salto directo a cualquier hoja)
--------------------------------------------------------------------------- */
function buildOverview() {
    const grid = document.getElementById('overviewGrid');
    grid.innerHTML = '';
    slides.forEach((slide, idx) => {
        const card = document.createElement('button');
        card.className = 'overview-card' + (idx === currentSlide ? ' current' : '');
        card.innerHTML = `
            <span class="ov-num">Hoja ${String(idx + 1).padStart(2, '0')}</span>
            <span class="ov-title">${slide.dataset.title || 'Diapositiva ' + (idx + 1)}</span>
        `;
        card.addEventListener('click', () => {
            goToSlide(idx);
            closeOverview();
        });
        grid.appendChild(card);
    });
}

function openOverview() {
    buildOverview();
    document.getElementById('overviewModal').classList.add('open');
}

function closeOverview() {
    document.getElementById('overviewModal').classList.remove('open');
}

document.getElementById('overviewBtn').addEventListener('click', openOverview);
document.getElementById('closeOverviewBtn').addEventListener('click', closeOverview);
document.getElementById('overviewModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeOverview();
});

/* ---------------------------------------------------------------------------
   13. INICIALIZACIÓN
--------------------------------------------------------------------------- */
document.addEventListener('visibilitychange', () => {
    documentHidden = document.visibilityState === 'hidden';
});

buildDots();
assignStagger(slides[0]);
updateHUD();

window.addEventListener('resize', () => {
    resizeCanvas();
    resizeViewers();
    if (typeof resizeCharts === 'function') resizeCharts();
});

window.addEventListener('load', () => {
    resizeCanvas();
    animateBackground();
    syncViewers(); // crea solo el visor de la portada (diapositiva 0)
    resizeViewers();
});
