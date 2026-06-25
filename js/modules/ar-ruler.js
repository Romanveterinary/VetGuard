// Підключаємо бібліотеку 3D-графіки та модуль для AR-кнопки
import * as THREE from 'three';
import { ARButton } from 'three/addons/webxr/ARButton.js';

let camera, scene, renderer;
let controller, reticle;

let hitTestSource = null;
let hitTestSourceRequested = false;

// Масив для збереження наших точок (тапів)
const measurements = [];
let currentLine = null;

init();
animate();

function init() {
    // 1. Створюємо сцену (наш віртуальний світ поверх камери)
    scene = new THREE.Scene();

    // 2. Налаштовуємо камеру
    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

    // 3. Налаштовуємо рендерер (малювальник)
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true; // Вмикаємо підтримку віртуальної/доповненої реальності
    document.body.appendChild(renderer.domElement);

    // 4. Додаємо кнопку "Старт AR" (вона з'явиться автоматично знизу екрана)
    document.body.appendChild(ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] }));

    // 5. Створюємо приціл (кільце), який буде бігати по підлозі
    const ringGeometry = new THREE.RingGeometry(0.05, 0.06, 32).rotateX(-Math.PI / 2);
    const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x27ae60 }); // Наш зелений колір
    reticle = new THREE.Mesh(ringGeometry, ringMaterial);
    reticle.matrixAutoUpdate = false;
    reticle.visible = false; // Ховаємо, поки не знайдемо підлогу
    scene.add(reticle);

    // 6. Налаштовуємо контролер (реакція на тап по екрану)
    controller = renderer.xr.getController(0);
    controller.addEventListener('select', onSelect);
    scene.add(controller);

    // Реакція на зміну розміру екрана
    window.addEventListener('resize', onWindowResize);
}

// Функція, яка спрацьовує, коли ти тапаєш по екрану
function onSelect() {
    if (reticle.visible) {
        // Створюємо кульку в місці тапу
        const geometry = new THREE.SphereGeometry(0.02, 32, 32);
        const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const sphere = new THREE.Mesh(geometry, material);
        
        // Ставимо кульку туди, де зараз приціл
        sphere.position.setFromMatrixPosition(reticle.matrix);
        scene.add(sphere);
        measurements.push(sphere.position);

        // Якщо точок дві - малюємо лінію і рахуємо відстань
        if (measurements.length === 2) {
            drawLine();
            calculateDistance();
            
            // Оновлюємо інструкцію на екрані
            document.getElementById('instruction-text').innerText = "Вимірювання завершено. Натисніть 'Меню' для виходу.";
            // Відключаємо можливість ставити третю точку (для базової версії)
            controller.removeEventListener('select', onSelect); 
        } else {
            document.getElementById('instruction-text').innerText = "Поставте другу точку";
        }
    }
}

// Функція малювання лінії між точками
function drawLine() {
    const material = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 5 });
    const geometry = new THREE.BufferGeometry().setFromPoints(measurements);
    currentLine = new THREE.Line(geometry, material);
    scene.add(currentLine);
}

// Функція математичного розрахунку відстані
function calculateDistance() {
    const point1 = measurements[0];
    const point2 = measurements[1];
    
    // Розраховуємо дистанцію в просторі (у метрах)
    const distance = point1.distanceTo(point2);
    
    // Виводимо результат на екран (округлюємо до 2 знаків)
    document.getElementById('distance-value').innerText = distance.toFixed(2);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Головний цикл програми, який малює картинку 60 разів на секунду
function animate() {
    renderer.setAnimationLoop(render);
}

function render(timestamp, frame) {
    if (frame) {
        const referenceSpace = renderer.xr.getReferenceSpace();
        const session = renderer.xr.getSession();

        // Запитуємо систему пошуку площин (hit-test)
        if (hitTestSourceRequested === false) {
            session.requestReferenceSpace('viewer').then(function (referenceSpace) {
                session.requestHitTestSource({ space: referenceSpace }).then(function (source) {
                    hitTestSource = source;
                });
            });
            session.addEventListener('end', function () {
                hitTestSourceRequested = false;
                hitTestSource = null;
            });
            hitTestSourceRequested = true;
        }

        if (hitTestSource) {
            const hitTestResults = frame.getHitTestResults(hitTestSource);
            if (hitTestResults.length > 0) {
                const hit = hitTestResults[0];
                // Якщо знайшли підлогу - показуємо приціл
                reticle.visible = true;
                reticle.matrix.fromArray(hit.getPose(referenceSpace).transform.matrix);
                document.getElementById('instruction-text').innerText = measurements.length === 0 ? "Знайдено поверхню! Тапніть, щоб поставити першу точку." : "Поставте другу точку";
            } else {
                reticle.visible = false;
            }
        }
    }
    renderer.render(scene, camera);
}