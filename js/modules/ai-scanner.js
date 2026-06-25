const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const btnCapture = document.getElementById('btn-capture');
const btnRetry = document.getElementById('btn-retry');
const btnSave = document.getElementById('btn-save');
const btnGroup = document.getElementById('btn-group');
const scannerFrame = document.getElementById('scanner-frame');
const statusText = document.getElementById('status-text');
const resultPanel = document.getElementById('result-panel');
const verdictBox = document.getElementById('verdict-box');
const analysisText = document.getElementById('analysis-text');

let isVideoPlaying = false;

// 1. Увімкнення камери
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

// 2. Жорстке сканування тексту
async function scanLabel() {
    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
        alert("Увага! Спочатку введіть свій Gemini API ключ у налаштуваннях.");
        return;
    }

    if (isVideoPlaying) {
        video.pause();
        isVideoPlaying = false;
        
        scannerFrame.style.display = 'none';
        btnCapture.style.display = 'none';

        statusText.innerText = "Суворий аналіз... Зачекайте";
        statusText.style.color = "#f1c40f";
        
        canvas.width = video.clientWidth;
        canvas.height = video.clientHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

        // МАКСИМАЛЬНО ЖОРСТКИЙ ПРОМПТ
        const promptText = `Ти - максимально суворий і безкомпромісний державний санітарно-ветеринарний інспектор.
        Твоє завдання - проаналізувати текст на цій етикетці.

        ЖОРСТКІ ПРАВИЛА:
        1. ЖОДНИХ ФАНТАЗІЙ. Читаєш ТІЛЬКИ те, що чітко видно. Якщо текст розмитий, обрізаний або його немає - пиши "Нерозбірливо" або "Відсутнє". Не вгадуй жодного слова чи цифри!
        2. Якщо на фото немає дати виготовлення або терміну придатності - це автоматичне ПОРУШЕННЯ (VIOLATION).
        3. Шукай заборонені добавки, алергени або порушення маркування.
        4. Поточний рік - 2026. Враховуй це при жорсткій перевірці термінів придатності.

        Поверни результат ТІЛЬКИ у форматі JSON із такою структурою:
        {
          "status": "OK" або "VIOLATION",
          "verdict_title": "Короткий суворий вердикт (напр. 'Порушень не виявлено' або 'Відсутня дата / Прострочено')",
          "details": "Детальний розбір: 1) Терміни: [твої знахідки], 2) Склад: [твої знахідки], 3) Виробник: [твої знахідки]. Чітко вкажи, якщо чогось не вистачає."
        }
        Не додавай ніякого іншого тексту поза JSON.`;

        const requestBody = {
            contents: [{
                parts: [
                    { text: promptText },
                    { inline_data: { mime_type: "image/jpeg", data: base64Image } }
                ]
            }],
            generationConfig: { 
                responseMimeType: "application/json", 
                temperature: 0.0 // ПОВНІСТЮ ВИМИКАЄМО ФАНТАЗІЮ
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

            statusText.innerText = "Перевірку завершено";
            statusText.style.color = "#2ecc71";

            if (parsedData.status === "VIOLATION") {
                verdictBox.className = "verdict warn";
                verdictBox.innerHTML = `❌ ${parsedData.verdict_title}`;
            } else {
                verdictBox.className = "verdict ok";
                verdictBox.innerHTML = `✅ ${parsedData.verdict_title}`;
            }

            let formattedText = parsedData.details.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
            analysisText.innerHTML = formattedText;

            resultPanel.style.display = 'block';
            btnGroup.style.display = 'flex';

        } catch (error) {
            statusText.innerText = "Помилка розпізнавання!";
            statusText.style.color = "#e74c3c";
            alert("Не вдалося прочитати текст. Спробуйте навести чіткіше або перевірте інтернет.");
            resetScanner();
        }
    }
}

function resetScanner() {
    video.play();
    isVideoPlaying = true;
    
    btnCapture.style.display = 'block';
    scannerFrame.style.display = 'block';
    btnGroup.style.display = 'none';
    resultPanel.style.display = 'none';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    statusText.innerText = "Наведіть на текст";
    statusText.style.color = "#3498db";
}

btnCapture.addEventListener('click', scanLabel);
btnRetry.addEventListener('click', resetScanner);
btnSave.addEventListener('click', () => { alert("Суворий звіт збережено!"); resetScanner(); });

init();
