const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const btnCapture = document.getElementById('btn-capture');
const statusText = document.getElementById('status-text');
const resultPanel = document.getElementById('result-panel');
const objectCountSpan = document.getElementById('object-count');
const detectedNameSpan = document.getElementById('detected-name');

const sliderPanel = document.getElementById('slider-panel');
const sensitivitySlider = document.getElementById('sensitivity-slider');
const sensitivityVal = document.getElementById('sensitivity-val');

let isVideoPlaying = false;
let currentDetections = []; 

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

// Функція малювання крапок
function drawDetections() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); 
    let count = 0;
    const threshold = parseInt(sensitivitySlider.value, 10);

    currentDetections.forEach(item => {
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

sensitivitySlider.addEventListener('input', (e) => {
    sensitivityVal.innerText = e.target.value;
    drawDetections();
});

// 2. Жорсткий запит до Gemini
async function countWithGemini() {
    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
        alert("Увага! Спочатку введіть свій Gemini API ключ у налаштуваннях.");
        return;
    }

    if (isVideoPlaying) {
        video.pause();
        isVideoPlaying = false;
        
        btnCapture.innerText = "🔄 Очистити і продовжити";
        statusText.innerText = "Ідентифікація цілі...";
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

        // МАКСИМАЛЬНО ЖОРСТКИЙ ПРОМПТ
        const promptText = `Act as a strict, non-creative computer vision scanner.
        Step 1: Look EXACTLY at the center pixel of this image. Identify the primary object located there. Name it in Ukrainian (e.g., 'Свиня', 'Автомобіль', 'Ящик', 'Людина').
        Step 2: Scan the entire image and find ALL instances of this exact same object type. DO NOT count different objects.
        Step 3: Return ONLY a JSON object with this exact structure:
        {
          "objectName": "Назва об'єкта українською",
          "detections": [
             {"box": [ymin, xmin, ymax, xmax], "confidence": integer_from_1_to_100}
          ]
        }
        The 'box' values must be integers scaled from 0 to 1000. Do not write markdown, do not add any extra text. Return ONLY the JSON object.`;

        const requestBody = {
            contents: [{
                parts: [
                    { text: promptText },
                    { inline_data: { mime_type: "image/jpeg", data: base64Image } }
                ]
            }],
            generationConfig: { 
                responseMimeType: "application/json", 
                temperature: 0.0 // НУЛЬ ФАНТАЗІЇ
            }
        };

        try {
            statusText.innerText = "Gemini рахує...";
            
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) throw new Error(`Помилка API Gemini`);

            const data = await response.json();
            const resultText = data.candidates[0].content.parts[0].text;
            
            try {
                // Парсимо новий формат (Словник, а не масив)
                const parsedData = JSON.parse(resultText.trim());
                detectedNameSpan.innerText = `Ціль: ${parsedData.objectName || 'Невідомо'}`;
                currentDetections = parsedData.detections || [];
            } catch (e) { 
                throw new Error("Збій розпізнавання формату"); 
            }

            resultPanel.style.display = 'block';
            sliderPanel.style.display = 'block';
            drawDetections(); 

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
        currentDetections = []; 
        resultPanel.style.display = 'none';
        sliderPanel.style.display = 'none'; 
    }
}

btnCapture.addEventListener('click', countWithGemini);
init();
