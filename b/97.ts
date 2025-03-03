/**
 * Скрипт для расчета суммы 50 * (419999/420000)^n за указанное количество игр
 * 
 * Используется точная дробь 419999/420000 для коэффициента уменьшения
 */

// Константы для настройки
const TOTAL_GAMES = 10000000; // Можно изменить на нужное количество игр
const DECAY_NUMERATOR = 419999.0000023; // Числитель дроби коэффициента уменьшения
const DECAY_DENOMINATOR = 420000; // Знаменатель дроби коэффициента уменьшения
const INITIAL_VALUE = 50; // Начальное значение

/**
 * Класс для представления дроби
 */
class Fraction {
    numerator: number;
    denominator: number;

    constructor(numerator: number, denominator: number = 1) {
        this.numerator = numerator;
        this.denominator = denominator;
        this.simplify();
    }

    /**
     * Упрощает дробь, сокращая числитель и знаменатель на их НОД
     */
    simplify(): void {
        const gcdValue = gcd(this.numerator, this.denominator);
        this.numerator = this.numerator / gcdValue;
        this.denominator = this.denominator / gcdValue;
    }

    /**
     * Возвращает десятичное представление дроби
     */
    toDecimal(): number {
        return this.numerator / this.denominator;
    }

    /**
     * Возвращает строковое представление дроби
     */
    toString(): string {
        return `${this.numerator}/${this.denominator}`;
    }

    /**
     * Возводит дробь в степень
     * 
     * @param power - степень
     * @returns результат возведения в степень
     */
    pow(power: number): number {
        return Math.pow(this.toDecimal(), power);
    }
}

/**
 * Функция для нахождения наибольшего общего делителя (НОД)
 * 
 * @param a - первое число
 * @param b - второе число
 * @returns наибольший общий делитель
 */
function gcd(a: number, b: number): number {
    a = Math.abs(a);
    b = Math.abs(b);
    if (b < 0.0000001) return a;
    return gcd(b, a % b);
}

/**
 * Функция для расчета значения на n-й игре
 * 
 * @param n - номер игры
 * @param initialValue - начальное значение (по умолчанию INITIAL_VALUE)
 * @param decayFactor - коэффициент уменьшения (по умолчанию DECAY_NUMERATOR/DECAY_DENOMINATOR)
 * @returns значение на n-й игре
 */
function calculateValueForGame(n: number, initialValue: number = INITIAL_VALUE, decayFactor: Fraction = new Fraction(DECAY_NUMERATOR, DECAY_DENOMINATOR)): number {
    return initialValue * decayFactor.pow(n);
}

/**
 * Функция для расчета суммы значений за указанное количество игр
 * 
 * @param games - количество игр
 * @param initialValue - начальное значение (по умолчанию INITIAL_VALUE)
 * @param decayFactor - коэффициент уменьшения (по умолчанию DECAY_NUMERATOR/DECAY_DENOMINATOR)
 * @returns сумма значений за указанное количество игр
 */
function calculateTotalValue(games: number, initialValue: number = INITIAL_VALUE, decayFactor: Fraction = new Fraction(DECAY_NUMERATOR, DECAY_DENOMINATOR)): number {
    let total = 0;
    for (let game = 1; game <= games; game++) {
        total += calculateValueForGame(game, initialValue, decayFactor);
    }
    return total;
}

/**
 * Функция для расчета теоретической максимальной суммы (сумма бесконечного ряда)
 * Для убывающей геометрической прогрессии с первым членом a и знаменателем r (|r| < 1)
 * сумма бесконечного ряда равна S = a / (1 - r)
 * 
 * @param initialValue - начальное значение (по умолчанию INITIAL_VALUE)
 * @param decayFactor - коэффициент уменьшения (по умолчанию DECAY_NUMERATOR/DECAY_DENOMINATOR)
 * @returns теоретическая максимальная сумма
 */
function calculateMaxValue(initialValue: number = INITIAL_VALUE, decayFactor: Fraction = new Fraction(DECAY_NUMERATOR, DECAY_DENOMINATOR)): number {
    return initialValue / (1 - decayFactor.toDecimal());
}

// Создаем точную дробь для коэффициента уменьшения
const decayFactor = new Fraction(DECAY_NUMERATOR, DECAY_DENOMINATOR);
const decayFactorValue = decayFactor.toDecimal();
const initialValue = INITIAL_VALUE;

// Рассчитываем значения для разных игр
console.log("Значения по играм:");
console.log("----------------------");
const gamesToCheck = [1, 10, 100, 1000, 10000, TOTAL_GAMES];
for (const game of gamesToCheck) {
    const value = calculateValueForGame(game, initialValue, decayFactor);
    console.log(`Игра ${game}: ${value.toFixed(8)}`);
}

// Рассчитываем суммы за разные периоды
console.log("\nСуммы за период:");
console.log("-----------------------------");
const periodsToCheck = [10, 100, 1000, 10000, TOTAL_GAMES];
for (const period of periodsToCheck) {
    const total = calculateTotalValue(period, initialValue, decayFactor);
    console.log(`За ${period.toLocaleString()} игр: ${total.toFixed(2)}`);
}

// Рассчитываем теоретическую максимальную сумму
const maxValue = calculateMaxValue(initialValue, decayFactor);
console.log("\nТеоретическая максимальная сумма (бесконечное количество игр):");
console.log(`${maxValue.toFixed(2)}`);

// Рассчитываем, через сколько игр будет достигнут определенный процент от максимальной суммы
console.log("\nКогда будет достигнуто:");
const percentages = [50, 75, 90, 95, 99, 99.9, 99.99];
for (const percentage of percentages) {
    const targetValue = maxValue * (percentage / 100);
    
    let games = 0;
    let sum = 0;
    while (sum < targetValue && games < 1000000) {
        games++;
        sum += calculateValueForGame(games, initialValue, decayFactor);
    }
    
    console.log(`${percentage}% от максимума (${targetValue.toFixed(2)}): после ${games.toLocaleString()} игр`);
}

// Рассчитываем, через сколько игр значение станет меньше определенных порогов
console.log("\nКогда значение станет меньше:");
const thresholds = [25, 10, 5, 1, 0.1, 0.01, 0.001];
for (const threshold of thresholds) {
    // Из формулы v = v0 * q^n получаем
    // q^n = v / v0
    // n = log_q(v / v0)
    // n = log(v / v0) / log(q)
    
    const games = Math.log(threshold / initialValue) / Math.log(decayFactorValue);
    
    console.log(`Меньше ${threshold}: после ${Math.ceil(games).toLocaleString()} игр`);
}

// Сравнение с формулой суммы геометрической прогрессии
// Для конечной геометрической прогрессии с первым членом a и знаменателем r
// сумма n членов равна S = a * (1 - r^n) / (1 - r)
function calculateGeometricSum(n: number, firstTerm: number, ratio: number): number {
    if (Math.abs(ratio - 1) < 1e-10) {
        return firstTerm * n;
    }
    return firstTerm * (1 - Math.pow(ratio, n)) / (1 - ratio);
}

const games100k = TOTAL_GAMES;
const sumDirect = calculateTotalValue(games100k, initialValue, decayFactor);
const sumFormula = calculateGeometricSum(games100k, initialValue * decayFactorValue, decayFactorValue);

console.log(`\nСравнение методов расчета суммы за ${TOTAL_GAMES.toLocaleString()} игр:`);
console.log(`Прямое суммирование: ${sumDirect.toFixed(2)}`);
console.log(`Формула геометрической прогрессии: ${sumFormula.toFixed(2)}`);
console.log(`Разница: ${(sumDirect - sumFormula).toFixed(10)}`);
console.log(`Процент от максимума: ${((sumDirect / maxValue) * 100).toFixed(6)}%`);

// Рассчитываем, сколько осталось до максимума
const remainingValue = maxValue - sumDirect;
console.log("\nОсталось до максимума:");
console.log(`${remainingValue.toFixed(2)} (${((remainingValue / maxValue) * 100).toFixed(6)}% от максимума)`); 