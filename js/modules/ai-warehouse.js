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

// Інтерактивні елементи
const interactiveControls = document.getElementById('interactive-controls');
const warehouseSelect = document.getElementById('warehouse-select');
const tempSlider = document.getElementById('temp-slider');
const tempDisplay = document.getElementById('temp-display');

// Поля результатів
const resObjective = document.getElementById('res-objective');
const resSanitary = document.getElementById('res-sanitary');
const resSafety = document.getElementById('res-safety');
const resRecommendations = document.getElementById('res-recommendations');

let isVideoPlaying = false;
let hideTimer;

function resetHideTimer() {
    if (!isVideoPlaying) return; 
    interactiveControls.classList.remove('hidden-controls');
    interactiveControls.style.pointerEvents = 'auto';
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
        if (isVideoPlaying) {
            interactiveControls.classList.add('hidden-controls');
            interactiveControls.style.pointerEvents = 'none';
        }
    }, 3000);
}

document.body.addEventListener('click', resetHideTimer);
document.body.addEventListener('touchstart', resetHideTimer);
tempSlider.addEventListener('input', resetHideTimer);
warehouseSelect.addEventListener('change', resetHideTimer);

tempSlider.addEventListener('input', (e) => {
    let val = e.target.value;
    tempDisplay.innerText = val > 0 ? `+${val}°C` : `${val}°C`;
});

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
    resetHideTimer();
}

// Уніфікована функція відправки в Gemini для складів
async function sendImageToGemini(base64Image) {
    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
        alert("Введіть ваш Gemini API ключ у налаштуваннях.");
        resetScanner();
        return;
    }

    actionButtonsGroup.style.display = 'none';
    interactiveControls.classList.add('hidden-controls'); 

    statusText.innerText = "Суворий аудит зберігання...";
    statusText.style.color = "#f1c40f";

    const declaredTemp = tempSlider.value;
    const selectedStorage = warehouseSelect.value;

    const promptText = `Ти - Суворий Державний інспектор та Експерт з логістики HACCP.
    ВВІДНІ ДАНІ ВІД ІНСПЕКТОРА (ФАКТ):
    1. Тип об'єкта зберігання: ${selectedStorage}.
    2. Заявлена температура: ${declaredTemp}°C.

    ПРАВИЛА ДЛЯ РОЗДІЛІВ 1, 2, 3 (ЖОРСТКІ ФАКТИ, БЕЗ ФАНТАЗІЙ):
    1. "objective": Що бачиш на фото? Чи є фізичний термометр у кадрі? (якщо є - порівняй із заявленою t ${declaredTemp}°C). Яка тара на фото (ящики, мішки, картон)?
    2. "sanitary": Аналізуй жорстко за нормами зберігання. ШУКАЙ КОНКРЕТНО:
       - Піддони/Стелажі: Чи лежить товар безпосередньо на підлозі? (Грубе порушення).
       - Відступи: Чи є зазор між товаром і стіною для циркуляції повітря та контролю шкідників (дератизації)?
       - Товарне сусідство: Чи є ризик перехресного забруднення на ярусах?
       - Температурний режим: Чи відповідає ${declaredTemp}°C нормам для "${selectedStorage}"?
    3. "safety": Охорона праці та тара: стан піддонів (зламані, брудні), правильність штабелювання (ризик обвалу), наявність льоду на підлозі (ризик падіння).

    ПРАВИЛА ДЛЯ РОЗДІЛУ 4 (РЕКОМЕНДАЦІЇ):
    4. "recommendations": Практичні поради як логіст. Порадь, як переставити товар на ярусах, нагадай про правило FIFO, ремонт піддонів, закупівлю пластикових візків замість дерева.
    ОБОВ'ЯЗКОВЕ ПРАВИЛО: Якщо на фото виявлено бруд, пошкодження, іржу або порушення цілісності поверхонь, обов'язково включи у блок "recommendations" сувору вимогу провести генеральне прибирання, дезінфекцію приміщення або відповідний ремонт.

    Поверни ТІЛЬКИ JSON:
    {
      "objective": "Текст об'єктивної картини",
      "sanitary": "Текст санітарних порушень",
      "safety": "Текст порушень охорони праці та тари",
      "recommendations": "Практичні поради щодо зберігання"
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

        statusText.innerText = `Аудит: ${selectedStorage}`;
        statusText.style.color = "#2ecc71";

        const formatText = (text) => text.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');

        resObjective.innerHTML = formatText(parsedData.objective);
        resSanitary.innerHTML = formatText(parsedData.sanitary);
        resSafety.innerHTML = formatText(parsedData.safety);
        resRecommendations.innerHTML = formatText(parsedData.recommendations);

        resultPanel.style.display = 'block';
        btnGroup.style.display = 'flex';

    } catch (error) {
        statusText.innerText = "Помилка аналізу!";
        statusText.style.color = "#e74c3c";
        alert("Не вдалося проаналізувати склад. Спробуйте інше фото.");
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
    btnGroup.style.display = 'none';
    resultPanel.style.display = 'none';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    galleryInput.value = "";
    
    statusText.innerText = "Оберіть об'єкт і тапайте по екрану";
    statusText.style.color = "#3498db";
    resetHideTimer();
}

btnRetry.addEventListener('click', resetScanner);
btnSave.addEventListener('click', () => { alert("Складський звіт збережено!"); resetScanner(); });

init();
