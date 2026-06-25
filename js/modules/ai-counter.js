const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const btnCapture = document.getElementById('btn-capture');
const statusText = document.getElementById('status-text');
const resultPanel = document.getElementById('result-panel');
const objectCountSpan = document.getElementById('object-count');

// Змінні повзунка
const sliderPanel = document.getElementById('slider-panel');
const sensitivitySlider = document.getElementById('sensitivity-slider');
const sensitivityVal = document.getElementById('sensitivity-val');

let isVideoPlaying = false;
let currentDetections = []; // Зберігаємо сирі дані від ШІ

// 1. Увімкнення камери
async function setupCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        video.srcObject = stream;
        return new Promise((resolve) => { video.onloadedmetadata = () => resolve(video); });
    } catch (error) {
        statusText.innerText = "Помилка камери!";
        statusText.style.color = "#e74c3c";
    }
}

async function init() {
    await setupCamera();
    video.play();
    isVideoPlaying = true;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
}

// Функція малювання крапок в залежності від повзунка
function drawDetections() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Очищаємо старі крапки
    let count = 0;
    const threshold = parseInt(sensitivitySlider.value, 10);

    currentDetections.forEach(item => {
        // Малюємо тільки ті, в яких ШІ впевнений більше, ніж обрано на повзунку
        if (item.box && item.box.length === 4 && item.confidence >= threshold) {
            count++;
            const [ymin, xmin, ymax, xmax] = item.box;
            const centerX = ((xmin + xmax) / 2 / 1000) * canvas.width;
            const centerY = ((ymin + ymax) / 2 / 1000) * canvas.height;

            ctx.beginPath();
            ctx.arc(centerX, centerY, 10, 0, 2 * Math.PI);
            ctx.fillStyle = '#2ecc71'; 
            ctx.fill();
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#ffffff'; 
            ctx.stroke();
        }
    });
    
    objectCountSpan.innerText = count;
}

// Слухаємо рух повзунка і миттєво перемальовуємо
sensitivitySlider.addEventListener('input', (e) => {
    sensitivityVal.innerText = e.target.value;
    drawDetections();
});


// 2. Відправка кадру до Gemini
async function countWithGemini() {
    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
        alert("Увага! Спочатку введіть свій Gemini API ключ у налаштуваннях (Головне меню ⚙️).");
        return;
    }

    if (isVideoPlaying) {
        // ЗАМОРОЖУЄМО КАДР
        video.pause();
        isVideoPlaying = false;
        
        btnCapture.innerText = "🔄 Очистити і продовжити";
        statusText.innerText = "Аналізую ціль у центрі...";
        statusText.style.color = "#f1c40f";
        
        canvas.width = video.clientWidth;
        canvas.height = video.clientHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const captureCanvas = document.createElement('canvas');
        captureCanvas.width = video.videoWidth;
        captureCanvas.height = video.videoHeight;
        const captureCtx = captureCanvas.getContext('2d');
        captureCtx.drawImage(video, 0, 0);
        
        const base64Image = captureCanvas.toDataURL('image/jpeg', 0.8).split(',')[1];

        // ОНОВЛЕНИЙ ПРОМПТ (тепер просимо ще й confidence)
        const promptText = `Analyze this image carefully. 
        Step 1: Look EXACTLY at the center point and identify the main object there. 
        Step 2: Find ALL instances of this exact same type of object across the image. 
        Step 3: Return ONLY a JSON array. Each object in the array must have TWO properties:
        - 'box': an array of 4 numbers [ymin, xmin, ymax, xmax] scaled from 0 to 1000.
        - 'confidence': an integer from 1 to 100 estimating how confident you are that this is the same type of object.
        Example: [{"box": [100, 200, 300, 400], "confidence": 85}]. 
        Do not return markdown. Return ONLY the raw JSON array. If no objects are found, return [].`;

        const requestBody = {
            contents: [{
                parts: [
                    { text: promptText },
                    { inline_data: { mime_type: "image/jpeg", data: base64Image } }
                ]
            }],
            generationConfig: { responseMimeType: "application/json", temperature: 0.1 }
        };

        try {
            statusText.innerText = "Gemini шукає збіги...";
            
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) throw new Error(`Помилка API Gemini`);

            const data = await response.json();
            const resultText = data.candidates[0].content.parts[0].text;
            
            try {
                currentDetections = JSON.parse(resultText.trim());
            } catch (e) { throw new Error("Збій розпізнавання формату"); }

            // Показуємо панель результатів та повзунок, малюємо первинні крапки
            resultPanel.style.display = 'block';
            sliderPanel.style.display = 'block';
            drawDetections(); // Викликаємо функцію малювання

            statusText.innerText = "Готово!";
            statusText.style.color = "#2ecc71";

        } catch (error) {
            statusText.innerText = "Помилка розпізнавання!";
            statusText.style.color = "#e74c3c";
            alert("Сталася помилка при зверненні до ШІ.");
        }

    } else {
        // ПОВЕРНЕННЯ В РЕЖИМ КАМЕРИ
        video.play();
        isVideoPlaying = true;
        btnCapture.innerText = "🎯 Фіксація та Підрахунок";
        statusText.innerText = "Наведіть приціл";
        statusText.style.color = "#f39c12";
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        currentDetections = []; // Очищаємо пам'ять
        resultPanel.style.display = 'none';
        sliderPanel.style.display = 'none'; // Ховаємо повзунок
    }
}

btnCapture.addEventListener('click', countWithGemini);
init();
