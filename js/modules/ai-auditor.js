const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const btnCapture = document.getElementById('btn-capture');
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

async function runAudit() {
    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
        alert("Введіть ваш Gemini API ключ у налаштуваннях.");
        return;
    }

    if (isVideoPlaying) {
        video.pause();
        isVideoPlaying = false;
        btnCapture.style.display = 'none';

        statusText.innerText = "Аналізую вітрину...";
        statusText.style.color = "#f1c40f";
        
        canvas.width = video.clientWidth;
        canvas.height = video.clientHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

        // КОМБІНОВАНИЙ ПРОМПТ ДЛЯ ШІ З НОВИМ ПРАВИЛОМ
        const promptText = `Проаналізуй цю вітрину або розкладку товарів. Ти виконуєш дві ролі.

        РОЛЬ 1: СУВОРИЙ САНІТАРНИЙ ІНСПЕКТОР (Україна)
        Шукай виключно фактичні порушення на основі цих правил:
        - Наказ №185 п.16 (Товарне сусідство): Заборонено сире м'ясо/рибу поруч із готовими продуктами.
        - Закон №771 ст.49 (Гігієна): Наявність бруду на лотках, відсутність захисних екранів, нагромадження.
        
        ОБОВ'ЯЗКОВЕ ПРАВИЛО ДЛЯ ВСІХ РОЗДІЛІВ: Якщо на фото виявлено бруд, пошкодження, іржу або порушення цілісності поверхонь чи обладнання, обов'язково включи у свій звіт сувору рекомендацію провести генеральне прибирання, дезінфекцію приміщення/вітрини або відповідний ремонт.

        РОЛЬ 2: ТОП-МЕРЧАНДАЙЗЕР (Маркетинг)
        Дай 2-3 практичні поради, як переставити ці ж товари, щоб вітрина виглядала дорожче і продавала більше. 
        Використовуй принципи: кольоровий контраст (напр. зелень між м'ясом), правило золотої полиці, ефект достатку, крос-сейл (супутні товари).

        Поверни результат ТІЛЬКИ у форматі JSON:
        {
          "sanitary": {
             "status": "OK" або "VIOLATION",
             "verdict_title": "Короткий вердикт",
             "details": "Опис порушень з посиланням на закон, або підтвердження норми. Включи вимоги про ремонт/дезінфекцію, якщо є бруд/пошкодження."
          },
          "marketing": {
             "advice": "Твої поради щодо покращення викладки для збільшення продажів (використовуй списки)."
          }
        }`;

        const requestBody = {
            contents: [{
                parts: [
                    { text: promptText },
                    { inline_data: { mime_type: "image/jpeg", data: base64Image } }
                ]
            }],
            generationConfig: { responseMimeType: "application/json", temperature: 0.2 }
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

            // Блок 1: Санітарія
            if (parsedData.sanitary.status === "VIOLATION") {
                verdictBox.className = "verdict warn";
                verdictBox.innerHTML = `❌ ${parsedData.sanitary.verdict_title}`;
            } else {
                verdictBox.className = "verdict ok";
                verdictBox.innerHTML = `✅ ${parsedData.sanitary.verdict_title}`;
            }
            sanitaryText.innerHTML = parsedData.sanitary.details.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');

            // Блок 2: Маркетинг
            marketingText.innerHTML = parsedData.marketing.advice.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');

            resultPanel.style.display = 'block';
            btnGroup.style.display = 'flex';

        } catch (error) {
            statusText.innerText = "Помилка аналізу!";
            statusText.style.color = "#e74c3c";
            alert("Не вдалося проаналізувати вітрину. Спробуйте ще раз.");
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
    
    statusText.innerText = "Охопіть вітрину цілком";
    statusText.style.color = "#f39c12";
}

btnCapture.addEventListener('click', runAudit);
btnRetry.addEventListener('click', resetScanner);
btnSave.addEventListener('click', () => { alert("Аудит успішно збережено!"); resetScanner(); });

init();
