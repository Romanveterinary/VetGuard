const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const btnCapture = document.getElementById('btn-capture');
const statusText = document.getElementById('status-text');
const resultPanel = document.getElementById('result-panel');
const objectCountSpan = document.getElementById('object-count');

let isVideoPlaying = false;

// 1. Увімкнення камери
async function setupCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        video.srcObject = stream;
        return new Promise((resolve) => { video.onloadedmetadata = () => resolve(video); });
    } catch (error) {
        statusText.innerText = "Помилка доступу до камери!";
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

// 2. Відправка кадру до Gemini 2.5
async function countWithGemini() {
    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
        alert("Увага! Спочатку введіть свій Gemini API ключ у налаштуваннях (Головне меню ⚙️).");
        return;
    }

    if (isVideoPlaying) {
        // --- ЗАМОРОЖУЄМО КАДР ---
        video.pause();
        isVideoPlaying = false;
        
        btnCapture.innerText = "🔄 Очистити і продовжити";
        statusText.innerText = "Аналізую ціль у центрі...";
        statusText.style.color = "#f1c40f";
        
        canvas.width = video.clientWidth;
        canvas.height = video.clientHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Конвертація кадру у Base64
        const captureCanvas = document.createElement('canvas');
        captureCanvas.width = video.videoWidth;
        captureCanvas.height = video.videoHeight;
        const captureCtx = captureCanvas.getContext('2d');
        captureCtx.drawImage(video, 0, 0);
        
        const base64Image = captureCanvas.toDataURL('image/jpeg', 0.8).split(',')[1];

        // --- НОВИЙ МАГІЧНИЙ ПРОМПТ ДЛЯ РОЗПІЗНАВАННЯ ПО ЦЕНТРУ ---
        const promptText = `Analyze this image carefully. 
        Step 1: Look EXACTLY at the center point of this image and identify the main object located there. 
        Step 2: Find ALL instances of this exact same type of object across the entire image (including the one in the center). 
        Step 3: Return ONLY a JSON array. Each element in the array must be an object with a single property 'box' which contains an array of 4 numbers [ymin, xmin, ymax, xmax] representing the bounding box of the object. The numbers must be scaled from 0 to 1000. 
        Example: [{"box": [100, 200, 300, 400]}]. 
        Do not return markdown, text, or anything else, ONLY the raw JSON array. If no objects are found, return [].`;

        const requestBody = {
            contents: [{
                parts: [
                    { text: promptText },
                    { inline_data: { mime_type: "image/jpeg", data: base64Image } }
                ]
            }],
            generationConfig: { 
                responseMimeType: "application/json",
                temperature: 0.1 
            }
        };

        try {
            statusText.innerText = "Gemini шукає збіги...";
            
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) throw new Error(`Помилка API Gemini: ${response.status}`);

            const data = await response.json();
            const resultText = data.candidates[0].content.parts[0].text;
            
            let boxes = [];
            try {
                boxes = JSON.parse(resultText.trim());
            } catch (e) {
                console.error("Gemini повернув не JSON:", resultText);
                throw new Error("Збій розпізнавання формату");
            }

            // --- МАЛЮЄМО МАРКЕРИ ---
            let count = 0;
            boxes.forEach(item => {
                if (item.box && item.box.length === 4) {
                    count++;
                    const [ymin, xmin, ymax, xmax] = item.box;
                    
                    const centerX = ((xmin + xmax) / 2 / 1000) * canvas.width;
                    const centerY = ((ymin + ymax) / 2 / 1000) * canvas.height;

                    // Малюємо яскраву зелену крапку на знайдених об'єктах
                    ctx.beginPath();
                    ctx.arc(centerX, centerY, 10, 0, 2 * Math.PI);
                    ctx.fillStyle = '#2ecc71'; 
                    ctx.fill();
                    ctx.lineWidth = 3;
                    ctx.strokeStyle = '#ffffff'; 
                    ctx.stroke();
                }
            });

            statusText.innerText = "Готово!";
            statusText.style.color = "#2ecc71";
            objectCountSpan.innerText = count;
            resultPanel.style.display = 'block';

        } catch (error) {
            console.error(error);
            statusText.innerText = "Помилка розпізнавання!";
            statusText.style.color = "#e74c3c";
            alert("Сталася помилка при зверненні до ШІ. Спробуйте навести чіткіше на об'єкт.");
        }

    } else {
        // --- ПОВЕРНЕННЯ В РЕЖИМ КАМЕРИ ---
        video.play();
        isVideoPlaying = true;
        btnCapture.innerText = "🎯 Фіксація та Підрахунок";
        statusText.innerText = "Наведіть приціл";
        statusText.style.color = "#f39c12";
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        resultPanel.style.display = 'none';
    }
}

btnCapture.addEventListener('click', countWithGemini);
init();
