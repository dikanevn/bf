import { Keypair } from "@solana/web3.js";
import * as fs from "fs";
import { Worker, isMainThread, parentPort, workerData } from "worker_threads";
import * as os from "os";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Получаем текущий файл и директорию для ES модулей
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Имя файла для сохранения всех ключей
const KEYS_FILE = ".env_keys.json";

// Интерфейс для хранения ключей
interface KeyPair {
  publicKey: string;
  secretKey: number[];
  prefix: string;
  timestamp: string;
}

// Функция для генерации адреса с нужным префиксом (используется в воркере)
function generateBeautifulAddress(prefix: string): Keypair | null {
  // Генерируем определенное количество адресов перед проверкой сообщений от главного потока
  const maxAttempts = 10000;
  
  for (let i = 0; i < maxAttempts; i++) {
    const keypair = Keypair.generate();
    const address = keypair.publicKey.toString();
    
    // Проверяем, начинается ли адрес с нужным префиксом (с учетом регистра)
    if (address.startsWith(prefix)) {
      return keypair;
    }
  }
  
  return null; // Не нашли за maxAttempts попыток
}

// Функция для сохранения ключей в файл
function saveKeysToFile(keyPair: KeyPair): void {
  let keys: KeyPair[] = [];
  
  // Проверяем существует ли файл и читаем его содержимое
  if (fs.existsSync(KEYS_FILE)) {
    try {
      const fileContent = fs.readFileSync(KEYS_FILE, 'utf8');
      keys = JSON.parse(fileContent);
    } catch (error) {
      console.error('Ошибка при чтении файла с ключами:', error);
      // Если файл поврежден, начинаем с пустого массива
    }
  }
  
  // Добавляем новый ключ
  keys.push(keyPair);
  
  // Создаем строку, где каждый публичный ключ начинается с новой строки
  try {
    // Преобразуем массив ключей в строку JSON
    const jsonString = JSON.stringify(keys);
    
    // Заменяем закрывающую скобку объекта и открывающую скобку следующего объекта
    // на закрывающую скобку, перенос строки и открывающую скобку
    const formattedString = jsonString
      .replace(/\}\,\{/g, '},\n{')
      .replace(/^\[/, '[\n')  // Добавляем перенос строки после открывающей скобки массива
      .replace(/\]$/, '\n]'); // Добавляем перенос строки перед закрывающей скобкой массива
    
    fs.writeFileSync(KEYS_FILE, formattedString);
  } catch (error) {
    console.error('Ошибка при записи в файл с ключами:', error);
  }
}

// Код для воркера
if (!isMainThread) {
  const { prefix } = workerData;
  
  // Бесконечный цикл поиска
  while (true) {
    const result = generateBeautifulAddress(prefix);
    
    if (result) {
      // Если нашли подходящий адрес, отправляем его обратно в главный поток
      parentPort?.postMessage({
        found: true,
        publicKey: result.publicKey.toString(),
        secretKey: Array.from(result.secretKey)
      });
    }
  }
}
// Код для главного потока
else {
  async function main() {
    console.log("Начинаем бесконечный поиск красивых адресов, используя все доступные ядра...");
    console.log(`Все найденные ключи будут сохраняться в файл: ${KEYS_FILE}`);
    
    // Получаем префикс из аргументов командной строки или используем значение по умолчанию
    const args = process.argv.slice(2);
    const desiredPrefix = args[0] || "YAP";
    
    console.log(`Ищем адреса с префиксом: ${desiredPrefix}`);
    
    // Определяем количество доступных ядер
    const numCPUs = os.cpus().length - 1;
    console.log(`Запускаем ${numCPUs} потоков для поиска...`);
    
    // Массив для хранения всех воркеров
    const workers: Worker[] = [];
    
    // Функция для остановки всех воркеров
    const stopAllWorkers = () => {
      console.log("Останавливаем все потоки...");
      workers.forEach(worker => worker.terminate());
    };
    
    // Счетчик найденных адресов
    let foundCount = 0;
    
    // Создаем и запускаем воркеры
    for (let i = 0; i < numCPUs; i++) {
      const worker = new Worker(__filename, {
        workerData: { prefix: desiredPrefix }
      });
      
      workers.push(worker);
      
      // Обработчик сообщений от воркера
      worker.on('message', (message) => {
        if (message.found) {
          foundCount++;
          const publicKey = message.publicKey;
          
          // Создаем объект для сохранения
          const keyPair: KeyPair = {
            publicKey: publicKey,
            secretKey: message.secretKey,
            prefix: desiredPrefix,
            timestamp: new Date().toISOString()
          };
          
          // Сохраняем ключ в общий файл
          saveKeysToFile(keyPair);
          
          console.log(`[${foundCount}] Найден адрес: ${publicKey}`);
          console.log(`Ключ сохранен в файл: ${KEYS_FILE}`);
          console.log(`Продолжаем поиск...`);
        }
      });
      
      // Обработчик ошибок
      worker.on('error', (err) => {
        console.error(`Ошибка в потоке ${i}:`, err);
      });
      
      console.log(`Запущен поток ${i + 1}/${numCPUs}`);
    }
    
    // Обработчик для корректного завершения при нажатии Ctrl+C
    process.on('SIGINT', () => {
      console.log('\nПолучен сигнал прерывания. Завершаем работу...');
      stopAllWorkers();
      process.exit(0);
    });
  }
  
  main().catch(console.error);
} 