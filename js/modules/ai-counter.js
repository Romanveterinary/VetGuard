const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const btnCapture = document.getElementById('btn-capture');
const btnRetry = document.getElementById('btn-retry');
const btnConfirm = document.getElementById('btn-confirm');
const statusText = document.getElementById('status-text');
const resultPanel = document.getElementById('result-panel');
const objectCountSpan = document.getElementById('object-count');
const detectedNameSpan = document.getElementById('detected-name');
const crosshair = document.getElementById('crosshair');
const instructionHint = document.getElementById('instruction-hint');

let model = null;
let isVideoPlaying = false;
let points = []; // Зберігає масив координат {x, y} для крапок
const POINT_RADIUS = 12; // Розмір крапки на екрані

// 1. Увімкнення камери та моделі
async function setupCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        video.srcObject = stream;
        return new Promise((resolve) => { video.onloadedmetadata = () => resolve(video); });
    } catch (error) {
        statusText.innerText = "Помилка камери!";
    }
}

async function loadAI() {
    try {
        model = await cocoSsd.load();
        statusText.innerText = "Готово! Наведіть приціл.";
        statusText.style.color = "#2ecc71";
        btnCapture.style.display = "block";
    } catch (error) {
        statusText.innerText = "Помилка ШІ!";
    }
}

async function init() {
    await setupCamera();
    video.play();
    isVideoPlaying = true;
    canvas.width = video.clientWidth;
    canvas.height = video.clientHeight;
    await loadAI();
}

// Функція малювання крапок з масиву
function drawPoints() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    points.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, POINT_RADIUS, 0, 2 * Math.PI);
        ctx.fillStyle = '#2ecc71'; 
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#ffffff'; 
        ctx.stroke();
    });
    objectCountSpan.innerText = points.length;
}

// 2. Аналіз кадру і пошук цілі під хрестиком
async function captureAndDetect() {
    if (!model) return;

    video.pause();
    isVideoPlaying = false;
    
    // Перемикаємо інтерфейс
    btnCapture.style.display = 'none';
    crosshair.style.display = 'none';
    btnRetry.style.display = 'block';
    btnConfirm.style.display = 'block';
    instructionHint.style.display = 'block';
    
    statusText.innerText = "Сканування...";
    statusText.style.color = "#f1c40f";

    canvas.width = video.clientWidth;
    canvas.height = video.clientHeight;

    // ШІ знаходить ВСІ об'єкти в кадрі
    const predictions = await model.detect(video);
    
    // Знаходимо центр екрана (наш приціл)
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    let targetClass = null;

    // Перевіряємо, який об'єкт знаходиться під хрестиком
    for (let i = 0; i < predictions.length; i++) {
        const [x, y, width, height] = predictions[i].bbox;
        // Корегуємо координати ШІ під розмір екрана
        const scaleX = canvas.width / video.videoWidth;
        const scaleY = canvas.height / video.videoHeight;
        
        const scaledX = x * scaleX;
        const scaledY = y * scaleY;
        const scaledWidth = width * scaleX;
        const scaledHeight = height * scaleY;

        // Якщо центр екрана потрапляє в рамку об'єкта
        if (centerX >= scaledX && centerX <= scaledX + scaledWidth &&
            centerY >= scaledY && centerY <= scaledY + scaledHeight) {
            targetClass = predictions[i].class;
            break; // Знайшли ціль
        }
    }

    points = []; // Очищаємо старі точки

    if (targetClass) {
        detectedNameSpan.innerText = `Ціль: ${targetClass}`;
        
        // Фільтруємо і ставимо крапки тільки на об'єктах знайденого класу
        predictions.forEach(pred => {
            if (pred.class === targetClass) {
                const [x, y, width, height] = pred.bbox;
                const scaleX = canvas.width / video.videoWidth;
                const scaleY = canvas.height / video.videoHeight;
                
                // Центр знайденого об'єкта
                const pX = (x + width / 2) * scaleX;
                const pY = (y + height / 2) * scaleY;
                
                points.push({ x: pX, y: pY });
            }
        });
        statusText.innerText = "Перевірте крапки";
        statusText.style.color = "#27ae60";
    } else {
        detectedNameSpan.innerText = `Ціль: НЕ ЗНАЙДЕНО`;
        statusText.innerText = "Порожньо. Тапайте для додавання.";
        statusText.style.color = "#e74c3c";
    }

    resultPanel.style.display = 'block';
    drawPoints();
}

// 3. Інтерактивне додавання/видалення крапок (ТАП ПО ЕКРАНУ)
canvas.addEventListener('pointerdown', (e) => {
    if (isVideoPlaying) return; // Працює тільки коли кадр заморожено

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Перевіряємо, чи тапнули ми по існуючій крапці
    let clickedExistingPointIndex = -1;
    for (let i = 0; i < points.length; i++) {
        const dx = points[i].x - clickX;
        const dy = points[i].y - clickY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Якщо тапнули поруч із крапкою (радіус + зона похибки пальця)
        if (distance <= POINT_RADIUS + 15) {
            clickedExistingPointIndex = i;
            break;
        }
    }

    if (clickedExistingPointIndex !== -1) {
        // Видаляємо крапку
        points.splice(clickedExistingPointIndex, 1);
    } else {
        // Додаємо нову крапку там, де тапнули
        points.push({ x: clickX, y: clickY });
    }

    drawPoints(); // Перемальовуємо
});

// 4. Скидання і повернення до камери
function resetScanner() {
    video.play();
    isVideoPlaying = true;
    points = [];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    btnCapture.style.display = 'block';
    crosshair.style.display = 'block';
    btnRetry.style.display = 'none';
    btnConfirm.style.display = 'none';
    instructionHint.style.display = 'none';
    resultPanel.style.display = 'none';
    
    statusText.innerText = "Готово! Наведіть приціл.";
    statusText.style.color = "#2ecc71";
}

// 5. Завершення (Збереження)
function confirmResult() {
    alert(`Збережено у звіт: ${objectCountSpan.innerText} шт.`);
    resetScanner();
}

btnCapture.addEventListener('click', captureAndDetect);
btnRetry.addEventListener('click', resetScanner);
btnConfirm.addEventListener('click', confirmResult);

init();
