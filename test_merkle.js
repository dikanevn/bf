const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');
const { MerkleTree } = require('merkletreejs');
const { PublicKey } = require('@solana/web3.js');

// Функция для вычисления sha256 хеша
function sha256(data) {
  return createHash('sha256').update(data).digest();
}

// Загружаем данные раунда 2
const roundNumber = 2;
const roundDataPath = path.join(__dirname, `b/rounds/${roundNumber}/d3.json`);
const d3Data = JSON.parse(fs.readFileSync(roundDataPath, 'utf8'));

// Создаем листья для меркл-дерева, включая NFTnumber
const leaves = d3Data.map(({ player, NFTnumber }) => {
  // Создаем буфер из адреса публичного ключа
  const pkBytes = Buffer.from(new PublicKey(player).toBytes());
  
  // Создаем буфер для NFTnumber (2 байта, uint16)
  const nftNumberBuffer = Buffer.alloc(2);
  nftNumberBuffer.writeUInt16LE(NFTnumber, 0);
  
  // Объединяем буферы: сначала адрес, затем NFTnumber
  const combinedBuffer = Buffer.concat([pkBytes, nftNumberBuffer]);
  
  // Хешируем объединенный буфер
  return sha256(combinedBuffer);
});

// Сортируем листья для консистентности
const sortedLeaves = leaves.slice().sort(Buffer.compare);

// Создаем меркл-дерево
const tree = new MerkleTree(sortedLeaves, sha256, { sortPairs: true });

// Получаем корень дерева
const root = tree.getRoot();

console.log('Merkle корень для раунда 2 (с учетом NFTnumber):');
console.log(root.toString('hex'));
console.log('Merkle корень в формате массива байтов:');
console.log('[' + Array.from(root).map(b => '0x' + b.toString(16).padStart(2, '0')).join(', ') + ']');

// Проверяем конкретный адрес
const testAddress = 'E9kCZevh9Y5piLjkzYuFdMBcr7XU1zdHRdYMnvHFhveH';
const testData = d3Data.find(item => item.player === testAddress);

if (testData) {
  const pkBytes = Buffer.from(new PublicKey(testAddress).toBytes());
  const nftNumberBuffer = Buffer.alloc(2);
  nftNumberBuffer.writeUInt16LE(testData.NFTnumber, 0);
  const combinedBuffer = Buffer.concat([pkBytes, nftNumberBuffer]);
  const leaf = sha256(combinedBuffer);
  
  const proof = tree.getProof(leaf);
  const isValid = tree.verify(proof, leaf, root);
  
  console.log(`\nПроверка для адреса ${testAddress} с NFTnumber ${testData.NFTnumber}:`);
  console.log('Merkle proof валиден:', isValid);
  console.log('Leaf:', leaf.toString('hex'));
  console.log('Proof length:', proof.length);
} 