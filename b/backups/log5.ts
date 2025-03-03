import * as fs from 'fs';
import * as path from 'path';

interface Transaction {
    signature: string;
    blockTime: string;
    status: string;
    logMessages: string[];
}

interface LogFile {
    programId: string;
    totalTransactions: number;
    transactions: Transaction[];
}

function mergeLogs() {
    console.log('Начало объединения логов...');
    
    const logsDir = path.join('logs');
    const mainLogPath = path.join(logsDir, 'logsProgram.json');
    
    // Читаем основной файл логов
    let mainLog: LogFile;
    try {
        mainLog = JSON.parse(fs.readFileSync(mainLogPath, 'utf8'));
        console.log(`Прочитан основной файл логов: ${mainLog.totalTransactions} транзакций`);
    } catch (error) {
        console.error('Ошибка при чтении основного файла логов:', error);
        return;
    }

    // Создаём Set существующих сигнатур для быстрой проверки
    const existingSignatures = new Set(mainLog.transactions.map(tx => tx.signature));
    
    // Получаем список всех файлов логов
    const logFiles = fs.readdirSync(logsDir)
        .filter(file => file.startsWith('program_logs_') && file.endsWith('.json'));
    
    let newTransactionsCount = 0;
    let filesToDelete: string[] = [];

    // Обрабатываем каждый файл логов
    for (const file of logFiles) {
        const filePath = path.join(logsDir, file);
        try {
            const logData: LogFile = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            
            // Добавляем только новые транзакции
            for (const tx of logData.transactions) {
                if (!existingSignatures.has(tx.signature)) {
                    mainLog.transactions.push(tx);
                    existingSignatures.add(tx.signature);
                    newTransactionsCount++;
                }
            }
            
            if (file !== 'logsProgram.json') {
                filesToDelete.push(file);
            }
        } catch (error) {
            console.error(`Ошибка при обработке файла ${file}:`, error);
        }
    }

    // Сортируем транзакции по времени (новые первые)
    mainLog.transactions.sort((a, b) => 
        new Date(b.blockTime).getTime() - new Date(a.blockTime).getTime()
    );

    // Обновляем общее количество транзакций
    mainLog.totalTransactions = mainLog.transactions.length;

    // Сохраняем обновленный файл
    fs.writeFileSync(mainLogPath, JSON.stringify(mainLog, null, 2));

    console.log('\nРезультаты объединения:');
    console.log(`Добавлено новых транзакций: ${newTransactionsCount}`);
    console.log(`Всего транзакций после объединения: ${mainLog.totalTransactions}`);
    
    console.log('\nСледующие файлы можно удалить:');
    filesToDelete.forEach(file => console.log(`- ${file}`));
}

mergeLogs(); 