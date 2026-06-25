const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const btnCapture = document.getElementById('btn-capture');
const btnRetry = document.getElementById('btn-retry');
const btnCalculate = document.getElementById('btn-calculate');
const btnGroup = document.getElementById('btn-group');

const statusText = document.getElementById('status-text');
const aiAdvicePanel = document.getElementById('ai-advice-panel');
const calcPanel = document.getElementById('calc-panel');
const calcResult = document.getElementById('calc-result');

const elSurface = document.getElementById('surface-type');
const elChem = document.getElementById('chem-type');
const elReason = document.getElementById('chem-reason');

let isVideoPlaying = false;

async function setupCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' }, 
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

// 1. Аналіз ШІ: Визначення типу хімії
async function analyzeSurface() {
    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
        alert("Введіть ваш Gemini API ключ у налаштуваннях.");
        return;
    }

    if (isVideoPlaying) {
        video.pause();
        isVideoPlaying = false;
        btnCapture.style.display = 'none';

        statusText.innerText = "Аналізую поверхню...";
        statusText.style.color = "#f1c40f";
        
        canvas.width = video.clientWidth;
        canvas.height = video.clientHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

        const promptText = `Ти - головний санітарний технолог харчового виробництва.
        Подивись на фото і визнач тип приміщення/поверхні (наприклад: кулінарний цех, бетонна підлога, коридор, санвузол, нержавійка).
        Порекомендуй, який тип дезінфікуючого/миючого засобу тут потрібен.

        Правила:
        - Лужний (Alkaline): якщо це цех, де є жир, білок, кров (органіка).
        - Кислотний (Acidic): якщо це мінеральні відкладення, іржа, водяний камінь (санвузли, стара плитка, бетон з нальотом).
        - Нейтральний (Neutral): якщо це загальний коридор, чистий склад, делікатні поверхні.
        - Хлорвмісний: для жорсткої дезінфекції.

        Поверни ТІЛЬКИ JSON:
        {
          "surface": "Назва того, що бачиш",
          "chemical_type": "Лужний / Кислотний / Нейтральний",
          "reason": "Аргументація чому саме цей засіб найкраще розщепить специфічний вид бруду в цьому приміщенні."
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
            const parsedData = JSON.parse(data.candidates[0].content.parts[0].text.trim());

            statusText.innerText = "Рекомендацію отримано";
            statusText.style.color = "#2ecc71";

            elSurface.innerText = `Поверхня: ${parsedData.surface}`;
            elChem.innerText = `Засіб: ${parsedData.chemical_type}`;
            elReason.innerText = parsedData.reason;

            aiAdvicePanel.style.display = 'block';
            calcPanel.style.display = 'block';
            btnGroup.style.display = 'flex';

        } catch (error) {
            statusText.innerText = "Помилка аналізу!";
            statusText.style.color = "#e74c3c";
            alert("Не вдалося проаналізувати. Спробуйте ще раз.");
            resetScanner();
        }
    }
}

// 2. Математика: Розрахунок літрів
function calculateMath() {
    const area = parseFloat(document.getElementById('input-area').value) || 0;
    const conc = parseFloat(document.getElementById('input-conc').value) || 0;
    const rate = parseFloat(document.getElementById('input-rate').value) || 0;

    // Всього розчину = площа * витрата на метр
    const totalSolutionLiters = area * rate;
    
    // Скільки чистої хімії = відсоток від загального об'єму
    const chemicalLiters = totalSolutionLiters * (conc / 100);
    
    // Скільки води = загальний об'єм мінус хімія
    const waterLiters = totalSolutionLiters - chemicalLiters;

    document.getElementById('res-total').innerText = totalSolutionLiters.toFixed(2);
    document.getElementById('res-chem').innerText = chemicalLiters.toFixed(3); // 3 знаки (мілілітри)
    document.getElementById('res-water').innerText = waterLiters.toFixed(2);

    calcResult.style.display = 'block';
}

function resetScanner() {
    video.play();
    isVideoPlaying = true;
    
    btnCapture.style.display = 'block';
    aiAdvicePanel.style.display = 'none';
    calcPanel.style.display = 'none';
    calcResult.style.display = 'none';
    btnGroup.style.display = 'none';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    statusText.innerText = "Сфотографуйте поверхню";
    statusText.style.color = "#9b59b6";
}

btnCapture.addEventListener('click', analyzeSurface);
btnCalculate.addEventListener('click', calculateMath);
btnRetry.addEventListener('click', resetScanner);

init();
