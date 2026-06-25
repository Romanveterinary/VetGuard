const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const btnCapture = document.getElementById('btn-capture');
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

// Логіка зникання UI
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

// Оновлення цифри термометра
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
    resetHideTimer();
}

async function runWarehouseAudit() {
    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
        alert("Введіть ваш Gemini API ключ у налаштуваннях.");
        return;
    }

    if (isVideoPlaying) {
        video.pause();
        isVideoPlaying = false;
        
        btnCapture.style.display = 'none';
        interactiveControls.classList.add('hidden-controls'); 

        statusText.innerText = "Суворий аудит зберігання...";
        statusText.style.color = "#f1c40f";
        
        canvas.width = video.clientWidth;
        canvas.height = video.clientHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

        const declaredTemp = tempSlider.value;
        const selectedStorage = warehouseSelect.value;

        // ПРОМПТ ДЛЯ СКЛАДСЬКОГО АУДИТУ
        const promptText = `Ти - Суворий Державний інспектор та Експерт з логістики HACCP.
        
        ВВІДНІ ДАНІ ВІД ІНСПЕКТОРА (ФАКТ):
        1. Тип об'єкта зберігання: ${selectedStorage}.
        2. Заявлена температура: ${declaredTemp}°C.

        ПРАВИЛА ДЛЯ РОЗДІЛІВ 1, 2, 3 (ЖОРСТКІ ФАКТИ, ЖОДНИХ ФАНТАЗІЙ):
        1. "objective": Що бачиш на фото? Чи є фізичний термометр у кадрі? (якщо є - порівняй із заявленою t ${declaredTemp}°C). Яка тара на фото (ящики, мішки, картон)?
        2. "sanitary": Аналізуй жорстко за нормами зберігання. ШУКАЙ КОНКРЕТНО:
           - Піддони/Стелажі: Чи лежить товар безпосередньо на підлозі? (Грубе порушення).
           - Відступи: Чи є зазор між товаром і стіною для циркуляції повітря та контролю шкідників (дератизації)?
           - Товарне сусідство: Чи є ризик перехресного забруднення на ярусах (напр., сире м'ясо над готовим)?
           - Температурний режим: Чи відповідає ${declaredTemp}°C нормам для "${selectedStorage}"?
        3. "safety": Охорона праці та тара: стан піддонів (зламані, брудні), правильність штабелювання (ризик обвалу), наявність льоду на підлозі (ризик падіння).

        ПРАВИЛА ДЛЯ РОЗДІЛУ 4 (РЕКОМЕНДАЦІЇ):
        4. "recommendations": Практичні поради як логіст. Порадь, як переставити товар на ярусах, нагадай про правило FIFO (First In, First Out), ремонт піддонів, закупівлю пластикових візків замість дерева.

        Поверни ТІЛЬКИ JSON:
        {
          "objective": "Текст об'єктивної картини",
          "sanitary": "Текст санітарних порушень (піддони, відступи, сусідство)",
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
            const resultText = data.candidates[0].content.parts[0].text;
            const parsedData = JSON.parse(resultText.trim());

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
            alert("Не вдалося проаналізувати склад. Перевірте інтернет.");
            resetScanner();
        }
    }
}

function resetScanner() {
    video.play();
    isVideoPlaying = true;
    
    btnCapture.style.display = 'block';
    btnGroup.style.display = 'none';
    resultPanel.style.display = 'none';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    statusText.innerText = "Оберіть об'єкт і тапайте по екрану";
    statusText.style.color = "#3498db";
    resetHideTimer();
}

btnCapture.addEventListener('click', runWarehouseAudit);
btnRetry.addEventListener('click', resetScanner);
btnSave.addEventListener('click', () => { alert("Складський звіт збережено!"); resetScanner(); });

init();
