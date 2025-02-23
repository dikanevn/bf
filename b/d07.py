import hashlib
import base58

# Original seeds
seed1 = bytes.fromhex("00000000000000000001e07e0f880e4570ec3b8c6f413c689316b24816901368")

# Decoding the second seed from base58
decoded_seed2 = base58.b58decode("13aH1S8Nt5A7fbCVXFPChqWmBTs8tBUv2KWkdaaY8rpq")

# Trimming the version byte (first byte) and checksum (last 4 bytes)
seed2 = decoded_seed2[1:-4]

# Concatenating both seeds
combined_seed = seed1 + seed2

# Double SHA-256 hashing
hash1 = hashlib.sha256(combined_seed).digest()
hash2 = hashlib.sha256(hash1).hexdigest()

print(hash2)

# Converting the result into a percentage
hash_int = int(hash2, 16)
max_int = 2**256 - 1
percentage = (hash_int / max_int) * 100
print(f"Result in percentage: {percentage:.6f}%")