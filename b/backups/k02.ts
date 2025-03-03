import { Keypair } from "@solana/web3.js";
import * as fs from "fs";
import { Worker, isMainThread, parentPort, workerData } from "worker_threads";
import * as os from "os";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Получаем текущий файл и директорию для ES модулей
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

// Код для воркера
if (!isMainThread) {
  const { prefix } = workerData;
  
  // Бесконечный цикл поиска, пока не найдем или не получим сигнал остановки
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
    console.log("Начинаем поиск красивого адреса, используя все доступные ядра...");
    
    // Получаем префикс из аргументов командной строки или используем значение по умолчанию
    const args = process.argv.slice(2);
    const desiredPrefix = args[0] || "YAP";
    
    console.log(`Ищем адрес с префиксом: ${desiredPrefix}`);
    
    // Определяем количество доступных ядер (можно уменьшить, если нужно оставить ресурсы для других задач)
    const numCPUs = os.cpus().length;
    console.log(`Запускаем ${numCPUs} потоков для поиска...`);
    
    // Массив для хранения всех воркеров
    const workers: Worker[] = [];
    
    // Функция для остановки всех воркеров
    const stopAllWorkers = () => {
      console.log("Останавливаем все потоки...");
      workers.forEach(worker => worker.terminate());
    };
    
    // Создаем и запускаем воркеры
    for (let i = 0; i < numCPUs; i++) {
      const worker = new Worker(__filename, {
        workerData: { prefix: desiredPrefix }
      });
      
      workers.push(worker);
      
      // Обработчик сообщений от воркера
      worker.on('message', (message) => {
        if (message.found) {
          console.log(`Найден адрес: ${message.publicKey}`);
          
          // Сохраняем секретный ключ в файл
          const filename = `.env_key-${message.publicKey.slice(0, 8)}.json`;
          fs.writeFileSync(filename, JSON.stringify(message.secretKey));
          console.log(`Секретный ключ сохранен в файл: ${filename}`);
          
          // Останавливаем все воркеры, так как мы нашли адрес
          stopAllWorkers();
          
          // Выходим из программы с успешным статусом
          process.exit(0);
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