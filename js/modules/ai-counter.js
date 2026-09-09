const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const btnCapture = document.getElementById('btn-capture');
const btnGeminiCount = document.getElementById('btn-gemini-count');
const crosshair = document.getElementById('crosshair');
const statusText = document.getElementById('status-text');
const resultPanel = document.getElementById('result-panel');
const objectCountSpan = document.getElementById('object-count');
const slidersBox = document.getElementById('sliders-box');

const geminiResultPanel = document.getElementById('gemini-result-panel');
const geminiCountSpan = document.getElementById('gemini-count');

// Елементи повзунків
const threshSlider = document.getElementById('thresh-slider');
const threshVal = document.getElementById('thresh-val');
const calibSlider = document.getElementById('calib-slider');
const calibVal = document.getElementById('calib-val');

let model = null;
let isVideoPlaying = false;
let rawPredictions = []; 

// Словник цільових класів (тільки тварини)
const animalClasses = ['bird', 'cat', 'dog', 'horse', 'sheep', 'cow', 'bear', 'zebra', 'giraffe', 'elephant'];

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

function processAndDraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    let count = 0;
    const threshold = parseInt(threshSlider.value, 10) / 100;
    const calibFactor = parseInt(calibSlider.value, 10);

    const scaleX = canvas.width / video.videoWidth;
    const scaleY = canvas.height / video.videoHeight;

    rawPredictions.forEach(pred => {
        // Фільтр: Тільки достатня точність І ТІЛЬКИ ТВАРИНИ
        if (pred.score >= threshold && animalClasses.includes(pred.class)) {
            count++;
            const [x, y, width, height] = pred.bbox;
            
            const sX = x * scaleX;
            const sY = y * scaleY;
            const sW = width * scaleX;
            const sH = height * scaleY;

            const objectSizeOnScreen = Math.max(width, height);
            const estimatedDistance = calibFactor / objectSizeOnScreen;

            ctx.strokeStyle = '#3498db';
            ctx.lineWidth = 2;
            ctx.strokeRect(sX, sY, sW, sH);

            const centerX = sX + sW / 2;
            const centerY = sY + sH / 2;
            ctx.beginPath();
            ctx.arc(centerX, centerY, 6, 0, 2 * Math.PI);
            ctx.fillStyle = '#2ecc71';
            ctx.fill();
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = '#ffffff';
            ctx.stroke();

            ctx.fillStyle = '#3498db';
            ctx.font = 'bold 12px Arial';
            ctx.fillText(`Тварина ~${estimatedDistance.toFixed(1)}м`, sX + 4, sY - 6);
        }
    });

    objectCountSpan.innerText = count;
}

threshSlider.addEventListener('input', (e) => {
    threshVal.innerText = e.target.value;
    processAndDraw();
});

calibSlider.addEventListener('input', (e) => {
    calibVal.innerText = e.target.value;
    processAndDraw();
});

async function toggleCapture() {
    if (!model) return;

    if (isVideoPlaying) {
        video.pause();
        isVideoPlaying = false;
        btnCapture.innerText = "🔄 Очистити кадр";
        statusText.innerText = "Обробка геометрії...";
        crosshair.style.display = 'none';

        canvas.width = video.clientWidth;
        canvas.height = video.clientHeight;

        rawPredictions = await model.detect(video);

        slidersBox.style.display = 'block';
        resultPanel.style.display = 'block';
        btnGeminiCount.style.display = 'block'; // Показуємо кнопку ШІ
        
        statusText.innerText = "Кадр зафіксовано";
        processAndDraw(); 
    } else {
        video.play();
        isVideoPlaying = true;
        btnCapture.innerText = "📸 Зафіксувати кадр";
        statusText.innerText = "Аналізатор готовий";
        crosshair.style.display = 'block';
        
        slidersBox.style.display = 'none';
        resultPanel.style.display = 'none';
        btnGeminiCount.style.display = 'none';
        geminiResultPanel.style.display = 'none';
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        rawPredictions = [];
    }
}

// Функція підрахунку щільного натовпу через Gemini API
btnGeminiCount.addEventListener('click', async () => {
    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
        alert("Введіть ваш Gemini API ключ у налаштуваннях.");
        return;
    }

    geminiResultPanel.style.display = 'block';
    geminiCountSpan.innerText = "рахую...";
    statusText.innerText = "Відправка до ШІ...";

    try {
        // Створюємо чисте зображення відео без синіх квадратів
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = video.videoWidth;
        tempCanvas.height = video.videoHeight;
        const tCtx = tempCanvas.getContext('2d');
        tCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
        const base64Image = tempCanvas.toDataURL('image/jpeg', 0.8).split(',')[1];

        const promptText = "Ти експерт-ветеринар. Уважно порахуй ВСІХ тварин (свиней, корів, овець, птицю тощо) на цьому фото. Тварини можуть стояти дуже щільно. Поверни ТІЛЬКИ одне число (наприклад: 12). Нічого більше не пиши.";

        const requestBody = {
            contents: [{
                parts: [
                    { text: promptText },
                    { inline_data: { mime_type: "image/jpeg", data: base64Image } }
                ]
            }],
            generationConfig: { temperature: 0.1 }
        };

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) throw new Error("Помилка API");

        const data = await response.json();
        const resultText = data.candidates[0].content.parts[0].text.trim();
        
        // Витягуємо тільки числа з відповіді
        const numbersOnly = resultText.replace(/\D/g, '');
        geminiCountSpan.innerText = numbersOnly || "0";
        statusText.innerText = "ШІ завершив підрахунок";

    } catch (error) {
        console.error(error);
        geminiCountSpan.innerText = "Помилка";
        statusText.innerText = "Збій з'єднання";
    }
});

btnCapture.addEventListener('click', toggleCapture);
init();
