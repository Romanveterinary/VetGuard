const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const btnCapture = document.getElementById('btn-capture');
const btnGallery = document.getElementById('btn-gallery');
const galleryInput = document.getElementById('gallery-input');
const actionButtonsGroup = document.getElementById('action-buttons-group');
const scanFrame = document.getElementById('scan-frame');

const btnRetry = document.getElementById('btn-retry');
const btnSave = document.getElementById('btn-save');
const btnGroup = document.getElementById('btn-group');
const statusText = document.getElementById('status-text');
const resultPanel = document.getElementById('result-panel');
const verdictBox = document.getElementById('verdict-box');
const ingredientsText = document.getElementById('ingredients-text');
const markingText = document.getElementById('marking-text');

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

    actionButtonsGroup.style.display = 'none';
    scanFrame.style.display = 'none';
    
    statusText.innerText = "Читаю дрібний шрифт...";
    statusText.style.color = "#f1c40f";

    // ОНОВЛЕНИЙ ПРОМПТ З РОЗУМІННЯМ "ПРИХОВАНОЇ ДАТИ"
    const promptText = `Ти - суворий Експерт з харчової безпеки (Держпродспоживслужба). Проаналізуй цю етикетку.

    РОЛЬ 1: АНАЛІЗ СКЛАДУ (ІНГРЕДІЄНТИ)
    Знайди склад продукту. Шукай небезпечні Е-добавки, приховані цукри, трансжири або алергени, які не виділені шрифтом (порушення Закону №2639-VIII). Якщо склад чистий - так і напиши.

    РОЛЬ 2: МАРКУВАННЯ (ДАТА І ШТРИХКОД)
    ВАЖЛИВЕ ПРАВИЛО: Дуже часто дата виготовлення наноситься струменевим принтером на кришку, дно або горловину окремо від паперової етикетки. ТОМУ: якщо ти НЕ БАЧИШ дати виготовлення або терміну придатності в цьому кадрі, НЕ РОБИ з цього критичне порушення! Просто напиши: "Дата в кадрі відсутня (рекомендовано перевірити на кришці або дні тари)". 
    
    ВИЗНАЧЕННЯ СТАТУСУ (status):
    Став "VIOLATION" ТІЛЬКИ якщо є небезпечні інгредієнти, або якщо склад взагалі неможливо прочитати (стертий).
    Якщо склад нормальний, а дати просто не видно - став "OK".

    Поверни результат ВИКЛЮЧНО у форматі JSON:
    {
      "status": "OK" або "VIOLATION",
      "verdict_title": "Короткий висновок (напр. 'Склад безпечний' або 'Знайдено небезпечні Е-добавки')",
      "ingredients": "Детальний розбір складу. Назви критичні добавки, якщо є.",
      "marking": "Аналіз маркування. Якщо дати немає, напиши толерантно, що її треба шукати в іншому місці."
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
        let resultText = data.candidates[0].content.parts[0].text.trim();
        
        if (resultText.startsWith("```")) {
            resultText = resultText.replace(/^```json/, "").replace(/```$/, "").trim();
        }

        const parsedData = JSON.parse(resultText);

        statusText.innerText = "Сканування завершено";
        statusText.style.color = "#2ecc71";

        if (parsedData.status === "VIOLATION") {
            verdictBox.className = "verdict warn";
            verdictBox.innerHTML = `❌ ${parsedData.verdict_title}`;
        } else {
            verdictBox.className = "verdict ok";
            verdictBox.innerHTML = `✅ ${parsedData.verdict_title}`;
        }
        
        ingredientsText.innerHTML = parsedData.ingredients.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
        markingText.innerHTML = parsedData.marking.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');

        resultPanel.style.display = 'block';
        btnGroup.style.display = 'flex';

    } catch (error) {
        console.error("Помилка:", error);
        statusText.innerText = "Помилка аналізу!";
        statusText.style.color = "#e74c3c";
        alert("Не вдалося розпізнати етикетку. Спробуйте ближче або інше фото.");
        resetScanner();
    }
}

// Клік по кнопці Фото
btnCapture.addEventListener('click', () => {
    if (isVideoPlaying) {
        video.pause();
        isVideoPlaying = false;
        
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

// Обробка файлу з галереї
galleryInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

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
    scanFrame.style.display = 'block';
    btnGroup.style.display = 'none';
    resultPanel.style.display = 'none';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    galleryInput.value = ""; 
    
    statusText.innerText = "Наведіть на склад або штрихкод";
    statusText.style.color = "#9b59b6";
}

btnRetry.addEventListener('click', resetScanner);
btnSave.addEventListener('click', () => { alert("Аудит етикетки збережено!"); resetScanner(); });

init();
