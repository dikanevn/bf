import { Connection, PublicKey } from '@solana/web3.js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

// Функция для паузы между запросами
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Функция для получения транзакций с задержкой
async function getTransactionWithDelay(connection: Connection, signature: string) {
    await sleep(100); // Пауза 100мс между запросами
    return connection.getTransaction(signature, {
        maxSupportedTransactionVersion: 0
    });
}

async function getProgramLogs(programId: string) {
    console.log('\nНачало получения логов программы');
    console.log('ID программы:', programId);

    const rpcEndpoint = process.env.RPC_ENDPOINT_QUIKNODE;

    if (!rpcEndpoint) {
        throw new Error('RPC_ENDPOINT_QUIKNODE не указан в .env файле');
    }

    const connection = new Connection(rpcEndpoint, 'confirmed');
    console.log('Подключено к RPC:', rpcEndpoint);

    try {
        const programPublicKey = new PublicKey(programId);
        
        console.log('\nПолучение транзакций...');
        let allSignatures = [];
        let lastSignature = null;
        
        while (true) {
            const options: any = { limit: 100 }; // Уменьшили лимит до 10
            if (lastSignature) {
                options.before = lastSignature;
            }
            
            const signatures = await connection.getSignaturesForAddress(programPublicKey, options);
            if (signatures.length === 0) break;
            
            allSignatures.push(...signatures);
            
            lastSignature = signatures[signatures.length - 1].signature;
            console.log(`Получено ${allSignatures.length} транзакций...`);
            
            // Ограничим количество транзакций
            if (allSignatures.length >= 15000) break; // Уменьшили до 100
            
            await sleep(50); // Пауза 200мс между запросами подписей
        }

        console.log(`\nНайдено ${allSignatures.length} транзакций`);

        // Получаем детали транзакций небольшими группами
        const transactions = [];
        for (let i = 0; i < allSignatures.length; i += 10) {
            const batch = allSignatures.slice(i, i + 10);
            const batchResults = await Promise.all(
                batch.map(sig => getTransactionWithDelay(connection, sig.signature))
            );
            
            transactions.push(...batchResults.map((tx, index) => {
                const sig = batch[index];
                return {
                    signature: sig.signature,
                    blockTime: sig.blockTime 
                        ? new Date(sig.blockTime * 1000).toISOString() 
                        : 'unknown',
                    status: tx?.meta?.err ? 'failed' : 'success',
                    logMessages: tx?.meta?.logMessages || []
                };
            }));
            
            console.log(`Обработано ${transactions.length} из ${allSignatures.length} транзакций`);
            await sleep(250); // Пауза между группами
        }

        const result = {
            programId,
            totalTransactions: transactions.length,
            transactions: transactions
        };

        // Сохраняем результаты
        const outputDir = 'logs';
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        }

        const fileName = path.join(outputDir, `program_logs_${programId}_${Date.now()}.json`);
        fs.writeFileSync(
            fileName,
            JSON.stringify(result, null, 2)
        );

        console.log('\nРезультаты:');
        console.log(`Всего транзакций: ${result.totalTransactions}`);
        console.log(`Логи сохранены в: ${fileName}`);

        console.log('\nТранзакции:');
        result.transactions.forEach((tx, index) => {
            console.log(`\n${index + 1}. Транзакция:`);
            console.log(`   Время: ${tx.blockTime}`);
            console.log(`   Статус: ${tx.status}`);
            console.log(`   Сигнатура: ${tx.signature}`);
            console.log('   Логи:');
            tx.logMessages.forEach((log: string) => console.log(`     ${log}`));
        });

    } catch (error) {
        console.error('Ошибка при получении логов:', error);
        if (error instanceof Error) {
            console.error('Детали ошибки:', error.message);
        }
        process.exit(1);
    }
}

async function main() {
    const args = process.argv.slice(2);
    if (args.length < 1) {
        console.error('Укажите ID программы');
        console.error('Пример: ts-node log2.ts <program_id>');
        process.exit(1);
    }

    const programId = args[0];
    await getProgramLogs(programId);
}

main(); 