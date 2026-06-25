const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const btnCapture = document.getElementById('btn-capture');
const statusText = document.getElementById('status-text');
const resultPanel = document.getElementById('result-panel');
const objectCountSpan = document.getElementById('object-count');

// Змінні повзунка
const sliderPanel = document.getElementById('slider-panel');
const thresholdSlider = document.getElementById('threshold-slider');
const thresholdValText = document.getElementById('threshold-val');

let model = null;
let isVideoPlaying = false;
let currentThreshold = 0.50; // Базова чутливість 50%
let hideSliderTimeout; // Таймер для зникнення

// --- ЛОГІКА ЗНИКАЮЧОГО ПОВЗУНКА ---
function showSlider() {
    sliderPanel.classList.remove('hidden');
    clearTimeout(hideSliderTimeout);
    // Ховаємо через 3 секунди
    hideSliderTimeout = setTimeout(() => {
        sliderPanel.classList.add('hidden');
    }, 3000);
}

// Оновлюємо цифру при русі повзунка
thresholdSlider.addEventListener('input', (e) => {
    currentThreshold = e.target.value / 100;
    thresholdValText.innerText = e.target.value;
    showSlider(); // Скидаємо таймер, поки крутимо
});

// Тап по екрану (по відео) показує повзунок
video.addEventListener('click', showSlider);


// --- КАМЕРА ТА ШІ ---
async function setupCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        video.srcObject = stream;
        return new Promise((resolve) => { video.onloadedmetadata = () => { resolve(video); }; });
    } catch (error) {
        statusText.innerText = "Помилка камери!";
    }
}

async function loadAI() {
    statusText.innerText = "Завантаження ШІ...";
    try {
        model = await cocoSsd.load();
        statusText.innerText = "ШІ готовий! Наведіть камеру.";
        showSlider(); // Показуємо повзунок на старті
    } catch (error) { statusText.innerText = "Помилка ШІ!"; }
}

async function init() {
    await setupCamera();
    video.play();
    isVideoPlaying = true;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    await loadAI();
}

async function detectAndCount() {
    if (!model) return;

    if (isVideoPlaying) {
        video.pause();
        isVideoPlaying = false;
        btnCapture.innerText = "🔄 Очистити і продовжити";
        statusText.innerText = "Аналіз кадру...";
        sliderPanel.classList.add('hidden'); // Ховаємо повзунок під час аналізу
        
        canvas.width = video.clientWidth;
        canvas.height = video.clientHeight;

        const predictions = await model.detect(video);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let count = 0;

        predictions.forEach(prediction => {
            // ВИКОРИСТОВУЄМО ЗНАЧЕННЯ З ПОВЗУНКА
            if (prediction.score > currentThreshold) {
                count++;
                const [x, y, width, height] = prediction.bbox;
                const scaleX = canvas.width / video.videoWidth;
                const scaleY = canvas.height / video.videoHeight;
                
                const scaledX = x * scaleX;
                const scaledY = y * scaleY;
                const scaledWidth = width * scaleX;
                const scaledHeight = height * scaleY;

                ctx.strokeStyle = '#27ae60';
                ctx.lineWidth = 4;
                ctx.strokeRect(scaledX, scaledY, scaledWidth, scaledHeight);
                ctx.fillStyle = '#27ae60';
                ctx.fillRect(scaledX, scaledY - 25, scaledWidth, 25);
                ctx.fillStyle = '#ffffff';
                ctx.font = '16px Arial';
                ctx.fillText(`${prediction.class} (${Math.round(prediction.score * 100)}%)`, scaledX + 5, scaledY - 7);
            }
        });

        statusText.innerText = "Готово!";
        objectCountSpan.innerText = count;
        resultPanel.style.display = 'block';

    } else {
        video.play();
        isVideoPlaying = true;
        btnCapture.innerText = "📸 Захопити і Рахувати";
        statusText.innerText = "ШІ готовий! Наведіть камеру.";
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        resultPanel.style.display = 'none';
        showSlider(); // Знову показуємо повзунок
    }
}

btnCapture.addEventListener('click', detectAndCount);
init();
