import * as THREE from 'three';
import { ARButton } from 'three/addons/webxr/ARButton.js';

let camera, scene, renderer;
let controller, reticle;
let hitTestSource = null;
let hitTestSourceRequested = false;

let measurements = []; // Збережені точки
let lineSegments = []; // Суцільні лінії між точками
let pointsMeshes = []; // Білі кульки
let dynamicLine = null; // Пунктирна лінія, що тягнеться
let areaMesh = null; // Заливка площі

const distanceValue = document.getElementById('distance-value');
const areaContainer = document.getElementById('area-container');
const areaValue = document.getElementById('area-value');
const btnCloseShape = document.getElementById('btn-close-shape');
const btnClear = document.getElementById('btn-clear');
const instructionText = document.getElementById('instruction-text');

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

    // ВАЖЛИВО: dom-overlay дозволяє кнопкам працювати в AR-режимі
    document.body.appendChild(ARButton.createButton(renderer, { 
        requiredFeatures: ['hit-test'],
        optionalFeatures: ['dom-overlay'],
        domOverlay: { root: document.getElementById('ar-ui') }
    }));

    // Зелений приціл
    const ringGeometry = new THREE.RingGeometry(0.04, 0.05, 32).rotateX(-Math.PI / 2);
    const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x27ae60 });
    reticle = new THREE.Mesh(ringGeometry, ringMaterial);
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);

    controller = renderer.xr.getController(0);
    controller.addEventListener('select', onSelect);
    scene.add(controller);

    window.addEventListener('resize', onWindowResize);

    btnCloseShape.addEventListener('click', closeShape);
    btnClear.addEventListener('click', clearAll);
}

function onSelect() {
    if (reticle.visible) {
        const position = new THREE.Vector3().setFromMatrixPosition(reticle.matrix);
        measurements.push(position);

        // Ставимо білу кульку
        const geometry = new THREE.SphereGeometry(0.015, 16, 16);
        const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const sphere = new THREE.Mesh(geometry, material);
        sphere.position.copy(position);
        scene.add(sphere);
        pointsMeshes.push(sphere);

        // Малюємо суцільну лінію, якщо є попередні точки
        if (measurements.length >= 2) {
            const lastPoint = measurements[measurements.length - 2];
            const currentPoint = measurements[measurements.length - 1];
            
            const lineGeom = new THREE.BufferGeometry().setFromPoints([lastPoint, currentPoint]);
            const lineMat = new THREE.LineBasicMaterial({ color: 0x27ae60, linewidth: 5 });
            const solidLine = new THREE.Line(lineGeom, lineMat);
            scene.add(solidLine);
            lineSegments.push(solidLine);
        }

        btnClear.style.display = 'block';
        if (measurements.length >= 3) {
            btnCloseShape.style.display = 'block';
        }

        instructionText.innerText = `Точок: ${measurements.length}. Тягніть далі.`;
    }
}

// Замикає фігуру, рахує площу і заливає кольором
function closeShape() {
    if (measurements.length < 3) return;

    // Малюємо лінію від останньої точки до першої
    const firstPoint = measurements[0];
    const lastPoint = measurements[measurements.length - 1];
    
    const lineGeom = new THREE.BufferGeometry().setFromPoints([lastPoint, firstPoint]);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x27ae60, linewidth: 5 });
    const closingLine = new THREE.Line(lineGeom, lineMat);
    scene.add(closingLine);
    lineSegments.push(closingLine);

    // Математика площі багатокутника (Shoelace formula)
    let area = 0;
    for (let i = 0; i < measurements.length; i++) {
        let j = (i + 1) % measurements.length;
        area += measurements[i].x * measurements[j].z;
        area -= measurements[j].x * measurements[i].z;
    }
    area = Math.abs(area) / 2;

    areaContainer.style.display = 'block';
    areaValue.innerText = area.toFixed(2);

    // Заливка площі напівпрозорим кольором
    const shape = new THREE.Shape();
    shape.moveTo(measurements[0].x, -measurements[0].z); // Переводимо 3D в 2D площину
    for (let i = 1; i < measurements.length; i++) {
        shape.lineTo(measurements[i].x, -measurements[i].z);
    }

    const shapeGeom = new THREE.ShapeGeometry(shape);
    const shapeMat = new THREE.MeshBasicMaterial({ color: 0x3498db, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
    areaMesh = new THREE.Mesh(shapeGeom, shapeMat);
    areaMesh.rotation.x = Math.PI / 2; // Кладемо на підлогу
    areaMesh.position.y = measurements[0].y + 0.002; // Трохи вище підлоги, щоб не блимало
    scene.add(areaMesh);

    if(dynamicLine) scene.remove(dynamicLine);
    btnCloseShape.style.display = 'none';
    instructionText.innerText = "Площу обчислено!";
}

function clearAll() {
    measurements = [];
    lineSegments.forEach(line => scene.remove(line));
    pointsMeshes.forEach(point => scene.remove(point));
    if (areaMesh) scene.remove(areaMesh);
    if (dynamicLine) scene.remove(dynamicLine);
    
    lineSegments = [];
    pointsMeshes = [];
    areaMesh = null;
    
    distanceValue.innerText = "0.00";
    areaContainer.style.display = 'none';
    btnCloseShape.style.display = 'none';
    btnClear.style.display = 'none';
    instructionText.innerText = "Шукаю площину...";
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
                const reticlePos = new THREE.Vector3().setFromMatrixPosition(reticle.matrix);
                reticle.matrix.fromArray(hit.getPose(referenceSpace).transform.matrix);
                
                if(measurements.length === 0) instructionText.innerText = "Тапніть для старту";

                // ДИНАМІЧНА ЛІНІЯ І ВІДСТАНЬ
                if (measurements.length > 0 && !areaMesh) {
                    const lastPoint = measurements[measurements.length - 1];
                    const currentPos = new THREE.Vector3().setFromMatrixPosition(reticle.matrix);
                    
                    // Відстань у реальному часі
                    const dist = lastPoint.distanceTo(currentPos);
                    distanceValue.innerText = dist.toFixed(2);

                    // Малюємо пунктирну лінію, що тягнеться
                    if (dynamicLine) scene.remove(dynamicLine);
                    const dynamicGeom = new THREE.BufferGeometry().setFromPoints([lastPoint, currentPos]);
                    const dynamicMat = new THREE.LineDashedMaterial({ color: 0xf39c12, dashSize: 0.05, gapSize: 0.02 });
                    dynamicLine = new THREE.Line(dynamicGeom, dynamicMat);
                    dynamicLine.computeLineDistances();
                    scene.add(dynamicLine);
                }

            } else {
                reticle.visible = false;
            }
        }
    }
    renderer.render(scene, camera);
}
