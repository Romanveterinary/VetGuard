// Чекаємо, поки завантажиться весь HTML
document.addEventListener('DOMContentLoaded', () => {
    
    // --- ЗМІННІ ГОЛОВНОГО МЕНЮ ---
    const btnRuler = document.getElementById('btn-ruler');
    const btnWeight = document.getElementById('btn-weight');
    const btnCounter = document.getElementById('btn-counter');
    const btnSanitary = document.getElementById('btn-sanitary');
    const btnAuditor = document.getElementById('btn-auditor');
    const btnWorkshop = document.getElementById('btn-workshop');
    const btnWarehouse = document.getElementById('btn-warehouse'); 
    const btnScanner = document.getElementById('btn-scanner');

    // --- ЗМІННІ НАЛАШТУВАНЬ (КЛЮЧА) ---
    const btnSettings = document.getElementById('btn-settings');
    const modalSettings = document.getElementById('settings-modal');
    const btnCloseSettings = document.getElementById('btn-close-settings');
    const btnSaveKey = document.getElementById('btn-save-key');
    const apiKeyInput = document.getElementById('api-key-input');
    const btnToggleVisibility = document.getElementById('btn-toggle-visibility');

    // ==========================================
    // ЛОГІКА РОБОТИ З API-КЛЮЧЕМ (LocalStorage)
    // ==========================================
    
    // Відкрити вікно налаштувань
    btnSettings.addEventListener('click', () => {
        const savedKey = localStorage.getItem('gemini_api_key');
        if (savedKey) apiKeyInput.value = savedKey;
        apiKeyInput.type = 'password'; // Завжди відкриваємо прихованим
        modalSettings.style.display = 'flex'; 
    });

    // Закрити вікно налаштувань
    btnCloseSettings.addEventListener('click', () => {
        modalSettings.style.display = 'none'; 
    });

    // Зберегти ключ у пам'ять телефону
    btnSaveKey.addEventListener('click', () => {
        const key = apiKeyInput.value.trim();
        if (key) {
            localStorage.setItem('gemini_api_key', key);
            alert('Ключ успішно збережено на вашому пристрої!');
            modalSettings.style.display = 'none';
        } else {
            alert('Будь ласка, введіть валідний ключ.');
        }
    });

    // Кнопка "Око" - показати ключ на 3 секунди
    let visibilityTimeout;
    btnToggleVisibility.addEventListener('click', () => {
        // Змінюємо тип поля на звичайний текст, щоб побачити символи
        apiKeyInput.type = 'text';
        
        // Скидаємо попередній таймер
        clearTimeout(visibilityTimeout);
        
        // Запускаємо відлік 3 секунди (3000 мс), після чого ховаємо знову
        visibilityTimeout = setTimeout(() => {
            apiKeyInput.type = 'password';
        }, 3000);
    });


    // ==========================================
    // ЛОГІКА КНОПОК ГОЛОВНОГО МЕНЮ
    // ==========================================

    // Тимчасова функція для модулів, які ще в розробці
    const openModule = (moduleName) => {
        alert(`Запуск модуля: ${moduleName}\nНезабаром тут буде робочий інтерфейс!`);
    };

    // --- АВТОНОМНИЙ БЛОК (Офлайн) ---
    
    // 📏 AR-Рулетка (веде на сторінку)
    btnRuler.addEventListener('click', () => { 
        window.location.href = 'ar-ruler.html'; 
    });
    
    // ⚖️ AR-Вага тварин (поки що повідомлення)
    btnWeight.addEventListener('click', () => openModule('AR-Вага тварин'));
    
    // 📸 ШІ-Лічильник об'єктів (веде на сторінку)
    btnCounter.addEventListener('click', () => { 
        window.location.href = 'ai-counter.html'; 
    });
    
    
    // --- ІНТЕЛЕКТУАЛЬНИЙ БЛОК (Gemini) ---
    
    btnSanitary.addEventListener('click', () => openModule('Санітарний Калькулятор'));
    btnAuditor.addEventListener('click', () => openModule('AI-Аудитор Вітрин'));
    btnWorkshop.addEventListener('click', () => openModule('AI-Інспектор Цехів')); 
    btnWarehouse.addEventListener('click', () => openModule('AI-Аудитор Складів та Холодильників'));
    btnScanner.addEventListener('click', () => openModule('AI-Сканер Етикеток'));

});