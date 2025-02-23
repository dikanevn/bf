import { Connection, PublicKey } from '@solana/web3.js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import fetch from 'node-fetch';

dotenv.config();

// Token Program ID в Solana
const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const ASSOCIATED_TOKEN_PROGRAM_ID = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';

// Интерфейсы для типизации ответа QuickNode API
interface QuickNodeTransaction {
    signature: string;
    blockTime: number;
    err: any;
    logMessages: string[];
}

interface QuickNodeResponse {
    jsonrpc: string;
    id: string;
    result: QuickNodeTransaction[];
    error?: {
        code: number;
        message: string;
    };
}

async function findSlotByTimestamp(connection: Connection, timestamp: number): Promise<number> {
    let currentSlot = await connection.getSlot();
    let currentTime = await connection.getBlockTime(currentSlot);
    
    if (!currentTime) throw new Error('Не удалось получить время текущего слота');
    
    console.log('Поиск слота для времени:', new Date(timestamp * 1000).toISOString());
    
    // Примерное количество слотов в секунду в Solana
    const SLOTS_PER_SECOND = 2;
    
    // Примерная разница в слотах
    let slotDiff = (currentTime - timestamp) * SLOTS_PER_SECOND;
    let targetSlot = Math.max(1, Math.floor(currentSlot - slotDiff));
    
    console.log('Предполагаемый слот:', targetSlot);
    
    // Бинарный поиск для уточнения слота
    let left = Math.max(1, targetSlot - 1000);
    let right = targetSlot + 1000;
    
    while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        const time = await connection.getBlockTime(mid);
        
        if (!time) {
            right = mid - 1;
            continue;
        }
        
        console.log(`Проверка слота ${mid}, время: ${new Date(time * 1000).toISOString()}`);
        
        if (time === timestamp) {
            return mid;
        } else if (time < timestamp) {
            left = mid + 1;
        } else {
            right = mid - 1;
        }
    }
    
    return left;
}

async function getTransactionsByTime(
    mintAddress: string, 
    startTimestamp: number, 
    endTimestamp: number,
    rpcEndpoint: string
): Promise<QuickNodeTransaction[]> {
    const response = await fetch(rpcEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            "jsonrpc": "2.0",
            "id": "1",
            "method": "qn_getTransactionsByTime",
            "params": {
                "accountId": mintAddress,
                "startTime": startTimestamp,
                "endTime": endTimestamp,
                "limit": 100
            }
        })
    });

    const data = await response.json() as QuickNodeResponse;
    
    if (data.error) {
        throw new Error(`QuickNode API Error: ${data.error.message}`);
    }

    return data.result || [];
}

async function getTokenMintLogs(mintAddress: string, startTime: string, rpcType: string = 'q') {
    console.log('\nНачало получения логов минта токена');
    console.log('Адрес минта:', mintAddress);
    console.log('Начальное время:', startTime);

    const startTimestamp = Math.floor(new Date(startTime).getTime() / 1000);
    const endTimestamp = startTimestamp + (15 * 60); // +15 минут

    console.log('Временной диапазон поиска:');
    console.log('От:', new Date(startTimestamp * 1000).toISOString());
    console.log('До:', new Date(endTimestamp * 1000).toISOString());

    const rpcEndpoint = rpcType.toLowerCase() === 's' 
        ? process.env.RPC_ENDPOINT_SOLANA 
        : process.env.RPC_ENDPOINT_QUIKNODE;

    if (!rpcEndpoint) {
        throw new Error('RPC_ENDPOINT не указан в .env файле');
    }

    const connection = new Connection(rpcEndpoint, 'confirmed');
    console.log('Подключено к RPC:', rpcEndpoint);

    try {
        const mintPublicKey = new PublicKey(mintAddress);
        
        // Получаем все транзакции с пагинацией
        console.log('\nПолучение транзакций...');
        let allSignatures = [];
        let lastSignature = null;
        
        while (true) {
            const options: any = { limit: 1000 };
            if (lastSignature) {
                options.before = lastSignature;
            }
            
            const signatures = await connection.getSignaturesForAddress(mintPublicKey, options);
            if (signatures.length === 0) break;
            
            // Фильтруем по времени
            const relevantSignatures = signatures.filter(sig => {
                const txTime = sig.blockTime || 0;
                return txTime >= startTimestamp && txTime <= endTimestamp;
            });
            
            allSignatures.push(...relevantSignatures);
            
            // Проверяем, не вышли ли мы за пределы интересующего нас времени
            const lastTxTime = signatures[signatures.length - 1].blockTime || 0;
            if (lastTxTime < startTimestamp) break;
            
            lastSignature = signatures[signatures.length - 1].signature;
            console.log(`Получено ${allSignatures.length} транзакций...`);
        }

        console.log(`\nНайдено ${allSignatures.length} транзакций в указанном диапазоне`);

        // Получаем детали транзакций
        const transactions = await Promise.all(
            allSignatures.map(async (sig) => {
                const tx = await connection.getTransaction(sig.signature, {
                    maxSupportedTransactionVersion: 0
                });
                
                return {
                    signature: sig.signature,
                    blockTime: sig.blockTime ? new Date(sig.blockTime * 1000).toISOString() : 'unknown',
                    status: tx?.meta?.err ? 'failed' : 'success',
                    logMessages: tx?.meta?.logMessages || [],
                };
            })
        );

        // Сортируем по времени
        const sortedTransactions = transactions
            .filter(tx => tx.blockTime !== 'unknown')
            .sort((a, b) => {
                if (a.blockTime === 'unknown' || b.blockTime === 'unknown') return 0;
                return new Date(a.blockTime).getTime() - new Date(b.blockTime).getTime();
            });

        const result = {
            mintAddress,
            timeRange: {
                from: new Date(startTimestamp * 1000).toISOString(),
                to: new Date(endTimestamp * 1000).toISOString()
            },
            totalTransactions: sortedTransactions.length,
            transactions: sortedTransactions
        };

        // Сохраняем результаты
        const outputDir = 'logs';
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        }

        const fileName = path.join(outputDir, `mint_logs_${mintAddress}_${startTimestamp}.json`);
        fs.writeFileSync(
            fileName,
            JSON.stringify(result, null, 2)
        );

        console.log('\nРезультаты:');
        console.log(`Всего транзакций: ${result.totalTransactions}`);
        console.log(`Логи сохранены в: ${fileName}`);

        console.log('\nНайденные транзакции:');
        result.transactions.forEach((tx, index) => {
            console.log(`\n${index + 1}. Транзакция:`);
            console.log(`   Время: ${tx.blockTime}`);
            console.log(`   Статус: ${tx.status}`);
            console.log(`   Сигнатура: ${tx.signature}`);
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
    if (args.length < 2) {
        console.error('Укажите адрес минта токена, время начала и опционально тип RPC (s/q)');
        console.error('Пример: ts-node log1.ts <mint_address> <start_time> [s/q]');
        console.error('Время в формате: YYYY-MM-DD HH:mm:ss');
        process.exit(1);
    }

    const mintAddress = args[0];
    const startTime = args[1];
    const rpcType = args[2] || 'q';

    await getTokenMintLogs(mintAddress, startTime, rpcType);
}

main(); 