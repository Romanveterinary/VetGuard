const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const btnCapture = document.getElementById('btn-capture');
const btnRetry = document.getElementById('btn-retry');
const btnSave = document.getElementById('btn-save');
const btnGroup = document.getElementById('btn-group');
const statusText = document.getElementById('status-text');
const resultPanel = document.getElementById('result-panel');
const thermometerUi = document.getElementById('thermometer-ui');

// Повзунок
const tempSlider = document.getElementById('temp-slider');
const tempDisplay = document.getElementById('temp-display');

// Поля результатів
const resObjective = document.getElementById('res-objective');
const resSanitary = document.getElementById('res-sanitary');
const resSafety = document.getElementById('res-safety');
const resRecommendations = document.getElementById('res-recommendations');

let isVideoPlaying = false;

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
        thermometerUi.style.display = 'none'; // Ховаємо термометр після фіксації

        statusText.innerText = "Жорсткий аудит цеху...";
        statusText.style.color = "#f1c40f";
        
        canvas.width = video.clientWidth;
        canvas.height = video.clientHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

        // Беремо значення з нашого повзунка
        const declaredTemp = tempSlider.value;

        const promptText = `Ти - Головний Аудитор з якості (QA Manager) та Санітарно-ветеринарний інспектор.
        Зараз ти аналізуєш виробничий цех.
        
        ВВІДНІ ДАНІ ВІД ІНСПЕКТОРА:
        Заявлена температура в цьому приміщенні: ${declaredTemp}°C.

        Твоє завдання - провести аудит і повернути JSON з 4 розділами.

        ПРАВИЛА ДЛЯ РОЗДІЛІВ 1, 2, 3 (ЖОРСТКІ ФАКТИ, БЕЗ ФАНТАЗІЙ):
        1. "objective" (Об'єктивна картина): Опиши лише факти. Тип цеху, кількість людей, яке обладнання видно. Знайди фізичний термометр/табло на фото. Якщо знайшов - порівняй його цифру із заявленою (${declaredTemp}°C).
        2. "sanitary" (Санітарія): Аналізуй закони НАССР та Закон №771. Перевір, чи відповідає температура ${declaredTemp}°C нормам для такого цеху. Знайди бруд, ящики на підлозі (це ризик перехресного забруднення), відсутність шапочок, брудні фартухи. Пиши тільки те, що реально бачиш. Якщо порушень немає - так і пиши.
        3. "safety" (Охорона праці): Шукай критичні загрози життю: відкриті розетки біля мийок, дроти на підлозі, відсутність плафонів на лампах, іржу, зламане обладнання (напр. візки без коліс).

        ПРАВИЛА ДЛЯ РОЗДІЛУ 4 (ТВОРЧІ РЕКОМЕНДАЦІЇ):
        4. "recommendations" (Практичні поради): Тут ти дієш як досвідчений технолог-практик. Дай розгорнуті поради. Наприклад: якщо ящики на підлозі - порадь купити візки-піддони; якщо обладнання іржаве - порадь замінити; якщо ножі на столі - порадь магнітні тримачі; нагадай про кольорове маркування інвентарю.

        Поверни ТІЛЬКИ JSON:
        {
          "objective": "Текст об'єктивної картини",
          "sanitary": "Текст санітарних порушень (з посиланнями на закони або норми)",
          "safety": "Текст порушень охорони праці та небезпек",
          "recommendations": "Практичні поради для покращення процесів (використовуй маркери списку)"
        }`;

        const requestBody = {
            contents: [{
                parts: [
                    { text: promptText },
                    { inline_data: { mime_type: "image/jpeg", data: base64Image } }
                ]
            }],
            generationConfig: { 
                responseMimeType: "application/json", 
                temperature: 0.1 // Дуже низька температура для утримання ШІ в рамках фактів
            }
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

            statusText.innerText = "Аудит завершено";
            statusText.style.color = "#2ecc71";

            // Рендер результатів (перетворюємо \n та ** у нормальні HTML теги)
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
    thermometerUi.style.display = 'flex'; // Повертаємо термометр
    btnGroup.style.display = 'none';
    resultPanel.style.display = 'none';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    statusText.innerText = "Охопіть цех та термометр";
    statusText.style.color = "#e67e22";
}

btnCapture.addEventListener('click', runWorkshopAudit);
btnRetry.addEventListener('click', resetScanner);
btnSave.addEventListener('click', () => { alert("Офіційний звіт інспектора збережено!"); resetScanner(); });

init();
