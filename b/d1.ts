import axios from 'axios';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

const API_KEY = process.env.DUNE_API_KEY;
const QUERY_ID = '4608193'; // Перенесли ID запроса прямо в код
const RESULTS_LIMIT = 50000; // Добавляем константу для лимита

if (!API_KEY) {
    throw new Error("Необходимо указать DUNE_API_KEY в .env файле");
}

async function fetchDuneData() {
    try {
        const response = await axios.get(
            `https://api.dune.com/api/v1/query/${QUERY_ID}/results?limit=${RESULTS_LIMIT}`,
            {
                headers: {
                    'X-Dune-API-Key': API_KEY
                }
            }
        );

        // Сохраняем данные в файл
        fs.writeFileSync(
            'd1.json',
            JSON.stringify(response.data, null, 2),
            'utf-8'
        );

        console.log('Данные успешно сохранены в d1.json');
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error('Ошибка при запросе к API:', error.message);
            if (error.response) {
                console.error('Статус ошибки:', error.response.status);
                console.error('Детали ошибки:', error.response.data);
            }
        } else {
            console.error('Неизвестная ошибка:', error);
        }
    }
}

async function fetchDuneDataCSV() {
    try {
        const response = await axios.get(
            `https://api.dune.com/api/v1/query/${QUERY_ID}/results/csv?limit=${RESULTS_LIMIT}`,
            {
                headers: {
                    'X-Dune-API-Key': API_KEY
                }
            }
        );

        // Сохраняем CSV данные в файл
        fs.writeFileSync(
            'd1.csv',
            response.data,
            'utf-8'
        );

        console.log('CSV данные успешно сохранены в d1.csv');
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error('Ошибка при запросе к API (CSV):', error.message);
            if (error.response) {
                console.error('Статус ошибки:', error.response.status);
                console.error('Детали ошибки:', error.response.data);
            }
        } else {
            console.error('Неизвестная ошибка:', error);
        }
    }
}

// Запускаем обе функции
async function main() {
    await fetchDuneData();
    await fetchDuneDataCSV();
}

main(); 