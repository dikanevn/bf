// Импортируем необходимые модули
import fs from 'fs';
import bs58 from 'bs58';

// Вставьте ваш приватный ключ в формате base58 (Phantom) сюда:
const PHANTOM_PRIVATE_KEY = 'qwerty';



// Декодируем приватный ключ
const decodedKey = bs58.decode(PHANTOM_PRIVATE_KEY);

// Преобразуем Uint8Array в массив чисел
const keyArray = Array.from(decodedKey);

// Сохраняем массив в файл key.txt в одну строку
fs.writeFileSync("key.txt", JSON.stringify(keyArray));

console.log("Приватный ключ успешно сохранён в key.txt"); 