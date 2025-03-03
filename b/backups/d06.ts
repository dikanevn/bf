import * as crypto from 'crypto';

// Функции для работы с криптографией
function bufferToBigInt(buffer: Buffer): bigint {
    const hex = buffer.toString('hex').padStart(buffer.length * 2, '0');
    return BigInt('0x' + hex);
}

function shuffleArray<T>(array: T[], seed: string): T[] {
    const shuffled = [...array];
    
    console.log("Начальный массив:", shuffled);
    
    for (let i = shuffled.length - 1; i > 0; i--) {
        const indexBuffer = Buffer.alloc(4);
        indexBuffer.writeUInt32BE(i, 0);
        
        const hmac = crypto.createHmac('sha256', seed)
            .update(indexBuffer)
            .digest();
        
        const hashBigInt = bufferToBigInt(hmac);
        const j = Number(hashBigInt % BigInt(i + 1));
        
        console.log(`Итерация ${i}: i=${i}, j=${j}, hash=${hashBigInt}, до swap=${shuffled}`);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        console.log(`После swap=${shuffled}`);
    }
    
    return shuffled;
}

function generateRandomNumbers(seed: string, count: number): bigint[] {
    const numbers: bigint[] = [];
    const seedBuffer = Buffer.from(seed.padStart(64, '0'), 'hex');

    for (let i = 0; i < count; i++) {
        const indexBuffer = Buffer.alloc(4);
        indexBuffer.writeUInt32BE(i, 0);
        
        const hash1 = crypto.createHash('sha256')
            .update(Buffer.concat([seedBuffer, indexBuffer]))
            .digest();
        
        const hash2 = crypto.createHash('sha256')
            .update(hash1)
            .digest();
        
        const number = bufferToBigInt(hash2);
        numbers.push(number);
        
        console.log(`Генерация числа ${i}: hash1=${hash1.toString('hex')}, hash2=${hash2.toString('hex')}, bigint=${number}`);
    }

    return numbers;
}

function main() {
    const TOTAL_NUMBERS = 4;
    const BLOCK_HASH = '00000000000000000001e07e0f880e4570ec3b8c6f413c689316b24816901368';
    
    // Создаем массив чисел от 1 до 5
    const numbers = Array.from({ length: TOTAL_NUMBERS }, (_, i) => i + 1);
    
    console.log('Использован хэш блока:', BLOCK_HASH);

    // 1. Сначала перемешиваем порядок
    const shuffledNumbers = shuffleArray(numbers, BLOCK_HASH);
    
    // 2. Генерируем случайные числа для каждой позиции
    const randomNumbers = generateRandomNumbers(BLOCK_HASH, TOTAL_NUMBERS);

    // 3. Создаем массив с полной информацией и сортируем по исходным числам
    const results = shuffledNumbers.map((number, position) => ({
        number,
        position,
        randomValue: randomNumbers[position]
    }))
    .sort((a, b) => a.number - b.number);

    // 4. Выводим результаты
    console.log('\nРезультаты (отсортированы по исходным числам):');
    results.forEach(result => {
        console.log(`Число ${result.number}: позиция ${result.position}, randomValue: 0x${result.randomValue.toString(16)}`);
    });
}

main(); 