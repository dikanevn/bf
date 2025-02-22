import hashlib
import random
import time
import struct

manual_hash = ""  # Вставьте свой хэш сюда, если нужно
TOTAL_COUNT = 333
WIN_PROBABILITY = 5.999  # Вероятность выигрыша

def generate_block_hash():
    nonce = random.randint(0, 2**32)
    timestamp = str(time.time()).encode()
    prev_hash = hashlib.sha256(str(random.getrandbits(256)).encode()).hexdigest()
    
    block_content = f"{nonce}{timestamp.decode()}{prev_hash}"
    block_hash = hashlib.sha256(block_content.encode()).hexdigest()
    
    return block_hash

def hash_to_u64_pair(block_hash):
    shake = hashlib.shake_256(block_hash.encode())
    random_bytes = shake.digest(16)  # 16 bytes = two u64 numbers
    u64_1, u64_2 = struct.unpack("QQ", random_bytes)
    return u64_1, u64_2, shake

if __name__ == "__main__":
    block_hash = manual_hash if manual_hash else generate_block_hash()
    u64_1, u64_2, shake = hash_to_u64_pair(block_hash)
    first_random_byte = shake.digest(1)[0] / 255.0  # Нормализация байта в диапазоне [0,1]
    
    if WIN_PROBABILITY < 1:
        ZERO_OR_ONE = 1 if first_random_byte < WIN_PROBABILITY else 0
    else:
        ZERO_OR_ONE = int(WIN_PROBABILITY)
    
    print("Generated Block Hash:", block_hash)
    print("Random u64 numbers:", u64_1, u64_2)
    print("TOTAL COUNT:", TOTAL_COUNT)
    print("WIN PROBABILITY:", WIN_PROBABILITY)
    print("ZERO OR ONE:", ZERO_OR_ONE)
