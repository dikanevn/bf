import fs from 'fs';
import path from 'path';

/**
 * Функция для преобразования числа в шестнадцатеричный формат без масштабирования
 * @param value Значение для преобразования (BigInt)
 * @returns Строка в шестнадцатеричном формате с префиксом 0x
 */
function toHexWithPrecision(value: bigint): string {
    // Преобразуем в hex с префиксом 0x и возвращаем как есть, без дополнения нулями
    return '0x' + value.toString(16).toUpperCase();
}

/**
 * Функция для преобразования числа с плавающей точкой в BigInt с сохранением точности
 * @param value Значение с плавающей точкой
 * @param precision Количество знаков после запятой для сохранения
 * @returns BigInt значение
 */
function floatToBigInt(value: number, precision: number = 18): bigint {
    // Масштабируем число, чтобы сохранить нужное количество знаков после запятой
    const scaleFactor = 10n ** BigInt(precision);
    // Округляем и преобразуем в BigInt
    return BigInt(Math.round(value * Number(scaleFactor)));
}

/**
 * Функция для преобразования BigInt обратно в строку с плавающей точкой для отображения
 * @param value BigInt значение
 * @param precision Количество знаков после запятой (должно соответствовать масштабу входных данных)
 * @returns Строковое представление числа с плавающей точкой
 */
function bigIntToFloatString(value: bigint, precision: number = 18): string {
    // Создаем делитель на основе precision
    // Например, если precision = 15, то scaleFactor = 10^15
    // Это позволяет правильно отобразить десятичную часть числа
    const scaleFactor = 10n ** BigInt(precision);
    
    // Получаем целую часть числа (до запятой)
    const integerPart = value / scaleFactor;
    
    // Получаем дробную часть числа (после запятой)
    const fractionalPart = value % scaleFactor;
    
    // Преобразуем дробную часть в строку и удаляем лишние нули справа
    let fractionalStr = fractionalPart.toString().padStart(precision, '0');
    fractionalStr = fractionalStr.replace(/0+$/, '');
    
    if (fractionalStr.length > 0) {
        return `${integerPart}.${fractionalStr}`;
    } else {
        return integerPart.toString();
    }
}

/**
 * Функция для обновления коэффициентов в файле d02.json
 */
function updateCoefficients() {
    try {
        // Константы в шестнадцатеричном формате
        const initialValueHex = '0xC6F3B40B6C0000'; // Начальное значение для 1 раунда (56 * 10^15)
        
        // Используем дробь 374/375 вместо 0.9975
        const decayNumeratorValue = 374n;
        const decayDenominatorValue = 375n;
        
        // Масштабирующий множитель для сохранения точности (10^15)
        const scaleFactor = 10n ** 15n;
        const decayDenominatorHex = '0x38d7ea4c68000'; // Знаменатель (10^15) - используется для деления при расчете
        
        // Точность для отображения значений в десятичном формате (для функции bigIntToFloatString)
        // Должна соответствовать степени 10 в шестнадцатеричных значениях (10^15)
        const precision = 15;
        
        const maxRounds = 1000; // Количество раундов

        // Преобразуем шестнадцатеричные строки в BigInt
        const initialValueBigInt = BigInt(initialValueHex);

        // Путь к файлу
        const filePath = './b/d02.json';

        // Проверяем существование файла
        if (!fs.existsSync(filePath)) {
            throw new Error(`Файл не найден: ${filePath}`);
        }

        // Читаем содержимое файла
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        let data: any[];
        
        try {
            data = JSON.parse(fileContent);
        } catch (error) {
            throw new Error(`Ошибка при парсинге файла: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
        }

        // Проверяем, что данные являются массивом
        if (!Array.isArray(data)) {
            throw new Error('Содержимое файла не является массивом');
        }

        console.log(`\nНачинаю обновление коэффициентов для ${data.length} раундов`);
        console.log(`Начальное значение (hex): ${initialValueHex}`);
        console.log(`Коэффициент уменьшения: ${decayNumeratorValue}/${decayDenominatorValue} (≈ ${Number(decayNumeratorValue) / Number(decayDenominatorValue)})`);
        console.log(`Точность: ${precision} знаков`);

        // Используем начальное значение напрямую из шестнадцатеричного представления
        let currentValueBigInt = initialValueBigInt;

        // Вычисляем новые значения для каждого раунда
        const updatedData = data.map(item => {
            // Копируем объект, чтобы не изменять оригинал
            const updatedItem = { ...item };
            
            // Обновляем значения
            updatedItem.coefficient = toHexWithPrecision(currentValueBigInt);
            updatedItem.value = bigIntToFloatString(currentValueBigInt, precision);
            updatedItem.winnersCount = ""; // Очищаем winnersCount
            
            // Добавляем информацию о множителе
            updatedItem.multiplier = `374/375 (≈ ${Number(decayNumeratorValue) / Number(decayDenominatorValue)})`;
            
            // Уменьшаем значение для следующего раунда с высокой точностью
            // Используем только BigInt операции
            // Математически это эквивалентно умножению на 374/375:
            // value * (374/375) = (value * 374) / 375
            currentValueBigInt = (currentValueBigInt * decayNumeratorValue) / decayDenominatorValue;
            
            return updatedItem;
        });

        // Если в исходном файле меньше 1000 раундов, добавляем недостающие
        if (updatedData.length < maxRounds) {
            const lastRound = updatedData.length;
            
            for (let i = lastRound + 1; i <= maxRounds; i++) {
                // Создаем новый раунд на основе последнего
                const template = { ...updatedData[updatedData.length - 1] };
                
                // Обновляем значения
                template.round = i;
                template.coefficient = toHexWithPrecision(currentValueBigInt);
                template.value = bigIntToFloatString(currentValueBigInt, precision);
                template.winnersCount = "";
                template.BITCOIN_BLOCK_HASH = "";
                template.BITCOIN_BLOCK_NUMBER = "";
                template.BITCOIN_BLOCK_TIME = "";
                template.GAME_ID = "";
                template.GAME_TIME = "";
                template.RewardsOrDeploy = "";
                template.tokenName = "";
                template.IS_TOKEN_LAUNCHED = false;
                template.TOKEN_ADDRESS = "";
                
                // Добавляем информацию о множителе
                template.multiplier = `374/375 (≈ ${Number(decayNumeratorValue) / Number(decayDenominatorValue)})`;
                
                updatedData.push(template);
                
                // Уменьшаем значение для следующего раунда
                // Математически это эквивалентно умножению на 374/375:
                // value * (374/375) = (value * 374) / 375
                currentValueBigInt = (currentValueBigInt * decayNumeratorValue) / decayDenominatorValue;
            }
        }

        // Записываем обновленные данные обратно в файл
        fs.writeFileSync(filePath, JSON.stringify(updatedData, null, 2), 'utf-8');

        console.log(`\nОбновление завершено успешно!`);
        console.log(`Обновлено ${updatedData.length} раундов`);
        console.log(`Начальное значение (hex): ${initialValueHex}`);
        console.log(`Конечное значение: ${updatedData[updatedData.length - 1].value}`);
        console.log(`Конечный коэффициент: ${updatedData[updatedData.length - 1].coefficient}`);

    } catch (error) {
        console.error('\nКритическая ошибка:');
        if (error instanceof Error) {
            console.error(error.message);
        }
        process.exit(1);
    }
}

// Запускаем функцию обновления коэффициентов
updateCoefficients(); 