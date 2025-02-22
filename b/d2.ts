import * as fs from 'fs';

interface DuneData {
    result: {
        rows: Array<{
            raw_player: string;
            blocktime: string;
            // ... другие поля если есть
        }>;
    };
}

function processPlayers() {
    try {
        // Читаем данные из d1.json
        const rawData = fs.readFileSync('d1.json', 'utf-8');
        const data: DuneData = JSON.parse(rawData);

        // Проверяем структуру данных
        if (!data.result?.rows) {
            throw new Error('Неверная структура данных в d1.json');
        }

        // Временные границы
        const startDate = new Date('2025-02-18 19:00:00.000 UTC');
        const endDate = new Date('2025-02-19 19:00:00.000 UTC');

        console.log('Ищем игроков между:', startDate, 'и', endDate);

        // Фильтруем и получаем уникальных игроков в заданном временном диапазоне
        const filteredPlayers = data.result.rows
            .filter(row => {
                const timestamp = new Date(row.blocktime);
                const isInRange = timestamp >= startDate && timestamp <= endDate;
                if (isInRange) {
                    console.log('Найдена запись :', row.blocktime, row.raw_player);
                }
                return isInRange;
            })
            .map(row => row.raw_player)
            .filter((value, index, self) => self.indexOf(value) === index) // уникальные значения
            .sort(); // сортировка по алфавиту

        // Создаем нумерованный список игроков
        const numberedPlayers = filteredPlayers.map((player, index) => ({
            number: index + 1,
            player: player
        }));

        // Сохраняем результат в d2.json
        fs.writeFileSync(
            'd2.json',
            JSON.stringify(numberedPlayers, null, 2),
            'utf-8'
        );

        console.log(`Обработано ${numberedPlayers.length} уникальных игроков`);
        console.log('Результаты сохранены в d2.json');

    } catch (error) {
        console.error('Ошибка при обработке данных:', error);
        if (error instanceof Error) {
            console.error('Детали ошибки:', error.message);
        }
    }
}

processPlayers(); 