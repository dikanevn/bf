import * as crypto from 'crypto';
import bs58 from 'bs58';

function bufferToBigInt(buffer: Buffer): bigint {
    const hex = buffer.toString('hex').padStart(buffer.length * 2, '0');
    console.log('Преобразование Buffer в hex строку:', hex);
    const result = BigInt('0x' + hex);
    console.log('Преобразование hex в BigInt:', result.toString());
    return result;
}

function generateRandomNumberForAddress(seed: string, address: string): bigint {
    console.log('\nНачало генерации случайного числа');
    console.log('Входные параметры:');
    console.log('- seed (blockHash):', seed);
    console.log('- address:', address);

    // Подготовка seed
    const seedBuffer = Buffer.from(seed.padStart(64, '0'), 'hex');
    console.log('\nПодготовка seed:');
    console.log('- seed в виде Buffer:', seedBuffer.toString('hex'));

    // Декодирование base58 адреса
    console.log('\nДекодирование base58 адреса:');
    const addressBytes = bs58.decode(address);
    console.log('- декодированный адрес (hex):', Buffer.from(addressBytes).toString('hex'));
    
    // Обработка публичного ключа
    const pubKeyBytes = addressBytes.slice(1, -4);
    console.log('- публичный ключ после удаления версии и контрольной суммы (hex):', 
        Buffer.from(pubKeyBytes).toString('hex'));
    
    // Первый хэш
    console.log('\nВычисление первого SHA256:');
    const concatenated = Buffer.concat([seedBuffer, Buffer.from(pubKeyBytes)]);
    console.log('- конкатенация seed и адреса (hex):', concatenated.toString('hex'));
    
    const hash1 = crypto.createHash('sha256')
        .update(concatenated)
        .digest();
    console.log('- результат первого SHA256 (hex):', hash1.toString('hex'));
    
    // Второй хэш
    console.log('\nВычисление второго SHA256:');
    const hash2 = crypto.createHash('sha256')
        .update(hash1)
        .digest();
    console.log('- результат второго SHA256 (hex):', hash2.toString('hex'));
    
    // Финальное преобразование
    console.log('\nФинальное преобразование в BigInt:');
    const result = bufferToBigInt(hash2);
    console.log('- итоговое случайное число (decimal):', result.toString());
    console.log('- итоговое случайное число (hex): 0x' + result.toString(16).padStart(64, '0'));
    
    return result;
}

function main() {
    const address = "133jM9QQWpTJfLT6UFQAW9cVeQWJejNWsyfFDWAfqxb9";
    const blockHash = "00000000000000000001e07e0f880e4570ec3b8c6f413c689316b24816901368";
    
    console.log('=== Начало выполнения программы ===\n');
    const randomNumber = generateRandomNumberForAddress(blockHash, address);
    console.log('\n=== Программа завершена ===');
}

main(); 