const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const btnCapture = document.getElementById('btn-capture');
const btnGeminiCount = document.getElementById('btn-gemini-count');
const btnSettings = document.getElementById('btn-settings');
const targetSelect = document.getElementById('target-select');
const crosshair = document.getElementById('crosshair');
const statusText = document.getElementById('status-text');
const resultPanel = document.getElementById('result-panel');
const objectCountSpan = document.getElementById('object-count');
const slidersBox = document.getElementById('sliders-box');

const geminiResultPanel = document.getElementById('gemini-result-panel');
const geminiCountSpan = document.getElementById('gemini-count');

const threshSlider = document.getElementById('thresh-slider');
const threshVal = document.getElementById('thresh-val');
const calibSlider = document.getElementById('calib-slider');
const calibVal = document.getElementById('calib-val');

let model = null;
let isVideoPlaying = false;
let rawPredictions = []; 
let settingsTimeout; 

const animalClasses = ['bird', 'cat', 'dog', 'horse', 'sheep', 'cow', 'bear', 'zebra', 'giraffe', 'elephant'];

async function setupCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        video.srcObject = stream;
        return new Promise((resolve) => { video.onloadedmetadata = () => resolve(video); });
    } catch (error) {
        statusText.innerText = "Помилка камери";
    }
}

async function loadModel() {
    try {
        model = await cocoSsd.load();
        statusText.innerText = "Аналізатор готовий";
        btnCapture.style.display = "block";
    } catch (error) {
        statusText.innerText = "Помилка завантаження";
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

function calculateIoU(box1, box2) {
    const [x1, y1, w1, h1] = box1;
    const [x2, y2, w2, h2] = box2;

    const xA = Math.max(x1, x2);
    const yA = Math.max(y1, y2);
    const xB = Math.min(x1 + w1, x2 + w2);
    const yB = Math.min(y1 + h1, y2 + h2);

    const interArea = Math.max(0, xB - xA) * Math.max(0, yB - yA);
    const box1Area = w1 * h1;
    const box2Area = w2 * h2;
    const unionArea = box1Area + box2Area - interArea;

    return interArea / unionArea;
}

function processAndDraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const threshold = parseInt(threshSlider.value, 10) / 100;

    const scaleX = canvas.width / video.videoWidth;
    const scaleY = canvas.height / video.videoHeight;

    let filtered = rawPredictions.filter(pred => pred.score >= threshold && animalClasses.includes(pred.class));
    filtered.sort((a, b) => b.score - a.score);

    const finalPredictions = [];
    const iouThreshold = 0.3; 

    for (let i = 0; i < filtered.length; i++) {
        let keep = true;
        for (let j = 0; j < finalPredictions.length; j++) {
            if (calculateIoU(filtered[i].bbox, finalPredictions[j].bbox) > iouThreshold) {
                keep = false;
                break;
            }
        }
        if (keep) finalPredictions.push(filtered[i]);
    }

    // Сортування за площею (від найбільших до найменших) і зріз до 20 об'єктів
    finalPredictions.sort((a, b) => (b.bbox[2] * b.bbox[3]) - (a.bbox[2] * a.bbox[3]));
    const top20Predictions = finalPredictions.slice(0, 20);

    let count = 0;

    top20Predictions.forEach(pred => {
        count++;
        const [x, y, width, height] = pred.bbox;
        
        const sX = x * scaleX;
        const sY = y * scaleY;
        const sW = width * scaleX;
        const sH = height * scaleY;

        ctx.strokeStyle = '#3498db';
        ctx.lineWidth = 2;
        ctx.strokeRect(sX, sY, sW, sH);

        const centerX = sX + sW / 2;
        const centerY = sY + sH / 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 5, 0, 2 * Math.PI);
        ctx.fillStyle = '#2ecc71';
        ctx.fill();
    });

    objectCountSpan.innerText = count;
}

function resetSettingsTimer() {
    clearTimeout(settingsTimeout);
    slidersBox.classList.add('active');
    settingsTimeout = setTimeout(() => {
        slidersBox.classList.remove('active');
    }, 5000);
}

btnSettings.addEventListener('click', () => {
    if (slidersBox.classList.contains('active')) {
        slidersBox.classList.remove('active');
        clearTimeout(settingsTimeout);
    } else {
        resetSettingsTimer();
    }
});

threshSlider.addEventListener('input', (e) => {
    threshVal.innerText = e.target.value;
    resetSettingsTimer();
    if (!isVideoPlaying) processAndDraw();
});

calibSlider.addEventListener('input', (e) => {
    calibVal.innerText = e.target.value;
    resetSettingsTimer();
});

async function toggleCapture() {
    if (!model) return;

    if (isVideoPlaying) {
        video.pause();
        isVideoPlaying = false;
        btnCapture.innerText = "🔄 Очистити кадр";
        statusText.innerText = "Аналіз геометрії";
        crosshair.style.display = 'none';

        canvas.width = video.clientWidth;
        canvas.height = video.clientHeight;

        rawPredictions = await model.detect(video);

        btnSettings.style.display = 'block';
        resultPanel.style.display = 'block';
        targetSelect.style.display = 'block'; // Вивід селектора
        btnGeminiCount.style.display = 'block'; 
        
        statusText.innerText = "Кадр зафіксовано";
        processAndDraw(); 
    } else {
        video.play();
        isVideoPlaying = true;
        btnCapture.innerText = "📸 Зафіксувати кадр";
        statusText.innerText = "Аналізатор готовий";
        crosshair.style.display = 'block';
        
        btnSettings.style.display = 'none';
        slidersBox.classList.remove('active');
        clearTimeout(settingsTimeout);
        resultPanel.style.display = 'none';
        targetSelect.style.display = 'none'; // Сховати селектор
        btnGeminiCount.style.display = 'none';
        geminiResultPanel.style.display = 'none';
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        rawPredictions = [];
    }
}

btnGeminiCount.addEventListener('click', async () => {
    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
        alert("API ключ відсутній.");
        return;
    }

    geminiResultPanel.style.display = 'block';
    geminiCountSpan.innerText = "рахую...";
    statusText.innerText = "Відправка до ШІ...";

    // Ініціалізація таймауту на 15 секунд
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
        // Жорстке пропорційне стиснення зображення (макс. сторона 800px)
        const MAX_SIZE = 800;
        let width = video.videoWidth;
        let height = video.videoHeight;

        if (width > height) {
            if (width > MAX_SIZE) {
                height = Math.round(height *= MAX_SIZE / width);
                width = MAX_SIZE;
            }
        } else {
            if (height > MAX_SIZE) {
                width = Math.round(width *= MAX_SIZE / height);
                height = MAX_SIZE;
            }
        }

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tCtx = tempCanvas.getContext('2d');
        tCtx.drawImage(video, 0, 0, width, height);
        
        // Зниження якості JPEG до 70% для зменшення ваги
        const base64Image = tempCanvas.toDataURL('image/jpeg', 0.7).split(',')[1];

        const target = targetSelect.value;
        const promptText = `Контекст: Ветеринарний/фермерський огляд. Завдання: максимально точно порахуй цільові об'єкти на фотографії. Цільові об'єкти: ${target}. Поверни ТІЛЬКИ одне число. Жодних інших слів.`;

        const requestBody = {
            contents: [{
                parts: [
                    { text: promptText },
                    { inline_data: { mime_type: "image/jpeg", data: base64Image } }
                ]
            }],
            generationConfig: { temperature: 0.1 },
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
            ]
        };

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal: controller.signal // Прив'язка запиту до таймауту
        });

        clearTimeout(timeoutId);

        if (!response.ok) throw new Error("API fail");

        const data = await response.json();
        
        if (!data.candidates || data.candidates.length === 0) {
            throw new Error("Блокування ШІ");
        }

        const resultText = data.candidates[0].content.parts[0].text.trim();
        const numbersOnly = resultText.replace(/\D/g, '');
        geminiCountSpan.innerText = numbersOnly || "0";
        statusText.innerText = "ШІ завершив";

    } catch (error) {
        clearTimeout(timeoutId);
        console.error("Помилка підрахунку:", error);
        
        // Розпізнавання типу помилки
        if (error.name === 'AbortError') {
            geminiCountSpan.innerText = "Таймаут";
            statusText.innerText = "Мережа недоступна";
        } else {
            geminiCountSpan.innerText = "Помилка";
            statusText.innerText = "Збій підрахунку";
        }
    }
});
btnCapture.addEventListener('click', toggleCapture);
init();
