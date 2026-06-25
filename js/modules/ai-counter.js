const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const btnCapture = document.getElementById('btn-capture');
const crosshair = document.getElementById('crosshair');
const statusText = document.getElementById('status-text');
const resultPanel = document.getElementById('result-panel');
const objectCountSpan = document.getElementById('object-count');
const slidersBox = document.getElementById('sliders-box');

// Елементи повзунків
const threshSlider = document.getElementById('thresh-slider');
const threshVal = document.getElementById('thresh-val');
const calibSlider = document.getElementById('calib-slider');
const calibVal = document.getElementById('calib-val');

let model = null;
let isVideoPlaying = false;
let rawPredictions = []; // Пам'ять для знайдених прямокутників

// 1. Старт камери
async function setupCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        video.srcObject = stream;
        return new Promise((resolve) => { video.onloadedmetadata = () => resolve(video); });
    } catch (error) {
        statusText.innerText = "Помилка камери!";
    }
}

async function loadModel() {
    try {
        model = await cocoSsd.load();
        statusText.innerText = "Аналізатор готовий";
        btnCapture.style.display = "block";
    } catch (error) {
        statusText.innerText = "Помилка завантаження!";
    }
}

async function init() {
    await setupCamera();
    video.play();
    isVideoPlaying = true;
    canvas.width = video.clientWidth;
    canvas.height = video.clientHeight;
    await loadModel();
}

// 2. Математична обробка та фільтрація прямокутників
function processAndDraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    let count = 0;
    const threshold = parseInt(threshSlider.value, 10) / 100;
    const calibFactor = parseInt(calibSlider.value, 10);

    // Коефіцієнти масштабу камери під екран
    const scaleX = canvas.width / video.videoWidth;
    const scaleY = canvas.height / video.videoHeight;

    rawPredictions.forEach(pred => {
        // Фільтр 1: Перевірка точності
        if (pred.score >= threshold) {
            count++;
            const [x, y, width, height] = pred.bbox;
            
            const sX = x * scaleX;
            const sY = y * scaleY;
            const sW = width * scaleX;
            const sH = height * scaleY;

            // --- ОБЧИСЛЕННЯ ВІДСТАНІ ---
            // Математика: чим більший розмір фігури на екрані (берём максимум ширины/высоты), тим вона ближче.
            const objectSizeOnScreen = Math.max(width, height);
            const estimatedDistance = calibFactor / objectSizeOnScreen;

            // Малюємо тонкий акуратний прямокутник фігури
            ctx.strokeStyle = '#3498db';
            ctx.lineWidth = 2;
            ctx.strokeRect(sX, sY, sW, sH);

            // Малюємо маленьку яскраву крапку точно по центру фігури
            const centerX = sX + sW / 2;
            const centerY = sY + sH / 2;
            ctx.beginPath();
            ctx.arc(centerX, centerY, 6, 0, 2 * Math.PI);
            ctx.fillStyle = '#2ecc71';
            ctx.fill();
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = '#ffffff';
            ctx.stroke();

            // Текст з назвою та обчисленою відстанню над прямокутником
            ctx.fillStyle = '#3498db';
            ctx.font = 'bold 12px Arial';
            ctx.fillText(`${pred.class} ~${estimatedDistance.toFixed(1)}м`, sX + 4, sY - 6);
        }
    });

    objectCountSpan.innerText = count;
}

// Слухачі повзунків (миттєве перемальовування без повторного аналізу)
threshSlider.addEventListener('input', (e) => {
    threshVal.innerText = e.target.value;
    processAndDraw();
});

calibSlider.addEventListener('input', (e) => {
    calibVal.innerText = e.target.value;
    processAndDraw();
});


// 3. Логіка фіксації кадру
async function toggleCapture() {
    if (!model) return;

    if (isVideoPlaying) {
        // ЗАМОРОЖУЄМО КАДР ТА АНАЛІЗУЄМО
        video.pause();
        isVideoPlaying = false;
        btnCapture.innerText = "🔄 Очистити кадр";
        statusText.innerText = "Обробка геометрії...";
        crosshair.style.display = 'none';

        canvas.width = video.clientWidth;
        canvas.height = video.clientHeight;

        // Локальний математичний пошук прямокутників
        rawPredictions = await model.detect(video);

        // Показуємо повзунки та плашку результату
        slidersBox.style.display = 'block';
        resultPanel.style.display = 'block';
        
        statusText.innerText = "Кадр зафіксовано";
        processAndDraw(); // Малюємо прямокутники
    } else {
        // ПОВЕРНЕННЯ ДО КАМЕРИ
        video.play();
        isVideoPlaying = true;
        btnCapture.innerText = "📸 Зафіксувати кадр";
        statusText.innerText = "Аналізатор готовий";
        crosshair.style.display = 'block';
        
        // Ховаємо панелі
        slidersBox.style.display = 'none';
        resultPanel.style.display = 'none';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        rawPredictions = [];
    }
}

btnCapture.addEventListener('click', toggleCapture);
init();
