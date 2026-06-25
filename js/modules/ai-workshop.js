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
const workshopSelect = document.getElementById('workshop-select');
const tempSlider = document.getElementById('temp-slider');
const tempDisplay = document.getElementById('temp-display');

// Поля результатів
const resObjective = document.getElementById('res-objective');
const resSanitary = document.getElementById('res-sanitary');
const resSafety = document.getElementById('res-safety');
const resRecommendations = document.getElementById('res-recommendations');

let isVideoPlaying = false;
let hideTimer;

// --- ЛОГІКА ЗНИКАННЯ UI ---
function resetHideTimer() {
    // Якщо відео не грає (ми дивимось результати) - не застосовуємо таймер
    if (!isVideoPlaying) return; 
    
    interactiveControls.classList.remove('hidden-controls');
    interactiveControls.style.pointerEvents = 'auto'; // Повертаємо клікабельність
    
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
        if (isVideoPlaying) {
            interactiveControls.classList.add('hidden-controls');
            interactiveControls.style.pointerEvents = 'none'; // Вимикаємо кліки, коли невидиме
        }
    }, 3000);
}

// Слухаємо тапи по екрану та активність на елементах
document.body.addEventListener('click', resetHideTimer);
document.body.addEventListener('touchstart', resetHideTimer);
tempSlider.addEventListener('input', resetHideTimer);
workshopSelect.addEventListener('change', resetHideTimer);

// Оновлення цифри на екрані при русі повзунка
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
    resetHideTimer(); // Запускаємо таймер при старті
}

async function runWorkshopAudit() {
    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
        alert("Введіть ваш Gemini API ключ у налаштуваннях.");
        return;
    }

    if (isVideoPlaying) {
        video.pause();
        isVideoPlaying = false;
        
        btnCapture.style.display = 'none';
        interactiveControls.classList.add('hidden-controls'); // Ховаємо керування

        statusText.innerText = "Аналіз з урахуванням специфіки цеху...";
        statusText.style.color = "#f1c40f";
        
        canvas.width = video.clientWidth;
        canvas.height = video.clientHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

        // Збираємо точні дані від інспектора
        const declaredTemp = tempSlider.value;
        const selectedWorkshop = workshopSelect.value;

        // ОНОВЛЕНИЙ ЖОРСТКИЙ ПРОМПТ ІЗ ТИПОМ ЦЕХУ
        const promptText = `Ти - Головний Аудитор з якості (QA Manager) та Санітарно-ветеринарний інспектор в Україні.
        
        ВВІДНІ ДАНІ ВІД ІНСПЕКТОРА (ЦЕ ФАКТ, БРАТИ ДО РОЗРАХУНКУ):
        1. Тип об'єкта перевірки: ${selectedWorkshop}.
        2. Заявлена температура в приміщенні: ${declaredTemp}°C.

        Твоє завдання - провести аудит фотографії саме для специфіки "${selectedWorkshop}".

        ПРАВИЛА ДЛЯ РОЗДІЛІВ 1, 2, 3 (ЖОРСТКІ ФАКТИ, БЕЗ ФАНТАЗІЙ):
        1. "objective": Опиши лише факти. Що бачиш на фото? Знайди фізичний термометр на фото (якщо є) і порівняй його цифру із заявленою (${declaredTemp}°C).
        2. "sanitary": Аналізуй Закони України та норми НАССР САМЕ ДЛЯ "${selectedWorkshop}". Перевір, чи відповідає температура ${declaredTemp}°C жорстким нормам цього конкретного цеху. Знайди бруд, ящики на підлозі, перехресне забруднення, відсутність спец-одягу.
        3. "safety": Шукай відкриті розетки біля мийок, дроти на підлозі, відсутність плафонів, іржу, зламане обладнання.

        ПРАВИЛА ДЛЯ РОЗДІЛУ 4 (РЕКОМЕНДАЦІЇ):
        4. "recommendations": Практичні поради як технолог. Якщо ящики на підлозі - порадь візки; щодо інвентарю - нагадай про кольорове маркування дощок та ножів під цей тип цеху.

        Поверни ТІЛЬКИ JSON:
        {
          "objective": "Текст об'єктивної картини",
          "sanitary": "Текст санітарних порушень",
          "safety": "Текст порушень охорони праці",
          "recommendations": "Практичні поради"
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

            statusText.innerText = `Аудит: ${selectedWorkshop}`;
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
            alert("Не вдалося проаналізувати цех. Перевірте з'єднання.");
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
    
    statusText.innerText = "Оберіть цех і тапайте по екрану";
    statusText.style.color = "#e67e22";
    resetHideTimer(); // Перезапуск таймера
}

btnCapture.addEventListener('click', runWorkshopAudit);
btnRetry.addEventListener('click', resetScanner);
btnSave.addEventListener('click', () => { alert("Офіційний звіт збережено!"); resetScanner(); });

init();
