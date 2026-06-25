// Знаходимо всі необхідні елементи на сторінці
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const btnCapture = document.getElementById('btn-capture');
const statusText = document.getElementById('status-text');
const resultPanel = document.getElementById('result-panel');
const objectCountSpan = document.getElementById('object-count');

let model = null; // Тут буде жити наш ШІ
let isVideoPlaying = false;

// 1. Функція увімкнення камери (задньої)
async function setupCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }, // 'environment' означає задню камеру
            audio: false
        });
        video.srcObject = stream;
        
        // Чекаємо, поки відео почне грати, щоб налаштувати розмір полотна
        return new Promise((resolve) => {
            video.onloadedmetadata = () => {
                resolve(video);
            };
        });
    } catch (error) {
        statusText.innerText = "Помилка камери! Перевірте дозволи.";
        console.error("Помилка доступу до камери:", error);
    }
}

// 2. Функція завантаження моделі ШІ
async function loadAI() {
    statusText.innerText = "Завантаження ШІ (це може зайняти кілька секунд)...";
    try {
        // Завантажуємо COCO-SSD (стандартна швидка модель для пошуку об'єктів)
        model = await cocoSsd.load();
        statusText.innerText = "ШІ готовий! Наведіть камеру.";
    } catch (error) {
        statusText.innerText = "Помилка завантаження ШІ!";
        console.error(error);
    }
}

// 3. Головна функція запуску
async function init() {
    await setupCamera();
    video.play();
    isVideoPlaying = true;
    
    // Робимо розмір полотна (canvas) таким самим, як і відео
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Паралельно завантажуємо ШІ
    await loadAI();
}

// 4. Функція розпізнавання та малювання (спрацьовує по кнопці)
async function detectAndCount() {
    if (!model) {
        alert("ШІ ще завантажується, зачекайте хвилинку!");
        return;
    }

    // Якщо відео грає - ставимо на паузу (заморожуємо кадр)
    if (isVideoPlaying) {
        video.pause();
        isVideoPlaying = false;
        btnCapture.innerText = "🔄 Очистити і продовжити";
        statusText.innerText = "Аналіз кадру...";
        
        // Перераховуємо розміри, бо екран міг повернутися
        canvas.width = video.clientWidth;
        canvas.height = video.clientHeight;

        // Даємо команду ШІ знайти всі об'єкти на "замороженому" відео
        const predictions = await model.detect(video);
        
        // Очищаємо попередні малюнки
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        let count = 0;

        // Малюємо рамку для кожного знайденого об'єкта
        predictions.forEach(prediction => {
            // Фільтруємо: беремо тільки те, в чому ШІ впевнений більше ніж на 50%
            if (prediction.score > 0.50) {
                count++;
                
                // Координати рамки
                const [x, y, width, height] = prediction.bbox;
                
                // Масштабуємо координати під реальний розмір екрана
                const scaleX = canvas.width / video.videoWidth;
                const scaleY = canvas.height / video.videoHeight;
                
                const scaledX = x * scaleX;
                const scaledY = y * scaleY;
                const scaledWidth = width * scaleX;
                const scaledHeight = height * scaleY;

                // Малюємо зелену рамку
                ctx.strokeStyle = '#27ae60';
                ctx.lineWidth = 4;
                ctx.strokeRect(scaledX, scaledY, scaledWidth, scaledHeight);

                // Малюємо фон для тексту
                ctx.fillStyle = '#27ae60';
                ctx.fillRect(scaledX, scaledY - 25, scaledWidth, 25);

                // Пишемо назву об'єкта та % впевненості
                ctx.fillStyle = '#ffffff';
                ctx.font = '16px Arial';
                const label = `${prediction.class} (${Math.round(prediction.score * 100)}%)`;
                ctx.fillText(label, scaledX + 5, scaledY - 7);
            }
        });

        // Виводимо загальну кількість на екран
        statusText.innerText = "Готово!";
        objectCountSpan.innerText = count;
        resultPanel.style.display = 'block';

    } else {
        // Якщо відео було на паузі - запускаємо знову (очищення)
        video.play();
        isVideoPlaying = true;
        btnCapture.innerText = "📸 Захопити і Рахувати";
        statusText.innerText = "ШІ готовий! Наведіть камеру.";
        
        // Очищаємо полотно і ховаємо результат
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        resultPanel.style.display = 'none';
    }
}

// Прив'язуємо клік до нашої великої кнопки
btnCapture.addEventListener('click', detectAndCount);

// Запускаємо камеру при відкритті сторінки
init();