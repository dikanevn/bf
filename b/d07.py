import hashlib
import hmac
import struct
from typing import List, Tuple

def buffer_to_bigint(buffer: bytes) -> int:
    return int.from_bytes(buffer, byteorder='big')

def shuffle_array(array: List[int], seed: str) -> List[int]:
    shuffled = array[:]
    seed_bytes = bytes.fromhex(seed)
    
    print("Начальный массив:", shuffled)
    
    for i in range(len(shuffled) - 1, 0, -1):
        index_bytes = struct.pack('>I', i)
        hmac_digest = hmac.new(seed_bytes, index_bytes, hashlib.sha256).digest()
        hash_bigint = buffer_to_bigint(hmac_digest)
        
        # Изменяем вычисление j чтобы соответствовать TypeScript
        j = hash_bigint % (i + 1)  # Убираем int() и битовую маску
        
        print(f"Итерация {i}: i={i}, j={j}, hash={hash_bigint}, до swap={shuffled}")
        shuffled[i], shuffled[j] = shuffled[j], shuffled[i]
        print(f"После swap={shuffled}")
    
    return shuffled

def generate_random_numbers(seed: str, count: int) -> List[int]:
    numbers = []
    seed_bytes = bytes.fromhex(seed.zfill(64))
    
    for i in range(count):
        index_bytes = struct.pack('>I', i)
        hash1 = hashlib.sha256(seed_bytes + index_bytes).digest()
        hash2 = hashlib.sha256(hash1).digest()
        number = buffer_to_bigint(hash2)
        numbers.append(number)
        print(f"Генерация числа {i}: hash1={hash1.hex()}, hash2={hash2.hex()}, bigint={number}")
    
    return numbers

def main():
    TOTAL_NUMBERS = 4
    BLOCK_HASH = '00000000000000000001e07e0f880e4570ec3b8c6f413c689316b24816901368'
    
    numbers = list(range(1, TOTAL_NUMBERS + 1))
    
    print(f'Использован хэш блока: {BLOCK_HASH}')
    
    shuffled_numbers = shuffle_array(numbers, BLOCK_HASH)
    random_numbers = generate_random_numbers(BLOCK_HASH, TOTAL_NUMBERS)
    
    results = sorted([
        {
            'number': num,
            'position': pos,
            'randomValue': random_numbers[pos]
        }
        for pos, num in enumerate(shuffled_numbers)
    ], key=lambda x: x['number'])
    
    print('\nРезультаты (отсортированы по исходным числам):')
    for result in results:
        print(f'Число {result["number"]}: позиция {result["position"]}, randomValue: 0x{result["randomValue"]:x}')

main()
