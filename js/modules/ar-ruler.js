import * as THREE from 'three';
import { ARButton } from 'three/addons/webxr/ARButton.js';

let camera, scene, renderer;
let controller, reticle;
let hitTestSource = null;
let hitTestSourceRequested = false;

const measurements = [];
let currentLine = null; // Наша суцільна лінія

init();
animate();

function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    document.body.appendChild(renderer.domElement);

    document.body.appendChild(ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] }));

    // Зелений приціл
    const ringGeometry = new THREE.RingGeometry(0.05, 0.06, 32).rotateX(-Math.PI / 2);
    const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x27ae60 });
    reticle = new THREE.Mesh(ringGeometry, ringMaterial);
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);

    controller = renderer.xr.getController(0);
    controller.addEventListener('select', onSelect);
    scene.add(controller);

    window.addEventListener('resize', onWindowResize);
}

function onSelect() {
    if (reticle.visible) {
        // Ставимо білу кульку
        const geometry = new THREE.SphereGeometry(0.02, 32, 32);
        const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const sphere = new THREE.Mesh(geometry, material);
        sphere.position.setFromMatrixPosition(reticle.matrix);
        scene.add(sphere);
        
        measurements.push(sphere.position);

        // Якщо точок 2 або більше - малюємо лінію і рахуємо відстань
        if (measurements.length >= 2) {
            drawLine();
            calculateDistance();
            document.getElementById('instruction-text').innerText = `Точок: ${measurements.length}. Ставте наступну або тисніть Меню.`;
        } else {
            document.getElementById('instruction-text').innerText = "Поставте другу точку";
        }
    }
}

// Малює лінію через ВСІ поставлені точки
function drawLine() {
    if (currentLine) scene.remove(currentLine); // Видаляємо стару лінію
    const material = new THREE.LineBasicMaterial({ color: 0x27ae60, linewidth: 5 });
    const geometry = new THREE.BufferGeometry().setFromPoints(measurements);
    currentLine = new THREE.Line(geometry, material);
    scene.add(currentLine);
}

// Рахує відстань між двома ОСТАННІМИ точками
function calculateDistance() {
    const lastIdx = measurements.length - 1;
    const point1 = measurements[lastIdx - 1];
    const point2 = measurements[lastIdx];
    
    const distance = point1.distanceTo(point2);
    document.getElementById('distance-value').innerText = distance.toFixed(2);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() { renderer.setAnimationLoop(render); }

function render(timestamp, frame) {
    if (frame) {
        const referenceSpace = renderer.xr.getReferenceSpace();
        const session = renderer.xr.getSession();

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
                reticle.visible = true;
                reticle.matrix.fromArray(hit.getPose(referenceSpace).transform.matrix);
                
                if(measurements.length === 0) {
                    document.getElementById('instruction-text').innerText = "Площину знайдено! Тапніть для 1-ї точки.";
                }
            } else {
                reticle.visible = false;
            }
        }
    }
    renderer.render(scene, camera);
}
