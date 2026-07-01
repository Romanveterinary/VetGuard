const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const btnCapture = document.getElementById('btn-capture');
const btnGallery = document.getElementById('btn-gallery');
const galleryInput = document.getElementById('gallery-input');
const actionButtonsGroup = document.getElementById('action-buttons-group');

const btnRetry = document.getElementById('btn-retry');
const btnSave = document.getElementById('btn-save');
const btnGroup = document.getElementById('btn-group');
const statusText = document.getElementById('status-text');
const resultPanel = document.getElementById('result-panel');
const verdictBox = document.getElementById('verdict-box');
const sanitaryText = document.getElementById('sanitary-text');
const marketingText = document.getElementById('marketing-text');

let isVideoPlaying = false;

async function setupCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment', advanced: [{ focusMode: "continuous" }] }, 
            audio: false 
        });
        video.srcObject = stream;
        return new Promise((resolve) => { video.onloadedmetadata = () => resolve(video); });
    } catch (error) {
        statusText.innerText = "Камера вимкнена (Режим галереї)";
        statusText.style.color = "#3498db";
    }
}

async function init() {
    await setupCamera();
    if (video.srcObject) {
        video.play();
        isVideoPlaying = true;
    }
}

async function sendImageToGemini(base64Image) {
    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
        alert("Введіть ваш Gemini API ключ у налаштуваннях.");
        resetScanner();
        return;
    }

    statusText.innerText = "Аналізую вітрину...";
    statusText.style.color = "#f1c40f";

    const promptText = `Проаналізуй цю вітрину.
    РОЛЬ 1: САНІТАРНИЙ ІНСПЕКТОР (Україна)
    Шукай фактичні порушення: Наказ №185 п.16 (Товарне сусідство сирого і готового), Закон №771 ст.49 (Гігієна: бруд, відсутність екранів). 
    Якщо є бруд або пошкодження - вимагай генеральне прибирання або ремонт.
    
    РОЛЬ 2: МЕРЧАНДАЙЗЕР
    Дай 2-3 поради, як переставити товари для збільшення продажів (колір, правило золотої полиці).

    ВАЖЛИВО: Поверни ТІЛЬКИ чистий JSON. Жодних вступних слів.
    {
      "sanitary": {
         "status": "VIOLATION" (або "OK"),
         "verdict_title": "Короткий вердикт",
         "details": "Опис порушень."
      },
      "marketing": {
         "advice": "Поради з викладки."
      }
    }`;

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
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) throw new Error("Помилка API");

        const data = await response.json();
        let rawText = data.candidates[0].content.parts[0].text;
        
        // БРОНЕБІЙНИЙ ФІЛЬТР JSON: шукаємо від першої { до останньої }
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        
        if (!jsonMatch) {
            throw new Error("ШІ не повернув JSON формат.");
        }

        const parsedData = JSON.parse(jsonMatch[0]);

        statusText.innerText = "Аудит завершено";
        statusText.style.color = "#2ecc71";

        if (parsedData.sanitary.status === "VIOLATION") {
            verdictBox.className = "verdict warn";
            verdictBox.innerHTML = `❌ ${parsedData.sanitary.verdict_title}`;
        } else {
            verdictBox.className = "verdict ok";
            verdictBox.innerHTML = `✅ ${parsedData.sanitary.verdict_title}`;
        }
        
        sanitaryText.innerHTML = parsedData.sanitary.details.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
        marketingText.innerHTML = parsedData.marketing.advice.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');

        resultPanel.style.display = 'block';
        btnGroup.style.display = 'flex';

    } catch (error) {
        console.error("Деталі помилки:", error);
        statusText.innerText = "Помилка аналізу!";
        statusText.style.color = "#e74c3c";
        alert("ШІ повернув некоректну відповідь. Спробуйте ще раз.");
        resetScanner();
    }
}

// Клік по кнопці Фото
btnCapture.addEventListener('click', () => {
    if (isVideoPlaying) {
        video.pause();
        isVideoPlaying = false;
        actionButtonsGroup.style.display = 'none';
        
        canvas.width = video.clientWidth;
        canvas.height = video.clientHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
        
        sendImageToGemini(base64Image);
    }
});

// Клік по кнопці Галерея
btnGallery.addEventListener('click', () => {
    galleryInput.click();
});

// Обробка обраного файлу
galleryInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    actionButtonsGroup.style.display = 'none';
    if (isVideoPlaying) {
        video.pause();
        isVideoPlaying = false;
    }

    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            canvas.width = video.clientWidth || window.innerWidth;
            canvas.height = video.clientHeight || window.innerHeight;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            video.style.display = 'none';
            
            const base64Image = event.target.result.split(',')[1];
            sendImageToGemini(base64Image);
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

function resetScanner() {
    video.style.display = 'block';
    if (video.srcObject) {
        video.play();
        isVideoPlaying = true;
    }
    
    actionButtonsGroup.style.display = 'flex';
    btnGroup.style.display = 'none';
    resultPanel.style.display = 'none';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    galleryInput.value = ""; 
    
    statusText.innerText = "Охопіть вітрину цілком";
    statusText.style.color = "#f39c12";
}

btnRetry.addEventListener('click', resetScanner);
btnSave.addEventListener('click', () => { alert("Аудит успішно збережено!"); resetScanner(); });

init();
