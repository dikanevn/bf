/**
 * Скрипт для вычисления точной дроби для стремления к 21,000,000
 */

// Параметры
const targetEmission = 21000000;
const initialReward = 50;

// Вычисляем точную дробь
const exactDecimal = 1 - initialReward / targetEmission;
const exactFraction = {
    numerator: targetEmission - initialReward,
    denominator: targetEmission
};

// Вычисляем максимальную эмиссию с этой дробью
const maxEmission = initialReward / (1 - exactDecimal);

// Выводим результаты
console.log("Точная дробь для коэффициента уменьшения:");
console.log(`Десятичное значение: ${exactDecimal}`);
console.log(`Дробь: ${exactFraction.numerator}/${exactFraction.denominator}`);
console.log(`Максимальная эмиссия: ${maxEmission}`);

// Сравниваем с дробью 419999/420000
const approxFraction = {
    numerator: 419999,
    denominator: 420000
};
const approxDecimal = approxFraction.numerator / approxFraction.denominator;
const approxMaxEmission = initialReward / (1 - approxDecimal);

console.log("\nСравнение с дробью 419999/420000:");
console.log(`Десятичное значение: ${approxDecimal}`);
console.log(`Максимальная эмиссия: ${approxMaxEmission}`);
console.log(`Разница в эмиссии: ${Math.abs(maxEmission - approxMaxEmission)}`);

// Находим НОД для сокращения дроби
function gcd(a: number, b: number): number {
    a = Math.abs(a);
    b = Math.abs(b);
    if (b < 0.0000001) return a;
    return gcd(b, a % b);
}

// Сокращаем дробь
const gcdValue = gcd(exactFraction.numerator, exactFraction.denominator);
const simplifiedFraction = {
    numerator: exactFraction.numerator / gcdValue,
    denominator: exactFraction.denominator / gcdValue
};

console.log("\nСокращенная дробь:");
console.log(`${simplifiedFraction.numerator}/${simplifiedFraction.denominator}`);

// Проверяем, можно ли представить дробь в виде (n-1)/n
if (simplifiedFraction.numerator + 1 === simplifiedFraction.denominator) {
    console.log(`\nДробь можно представить в виде (n-1)/n, где n = ${simplifiedFraction.denominator}`);
    console.log(`Это соответствует уменьшению на 1/${simplifiedFraction.denominator} с каждым блоком`);
} 