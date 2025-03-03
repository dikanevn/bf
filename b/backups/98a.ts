/**
 * Скрипт для расчета коэффициента x по заданной сумме бесконечной геометрической прогрессии
 */

/**
 * Функция для расчета коэффициента x по сумме бесконечной геометрической прогрессии
 * Из формулы S = a / (1 - r) выводим r = 1 - a/S
 * 
 * @param a - первый член прогрессии
 * @param sum - желаемая сумма бесконечной прогрессии
 * @returns коэффициент x (знаменатель прогрессии)
 */
function calculateXFromSum(a: number, sum: number): number {
    if (sum <= 0) {
        throw new Error('Сумма бесконечной прогрессии должна быть положительной');
    }
    
    if (a <= 0) {
        throw new Error('Первый член прогрессии должен быть положительным');
    }
    
    const x = 1 - a / sum;
    
    if (Math.abs(x) >= 1) {
        throw new Error('Невозможно получить указанную сумму: |x| должно быть меньше 1');
    }
    
    return x;
}

/**
 * Функция для проверки расчета суммы бесконечной геометрической прогрессии
 * 
 * @param a - первый член прогрессии
 * @param r - знаменатель прогрессии
 * @returns сумма бесконечной прогрессии
 */
function geometricSum(a: number, r: number): number {
    if (Math.abs(r) >= 1) {
        throw new Error('Для бесконечной прогрессии |r| должно быть меньше 1');
    }
    
    return a / (1 - r);
}

// Параметры для расчета
const initialAmount = 56;           // Начальное значение
const targetSum = 21000;             // Желаемая сумма бесконечной прогрессии

// Рассчитываем коэффициент x
const x = calculateXFromSum(initialAmount, targetSum);

// Проверяем результат
const calculatedSum = geometricSum(initialAmount, x);

console.log(`Расчет коэффициента x по заданной сумме бесконечной прогрессии:`);
console.log(`----------------------------------------`);
console.log(`Параметры:`);
console.log(`- Начальное значение: ${initialAmount}`);
console.log(`- Желаемая сумма бесконечной прогрессии: ${targetSum}`);
console.log(`\nРезультат:`);
console.log(`- Рассчитанный коэффициент x: ${x.toFixed(16)}`);
console.log(`- Проверка (сумма с этим коэффициентом): ${calculatedSum.toFixed(10)}`);

// Дополнительные примеры
console.log(`\nДополнительные примеры:`);
const examples = [
    { initialAmount: 100, targetSum: 5000 },
    { initialAmount: 200, targetSum: 8000 },
    { initialAmount: 500, targetSum: 15000 }
];

for (const example of examples) {
    const exampleX = calculateXFromSum(example.initialAmount, example.targetSum);
    console.log(`- Для начального значения ${example.initialAmount} и суммы ${example.targetSum}:`);
    console.log(`  Коэффициент x = ${exampleX.toFixed(16)}`);
} 