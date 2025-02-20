"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var anchor = require("@coral-xyz/anchor");
var web3_js_1 = require("@solana/web3.js");
var spl_token_1 = require("@solana/spl-token");
var fs = require("fs");
var path = require("path");
var crypto = require("crypto");
var url_1 = require("url");
var path_1 = require("path");
var merkletreejs_1 = require("merkletreejs");
// Определяем __dirname для ES-модулей
var __filename = (0, url_1.fileURLToPath)(import.meta.url);
var __dirname = (0, path_1.dirname)(__filename);
// Настройка провайдера из окружения (.env)
anchor.setProvider(anchor.AnchorProvider.env());
var provider = anchor.getProvider();
// Получаем программу "l" из workspace
var program = anchor.workspace.l;
// Константа FIXED_MINT, как указана в программе
var FIXED_MINT = new web3_js_1.PublicKey("91aT1KmqDzdBD6ZvJVFx79wdLv7WsgYQLkqXYv2Gxqpk");
// Загрузка корня меркл-дерева из файла merkleRoot
var merkleRootStr = fs.readFileSync(path.join(__dirname, "../merkleRoot"), "utf8").trim();
var expectedMerkleRoot = Buffer.from(merkleRootStr, "hex");
// Загрузка массива листьев (в виде hex-строк) и преобразование в Buffer
var leavesData = fs.readFileSync(path.join(__dirname, "../mleaves.json"), "utf8");
var leavesHex = JSON.parse(leavesData);
var leaves = leavesHex.map(function (hex) { return Buffer.from(hex, "hex"); });
// Загрузка массива адресов (адреса в base58)
var maddrsData = fs.readFileSync(path.join(__dirname, "../maddrs.json"), "utf8");
var addrList = JSON.parse(maddrsData);
// Функция хэширования, используемая в mer2.ts для вычисления SHA256
var hashFn = function (data) { return crypto.createHash("sha256").update(data).digest(); };
// Отсортируем листья так же, как это делалось в mer2.ts
var sortedLeaves = leaves.slice().sort(Buffer.compare);
// Создаём экземпляр меркл-дерева на основании отсортированных листьев
var tree = new merkletreejs_1.MerkleTree(sortedLeaves, hashFn, { sortPairs: true });
// Выводим вычисленный корневой хеш и сравниваем с ожидаемым (из файла merkleRoot)
var computedRoot = tree.getRoot();
console.log("Вычисленный корневой хеш меркл-дерева:", computedRoot.toString("hex"));
if (!computedRoot.equals(expectedMerkleRoot)) {
    console.error("Вычисленный корневой хеш не совпадает с ожидаемым!");
}
// Пример получения Merkle proof для конкретного leaf (например, для authority)
// const authorityLeaf = crypto.createHash("sha256").update(authority.toBuffer()).digest();
// const proof = tree.getProof(authorityLeaf).map(p => p.data);
// if (!tree.verify(proof, authorityLeaf, computedRoot)) {
//   throw new Error("Invalid Merkle Proof");
// }
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var authority, authorityLeaf, merkleProofBuffers, _a, mintAuthority, mintAuthorityBump, tokenAccount, merkleProof, txSignature, error_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 4, , 5]);
                    authority = provider.wallet.publicKey;
                    authorityLeaf = crypto.createHash("sha256").update(authority.toBuffer()).digest();
                    merkleProofBuffers = tree.getProof(authorityLeaf).map(function (p) { return p.data; });
                    console.log("Merkle Proof (в hex):", merkleProofBuffers.map(function (buf) { return buf.toString("hex"); }));
                    return [4 /*yield*/, web3_js_1.PublicKey.findProgramAddress([Buffer.from("mint_authority")], program.programId)];
                case 1:
                    _a = _b.sent(), mintAuthority = _a[0], mintAuthorityBump = _a[1];
                    return [4 /*yield*/, (0, spl_token_1.getAssociatedTokenAddress)(FIXED_MINT, authority)];
                case 2:
                    tokenAccount = _b.sent();
                    merkleProof = merkleProofBuffers.map(function (buf) { return Uint8Array.from(buf); });
                    return [4 /*yield*/, program.methods.mintOne(merkleProof)
                            .accounts({
                            authority: authority,
                            mint: FIXED_MINT,
                            tokenAccount: tokenAccount,
                            tokenProgram: spl_token_1.TOKEN_PROGRAM_ID,
                            associatedTokenProgram: spl_token_1.ASSOCIATED_TOKEN_PROGRAM_ID,
                            systemProgram: web3_js_1.SystemProgram.programId,
                            rent: web3_js_1.SYSVAR_RENT_PUBKEY,
                            mintAuthority: mintAuthority,
                        })
                            .rpc()];
                case 3:
                    txSignature = _b.sent();
                    console.log("Transaction signature:", txSignature);
                    return [3 /*break*/, 5];
                case 4:
                    error_1 = _b.sent();
                    console.error("Ошибка при выполнении транзакции:", error_1);
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    });
}
main();
