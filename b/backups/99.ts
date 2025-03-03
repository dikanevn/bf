/**
 * Скрипт для расчета коэффициента x, при котором общее количество NFT стремится к 21000.
 * 
 * Условия:
 * - Первый день: 50 NFT
 * - Второй день: 50 * x NFT
 * - Третий день: (50 * x) * x NFT
 * - И так далее
 * - Общее количество NFT должно быть равно 21000
 */

/**
 * Функция для расчета суммы геометрической прогрессии
 * Формула: S = a * (1 - r^n) / (1 - r), где
 * a - первый член прогрессии
 * r - знаменатель прогрессии
 * n - количество членов
 * 
 * Для бесконечной прогрессии при |r| < 1: S = a / (1 - r)
 * 
 * @param a - первый член прогрессии
 * @param r - знаменатель прогрессии
 * @param n - количество членов (опционально, для конечной прогрессии)
 */
function geometricSum(a: number, r: number, n?: number): number {
    // Для бесконечной прогрессии (когда |r| < 1)
    if (n === undefined && Math.abs(r) < 1) {
        return a / (1 - r);
    }
    
    // Для конечной прогрессии
    if (n !== undefined) {
        return a * (1 - Math.pow(r, n)) / (1 - r);
    }
    
    throw new Error('Для бесконечной прогрессии |r| должно быть меньше 1');
}

/**
 * Функция для поиска значения x, при котором сумма геометрической прогрессии равна targetTotal
 * @param targetTotal - целевое общее количество NFT
 * @param initialAmount - начальное количество NFT в первый день
 * @returns найденное значение x
 */
function findXValue(targetTotal: number, initialAmount: number): number {
    // Для геометрической прогрессии, стремящейся к targetTotal, 
    // нам нужно найти x такое, что initialAmount / (1 - x) = targetTotal
    // Отсюда: x = 1 - initialAmount / targetTotal
    
    // Начальное приближение
    let x = 1 - initialAmount / targetTotal;
    
    // Используем итеративный подход для уточнения значения x
    // Целевая точность - разница между суммой и целевым значением должна быть минимальной
    const maxIterations = 1000;
    const epsilon = 1e-15; // Очень высокая точность
    
    for (let i = 0; i < maxIterations; i++) {
        const sum = geometricSum(initialAmount, x);
        const diff = sum - targetTotal;
        
        // Если достигли нужной точности, возвращаем результат
        if (Math.abs(diff) < epsilon) {
            break;
        }
        
        // Корректируем x в зависимости от разницы
        // Если сумма больше целевой, уменьшаем x
        // Если сумма меньше целевой, увеличиваем x
        const adjustmentFactor = Math.min(Math.abs(diff) / targetTotal * 0.1, 0.0001);
        if (diff > 0) {
            x -= adjustmentFactor; // Уменьшаем x, если сумма больше целевой
        } else {
            x += adjustmentFactor; // Увеличиваем x, если сумма меньше целевой
        }
    }
    
    // Проверяем, насколько близко мы к целевому значению
    const finalSum = geometricSum(initialAmount, x);
    console.log(`Итоговая разница: ${(finalSum - targetTotal).toFixed(15)}`);
    
    return x;
}

// Параметры задачи
const initialAmount = 183;    // Количество NFT в первый день
const targetTotal = 10000;   // Целевое общее количество NFT
const useManualX = true;     // Использовать ручное значение x вместо вычисленного
const manualX = 0.9817;      // Точное значение x из файла 98.ts

// Находим значение x для бесконечной геометрической прогрессии
const x = useManualX ? manualX : findXValue(targetTotal, initialAmount);

console.log(`\nРезультат для бесконечной прогрессии:`);
console.log(`Значение x = ${x.toFixed(16)}`);
console.log(`Метод получения x: ${useManualX ? 'задано вручную' : 'вычислено автоматически'}`);

// Проверяем результат для бесконечной прогрессии
const infiniteSum = geometricSum(initialAmount, x);
console.log(`Сумма бесконечной прогрессии при x = ${x.toFixed(16)}: ${infiniteSum.toFixed(10)}`);
console.log(`Разница с целевым значением: ${(infiniteSum - targetTotal).toFixed(10)}`);

// Проверяем результат для разного количества дней
const daysToCheck = [10, 100, 1000, 10000];
console.log(`\nПроверка для разного количества дней:`);

for (const days of daysToCheck) {
    const finiteSum = geometricSum(initialAmount, x, days);
    console.log(`За ${days} дней: ${finiteSum.toFixed(10)} NFT (${(finiteSum / targetTotal * 100).toFixed(2)}% от целевого значения)`);
}

// Вычисляем количество NFT для первых нескольких дней для проверки
console.log(`\nПроверка для первых 5 дней:`);
let dailyAmount = initialAmount;
let runningTotal = 0;

for (let day = 1; day <= 5; day++) {
    runningTotal += dailyAmount;
    console.log(`День ${day}: ${dailyAmount.toFixed(10)} NFT, всего: ${runningTotal.toFixed(10)} NFT`);
    dailyAmount *= x;
} 