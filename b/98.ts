/**
 * Скрипт для расчета количества NFT по формуле y = 50 * (1/2)^(x/4)
 * 
 * Условия:
 * - x - количество дней
 * - y - количество NFT в день x
 * - NFT добывается каждые 10 минут (144 раза в день)
 */

/**
 * Функция для расчета количества NFT в день x по формуле y = 50 * (1/2)^(x/4)
 * 
 * @param day - день, для которого рассчитывается количество NFT
 * @returns количество NFT в указанный день
 */
function calculateNFTForDay(day: number): number {
    return 50 * Math.pow(0.5, day / 4);
}

/**
 * Функция для расчета количества NFT за 10 минут в день x
 * 
 * @param day - день, для которого рассчитывается количество NFT
 * @returns количество NFT за 10 минут в указанный день
 */
function calculateNFTPer10Min(day: number): number {
    // В день 144 периода по 10 минут (24 часа * 6 периодов в час)
    return calculateNFTForDay(day) / 144;
}

/**
 * Функция для расчета суммы NFT за указанное количество дней
 * 
 * @param days - количество дней
 * @returns общее количество NFT за указанное количество дней
 */
function calculateTotalNFT(days: number): number {
    let total = 0;
    for (let day = 1; day <= days; day++) {
        total += calculateNFTForDay(day);
    }
    return total;
}

/**
 * Функция для расчета суммы NFT за указанное количество дней с учетом добычи каждые 10 минут
 * 
 * @param days - количество дней
 * @returns общее количество NFT за указанное количество дней
 */
function calculateTotalNFTWithMining(days: number): number {
    let total = 0;
    for (let day = 1; day <= days; day++) {
        // В день 144 периода по 10 минут
        for (let period = 1; period <= 144; period++) {
            const dayFraction = day + (period - 1) / 144;
            total += 50 * Math.pow(0.5, dayFraction / 4);
        }
    }
    return total;
}

// Рассчитываем количество NFT для разных дней
console.log("Количество NFT по дням:");
console.log("----------------------");
const daysToCheck = [1, 2, 4, 8, 16, 32, 64, 100, 1000, 10000];
for (const day of daysToCheck) {
    const nft = calculateNFTForDay(day);
    console.log(`День ${day}: ${nft.toFixed(6)} NFT в день`);
    console.log(`День ${day}: ${calculateNFTPer10Min(day).toFixed(6)} NFT за 10 минут`);
}

// Рассчитываем общее количество NFT за разные периоды
console.log("\nОбщее количество NFT за период (без учета добычи каждые 10 минут):");
console.log("-----------------------------");
const periodsToCheck = [10, 100, 1000, 10000, 36500, 100000];
for (const period of periodsToCheck) {
    const total = calculateTotalNFT(period);
    console.log(`За ${period.toLocaleString()} дней: ${total.toFixed(6)} NFT`);
}

// Рассчитываем общее количество NFT за 100 лет с учетом добычи каждые 10 минут
const years100 = 36500; // 365 дней * 100 лет
console.log("\nОбщее количество NFT за 100 лет (с учетом добычи каждые 10 минут):");
const total100Years = calculateTotalNFTWithMining(years100);
console.log(`За 100 лет (${years100.toLocaleString()} дней): ${total100Years.toFixed(6)} NFT`);

// Рассчитываем количество NFT на 100000-й день
const day100000 = calculateNFTForDay(100000);
console.log("\nКоличество NFT на 100000-й день:");
console.log(`${day100000.toFixed(10)} NFT в день`);
console.log(`${calculateNFTPer10Min(100000).toFixed(10)} NFT за 10 минут`);

// Рассчитываем, через сколько дней количество NFT станет меньше определенных значений
console.log("\nКогда количество NFT станет меньше:");
const thresholds = [25, 10, 5, 1, 0.1, 0.01, 0.001];
for (const threshold of thresholds) {
    // Из формулы y = 50 * (1/2)^(x/4) получаем
    // (1/2)^(x/4) = y / 50
    // x/4 = log_0.5(y / 50)
    // x = 4 * log_0.5(y / 50)
    // log_0.5(z) = log(z) / log(0.5)
    
    const day = 4 * (Math.log(threshold / 50) / Math.log(0.5));
    console.log(`Меньше ${threshold} NFT в день: после ${Math.ceil(day)} дней`);
}

// Рассчитываем теоретическую сумму бесконечного ряда
// Для убывающей геометрической прогрессии с первым членом a и знаменателем r (|r| < 1)
// сумма бесконечного ряда равна S = a / (1 - r)
// В нашей формуле y = 50 * (1/2)^(x/4) для последовательных дней получаем:
// День 1: 50 * (1/2)^(1/4)
// День 2: 50 * (1/2)^(2/4)
// День 3: 50 * (1/2)^(3/4)
// День 4: 50 * (1/2)^(4/4) = 50 * 0.5 = 25
// День 5: 50 * (1/2)^(5/4)
// ...
// Это не является геометрической прогрессией в чистом виде, поэтому мы не можем
// использовать формулу суммы бесконечного ряда напрямую.

// Вместо этого мы можем аппроксимировать сумму, рассчитав её для очень большого количества дней
const approximateInfiniteSum = calculateTotalNFT(1000000);
console.log("\nПриближенная сумма бесконечного ряда (без учета добычи каждые 10 минут):");
console.log(`${approximateInfiniteSum.toFixed(6)} NFT`);

// Альтернативный подход - использовать интеграл для оценки суммы
// Интеграл от 50 * (1/2)^(x/4) dx от 1 до бесконечности
// Это можно вычислить аналитически, но для простоты мы используем численное приближение
function integralApproximation(): number {
    // Интеграл от 50 * (1/2)^(x/4) dx от 1 до бесконечности
    // = 50 * интеграл от (1/2)^(x/4) dx от 1 до бесконечности
    // = 50 * [-(4 * (1/2)^(x/4) / ln(1/2))]_1^∞
    // = 50 * [0 - (-(4 * (1/2)^(1/4) / ln(1/2)))]
    // = 50 * (4 * (1/2)^(1/4) / ln(2))
    
    const firstDayValue = 50 * Math.pow(0.5, 1/4);
    const integral = firstDayValue * 4 / Math.log(2);
    return integral;
}

const integralSum = integralApproximation();
console.log("\nОценка суммы с помощью интеграла:");
console.log(`${integralSum.toFixed(6)} NFT`);

// Сравнение с суммой за 100000 дней
console.log("\nСравнение:");
console.log(`Сумма за 100000 дней: ${calculateTotalNFT(100000).toFixed(6)} NFT`);
console.log(`Разница с интегральной оценкой: ${(integralSum - calculateTotalNFT(100000)).toFixed(6)} NFT`); 

// Теоретическая сумма с учетом добычи каждые 10 минут
// Можно аппроксимировать интегралом от 0 до бесконечности
function integralApproximationWithMining(): number {
    // Интеграл от 50 * (1/2)^(t/4) dt от 0 до бесконечности, где t - время в днях
    // = 50 * 4 / ln(2)
    return 50 * 4 / Math.log(2);
}

const integralSumWithMining = integralApproximationWithMining();
console.log("\nТеоретическая сумма с учетом непрерывной добычи:");
console.log(`${integralSumWithMining.toFixed(6)} NFT`); 